import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isCoachRole } from "@/lib/supabase/profile";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarCheck,
  Wallet,
  Goal,
  Star,
  Trophy,
  Users,
  ArrowRight,
} from "lucide-react";
import type { PlayerFinesSummary, PlayerSeasonStats } from "@/types/database";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { costaRicaTrainingDate } from "@/lib/costa-rica-date";
import { getActiveCategoryId } from "@/lib/active-category";

export default async function DashboardPage() {
  const { userId, profile } = await getCurrentProfile();
  const supabase = await createClient();
  const today = costaRicaTrainingDate();
  const coach = isCoachRole(profile.role);
  const activeCategoryId = coach ? await getActiveCategoryId() : null;

  const scopedNextMatchQuery = supabase
    .from("matches")
    .select("*, match_categories!inner(category_id)")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1);
  const scopedTodayTrainingsQuery = supabase
    .from("trainings")
    .select("*, training_categories!inner(category_id)")
    .eq("date", today);

  const [{ data: nextMatch }, { data: todayTrainings }] = await Promise.all([
    activeCategoryId
      ? scopedNextMatchQuery.eq("match_categories.category_id", activeCategoryId).maybeSingle()
      : supabase
          .from("matches")
          .select("*")
          .gte("date", today)
          .order("date", { ascending: true })
          .limit(1)
          .maybeSingle(),
    activeCategoryId
      ? scopedTodayTrainingsQuery.eq("training_categories.category_id", activeCategoryId)
      : supabase.from("trainings").select("*").eq("date", today),
  ]);
  const hasTrainingToday = (todayTrainings ?? []).length > 0;

  let myAttendanceToday: string | null = null;
  if (todayTrainings && todayTrainings.length > 0) {
    const { data } = await supabase
      .from("attendance")
      .select("status")
      .in(
        "training_id",
        todayTrainings.map((t: { id: string }) => t.id)
      )
      .eq("player_id", userId)
      .limit(1)
      .maybeSingle();
    myAttendanceToday = data?.status ?? null;
  }

  let seasonStats: PlayerSeasonStats | null = null;
  let pendingFines = 0;
  let rosterCount = 0;
  let presentTodayCount = 0;

  if (coach) {
    const rosterQuery = supabase
      .from("profiles")
      .select("id, player_categories!inner(category_id)", { count: "exact", head: true })
      .eq("role", "player")
      .eq("active", true);
    const { count } = activeCategoryId
      ? await rosterQuery.eq("player_categories.category_id", activeCategoryId)
      : await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "player")
          .eq("active", true);
    rosterCount = count ?? 0;

    if (todayTrainings && todayTrainings.length > 0) {
      const { count: presentCount } = await supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .in(
          "training_id",
          todayTrainings.map((t: { id: string }) => t.id)
        )
        .neq("status", "ausente");
      presentTodayCount = presentCount ?? 0;
    }
  } else {
    const { data: stats } = await supabase
      .from("player_season_stats")
      .select("*")
      .eq("player_id", userId)
      .maybeSingle();
    seasonStats = stats as PlayerSeasonStats | null;

    const { data: fines } = await supabase
      .from("player_fines_summary")
      .select("*")
      .eq("player_id", userId);
    pendingFines = (fines as PlayerFinesSummary[] | null)?.reduce(
      (acc, f) => acc + Number(f.total_pendiente ?? 0),
      0
    ) ?? 0;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-pitch-gradient shadow-card relative overflow-hidden rounded-2xl p-6 text-pitch-foreground sm:p-8">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]"
          viewBox="0 0 400 160"
          preserveAspectRatio="xMidYMid slice"
        >
          <line x1="0" y1="80" x2="400" y2="80" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="200" cy="80" r="46" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <circle cx="200" cy="80" r="2.5" fill="currentColor" />
        </svg>
        <div className="relative flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-pitch-foreground/60">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </span>
          <h1 className="font-display text-4xl leading-none sm:text-5xl">
            Hola, {profile.full_name.split(" ")[0]}
          </h1>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {coach ? (
          <>
            <StatCard label="Jugadores activos" value={rosterCount} icon={Users} />
            <StatCard
              label="Asistencia de hoy"
              value={hasTrainingToday ? `${presentTodayCount}/${rosterCount}` : "Sin cargar"}
              hint={hasTrainingToday ? undefined : "No se registró el entrenamiento de hoy"}
              icon={CalendarCheck}
            />
            <StatCard
              label="Próximo partido"
              value={nextMatch ? `vs ${nextMatch.opponent}` : "Sin agendar"}
              hint={nextMatch ? format(parseISO(nextMatch.date), "d MMM", { locale: es }) : undefined}
              icon={Trophy}
            />
          </>
        ) : (
          <>
            <StatCard
              label="Asistencia de hoy"
              value={
                myAttendanceToday
                  ? myAttendanceToday === "presente"
                    ? "Presente"
                    : myAttendanceToday === "tarde"
                    ? "Tarde"
                    : "Ausente"
                  : "Sin marcar"
              }
              tone={myAttendanceToday === "ausente" ? "danger" : myAttendanceToday === "tarde" ? "warning" : "default"}
              icon={CalendarCheck}
            />
            <StatCard
              label="Multas pendientes"
              value={`$${pendingFines.toFixed(0)}`}
              tone={pendingFines > 0 ? "warning" : "default"}
              icon={Wallet}
            />
            <StatCard label="Goles en la temporada" value={seasonStats?.goles_totales ?? 0} icon={Goal} />
            <StatCard
              label="Autoevaluación promedio"
              value={seasonStats?.autoevaluacion_promedio ?? "-"}
              hint="sobre 5"
              icon={Star}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Entrenamiento de hoy</CardTitle>
            <Badge variant={hasTrainingToday ? "default" : "secondary"}>
              {hasTrainingToday ? "Cargado" : "Pendiente"}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {coach
                ? "Registrá la asistencia y las multas del día."
                : myAttendanceToday
                ? "Ya marcaste tu asistencia de hoy."
                : "Todavía no marcaste tu asistencia de hoy."}
            </p>
            <Button render={<Link href="/asistencia" />} nativeButton={false} className="w-fit">
              Ir a asistencia <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Próximo partido</CardTitle>
            {nextMatch && <Badge variant="secondary">{nextMatch.location ?? "Sin sede"}</Badge>}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {nextMatch
                ? `vs ${nextMatch.opponent} · ${format(parseISO(nextMatch.date), "EEEE d 'de' MMMM", { locale: es })}`
                : "Todavía no hay un próximo partido agendado."}
            </p>
            <Button
              render={<Link href="/partidos" />}
              nativeButton={false}
              variant="outline"
              className="w-fit"
            >
              Ver partidos <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
