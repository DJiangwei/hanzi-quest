/**
 * Returns the ISO date string (YYYY-MM-DD) of the Monday that starts the
 * UTC ISO week containing `iso`. Sunday rolls BACK to Monday (not forward).
 *
 * Used by:
 *  - `WeekStrip` activity range (existing).
 *  - PR #52 `pullCardForChild` weekly cap counter.
 */
export function mondayOfIsoWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const back = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}
