'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteHomeworkItemAction, reorderHomeworkItemsAction } from '@/lib/actions/homework';
import { CharQuizForm } from '@/components/parent/homework/CharQuizForm';
import { WordBuildingForm } from '@/components/parent/homework/WordBuildingForm';
import { SentenceOrderForm } from '@/components/parent/homework/SentenceOrderForm';

type HomeworkType = 'char_quiz' | 'word_building' | 'sentence_order';

interface HomeworkItem {
  id: string;
  type: HomeworkType;
  summary: string;
}

interface Props {
  childId: string;
  weekId: string;
  items: HomeworkItem[];
}

const TYPE_LABELS: Record<HomeworkType, string> = {
  char_quiz: 'char_quiz',
  word_building: 'word_building',
  sentence_order: 'sentence_order',
};

export function HomeworkEditor({ childId, weekId, items }: Props) {
  const router = useRouter();
  const [localItems, setLocalItems] = useState<HomeworkItem[]>(items);
  const [addType, setAddType] = useState<HomeworkType | null>(null);
  const [actionError, setActionError] = useState('');
  const [isPending, startTransition] = useTransition();

  async function handleDelete(id: string) {
    setActionError('');
    startTransition(async () => {
      try {
        await deleteHomeworkItemAction(childId, weekId, id);
        setLocalItems((prev) => prev.filter((item) => item.id !== id));
        router.refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Delete failed');
      }
    });
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    setActionError('');
    const newItems = [...localItems];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    const orderedIds = newItems.map((item) => item.id);
    setLocalItems(newItems);
    startTransition(async () => {
      try {
        await reorderHomeworkItemsAction(childId, weekId, orderedIds);
        router.refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Reorder failed');
        setLocalItems(localItems); // revert
      }
    });
  }

  async function handleMoveDown(index: number) {
    if (index === localItems.length - 1) return;
    setActionError('');
    const newItems = [...localItems];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    const orderedIds = newItems.map((item) => item.id);
    setLocalItems(newItems);
    startTransition(async () => {
      try {
        await reorderHomeworkItemsAction(childId, weekId, orderedIds);
        router.refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Reorder failed');
        setLocalItems(localItems); // revert
      }
    });
  }

  function handleSaved() {
    setAddType(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Homework / 作业</h2>

      {actionError && <p className="text-red-600 text-sm">{actionError}</p>}

      {localItems.length === 0 && (
        <p className="text-sm text-gray-500">No homework items yet.</p>
      )}

      <ul className="space-y-2">
        {localItems.map((item, i) => (
          <li
            key={item.id}
            className="flex items-center gap-2 border rounded px-3 py-2 bg-white"
          >
            <span className="text-xs bg-gray-100 border rounded px-1 py-0.5 font-mono shrink-0">
              {TYPE_LABELS[item.type]}
            </span>
            <span className="flex-1 text-sm truncate">{item.summary}</span>
            <button
              type="button"
              onClick={() => handleMoveUp(i)}
              disabled={i === 0 || isPending}
              aria-label="Move up"
              className="text-sm px-1 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => handleMoveDown(i)}
              disabled={i === localItems.length - 1 || isPending}
              aria-label="Move down"
              className="text-sm px-1 disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              disabled={isPending}
              aria-label={`Delete item ${item.id}`}
              className="text-sm text-red-600 disabled:opacity-50"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      <div className="border-t pt-4">
        <p className="text-sm font-medium mb-2">Add item</p>
        {addType === null ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAddType('char_quiz')}
              className="text-sm border rounded px-3 py-1 hover:bg-gray-50"
            >
              + Char Quiz
            </button>
            <button
              type="button"
              onClick={() => setAddType('word_building')}
              className="text-sm border rounded px-3 py-1 hover:bg-gray-50"
            >
              + Word Building
            </button>
            <button
              type="button"
              onClick={() => setAddType('sentence_order')}
              className="text-sm border rounded px-3 py-1 hover:bg-gray-50"
            >
              + Sentence Order
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium capitalize">
                {addType.replace(/_/g, ' ')}
              </span>
              <button
                type="button"
                onClick={() => setAddType(null)}
                className="text-xs text-gray-500 underline"
              >
                Cancel
              </button>
            </div>
            {addType === 'char_quiz' && (
              <CharQuizForm childId={childId} weekId={weekId} onSaved={handleSaved} />
            )}
            {addType === 'word_building' && (
              <WordBuildingForm childId={childId} weekId={weekId} onSaved={handleSaved} />
            )}
            {addType === 'sentence_order' && (
              <SentenceOrderForm childId={childId} weekId={weekId} onSaved={handleSaved} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
