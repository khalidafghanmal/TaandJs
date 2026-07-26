import { Response } from '../http/Response.js';
import { assertDevDashboard } from '../support/DevDashboardGuard.js';

/**
 * Dev mail preview dashboard — browse sent emails with a polished UI.
 */
export class MailDashboard {
  static guard(app, request) {
    assertDevDashboard(app, request);
  }

  static async index(app, request) {
    MailDashboard.guard(app, request);
    const overview = app.make('mail').overview();
    const mailer = request.query.mailer ?? 'array';
    const records = overview[mailer]?.sent ?? [];
    return Response.html(MailDashboard.#renderIndex(overview, mailer, records));
  }

  static async preview(app, request) {
    MailDashboard.guard(app, request);
    const id = request.params.id;
    const mailer = request.query.mailer ?? 'array';
    const record = app.make('mail').overview()[mailer]?.sent?.find((m) => m.id === id);

    if (!record?.message?.html) {
      throw HttpError.notFound('Mail preview not found');
    }

    return Response.html(record.message.html);
  }

  static #renderIndex(overview, activeMailer, records) {
    const tabs = Object.keys(overview).map((name) => {
      const count = overview[name].sent?.length ?? 0;
      const active = name === activeMailer ? 'active' : '';
      return `<a class="tab ${active}" href="/__Taand/mail?mailer=${encodeURIComponent(name)}">${escapeHtml(name)} <span class="badge">${count}</span></a>`;
    }).join('');

    const rows = records.length
      ? records.slice().reverse().map((r) => `
        <tr>
          <td class="mono muted">${escapeHtml(r.sentAt)}</td>
          <td>${escapeHtml(r.message?.to?.map((a) => a.email).join(', ') ?? '')}</td>
          <td>${escapeHtml(r.message?.subject ?? '')}</td>
          <td><a class="link" href="/__Taand/mail/preview/${encodeURIComponent(r.id)}?mailer=${encodeURIComponent(activeMailer)}" target="_blank">Preview</a></td>
        </tr>`).join('')
      : '<tr><td colspan="4" class="muted">No mail sent yet — try <code>mail.to(...).send(...)</code></td></tr>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Taand Mail</title>
  <style>
    :root { --bg:#0a0a0f; --panel:#12121a; --border:#1e1e2e; --text:#e4e4ef; --muted:#8888a0; --accent:#7c6cff; --accent2:#22d3ee; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Segoe UI',system-ui,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; }
    .wrap { max-width:1100px; margin:0 auto; padding:2rem 1.5rem; }
    h1 { font-size:1.75rem; font-weight:700; background:linear-gradient(135deg,var(--accent),var(--accent2)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .subtitle { color:var(--muted); font-size:.9rem; margin:.25rem 0 1.5rem; }
    .tabs { display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:1.5rem; }
    .tab { padding:.5rem 1rem; background:var(--panel); border:1px solid var(--border); border-radius:8px; color:var(--text); text-decoration:none; font-size:.875rem; }
    .tab.active { border-color:var(--accent); background:#1a1830; }
    .badge { background:var(--border); padding:.1rem .45rem; border-radius:999px; font-size:.75rem; margin-left:.25rem; }
    .panel { background:var(--panel); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
    table { width:100%; border-collapse:collapse; }
    th, td { padding:.75rem 1.25rem; text-align:left; border-top:1px solid var(--border); font-size:.875rem; }
    th { color:var(--muted); font-weight:600; font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; border-top:none; }
    .mono { font-family:ui-monospace,monospace; font-size:.8rem; }
    .muted { color:var(--muted); }
    .link { color:var(--accent2); text-decoration:none; font-weight:600; }
    .link:hover { text-decoration:underline; }
    .footer { margin-top:2rem; text-align:center; color:var(--muted); font-size:.8rem; }
    code { background:#1a1a28; padding:2px 6px; border-radius:4px; font-size:.8rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Taand Mail</h1>
    <p class="subtitle">Dev outbox — preview sent emails locally</p>
    <nav class="tabs">${tabs}</nav>
    <div class="panel">
      <table>
        <thead><tr><th>Sent</th><th>To</th><th>Subject</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="footer">Use mailer <code>array</code> or <code>file</code> in dev to capture messages here.</p>
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
