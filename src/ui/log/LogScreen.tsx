import { useMemo, useState } from 'react';
import {
  NARRATIVE_ATOMS,
  PRIMARY_EMOTIONS,
  useGeomodeStore,
  type GeomodeEntry,
} from '../../state/store';
import { DatasetImport } from '../dataset/DatasetImport';

const emotionState = (entry?: GeomodeEntry) => ({
  primaryEmotion: entry?.emotion.primaryEmotion ?? 'calm',
  secondaryEmotions: entry?.emotion.secondaryEmotions ?? [],
  valence: entry?.emotion.valence ?? 0,
  arousal: entry?.emotion.arousal ?? 2,
  energy: entry?.emotion.energy ?? 2,
  clarity: entry?.emotion.clarity ?? 2,
  sociality: entry?.emotion.sociality ?? 0,
  stressors: entry?.emotion.stressors ?? [],
  regulators: entry?.emotion.regulators ?? [],
  note: entry?.emotion.note ?? '',
});

const narrativeState = (entry?: GeomodeEntry) => ({
  atoms: entry?.narrative.atoms ?? [],
  role: entry?.narrative.role ?? ('observer' as const),
  conflictLevel: entry?.narrative.conflictLevel ?? 0,
  agencyLevel: entry?.narrative.agencyLevel ?? 0,
  closureLevel: entry?.narrative.closureLevel ?? 0,
});

const detectEmotionChoice = (entry?: GeomodeEntry) => {
  const active = emotionState(entry);
  return PRIMARY_EMOTIONS.includes(active.primaryEmotion) ? active.primaryEmotion : 'calm';
};

const detectNarrativeChoice = (entry?: GeomodeEntry) => {
  const active = narrativeState(entry);
  const firstAtom = active.atoms[0];
  return firstAtom && NARRATIVE_ATOMS.includes(firstAtom) ? firstAtom : 'beginning';
};

const formatLabel = (value: string) => value
  .split('_')
  .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
  .join(' ');

export const LogScreen = () => {
  const { entries, upsertEntry } = useGeomodeStore();
  const [showLoad, setShowLoad] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const active = entries.find((entry) => entry.date === date);
  const activeEmotionChoice = useMemo(() => detectEmotionChoice(active), [active]);
  const activeNarrativeChoice = useMemo(() => detectNarrativeChoice(active), [active]);

  return (
    <section className="geomode-shell">
      <header className="top-bar">
        <strong>GEOMODE — Daily log</strong>
        <button onClick={() => setShowLoad((p) => !p)}>Advanced CSV import</button>
      </header>
      <div className="content-grid log-layout">
        <aside className="left-panel panel-block">
          <label>Date <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <p className="hint">One multiple-choice emotion input + one multiple-choice narrative input.</p>
        </aside>

        <section className="center-panel panel-block">
          <h3>Emotion input</h3>
          <label>Emotion (multiple choice)
            <select value={activeEmotionChoice} onChange={(event) => {
              const primaryEmotion = PRIMARY_EMOTIONS.includes(event.target.value as typeof PRIMARY_EMOTIONS[number])
                ? event.target.value as typeof PRIMARY_EMOTIONS[number]
                : 'calm';
              upsertEntry(date, {
                emotion: {
                  ...emotionState(active),
                  primaryEmotion,
                },
              });
            }}>
              {PRIMARY_EMOTIONS.map((emotion) => <option key={emotion} value={emotion}>{formatLabel(emotion)}</option>)}
            </select>
          </label>

          <h3>Narrative input</h3>
          <label>Narrative (multiple choice)
            <select value={activeNarrativeChoice} onChange={(event) => {
              const selectedAtom = NARRATIVE_ATOMS.includes(event.target.value as typeof NARRATIVE_ATOMS[number])
                ? event.target.value as typeof NARRATIVE_ATOMS[number]
                : 'beginning';
              upsertEntry(date, {
                narrative: {
                  ...narrativeState(active),
                  atoms: [selectedAtom],
                },
              });
            }}>
              {NARRATIVE_ATOMS.map((atom) => <option key={atom} value={atom}>{formatLabel(atom)}</option>)}
            </select>
          </label>

          <label>Optional note
            <textarea maxLength={240} value={emotionState(active).note} onChange={(event) => upsertEntry(date, { emotion: { ...emotionState(active), note: event.target.value.slice(0, 240) } })} />
          </label>
        </section>

        <aside className="right-panel panel-block">
          <h3>Entries logged</h3>
          <p>{entries.length}</p>
          <p className="hint">Use Geometry Map layer = <strong>Both</strong> to view emotion and narrative together.</p>
        </aside>
      </div>
      {showLoad && <DatasetImport onLoaded={() => setShowLoad(false)} />}
    </section>
  );
};
