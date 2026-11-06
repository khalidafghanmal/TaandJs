const PREFIX = '[Taand]';

/** Error text for the terminal — most engine errors already start with `[Taand]`, so add it only once. */
export function cliErrorMessage(err) {
  const message = String(err?.message ?? err);
  return message.startsWith(PREFIX) ? message : `${PREFIX} ${message}`;
}
