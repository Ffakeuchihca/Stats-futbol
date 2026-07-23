"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EditFineDialog } from "@/components/fines/edit-fine-dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { FineType, Profile } from "@/types/database";

interface FineRow {
  id: string;
  date: string;
  paid: boolean;
  notes: string | null;
  player_id: string;
  fine_type_id: string;
  profile: { full_name: string } | null;
  fine_type: { name: string; amount: number; code: string } | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function CoachFines({
  players,
  fineTypes,
}: {
  players: Profile[];
  fineTypes: FineType[];
}) {
  const supabase = createClient();
  const [fines, setFines] = useState<FineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");
  const [fineTypeId, setFineTypeId] = useState(fineTypes[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("fines")
      .select(
        "id, date, paid, notes, player_id, fine_type_id, profile:profiles!fines_player_id_fkey(full_name), fine_type:fine_types(name, amount, code)"
      )
      .order("date", { ascending: false })
      .limit(200);
    if (players.length > 0) {
      query = query.in(
        "player_id",
        players.map((p) => p.id)
      );
    }
    const { data, error } = await query;

    if (error) {
      toast.error("No se pudieron cargar las multas", { description: error.message });
      setLoading(false);
      return;
    }

    setFines((data ?? []) as unknown as FineRow[]);
    setLoading(false);
  }, [supabase, players]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  async function handleAddFine() {
    if (!playerId || !fineTypeId) return;
    setSubmitting(true);
    const { error } = await supabase.from("fines").insert({
      player_id: playerId,
      fine_type_id: fineTypeId,
      date,
      notes: notes.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      toast.error("No se pudo registrar la multa", { description: error.message });
      return;
    }
    setNotes("");
    toast.success("Multa registrada");
    load();
  }

  async function togglePaid(fine: FineRow) {
    const { error } = await supabase.from("fines").update({ paid: !fine.paid }).eq("id", fine.id);
    if (error) {
      toast.error("No se pudo actualizar la multa");
      return;
    }
    setFines((prev) => prev.map((f) => (f.id === fine.id ? { ...f, paid: !f.paid } : f)));
  }

  async function removeFine(id: string) {
    const { error } = await supabase.from("fines").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo eliminar la multa");
      return;
    }
    setFines((prev) => prev.filter((f) => f.id !== id));
    toast.success("Multa eliminada");
  }

  const totalsByPlayer = new Map<string, { name: string; pendiente: number; pagado: number }>();
  for (const f of fines) {
    const name = f.profile?.full_name ?? "-";
    const amount = Number(f.fine_type?.amount ?? 0);
    const entry = totalsByPlayer.get(f.player_id) ?? { name, pendiente: 0, pagado: 0 };
    if (f.paid) entry.pagado += amount;
    else entry.pendiente += amount;
    totalsByPlayer.set(f.player_id, entry);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar multa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Jugador</Label>
            <Select value={playerId} onValueChange={(v) => setPlayerId(v ?? "")}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Jugador">
                  {(v: string) => players.find((p) => p.id === v)?.full_name ?? "Jugador"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Motivo</Label>
            <Select value={fineTypeId} onValueChange={(v) => setFineTypeId(v ?? "")}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Motivo">
                  {(v: string) => {
                    const t = fineTypes.find((ft) => ft.id === v);
                    return t ? `${t.name} ($${t.amount})` : "Motivo";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {fineTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} (${t.amount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-fit" />
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={1}
              className="min-h-8"
            />
          </div>
          <Button onClick={handleAddFine} disabled={submitting || !playerId || !fineTypeId}>
            Registrar
          </Button>
        </CardContent>
      </Card>

      {totalsByPlayer.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen por jugador</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jugador</TableHead>
                  <TableHead>Pendiente</TableHead>
                  <TableHead>Pagado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...totalsByPlayer.entries()].map(([id, t]) => (
                  <TableRow key={id}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell
                      className={cn(
                        "font-mono tabular-figures",
                        t.pendiente > 0 && "font-medium text-card-red"
                      )}
                    >
                      ${t.pendiente.toFixed(0)}
                    </TableCell>
                    <TableCell className="font-mono tabular-figures text-muted-foreground">
                      ${t.pagado.toFixed(0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Jugador</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fines.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono tabular-figures">
                    {format(parseISO(f.date), "d MMM yyyy", { locale: es })}
                  </TableCell>
                  <TableCell>{f.profile?.full_name ?? "-"}</TableCell>
                  <TableCell>{f.fine_type?.name ?? "-"}</TableCell>
                  <TableCell className="font-mono tabular-figures">
                    ${Number(f.fine_type?.amount ?? 0).toFixed(0)}
                  </TableCell>
                  <TableCell>
                    <button onClick={() => togglePaid(f)}>
                      <Badge variant={f.paid ? "secondary" : "destructive"} className="cursor-pointer">
                        {f.paid ? "Pagada" : "Pendiente"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <EditFineDialog fine={f} players={players} fineTypes={fineTypes} onSaved={load} />
                      <Button variant="ghost" size="sm" onClick={() => removeFine(f.id)}>
                        Quitar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && fines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay multas registradas todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
