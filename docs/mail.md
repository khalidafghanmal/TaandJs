# Mail

Send beautiful, secure emails from TaandJs — Taand's `Mail` facade and more. Mailables, HTML templates, SMTP, dev outbox UI, and production-ready security.

## What is mail?

**Mail** lets your app send emails — welcome messages, password resets, receipts, notifications. Taand goes beyond Taand with a **dev mail dashboard**, **file outbox**, **native SMTP** (zero extra packages), and **built-in rate limiting**.

**Jump to:** [Examples — basic to advanced (HTML templates)](#examples--basic-to-advanced-html-templates)

---

## Quick start

```js
import mail from '../start/mail.js';
import { WelcomeMail } from '../src/mail/WelcomeMail.js';

await mail.to('user@example.com').send(new WelcomeMail(app, user));
```

### Raw message

```js
import { MailMessage } from '../engine/mail/MailMessage.js';

await mail.to('user@example.com').send(
  MailMessage.make(app)
    .subject('Hello!')
    .html('<p>Welcome aboard.</p>'),
);
```

### In a controller

```js
await this.mail().to($user.email).send(new WelcomeMail(this.app, user));
```

---

## Mailable classes

```js
// src/mail/WelcomeMail.js
import { Mailable } from '../../engine/mail/Mailable.js';
import { MailMessage } from '../../engine/mail/MailMessage.js';

export class WelcomeMail extends Mailable {
  constructor(app, user) {
    super(app);
    this.user = user;
  }

  async build() {
    return MailMessage.make(this.app)
      .to(this.user.email)
      .subject('Welcome!')
      .view('welcome', {
        name: this.user.name,
        actionUrl: '/dashboard',
      });
  }
}
```

---

## Mail templates

Templates live in `ui/mail/`:

```
ui/mail/
├── layout.taand      # Shared email layout
└── welcome.taand     # Welcome email body
```

**`mail/welcome.taand`**
```html
@layout mail.layout

@section content
  <h1>Welcome, {{ $name }}!</h1>
  <p>Thanks for joining {{ $appName }}.</p>
@end
```

Use `.view('welcome', data)` — the `mail.` prefix is added automatically.

---

## Examples — basic to advanced (HTML templates)

Step-by-step examples for sending HTML email in Taand. Start at **Level 1** and move up as you need more power.

### Level 1 — Inline HTML (simplest)

No template file. Good for quick tests.

```js
import mail from '../start/mail.js';
import { MailMessage } from '../engine/mail/MailMessage.js';
import { app } from '../start/app.js';

await app.bootstrap();

await mail.to('user@example.com').send(
  MailMessage.make(app)
    .subject('Hello!')
    .html('<h1 style="color:#7c6cff;">Hello!</h1><p>Welcome aboard.</p>'),
);
```

Plain-text is auto-generated from HTML if you skip `.text()`.

---

### Level 2 — HTML template file (`.taand`)

**Step 1** — Create `ui/mail/hello.taand`:

```html
<h1 style="margin:0 0 12px;font-size:22px;color:#1b1b18;">Hi {{ $name }}!</h1>
<p style="margin:0;font-size:15px;color:#44403c;">This is your first HTML template email.</p>
```

**Step 2** — Send it:

```js
import mail from '../start/mail.js';
import { MailMessage } from '../engine/mail/MailMessage.js';
import { app } from '../start/app.js';

await app.bootstrap();

await mail.to('user@example.com').send(
  MailMessage.make(app)
    .subject('Hello from a template')
    .view('hello', { name: 'Raees' }),
);
```

`.view('hello', data)` renders `ui/mail/hello.taand`.

---

### Level 3 — Layout + section (professional HTML email)

Use a shared layout so every email has the same header, footer, and styles.

**Layout** — `ui/mail/layout.taand` (already in your project):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{ $subject ?? $appName }}</title>
</head>
<body style="margin:0;background:#f4f4f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" style="background:#fff;border-radius:12px;">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#7c6cff,#22d3ee);">
              <p style="margin:0;color:#fff;font-weight:600;">{{ $appName }}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              @show content
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#fafafa;text-align:center;">
              <p style="margin:0;font-size:12px;color:#888;">Sent by {{ $appName }}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

**Child template** — `ui/mail/welcome.taand`:

```html
@layout mail.layout

@section content
  <h1 style="margin:0 0 16px;font-size:24px;">Welcome, {{ $name }}!</h1>
  <p style="margin:0 0 24px;color:#44403c;">Thanks for joining {{ $appName }}.</p>
  <a href="{{ $actionUrl }}" style="display:inline-block;padding:12px 24px;background:#7c6cff;color:#fff;text-decoration:none;border-radius:8px;">
    Go to dashboard
  </a>
@end
```

**Send:**

```js
await mail.to('user@example.com').send(
  MailMessage.make(app)
    .subject('Welcome!')
    .view('welcome', {
      name: 'Raees',
      actionUrl: 'https://yoursite.com/dashboard',
      subject: 'Welcome!',
    }),
);
```

---

### Level 4 — Mailable class (clean & reusable)

Move mail logic into `src/mail/` — like Taand.

**`src/mail/WelcomeMail.js`:**

```js
import { Mailable } from '../../engine/mail/Mailable.js';
import { MailMessage } from '../../engine/mail/MailMessage.js';

export class WelcomeMail extends Mailable {
  constructor(app, user) {
    super(app);
    this.user = user;
  }

  async build() {
    return MailMessage.make(this.app)
      .to(this.user.email)
      .subject(`Welcome to ${this.app.make('config').get('app.name')}!`)
      .view('welcome', {
        name: this.user.name ?? 'there',
        actionUrl: '/dashboard',
        subject: 'Welcome!',
      });
  }
}
```

**Send anywhere:**

```js
import mail from '../start/mail.js';
import { WelcomeMail } from '../src/mail/WelcomeMail.js';

const user = { email: 'user@example.com', name: 'Raees' };
await mail.send(new WelcomeMail(app, user));
```

---

### Level 5 — From a controller (after registration, order, etc.)

```js
// src/actions/AuthController.js
import { Controller } from '../../engine/core/Controller.js';
import { WelcomeMail } from '../Mail/WelcomeMail.js';

export class AuthController extends Controller {
  async register(req) {
    const data = this.validate(req, {
      name: 'required|string|min:2',
      email: 'required|email',
      password: 'required|min:8',
    });

    const user = await this.db().user.create({
      data: { name: data.name, email: data.email, password: data.password },
    });

    await this.mail().to(user.email).send(new WelcomeMail(this.app, user));

    return this.redirect('/dashboard');
  }
}
```

---

### Level 6 — Dynamic HTML with `@if` and `@each`

**`ui/mail/order-confirmation.taand`:**

```html
@layout mail.layout

@section content
  <h1 style="margin:0 0 12px;">Order #{{ $orderId }}</h1>
  <p style="color:#44403c;">Hi {{ $name }}, thanks for your order.</p>

  <table width="100%" style="margin:16px 0;border-collapse:collapse;">
    <tr style="background:#f4f4f5;">
      <th style="padding:8px;text-align:left;">Item</th>
      <th style="padding:8px;text-align:right;">Price</th>
    </tr>
    @each item in $items
      <tr>
        <td style="padding:8px;border-top:1px solid #eee;">{{ $item.name }}</td>
        <td style="padding:8px;border-top:1px solid #eee;text-align:right;">{{ $item.price }}</td>
      </tr>
    @end
  </table>

  @if ($discount)
    <p style="color:#16a34a;font-weight:600;">Discount applied: {{ $discount }}</p>
  @end

  <p style="font-size:18px;font-weight:700;">Total: {{ $total }}</p>
@end
```

**Send with data:**

```js
await mail.to('customer@example.com').send(
  MailMessage.make(app)
    .subject('Order #1042 confirmed')
    .view('order-confirmation', {
      name: 'Raees',
      orderId: 1042,
      items: [
        { name: 'T-Shirt', price: '$24.00' },
        { name: 'Cap', price: '$18.00' },
      ],
      discount: '-10%',
      total: '$37.80',
      subject: 'Order confirmed',
    }),
);
```

---

### Level 7 — HTML template + PDF attachment

```js
await mail
  .to('client@example.com')
  .cc('accounting@example.com')
  .send(
    MailMessage.make(app)
      .subject('Your invoice #1042')
      .view('invoice', {
        name: 'Raees',
        amount: '$199.00',
        dueDate: '2026-07-01',
      })
      .attach(path.join(app.basePath, 'storage', 'invoices', '1042.pdf'), {
        name: 'invoice-1042.pdf',
        mime: 'application/pdf',
      }),
  );
```

Or attach from public uploads:

```js
.attachFromStorage('uploads/receipts/receipt.pdf', { name: 'receipt.pdf' })
```

---

### Level 8 — Custom from, reply-to, HTML + plain text

```js
await mail.to('user@example.com').send(
  MailMessage.make(app)
    .from({ email: 'noreply@yoursite.com', name: 'Your App' })
    .replyTo('support@yoursite.com')
    .subject('Password reset')
    .view('password-reset', {
      name: 'Raees',
      resetUrl: 'https://yoursite.com/reset/abc123',
      expiresIn: '60 minutes',
    })
    .text('Hi Raees, reset your password: https://yoursite.com/reset/abc123'),
);
```

Recipients get **multipart** email: HTML version from template + plain-text fallback.

---

### Level 9 — Password reset Mailable (real-world pattern)

**`ui/mail/password-reset.taand`:**

```html
@layout mail.layout

@section content
  <h1 style="margin:0 0 12px;">Reset your password</h1>
  <p style="color:#44403c;">Hi {{ $name }}, click the button below. Link expires in {{ $expiresIn }}.</p>
  <a href="{{ $resetUrl }}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#7c6cff;color:#fff;text-decoration:none;border-radius:8px;">
    Reset password
  </a>
  <p style="margin-top:24px;font-size:12px;color:#888;">If you did not request this, ignore this email.</p>
@end
```

**`src/mail/PasswordResetMail.js`:**

```js
import { Mailable } from '../../engine/mail/Mailable.js';
import { MailMessage } from '../../engine/mail/MailMessage.js';

export class PasswordResetMail extends Mailable {
  constructor(app, user, token) {
    super(app);
    this.user = user;
    this.token = token;
  }

  async build() {
    const resetUrl = `/reset-password?token=${this.token}`;

    return MailMessage.make(this.app)
      .to(this.user.email)
      .subject('Reset your password')
      .view('password-reset', {
        name: this.user.name,
        resetUrl,
        expiresIn: '60 minutes',
      });
  }
}
```

**Send after generating token:**

```js
await mail.send(new PasswordResetMail(app, user, resetToken));
```

---

### Level 10 — Preview HTML in dev dashboard

1. Set in `.env`:
   ```bash
   MAIL_MAILER=array
   TAAND_DEBUG=true
   ```

2. Send any HTML template mail (examples above).

3. Open **http://127.0.0.1:2977/__Taand/mail**

4. Click **Preview** next to the email to see the rendered HTML in your browser.

Use mailer `file` to also save `.eml` and `.html` files to `storage/mail/outbox/`.

---

### Quick reference — HTML template methods

| Method | What it does |
|--------|----------------|
| `.html('<p>...</p>')` | Inline HTML string |
| `.view('welcome', data)` | Render `ui/mail/welcome.taand` |
| `.text('...')` | Plain-text part (optional; auto from HTML if omitted) |
| `.markdown('welcome', data)` | Same as `.view()` — uses Taand templates |

| Template syntax | Example |
|-----------------|---------|
| Variables | `{{ $name }}` |
| Layout | `@layout mail.layout` |
| Section | `@section content` … `@end` |
| Condition | `@if ($active)` … `@end` |
| Loop | `@each item in $items` … `@end` |

---

## Dev mail dashboard

When `TAAND_DEBUG=true`, open:

**http://127.0.0.1:2977/__Taand/mail**

- Browse sent emails (array & file mailers)
- Preview HTML in browser
- Switch between mailers
- Local-only + debug-only (secure)

Use `MAIL_MAILER=array` in dev to capture all mail.

---

## Mailers (drivers)

| Mailer | Driver | Use case |
|--------|--------|----------|
| `array` | In-memory | Dev + tests + dashboard |
| `file` | `.eml` + `.html` on disk | Inspect MIME without SMTP |
| `log` | Logging system | Debug content in logs |
| `smtp` | Native SMTP | Production (STARTTLS, AUTH LOGIN) |
| `failover` | Try smtp → log | Production resilience |
| `null` | Discard | Testing |

```js
await mail.mailer('smtp').to('user@example.com').send(mailable);
```

---

## Fluent API

```js
await mail
  .to('user@example.com')
  .cc('admin@example.com')
  .bcc('archive@example.com')
  .send(mailable);
```

### MailMessage builder

```js
MailMessage.make(app)
  .from({ email: 'hi@app.com', name: 'App' })
  .to('user@example.com')
  .replyTo('support@app.com')
  .subject('Invoice #123')
  .html('<p>Your invoice</p>')
  .text('Your invoice')
  .attach('/path/to/invoice.pdf')
  .attachFromStorage('uploads/file.pdf')
  .header('X-Custom', 'value');
```

---

## Configuration

`settings/platform.js` → `notify` (registry key `mail`) + `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `MAIL_MAILER` | `array` (dev) | Default mailer |
| `MAIL_FROM_ADDRESS` | `hello@example.com` | From email |
| `MAIL_FROM_NAME` | `TaandJs` | From name |
| `MAIL_HOST` | `127.0.0.1` | SMTP host |
| `MAIL_PORT` | `2525` | SMTP port |
| `MAIL_USERNAME` | | SMTP username |
| `MAIL_PASSWORD` | | SMTP password |
| `MAIL_SECURE` | `false` | Direct TLS (port 465) |
| `MAIL_RATE_LIMIT` | `60` | Max emails per minute |

### Production example

```bash
TAAND_ENV=production
MAIL_MAILER=failover
MAIL_HOST=smtp.mailgun.org
MAIL_PORT=587
MAIL_USERNAME=your-user
MAIL_PASSWORD=your-pass
```

---

## Security

| Protection | Description |
|------------|-------------|
| **Header injection block** | CRLF in subject/headers rejected |
| **Email validation** | RFC-style address checks |
| **Safe attachments** | Paths must be inside app directory |
| **JSON-only** | No unsafe deserialization |
| **Rate limiting** | Configurable emails/minute |
| **Dashboard gated** | Local + debug only |
| **MIME builder** | Proper multipart encoding |

---

## Events

| Event | When |
|-------|------|
| `mail.sending` | Before send |
| `mail.sent` | After success |
| `mail.failed` | On error |

```js
events.listen('mail.sent', ({ message, result }) => {
  log.info('Email sent', { to: message.to, id: result.id });
});
```

---

## Beyond Taand

| Feature | Description |
|---------|-------------|
| **Mail dashboard UI** | Preview sent mail in browser |
| **File outbox** | Real `.eml` files for dev |
| **Native SMTP** | No nodemailer dependency |
| **Failover mailer** | smtp → log fallback |
| **Rate limiting** | Built-in abuse protection |
| **Auto plain-text** | Generated from HTML when omitted |

---

## See also

- [Views](./views.md) — mail template syntax
- [Events](./events.md) — mail lifecycle events
- [Logging](./logging.md) — log mailer driver
- [Controllers](./controllers.md) — `this.mail()` helper
