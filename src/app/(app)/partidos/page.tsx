import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isCoachRole } from "@/lib/supabase/profile";
import { getActiveCategoryId } from "@/lib/active-category";
import { costaRicaTrainingDate } from "@/lib/costa-rica-date";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MatchFormDialog } from "@/components/matches/match-form-dialog";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Category, Match } from "@/types/database";
import { ChevronRight, Plus } from "lucide-react";

export default async function PartidosPage() {
  const { profile } = await getCurrentProfile();
  const coach = isCoachRole(profile.role);
  const supabase = await createClient();
  const activeCategoryId = coach ? await getActiveCategoryId() : null;

  const matchesQuery = supabase
    .from("matches")
    .select("*, match_categories!inner(category_id)")
    .order("date", { ascending: false });

  const [{ data: matches }, { data: categories }, { data: matchCategories }] = await Promise.all([
    activeCategoryId
      ? matchesQuery.eq("match_categories.category_id", activeCategoryId)
      : supabase.from("matches").select("*").order("date", { ascending: false }),
    supabase.from("categories").select("*").order("name"),
    supabase.from("match_categories").select("match_id, category_id"),
  ]);

  const today = costaRicaTrainingDate();
  const list = (matches ?? []) as unknown as Match[];
  const categoryList = (categories ?? []) as Category[];
  const categoryById = new Map(categoryList.map((c) => [c.id, c.name]));
  const categoryIdsByMatch = new Map<string, string[]>();
  for (const mc of matchCategories ?? []) {
    const arr = categoryIdsByMatch.get(mc.match_id) ?? [];
    arr.push(mc.category_id);
    categoryIdsByMatch.set(mc.match_id, arr);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Box score"
        title="Partidos"
        description="Minutos, goles, asistencias, tarjetas, autoevaluación y scouting del rival."
        actions={
          coach ? (
            <MatchFormDialog
              categories={
                activeCategoryId ? categoryList.filter((c) => c.id === activeCategoryId) : categoryList
              }
              initialCategoryIds={activeCategoryId ? [activeCategoryId] : []}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Nuevo partido
                </Button>
              }
            />
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        {list.map((match) => {
          const played = match.date < today;
          const matchCategoryIds = categoryIdsByMatch.get(match.id) ?? [];
          return (
            <Link key={match.id} href={`/partidos/${match.id}`}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">vs {match.opponent}</span>
                      {played && match.our_score !== null && match.opponent_score !== null && (
                        <Badge variant="secondary" className="font-mono tabular-figures">
                          {match.our_score} - {match.opponent_score}
                        </Badge>
                      )}
                      {matchCategoryIds.map((cid) => (
                        <Badge key={cid} variant="outline" className="font-mono text-[10px]">
                          {categoryById.get(cid) ?? "-"}
                        </Badge>
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {format(parseISO(match.date), "EEEE d 'de' MMMM yyyy", { locale: es })}
                      {match.location ? ` · ${match.location}` : ""}
                    </span>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {list.length === 0 && (
          <Card>
            <CardContent className="text-center text-muted-foreground">
              Todavía no hay partidos cargados.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
