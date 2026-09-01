// The manual (parent-typed) ledger sources. Client-safe — NO db imports.
//
// Single source of truth for "which sources can a parent type directly, and
// therefore delete." Before this module existed, the same three-item list
// was hand-copied in THREE places (ManualEntryInput['source'], the SQL
// inArray in deleteManualEntry, and the panel's own delete-button gate) and
// could silently diverge — a fourth manual source added later would show a
// delete button the database refuses to honour, or vice versa.

export const PIGGY_MANUAL_SOURCES = [
  'parent_credit',
  'purchase',
  'reconcile',
] as const;

export type PiggyManualSource = (typeof PIGGY_MANUAL_SOURCES)[number];

export function isPiggyManualSource(value: string): value is PiggyManualSource {
  return (PIGGY_MANUAL_SOURCES as readonly string[]).includes(value);
}
