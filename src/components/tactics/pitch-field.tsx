"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TacticToken } from "@/types/database";

const LINE = "var(--field-line)";

function PitchMarkings() {
  return (
    <svg
      viewBox="-2 -2 109 72"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <g fill="none" stroke={LINE} strokeWidth="0.4">
        {/* Perímetro */}
        <rect x="0" y="0" width="105" height="68" />
        {/* Línea media + círculo central */}
        <line x1="52.5" y1="0" x2="52.5" y2="68" />
        <circle cx="52.5" cy="34" r="9.15" />
        <circle cx="52.5" cy="34" r="0.5" fill={LINE} stroke="none" />
        {/* Área y área chica - izquierda */}
        <rect x="0" y="13.84" width="16.5" height="40.32" />
        <rect x="0" y="24.84" width="5.5" height="18.32" />
        <circle cx="11" cy="34" r="0.5" fill={LINE} stroke="none" />
        {/* Área y área chica - derecha */}
        <rect x="88.5" y="13.84" width="16.5" height="40.32" />
        <rect x="99.5" y="24.84" width="5.5" height="18.32" />
        <circle cx="94" cy="34" r="0.5" fill={LINE} stroke="none" />
        {/* Arcos de córner */}
        <path d="M 0,1.5 A 1.5,1.5 0 0 0 1.5,0" />
        <path d="M 103.5,0 A 1.5,1.5 0 0 0 105,1.5" />
        <path d="M 105,66.5 A 1.5,1.5 0 0 0 103.5,68" />
        <path d="M 1.5,68 A 1.5,1.5 0 0 0 0,66.5" />
      </g>
    </svg>
  );
}

const TOKEN_STYLE: Record<TacticToken["kind"], string> = {
  own: "bg-primary text-primary-foreground border-white/80",
  rival: "bg-card-red text-card-red-foreground border-white/80",
  ball: "bg-card-yellow text-card-yellow-foreground border-black/30",
};

const TOKEN_SIZE: Record<TacticToken["kind"], string> = {
  own: "size-8 text-xs sm:size-9 sm:text-sm",
  rival: "size-8 text-xs sm:size-9 sm:text-sm",
  ball: "size-4 sm:size-5",
};

export function PitchField({
  tokens,
  editable = false,
  selectedTokenId = null,
  transitionMs,
  onSelectToken,
  onMoveToken,
}: {
  tokens: TacticToken[];
  editable?: boolean;
  selectedTokenId?: string | null;
  transitionMs?: number;
  onSelectToken?: (id: string | null) => void;
  onMoveToken?: (id: string, x: number, y: number) => void;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function positionFromEvent(e: { clientX: number; clientY: number }) {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>, tokenId: string) {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(tokenId);
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelectToken?.(tokenId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!editable || draggingId === null) return;
    const pos = positionFromEvent(e);
    if (!pos) return;
    onMoveToken?.(draggingId, pos.x, pos.y);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (draggingId !== null) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDraggingId(null);
  }

  return (
    <div
      ref={fieldRef}
      onClick={() => editable && onSelectToken?.(null)}
      className="relative aspect-[105/68] w-full touch-none overflow-hidden rounded-xl border bg-field shadow-card select-none"
    >
      <PitchMarkings />
      {tokens.map((token) => (
        <button
          key={token.id}
          type="button"
          onPointerDown={(e) => handlePointerDown(e, token.id)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={(e) => e.stopPropagation()}
          style={{
            left: `${token.x}%`,
            top: `${token.y}%`,
            transition:
              draggingId === token.id
                ? "none"
                : `left ${transitionMs ?? 150}ms ease, top ${transitionMs ?? 150}ms ease`,
          }}
          className={cn(
            "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 font-mono font-semibold shadow-card outline-none",
            editable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
            TOKEN_STYLE[token.kind],
            TOKEN_SIZE[token.kind],
            selectedTokenId === token.id && "ring-2 ring-foreground ring-offset-2 ring-offset-field"
          )}
          aria-label={
            token.kind === "ball" ? "Balón" : `${token.kind === "own" ? "Jugador" : "Rival"} ${token.label}`
          }
        >
          {token.kind !== "ball" && token.label}
        </button>
      ))}
    </div>
  );
}
