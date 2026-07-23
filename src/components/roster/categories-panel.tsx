"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import type { Category } from "@/types/database";

export function CategoriesPanel({ categories }: { categories: Category[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function addCategory() {
    if (!name.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("categories").insert({ name: name.trim() });
    setSubmitting(false);
    if (error) {
      toast.error("No se pudo crear la categoría", { description: error.message });
      return;
    }
    setName("");
    toast.success("Categoría creada");
    router.refresh();
  }

  async function removeCategory(category: Category) {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", category.id);
    if (error) {
      toast.error("No se pudo eliminar la categoría", { description: error.message });
      return;
    }
    toast.success("Categoría eliminada");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Categorías</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
              {c.name}
              <button
                type="button"
                onClick={() => removeCategory(c)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {categories.length === 0 && (
            <span className="text-sm text-muted-foreground">Todavía no hay categorías.</span>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Ej: Sub-15, Primera, Reserva..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-64"
          />
          <Button onClick={addCategory} disabled={submitting || !name.trim()}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
