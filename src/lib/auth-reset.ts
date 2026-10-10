/** Supabase password-recovery redirect (must match Supabase Auth URL allow list). */
export function getPasswordResetRedirectUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/reset-password`;
  }
  return "/auth/reset-password";
}
