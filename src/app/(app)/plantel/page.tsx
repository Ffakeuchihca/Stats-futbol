import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isCoachRole, isAdminRole } from "@/lib/supabase/profile";
import { getActiveCategoryId } from "@/lib/active-category";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditPlayerDialog } from "@/components/roster/edit-player-dialog";
import { CategoriesPanel } from "@/components/roster/categories-panel";
import { PageHeader } from "@/components/page-header";
import { CardChip } from "@/components/card-chip";
import type { Category, PlayerSeasonStats, Profile } from "@/types/database";

export default async function PlantelPage() {
  const { profile } = await getCurrentProfile();
  const coach = isCoachRole(profile.role);
  const admin = isAdminRole(profile.role);
  const supabase = await createClient();
  const activeCategoryId = coach ? await getActiveCategoryId() : null;

  const playersQuery = supabase
    .from("profiles")
    .select("*, player_categories!inner(category_id)")
    .order("full_name");

  const [{ data: players }, { data: stats }, { data: categories }, { data: playerCategories }] =
    await Promise.all([
      activeCategoryId
        ? playersQuery.eq("role", "player").eq("player_categories.category_id", activeCategoryId)
        : supabase.from("profiles").select("*").eq("role", "player").order("full_name"),
      supabase.from("player_season_stats").select("*"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("player_categories").select("player_id, category_id"),
    ]);

  const statsByPlayer = new Map(
    ((stats ?? []) as PlayerSeasonStats[]).map((s) => [s.player_id, s])
  );
  const categoryList = (categories ?? []) as Category[];
  const categoryById = new Map(categoryList.map((c) => [c.id, c.name]));

  const categoryIdsByPlayer = new Map<string, string[]>();
  for (const pc of playerCategories ?? []) {
    const list = categoryIdsByPlayer.get(pc.player_id) ?? [];
    list.push(pc.category_id);
    categoryIdsByPlayer.set(pc.player_id, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Plantilla"
        title="Plantel"
        description="Estadísticas acumuladas de la temporada: partidos, minutos, goles, asistencias y tarjetas."
      />

      {admin && <CategoriesPanel categories={categoryList} />}

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b text-left font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Jugador</th>
                  <th className="px-3 py-2">Posición</th>
                  <th className="px-3 py-2">Categorías</th>
                  <th className="px-3 py-2 text-center">Conv.</th>
                  <th className="px-3 py-2 text-center">Tit.</th>
                  <th className="px-3 py-2 text-center">Sup.</th>
                  <th className="px-3 py-2 text-center">Min.</th>
                  <th className="px-3 py-2 text-center">Goles</th>
                  <th className="px-3 py-2 text-center">Asist.</th>
                  <th className="px-3 py-2 text-center">TA</th>
                  <th className="px-3 py-2 text-center">TR</th>
                  <th className="px-3 py-2 text-center">Autoeval.</th>
                  {coach && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {((players ?? []) as unknown as Profile[]).map((p) => {
                  const s = statsByPlayer.get(p.id);
                  const playerCategoryIds = categoryIdsByPlayer.get(p.id) ?? [];
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-muted/40">
                      <td className="whitespace-nowrap px-3 py-2 font-medium">
                        {p.full_name}
                        {p.jersey_number !== null && (
                          <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                            #{p.jersey_number}
                          </span>
                        )}
                        {!p.active && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            Inactivo
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.role === "player" ? p.position ?? "-" : "Cuerpo técnico"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {playerCategoryIds.length === 0 && (
                            <span className="text-muted-foreground">-</span>
                          )}
                          {playerCategoryIds.map((cid) => (
                            <Badge key={cid} variant="outline" className="font-mono text-[10px]">
                              {categoryById.get(cid) ?? "-"}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center font-mono tabular-figures">
                        {s?.partidos_convocado ?? 0}
                      </td>
                      <td className="px-3 py-2 text-center font-mono tabular-figures">
                        {s?.partidos_titular ?? 0}
                      </td>
                      <td className="px-3 py-2 text-center font-mono tabular-figures">
                        {s?.partidos_suplente ?? 0}
                      </td>
                      <td className="px-3 py-2 text-center font-mono tabular-figures">
                        {s?.minutos_totales ?? 0}
                      </td>
                      <td className="px-3 py-2 text-center font-mono tabular-figures">
                        {s?.goles_totales ?? 0}
                      </td>
                      <td className="px-3 py-2 text-center font-mono tabular-figures">
                        {s?.asistencias_totales ?? 0}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <CardChip
                          color="yellow"
                          count={s?.amarillas_totales ?? 0}
                          label="Tarjetas amarillas"
                          className="justify-center"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <CardChip
                          color="red"
                          count={s?.rojas_totales ?? 0}
                          label="Tarjetas rojas"
                          className="justify-center"
                        />
                      </td>
                      <td className="px-3 py-2 text-center font-mono tabular-figures">
                        {s?.autoevaluacion_promedio ?? "-"}
                      </td>
                      {coach && (
                        <td className="px-3 py-2 text-right">
                          <EditPlayerDialog
                            player={p}
                            categories={categoryList}
                            initialCategoryIds={playerCategoryIds}
                            canEditRole={admin}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
