const LEVELS = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
};

export function normalizeLevel(level) {
  const key = String(level ?? 'debug').toLowerCase();
  if (!(key in LEVELS)) {
    throw new Error(`[Taand] Unknown log level: ${level}`);
  }
  return key;
}

export function levelValue(level) {
  return LEVELS[normalizeLevel(level)];
}

export function shouldLog(messageLevel, channelLevel) {
  return levelValue(messageLevel) <= levelValue(channelLevel);
}

export const LOG_LEVELS = Object.keys(LEVELS);
