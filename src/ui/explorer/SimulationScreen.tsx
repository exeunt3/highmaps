import { useMemo, useState } from 'react';
import type { EmbeddedPoint } from '../../types/models';
import { SimpleChart } from '../components/SimpleChart';

const EMOTION_LANGUAGE = ['Grounded', 'Energized', 'Stretched', 'Friction', 'Fatigued'] as const;
const NARRATIVE_LANGUAGE = ['Steady progress', 'Pivot day', 'Heavy loop', 'Repair arc', 'Open thread'] as const;

interface SimulationDay {
  id: string;
  day: number;
  emotion: (typeof EMOTION_LANGUAGE)[number];
  narrative: (typeof NARRATIVE_LANGUAGE)[number];
  vector: number[];
}

const mulberry32 = (seed: number) => () => {
  let t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const createYear = (): SimulationDay[] => {
  const rand = mulberry32(2026);
  return Array.from({ length: 365 }, (_, day) => {
    const seasonWave = Math.sin((day / 365) * Math.PI * 2);
    const emotion = EMOTION_LANGUAGE[Math.floor(rand() * EMOTION_LANGUAGE.length)];
    const narrative = NARRATIVE_LANGUAGE[Math.floor((rand() * 0.7 + (seasonWave + 1) * 0.15) * NARRATIVE_LANGUAGE.length) % NARRATIVE_LANGUAGE.length];
    const vector = Array.from({ length: 6 }, (_, i) => {
      const harmonic = Math.sin((day / 365) * Math.PI * (i + 1) * 2);
      return Number((harmonic + rand() * 0.7 + (emotion === 'Grounded' ? 0.25 : 0)).toFixed(3));
    });
    return { id: `sim-${day + 1}`, day: day + 1, emotion, narrative, vector };
  });
};

const toShapePoints = (rows: SimulationDay[], mode: 'simple' | 'hyper'): EmbeddedPoint[] => rows.map((row, i) => {
  if (mode === 'simple') {
    return {
      id: row.id,
      index: i,
      x: i,
      y: EMOTION_LANGUAGE.indexOf(row.emotion) - NARRATIVE_LANGUAGE.indexOf(row.narrative),
      z: (EMOTION_LANGUAGE.indexOf(row.emotion) + NARRATIVE_LANGUAGE.indexOf(row.narrative)) / 2,
    };
  }

  const [a, b, c, d, e, f] = row.vector;
  return {
    id: row.id,
    index: i,
    x: a + c - e,
    y: b + d - f,
    z: (a + b + c + d + e + f) / 6,
  };
});

export const SimulationScreen = () => {
  const [rows] = useState<SimulationDay[]>(() => createYear());
  const [cursor, setCursor] = useState(0);
  const [shapeMode, setShapeMode] = useState<'simple' | 'hyper'>('simple');

  const points = useMemo(() => toShapePoints(rows, shapeMode), [rows, shapeMode]);
  const active = rows[cursor];

  const extractedInsight = useMemo(() => {
    const recent = rows.slice(Math.max(0, cursor - 29), cursor + 1);
    const avgVector = Array.from({ length: 6 }, (_, i) => recent.reduce((acc, row) => acc + row.vector[i], 0) / Math.max(1, recent.length));
    const dominantAxis = avgVector
      .map((value, i) => ({ axis: i + 1, score: Math.abs(value) }))
      .sort((a, b) => b.score - a.score)[0];
    const spread = Math.max(...avgVector) - Math.min(...avgVector);

    return {
      dominantAxis: dominantAxis.axis,
      spread: spread.toFixed(2),
      projection: (avgVector[0] + avgVector[2] - avgVector[4]).toFixed(2),
    };
  }, [rows, cursor]);

  return (
    <section className="geomode-shell">
      <header className="top-bar">
        <strong>GEOMODE — Year simulation</strong>
      </header>
      <div className="content-grid">
        <aside className="panel-block left-panel">
          <h3>Navigate simulated year</h3>
          <label>Day {active.day}
            <input type="range" min={0} max={rows.length - 1} value={cursor} onChange={(event) => setCursor(Number(event.target.value))} />
          </label>
          <p>{active.emotion} / {active.narrative}</p>
          <label>Shape language
            <select value={shapeMode} onChange={(event) => setShapeMode(event.target.value as 'simple' | 'hyper')}>
              <option value="simple">Simple shapes (3D)</option>
              <option value="hyper">Higher-dimensional projection</option>
            </select>
          </label>
        </aside>

        <section className="center-panel">
          <SimpleChart points={points} width={980} height={500} highlightIds={new Set([active.id])} />
        </section>

        <aside className="panel-block right-panel">
          <h3>Extracted lower-dimensional insight</h3>
          <p>Dominant hidden axis: <strong>{extractedInsight.dominantAxis}</strong></p>
          <p>Projection (axis1+axis3-axis5): <strong>{extractedInsight.projection}</strong></p>
          <p>Vector spread over recent window: <strong>{extractedInsight.spread}</strong></p>
          <p className="hint">This view converts higher-dimensional vectors into a lower-dimensional rendering to surface trends not obvious in raw categories.</p>
        </aside>
      </div>
    </section>
  );
};
