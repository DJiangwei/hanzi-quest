'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  buildInitialBoard,
  findOneValidPair,
  findPath,
  hasValidPair,
  shuffleRemaining,
  clearTiles,
  isAllCleared,
  type Cell,
  type LianliankanBoard,
} from '@/lib/scenes/lianliankan';
import { playSound } from '@/lib/audio/play';
import { LianliankanLine } from './fx/LianliankanLine';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  meaningEn: string;
}

interface Props {
  chars: CharacterDetail[];
  onComplete: (correct: boolean) => void;
  hintRequested?: boolean;
}

const CELL_PX = 64;

export function LianliankanScene({ chars, onComplete, hintRequested }: Props) {
  const initialBoard = useMemo(
    () =>
      buildInitialBoard(
        chars.map((c) => ({ id: c.characterId, hanzi: c.hanzi, meaningEn: c.meaningEn })),
        Math.random,
      ),
    [chars],
  );
  const [board, setBoard] = useState<LianliankanBoard>(initialBoard);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [lastPath, setLastPath] = useState<Cell[] | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const hintPair = useMemo(
    () => (hintRequested ? findOneValidPair(board) : null),
    [hintRequested, board],
  );

  useEffect(() => {
    if (isAllCleared(board)) return;
    if (!hasValidPair(board)) {
      setBoard((b) => shuffleRemaining(b, Math.random));
    }
  }, [board]);

  const onTileTap = (row: number, col: number) => {
    const cell = board.cells[row]?.[col];
    if (!cell || cell.kind !== 'tile') return;
    if (selected && selected.row === row && selected.col === col) {
      setSelected(null);
      return;
    }
    if (!selected) {
      setSelected({ row, col });
      return;
    }

    const sel = board.cells[selected.row]?.[selected.col];
    if (!sel || sel.kind !== 'tile') {
      setSelected({ row, col });
      return;
    }

    if (sel.pairId !== cell.pairId) {
      playSound('buzz');
      setShakeKey((k) => k + 1);
      setSelected(null);
      return;
    }

    const path = findPath(board, selected, { row, col });
    if (path === null) {
      // Matching pair exists but path is blocked — reshuffle instead of penalising the player.
      setBoard((b) => shuffleRemaining(b, Math.random));
      setSelected(null);
      return;
    }

    playSound('ding');
    setLastPath(path);
    const a = selected;
    const b = { row, col };
    setSelected(null);
    setTimeout(() => {
      setBoard((current) => clearTiles(current, a, b));
      setLastPath(null);
    }, 600);
  };

  useEffect(() => {
    if (isAllCleared(board) && !lastPath) {
      onComplete(true);
    }
  }, [board, lastPath, onComplete]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-6">
      <div
        className="relative grid"
        data-shake-key={shakeKey}
        style={{
          gridTemplateColumns: `repeat(${board.cols}, clamp(48px, 14vw, 72px))`,
          gridTemplateRows: `repeat(${board.rows}, clamp(48px, 14vw, 72px))`,
          gap: 4,
        }}
      >
        {board.cells.flatMap((row, r) =>
          row.map((cell, c) => {
            if (cell.kind === 'empty') {
              return <div key={`${r}-${c}`} aria-hidden />;
            }
            const isSelected =
              selected?.row === r && selected?.col === c;
            const isHinted =
              hintPair?.fromTileId === cell.tileId ||
              hintPair?.toTileId === cell.tileId;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                aria-pressed={isSelected}
                data-hint={isHinted ? 'true' : undefined}
                onClick={() => onTileTap(r, c)}
                className={[
                  'flex items-center justify-center rounded-2xl border-2 shadow-sm transition-transform active:scale-95',
                  cell.display.kind === 'hanzi'
                    ? 'bg-[var(--color-sand-100)] font-hanzi text-4xl text-[var(--color-ocean-900)]'
                    : 'bg-amber-100 text-sm font-semibold text-amber-900',
                  isSelected
                    ? 'border-sky-400 ring-4 ring-sky-200'
                    : 'border-[var(--color-sand-300)]',
                  isHinted ? 'animate-pulse' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {cell.display.text}
              </button>
            );
          }),
        )}
        {lastPath ? (
          <LianliankanLine
            path={lastPath}
            cols={board.cols}
            rows={board.rows}
            cellPx={CELL_PX}
          />
        ) : null}
      </div>
    </div>
  );
}
