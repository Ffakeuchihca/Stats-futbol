-- ============================================================================
-- Nuevo estado de asistencia: "lesionado". No dispara multa (el trigger
-- sync_attendance_fines de la migración 0006 solo actúa sobre 'tarde' y
-- 'ausente'; cualquier otro valor cae en el else y no genera cargo).
-- ============================================================================

alter type public.attendance_status add value 'lesionado';
