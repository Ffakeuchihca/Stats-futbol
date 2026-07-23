"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CategoryCheckboxList } from "@/components/roster/category-checkbox-list";
import { toast } from "sonner";
import type { Category, Match } from "@/types/database";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function MatchFormDialog({
  trigger,
  match,
  defaultDate,
  categories,
  initialCategoryIds = [],
  onSaved,
}: {
  trigger: React.ReactElement;
  match?: Match;
  defaultDate?: string;
  categories: Category[];
  initialCategoryIds?: string[];
  onSaved?: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [opponent, setOpponent] = useState(match?.opponent ?? "");
  const [date, setDate] = useState(match?.date ?? defaultDate ?? todayISO());
  const [location, setLocation] = useState(match?.location ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(initialCategoryIds);

  function handleOpenChange(next: boolean) {
    if (next) {
      setOpponent(match?.opponent ?? "");
      setDate(match?.date ?? defaultDate ?? todayISO());
      setLocation(match?.location ?? "");
      setCategoryIds(initialCategoryIds);
    }
    setOpen(next);
  }

  function toggleCategory(categoryId: string) {
    setCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  }

  async function saveCategories(matchId: string) {
    await supabase.from("match_categories").delete().eq("match_id", matchId);
    if (categoryIds.length > 0) {
      await supabase
        .from("match_categories")
        .insert(categoryIds.map((category_id) => ({ match_id: matchId, category_id })));
    }
  }

  async function handleSave() {
    if (!opponent.trim()) return;
    if (categoryIds.length === 0) {
      toast.error("Elegí al menos una categoría");
      return;
    }
    setSubmitting(true);

    if (match) {
      const { error } = await supabase
        .from("matches")
        .update({ opponent: opponent.trim(), date, location: location.trim() || null })
        .eq("id", match.id);
      if (error) {
        setSubmitting(false);
        toast.error("No se pudo actualizar el partido", { description: error.message });
        return;
      }
      await saveCategories(match.id);
      setSubmitting(false);
      setOpen(false);
      toast.success("Partido actualizado");
      onSaved?.();
      router.refresh();
      return;
    }

    const { data, error } = await supabase
      .from("matches")
      .insert({ opponent: opponent.trim(), date, location: location.trim() || null })
      .select("id")
      .single();

    if (error || !data) {
      setSubmitting(false);
      toast.error("No se pudo crear el partido", { description: error?.message });
      return;
    }

    await saveCategories(data.id);
    setSubmitting(false);
    setOpen(false);
    toast.success("Partido creado");
    onSaved?.();
    router.push(`/partidos/${data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{match ? "Editar partido" : "Nuevo partido"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opponent">Rival</Label>
            <Input id="opponent" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="match-date">Fecha</Label>
            <Input id="match-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Sede (opcional)</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Categorías</Label>
            <CategoryCheckboxList
              categories={categories}
              selected={categoryIds}
              onToggle={toggleCategory}
            />
            <p className="text-xs text-muted-foreground">
              Cada partido tiene que quedar asignado a una categoría, con su propio marcador y
              planilla de jugadores.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={submitting || !opponent.trim() || categoryIds.length === 0}
          >
            {match ? "Guardar cambios" : "Crear partido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
