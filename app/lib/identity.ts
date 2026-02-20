export const INTERNAL_EMAIL_DOMAIN = "kiosco.local";

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function internalEmailFromUsername(username: string) {
  const normalized = normalizeUsername(username);
  return `${normalized}@${INTERNAL_EMAIL_DOMAIN}`;
}

