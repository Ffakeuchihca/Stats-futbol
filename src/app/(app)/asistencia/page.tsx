import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isCoachRole } from "@/lib/supabase/profile";
import { getActiveCategoryId } from "@/lib/active-category";
import { costaRicaTrainingDate, trainingGenerationWindow } from "@/lib/costa-rica-date";
import { CoachAttendance } from "@/components/attendance/coach-attendance";
import { PlayerAttendance } from "@/components/attendance/player-attendance";
import { CoachTrainings } from "@/components/trainings/coach-trainings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import type { Profile } from "@/types/database";

export default async function AsistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; training?: string }>;
}) {
  const { date, training } = await searchParams;
  const { userId, profile } = await getCurrentProfile();
  const coach = isCoachRole(profile.role);

  if (!coach) {
    const supabase = await createClient();
    const { data: myCategories } = await supabase
      .from("player_categories")
      .select("category_id")
      .eq("player_id", userId);
    const today = costaRicaTrainingDate();
    for (const row of myCategories ?? []) {
      await supabase.rpc("ensure_weekday_training", {
        p_date: today,
        p_category_id: row.category_id,
      });
    }

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Check-in"
          title="Asistencia"
          description="Marcá tu asistencia a los entrenamientos."
        />
        <PlayerAttendance playerId={userId} />
      </div>
    );
  }

  const supabase = await createClient();
  const activeCategoryId = await getActiveCategoryId();

  if (activeCategoryId) {
    const { start, end } = trainingGenerationWindow();
    await supabase.rpc("ensure_weekday_trainings_range", {
      p_start: start,
      p_end: end,
      p_category_id: activeCategoryId,
    });
  }

  const playersQuery = supabase
    .from("profiles")
    .select("*, player_categories!inner(category_id)")
    .eq("role", "player")
    .eq("active", true)
    .order("full_name");
  const { data: players } = activeCategoryId
    ? await playersQuery.eq("player_categories.category_id", activeCategoryId)
    : await playersQuery;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Check-in"
        title="Asistencia"
        description="Registrá quién llegó, llegó tarde o faltó, y programá los entrenamientos del plantel."
      />

      <Tabs defaultValue="hoy">
        <TabsList>
          <TabsTrigger value="hoy">Tomar asistencia</TabsTrigger>
          <TabsTrigger value="programacion">Entrenamientos</TabsTrigger>
        </TabsList>
        <TabsContent value="hoy">
          <CoachAttendance
            players={(players ?? []) as Profile[]}
            initialDate={date}
            initialTrainingId={training}
            activeCategoryId={activeCategoryId}
          />
        </TabsContent>
        <TabsContent value="programacion">
          <CoachTrainings activeCategoryId={activeCategoryId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
