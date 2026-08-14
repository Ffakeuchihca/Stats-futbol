import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isCoachRole } from "@/lib/supabase/profile";
import { getActiveCategoryId } from "@/lib/active-category";
import { CoachFines } from "@/components/fines/coach-fines";
import { PlayerFines } from "@/components/fines/player-fines";
import { PageHeader } from "@/components/page-header";
import type { Profile, FineType } from "@/types/database";

export default async function MultasPage() {
  const { userId, profile } = await getCurrentProfile();
  const coach = isCoachRole(profile.role);
  const supabase = await createClient();

  if (!coach) {
    const { data: fines } = await supabase
      .from("fines")
      .select("*, fine_type:fine_types(name, amount)")
      .eq("player_id", userId)
      .order("date", { ascending: false });

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Pizarrón"
          title="Mis multas"
          description="Falta de uniforme, ausencia injustificada, llegada tardía y no llevar espinilleras."
        />
        <PlayerFines fines={fines ?? []} />
      </div>
    );
  }

  const activeCategoryId = await getActiveCategoryId();
  const playersQuery = supabase
    .from("profiles")
    .select("*, player_categories!inner(category_id)")
    .eq("role", "player")
    .eq("active", true)
    .order("full_name");

  const [{ data: players }, { data: fineTypes }] = await Promise.all([
    activeCategoryId
      ? playersQuery.eq("player_categories.category_id", activeCategoryId)
      : supabase.from("profiles").select("*").eq("role", "player").eq("active", true).order("full_name"),
    supabase.from("fine_types").select("*").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pizarrón"
        title="Multas"
        description="Registrá y controlá las multas del plantel: $1000 por falta de uniforme, ausencia injustificada, llegada tardía, no llevar espinilleras o no registrar la asistencia a tiempo."
      />
      <CoachFines
        players={(players ?? []) as unknown as Profile[]}
        fineTypes={(fineTypes ?? []) as FineType[]}
      />
    </div>
  );
}
