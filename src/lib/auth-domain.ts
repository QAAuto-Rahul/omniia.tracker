
export const ALLOWED_EMAIL_DOMAIN = "sdlccorp.com";

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function normalizeEmail(input: unknown): string {
  return String(input ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function isAllowedEmail(email: string): boolean {
  return isValidEmail(email) && email.slice(email.lastIndexOf("@") + 1) === ALLOWED_EMAIL_DOMAIN;
}
