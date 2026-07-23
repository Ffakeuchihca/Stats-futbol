"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { Category, Training } from "@/types/database";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function TrainingDialog({
  trigger,
  training,
  defaultDate,
  categories,
  initialCategoryIds = [],
  onSaved,
}: {
  trigger: React.ReactElement;
  training?: Training;
  defaultDate?: string;
  categories: Category[];
  initialCategoryIds?: string[];
  onSaved?: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(training?.date ?? defaultDate ?? todayISO());
  const [notes, setNotes] = useState(training?.notes ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(initialCategoryIds);
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      setDate(training?.date ?? defaultDate ?? todayISO());
      setNotes(training?.notes ?? "");
      setCategoryIds(initialCategoryIds);
    }
    setOpen(next);
  }

  function toggleCategory(categoryId: string) {
    setCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  }

  async function handleSave() {
    if (categoryIds.length === 0) {
      toast.error("Elegí al menos una categoría");
      return;
    }
    setSubmitting(true);

    let trainingId = training?.id;
    if (training) {
      const { error } = await supabase
        .from("trainings")
        .update({ date, notes: notes.trim() || null })
        .eq("id", training.id);
      if (error) {
        setSubmitting(false);
        toast.error("No se pudo guardar el entrenamiento", { description: error.message });
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("trainings")
        .insert({ date, notes: notes.trim() || null })
        .select("id")
        .single();
      if (error || !data) {
        setSubmitting(false);
        toast.error("No se pudo crear el entrenamiento", { description: error?.message });
        return;
      }
      trainingId = data.id;
    }

    await supabase.from("training_categories").delete().eq("training_id", trainingId);
    if (categoryIds.length > 0) {
      await supabase
        .from("training_categories")
        .insert(categoryIds.map((category_id) => ({ training_id: trainingId, category_id })));
    }

    setSubmitting(false);
    setOpen(false);
    toast.success(training ? "Entrenamiento actualizado" : "Entrenamiento programado");
    onSaved?.();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{training ? "Editar entrenamiento" : "Programar entrenamiento"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="training-dialog-date">Fecha</Label>
            <Input
              id="training-dialog-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Categorías</Label>
            <CategoryCheckboxList
              categories={categories}
              selected={categoryIds}
              onToggle={toggleCategory}
            />
            <p className="text-xs text-muted-foreground">
              Todo entrenamiento tiene que quedar asignado a una categoría.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="training-dialog-notes">Notas (opcional)</Label>
            <Textarea
              id="training-dialog-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ej: doble turno, trabajo táctico, amistoso..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting || categoryIds.length === 0}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
