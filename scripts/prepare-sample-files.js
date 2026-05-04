const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const JSZip = require('jszip');

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildTechCompanyProfileMarkdown() {
  return `# 星澜科技基础资料

## 公司概况
- 公司名称：星澜科技
- 成立时间：2021 年
- 总部地点：上海徐汇
- 员工规模：120 人左右
- 行业定位：企业服务软件 / 人力资源软件服务 / 智能工作流

## 核心产品
- 人力资源工作台：统一管理员工、组织、合同、异动与审批数据
- 招聘协同平台：覆盖岗位、候选人、简历、面试与录用通知流转
- 员工自助门户：支持请假、加班、工资单、资料变更与知识库问答
- 智能助手能力：支持简历解析、岗位匹配、员工服务问答、绩效洞察与离职风险预警

## 示例岗位画像
- 岗位：高级后端工程师
- 技能要求：服务端开发、数据库设计、缓存治理、类型安全脚本、智能工具编排
- 场景经验：中后台平台、审批流、人力资源软件服务、智能工作流
`;
}

async function buildResumeDocxBuffer(lines) {
  const zip = new JSZip();
  const body = lines
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`)
    .join('');

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

  zip.folder('_rels').file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
  );

  zip.folder('docProps').file(
    'core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>星澜科技候选人简历</dc:title>
  <dc:creator>智能人事系统</dc:creator>
  <cp:lastModifiedBy>智能人事系统</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-04-24T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-04-24T00:00:00Z</dcterms:modified>
</cp:coreProperties>`,
  );

  zip.folder('docProps').file(
    'app.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>智能人事系统</Application>
</Properties>`,
  );

  zip.folder('word').file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`,
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function main() {
  const samplesDir = join(process.cwd(), 'docs', 'samples');
  mkdirSync(samplesDir, { recursive: true });

  writeFileSync(join(samplesDir, 'tech-company-profile.md'), buildTechCompanyProfileMarkdown(), 'utf8');

  const resumeBuffer = await buildResumeDocxBuffer([
    '星澜科技候选人简历',
    '姓名：陈知行',
    '应聘岗位：高级后端工程师',
    '邮箱：chen.zhixing@example.com',
    '电话：13900001111',
    '核心技能：服务端开发、数据库设计、缓存治理、类型安全脚本、智能工具编排',
    '个人概述：5 年科技公司企业平台、智能工作流与招聘系统研发经验。',
    '工作经历：曾负责招聘工作台、薪酬发放、员工自助与绩效分析模块交付。',
    '项目成果：主导搭建人力资源软件服务，推动招聘筛选效率提升 35%。',
  ]);

  writeFileSync(join(samplesDir, 'candidate-resume.docx'), resumeBuffer);
  console.log(join(samplesDir, 'candidate-resume.docx'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
