/** A granted card with everything the reveal UI needs (emoji resolved client-side). */
export interface RevealCard {
  id: string;
  slug: string;
  packSlug: string;
  nameZh: string;
  nameEn: string;
  loreZh: string | null;
  loreEn: string | null;
  isDupe: boolean;
  shardsAfter: number;
}
