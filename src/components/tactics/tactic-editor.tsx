"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CategoryCheckboxList } from "@/components/roster/category-checkbox-list";
import { PitchField } from "@/components/tactics/pitch-field";
import { TacticPlayer } from "@/components/tactics/tactic-player";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, X, User, ShieldAlert, Circle, Copy } from "lucide-react";
import type { Category, Tactic, TacticFrame, TacticToken } from "@/types/database";

interface EditableFrame {
  key: string;
  label: string;
  duration_ms: number;
  tokens: TacticToken[];
}

function cloneTokens(tokens: TacticToken[]): TacticToken[] {
  return tokens.map((t) => ({ ...t }));
}

function makeDefaultFrame(): EditableFrame {
  return { key: crypto.randomUUID(), label: "", duration_ms: 1200, tokens: [] };
}

export function TacticEditor({
  tactic,
  initialFrames,
  categories,
  initialCategoryIds,
}: {
  tactic: Tactic | null;
  initialFrames: TacticFrame[];
  categories: Category[];
  initialCategoryIds: string[];
}) {
  const supabase = createClient();
  const router = useRouter();

  const [title, setTitle] = useState(tactic?.title ?? "");
  const [notes, setNotes] = useState(tactic?.notes ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(initialCategoryIds);
  const [frames, setFrames] = useState<EditableFrame[]>(() =>
    initialFrames.length > 0
      ? initialFrames
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((f) => ({
            key: f.id,
            label: f.label ?? "",
            duration_ms: f.duration_ms,
            tokens: cloneTokens(f.tokens),
          }))
      : [makeDefaultFrame()]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [mode, setMode] = useState<"editar" | "reproducir">("editar");

  const activeFrame = frames[activeIndex];
  const selectedToken = activeFrame?.tokens.find((t) => t.id === selectedTokenId) ?? null;

  function updateActiveFrame(mutator: (frame: EditableFrame) => EditableFrame) {
    setFrames((prev) => prev.map((f, i) => (i === activeIndex ? mutator(f) : f)));
  }

  function toggleCategory(categoryId: string) {
    setCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  }

  function addToken(kind: TacticToken["kind"]) {
    if (kind === "ball" && activeFrame.tokens.some((t) => t.kind === "ball")) {
      setSelectedTokenId(activeFrame.tokens.find((t) => t.kind === "ball")!.id);
      return;
    }
    const sameKindCount = activeFrame.tokens.filter((t) => t.kind === kind).length;
    const id = crypto.randomUUID();
    const token: TacticToken =
      kind === "ball"
        ? { id, kind, label: "Balón", x: 50, y: 50 }
        : {
            id,
            kind,
            label: String(sameKindCount + 1),
            x: kind === "own" ? 20 + (sameKindCount % 5) * 3 : 80 - (sameKindCount % 5) * 3,
            y: 15 + (sameKindCount % 6) * 10,
          };
    updateActiveFrame((f) => ({ ...f, tokens: [...f.tokens, token] }));
    setSelectedTokenId(id);
  }

  function moveToken(id: string, x: number, y: number) {
    updateActiveFrame((f) => ({
      ...f,
      tokens: f.tokens.map((t) => (t.id === id ? { ...t, x, y } : t)),
    }));
  }

  function renameSelectedToken(label: string) {
    if (!selectedTokenId) return;
    updateActiveFrame((f) => ({
      ...f,
      tokens: f.tokens.map((t) => (t.id === selectedTokenId ? { ...t, label } : t)),
    }));
  }

  function removeSelectedToken() {
    if (!selectedTokenId) return;
    updateActiveFrame((f) => ({ ...f, tokens: f.tokens.filter((t) => t.id !== selectedTokenId) }));
    setSelectedTokenId(null);
  }

  function addFrame() {
    setFrames((prev) => [
      ...prev,
      { key: crypto.randomUUID(), label: "", duration_ms: 1200, tokens: cloneTokens(activeFrame.tokens) },
    ]);
    setSelectedTokenId(null);
    setActiveIndex(frames.length);
  }

  function removeFrame(index: number) {
    if (frames.length <= 1) return;
    setFrames((prev) => prev.filter((_, i) => i !== index));
    setSelectedTokenId(null);
    setActiveIndex((prev) => Math.min(prev, frames.length - 2));
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Ponele un título a la táctica");
      return;
    }
    if (categoryIds.length === 0) {
      toast.error("Elegí al menos una categoría");
      return;
    }

    setSubmitting(true);

    let tacticId = tactic?.id;
    if (tactic) {
      const { error } = await supabase
        .from("tactics")
        .update({ title: title.trim(), notes: notes.trim() || null, updated_at: new Date().toISOString() })
        .eq("id", tactic.id);
      if (error) {
        setSubmitting(false);
        toast.error("No se pudo guardar la táctica", { description: error.message });
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("tactics")
        .insert({ title: title.trim(), notes: notes.trim() || null })
        .select("id")
        .single();
      if (error || !data) {
        setSubmitting(false);
        toast.error("No se pudo crear la táctica", { description: error?.message });
        return;
      }
      tacticId = data.id;
    }

    await supabase.from("tactic_categories").delete().eq("tactic_id", tacticId);
    await supabase
      .from("tactic_categories")
      .insert(categoryIds.map((category_id) => ({ tactic_id: tacticId, category_id })));

    await supabase.from("tactic_frames").delete().eq("tactic_id", tacticId);
    const { error: framesError } = await supabase.from("tactic_frames").insert(
      frames.map((f, i) => ({
        tactic_id: tacticId,
        position: i,
        label: f.label.trim() || null,
        duration_ms: f.duration_ms,
        tokens: f.tokens,
      }))
    );

    setSubmitting(false);

    if (framesError) {
      toast.error("No se pudieron guardar los pasos", { description: framesError.message });
      return;
    }

    toast.success(tactic ? "Táctica actualizada" : "Táctica creada");
    if (!tactic) {
      router.push(`/tactica/${tacticId}`);
    } else {
      router.refresh();
    }
  }

  async function handleDuplicate() {
    if (!title.trim()) {
      toast.error("Ponele un título a la táctica antes de duplicarla");
      return;
    }
    if (categoryIds.length === 0) {
      toast.error("Elegí al menos una categoría antes de duplicarla");
      return;
    }

    setDuplicating(true);

    const { data, error } = await supabase
      .from("tactics")
      .insert({ title: `${title.trim()} (copia)`, notes: notes.trim() || null })
      .select("id")
      .single();

    if (error || !data) {
      setDuplicating(false);
      toast.error("No se pudo duplicar la táctica", { description: error?.message });
      return;
    }

    const newTacticId = data.id;

    await supabase
      .from("tactic_categories")
      .insert(categoryIds.map((category_id) => ({ tactic_id: newTacticId, category_id })));

    const { error: framesError } = await supabase.from("tactic_frames").insert(
      frames.map((f, i) => ({
        tactic_id: newTacticId,
        position: i,
        label: f.label.trim() || null,
        duration_ms: f.duration_ms,
        tokens: f.tokens,
      }))
    );

    setDuplicating(false);

    if (framesError) {
      toast.error("No se pudieron copiar los pasos", { description: framesError.message });
      return;
    }

    toast.success("Táctica duplicada, ahora podés editar la copia");
    router.push(`/tactica/${newTacticId}`);
  }

  async function handleDelete() {
    if (!tactic) return;
    if (!window.confirm("¿Eliminar esta táctica? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("tactics").delete().eq("id", tactic.id);
    if (error) {
      toast.error("No se pudo eliminar la táctica", { description: error.message });
      return;
    }
    toast.success("Táctica eliminada");
    router.push("/tactica");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tactic-title">Título</Label>
            <Input
              id="tactic-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Salida en corto vs presión alta"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Categorías</Label>
            <CategoryCheckboxList categories={categories} selected={categoryIds} onToggle={toggleCategory} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tactic-notes">Notas (opcional)</Label>
            <Textarea
              id="tactic-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Instrucciones o contexto para el jugador..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Cancha</CardTitle>
          <div className="flex overflow-hidden rounded-lg border">
            <button
              type="button"
              onClick={() => setMode("editar")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium outline-none transition-colors",
                mode === "editar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedTokenId(null);
                setMode("reproducir");
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium outline-none transition-colors",
                mode === "reproducir"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              Reproducir
            </button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {mode === "reproducir" ? (
            <TacticPlayer frames={frames} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => addToken("own")}>
                  <User className="size-4" />
                  Jugador
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addToken("rival")}>
                  <ShieldAlert className="size-4" />
                  Rival
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addToken("ball")}>
                  <Circle className="size-4" />
                  Balón
                </Button>
              </div>

              {selectedToken && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-2">
                  <span className="text-xs text-muted-foreground">
                    {selectedToken.kind === "ball"
                      ? "Balón seleccionado"
                      : selectedToken.kind === "own"
                      ? "Jugador seleccionado"
                      : "Rival seleccionado"}
                  </span>
                  {selectedToken.kind !== "ball" && (
                    <Input
                      value={selectedToken.label}
                      onChange={(e) => renameSelectedToken(e.target.value)}
                      className="h-8 w-16"
                      maxLength={3}
                    />
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={removeSelectedToken}>
                    <X className="size-4" />
                    Quitar
                  </Button>
                </div>
              )}

              <PitchField
                tokens={activeFrame?.tokens ?? []}
                editable
                selectedTokenId={selectedTokenId}
                onSelectToken={setSelectedTokenId}
                onMoveToken={moveToken}
              />

              <p className="text-xs text-muted-foreground">
                Arrastrá las fichas para ubicarlas. Los cambios se guardan en el paso seleccionado abajo.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {mode === "editar" && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pasos del movimiento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {frames.map((f, i) => (
              <div key={f.key} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveIndex(i);
                    setSelectedTokenId(null);
                  }}
                  className={cn(
                    "rounded-l-lg border px-3 py-1.5 text-xs font-medium outline-none transition-colors",
                    i === activeIndex
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted",
                    frames.length === 1 && "rounded-r-lg"
                  )}
                >
                  Paso {i + 1}
                </button>
                {frames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFrame(i)}
                    className="rounded-r-lg border border-l-0 px-1.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label={`Eliminar paso ${i + 1}`}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addFrame}>
              <Plus className="size-4" />
              Agregar paso
            </Button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="frame-label">Nombre del paso (opcional)</Label>
              <Input
                id="frame-label"
                value={activeFrame?.label ?? ""}
                onChange={(e) => updateActiveFrame((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ej: Saque de banda"
                className="w-full sm:w-56"
              />
            </div>
            {activeIndex > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="frame-duration">Duración desde el paso anterior (ms)</Label>
                <Input
                  id="frame-duration"
                  type="number"
                  min={200}
                  step={100}
                  value={activeFrame?.duration_ms ?? 1200}
                  onChange={(e) =>
                    updateActiveFrame((f) => ({ ...f, duration_ms: Number(e.target.value) || 1200 }))
                  }
                  className="w-full sm:w-40"
                />
              </div>
            )}
            {activeIndex === 0 && (
              <Badge variant="secondary">Este es el punto de partida del movimiento</Badge>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {tactic ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={handleDuplicate} disabled={duplicating}>
              <Copy className="size-4" />
              Duplicar
            </Button>
            <Button type="button" variant="ghost" className="text-destructive" onClick={handleDelete}>
              Eliminar táctica
            </Button>
          </div>
        ) : (
          <span />
        )}
        <Button onClick={handleSave} disabled={submitting}>
          Guardar táctica
        </Button>
      </div>
    </div>
  );
}
