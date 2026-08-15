import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isCoachRole } from "@/lib/supabase/profile";
import { getActiveCategoryId } from "@/lib/active-category";
import { TacticEditor } from "@/components/tactics/tactic-editor";
import { TacticPlayer } from "@/components/tactics/tactic-player";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import type { Category, Tactic, TacticFrame } from "@/types/database";

export default async function TacticaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await getCurrentProfile();
  const coach = isCoachRole(profile.role);
  const supabase = await createClient();

  if (id === "nueva") {
    if (!coach) redirect("/tactica");
    const activeCategoryId = await getActiveCategoryId();
    const { data: categories } = await supabase.from("categories").select("*").order("name");

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Pizarrón"
          title="Nueva táctica"
          description="Armá el movimiento paso a paso con fichas propias y rivales."
        />
        <TacticEditor
          tactic={null}
          initialFrames={[]}
          categories={(categories ?? []) as Category[]}
          initialCategoryIds={activeCategoryId ? [activeCategoryId] : []}
        />
      </div>
    );
  }

  const { data: tactic } = await supabase.from("tactics").select("*").eq("id", id).maybeSingle();
  if (!tactic) notFound();

  const [{ data: frames }, { data: categories }, { data: tacticCategories }] = await Promise.all([
    supabase.from("tactic_frames").select("*").eq("tactic_id", id).order("position"),
    supabase.from("categories").select("*").order("name"),
    supabase.from("tactic_categories").select("category_id").eq("tactic_id", id),
  ]);

  const categoryList = (categories ?? []) as Category[];
  const tacticCategoryIds = (tacticCategories ?? []).map((tc) => tc.category_id);

  if (coach) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Pizarrón"
          title={tactic.title as string}
          description="Editá el movimiento y guardá los cambios para el plantel."
        />
        <TacticEditor
          tactic={tactic as Tactic}
          initialFrames={(frames ?? []) as unknown as TacticFrame[]}
          categories={categoryList}
          initialCategoryIds={tacticCategoryIds}
        />
      </div>
    );
  }

  const categoryNames = tacticCategoryIds
    .map((cid) => categoryList.find((c) => c.id === cid)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pizarrón"
        title={tactic.title as string}
        description={(tactic.notes as string | null) ?? "Mirá cómo se mueve el equipo, paso a paso."}
        actions={
          categoryNames.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {categoryNames.map((name) => (
                <Badge key={name} variant="outline" className="font-mono text-[10px]">
                  {name}
                </Badge>
              ))}
            </div>
          ) : undefined
        }
      />
      {(frames ?? []).length > 0 ? (
        <TacticPlayer frames={(frames ?? []) as unknown as TacticFrame[]} />
      ) : (
        <p className="text-sm text-muted-foreground">Esta táctica todavía no tiene pasos cargados.</p>
      )}
    </div>
  );
}
