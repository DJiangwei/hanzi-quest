import { AvatarRender } from '@/components/play/AvatarRender';
import { PetCompanion } from '@/components/play/PetCompanion';
import type { AvatarSlotId } from '@/lib/avatar/defaultLook';
import type { StoryTone } from '@/lib/db/story';

interface ChapterPet {
  emoji: string;
  nameZh: string;
  nameEn: string;
  speechZh: string[];
  speechEn: string[];
}

interface ChapterCardProps {
  equippedAvatar?: Partial<Record<AvatarSlotId, string | null | undefined>>;
  pet: ChapterPet | null;
  chapterNumber: number;
  tone: StoryTone;
}

const TONE_BORDER: Record<StoryTone, string> = {
  triumphant: 'border-4 border-amber-400 shadow-lg shadow-amber-300/40',
  standard: 'border-2 border-stone-300',
  narrow_escape: 'border-2 border-dashed border-stone-400 opacity-95',
};

export function ChapterCard({
  equippedAvatar,
  pet,
  chapterNumber,
  tone,
}: ChapterCardProps) {
  return (
    <div
      className={`relative flex flex-col items-center gap-3 rounded-3xl bg-amber-50 px-6 py-6 ${TONE_BORDER[tone]}`}
    >
      <div className="flex items-end gap-2">
        <AvatarRender equipped={equippedAvatar} size={128} />
        {pet ? <PetCompanion pet={pet} size={64} /> : null}
      </div>
      <h2 className="text-xl font-bold tracking-wide text-amber-900">
        ✨ 第{chapterNumber}章 / Chapter {chapterNumber} ✨
      </h2>
    </div>
  );
}
