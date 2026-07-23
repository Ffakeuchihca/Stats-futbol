"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_CATEGORY_COOKIE } from "@/lib/active-category";

export async function setActiveCategory(categoryId: string) {
  const store = await cookies();
  store.set(ACTIVE_CATEGORY_COOKIE, categoryId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
  });
  redirect("/dashboard");
}
