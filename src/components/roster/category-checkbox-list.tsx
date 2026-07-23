"use client";

import { Label } from "@/components/ui/label";
import type { Category } from "@/types/database";

export function CategoryCheckboxList({
  categories,
  selected,
  onToggle,
}: {
  categories: Category[];
  selected: string[];
  onToggle: (categoryId: string) => void;
}) {
  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay categorías creadas.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {categories.map((c) => (
        <label key={c.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(c.id)}
            onChange={() => onToggle(c.id)}
          />
          <Label className="font-normal">{c.name}</Label>
        </label>
      ))}
    </div>
  );
}
