# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a vulnerability

**Do not open a public GitHub issue for security bugs.**

Email the maintainer privately with:

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

We aim to respond within 72 hours and publish a fix or mitigation as soon as possible.

## Security features built in

- CSRF protection (web middleware)
- Scrypt password hashing
- Signed session cookies
- Security headers (CSP, X-Frame-Options, etc.)
- Open-redirect protection
- Rate limiting middleware
- HTML auto-escaping in views
- SVG uploads blocked (stored XSS mitigation)
- CORS rejects `*` with credentialed requests

## Production checklist

- Set `TAAND_ENV=production` and `TAAND_DEBUG=false`
- Set a strong random `TAAND_APP_KEY` (32+ characters)
- Use PostgreSQL instead of SQLite at scale
- Run behind HTTPS (reverse proxy)
- Keep dependencies updated (`npm audit`)
