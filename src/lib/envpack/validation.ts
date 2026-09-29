export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 500;
export const KEY_MAX = 256;
export const VALUE_MAX = 64 * 1024;
export const IMPORT_MAX_ENTRIES = 1000;

export const KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export function validateName(input: unknown, label: string): string {
  const name = String(input ?? "").trim();
  if (!name) throw new ValidationError(`${label} is required.`);
  if (name.length > NAME_MAX) throw new ValidationError(`${label} must be at most ${NAME_MAX} characters.`);
  return name;
}

export function validateDescription(input: unknown): string {
  const description = String(input ?? "").trim();
  if (description.length > DESCRIPTION_MAX) {
    throw new ValidationError(`Description must be at most ${DESCRIPTION_MAX} characters.`);
  }
  return description;
}

export function validateKey(input: unknown): string {
  const key = String(input ?? "").trim();
  if (!key) throw new ValidationError("Key is required.");
  if (key.length > KEY_MAX) throw new ValidationError(`Key must be at most ${KEY_MAX} characters.`);
  if (!KEY_RE.test(key)) {
    throw new ValidationError(
      `"${key}" is not a valid key. Use letters, digits, "_", "." or "-", starting with a letter or "_".`,
    );
  }
  return key;
}

export function validateValue(input: unknown): string {
  const value = String(input ?? "");
  if (value.length > VALUE_MAX) throw new ValidationError("Value is too large (max 64 KB).");
  return value;
}

export class ValidationError extends Error {}
