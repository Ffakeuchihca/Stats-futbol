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
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttendanceStatus, Category, Training } from "@/types/database";

interface AttendanceDetail {
  status: AttendanceStatus;
  notes: string | null;
  full_name: string;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  presente: "Presente",
  tarde: "Tarde",
  ausente: "Ausente",
};

export function CoachTrainings({ activeCategoryId }: { activeCategoryId?: string | null }) {
  const supabase = createClient();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIdsByTraining, setCategoryIdsByTraining] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attendanceDetails, setAttendanceDetails] = useState<Record<string, AttendanceDetail[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

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

  async function toggleExpand(trainingId: string) {
    if (expandedId === trainingId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(trainingId);
    if (!attendanceDetails[trainingId]) {
      setLoadingDetails(trainingId);
      const { data } = await supabase
        .from("attendance")
        .select("status, notes, profile:profiles!attendance_player_id_fkey(full_name)")
        .eq("training_id", trainingId);
      const rows = ((data ?? []) as unknown as { status: AttendanceStatus; notes: string | null; profile: { full_name: string } | null }[])
        .map((row) => ({
          status: row.status,
          notes: row.notes,
          full_name: row.profile?.full_name ?? "-",
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
      setAttendanceDetails((prev) => ({ ...prev, [trainingId]: rows }));
      setLoadingDetails(null);
    }
  }

  async function remove(training: Training) {
    if (
      !window.confirm(
        `¿Eliminar el entrenamiento del ${format(parseISO(training.date), "d 'de' MMMM", { locale: es })}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
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
              const expanded = expandedId === t.id;
              const details = attendanceDetails[t.id];
              return (
                <div key={t.id} className="flex flex-col gap-3 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
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
                      <button
                        type="button"
                        onClick={() => toggleExpand(t.id)}
                        aria-expanded={expanded}
                        aria-label={expanded ? "Ocultar asistencia" : "Ver asistencia"}
                      >
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 hover:bg-muted-foreground/20"
                        >
                          {attendanceCounts[t.id] ?? 0} registros
                          {expanded ? (
                            <ChevronUp className="size-3" />
                          ) : (
                            <ChevronDown className="size-3" />
                          )}
                        </Badge>
                      </button>
                      <TrainingDialog
                        training={t}
                        categories={categories}
                        initialCategoryIds={catIds}
                        onSaved={load}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Editar entrenamiento">
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar entrenamiento"
                        onClick={() => remove(t)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      {loadingDetails === t.id && (
                        <p className="text-sm text-muted-foreground">Cargando...</p>
                      )}
                      {loadingDetails !== t.id && details && details.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Todavía nadie tiene asistencia marcada en este entrenamiento.
                        </p>
                      )}
                      {loadingDetails !== t.id && details && details.length > 0 && (
                        <ul className="flex flex-col gap-1.5">
                          {details.map((d, i) => (
                            <li
                              key={i}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="truncate">{d.full_name}</span>
                              <span className="flex items-center gap-2">
                                {d.status === "ausente" && d.notes && (
                                  <span className="text-xs text-muted-foreground">
                                    {d.notes}
                                  </span>
                                )}
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "font-mono text-[10px]",
                                    d.status === "presente" && "border-primary text-primary",
                                    d.status === "tarde" && "border-card-yellow text-card-yellow",
                                    d.status === "ausente" && "border-card-red text-card-red"
                                  )}
                                >
                                  {STATUS_LABEL[d.status]}
                                </Badge>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
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
