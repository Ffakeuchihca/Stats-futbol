import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isCoachRole } from "@/lib/supabase/profile";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { setActiveCategory } from "./actions";
import type { Category } from "@/types/database";

export default async function CategoriaPage() {
  const { profile } = await getCurrentProfile();
  if (!isCoachRole(profile.role)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("*").order("name");
  const categoryList = (categories ?? []) as Category[];

  return (
    <div className="bg-pitch-gradient relative flex flex-1 items-center justify-center overflow-hidden p-4">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full text-pitch-foreground opacity-[0.08]"
        viewBox="0 0 400 400"
        preserveAspectRatio="xMidYMid slice"
      >
        <line x1="0" y1="200" x2="400" y2="200" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="90" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="200" cy="200" r="3" fill="currentColor" />
      </svg>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="font-display text-4xl leading-none tracking-wide text-pitch-foreground">
            ¿Con qué categoría vas a trabajar?
          </h1>
          <p className="text-sm text-pitch-foreground/70">
            Vas a ver solo los entrenamientos, partidos y jugadores de esa categoría. Podés
            cambiarla cuando quieras desde el menú.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            {categoryList.map((category) => (
              <form key={category.id} action={setActiveCategory.bind(null, category.id)}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-between rounded-lg border px-4 py-3.5 text-left outline-none transition-all duration-150 hover:border-primary hover:bg-primary/5 hover:shadow-card focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-display text-2xl leading-none">{category.name}</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </button>
              </form>
            ))}
            {categoryList.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Todavía no hay categorías creadas. Pedile a un administrador que cree una desde
                Plantel.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
