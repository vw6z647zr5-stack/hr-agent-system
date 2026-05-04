import JSZip from 'jszip';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function normalizeLines(lines: string[]) {
  return lines.map((line) => line.trim()).filter(Boolean);
}

function buildDocumentXml(lines: string[]) {
  const paragraphs = normalizeLines(lines)
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

async function buildDocxBuffer(title: string, lines: string[]) {
  const zip = new JSZip();
  const documentXml = buildDocumentXml(lines);

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
  );

  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
  );

  zip.folder('docProps')?.file(
    'core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>智能人事系统</dc:creator>
  <cp:lastModifiedBy>智能人事系统</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-04-24T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-04-24T00:00:00Z</dcterms:modified>
</cp:coreProperties>`,
  );

  zip.folder('docProps')?.file(
    'app.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>智能人事系统</Application>
</Properties>`,
  );

  zip.folder('word')?.file('document.xml', documentXml);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export function buildTechCompanyProfileMarkdown() {
  return `# 星澜科技基础资料

## 公司概况
- 公司名称：星澜科技
- 成立时间：2021 年
- 总部地点：上海
- 公司定位：面向中大型企业的人力资源数字化与智能工作流平台提供商
- 核心方向：招聘协同、员工自助、绩效管理、薪酬核算、智能助手

## 业务简介
星澜科技专注于构建一体化人力资源软件服务平台，覆盖组织管理、招聘流程、考勤休假、绩效评估与薪酬发放。
平台提供智能简历解析、岗位匹配评分、员工服务问答和离职风险预警能力，服务对象以科技、先进制造和连锁服务企业为主。

## 组织架构
- 人力资源部：负责招聘、员工关系、组织发展与制度运营
- 工程平台部：负责后端服务、数据平台、工作流编排与系统可靠性
- 产品设计部：负责人力资源场景产品规划、交互设计与客户需求收敛
- 商业运营部：负责销售拓展、客户成功与交付协同

## 基础制度
- 工作时间：周一至周五 09:00 - 18:00
- 办公模式：上海总部 + 混合办公
- 请假流程：员工自助提交，直属主管审批，人力资源团队复核关键异常
- 加班流程：填写时间区间与原因，审批通过后进入薪酬计算
- 工资单发放：按月发布，可在员工自助端查看并下载

## 产品能力
- 组织与员工档案管理
- 招聘岗位、候选人、简历、面试、录用通知全链路管理
- 请假、加班、考勤异常与审批流转
- 绩效周期、绩效目标、绩效评审与改进建议
- 薪酬配置、工资生成、工资单发布与员工自助下载
- 基于智能能力的招聘助手、员工服务助手与绩效分析助手

## 示例岗位画像
- 岗位：高级后端工程师
- 关键技能：服务端开发、数据库设计、缓存治理、类型安全脚本、工作流系统设计
- 业务背景：人力资源软件服务、企业中后台、审批流或智能助手平台经验
- 协作要求：能与产品、人力资源、前端和测试团队高效协同
`;
}

export async function buildSampleResumeDocxBuffer() {
  return buildDocxBuffer('星澜科技候选人简历', [
    '星澜科技候选人简历',
    '姓名：陈知行',
    '应聘岗位：高级后端工程师',
    '邮箱：chen.zhixing@example.com',
    '电话：13900001111',
    '核心技能：服务端开发、数据库设计、缓存治理、类型安全脚本、智能工具编排',
    '个人概述：5 年科技公司 B 端平台、智能工作流与招聘系统研发经验。',
    '工作经历：曾负责招聘工作台、薪酬发放、员工自助与绩效分析模块交付。',
    '项目成果：主导搭建人力资源软件服务，推动招聘筛选效率提升 35%。',
  ]);
}

export function buildSampleResumeText() {
  return [
    '星澜科技候选人简历',
    '姓名：陈知行',
    '应聘岗位：高级后端工程师',
    '邮箱：chen.zhixing@example.com',
    '电话：13900001111',
    '核心技能：服务端开发、数据库设计、缓存治理、类型安全脚本、智能工具编排',
    '个人概述：5 年科技公司 B 端平台、智能工作流与招聘系统研发经验。',
    '工作经历：曾负责招聘工作台、薪酬发放、员工自助与绩效分析模块交付。',
    '项目成果：主导搭建人力资源软件服务，推动招聘筛选效率提升 35%。',
  ].join('\n');
}
