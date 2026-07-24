"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import type { FineType, Profile } from "@/types/database";

export function EditFineDialog({
  fine,
  players,
  fineTypes,
  onSaved,
}: {
  fine: {
    id: string;
    date: string;
    player_id: string;
    fine_type_id: string;
    notes: string | null;
  };
  players: Profile[];
  fineTypes: FineType[];
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [playerId, setPlayerId] = useState(fine.player_id);
  const [fineTypeId, setFineTypeId] = useState(fine.fine_type_id);
  const [date, setDate] = useState(fine.date);
  const [notes, setNotes] = useState(fine.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      setPlayerId(fine.player_id);
      setFineTypeId(fine.fine_type_id);
      setDate(fine.date);
      setNotes(fine.notes ?? "");
    }
    setOpen(next);
  }

  async function handleSave() {
    setSubmitting(true);
    const { error } = await supabase
      .from("fines")
      .update({
        player_id: playerId,
        fine_type_id: fineTypeId,
        date,
        notes: notes.trim() || null,
      })
      .eq("id", fine.id);
    setSubmitting(false);

    if (error) {
      toast.error("No se pudo actualizar la multa", { description: error.message });
      return;
    }
    setOpen(false);
    toast.success("Multa actualizada");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Editar multa">
            <Pencil className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar multa</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Jugador</Label>
            <Select value={playerId} onValueChange={(v) => v && setPlayerId(v)}>
              <SelectTrigger>
                <SelectValue>
                  {(v: string) => players.find((p) => p.id === v)?.full_name ?? ""}
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
            <Select value={fineTypeId} onValueChange={(v) => v && setFineTypeId(v)}>
              <SelectTrigger>
                <SelectValue>
                  {(v: string) => {
                    const t = fineTypes.find((ft) => ft.id === v);
                    return t ? `${t.name} ($${t.amount})` : "";
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
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notas (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
