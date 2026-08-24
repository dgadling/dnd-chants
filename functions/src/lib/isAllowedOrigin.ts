export function isAllowedCorsOrigin(origin: string): boolean {
  if (!origin) return false;
  if (origin === "https://chants-506202.web.app") return true;
  if (origin === "https://chants-506202.firebaseapp.com") return true;
  if (origin === "http://localhost:3000") return true;
  if (origin === "http://127.0.0.1:3000") return true;
  try {
    const u = new URL(origin);
    if (u.hostname.startsWith("chants-506202--") && (u.hostname.endsWith(".web.app") || u.hostname.endsWith(".firebaseapp.com"))) return true;
  } catch {}
  return false;
}
