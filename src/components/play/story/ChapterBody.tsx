import { ChapterAudioButton } from './ChapterAudioButton';

interface ChapterBodyProps {
  bodyZh: string;
  bodyEn: string;
}

export function ChapterBody({ bodyZh, bodyEn }: ChapterBodyProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-amber-50/80 px-5 py-4 shadow-inner">
        <p className="text-2xl leading-relaxed text-amber-900">{bodyZh}</p>
        <div className="mt-3">
          <ChapterAudioButton text={bodyZh} />
        </div>
      </div>
      <div className="rounded-2xl bg-white/70 px-5 py-4">
        <p className="text-base leading-relaxed text-stone-700">{bodyEn}</p>
      </div>
    </div>
  );
}
