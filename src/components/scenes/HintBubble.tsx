'use client';

/**
 * Picture-scene hint: an English description of what's in the picture,
 * revealed by the free 💡 practice hint (2026-07-11 spec). The description
 * text is AI-generated content (the image's own generation hook) — exempt
 * from the bilingual-chrome rule; the label is bilingual.
 */
export function HintBubble({ text }: { text: string }) {
  return (
    <div
      data-testid="hint-bubble"
      className="mt-2 max-w-72 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-center text-sm text-amber-900 shadow-sm"
    >
      <span className="font-semibold">💡 提示 / Hint: </span>
      <span className="italic">{text}</span>
    </div>
  );
}
