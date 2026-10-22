const REGISTERED_EMAIL_STORAGE_KEY = "venturex:registered-email";

export function rememberRegisteredEmail(email: string): void {
  try {
    window.sessionStorage.setItem(REGISTERED_EMAIL_STORAGE_KEY, email);
  } catch {
    // Registration can continue when browser storage is unavailable.
  }
}

export function consumeRegisteredEmail(): string | null {
  try {
    const email = window.sessionStorage.getItem(REGISTERED_EMAIL_STORAGE_KEY);
    window.sessionStorage.removeItem(REGISTERED_EMAIL_STORAGE_KEY);
    return email?.includes("@") ? email : null;
  } catch {
    return null;
  }
}
