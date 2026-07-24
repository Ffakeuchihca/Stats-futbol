"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Trophy, CalendarCheck } from "lucide-react";
import type { Category, Match, Training } from "@/types/database";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function CalendarView({
  matches,
  trainings,
  categories,
  categoryIdsByTraining,
  categoryIdsByMatch,
}: {
  matches: Match[];
  trainings: Training[];
  categories: Category[];
  categoryIdsByTraining: Record<string, string[]>;
  categoryIdsByMatch: Record<string, string[]>;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(new Date());

  function categoryNames(ids: string[]) {
    if (ids.length === 0) return null;
    return ids.map((id) => categories.find((c) => c.id === id)?.name ?? "-").join(", ");
  }

  const matchesByDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const list = map.get(m.date) ?? [];
      list.push(m);
      map.set(m.date, list);
    }
    return map;
  }, [matches]);

  const trainingsByDate = useMemo(() => {
    const map = new Map<string, Training[]>();
    for (const t of trainings) {
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    }
    return map;
  }, [trainings]);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const selectedKey = format(selected, "yyyy-MM-dd");
  const selectedMatches = matchesByDate.get(selectedKey) ?? [];
  const selectedTrainings = trainingsByDate.get(selectedKey) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl capitalize leading-none">
              {format(month, "MMMM yyyy", { locale: es })}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Mes anterior"
                onClick={() => setMonth((m) => subMonths(m, 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
                Hoy
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Mes siguiente"
                onClick={() => setMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = dateKey(day);
              const dayMatches = matchesByDate.get(key) ?? [];
              const dayTrainings = trainingsByDate.get(key) ?? [];
              const events = [
                ...dayTrainings.map((t) => ({
                  type: "training" as const,
                  label: categoryNames(categoryIdsByTraining[t.id] ?? []) ?? "Entren.",
                })),
                ...dayMatches.map((m) => ({
                  type: "match" as const,
                  label: `vs ${m.opponent}`,
                })),
              ];
              const visibleEvents = events.slice(0, 2);
              const extraCount = events.length - visibleEvents.length;
              const inMonth = isSameMonth(day, month);
              const active = isSameDay(day, selected);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(day)}
                  aria-current={active ? "date" : undefined}
                  aria-label={format(day, "EEEE d 'de' MMMM", { locale: es })}
                  className={cn(
                    "flex min-h-20 flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors sm:min-h-24",
                    inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                    active && "border-primary ring-1 ring-primary"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full font-mono text-xs tabular-figures",
                      isToday(day) && "bg-primary text-primary-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="flex w-full flex-col gap-0.5">
                    {visibleEvents.map((e, i) => (
                      <span
                        key={i}
                        className={cn(
                          "w-full truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight",
                          e.type === "training"
                            ? "bg-primary/15 text-primary"
                            : "bg-card-yellow/20 text-amber-700 dark:text-card-yellow"
                        )}
                      >
                        {e.label}
                      </span>
                    ))}
                    {extraCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">+{extraCount} más</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded bg-primary/15 ring-1 ring-primary" /> Entrenamiento
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded bg-card-yellow/20 ring-1 ring-card-yellow" /> Partido
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h3 className="font-display text-xl capitalize leading-none">
            {format(selected, "EEEE d 'de' MMMM", { locale: es })}
          </h3>

          {selectedTrainings.length === 0 && selectedMatches.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay entrenamientos ni partidos este día.</p>
          )}

          {selectedTrainings.map((t) => (
            <Link
              key={t.id}
              href={`/asistencia?date=${t.date}&training=${t.id}`}
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/40"
            >
              <CalendarCheck className="size-4 text-primary" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {categoryNames(categoryIdsByTraining[t.id] ?? []) ?? "Entrenamiento (general)"}
                </span>
                {t.notes && <span className="text-xs text-muted-foreground">{t.notes}</span>}
              </div>
            </Link>
          ))}

          {selectedMatches.map((m) => (
            <Link
              key={m.id}
              href={`/partidos/${m.id}`}
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/40"
            >
              <Trophy className="size-4 text-amber-500" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">vs {m.opponent}</span>
                <span className="text-xs text-muted-foreground">
                  {[m.location, categoryNames(categoryIdsByMatch[m.id] ?? [])]
                    .filter(Boolean)
                    .join(" · ") || undefined}
                </span>
              </div>
              {m.our_score !== null && m.opponent_score !== null && (
                <Badge variant="secondary" className="ml-auto">
                  {m.our_score} - {m.opponent_score}
                </Badge>
              )}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
