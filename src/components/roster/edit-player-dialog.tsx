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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryCheckboxList } from "@/components/roster/category-checkbox-list";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import type { Category, Profile, UserRole } from "@/types/database";

const ROLE_LABEL: Record<UserRole, string> = {
  player: "Jugador",
  coach: "Cuerpo técnico",
  admin: "Administrador",
};

export function EditPlayerDialog({
  player,
  categories,
  initialCategoryIds,
  canEditRole,
}: {
  player: Profile;
  categories: Category[];
  initialCategoryIds: string[];
  canEditRole: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [jerseyNumber, setJerseyNumber] = useState(player.jersey_number?.toString() ?? "");
  const [position, setPosition] = useState(player.position ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(initialCategoryIds);
  const [role, setRole] = useState<UserRole>(player.role);
  const [active, setActive] = useState(player.active);
  const [saving, setSaving] = useState(false);

  function toggleCategory(categoryId: string) {
    setCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  }

  async function save() {
    setSaving(true);
    const payload: Record<string, unknown> = {
      jersey_number: jerseyNumber === "" ? null : Number(jerseyNumber),
      position: position.trim() || null,
      active,
    };
    if (canEditRole) payload.role = role;

    const { error } = await supabase.from("profiles").update(payload).eq("id", player.id);
    if (error) {
      setSaving(false);
      toast.error("No se pudo actualizar el jugador", { description: error.message });
      return;
    }

    const toRemove = initialCategoryIds.filter((id) => !categoryIds.includes(id));
    const toAdd = categoryIds.filter((id) => !initialCategoryIds.includes(id));

    if (toRemove.length > 0) {
      await supabase
        .from("player_categories")
        .delete()
        .eq("player_id", player.id)
        .in("category_id", toRemove);
    }
    if (toAdd.length > 0) {
      await supabase
        .from("player_categories")
        .insert(toAdd.map((category_id) => ({ player_id: player.id, category_id })));
    }

    setSaving(false);
    setOpen(false);
    toast.success("Jugador actualizado");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{player.full_name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Dorsal</Label>
            <Input
              type="number"
              min={0}
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Posición</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Categorías</Label>
            <CategoryCheckboxList
              categories={categories}
              selected={categoryIds}
              onToggle={toggleCategory}
            />
          </div>
          {canEditRole && (
            <div className="flex flex-col gap-1.5">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => v && setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue>{(v: UserRole) => ROLE_LABEL[v]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">Jugador</SelectItem>
                  <SelectItem value="coach">Cuerpo técnico</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <Label htmlFor="active">Activo en el plantel</Label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
