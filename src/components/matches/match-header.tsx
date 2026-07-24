"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MatchFormDialog } from "@/components/matches/match-form-dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";
import type { Category, Match } from "@/types/database";

export function MatchHeader({
  match,
  canEdit,
  categories,
  initialCategoryIds,
}: {
  match: Match;
  canEdit: boolean;
  categories: Category[];
  initialCategoryIds: string[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [ourScore, setOurScore] = useState(match.our_score?.toString() ?? "");
  const [opponentScore, setOpponentScore] = useState(match.opponent_score?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveScore() {
    setSaving(true);
    const { error } = await supabase
      .from("matches")
      .update({
        our_score: ourScore === "" ? null : Number(ourScore),
        opponent_score: opponentScore === "" ? null : Number(opponentScore),
      })
      .eq("id", match.id);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar el resultado");
      return;
    }
    toast.success("Resultado guardado");
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar el partido vs ${match.opponent}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from("matches").delete().eq("id", match.id);
    setDeleting(false);
    if (error) {
      toast.error("No se pudo eliminar el partido", { description: error.message });
      return;
    }
    toast.success("Partido eliminado");
    router.push("/partidos");
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl leading-none">vs {match.opponent}</h1>
            {canEdit && (
              <div className="flex items-center gap-1">
                <MatchFormDialog
                  match={match}
                  categories={categories}
                  initialCategoryIds={initialCategoryIds}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label="Editar partido">
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Eliminar partido"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </div>
          <p className="text-muted-foreground">
            {format(parseISO(match.date), "EEEE d 'de' MMMM yyyy", { locale: es })}
            {match.location ? ` · ${match.location}` : ""}
          </p>
          {initialCategoryIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {initialCategoryIds.map((cid) => (
                <Badge key={cid} variant="outline" className="font-mono text-[10px]">
                  {categories.find((c) => c.id === cid)?.name ?? "-"}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {canEdit ? (
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Nosotros</Label>
              <Input
                type="number"
                min={0}
                className="w-16"
                value={ourScore}
                onChange={(e) => setOurScore(e.target.value)}
              />
            </div>
            <span className="pb-2 text-muted-foreground">-</span>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Rival</Label>
              <Input
                type="number"
                min={0}
                className="w-16"
                value={opponentScore}
                onChange={(e) => setOpponentScore(e.target.value)}
              />
            </div>
            <Button size="sm" variant="outline" onClick={saveScore} disabled={saving}>
              Guardar
            </Button>
          </div>
        ) : (
          match.our_score !== null &&
          match.opponent_score !== null && (
            <div className="rounded-lg bg-pitch px-4 py-2 font-display text-4xl leading-none text-pitch-foreground tabular-figures">
              {match.our_score} <span className="text-pitch-foreground/50">-</span> {match.opponent_score}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
