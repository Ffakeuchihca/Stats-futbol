import { NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlignmentType,
  Document,
  Header,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isCoachRole } from "@/lib/supabase/profile";
import { getActiveCategoryId } from "@/lib/active-category";
import type { Match, MatchStat, PlayerSeasonStats, Profile } from "@/types/database";

const HEADER_FILL = "132349";

function headerCell(text: string, alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER) {
  return new TableCell({
    shading: { fill: HEADER_FILL },
    children: [
      new Paragraph({
        alignment,
        children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 16 })],
      }),
    ],
  });
}

function cell(text: string, alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER) {
  return new TableCell({
    children: [new Paragraph({ alignment, children: [new TextRun({ text, size: 18 })] })],
  });
}

export async function GET() {
  const { profile } = await getCurrentProfile();
  if (!isCoachRole(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const activeCategoryId = await getActiveCategoryId();

  const { data: category } = activeCategoryId
    ? await supabase.from("categories").select("name").eq("id", activeCategoryId).maybeSingle()
    : { data: null };
  const categoryName = category?.name ?? "Todas las categorías";

  const playersQuery = supabase
    .from("profiles")
    .select("*, player_categories!inner(category_id)")
    .eq("role", "player")
    .order("full_name");

  const matchesQuery = supabase
    .from("matches")
    .select("*, match_categories!inner(category_id)")
    .order("date", { ascending: false });

  const [{ data: players }, { data: stats }, { data: matches }] = await Promise.all([
    activeCategoryId
      ? playersQuery.eq("player_categories.category_id", activeCategoryId)
      : supabase.from("profiles").select("*").eq("role", "player").order("full_name"),
    supabase.from("player_season_stats").select("*"),
    activeCategoryId
      ? matchesQuery.eq("match_categories.category_id", activeCategoryId)
      : supabase.from("matches").select("*").order("date", { ascending: false }),
  ]);

  const playerList = (players ?? []) as unknown as Profile[];
  const statsByPlayer = new Map(
    ((stats ?? []) as PlayerSeasonStats[]).map((s) => [s.player_id, s])
  );
  const matchList = (matches ?? []) as unknown as Match[];

  const matchIds = matchList.map((m) => m.id);
  const { data: matchStats } =
    matchIds.length > 0
      ? await supabase.from("match_stats").select("*").in("match_id", matchIds)
      : { data: [] as MatchStat[] };
  const matchStatsByMatch = new Map<string, MatchStat[]>();
  for (const ms of (matchStats ?? []) as MatchStat[]) {
    const list = matchStatsByMatch.get(ms.match_id) ?? [];
    list.push(ms);
    matchStatsByMatch.set(ms.match_id, list);
  }
  const playerNameById = new Map(playerList.map((p) => [p.id, p.full_name]));

  const generatedAt = format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es });

  const generalTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell("Jugador", AlignmentType.LEFT),
          headerCell("Conv."),
          headerCell("Tit."),
          headerCell("Sup."),
          headerCell("Min."),
          headerCell("Goles"),
          headerCell("Asist."),
          headerCell("TA"),
          headerCell("TR"),
          headerCell("Autoeval."),
        ],
      }),
      ...playerList.map((p) => {
        const s = statsByPlayer.get(p.id);
        return new TableRow({
          children: [
            cell(p.full_name, AlignmentType.LEFT),
            cell(String(s?.partidos_convocado ?? 0)),
            cell(String(s?.partidos_titular ?? 0)),
            cell(String(s?.partidos_suplente ?? 0)),
            cell(String(s?.minutos_totales ?? 0)),
            cell(String(s?.goles_totales ?? 0)),
            cell(String(s?.asistencias_totales ?? 0)),
            cell(String(s?.amarillas_totales ?? 0)),
            cell(String(s?.rojas_totales ?? 0)),
            cell(s?.autoevaluacion_promedio != null ? String(s.autoevaluacion_promedio) : "-"),
          ],
        });
      }),
    ],
  });

  const matchSections = matchList.flatMap((match) => {
    const rows = (matchStatsByMatch.get(match.id) ?? [])
      .filter((ms) => ms.convocado)
      .slice()
      .sort((a, b) =>
        (playerNameById.get(a.player_id) ?? "").localeCompare(playerNameById.get(b.player_id) ?? "")
      );

    const played = match.our_score !== null && match.opponent_score !== null;
    const scoreText = played ? ` (${match.our_score} - ${match.opponent_score})` : "";
    const heading = new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 280, after: 120 },
      children: [
        new TextRun({
          text: `vs ${match.opponent}${scoreText} — ${format(parseISO(match.date), "d 'de' MMMM yyyy", { locale: es })}`,
        }),
      ],
    });

    if (rows.length === 0) {
      return [
        heading,
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({ text: "Sin estadísticas cargadas para este partido.", italics: true, size: 18 }),
          ],
        }),
      ];
    }

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            headerCell("Jugador", AlignmentType.LEFT),
            headerCell("Condición"),
            headerCell("Min."),
            headerCell("Goles"),
            headerCell("Asist."),
            headerCell("TA"),
            headerCell("TR"),
          ],
        }),
        ...rows.map((ms) => {
          const condicion = ms.titular ? "Titular" : ms.suplente ? "Suplente" : "-";
          return new TableRow({
            children: [
              cell(playerNameById.get(ms.player_id) ?? "-", AlignmentType.LEFT),
              cell(condicion),
              cell(String(ms.minutos_jugados)),
              cell(String(ms.goles)),
              cell(String(ms.asistencias)),
              cell(String(ms.tarjetas_amarillas)),
              cell(String(ms.tarjetas_rojas)),
            ],
          });
        }),
      ],
    });

    return [heading, table];
  });

  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: "Stats Cartaginés", size: 16, color: "666666" })],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "Reporte de estadísticas" })],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: categoryName, bold: true, size: 22 })],
          }),
          new Paragraph({
            spacing: { after: 280 },
            children: [
              new TextRun({ text: `Generado el ${generatedAt}`, italics: true, size: 18, color: "666666" }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 160 },
            children: [new TextRun({ text: "Estadísticas generales de plantel" })],
          }),
          generalTable,
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 80 },
            children: [new TextRun({ text: "Estadísticas por partido" })],
          }),
          ...(matchSections.length > 0
            ? matchSections
            : [
                new Paragraph({
                  children: [new TextRun({ text: "Todavía no hay partidos cargados.", italics: true })],
                }),
              ]),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const fileName = `reporte-${categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
