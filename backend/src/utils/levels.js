export function calculateLevel(score) {
  const safeScore = Math.max(0, Math.floor(score || 0));
  return Math.min(12, Math.floor(safeScore / 15) + 1);
}

export function normalizeId(id) {
  return String(id || '').trim().toUpperCase();
}
