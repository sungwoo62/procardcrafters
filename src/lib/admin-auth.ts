import { cookies } from "next/headers";

export const ADMIN_COOKIE = "pcc_admin_token";

export function getAdminToken(): string | null {
  const t = process.env.ADMIN_TOKEN;
  return t && t.length > 0 ? t : null;
}

export async function isAdmin(): Promise<boolean> {
  const expected = getAdminToken();
  if (!expected) return false;
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === expected;
}

export function isAdminBearer(req: Request): boolean {
  const expected = getAdminToken();
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.slice("Bearer ".length).trim() === expected;
}

export async function isAdminRequest(req: Request): Promise<boolean> {
  if (isAdminBearer(req)) return true;
  return isAdmin();
}
