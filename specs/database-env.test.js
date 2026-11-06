import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const SCHEMES = {
  sqlite: ['file:'],
  postgresql: ['postgresql:', 'postgres:'],
  mysql: ['mysql:'],
};

test('.env.example DATABASE_URL matches the schema.prisma provider', () => {
  const schema = fs.readFileSync(path.join(ROOT, 'schema', 'schema.prisma'), 'utf8');
  const provider = /datasource\s+db\s*\{[^}]*provider\s*=\s*"(\w+)"/.exec(schema)[1];

  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  const url = /^DATABASE_URL="?([^"\r\n]+)/m.exec(example)[1];

  assert.ok(
    SCHEMES[provider].some((scheme) => url.startsWith(scheme)),
    `provider "${provider}" but .env.example DATABASE_URL is ${url}`,
  );
});
