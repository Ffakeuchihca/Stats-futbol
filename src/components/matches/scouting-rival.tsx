"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { OpponentScouting } from "@/types/database";

export function ScoutingRival({
  matchId,
  canEdit,
  initial,
}: {
  matchId: string;
  canEdit: boolean;
  initial: OpponentScouting | null;
}) {
  const supabase = createClient();
  const [systemOfPlay, setSystemOfPlay] = useState(initial?.system_of_play ?? "");
  const [strengths, setStrengths] = useState(initial?.strengths ?? "");
  const [weaknesses, setWeaknesses] = useState(initial?.weaknesses ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("opponent_scouting").upsert(
      {
        match_id: matchId,
        system_of_play: systemOfPlay.trim() || null,
        strengths: strengths.trim() || null,
        weaknesses: weaknesses.trim() || null,
        notes: notes.trim() || null,
      },
      { onConflict: "match_id" }
    );
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar el scouting", { description: error.message });
      return;
    }
    toast.success("Scouting guardado");
  }

  const hasContent = systemOfPlay || strengths || weaknesses || notes;

  if (!canEdit && !hasContent) {
    return (
      <Card>
        <CardContent className="text-center text-muted-foreground">
          El cuerpo técnico todavía no cargó el análisis de este rival.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Análisis del rival</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Sistema de juego</Label>
          {canEdit ? (
            <Textarea
              value={systemOfPlay}
              onChange={(e) => setSystemOfPlay(e.target.value)}
              rows={2}
              placeholder="Ej: 4-3-3, presión alta, salida corta..."
            />
          ) : (
            <p className="text-sm text-muted-foreground">{systemOfPlay || "-"}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Fortalezas</Label>
          {canEdit ? (
            <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} />
          ) : (
            <p className="text-sm text-muted-foreground">{strengths || "-"}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Debilidades</Label>
          {canEdit ? (
            <Textarea value={weaknesses} onChange={(e) => setWeaknesses(e.target.value)} rows={3} />
          ) : (
            <p className="text-sm text-muted-foreground">{weaknesses || "-"}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Notas adicionales</Label>
          {canEdit ? (
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          ) : (
            <p className="text-sm text-muted-foreground">{notes || "-"}</p>
          )}
        </div>
        {canEdit && (
          <Button onClick={save} disabled={saving} className="w-fit">
            Guardar análisis
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
