export function buildAttachmentContentDisposition(fileName: string) {
  const normalizedFileName = (fileName || 'download')
    .replace(/[\r\n\u0000]/g, ' ')
    .trim()
    .slice(0, 180) || 'download';
  const fallback = normalizedFileName
    .replace(/["\\;]/g, '_')
    .replace(/[^\x20-\x7e]/g, '_')
    .trim() || 'download';
  const encoded = encodeURIComponent(normalizedFileName)
    .replace(/['()]/g, (item) => `%${item.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, '%2A');

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
