/** Map common table aliases to Prisma delegate names. */
const ALIASES = {
  users: 'user',
  posts: 'post',
  jobs: 'job',
  failed_jobs: 'failedJob',
};

/**
 * Resolve a Prisma delegate from a rule/table name.
 * Use the Prisma model name: `user`, `post`, or alias `users`.
 */
export function resolveDelegate(db, name) {
  const key = ALIASES[name] ?? name;
  const delegate = db[key];

  if (!delegate?.findFirst) {
    throw new Error(`[Taand] Unknown Prisma model "${name}". Use your schema model name (e.g. user).`);
  }

  return delegate;
}
