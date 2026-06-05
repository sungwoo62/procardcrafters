"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, getAdminToken } from "@/lib/admin-auth";

export async function adminLoginAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const next = String(formData.get("next") ?? "/admin/beta-applications");
  const expected = getAdminToken();

  if (!expected || token !== expected) {
    redirect(`/admin/login?next=${encodeURIComponent(next)}&error=1`);
  }

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect(next);
}

export async function adminLogoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
