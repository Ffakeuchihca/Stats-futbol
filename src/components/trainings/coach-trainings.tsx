"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrainingDialog } from "@/components/trainings/training-dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Category, Training } from "@/types/database";

export function CoachTrainings({ activeCategoryId }: { activeCategoryId?: string | null }) {
  const supabase = createClient();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIdsByTraining, setCategoryIdsByTraining] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const trainingsQuery = supabase
      .from("trainings")
      .select(activeCategoryId ? "*, training_categories!inner(category_id)" : "*")
      .order("date", { ascending: false });
    const [{ data: trainingRows }, { data: attendanceRows }, { data: cats }] = await Promise.all([
      activeCategoryId
        ? trainingsQuery.eq("training_categories.category_id", activeCategoryId)
        : trainingsQuery,
      supabase.from("attendance").select("training_id"),
      supabase.from("categories").select("*").order("name"),
    ]);

    const trainingList = (trainingRows ?? []) as unknown as Training[];
    setTrainings(trainingList);
    setCategories((cats ?? []) as Category[]);

    const counts: Record<string, number> = {};
    for (const row of attendanceRows ?? []) {
      counts[row.training_id] = (counts[row.training_id] ?? 0) + 1;
    }
    setAttendanceCounts(counts);

    if (trainingList.length > 0) {
      const { data: tc } = await supabase
        .from("training_categories")
        .select("training_id, category_id")
        .in("training_id", trainingList.map((t) => t.id));
      const map: Record<string, string[]> = {};
      for (const row of tc ?? []) {
        const arr = map[row.training_id] ?? [];
        arr.push(row.category_id);
        map[row.training_id] = arr;
      }
      setCategoryIdsByTraining(map);
    } else {
      setCategoryIdsByTraining({});
    }

    setLoading(false);
  }, [supabase, activeCategoryId]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  async function remove(training: Training) {
    const { error } = await supabase.from("trainings").delete().eq("id", training.id);
    if (error) {
      toast.error("No se pudo eliminar el entrenamiento", { description: error.message });
      return;
    }
    toast.success("Entrenamiento eliminado");
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <TrainingDialog
          categories={activeCategoryId ? categories.filter((c) => c.id === activeCategoryId) : categories}
          initialCategoryIds={activeCategoryId ? [activeCategoryId] : []}
          onSaved={load}
          trigger={
            <Button>
              <Plus className="size-4" />
              Programar entrenamiento
            </Button>
          }
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-0 p-0">
          <div className="divide-y">
            {trainings.map((t) => {
              const catIds = categoryIdsByTraining[t.id] ?? [];
              return (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex flex-col">
                    <Link
                      href={`/asistencia?date=${t.date}&training=${t.id}`}
                      className="font-medium hover:underline"
                    >
                      {format(parseISO(t.date), "EEEE d 'de' MMMM yyyy", { locale: es })}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1">
                      {catIds.length === 0 ? (
                        <span className="text-xs text-muted-foreground">General</span>
                      ) : (
                        catIds.map((cid) => (
                          <Badge key={cid} variant="outline" className="font-mono text-[10px]">
                            {categories.find((c) => c.id === cid)?.name ?? "-"}
                          </Badge>
                        ))
                      )}
                    </div>
                    {t.notes && <span className="text-sm text-muted-foreground">{t.notes}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{attendanceCounts[t.id] ?? 0} registros</Badge>
                    <TrainingDialog
                      training={t}
                      categories={categories}
                      initialCategoryIds={catIds}
                      onSaved={load}
                      trigger={
                        <Button variant="ghost" size="sm">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <Button variant="ghost" size="sm" onClick={() => remove(t)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {!loading && trainings.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Todavía no hay entrenamientos programados.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
