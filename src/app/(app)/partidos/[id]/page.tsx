import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isCoachRole } from "@/lib/supabase/profile";
import { MatchHeader } from "@/components/matches/match-header";
import { MatchStatsTable } from "@/components/matches/match-stats-table";
import { SelfEvaluationSection } from "@/components/matches/self-evaluation";
import { ScoutingRival } from "@/components/matches/scouting-rival";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Category,
  Match,
  MatchStat,
  OpponentScouting,
  Profile,
  SelfEvaluation,
} from "@/types/database";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, profile } = await getCurrentProfile();
  const coach = isCoachRole(profile.role);
  const supabase = await createClient();

  const { data: match } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
  if (!match) notFound();

  const [
    { data: players },
    { data: stats },
    { data: evaluations },
    { data: scouting },
    { data: categories },
    { data: matchCategories },
    { data: playerCategories },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "player").eq("active", true).order("full_name"),
    supabase.from("match_stats").select("*").eq("match_id", id),
    coach
      ? supabase.from("self_evaluations").select("*, profile:profiles(full_name)").eq("match_id", id)
      : supabase.from("self_evaluations").select("*").eq("match_id", id).eq("player_id", userId),
    supabase.from("opponent_scouting").select("*").eq("match_id", id).maybeSingle(),
    supabase.from("categories").select("*").order("name"),
    supabase.from("match_categories").select("category_id").eq("match_id", id),
    supabase.from("player_categories").select("player_id, category_id"),
  ]);

  const matchCategoryIds = (matchCategories ?? []).map((mc) => mc.category_id);
  const playerIdsInMatchCategories = new Set(
    (playerCategories ?? [])
      .filter((pc) => matchCategoryIds.includes(pc.category_id))
      .map((pc) => pc.player_id)
  );
  const relevantPlayers =
    matchCategoryIds.length === 0
      ? ((players ?? []) as Profile[])
      : ((players ?? []) as Profile[]).filter((p) => playerIdsInMatchCategories.has(p.id));

  return (
    <div className="flex flex-col gap-6">
      <MatchHeader
        match={match as Match}
        canEdit={coach}
        categories={(categories ?? []) as Category[]}
        initialCategoryIds={matchCategoryIds}
      />

      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats">Estadísticas</TabsTrigger>
          <TabsTrigger value="eval">Autoevaluación</TabsTrigger>
          <TabsTrigger value="scouting">Scouting rival</TabsTrigger>
        </TabsList>

        <TabsContent value="stats">
          <MatchStatsTable
            matchId={id}
            players={relevantPlayers}
            initialStats={(stats ?? []) as MatchStat[]}
            canEdit={coach}
            currentPlayerId={userId}
          />
        </TabsContent>

        <TabsContent value="eval">
          <SelfEvaluationSection
            matchId={id}
            playerId={userId}
            coach={coach}
            evaluations={
              (evaluations ?? []) as (SelfEvaluation & { profile?: { full_name: string } })[]
            }
          />
        </TabsContent>

        <TabsContent value="scouting">
          <ScoutingRival
            matchId={id}
            canEdit={coach}
            initial={(scouting ?? null) as OpponentScouting | null}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
