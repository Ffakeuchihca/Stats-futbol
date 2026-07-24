"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TrainingDialog } from "@/components/trainings/training-dialog";
import { Shirt, ShieldAlert, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { costaRicaTrainingDate } from "@/lib/costa-rica-date";
import type { AttendanceStatus, Category, FineType, Profile, Training } from "@/types/database";

interface AttendanceEntry {
  status: AttendanceStatus;
  notes: string | null;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "presente", label: "Presente" },
  { value: "tarde", label: "Tarde" },
  { value: "ausente", label: "Ausente" },
  { value: "lesionado", label: "Lesionado" },
];

const STATUS_ACTIVE_CLASS: Record<AttendanceStatus, string> = {
  presente: "bg-primary text-primary-foreground",
  tarde: "bg-card-yellow text-card-yellow-foreground",
  ausente: "bg-card-red text-card-red-foreground",
  lesionado: "bg-status-injured text-status-injured-foreground",
};

export function CoachAttendance({
  players,
  initialDate,
  initialTrainingId,
  activeCategoryId,
}: {
  players: Profile[];
  initialDate?: string;
  initialTrainingId?: string;
  activeCategoryId?: string | null;
}) {
  const supabase = createClient();
  const [date, setDate] = useState(initialDate ?? costaRicaTrainingDate());
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [playerCategoryIds, setPlayerCategoryIds] = useState<Record<string, string[]>>({});
  const [sessions, setSessions] = useState<Training[]>([]);
  const [sessionCategoryIds, setSessionCategoryIds] = useState<Record<string, string[]>>({});
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const [attendanceByPlayer, setAttendanceByPlayer] = useState<Record<string, AttendanceEntry | undefined>>({});
  const [fineTypes, setFineTypes] = useState<FineType[]>([]);
  const [fineIdByKey, setFineIdByKey] = useState<Record<string, string>>({});
  const [absencePlayer, setAbsencePlayer] = useState<Profile | null>(null);
  const [absenceReason, setAbsenceReason] = useState("");

  const fineTypeId = useCallback(
    (code: string) => fineTypes.find((f) => f.code === code)?.id,
    [fineTypes]
  );

  const loadSessionDetails = useCallback(
    async (trainingId: string) => {
      const [{ data: attendance }, { data: fines }] = await Promise.all([
        supabase.from("attendance").select("player_id, status, notes").eq("training_id", trainingId),
        supabase.from("fines").select("id, player_id, fine_type_id").eq("date", date),
      ]);

      const map: Record<string, AttendanceEntry> = {};
      for (const a of attendance ?? []) map[a.player_id] = { status: a.status, notes: a.notes };
      setAttendanceByPlayer(map);

      const nextFineMap: Record<string, string> = {};
      for (const f of fines ?? []) {
        const type = fineTypes.find((t) => t.id === f.fine_type_id);
        if (type) nextFineMap[`${f.player_id}|${type.code}`] = f.id;
      }
      setFineIdByKey(nextFineMap);
    },
    [supabase, date, fineTypes]
  );

  const loadSessionsForDate = useCallback(
    async (targetDate: string, preferTrainingId?: string) => {
      setLoading(true);
      const trainingsQuery = supabase
        .from("trainings")
        .select(activeCategoryId ? "*, training_categories!inner(category_id)" : "*")
        .eq("date", targetDate)
        .order("created_at", { ascending: true });
      const { data: trainingRows } = activeCategoryId
        ? await trainingsQuery.eq("training_categories.category_id", activeCategoryId)
        : await trainingsQuery;
      const list = (trainingRows ?? []) as unknown as Training[];
      setSessions(list);

      if (list.length > 0) {
        const { data: tc } = await supabase
          .from("training_categories")
          .select("training_id, category_id")
          .in("training_id", list.map((t) => t.id));
        const map: Record<string, string[]> = {};
        for (const row of tc ?? []) {
          const arr = map[row.training_id] ?? [];
          arr.push(row.category_id);
          map[row.training_id] = arr;
        }
        setSessionCategoryIds(map);
      } else {
        setSessionCategoryIds({});
      }

      const nextSelected =
        (preferTrainingId && list.some((t) => t.id === preferTrainingId) && preferTrainingId) ||
        list[0]?.id ||
        null;
      setSelectedTrainingId(nextSelected);

      if (nextSelected) {
        await loadSessionDetails(nextSelected);
      } else {
        setAttendanceByPlayer({});
        setFineIdByKey({});
      }
      setLoading(false);
    },
    [supabase, loadSessionDetails, activeCategoryId]
  );

  useEffect(() => {
    (async () => {
      const [{ data: cats }, { data: pcats }, { data: fts }] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("player_categories").select("player_id, category_id"),
        supabase.from("fine_types").select("*"),
      ]);
      setCategories((cats ?? []) as Category[]);
      const map: Record<string, string[]> = {};
      for (const row of pcats ?? []) {
        const arr = map[row.player_id] ?? [];
        arr.push(row.category_id);
        map[row.player_id] = arr;
      }
      setPlayerCategoryIds(map);
      setFineTypes((fts ?? []) as FineType[]);
    })();
  }, [supabase]);

  useEffect(() => {
    if (fineTypes.length === 0) return;
    (async () => {
      await loadSessionsForDate(date, initialTrainingId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, fineTypes.length]);

  async function selectSession(trainingId: string) {
    setSelectedTrainingId(trainingId);
    setLoading(true);
    await loadSessionDetails(trainingId);
    setLoading(false);
  }

  async function setAutoFine(playerId: string, code: string, shouldExist: boolean) {
    const key = `${playerId}|${code}`;
    const existingId = fineIdByKey[key];
    if (shouldExist && !existingId) {
      const typeId = fineTypeId(code);
      if (!typeId) return;
      const { data } = await supabase
        .from("fines")
        .insert({ player_id: playerId, fine_type_id: typeId, date })
        .select("id")
        .single();
      if (data) setFineIdByKey((prev) => ({ ...prev, [key]: data.id }));
    } else if (!shouldExist && existingId) {
      await supabase.from("fines").delete().eq("id", existingId);
      setFineIdByKey((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function handleStatusChange(
    playerId: string,
    status: AttendanceStatus,
    notes: string | null = null
  ) {
    if (!selectedTrainingId) return;
    setAttendanceByPlayer((prev) => ({ ...prev, [playerId]: { status, notes } }));

    const { error } = await supabase
      .from("attendance")
      .upsert(
        { training_id: selectedTrainingId, player_id: playerId, status, notes },
        { onConflict: "training_id,player_id" }
      );

    if (error) {
      toast.error("No se pudo guardar la asistencia", { description: error.message });
      return;
    }

    toast.success("Asistencia guardada");
  }

  function openAbsenceDialog(player: Profile) {
    setAbsenceReason(attendanceByPlayer[player.id]?.notes ?? "");
    setAbsencePlayer(player);
  }

  async function confirmAbsence() {
    if (!absenceReason.trim()) {
      toast.error("Contá el motivo de la ausencia");
      return;
    }
    if (!absencePlayer) return;
    await handleStatusChange(absencePlayer.id, "ausente", absenceReason.trim());
    setAbsencePlayer(null);
    setAbsenceReason("");
  }

  async function toggleManualFine(playerId: string, code: string) {
    const key = `${playerId}|${code}`;
    const existingId = fineIdByKey[key];
    await setAutoFine(playerId, code, !existingId);
    toast.success(existingId ? "Multa quitada" : "Multa registrada");
  }

  function sessionLabel(training: Training) {
    const ids = sessionCategoryIds[training.id] ?? [];
    if (ids.length === 0) return "General";
    return ids.map((id) => categories.find((c) => c.id === id)?.name ?? "-").join(", ");
  }

  const activeSessionCategoryIds = selectedTrainingId
    ? sessionCategoryIds[selectedTrainingId] ?? []
    : [];
  const roster =
    activeSessionCategoryIds.length === 0
      ? players
      : players.filter((p) =>
          (playerCategoryIds[p.id] ?? []).some((cid) => activeSessionCategoryIds.includes(cid))
        );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="training-date">Fecha</Label>
            <Input
              id="training-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-fit"
            />
          </div>

          {sessions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectSession(s.id)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    selectedTrainingId === s.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {sessionLabel(s)}
                </button>
              ))}
            </div>
          )}

          <TrainingDialog
            categories={activeCategoryId ? categories.filter((c) => c.id === activeCategoryId) : categories}
            initialCategoryIds={activeCategoryId ? [activeCategoryId] : []}
            defaultDate={date}
            onSaved={() => loadSessionsForDate(date)}
            trigger={
              <Button variant="outline" size="sm">
                <Plus className="size-4" />
                {sessions.length === 0 || activeCategoryId ? "Crear entrenamiento" : "Agregar categoría"}
              </Button>
            }
          />

          {sessions.length === 0 && !loading && (
            <Badge variant="secondary">Todavía no hay entrenamiento para este día</Badge>
          )}
        </CardContent>
      </Card>

      {selectedTrainingId && (
        <Card>
          <CardContent className="flex flex-col gap-2 p-0">
            <div className="divide-y">
              {roster.map((player) => {
                const entry = attendanceByPlayer[player.id];
                const status = entry?.status;
                const hasUniforme = Boolean(fineIdByKey[`${player.id}|sin_uniforme`]);
                const hasEspinilleras = Boolean(fineIdByKey[`${player.id}|sin_espinilleras`]);
                return (
                  <div
                    key={player.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{player.full_name}</span>
                      {player.position && (
                        <span className="text-xs text-muted-foreground">{player.position}</span>
                      )}
                      {status === "ausente" && entry?.notes && (
                        <button
                          type="button"
                          onClick={() => openAbsenceDialog(player)}
                          className="mt-0.5 w-fit text-xs text-destructive underline-offset-2 hover:underline"
                        >
                          Motivo: {entry.notes}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex overflow-hidden rounded-lg border">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={loading}
                            onClick={() =>
                              opt.value === "ausente"
                                ? openAbsenceDialog(player)
                                : handleStatusChange(player.id, opt.value)
                            }
                            className={cn(
                              "px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                              status === opt.value
                                ? STATUS_ACTIVE_CLASS[opt.value]
                                : "bg-transparent hover:bg-muted"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        title="Falta de uniforme"
                        aria-label="Falta de uniforme"
                        aria-pressed={hasUniforme}
                        onClick={() => toggleManualFine(player.id, "sin_uniforme")}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-lg border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                          hasUniforme
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <Shirt className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Sin espinilleras"
                        aria-label="Sin espinilleras"
                        aria-pressed={hasEspinilleras}
                        onClick={() => toggleManualFine(player.id, "sin_espinilleras")}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-lg border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                          hasEspinilleras
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <ShieldAlert className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {roster.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Ningún jugador pertenece a esta categoría todavía.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Marcar &quot;Tarde&quot; o &quot;Ausente&quot; suma automáticamente la multa correspondiente.
        Los íconos de camiseta y espinillera registran esas multas para el día seleccionado.
      </p>

      <Dialog
        open={absencePlayer !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAbsencePlayer(null);
            setAbsenceReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo de la ausencia</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="absence-reason">{absencePlayer?.full_name}</Label>
            <Textarea
              id="absence-reason"
              value={absenceReason}
              onChange={(e) => setAbsenceReason(e.target.value)}
              rows={3}
              placeholder="Ej: sin aviso, cita médica, permiso familiar..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button onClick={confirmAbsence}>Guardar ausencia</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
