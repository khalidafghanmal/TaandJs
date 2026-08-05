/**
 * MIME types and magic-byte validation — blocks disguised uploads.
 */
export const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
};

const SIGNATURES = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'audio/mpeg', bytes: [0xff, 0xfb] },
  { mime: 'audio/mpeg', bytes: [0x49, 0x44, 0x33] },
  { mime: 'video/mp4', bytes: [0x00, 0x00, 0x00] },
];

const BLOCKED_EXT = new Set([
  '.php', '.phtml', '.phar', '.exe', '.sh', '.bat', '.cmd', '.js', '.mjs', '.cjs',
  '.html', '.htm', '.htaccess', '.env', '.json',
  '.svg', '.svgz',
]);

export function extname(filename) {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

export function mimeFromExt(filename) {
  return MIME_BY_EXT[extname(filename)] ?? 'application/octet-stream';
}

export function isBlockedExtension(filename) {
  return BLOCKED_EXT.has(extname(filename));
}

export function sniffMime(buffer) {
  if (!buffer || buffer.length < 4) return null;

  for (const sig of SIGNATURES) {
    if (sig.bytes.every((b, i) => buffer[i] === b)) {
      return sig.mime;
    }
  }

  if (buffer[0] === 0x3c && buffer[1] === 0x3f) return null;
  if (buffer[0] === 0x3c && buffer[1] === 0x68) return null;

  return null;
}

export function categoryForMime(mime, allowed) {
  for (const [category, types] of Object.entries(allowed)) {
    if (types.includes(mime)) return category;
  }
  return null;
}

export function dispositionForMime(mime) {
  // Never inline SVG — browsers execute embedded script in SVG as same-origin.
  if (mime === 'image/svg+xml') return 'attachment';
  if (mime.startsWith('image/') || mime.startsWith('audio/') || mime.startsWith('video/')) {
    return 'inline';
  }
  return 'attachment';
}
