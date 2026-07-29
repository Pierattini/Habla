export function getStoredToken(): string | null {
  return localStorage.getItem('token');
}

export function clearStoredSession(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('email');
  localStorage.removeItem('name');
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) {
    return true;
  }

  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return true;
    }

    const base64 = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(base64));
    const expiresAt = Number(decoded.exp || 0) * 1000;

    return !expiresAt || Date.now() >= expiresAt;
  } catch {
    return true;
  }
}
