import type { ChildInsights } from '@/lib/db/insights';

/**
 * A3 — parent insight panel. English-only: the parent surface is David-facing
 * and exempt from the bilingual rule (the hanzi themselves are the content).
 *
 * Every panel states its own limits out loud. With a few hundred events, a
 * confident-looking chart is a worse artefact than a small honest one — the
 * whole point of this page is to aim homework, and aiming at noise is worse
 * than not aiming.
 */

const SOURCE_LABELS: Record<string, string> = {
  practice: 'Practice',
  boss: 'Boss battles',
  review: 'Flashcard review',
  daily_review: '温故 daily review',
  study: 'Study mode',
  homework: 'Homework',
};

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-stone-800">{title}</h2>
      {note ? <p className="mt-0.5 text-xs text-stone-500">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-stone-500">{children}</p>;
}

export function InsightsPanel({ data }: { data: ChildInsights }) {
  const daysPlayed = data.activity.filter((d) => d.answers > 0).length;
  const peak = Math.max(1, ...data.activity.map((d) => d.answers));
  const totalRatings = data.selfRatings.reduce((n, r) => n + r.count, 0);
  const onlyGotIt =
    totalRatings > 0 && data.selfRatings.every((r) => r.rating === 'got_it');

  return (
    <div className="flex flex-col gap-4" data-testid="insights-panel">
      <Card
        title="Activity — last 30 days"
        note={`${daysPlayed} day${daysPlayed === 1 ? '' : 's'} with any answers. ${data.totalAnswers} answers logged in total since ${
          data.firstAnswerAt ? data.firstAnswerAt.toISOString().slice(0, 10) : '—'
        }.`}
      >
        {data.activity.length === 0 ? (
          <Empty>No answers in the last 30 days.</Empty>
        ) : (
          <ul className="flex items-end gap-1" data-testid="insights-activity">
            {data.activity.map((d) => (
              <li key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className="w-full rounded-t bg-sky-400"
                  style={{ height: `${Math.round((d.answers / peak) * 56) + 2}px` }}
                  title={`${d.day}: ${d.answers} answers, ${d.wrong} wrong`}
                />
                <span className="text-[9px] text-stone-400">{d.day.slice(5)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Most missed"
        note="Ranked by misses, then by the smaller denominator — 3 of 4 is a louder signal than 3 of 40. Only characters with at least one miss appear."
      >
        {data.missed.length === 0 ? (
          <Empty>Nothing missed yet.</Empty>
        ) : (
          <table className="w-full text-sm" data-testid="insights-missed">
            <thead>
              <tr className="text-left text-xs text-stone-500">
                <th className="pb-1 font-medium">Character</th>
                <th className="pb-1 font-medium">Meaning</th>
                <th className="pb-1 text-right font-medium">Wrong</th>
                <th className="pb-1 text-right font-medium">Answered</th>
              </tr>
            </thead>
            <tbody>
              {data.missed.map((m) => (
                <tr key={m.characterId} className="border-t border-stone-100">
                  <td className="py-1.5">
                    <span className="font-hanzi text-lg text-stone-800">{m.hanzi}</span>{' '}
                    <span className="text-xs text-stone-400">{m.pinyin.join(' ')}</span>
                  </td>
                  <td className="py-1.5 text-stone-600">{m.meaningEn ?? '—'}</td>
                  <td className="py-1.5 text-right font-semibold text-stone-800">
                    {m.wrong + m.dontKnow}
                  </td>
                  <td className="py-1.5 text-right text-stone-500">{m.scored}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card
        title="Confusion pairs"
        note="What she chose instead of the right answer. Boss battles are absent by design — that path records the mistake but not which option was taken — so these come from practice, review and study only."
      >
        {data.confusions.length === 0 ? (
          <Empty>No wrong answers with a recorded choice yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5" data-testid="insights-confusions">
            {data.confusions.map((c) => (
              <li
                key={`${c.target}-${c.picked}-${c.sceneType}`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="font-hanzi text-lg text-stone-800">{c.target}</span>
                <span className="text-xs text-stone-400">← picked</span>
                <span className="font-hanzi text-lg text-amber-700">{c.picked}</span>
                <span className="ml-auto text-xs text-stone-400">
                  {c.sceneType}
                  {c.count > 1 ? ` ×${c.count}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Self-assessment"
        note={
          onlyGotIt
            ? 'Every single rating is “got it”. Treat this as unusable rather than as good news — a field whose every observation is identical carries no information. The three buttons were restyled identically in PR #168 for exactly this reason; ratings recorded after that change are the ones worth reading.'
            : 'How she rated herself on flashcards, and how often she uncovered the pinyin or meaning first.'
        }
      >
        {data.selfRatings.length === 0 ? (
          <Empty>No flashcard self-ratings yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-1 text-sm" data-testid="insights-ratings">
            {data.selfRatings.map((r) => (
              <li key={r.rating} className="flex justify-between">
                <span className="text-stone-700">{r.rating}</span>
                <span className="text-stone-500">
                  {r.count}
                  {r.revealed > 0 ? ` (${r.revealed} after revealing)` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Where the answers come from">
        {data.sources.length === 0 ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-1 text-sm" data-testid="insights-sources">
            {data.sources.map((s) => (
              <li key={s.source} className="flex justify-between">
                <span className="text-stone-700">{SOURCE_LABELS[s.source] ?? s.source}</span>
                <span className="text-stone-500">
                  {s.answers} answers{s.wrong > 0 ? `, ${s.wrong} wrong` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
