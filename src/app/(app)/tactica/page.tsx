import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isCoachRole } from "@/lib/supabase/profile";
import { getActiveCategoryId } from "@/lib/active-category";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Category, Tactic } from "@/types/database";
import { ChevronRight, Plus } from "lucide-react";

export default async function TacticaPage() {
  const { profile } = await getCurrentProfile();
  const coach = isCoachRole(profile.role);
  const supabase = await createClient();
  const activeCategoryId = coach ? await getActiveCategoryId() : null;

  const tacticsQuery = supabase.from("tactics").select("*, tactic_categories!inner(category_id)");

  const [{ data: tactics }, { data: categories }] = await Promise.all([
    activeCategoryId
      ? tacticsQuery.eq("tactic_categories.category_id", activeCategoryId)
      : supabase.from("tactics").select("*"),
    supabase.from("categories").select("*").order("name"),
  ]);

  const list = ((tactics ?? []) as unknown as Tactic[])
    .slice()
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  const tacticIds = list.map((t) => t.id);

  const [{ data: tacticCategories }, { data: frames }] = await Promise.all([
    tacticIds.length > 0
      ? supabase.from("tactic_categories").select("tactic_id, category_id").in("tactic_id", tacticIds)
      : Promise.resolve({ data: [] as { tactic_id: string; category_id: string }[] }),
    tacticIds.length > 0
      ? supabase.from("tactic_frames").select("tactic_id").in("tactic_id", tacticIds)
      : Promise.resolve({ data: [] as { tactic_id: string }[] }),
  ]);

  const categoryList = (categories ?? []) as Category[];
  const categoryById = new Map(categoryList.map((c) => [c.id, c.name]));
  const categoryIdsByTactic = new Map<string, string[]>();
  for (const tc of tacticCategories ?? []) {
    const arr = categoryIdsByTactic.get(tc.tactic_id) ?? [];
    arr.push(tc.category_id);
    categoryIdsByTactic.set(tc.tactic_id, arr);
  }
  const frameCountByTactic = new Map<string, number>();
  for (const f of frames ?? []) {
    frameCountByTactic.set(f.tactic_id, (frameCountByTactic.get(f.tactic_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pizarrón"
        title="Táctica"
        description={
          coach
            ? "Armá movimientos con fichas en la cancha y compartilos con el plantel."
            : "Revisá los movimientos que armó el cuerpo técnico."
        }
        actions={
          coach ? (
            <Link href="/tactica/nueva">
              <Button>
                <Plus className="size-4" />
                Nueva táctica
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        {list.map((tactic) => {
          const tacticCategoryIds = categoryIdsByTactic.get(tactic.id) ?? [];
          const frameCount = frameCountByTactic.get(tactic.id) ?? 0;
          return (
            <Link
              key={tactic.id}
              href={`/tactica/${tactic.id}`}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/40 hover:shadow-[0_1px_2px_oklch(0.2_0.03_258/8%),0_16px_32px_-16px_oklch(0.2_0.03_258/28%)]">
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{tactic.title}</span>
                      {tacticCategoryIds.map((cid) => (
                        <Badge key={cid} variant="outline" className="font-mono text-[10px]">
                          {categoryById.get(cid) ?? "-"}
                        </Badge>
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {frameCount} {frameCount === 1 ? "paso" : "pasos"} · actualizado{" "}
                      {format(parseISO(tactic.updated_at), "d MMM yyyy", { locale: es })}
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
              {coach
                ? "Todavía no armaste ninguna táctica."
                : "El cuerpo técnico todavía no compartió ninguna táctica."}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
