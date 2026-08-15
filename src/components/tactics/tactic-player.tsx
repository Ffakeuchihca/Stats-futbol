"use client";

import { useEffect, useState } from "react";
import { PitchField } from "@/components/tactics/pitch-field";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TacticToken } from "@/types/database";

interface PlayableFrame {
  tokens: TacticToken[];
  duration_ms: number;
  label?: string | null;
}

export function TacticPlayer({ frames }: { frames: PlayableFrame[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const finished = index >= frames.length - 1;

  useEffect(() => {
    if (!playing || finished) return;
    const nextDuration = frames[index + 1]?.duration_ms ?? 1200;
    const t = setTimeout(() => {
      setIndex((i) => Math.min(i + 1, frames.length - 1));
    }, nextDuration);
    return () => clearTimeout(t);
  }, [playing, finished, index, frames]);

  function togglePlay() {
    if (finished) {
      setIndex(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  }

  function restart() {
    setPlaying(false);
    setIndex(0);
  }

  function goTo(i: number) {
    setPlaying(false);
    setIndex(Math.min(Math.max(i, 0), frames.length - 1));
  }

  const currentFrame = frames[index];

  return (
    <div className="flex flex-col gap-3">
      <PitchField
        tokens={currentFrame?.tokens ?? []}
        editable={false}
        transitionMs={currentFrame?.duration_ms ?? 800}
      />

      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => goTo(index - 1)} disabled={index === 0}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button size="sm" onClick={togglePlay}>
            {playing && !finished ? <Pause className="size-4" /> : <Play className="size-4" />}
            {finished ? "Repetir" : playing ? "Pausar" : "Reproducir"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goTo(index + 1)}
            disabled={index >= frames.length - 1}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={restart} title="Reiniciar">
            <RotateCcw className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            Paso {index + 1}/{frames.length}
            {currentFrame?.label ? ` · ${currentFrame.label}` : ""}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {frames.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir al paso ${i + 1}`}
                onClick={() => goTo(i)}
                className={cn(
                  "size-2 rounded-full transition-colors",
                  i === index ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
