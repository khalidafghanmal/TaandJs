/**
 * Convert bind address to a URL you can open in a browser.
 * 0.0.0.0 and :: mean "all interfaces" — browsers need localhost.
 */
export function toBrowseHost(host) {
  if (!host || host === '0.0.0.0' || host === '::' || host === '[::]') {
    return '127.0.0.1';
  }
  return host;
}

export function toBrowseUrl(host, port, { protocol = 'http' } = {}) {
  return `${protocol}://${toBrowseHost(host)}:${port}`;
}
