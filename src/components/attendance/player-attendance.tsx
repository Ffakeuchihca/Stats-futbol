"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { costaRicaTrainingDate } from "@/lib/costa-rica-date";
import type { AttendanceStatus, Category, Training } from "@/types/database";

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  presente: "Presente",
  tarde: "Tarde",
  ausente: "Ausente",
};

interface SessionEntry {
  status: AttendanceStatus;
  notes: string | null;
}

interface HistoryRow {
  id: string;
  status: AttendanceStatus;
  training: { date: string } | null;
}

export function PlayerAttendance({ playerId }: { playerId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [todaySessions, setTodaySessions] = useState<Training[]>([]);
  const [sessionCategoryIds, setSessionCategoryIds] = useState<Record<string, string[]>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [entryBySession, setEntryBySession] = useState<Record<string, SessionEntry | undefined>>({});
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [absenceTarget, setAbsenceTarget] = useState<{ sessionId: string } | null>(null);
  const [absenceReason, setAbsenceReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const today = costaRicaTrainingDate();

    const [{ data: sessions }, { data: cats }] = await Promise.all([
      supabase.from("trainings").select("*").eq("date", today),
      supabase.from("categories").select("*"),
    ]);
    const sessionList = (sessions ?? []) as Training[];
    setTodaySessions(sessionList);
    setCategories((cats ?? []) as Category[]);

    if (sessionList.length > 0) {
      const [{ data: tc }, { data: attendance }] = await Promise.all([
        supabase
          .from("training_categories")
          .select("training_id, category_id")
          .in("training_id", sessionList.map((s) => s.id)),
        supabase
          .from("attendance")
          .select("training_id, status, notes")
          .eq("player_id", playerId)
          .in("training_id", sessionList.map((s) => s.id)),
      ]);

      const catMap: Record<string, string[]> = {};
      for (const row of tc ?? []) {
        const arr = catMap[row.training_id] ?? [];
        arr.push(row.category_id);
        catMap[row.training_id] = arr;
      }
      setSessionCategoryIds(catMap);

      const entryMap: Record<string, SessionEntry> = {};
      for (const a of attendance ?? []) entryMap[a.training_id] = { status: a.status, notes: a.notes };
      setEntryBySession(entryMap);
    } else {
      setSessionCategoryIds({});
      setEntryBySession({});
    }

    const { data: recent } = await supabase
      .from("attendance")
      .select("id, status, training:trainings(date)")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(10);
    setHistory((recent ?? []) as unknown as HistoryRow[]);

    setLoading(false);
  }, [supabase, playerId]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  async function mark(trainingId: string, newStatus: AttendanceStatus, notes: string | null = null) {
    const { error } = await supabase
      .from("attendance")
      .upsert(
        { training_id: trainingId, player_id: playerId, status: newStatus, notes },
        { onConflict: "training_id,player_id" }
      );

    if (error) {
      toast.error("No se pudo guardar tu asistencia", { description: error.message });
      return;
    }

    setEntryBySession((prev) => ({ ...prev, [trainingId]: { status: newStatus, notes } }));
    toast.success("Asistencia guardada");
  }

  function openAbsenceDialog(sessionId: string) {
    setAbsenceReason(entryBySession[sessionId]?.notes ?? "");
    setAbsenceTarget({ sessionId });
  }

  async function confirmAbsence() {
    if (!absenceReason.trim()) {
      toast.error("Contá el motivo de la ausencia");
      return;
    }
    if (!absenceTarget?.sessionId) return;
    await mark(absenceTarget.sessionId, "ausente", absenceReason.trim());
    setAbsenceTarget(null);
    setAbsenceReason("");
  }

  function sessionLabel(training: Training) {
    const ids = sessionCategoryIds[training.id] ?? [];
    if (ids.length === 0) return "Entrenamiento";
    return ids.map((id) => categories.find((c) => c.id === id)?.name ?? "-").join(", ");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hoy</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {todaySessions.length === 0 && !loading && (
            <span className="text-sm text-muted-foreground">
              Todavía no hay un entrenamiento cargado para tu categoría hoy. Esperá a que el
              cuerpo técnico lo programe.
            </span>
          )}

          {todaySessions.map((session) => {
            const entry = entryBySession[session.id];
            const status = entry?.status;
            return (
              <div key={session.id} className="flex flex-wrap items-center gap-3 border-t pt-3 first:border-t-0 first:pt-0">
                <span className="min-w-24 text-sm font-medium">{sessionLabel(session)}</span>
                <button
                  type="button"
                  onClick={() => mark(session.id, "presente")}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    status === "presente" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  Llegué a horario
                </button>
                <button
                  type="button"
                  onClick={() => mark(session.id, "tarde")}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    status === "tarde" ? "bg-card-yellow text-card-yellow-foreground" : "hover:bg-muted"
                  )}
                >
                  Llegué tarde
                </button>
                <button
                  type="button"
                  onClick={() => openAbsenceDialog(session.id)}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    status === "ausente" ? "bg-card-red text-card-red-foreground" : "hover:bg-muted"
                  )}
                >
                  Voy a faltar
                </button>
                {status && <Badge variant="secondary">Registrado como {STATUS_LABEL[status]}</Badge>}
                {status === "ausente" && entry?.notes && (
                  <button
                    type="button"
                    onClick={() => openAbsenceDialog(session.id)}
                    className="text-xs text-destructive underline-offset-2 hover:underline"
                  >
                    Motivo: {entry.notes}
                  </button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.training
                      ? format(parseISO(row.training.date), "d MMM yyyy", { locale: es })
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "presente"
                          ? "default"
                          : row.status === "tarde"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Todavía no hay asistencias registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={absenceTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAbsenceTarget(null);
            setAbsenceReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo de tu ausencia</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="my-absence-reason">Contale al cuerpo técnico por qué vas a faltar</Label>
            <Textarea
              id="my-absence-reason"
              value={absenceReason}
              onChange={(e) => setAbsenceReason(e.target.value)}
              rows={3}
              placeholder="Ej: cita médica, permiso familiar..."
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
