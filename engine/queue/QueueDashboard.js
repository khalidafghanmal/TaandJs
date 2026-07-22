import { Response } from '../http/Response.js';
import { Redirect } from '../http/Redirect.js';
import { assertDevDashboard } from '../support/DevDashboardGuard.js';
import { JobPayload } from './JobPayload.js';

export class QueueDashboard {
  static guard(app, request) {
    assertDevDashboard(app, request);
  }

  static async index(app, request) {
    QueueDashboard.guard(app, request);
    const overview = await app.make('queue').overview();
    return Response.html(QueueDashboard.#render(overview));
  }

  static async retry(app, request) {
    QueueDashboard.guard(app, request);
    const uuid = request.params.uuid;
    await app.make('queue.failed').retry(uuid, app.make('queue'));
    return Redirect.to('/__Taand/queue');
  }

  static #render(overview) {
    const connRows = Object.entries(overview.connections).map(([name, data]) => `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td><span class="badge">${escapeHtml(data.driver)}</span></td>
        <td>${data.pending}</td>
      </tr>`).join('');

    const failedRows = overview.failed.length
      ? overview.failed.map((f) => {
        let jobName = 'unknown';
        try { jobName = JobPayload.unpack(f.payload).job; } catch { /* ignore */ }
        return `<tr>
          <td class="mono muted">${escapeHtml(f.failedAt?.toISOString?.() ?? String(f.failedAt))}</td>
          <td>${escapeHtml(f.queue)}</td>
          <td>${escapeHtml(jobName)}</td>
          <td class="mono error">${escapeHtml(f.exception.split('\n')[0])}</td>
          <td><a class="link" href="/__Taand/queue/retry/${encodeURIComponent(f.uuid)}">Retry</a></td>
        </tr>`;
      }).join('')
      : '<tr><td colspan="5" class="muted">No failed jobs</td></tr>';

    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Taand Queue</title>
<style>
:root{--bg:#0a0a0f;--panel:#12121a;--border:#1e1e2e;--text:#e4e4ef;--muted:#8888a0;--accent:#7c6cff;--accent2:#22d3ee;--red:#f87171}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
.wrap{max-width:1100px;margin:0 auto;padding:2rem 1.5rem}
h1{font-size:1.75rem;font-weight:700;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.subtitle{color:var(--muted);font-size:.9rem;margin:.25rem 0 1.5rem}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:1.5rem}
.panel-head{padding:1rem 1.25rem;border-bottom:1px solid var(--border);font-weight:600}
table{width:100%;border-collapse:collapse}
th,td{padding:.75rem 1.25rem;text-align:left;border-top:1px solid var(--border);font-size:.875rem}
th{color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;border-top:none}
.mono{font-family:ui-monospace,monospace;font-size:.8rem}
.muted{color:var(--muted)}.error{color:var(--red)}
.badge{background:var(--border);padding:.15rem .5rem;border-radius:6px;font-size:.75rem}
.link{color:var(--accent2);text-decoration:none;font-weight:600}
.footer{margin-top:2rem;text-align:center;color:var(--muted);font-size:.8rem}
code{background:#1a1a28;padding:2px 6px;border-radius:4px}
</style></head><body>
<div class="wrap">
  <h1>Taand Queue</h1>
  <p class="subtitle">Dev dashboard — pending & failed jobs</p>
  <div class="panel"><div class="panel-head">Connections</div>
    <table><thead><tr><th>Name</th><th>Driver</th><th>Pending</th></tr></thead><tbody>${connRows}</tbody></table>
  </div>
  <div class="panel"><div class="panel-head">Failed jobs</div>
    <table><thead><tr><th>Failed</th><th>Queue</th><th>Job</th><th>Error</th><th></th></tr></thead><tbody>${failedRows}</tbody></table>
  </div>
  <p class="footer">Run worker: <code>npm run queue:work</code></p>
</div></body></html>`;
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
