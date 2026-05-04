import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { buildManagedDocumentFile } from './managed-document.utils';
import { DocumentRagService } from './document-rag.service';

export const COMPANY_FACT_CATEGORIES = [
  'company_overview',
  'office',
  'schedule',
  'benefits',
  'organization',
  'operations',
  'security',
  'support',
] as const;

export const COMPANY_FACT_STATUSES = ['draft', 'published', 'archived'] as const;

export type CompanyFactCategory = (typeof COMPANY_FACT_CATEGORIES)[number];
export type CompanyFactStatus = (typeof COMPANY_FACT_STATUSES)[number];

export interface CompanyFactItem {
  id: string;
  category: CompanyFactCategory;
  label: string;
  value: string;
  description: string;
  source: string;
  tags: string[];
  status: CompanyFactStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

type CompanyFactsFile = {
  version: string;
  updatedAt: string;
  items: CompanyFactItem[];
};

@Injectable()
export class CompanyFactsService implements OnModuleInit {
  private readonly factsFilePath = join(process.cwd(), 'docs/company/managed/company-facts.json');
  private readonly generatedDocumentPath = join(process.cwd(), 'docs/company/managed/company-facts-center.md');

  constructor(private readonly documentRagService: DocumentRagService) {}

  async onModuleInit() {
    await this.ensureStorage();
  }

  async listFacts(query?: { search?: string; category?: string; status?: string }) {
    const file = await this.loadFactsFile();
    const normalizedSearch = query?.search?.trim().toLowerCase();

    return file.items
      .filter((item) => {
        if (query?.category && item.category !== query.category) {
          return false;
        }

        if (query?.status && item.status !== query.status) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return [item.label, item.value, item.description, item.source, item.category, ...item.tags]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, 'zh-CN'));
  }

  async getPublishedFacts() {
    return this.listFacts({ status: 'published' });
  }

  async getFact(id: string) {
    const file = await this.loadFactsFile();
    const item = file.items.find((fact) => fact.id === id);

    if (!item) {
      throw new NotFoundException('未找到公司基础信息字段。');
    }

    return item;
  }

  async createFact(payload: Omit<CompanyFactItem, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const file = await this.loadFactsFile();
    const item: CompanyFactItem = {
      id: randomUUID(),
      category: payload.category,
      label: payload.label.trim(),
      value: payload.value.trim(),
      description: payload.description.trim(),
      source: payload.source.trim(),
      tags: payload.tags,
      status: payload.status,
      sortOrder: payload.sortOrder,
      createdAt: now,
      updatedAt: now,
    };

    file.items.push(item);
    await this.saveFactsFile(file);
    return item;
  }

  async updateFact(id: string, payload: Omit<CompanyFactItem, 'id' | 'createdAt' | 'updatedAt'>) {
    const file = await this.loadFactsFile();
    const index = file.items.findIndex((fact) => fact.id === id);

    if (index === -1) {
      throw new NotFoundException('未找到公司基础信息字段。');
    }

    const current = file.items[index]!;
    const next: CompanyFactItem = {
      ...current,
      category: payload.category,
      label: payload.label.trim(),
      value: payload.value.trim(),
      description: payload.description.trim(),
      source: payload.source.trim(),
      tags: payload.tags,
      status: payload.status,
      sortOrder: payload.sortOrder,
      updatedAt: new Date().toISOString(),
    };

    file.items[index] = next;
    await this.saveFactsFile(file);
    return next;
  }

  async removeFact(id: string) {
    const file = await this.loadFactsFile();
    const nextItems = file.items.filter((fact) => fact.id !== id);

    if (nextItems.length === file.items.length) {
      throw new NotFoundException('未找到公司基础信息字段。');
    }

    file.items = nextItems;
    await this.saveFactsFile(file);
    return { success: true };
  }

  private async ensureStorage() {
    await mkdir(dirname(this.factsFilePath), { recursive: true });

    try {
      await readFile(this.factsFilePath, 'utf8');
    } catch {
      const now = new Date().toISOString();
      await writeFile(
        this.factsFilePath,
        JSON.stringify(
          {
            version: '1.0.0',
            updatedAt: now,
            items: this.buildDefaultFacts(now),
          } satisfies CompanyFactsFile,
          null,
          2,
        ),
        'utf8',
      );
    }

    const file = await this.loadFactsFile();
    await this.syncGeneratedDocument(file);
  }

  private async loadFactsFile() {
    await this.ensureFactsFileDirectory();
    const raw = await this.readFactsFileContent();
    const parsed = this.parseFactsFile(raw);

    return {
      version: parsed.version || '1.0.0',
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      items: Array.isArray(parsed.items) ? parsed.items.map((item) => this.normalizeFact(item)) : [],
    } satisfies CompanyFactsFile;
  }

  private async saveFactsFile(file: CompanyFactsFile) {
    const nextFile: CompanyFactsFile = {
      ...file,
      version: this.bumpVersion(file.version),
      updatedAt: new Date().toISOString(),
      items: file.items
        .map((item) => this.normalizeFact(item))
        .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, 'zh-CN')),
    };

    await writeFile(this.factsFilePath, JSON.stringify(nextFile, null, 2), 'utf8');
    await this.syncGeneratedDocument(nextFile);
    this.documentRagService.invalidateCache();
  }

  private async syncGeneratedDocument(file: CompanyFactsFile) {
    const publishedFacts = file.items
      .filter((item) => item.status === 'published')
      .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, 'zh-CN'));

    const grouped = new Map<CompanyFactCategory, CompanyFactItem[]>();

    for (const item of publishedFacts) {
      const current = grouped.get(item.category) ?? [];
      current.push(item);
      grouped.set(item.category, current);
    }

    const sections = COMPANY_FACT_CATEGORIES.flatMap((category) => {
      const items = grouped.get(category) ?? [];
      if (items.length === 0) {
        return [];
      }

      const lines = [`## ${this.getCategoryLabel(category)}`];
      for (const item of items) {
        lines.push(`- ${item.label}：${item.value}`);
        if (item.description) {
          lines.push(`  说明：${item.description}`);
        }
        if (item.source) {
          lines.push(`  来源：${item.source}`);
        }
      }

      return [lines.join('\n')];
    });

    const body = [
      '## 数据说明',
      '- 本文档由结构化公司基础信息中心自动生成，只收录已发布字段。',
      '- 若字段被归档或改为草稿，将自动退出 RAG 检索。',
      '',
      ...(sections.length > 0 ? sections : ['## 当前状态', '- 暂无已发布的结构化公司基础信息字段。']),
    ].join('\n');

    const publishedAt = new Date().toISOString();
    const markdown = buildManagedDocumentFile(
      {
        title: '公司基础信息中心',
        category: 'company_profile',
        scope: 'docs/company/managed',
        status: 'published',
        version: file.version,
        owner: '系统自动生成',
        reviewer: '系统自动审核',
        submittedAt: publishedAt,
        approvedBy: '系统自动审核',
        approvedAt: publishedAt,
        approvalComment: '自动同步生成的已发布文档。',
        effectiveDate: publishedAt.slice(0, 10),
        reviewNotes: '由结构化公司基础信息中心自动同步，仅收录已发布字段。',
        tags: ['公司基础信息', '结构化事实', '自动生成'],
        lastPublishedAt: publishedAt,
      },
      body,
    );

    await writeFile(this.generatedDocumentPath, markdown, 'utf8');
  }

  private async ensureFactsFileDirectory() {
    await mkdir(dirname(this.factsFilePath), { recursive: true });
  }

  private async readFactsFileContent() {
    try {
      return await readFile(this.factsFilePath, 'utf8');
    } catch {
      const now = new Date().toISOString();
      const initialFile = {
        version: '1.0.0',
        updatedAt: now,
        items: this.buildDefaultFacts(now),
      } satisfies CompanyFactsFile;
      await writeFile(this.factsFilePath, JSON.stringify(initialFile, null, 2), 'utf8');
      return JSON.stringify(initialFile);
    }
  }

  private parseFactsFile(raw: string): CompanyFactsFile {
    try {
      const parsed = JSON.parse(raw) as Partial<CompanyFactsFile>;
      return {
        version: parsed.version || '1.0.0',
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        items: Array.isArray(parsed.items) ? parsed.items.map((item) => this.normalizeFact(item)) : [],
      };
    } catch {
      return this.recoverCorruptFactsFile();
    }
  }

  private recoverCorruptFactsFile(): CompanyFactsFile {
    const now = new Date().toISOString();
    const recovered = {
      version: '1.0.0',
      updatedAt: now,
      items: this.buildDefaultFacts(now),
    } satisfies CompanyFactsFile;

    const backupPath = `${this.factsFilePath}.${now.replace(/[:.]/g, '-')}.corrupt`;
    void rename(this.factsFilePath, backupPath).catch(() => undefined);
    void writeFile(this.factsFilePath, JSON.stringify(recovered, null, 2), 'utf8').catch(() => undefined);

    return recovered;
  }

  private normalizeFact(item: Partial<CompanyFactItem>): CompanyFactItem {
    const now = new Date().toISOString();

    return {
      id: item.id || randomUUID(),
      category: COMPANY_FACT_CATEGORIES.includes(item.category as CompanyFactCategory)
        ? (item.category as CompanyFactCategory)
        : 'company_overview',
      label: String(item.label ?? '').trim(),
      value: String(item.value ?? '').trim(),
      description: String(item.description ?? '').trim(),
      source: String(item.source ?? '').trim(),
      tags: Array.isArray(item.tags)
        ? item.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : [],
      status: COMPANY_FACT_STATUSES.includes(item.status as CompanyFactStatus)
        ? (item.status as CompanyFactStatus)
        : 'draft',
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0,
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || now,
    };
  }

  private bumpVersion(version: string) {
    const parts = version.split('.').map((item) => Number(item));
    if (parts.length !== 3 || parts.some((item) => Number.isNaN(item))) {
      return '1.0.0';
    }

    const major = parts[0] ?? 1;
    const minor = parts[1] ?? 0;
    const patch = parts[2] ?? 0;
    return `${major}.${minor}.${patch + 1}`;
  }

  private getCategoryLabel(category: CompanyFactCategory) {
    const labels: Record<CompanyFactCategory, string> = {
      company_overview: '公司概况',
      office: '办公信息',
      schedule: '工作与协作时间',
      benefits: '福利与补贴',
      organization: '组织与服务目录',
      operations: '运营节奏',
      security: '安全与合规',
      support: '支持与联系渠道',
    };

    return labels[category];
  }

  private buildDefaultFacts(now: string): CompanyFactItem[] {
    const items: Array<Omit<CompanyFactItem, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        category: 'company_overview',
        label: '公司名称',
        value: '星澜科技',
        description: '企业服务软件与人力资源智能工作流公司。',
        source: '公司基础资料',
        tags: ['公司信息', '概况'],
        status: 'published',
        sortOrder: 10,
      },
      {
        category: 'company_overview',
        label: '成立时间',
        value: '2021 年',
        description: '总部位于上海徐汇。',
        source: '公司基础资料',
        tags: ['成立时间'],
        status: 'published',
        sortOrder: 20,
      },
      {
        category: 'company_overview',
        label: '行业定位',
        value: '企业服务软件 / 人力资源软件服务 / 智能工作流',
        description: '面向成长型科技公司、连锁零售企业和区域服务集团。',
        source: '公司基础资料',
        tags: ['行业', '产品'],
        status: 'published',
        sortOrder: 30,
      },
      {
        category: 'office',
        label: '总部地址',
        value: '上海市徐汇区龙耀路 88 号星澜科技中心 A 栋',
        description: '8 层客户成功与销售，9 层产品和工程，10 层人力与职能支持。',
        source: '办公与福利指南',
        tags: ['办公地址', '楼层'],
        status: 'published',
        sortOrder: 40,
      },
      {
        category: 'schedule',
        label: '标准工作时间',
        value: '周一至周五 09:00-18:00，午休 12:00-13:00',
        description: '核心协作时间为 10:00-17:00。',
        source: '员工手册',
        tags: ['工作时间', '午休'],
        status: 'published',
        sortOrder: 50,
      },
      {
        category: 'schedule',
        label: '混合办公规则',
        value: '每周至少 3 天现场办公，远程办公需在前一工作日 18:00 前报备',
        description: '客户交付、面试、保密资料处理等场景优先现场完成。',
        source: '办公与福利指南',
        tags: ['混合办公', '远程办公'],
        status: 'published',
        sortOrder: 60,
      },
      {
        category: 'benefits',
        label: '学习发展预算',
        value: '每人每年 3000 元',
        description: '岗位相关课程、认证考试和行业会议可申请报销。',
        source: '公司基础资料',
        tags: ['福利', '学习发展'],
        status: 'published',
        sortOrder: 70,
      },
      {
        category: 'benefits',
        label: '基础福利',
        value: '五险一金、年度体检、补充商业保险、节日福利',
        description: '转正后员工次年起纳入统一体检计划。',
        source: '办公与福利指南',
        tags: ['福利', '保险'],
        status: 'published',
        sortOrder: 80,
      },
      {
        category: 'organization',
        label: '核心部门',
        value: '人力资源部、工程平台部、产品设计部、客户成功部、财务与行政部、信息技术支持部',
        description: '覆盖组织人事、研发、产品、交付、财务和信息技术支持。',
        source: '组织与服务目录',
        tags: ['部门', '组织架构'],
        status: 'published',
        sortOrder: 90,
      },
      {
        category: 'support',
        label: '资料变更入口',
        value: '员工自助端提交，人力资源团队审批后生效',
        description: '适用于手机号、地址、紧急联系人等信息更新。',
        source: '组织与服务目录',
        tags: ['资料变更', '员工自助'],
        status: 'published',
        sortOrder: 100,
      },
      {
        category: 'support',
        label: '设备与账号支持入口',
        value: '联系信息技术支持部或提交信息技术支持工单',
        description: '适用于账号权限、设备管理、网络与安全问题。',
        source: '组织与服务目录',
        tags: ['信息技术支持', '设备', '账号'],
        status: 'published',
        sortOrder: 110,
      },
      {
        category: 'operations',
        label: '工资单发布时间',
        value: '每月 10 日前',
        description: '每月 5 日前锁数，8 日前完成薪酬复核。',
        source: '运营节奏与关键节点',
        tags: ['工资单', '发薪'],
        status: 'published',
        sortOrder: 120,
      },
      {
        category: 'operations',
        label: '转正发起时间',
        value: '试用期结束前 10 个工作日',
        description: '直属经理发起，人力资源团队复核材料与考勤。',
        source: '试用期与转正制度',
        tags: ['转正', '试用期'],
        status: 'published',
        sortOrder: 130,
      },
      {
        category: 'security',
        label: '敏感权限开通要求',
        value: '涉及薪酬、绩效、合同和候选人简历的权限需审批',
        description: '默认按最小权限开通，管理员、人力资源和财务岗位必须启用双因素认证。',
        source: '信息安全与权限管理制度',
        tags: ['权限', '信息安全'],
        status: 'published',
        sortOrder: 140,
      },
      {
        category: 'security',
        label: '安全事件响应时限',
        value: '30 分钟内联系信息技术支持部',
        description: '适用于账号异常登录、权限误配、设备遗失或疑似数据泄露。',
        source: '信息安全与权限管理制度',
        tags: ['安全事件', '响应'],
        status: 'published',
        sortOrder: 150,
      },
    ];

    return items.map((item) => ({
      ...item,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    }));
  }
}
