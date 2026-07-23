// Costa Rica is UTC-6 year-round (no DST). Training days roll over at
// noon (mediodía) local time instead of midnight, so a session that runs
// late into the night doesn't flip to "tomorrow" while it's still going,
// and the next day's session is already up by the time coaches check in
// at lunchtime.
const CR_UTC_OFFSET_HOURS = 6;
const CUTOVER_HOUR = 12;

export function costaRicaTrainingDate(reference: Date = new Date()): string {
  const shifted = new Date(
    reference.getTime() - (CR_UTC_OFFSET_HOURS + CUTOVER_HOUR) * 60 * 60 * 1000
  );
  return shifted.toISOString().slice(0, 10);
}

// Window used to bulk-generate the automatic Mon-Fri trainings: the whole
// current month plus the whole next month, so the calendar always shows a
// full month of history and a full month ahead.
export function trainingGenerationWindow(reference: string = costaRicaTrainingDate()): {
  start: string;
  end: string;
} {
  const [year, month] = reference.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
