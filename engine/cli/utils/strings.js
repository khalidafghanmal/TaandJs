export function toPascalCase(input) {
  const cleaned = String(input ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .join(' ')
    .replace(/[^a-zA-Z0-9_ ]+/g, ' ')
    .trim();

  if (!cleaned) return '';

  return cleaned
    .split(/[\s_]+/g)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

