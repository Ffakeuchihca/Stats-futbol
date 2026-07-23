import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isCoachRole } from "@/lib/supabase/profile";
import { getActiveCategoryId } from "@/lib/active-category";
import { trainingGenerationWindow } from "@/lib/costa-rica-date";
import { CalendarView } from "@/components/calendar/calendar-view";
import { MatchFormDialog } from "@/components/matches/match-form-dialog";
import { TrainingDialog } from "@/components/trainings/training-dialog";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Plus, CalendarPlus } from "lucide-react";
import type { Category, Match, Training } from "@/types/database";

export default async function CalendarioPage() {
  const { userId, profile } = await getCurrentProfile();
  const coach = isCoachRole(profile.role);
  const supabase = await createClient();
  const activeCategoryId = coach ? await getActiveCategoryId() : null;
  const { start, end } = trainingGenerationWindow();

  if (activeCategoryId) {
    await supabase.rpc("ensure_weekday_trainings_range", {
      p_start: start,
      p_end: end,
      p_category_id: activeCategoryId,
    });
  } else if (!coach) {
    const { data: myCategories } = await supabase
      .from("player_categories")
      .select("category_id")
      .eq("player_id", userId);
    for (const row of myCategories ?? []) {
      await supabase.rpc("ensure_weekday_trainings_range", {
        p_start: start,
        p_end: end,
        p_category_id: row.category_id,
      });
    }
  }

  const matchesQuery = supabase.from("matches").select("*, match_categories!inner(category_id)");
  const trainingsQuery = supabase
    .from("trainings")
    .select("*, training_categories!inner(category_id)");

  const [
    { data: matches },
    { data: trainings },
    { data: categories },
    { data: trainingCategories },
    { data: matchCategories },
  ] = await Promise.all([
    activeCategoryId
      ? matchesQuery.eq("match_categories.category_id", activeCategoryId)
      : supabase.from("matches").select("*"),
    activeCategoryId
      ? trainingsQuery.eq("training_categories.category_id", activeCategoryId)
      : supabase.from("trainings").select("*"),
    supabase.from("categories").select("*").order("name"),
    supabase.from("training_categories").select("training_id, category_id"),
    supabase.from("match_categories").select("match_id, category_id"),
  ]);

  const categoryList = (categories ?? []) as Category[];
  const categoryIdsByTraining: Record<string, string[]> = {};
  for (const row of trainingCategories ?? []) {
    const arr = categoryIdsByTraining[row.training_id] ?? [];
    arr.push(row.category_id);
    categoryIdsByTraining[row.training_id] = arr;
  }
  const categoryIdsByMatch: Record<string, string[]> = {};
  for (const row of matchCategories ?? []) {
    const arr = categoryIdsByMatch[row.match_id] ?? [];
    arr.push(row.category_id);
    categoryIdsByMatch[row.match_id] = arr;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Fixture"
        title="Calendario"
        description="Todos los entrenamientos y partidos programados del plantel."
        actions={
          coach ? (
            <>
              <TrainingDialog
                categories={
                  activeCategoryId ? categoryList.filter((c) => c.id === activeCategoryId) : categoryList
                }
                initialCategoryIds={activeCategoryId ? [activeCategoryId] : []}
                trigger={
                  <Button variant="outline">
                    <CalendarPlus className="size-4" />
                    Entrenamiento
                  </Button>
                }
              />
              <MatchFormDialog
                categories={
                  activeCategoryId ? categoryList.filter((c) => c.id === activeCategoryId) : categoryList
                }
                initialCategoryIds={activeCategoryId ? [activeCategoryId] : []}
                trigger={
                  <Button>
                    <Plus className="size-4" />
                    Partido
                  </Button>
                }
              />
            </>
          ) : undefined
        }
      />

      <CalendarView
        matches={(matches ?? []) as unknown as Match[]}
        trainings={(trainings ?? []) as unknown as Training[]}
        categories={categoryList}
        categoryIdsByTraining={categoryIdsByTraining}
        categoryIdsByMatch={categoryIdsByMatch}
      />
    </div>
  );
}
