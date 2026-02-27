import { useState } from 'react';
import {
  NARRATIVE_ATOMS,
  PRIMARY_EMOTIONS,
  useGeomodeStore,
  type GeomodeEntry,
} from '../../state/store';
import { DatasetImport } from '../dataset/DatasetImport';

const STRESSORS = ['workload', 'conflict', 'uncertainty', 'sleep_debt', 'health'];
const REGULATORS = ['walk', 'breathing', 'journaling', 'connection', 'music'];

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
});

export const LogScreen = () => {
  const { entries, upsertEntry } = useGeomodeStore();
  const [showLoad, setShowLoad] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const active = entries.find((entry) => entry.date === date);
  const activeEmotion = emotionState(active);
  const activeNarrative = narrativeState(active);

  return (
    <section className="geomode-shell">
      <header className="top-bar">
        <strong>GEOMODE — Daily log</strong>
        <button onClick={() => setShowLoad((p) => !p)}>Advanced CSV import</button>
      </header>
      <div className="content-grid log-layout">
        <aside className="left-panel panel-block">
          <label>Date <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <p className="hint">Log your day here, then switch to Geometry Map to inspect patterns.</p>
        </aside>

        <section className="center-panel panel-block">
          <h3>Emotion entry</h3>
          <label>Primary emotion
            <select value={activeEmotion.primaryEmotion} onChange={(event) => upsertEntry(date, { emotion: { ...activeEmotion, primaryEmotion: event.target.value as typeof PRIMARY_EMOTIONS[number] } })}>
              {PRIMARY_EMOTIONS.map((emotion) => <option key={emotion}>{emotion}</option>)}
            </select>
          </label>
          <label>Secondary emotions (max 2)
            <select multiple value={activeEmotion.secondaryEmotions} onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map((opt) => opt.value).slice(0, 2) as Array<typeof PRIMARY_EMOTIONS[number]>;
              upsertEntry(date, { emotion: { ...activeEmotion, secondaryEmotions: selected } });
            }}>
              {PRIMARY_EMOTIONS.map((emotion) => <option key={emotion}>{emotion}</option>)}
            </select>
          </label>
          {([
            ['Valence', -5, 5, activeEmotion.valence, 'valence'],
            ['Arousal', 0, 5, activeEmotion.arousal, 'arousal'],
            ['Energy', 0, 5, activeEmotion.energy, 'energy'],
            ['Clarity', 0, 5, activeEmotion.clarity, 'clarity'],
            ['Sociality', -5, 5, activeEmotion.sociality, 'sociality'],
          ] as const).map(([label, min, max, value, key]) => (
            <label key={key}>{label}: {value}
              <input type="range" min={min} max={max} step={1} value={value} onChange={(event) => upsertEntry(date, { emotion: { ...activeEmotion, [key]: Number(event.target.value) } })} />
            </label>
          ))}
          <label>Stressors
            <select multiple value={activeEmotion.stressors} onChange={(event) => upsertEntry(date, { emotion: { ...activeEmotion, stressors: Array.from(event.target.selectedOptions).map((opt) => opt.value) } })}>
              {STRESSORS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Regulators
            <select multiple value={activeEmotion.regulators} onChange={(event) => upsertEntry(date, { emotion: { ...activeEmotion, regulators: Array.from(event.target.selectedOptions).map((opt) => opt.value) } })}>
              {REGULATORS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Note
            <textarea maxLength={240} value={activeEmotion.note} onChange={(event) => upsertEntry(date, { emotion: { ...activeEmotion, note: event.target.value.slice(0, 240) } })} />
          </label>
        </section>

        <aside className="right-panel panel-block">
          <h3>Narrative entry</h3>
          <label>Narrative atoms (max 2)
            <select multiple value={activeNarrative.atoms} onChange={(event) => upsertEntry(date, { narrative: { ...activeNarrative, atoms: Array.from(event.target.selectedOptions).map((opt) => opt.value).slice(0, 2) as Array<typeof NARRATIVE_ATOMS[number]> } })}>
              {NARRATIVE_ATOMS.map((atom) => <option key={atom}>{atom}</option>)}
            </select>
          </label>
          <label>Role
            <select value={activeNarrative.role} onChange={(event) => upsertEntry(date, { narrative: { ...activeNarrative, role: event.target.value as 'protagonist' | 'support' | 'observer' } })}>
              <option>protagonist</option>
              <option>support</option>
              <option>observer</option>
            </select>
          </label>
          <h3>Entries logged</h3>
          <p>{entries.length}</p>
        </aside>
      </div>
      {showLoad && <DatasetImport onLoaded={() => setShowLoad(false)} />}
    </section>
  );
};
