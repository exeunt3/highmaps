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

type GeometryPresetId = 'simple' | 'line' | 'circle' | 'spiral' | 'helix' | 'wave' | 'torus' | 'sphere' | 'hyper';

interface GeometryPreset {
  id: GeometryPresetId;
  label: string;
  description: string;
}

const GEOMETRY_PRESETS: GeometryPreset[] = [
  { id: 'simple', label: 'Simple', description: 'Minimal baseline projection' },
  { id: 'line', label: 'Line', description: 'Linear track with subtle depth' },
  { id: 'circle', label: 'Circle', description: 'Periodic cycle view' },
  { id: 'spiral', label: 'Spiral', description: 'Growth and drift over time' },
  { id: 'helix', label: 'Helix', description: 'Layered progression' },
  { id: 'wave', label: 'Wave', description: 'Oscillation emphasis' },
  { id: 'torus', label: 'Torus', description: 'Nested recurring loops' },
  { id: 'sphere', label: 'Sphere', description: 'Dense 3D enclosure' },
  { id: 'hyper', label: 'Hyperbolic', description: 'Higher-dimensional projection' },
];

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

const toShapePoints = (rows: SimulationDay[], mode: GeometryPresetId): EmbeddedPoint[] => rows.map((row, i) => {
  const t = i / Math.max(1, rows.length - 1);
  const theta = t * Math.PI * 12;
  const phi = t * Math.PI * 2;
  const [a, b, c, d, e, f] = row.vector;
  const emotionIdx = EMOTION_LANGUAGE.indexOf(row.emotion);
  const narrativeIdx = NARRATIVE_LANGUAGE.indexOf(row.narrative);

  if (mode === 'simple') {
    return {
      id: row.id,
      index: i,
      x: i,
      y: emotionIdx - narrativeIdx,
      z: (emotionIdx + narrativeIdx) / 2,
    };
  }

  if (mode === 'line') {
    return {
      id: row.id,
      index: i,
      x: t * 18 - 9,
      y: Math.sin(theta * 0.5) * 0.8 + emotionIdx * 0.12,
      z: Math.cos(theta * 0.4) * 0.9 + narrativeIdx * 0.1,
    };
  }

  if (mode === 'circle') {
    const radius = 2 + (emotionIdx - narrativeIdx) * 0.08;
    return {
      id: row.id,
      index: i,
      x: Math.cos(theta) * radius,
      y: Math.sin(theta) * radius,
      z: Math.sin(theta * 1.2) * 1.3,
    };
  }

  if (mode === 'spiral') {
    const radius = 0.25 + t * 2.8;
    return {
      id: row.id,
      index: i,
      x: Math.cos(theta) * radius,
      y: Math.sin(theta) * radius,
      z: t * 7 - 3.5,
    };
  }

  if (mode === 'helix') {
    return {
      id: row.id,
      index: i,
      x: Math.cos(theta) * 2.1,
      y: t * 7 - 3.5,
      z: Math.sin(theta) * 2.1,
    };
  }

  if (mode === 'wave') {
    return {
      id: row.id,
      index: i,
      x: t * 18 - 9,
      y: Math.sin(theta) * 1.7 + (emotionIdx - 2) * 0.15,
      z: Math.cos(theta * 0.55) * 1.8 + (narrativeIdx - 2) * 0.12,
    };
  }

  if (mode === 'torus') {
    const ring = 2.5 + Math.cos(theta * 0.8) * 0.7;
    return {
      id: row.id,
      index: i,
      x: ring * Math.cos(phi),
      y: ring * Math.sin(phi),
      z: Math.sin(theta * 0.8) * 1.8,
    };
  }

  if (mode === 'sphere') {
    return {
      id: row.id,
      index: i,
      x: Math.cos(theta) * Math.sin(phi) * 2.5,
      y: Math.sin(theta) * Math.sin(phi) * 2.5,
      z: Math.cos(phi) * 2.5,
    };
  }

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
  const [shapeMode, setShapeMode] = useState<GeometryPresetId>('simple');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const extractedNodes = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return rows.filter((row) => selectedIds.has(row.id)).slice(0, 12);
  }, [rows, selectedIds]);

  const activePreset = GEOMETRY_PRESETS.find((preset) => preset.id === shapeMode) ?? GEOMETRY_PRESETS[0];

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

          <h3>Geometry renderings</h3>
          <div className="geometry-render-list">
            {GEOMETRY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={shapeMode === preset.id ? 'selected' : ''}
                onClick={() => setShapeMode(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label>Jump via dropdown
            <select value={shapeMode} onChange={(event) => setShapeMode(event.target.value as GeometryPresetId)}>
              {GEOMETRY_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </label>
          <p className="hint">Current geometry: {activePreset.description}</p>
        </aside>

        <section className="center-panel">
          <SimpleChart
            points={points}
            width={980}
            height={500}
            highlightIds={new Set([active.id, ...selectedIds])}
            onPointClick={(id) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
          />
        </section>

        <aside className="panel-block right-panel">
          <h3>Extracted lower-dimensional insight</h3>
          <p>Dominant hidden axis: <strong>{extractedInsight.dominantAxis}</strong></p>
          <p>Projection (axis1+axis3-axis5): <strong>{extractedInsight.projection}</strong></p>
          <p>Vector spread over recent window: <strong>{extractedInsight.spread}</strong></p>

          <h3>Extracted nodes field</h3>
          {extractedNodes.length === 0 ? (
            <p className="hint">Click any nodes in the chart to extract them into this field.</p>
          ) : (
            <div className="extract-field">
              {extractedNodes.map((row) => (
                <p key={row.id}>Day {row.day}: {row.emotion} / {row.narrative}</p>
              ))}
            </div>
          )}
          <p className="hint">This view converts higher-dimensional vectors into a lower-dimensional rendering to surface trends not obvious in raw categories.</p>
        </aside>
      </div>
    </section>
  );
};
