import { useMemo, useState } from 'react';
import {
  NARRATIVE_ATOMS,
  PRIMARY_EMOTIONS,
  useGeomodeStore,
  type GeomodeEntry,
} from '../../state/store';
import { DatasetImport } from '../dataset/DatasetImport';

const EMOTION_CHOICES = [
  { id: 'grounded', label: 'Grounded', primaryEmotion: 'calm', valence: 2, arousal: 1, energy: 2, clarity: 4, sociality: 1 },
  { id: 'energized', label: 'Energized', primaryEmotion: 'joy', valence: 4, arousal: 4, energy: 5, clarity: 3, sociality: 3 },
  { id: 'stretched', label: 'Stretched', primaryEmotion: 'anxiety', valence: -2, arousal: 4, energy: 2, clarity: 1, sociality: -2 },
  { id: 'friction', label: 'Friction', primaryEmotion: 'anger', valence: -3, arousal: 4, energy: 4, clarity: 2, sociality: -3 },
  { id: 'fatigued', label: 'Fatigued', primaryEmotion: 'fatigue', valence: -1, arousal: 1, energy: 0, clarity: 1, sociality: -1 },
] as const;

const NARRATIVE_CHOICES = [
  { id: 'steady-progress', label: 'Steady progress', atoms: ['setup', 'rising_action'], role: 'protagonist' as const, conflictLevel: 1, agencyLevel: 4, closureLevel: 3 },
  { id: 'pivot-day', label: 'Pivot day', atoms: ['turning_point', 'climax'], role: 'protagonist' as const, conflictLevel: 3, agencyLevel: 4, closureLevel: 2 },
  { id: 'heavy-loop', label: 'Heavy loop', atoms: ['complication', 'stasis'], role: 'observer' as const, conflictLevel: 4, agencyLevel: 1, closureLevel: 0 },
  { id: 'repair-arc', label: 'Repair arc', atoms: ['falling_action', 'resolution'], role: 'support' as const, conflictLevel: 2, agencyLevel: 3, closureLevel: 4 },
  { id: 'open-thread', label: 'Open thread', atoms: ['beginning', 'echo'], role: 'observer' as const, conflictLevel: 2, agencyLevel: 2, closureLevel: 1 },
] as const;

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
  const match = EMOTION_CHOICES.find((choice) => choice.primaryEmotion === active.primaryEmotion && choice.valence === active.valence && choice.arousal === active.arousal && choice.energy === active.energy);
  return match?.id ?? 'grounded';
};

const detectNarrativeChoice = (entry?: GeomodeEntry) => {
  const active = narrativeState(entry);
  const match = NARRATIVE_CHOICES.find((choice) => choice.role === active.role && choice.atoms.every((atom) => active.atoms.includes(atom as typeof NARRATIVE_ATOMS[number])));
  return match?.id ?? 'steady-progress';
};

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
              const choice = EMOTION_CHOICES.find((item) => item.id === event.target.value);
              if (!choice) return;
              const primaryEmotion = PRIMARY_EMOTIONS.includes(choice.primaryEmotion as typeof PRIMARY_EMOTIONS[number])
                ? choice.primaryEmotion as typeof PRIMARY_EMOTIONS[number]
                : 'calm';
              upsertEntry(date, {
                emotion: {
                  ...emotionState(active),
                  primaryEmotion,
                  secondaryEmotions: [],
                  valence: choice.valence,
                  arousal: choice.arousal,
                  energy: choice.energy,
                  clarity: choice.clarity,
                  sociality: choice.sociality,
                },
              });
            }}>
              {EMOTION_CHOICES.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
            </select>
          </label>

          <h3>Narrative input</h3>
          <label>Narrative (multiple choice)
            <select value={activeNarrativeChoice} onChange={(event) => {
              const choice = NARRATIVE_CHOICES.find((item) => item.id === event.target.value);
              if (!choice) return;
              upsertEntry(date, {
                narrative: {
                  ...narrativeState(active),
                  atoms: [...choice.atoms] as Array<typeof NARRATIVE_ATOMS[number]>,
                  role: choice.role,
                  conflictLevel: choice.conflictLevel,
                  agencyLevel: choice.agencyLevel,
                  closureLevel: choice.closureLevel,
                },
              });
            }}>
              {NARRATIVE_CHOICES.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
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
