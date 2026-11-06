import { Response } from '../http/Response.js';
import { Redirect } from '../http/Redirect.js';
import { assertDevDashboard } from '../support/DevDashboardGuard.js';

/**
 * Dev-only cache dashboard — beautiful UI for stats, keys, and flush controls.
 */
export class CacheDashboard {
  static guard(app, request) {
    assertDevDashboard(app, request);
  }

  static async index(app, request) {
    CacheDashboard.guard(app, request);
    const overview = await app.make('cache').overview();
    const store = request.query.store ?? app.make('config').get('cache.default', 'memory');
    const html = CacheDashboard.#render(overview, store);
    return Response.html(html);
  }

  static async flush(app, request) {
    CacheDashboard.guard(app, request);
    const store = request.query.store ?? request.input('store');
    const cache = app.make('cache');

    if (store) {
      await cache.store(store).flush();
    } else {
      const stores = Object.keys(app.make('config').get('cache.stores', {}));
      for (const name of stores) {
        await cache.store(name).flush();
      }
    }

    return Redirect.to('/__Taand/cache');
  }

  static #render(overview, activeStore) {
    const stores = Object.entries(overview);
    const active = overview[activeStore] ?? stores[0]?.[1];
    const stats = active?.stats ?? { hits: 0, misses: 0, writes: 0, hitRate: 0 };
    const driver = active?.driverStats ?? { entries: 0, bytes: 0 };
    const keys = active?.keys ?? [];

    const storeTabs = stores.map(([name, data]) => {
      const selected = name === activeStore ? 'active' : '';
      return `<a class="tab ${selected}" href="/__Taand/cache?store=${encodeURIComponent(name)}">${escapeHtml(name)} <span class="badge">${data.driverStats.entries}</span></a>`;
    }).join('');

    const keyRows = keys.length
      ? keys.map((k) => `<tr><td class="mono">${escapeHtml(k)}</td></tr>`).join('')
      : '<tr><td class="muted">No keys cached</td></tr>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Taand Cache</title>
  <style>
    :root {
      --bg: #0a0a0f;
      --panel: #12121a;
      --border: #1e1e2e;
      --text: #e4e4ef;
      --muted: #8888a0;
      --accent: #7c6cff;
      --accent2: #22d3ee;
      --green: #34d399;
      --orange: #fbbf24;
      --red: #f87171;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.5;
    }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }
    header { margin-bottom: 2rem; }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.25rem;
    }
    .subtitle { color: var(--muted); font-size: 0.9rem; }
    .tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .tab {
      padding: 0.5rem 1rem;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      text-decoration: none;
      font-size: 0.875rem;
      transition: border-color 0.15s, background 0.15s;
    }
    .tab:hover { border-color: var(--accent); }
    .tab.active { border-color: var(--accent); background: #1a1830; }
    .badge {
      background: var(--border);
      padding: 0.1rem 0.45rem;
      border-radius: 999px;
      font-size: 0.75rem;
      margin-left: 0.25rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
    }
    .card-label { color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .card-value { font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem; }
    .card-value.green { color: var(--green); }
    .card-value.cyan { color: var(--accent2); }
    .card-value.orange { color: var(--orange); }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1.5rem;
    }
    .panel-head {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .panel-title { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 0.65rem 1.25rem; border-top: 1px solid var(--border); font-size: 0.875rem; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; word-break: break-all; }
    .muted { color: var(--muted); }
    .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .btn {
      display: inline-block;
      padding: 0.55rem 1.1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      border: none;
      cursor: pointer;
    }
    .btn-danger { background: #3b1212; color: var(--red); border: 1px solid #5c2020; }
    .btn-danger:hover { background: #4a1515; }
    .btn-ghost { background: var(--panel); color: var(--muted); border: 1px solid var(--border); }
    footer { margin-top: 2rem; color: var(--muted); font-size: 0.8rem; text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Taand Cache</h1>
      <p class="subtitle">Dev dashboard — local only, debug mode</p>
    </header>

    <nav class="tabs">${storeTabs}</nav>

    <div class="grid">
      <div class="card"><div class="card-label">Hit rate</div><div class="card-value green">${stats.hitRate}%</div></div>
      <div class="card"><div class="card-label">Hits</div><div class="card-value cyan">${stats.hits}</div></div>
      <div class="card"><div class="card-label">Misses</div><div class="card-value orange">${stats.misses}</div></div>
      <div class="card"><div class="card-label">Writes</div><div class="card-value">${stats.writes}</div></div>
      <div class="card"><div class="card-label">Entries</div><div class="card-value">${driver.entries}</div></div>
      <div class="card"><div class="card-label">Size</div><div class="card-value">${formatBytes(driver.bytes)}</div></div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <span class="panel-title">Cached keys</span>
        <span class="muted">${keys.length} shown</span>
      </div>
      <table><tbody>${keyRows}</tbody></table>
    </div>

    <div class="actions">
      <a class="btn btn-danger" href="/__Taand/cache/flush?store=${encodeURIComponent(activeStore)}" data-store="${escapeHtml(activeStore)}" onclick="return confirm('Flush ' + this.dataset.store + ' store?')">Flush store</a>
      <a class="btn btn-danger" href="/__Taand/cache/flush" onclick="return confirm('Flush ALL stores?')">Flush all</a>
      <a class="btn btn-ghost" href="/">← Back to app</a>
    </div>

    <footer>TaandJs Cache · ${escapeHtml(activeStore)} driver: ${escapeHtml(active?.driver ?? 'unknown')}</footer>
  </div>
</body>
</html>`;
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${Math.round(n * 10) / 10} ${units[i]}`;
}
