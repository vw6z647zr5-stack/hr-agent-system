const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const root = process.cwd();
const ignoredDirectories = new Set(['node_modules', 'dist', 'uploads', '.history']);
const ignoredFiles = new Set(['package.json', 'package-lock.json', '.env', '.env.example']);
const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.md',
  '.json',
  '.html',
]);
const codeExtensions = new Set(['.ts', '.tsx', '.js']);

const allowedEnglishFragments = [
  /^[A-Z_][A-Z0-9_]*$/,
  /^https?:\/\//,
  /^\/?api\//,
  /^\/?socket\.io/,
  /^docs\//,
  /^uploads\//,
  /^apps\//,
  /^infra\//,
  /^scripts\//,
  /^node_modules\//,
  /^@/,
  /^[a-z0-9._/-]+\.(ts|tsx|js|md|json|html|css|sql|conf|yml|yaml|cmd|png|jpg|jpeg|svg|pdf|docx|txt|log)$/i,
  /^[a-z0-9._/-]*[\\/][a-z0-9._/-]+$/i,
  /^--?[a-z0-9-]+$/i,
  /^#[0-9a-f]+$/i,
];

const bannedVisibleFragments = [/Starwave/i, /\bHR\s+SaaS\b/i, /\bHR\b/i, /\bOffer\b/i, /Auto-approved/i];

const allowedTerms = new Set([
  'React',
  'TypeScript',
  'Vite',
  'Ant Design',
  'Tailwind CSS',
  'Node.js',
  'NestJS',
  'TypeORM',
  'REST',
  'WebSocket',
  'PostgreSQL',
  'Redis',
  'Docker',
  'Docker Compose',
  'LangChain',
  'DeepSeek',
  'OpenAI',
  'Markdown',
  'frontmatter',
  'PDF',
  'DOCX',
  'TXT',
  'JWT',
  'RBAC',
  'HTML',
  'CSS',
  'MIME',
  'JSON',
  'UUID',
  'SQL',
  'RAG',
  'Segoe UI',
  'PingFang SC',
  'Microsoft YaHei',
  'Oracle',
  'Java',
]);

function walk(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath, output);
      continue;
    }

    if (ignoredFiles.has(entry.name)) {
      continue;
    }

    if (textExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      output.push(absolutePath);
    }
  }

  return output;
}

function relativePath(absolutePath) {
  return absolutePath.slice(root.length + 1).replaceAll('\\', '/');
}

function stripAllowedTerms(line) {
  let result = line;
  for (const term of allowedTerms) {
    result = result.replace(new RegExp(escapeRegExp(term), 'gi'), '');
  }
  return result;
}

function stripTechnicalFragments(line) {
  return stripAllowedTerms(line)
    .replace(/\$\{[^}]*\}/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\b[A-Z][A-Z0-9_]{2,}\b/g, '')
    .replace(/[@\w.-]+[\\/][@\w./-]+/g, '')
    .replace(/\b[\w.-]+\.(ts|tsx|js|md|json|html|css|sql|conf|yml|yaml|cmd|png|jpg|jpeg|svg|pdf|docx|txt|log)\b/gi, '')
    .replace(/\b[a-z]+-[a-z0-9-]+\b/gi, '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getExtension(file) {
  const name = relativePath(file);
  return name.slice(name.lastIndexOf('.'));
}

function isCodeFile(file) {
  return codeExtensions.has(getExtension(file));
}

function isTechnicalText(value) {
  const trimmed = stripJsExpressionFragments(value).trim();
  if (!trimmed || !/[A-Za-z]/.test(trimmed)) {
    return true;
  }

  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    return false;
  }

  if (/^(GET|POST|PATCH|PUT|DELETE|OPTIONS|HEAD)$/i.test(trimmed)) {
    return true;
  }

  if (/^(true|false|null|undefined)$/i.test(trimmed)) {
    return true;
  }

  if (/^(noopener noreferrer|Successfully compiled|Nest application|Local:|ready in|ERROR|error)$/i.test(trimmed)) {
    return true;
  }

  if (/^data:image\//i.test(trimmed) || /base64,[A-Za-z0-9+/=]+/.test(trimmed)) {
    return true;
  }

  if (/^https?:\/\//i.test(trimmed) || /^\/[\w./?=&:%#-]+$/i.test(trimmed)) {
    return true;
  }

  if (/^[A-Z]:\\.+\.(exe|cmd|bat|ps1)$/i.test(trimmed)) {
    return true;
  }

  if (/^\.{1,2}[\\/]/.test(trimmed) || /^@?[\w.-]+[\\/][\w./-]+$/.test(trimmed)) {
    return true;
  }

  if (/^[\w.-]+\.(ts|tsx|js|md|json|html|css|sql|conf|yml|yaml|cmd|png|jpg|jpeg|svg|pdf|docx|txt|log)$/i.test(trimmed)) {
    return true;
  }

  if (/^[a-z][a-z0-9_.:/?=&%#{}[\]-]*$/i.test(trimmed) && !/\s/.test(trimmed)) {
    return true;
  }

  if (/^(npm|node|npx|docker|git|pnpm|yarn)(?:\s+[-\w:@./]+)+$/i.test(trimmed)) {
    return true;
  }

  if (/^(SELECT|INSERT|UPDATE|DELETE|WHERE|AND|OR|ILIKE)\b/i.test(trimmed) || /\b(ILIKE|WHERE|AND|OR)\b/.test(trimmed)) {
    return true;
  }

  if (/^<\/?\w/.test(trimmed)) {
    return true;
  }

  if (/^<!doctype\b/i.test(trimmed) || /^<\?xml\b/i.test(trimmed) || /<\/?(w|wp|a|r|ct|Relationships):/i.test(trimmed)) {
    return true;
  }

  if (/^<?reference\s+types=/i.test(trimmed)) {
    return true;
  }

  if (/^[a-z]+\.[a-zA-Z0-9_]+\s*[<>=!]+\s*:[a-zA-Z0-9_]+/.test(trimmed)) {
    return true;
  }

  const tokens = trimmed.split(/\s+/);
  const tailwindCoreTokens = new Set(['flex', 'grid', 'block', 'inline', 'hidden', 'relative', 'absolute', 'fixed', 'sticky']);
  if (
    tokens.length > 1 &&
    tokens.every((token) => /^[!?a-z0-9:[\]().,/%#_-]+$/i.test(token)) &&
    tokens.some((token) => /[-:[\]/]/.test(token) || tailwindCoreTokens.has(token))
  ) {
    return true;
  }

  return false;
}

function extractStringLiterals(line) {
  const literals = [];
  let index = 0;

  while (index < line.length) {
    const quote = line[index];
    if (quote !== "'" && quote !== '"' && quote !== '`') {
      index += 1;
      continue;
    }

    let cursor = index + 1;
    let value = '';
    while (cursor < line.length) {
      const character = line[cursor];
      if (character === '\\') {
        value += line.slice(cursor, cursor + 2);
        cursor += 2;
        continue;
      }

      if (character === quote) {
        break;
      }

      value += character;
      cursor += 1;
    }

    literals.push(value);
    index = cursor + 1;
  }

  return literals;
}

function stripJsExpressionFragments(value) {
  return value.replace(/\$\{[^}]*\}/g, ' ');
}

function findTextIssue(text) {
  const trimmed = stripJsExpressionFragments(text).trim();
  if (!trimmed) {
    return null;
  }

  if (/�|Ã|Â|â€|â€™|â€œ|â€�|鈥|锟/.test(trimmed)) {
    return '疑似乱码';
  }

  if (isTechnicalText(trimmed)) {
    return null;
  }

  const withoutTechnicalFragments = stripTechnicalFragments(trimmed);
  if (bannedVisibleFragments.some((pattern) => pattern.test(withoutTechnicalFragments))) {
    return '疑似英文文案';
  }

  const englishPhrases =
    withoutTechnicalFragments.match(/\b[A-Za-z]{3,}(?:[.'-][A-Za-z]+)?(?:\s+[A-Za-z]{2,}(?:[.'-][A-Za-z]+)?){1,}\b/g) ?? [];
  const suspiciousPhrases = englishPhrases.filter(
    (phrase) => !allowedEnglishFragments.some((pattern) => pattern.test(phrase)),
  );

  return suspiciousPhrases.length > 0 ? '疑似英文文案' : null;
}

function isCodeOnlyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }

  return (
    /^(import|export|const|let|type|interface|class|private|public|async|await|return|if|for|while|switch|case|break|continue)\b/.test(
      trimmed,
    ) ||
    /^[{}()[\],;]+$/.test(trimmed) ||
    /^\/\//.test(trimmed) ||
    /^\/\*/.test(trimmed) ||
    /^\*/.test(trimmed) ||
    /^<\w/.test(trimmed) ||
    /^<\/\w/.test(trimmed)
  );
}

function findIssues(file) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const issues = [];
  let inMarkdownCodeBlock = false;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (relativePath(file) === 'scripts/check-chinese-copy.js' && trimmed.includes("if (/�|")) {
      return;
    }

    if (/�|Ã|Â|â€|â€™|â€œ|â€�|鈥|锟/.test(line)) {
      issues.push({ lineNumber, type: '疑似乱码', text: trimmed });
      return;
    }

    if (isCodeFile(file)) {
      if (trimmed.startsWith('/// <reference')) {
        return;
      }

      if (/^(\/\/|\/\*|\*)/.test(trimmed)) {
        const issueType = findTextIssue(trimmed.replace(/^(\/\/|\/\*|\*)\s?/, ''));
        if (issueType) {
          issues.push({ lineNumber, type: issueType, text: trimmed });
        }
        return;
      }

      for (const literal of extractStringLiterals(line)) {
        const issueType = findTextIssue(literal);
        if (issueType) {
          issues.push({ lineNumber, type: issueType, text: trimmed });
          return;
        }
      }
      return;
    }

    if (getExtension(file) === '.md' && /^```/.test(trimmed)) {
      inMarkdownCodeBlock = !inMarkdownCodeBlock;
      return;
    }

    if (inMarkdownCodeBlock || isCodeOnlyLine(line)) {
      return;
    }

    const issueType = findTextIssue(trimmed);
    if (issueType) {
      issues.push({ lineNumber, type: issueType, text: trimmed });
    }
  });

  return issues;
}

const results = walk(root)
  .map((file) => ({ file: relativePath(file), issues: findIssues(file) }))
  .filter((item) => item.issues.length > 0);

if (results.length > 0) {
  for (const result of results) {
    console.error(`\n${result.file}`);
    for (const issue of result.issues.slice(0, 20)) {
      console.error(`  ${issue.lineNumber} [${issue.type}] ${issue.text}`);
    }
  }

  console.error(`\n发现 ${results.length} 个文件存在疑似非中文文案或乱码。`);
  process.exit(1);
}

console.log('中文文案检查通过。');
