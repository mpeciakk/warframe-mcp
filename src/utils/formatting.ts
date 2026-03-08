// ─── Formatting Utilities ─────────────────────────────────────────────────────
// Pure functions. No imports from API or types. No side effects.

const POLARITY_SYMBOLS: Record<string, string> = {
  madurai: "=",
  naramon: "-",
  vazarin: "D",
  zenurik: "—",
  unairu: "~",
  penjaga: "⬡",
  umbra: "Ω",
};

/** "2d 5h 12m" or "14m 35s" */
export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

/** ISO 8601 → relative time from now: "13 days", "2h 30m" */
export function timeUntil(isoTimestamp: string): string {
  const diff = (new Date(isoTimestamp).getTime() - Date.now()) / 1000;
  if (diff <= 0) return "now";
  return formatDuration(diff);
}

/** Alias: time until expiry ISO string */
export function timeRemaining(expiryIso: string): string {
  return timeUntil(expiryIso);
}

/** Time since activation ISO string */
export function timeSince(activationIso: string): string {
  const diff = (Date.now() - new Date(activationIso).getTime()) / 1000;
  if (diff <= 0) return "just now";
  return formatDuration(diff);
}

/** True if now is between activation and expiry */
export function isActive(activation: string, expiry: string): boolean {
  const now = Date.now();
  return now >= new Date(activation).getTime() && now <= new Date(expiry).getTime();
}

/** 1234567 → "1,234,567" */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** seconds → "340h 12m" */
export function formatPlayTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${formatNumber(days)} days, ${remHours}h`;
  }
  return `${formatNumber(hours)}h ${minutes}m`;
}

/** "madurai" → "Madurai (=)" */
export function formatPolarity(polarity: string): string {
  const lower = polarity.toLowerCase();
  const symbol = POLARITY_SYMBOLS[lower] ?? "?";
  return `${capitalize(lower)} (${symbol})`;
}

/** xp → "Rank 30/30" */
export function formatRank(xp: number): string {
  const XP_PER_RANK = 15000;
  if (xp >= 900000) {
    const rank = Math.min(40, Math.floor(xp / XP_PER_RANK));
    return `Rank ${rank}/40`;
  }
  const rank = Math.min(30, Math.floor(xp / XP_PER_RANK));
  return `Rank ${rank}/30`;
}

/** "grineer" → "Grineer" */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Ash Prime Set" → "ash_prime_set" */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
