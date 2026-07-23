import { cookies } from "next/headers";

export const ACTIVE_CATEGORY_COOKIE = "active_category_id";

export async function getActiveCategoryId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_CATEGORY_COOKIE)?.value ?? null;
}
