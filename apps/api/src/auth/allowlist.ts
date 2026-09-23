/** Emails are compared case-insensitively; the list is already lowercased by the env schema. */
export function isEmailAllowed(email: string, allowlist: readonly string[]): boolean {
  return allowlist.includes(email.trim().toLowerCase());
}
