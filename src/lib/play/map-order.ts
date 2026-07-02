/** Linear map order from the slug convention `pirate-class-level-N`. Maps
 *  without a parseable level sort last (sentinel) and are never gated. */
export function mapOrderIndex(slug: string): number {
  const m = /-level-(\d+)$/.exec(slug);
  return m ? parseInt(m[1], 10) : 100000;
}
