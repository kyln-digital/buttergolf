export function randomItem(items, fallback = null) {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  return items[Math.floor(Math.random() * items.length)];
}

export function uniqueSuffix(config) {
  return `${config.runId}-${__VU || 0}-${__ITER || 0}-${Date.now()}`;
}

export function money(value) {
  return Math.round(value * 100) / 100;
}
