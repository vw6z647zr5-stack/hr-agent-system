const windows1252Bytes: Record<string, number> = {
  '\u20ac': 0x80,
  '\u201a': 0x82,
  '\u0192': 0x83,
  '\u201e': 0x84,
  '\u2026': 0x85,
  '\u2020': 0x86,
  '\u2021': 0x87,
  '\u02c6': 0x88,
  '\u2030': 0x89,
  '\u0160': 0x8a,
  '\u2039': 0x8b,
  '\u0152': 0x8c,
  '\u017d': 0x8e,
  '\u2018': 0x91,
  '\u2019': 0x92,
  '\u201c': 0x93,
  '\u201d': 0x94,
  '\u2022': 0x95,
  '\u2013': 0x96,
  '\u2014': 0x97,
  '\u02dc': 0x98,
  '\u2122': 0x99,
  '\u0161': 0x9a,
  '\u203a': 0x9b,
  '\u0153': 0x9c,
  '\u017e': 0x9e,
  '\u0178': 0x9f,
};

export function repairTextEncoding(value: string) {
  if (!value) {
    return value;
  }

  const decoded = decodeAsUtf8FromSingleByte(value);
  if (decoded && shouldPreferDecoded(value, decoded)) {
    return decoded;
  }

  return value;
}

export function normalizeExtractedText(value: string) {
  return repairTextEncoding(value)
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function decodeAsUtf8FromSingleByte(value: string) {
  const bytes: number[] = [];

  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;

    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }

    const mapped = windows1252Bytes[char];
    if (mapped !== undefined) {
      bytes.push(mapped);
      continue;
    }

    return null;
  }

  return Buffer.from(bytes).toString('utf8');
}

function shouldPreferDecoded(original: string, decoded: string) {
  if (decoded === original || !decoded.trim()) {
    return false;
  }

  const originalScore = getEncodingScore(original);
  const decodedScore = getEncodingScore(decoded);

  if (decodedScore.bad > originalScore.bad && decodedScore.cjk <= originalScore.cjk) {
    return false;
  }

  if (decodedScore.cjk > originalScore.cjk && decodedScore.bad <= originalScore.bad + 1) {
    return true;
  }

  return originalScore.bad >= 2 && decodedScore.bad < originalScore.bad;
}

function getEncodingScore(value: string) {
  const cjk = value.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const replacement = value.match(/\ufffd/g)?.length ?? 0;
  const controls = value.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g)?.length ?? 0;
  const mojibakeMarkers =
    value.match(/(?:\u00c3|\u00c2|\u00e2[\u0080-\uffff]?|\u951f|[\u00e5\u00e6\u00e7\u00e8\u00e9][\u0080-\u00ff]?)/g)
      ?.length ?? 0;

  return {
    cjk,
    bad: replacement * 8 + controls * 4 + mojibakeMarkers * 2,
  };
}
