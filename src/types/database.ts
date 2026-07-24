export type UserRole = "player" | "coach" | "admin";
export type AttendanceStatus = "presente" | "tarde" | "ausente" | "lesionado";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  jersey_number: number | null;
  position: string | null;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Training {
  id: string;
  date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  training_id: string;
  player_id: string;
  status: AttendanceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FineType {
  id: string;
  code: string;
  name: string;
  amount: number;
}

export interface Fine {
  id: string;
  player_id: string;
  fine_type_id: string;
  date: string;
  training_id: string | null;
  paid: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  date: string;
  opponent: string;
  location: string | null;
  our_score: number | null;
  opponent_score: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface MatchStat {
  id: string;
  match_id: string;
  player_id: string;
  convocado: boolean;
  titular: boolean;
  suplente: boolean;
  minutos_jugados: number;
  goles: number;
  asistencias: number;
  tarjetas_amarillas: number;
  tarjetas_rojas: number;
  created_at: string;
  updated_at: string;
}

export interface SelfEvaluation {
  id: string;
  match_id: string;
  player_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpponentScouting {
  id: string;
  match_id: string;
  system_of_play: string | null;
  strengths: string | null;
  weaknesses: string | null;
  notes: string | null;
  created_by: string | null;
  updated_at: string;
}

export interface PlayerSeasonStats {
  player_id: string;
  full_name: string;
  partidos_convocado: number;
  partidos_titular: number;
  partidos_suplente: number;
  minutos_totales: number;
  goles_totales: number;
  asistencias_totales: number;
  amarillas_totales: number;
  rojas_totales: number;
  autoevaluacion_promedio: number | null;
}

export interface PlayerFinesSummary {
  player_id: string;
  full_name: string;
  code: string | null;
  fine_name: string | null;
  cantidad: number;
  total_adeudado: number;
  total_pagado: number;
  total_pendiente: number;
}
