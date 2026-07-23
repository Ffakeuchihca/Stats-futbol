"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SelfEvaluation } from "@/types/database";

type EvalWithProfile = SelfEvaluation & { profile?: { full_name: string } };

export function SelfEvaluationSection({
  matchId,
  playerId,
  coach,
  evaluations,
}: {
  matchId: string;
  playerId: string;
  coach: boolean;
  evaluations: EvalWithProfile[];
}) {
  const supabase = createClient();
  const own = evaluations.find((e) => e.player_id === playerId);
  const [rating, setRating] = useState(own?.rating ?? 0);
  const [comment, setComment] = useState(own?.comment ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (rating < 1) {
      toast.error("Elegí una nota del 1 al 5");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("self_evaluations").upsert(
      { match_id: matchId, player_id: playerId, rating, comment: comment.trim() || null },
      { onConflict: "match_id,player_id" }
    );
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar tu autoevaluación", { description: error.message });
      return;
    }
    toast.success("Autoevaluación guardada");
  }

  if (coach) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Autoevaluaciones del plantel</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {evaluations.map((e) => (
            <div key={e.id} className="flex flex-col gap-1 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{e.profile?.full_name ?? "-"}</span>
                <Badge>{e.rating} / 5</Badge>
              </div>
              {e.comment && <p className="text-sm text-muted-foreground">{e.comment}</p>}
            </div>
          ))}
          {evaluations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todavía nadie cargó su autoevaluación de este partido.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">¿Cómo jugaste este partido?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className="p-1"
              aria-label={`Nota ${n}`}
            >
              <Star
                className={cn(
                  "size-8 transition-colors",
                  n <= rating ? "fill-primary text-primary" : "text-muted-foreground"
                )}
              />
            </button>
          ))}
        </div>
        <Textarea
          placeholder="¿Qué te salió bien? ¿Qué podés mejorar?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
        />
        <Button onClick={save} disabled={saving} className="w-fit">
          Guardar autoevaluación
        </Button>
      </CardContent>
    </Card>
  );
}
