"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardChip } from "@/components/card-chip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Save } from "lucide-react";
import type { MatchStat, Profile } from "@/types/database";

type StatFields = Pick<
  MatchStat,
  | "convocado"
  | "titular"
  | "suplente"
  | "minutos_jugados"
  | "goles"
  | "asistencias"
  | "tarjetas_amarillas"
  | "tarjetas_rojas"
>;

const EMPTY: StatFields = {
  convocado: false,
  titular: false,
  suplente: false,
  minutos_jugados: 0,
  goles: 0,
  asistencias: 0,
  tarjetas_amarillas: 0,
  tarjetas_rojas: 0,
};

export function MatchStatsTable({
  matchId,
  players,
  initialStats,
  canEdit,
  currentPlayerId,
}: {
  matchId: string;
  players: Profile[];
  initialStats: MatchStat[];
  canEdit: boolean;
  currentPlayerId: string;
}) {
  const supabase = createClient();
  const initialMap: Record<string, StatFields> = {};
  for (const p of players) {
    const found = initialStats.find((s) => s.player_id === p.id);
    initialMap[p.id] = found
      ? {
          convocado: found.convocado,
          titular: found.titular,
          suplente: found.suplente,
          minutos_jugados: found.minutos_jugados,
          goles: found.goles,
          asistencias: found.asistencias,
          tarjetas_amarillas: found.tarjetas_amarillas,
          tarjetas_rojas: found.tarjetas_rojas,
        }
      : { ...EMPTY };
  }
  const [rows, setRows] = useState(initialMap);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function update(playerId: string, patch: Partial<StatFields>) {
    setRows((prev) => {
      const current = prev[playerId] ?? { ...EMPTY };
      let next = { ...current, ...patch };
      if (patch.titular === true) next.suplente = false;
      if (patch.suplente === true) next.titular = false;
      if (patch.convocado === false) next = { ...next, titular: false, suplente: false };
      return { ...prev, [playerId]: next };
    });
    setDirty((prev) => new Set(prev).add(playerId));
  }

  async function saveChanges() {
    if (dirty.size === 0) return;
    setSaving(true);
    const payload = Array.from(dirty).map((playerId) => ({
      match_id: matchId,
      player_id: playerId,
      ...rows[playerId],
    }));
    const { error } = await supabase
      .from("match_stats")
      .upsert(payload, { onConflict: "match_id,player_id" });
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar la estadística", { description: error.message });
      return;
    }
    toast.success("Estadísticas guardadas");
    setDirty(new Set());
  }

  const visiblePlayers = canEdit ? players : players.filter((p) => p.id === currentPlayerId);
  const totals = players.reduce(
    (acc, p) => {
      const r = rows[p.id];
      acc.goles += r.goles;
      acc.asistencias += r.asistencias;
      acc.amarillas += r.tarjetas_amarillas;
      acc.rojas += r.tarjetas_rojas;
      return acc;
    },
    { goles: 0, asistencias: 0, amarillas: 0, rojas: 0 }
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-5 font-mono text-sm text-muted-foreground">
            <span>
              Goles equipo: <strong className="text-foreground tabular-figures">{totals.goles}</strong>
            </span>
            <span>
              Asistencias: <strong className="text-foreground tabular-figures">{totals.asistencias}</strong>
            </span>
            <CardChip color="yellow" count={totals.amarillas} label="Amarillas" />
            <CardChip color="red" count={totals.rojas} label="Rojas" />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Cargá tus estadísticas de este partido cuando quieras. El cuerpo técnico puede revisarlas y
            corregirlas si hace falta.
          </p>
        )}
        <Button
          size="sm"
          onClick={saveChanges}
          disabled={dirty.size === 0 || saving}
          className="gap-1.5"
        >
          <Save className="size-4" />
          {saving ? "Guardando..." : dirty.size > 0 ? `Guardar cambios (${dirty.size})` : "Guardado"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Jugador</th>
              <th className="px-3 py-2 text-center">Conv.</th>
              <th className="px-3 py-2 text-center">Titular</th>
              <th className="px-3 py-2 text-center">Suplente</th>
              <th className="px-3 py-2 text-center">Minutos</th>
              <th className="px-3 py-2 text-center">Goles</th>
              <th className="px-3 py-2 text-center">Asist.</th>
              <th className="px-3 py-2 text-center">TA</th>
              <th className="px-3 py-2 text-center">TR</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visiblePlayers.map((p) => {
              const r = rows[p.id];
              const isDirty = dirty.has(p.id);
              return (
                <tr key={p.id} className={isDirty ? "bg-amber-500/5" : ""}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    {p.full_name}
                    {isDirty && (
                      <span className="ml-1.5 align-middle text-[10px] font-mono uppercase tracking-wide text-amber-600">
                        Sin guardar
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={r.convocado}
                      onChange={(e) => update(p.id, { convocado: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={r.titular}
                      onChange={(e) => update(p.id, { titular: e.target.checked, convocado: true })}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={r.suplente}
                      onChange={(e) => update(p.id, { suplente: e.target.checked, convocado: true })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      max={130}
                      value={r.minutos_jugados}
                      onChange={(e) => update(p.id, { minutos_jugados: Number(e.target.value) })}
                      className="w-16"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      value={r.goles}
                      onChange={(e) => update(p.id, { goles: Number(e.target.value) })}
                      className="w-14"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      value={r.asistencias}
                      onChange={(e) => update(p.id, { asistencias: Number(e.target.value) })}
                      className="w-14"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      max={2}
                      value={r.tarjetas_amarillas}
                      onChange={(e) => update(p.id, { tarjetas_amarillas: Number(e.target.value) })}
                      className={cn("w-14 border-l-2 tabular-figures", "border-l-card-yellow")}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      value={r.tarjetas_rojas}
                      onChange={(e) => update(p.id, { tarjetas_rojas: Number(e.target.value) })}
                      className={cn("w-14 border-l-2 tabular-figures", "border-l-card-red")}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
