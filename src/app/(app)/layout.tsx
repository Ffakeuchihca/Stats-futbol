import { redirect } from "next/navigation";
import { getCurrentProfile, isCoachRole } from "@/lib/supabase/profile";
import { getActiveCategoryId } from "@/lib/active-category";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await getCurrentProfile();
  const coach = isCoachRole(profile.role);

  let activeCategoryName: string | null = null;
  if (coach) {
    const activeCategoryId = await getActiveCategoryId();
    if (!activeCategoryId) {
      redirect("/categoria");
    }
    const supabase = await createClient();
    const { data: category } = await supabase
      .from("categories")
      .select("name")
      .eq("id", activeCategoryId)
      .maybeSingle();
    if (!category) {
      redirect("/categoria");
    }
    activeCategoryName = category.name;
  }

  return (
    <AppShell fullName={profile.full_name} role={profile.role} activeCategoryName={activeCategoryName}>
      {children}
    </AppShell>
  );
}
