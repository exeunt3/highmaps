import { useMemo, useState, type PointerEvent, type WheelEvent } from 'react';
import type { EmbeddedPoint } from '../../types/models';
import {
  NARRATIVE_ATOMS,
  PRIMARY_EMOTIONS,
  useGeomodeStore,
  type GeomodeEntry,
} from '../../state/store';
import { projectPoints, SimpleChart } from '../components/SimpleChart';
import { DatasetImport } from '../dataset/DatasetImport';

const SHAPES = ['line', 'circle', 'spiral', 'helix', 'cylinder', 'torus', 'sphere', 'möbius', 'hyperbolic', 'tesseract'] as const;
type ShapeId = (typeof SHAPES)[number];
type ModeId = 'emotion' | 'narrative' | 'correspondence';

const STRESSORS = ['workload', 'conflict', 'uncertainty', 'sleep_debt', 'health'];
const REGULATORS = ['walk', 'breathing', 'journaling', 'connection', 'music'];
const INTENTIONS = [
  { label: 'Stabilize weekly baseline', target: 0.75 },
  { label: 'Increase calm frequency', target: 0.8 },
  { label: 'Increase resolution days', target: 0.7 },
  { label: 'Reduce volatility', target: 0.25 },
  { label: 'Balance valence/arousal', target: 0.6 },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const shapeProjection = (shapeId: ShapeId, points: EmbeddedPoint[], control: number) => {
  const period = Math.max(4, 7 + control * 4);
  return points.map((point, i) => {
    const t = i / Math.max(1, points.length - 1);
    const theta = (Math.PI * 2 * i) / period;
    switch (shapeId) {
      case 'line':
        return { ...point, x: t * 10 - 5, y: 0, z: Math.sin(theta * 0.35) * 0.8 };
      case 'circle':
        return { ...point, x: Math.cos(theta) * scale, y: Math.sin(theta) * scale, z: Math.sin(theta * 1.4) * 1.1 };
      case 'spiral': {
        const r = 0.3 + t * 2.4 * scale;
        return { ...point, x: Math.cos(theta) * r, y: Math.sin(theta) * r, z: t * 5 - 2.5 };
      }
      case 'helix':
        return { ...point, x: Math.cos(theta) * scale, y: t * 5 - 2.5 + Math.sin(theta * 0.4) * 0.6, z: Math.sin(theta) * scale * 1.4 };
      case 'sphere': {
        const phi = Math.PI * t;
        return {
          ...point,
          x: Math.cos(theta) * Math.sin(phi) * 2,
          y: Math.cos(phi) * 2,
          z: Math.sin(theta) * Math.sin(phi) * 2,
        };
      }
      case 'torus': {
        const phi = (Math.PI * 2 * i) / Math.max(points.length, 1);
        const ring = 1.4 + 0.65 * Math.cos(theta * 0.8);
        return { ...point, x: ring * Math.cos(phi), y: ring * Math.sin(phi), z: Math.sin(theta * 0.8) * 1.6 };
      }
      case 'grid': {
        const cols = Math.max(3, Math.round(8 + control * 2));
        const row = Math.floor(i / cols);
        const col = i % cols;
        return {
          ...point,
          x: col - cols / 2,
          y: row * 0.75 - 4,
          z: Math.sin(col * 0.7) * 0.8 + Math.cos(row * 0.6) * 0.8,
        };
      }
      case 'wave':
        return {
          ...point,
          x: t * 12 - 6,
          y: Math.sin(theta) * (1.2 + control * 0.2),
          z: Math.cos(theta * 0.55) * (1.4 + control * 0.15),
        };
      case 'lissajous': {
        const a = 3 + Math.round(control);
        const b = 2 + Math.round(control * 1.6);
        const delta = Math.PI / (2.4 + control * 0.4);
        return {
          ...point,
          x: Math.sin(a * theta + delta) * (1.8 + control * 0.25),
          y: Math.sin(b * theta) * (1.8 + control * 0.25),
          z: Math.sin((a + b) * theta * 0.35) * 2,
        };
      }
      case 'epicycloid': {
        const k = 3 + Math.round(control * 1.2);
        const r = 0.55 + control * 0.1;
        const R = r * k;
        const phi = theta * 0.65;
        const x = (R + r) * Math.cos(phi) - r * Math.cos(((R + r) / r) * phi);
        const y = (R + r) * Math.sin(phi) - r * Math.sin(((R + r) / r) * phi);
        return { ...point, x: x * 0.45, y: y * 0.45, z: Math.cos(phi * 1.6) * 1.8 };
      }
      case 'poincare': {
        const radial = Math.tanh(t * (2.1 + control * 0.35));
        const angle = theta * (1.4 + control * 0.15) + Math.sin(theta * 0.35) * 0.3;
        return {
          ...point,
          x: radial * Math.cos(angle) * 2.4,
          y: radial * Math.sin(angle) * 2.4,
          z: (1 - radial * radial) * 2.2 - 1,
        };
      }
      case 'hyperbolic': {
        const v = t * 2.2 - 1.1;
        const sinh = (Math.exp(v) - Math.exp(-v)) / 2;
        const tube = 0.4 + cosh * (0.3 + control * 0.03);
        return {
          ...point,
          x: Math.cos(theta * 0.75) * tube,
          y: sinh * 1.55,
          z: Math.sin(theta * 0.75) * tube,
        };
      }
    }
  });
};

const toBasePoints = (entries: GeomodeEntry[]): EmbeddedPoint[] => entries.map((entry, index) => ({
  id: entry.id,
  index,
  x: index,
  y: entry.emotion.valence,
}));

const computeSummary = (entries: GeomodeEntry[]) => {
  if (entries.length === 0) return [];
  const valences = entries.map((entry) => entry.emotion.valence);
  const meanValence = valences.reduce((a, b) => a + b, 0) / valences.length;
  const volatility = valences.slice(1).reduce((acc, value, i) => acc + Math.abs(value - valences[i]), 0) / Math.max(1, valences.length - 1);
  const weeklyRhythm = Math.abs(valences.slice(7).reduce((acc, value, i) => acc + (value * valences[i]), 0) / Math.max(1, valences.length - 7)) / 12;
  const climaxCount = entries.filter((entry) => entry.narrative.atoms.includes('climax')).length;
  const closureAvg = entries.reduce((acc, entry) => acc + entry.narrative.closureLevel, 0) / entries.length;
  const agencyAvg = entries.reduce((acc, entry) => acc + entry.narrative.agencyLevel, 0) / entries.length;

  return [
    meanValence >= 1 ? 'Mean valence is mostly positive.' : meanValence <= -1 ? 'Mean valence is mostly negative.' : 'Mean valence is balanced.',
    volatility > 2 ? `High volatility across last ${Math.min(7, entries.length)} entries.` : 'Volatility is currently contained.',
    weeklyRhythm > 0.35 ? 'Weekly emotional rhythm is strong.' : 'Weekly rhythm appears light.',
    climaxCount > 0 ? 'Climax events cluster mid-cycle.' : 'Narrative arc balance is still forming.',
    agencyAvg - closureAvg > 1 ? 'Agency rising without closure.' : 'Agency and closure are moving together.',
  ];
};

const fitError = (points: Array<{ x: number; y: number }>, model: string) => {
  if (points.length < 4) return 999;
  const centerX = points.reduce((acc, p) => acc + p.x, 0) / points.length;
  const centerY = points.reduce((acc, p) => acc + p.y, 0) / points.length;
  const radii = points.map((p) => Math.hypot(p.x - centerX, p.y - centerY));
  const avgR = radii.reduce((a, b) => a + b, 0) / radii.length;
  const last = points[points.length - 1];
  const yTrend = last.y - points[0].y;
  const xTrend = last.x - points[0].x;

  switch (model) {
    case 'Line':
      return points.reduce((acc, p, i) => acc + Math.abs(p.y - (points[0].y + (yTrend / points.length) * i)), 0) / points.length;
    case 'Cycle':
      return radii.reduce((acc, r) => acc + Math.abs(r - avgR), 0) / points.length;
    case 'Spiral':
      return points.reduce((acc, p, i) => acc + Math.abs(Math.hypot(p.x - centerX, p.y - centerY) - (i / points.length) * avgR * 1.8), 0) / points.length;
    case 'Helix':
      return Math.abs(xTrend) + points.reduce((acc, p) => acc + Math.abs(Math.abs(p.x - centerX) - avgR), 0) / points.length;
    case 'Torus':
      return points.reduce((acc, p) => acc + Math.abs(Math.hypot(p.x - centerX, p.y - centerY) - avgR), 0) / points.length + Math.abs(yTrend) * 0.2;
    case 'Oscillation':
      return Math.abs(yTrend) + points.slice(1).reduce((acc, p, i) => acc + Math.abs((p.y - points[i].y)), 0) / points.length;
    case 'Expansion':
      return points.reduce((acc, p, i) => acc + Math.abs(Math.hypot(p.x - centerX, p.y - centerY) - (1 + i / points.length) * 0.6), 0) / points.length;
    case 'Recurrence':
      return points.reduce((acc, p, i) => acc + Math.abs(p.x - points[(i + Math.floor(points.length / 2)) % points.length].x), 0) / points.length;
    default:
      return 999;
  }
};


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
  role: entry?.narrative.role ?? 'observer' as const,
  conflictLevel: entry?.narrative.conflictLevel ?? 0,
  agencyLevel: entry?.narrative.agencyLevel ?? 0,
  closureLevel: entry?.narrative.closureLevel ?? 0,
});

export const ExplorerScreen = () => {
  const { entries, intentions, upsertEntry, addIntention, removeIntention, setGroupForEntries } = useGeomodeStore();
  const [mode, setMode] = useState<ModeId>('emotion');
  const [shapeId, setShapeId] = useState<ShapeId>('line');
  const [control, setControl] = useState(1);
  const [showLoad, setShowLoad] = useState(false);
  const [sliceMode, setSliceMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number }>();
  const [manualLayout, setManualLayout] = useState<Record<string, { x: number; y: number }>>({});
  const [dragPoint, setDragPoint] = useState<string>();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const basePoints = useMemo(() => toBasePoints(entries), [entries]);
  const shapedPoints = useMemo(() => {
    const computed = shapeProjection(shapeId, basePoints, control);
    if (mode !== 'correspondence') return computed;
    return computed.map((point) => ({ ...point, ...manualLayout[point.id] }));
  }, [shapeId, basePoints, control, mode, manualLayout]);
  const chartPoints = useMemo(() => projectPoints(shapedPoints, 980, 500), [shapedPoints]);

  const summaries = useMemo(() => computeSummary(entries), [entries]);
  const geometryMatches = useMemo(() => {
    const projected = chartPoints.map((p) => ({ x: p.px, y: p.py }));
    const models = ['Line', 'Cycle', 'Spiral', 'Helix', 'Torus', 'Oscillation', 'Expansion', 'Recurrence'];
    const ranked = models.map((model) => {
      const error = fitError(projected, model);
      return { model, confidence: Math.round(clamp(100 - error * 8, 8, 98)), error };
    }).sort((a, b) => b.confidence - a.confidence);
    return ranked.slice(0, 4);
  }, [chartPoints]);

  const progress = useMemo(() => intentions.map((intent) => {
    let metric = 0.5;
    if (intent.label.includes('calm')) {
      metric = entries.length === 0 ? 0 : entries.filter((e) => e.emotion.primaryEmotion === 'calm').length / entries.length;
    } else if (intent.label.includes('volatility')) {
      const vals = entries.map((e) => e.emotion.valence);
      const vol = vals.slice(1).reduce((acc, value, i) => acc + Math.abs(value - vals[i]), 0) / Math.max(1, vals.length - 1);
      metric = clamp(1 - vol / 6, 0, 1);
    } else if (intent.label.includes('resolution')) {
      metric = entries.length === 0 ? 0 : entries.filter((e) => e.narrative.atoms.includes('resolution')).length / entries.length;
    }
    const distance = Math.abs(metric - intent.target);
    return { ...intent, score: Math.round((1 - distance) * 100) };
  }), [entries, intentions]);

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setControl((prev) => clamp(prev + Math.sign(event.deltaY) * -0.12, 0.5, 4));
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (mode === 'correspondence') {
      const nearest = [...chartPoints].sort((a, b) => Math.hypot(a.px - x, a.py - y) - Math.hypot(b.px - x, b.py - y))[0];
      if (nearest && Math.hypot(nearest.px - x, nearest.py - y) < 25) {
        setDragPoint(nearest.id);
      }
      return;
    }

    if (!sliceMode) return;
    setSelectionBox({ x, y, w: 0, h: 0 });
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (mode === 'correspondence' && dragPoint) {
      const target = chartPoints.find((point) => point.id === dragPoint);
      if (!target) return;
      const dx = (x - target.px) / 40;
      const dy = (target.py - y) / 40;
      setManualLayout((prev) => ({ ...prev, [dragPoint]: { x: target.x + dx, y: target.y + dy } }));
      return;
    }

    if (!sliceMode || !selectionBox) return;
    setSelectionBox((prev) => prev ? { ...prev, w: x - prev.x, h: y - prev.y } : prev);
  };

  const onPointerUp = () => {
    if (mode === 'correspondence') {
      setDragPoint(undefined);
      return;
    }
    if (selectionBox) {
      const left = Math.min(selectionBox.x, selectionBox.x + selectionBox.w);
      const right = Math.max(selectionBox.x, selectionBox.x + selectionBox.w);
      const top = Math.min(selectionBox.y, selectionBox.y + selectionBox.h);
      const bottom = Math.max(selectionBox.y, selectionBox.y + selectionBox.h);
      setSelectedIds(new Set(chartPoints.filter((point) => point.px >= left && point.px <= right && point.py >= top && point.py <= bottom).map((point) => point.id)));
    }
    setSelectionBox(undefined);
  };

  const active = entries.find((entry) => entry.date === date);
  const activeEmotion = emotionState(active);
  const activeNarrative = narrativeState(active);

  return (
    <section className="geomode-shell" onWheel={onWheel}>
      <header className="top-bar">
        <strong>GEOMODE</strong>
        <div className="mode-tabs">
          {(['emotion', 'narrative', 'correspondence'] as const).map((item) => (
            <button key={item} className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>{item.replace('_', ' ')}</button>
          ))}
        </div>
        <button onClick={() => setShowLoad((p) => !p)}>Advanced CSV import</button>
      </header>

      <div className="content-grid">
        <aside className="left-panel">
          <label>Date <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>

          {mode === 'emotion' && (
            <div className="panel-block">
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
            </div>
          )}

          {mode === 'narrative' && (
            <div className="panel-block">
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
              {([
                ['Conflict Level', activeNarrative.conflictLevel, 'conflictLevel'],
                ['Agency Level', activeNarrative.agencyLevel, 'agencyLevel'],
                ['Closure Level', activeNarrative.closureLevel, 'closureLevel'],
              ] as const).map(([label, value, key]) => (
                <label key={key}>{label}: {value}
                  <input type="range" min={0} max={5} step={1} value={value} onChange={(event) => upsertEntry(date, { narrative: { ...activeNarrative, [key]: Number(event.target.value) } })} />
                </label>
              ))}
            </div>
          )}

          {mode === 'correspondence' && (
            <div className="panel-block">
              <h3>Timeline cards</h3>
              {entries.map((entry) => (
                <button key={entry.id} className="entry-card" onClick={() => setSelectedIds(new Set([entry.id]))}>
                  <span>{entry.date}</span>
                  <span>{entry.emotion.primaryEmotion}</span>
                </button>
              ))}
              {selectedIds.size > 0 && <button onClick={() => setGroupForEntries([...selectedIds], `group-${Date.now()}`)}>Group selected</button>}
            </div>
          )}
        </aside>

        <section className="center-panel">
          <div className="shape-strip inline">
            {SHAPES.map((shape) => (
              <button key={shape} className={shapeId === shape ? 'selected' : ''} onClick={() => setShapeId(shape)}>{shape}</button>
            ))}
            <span className="hint">Scroll to adjust shape</span>
            {mode !== 'correspondence' && <button className={sliceMode ? 'active' : ''} onClick={() => setSliceMode((p) => !p)}>Slice</button>}
          </div>

          {entries.length > 0 ? (
            <SimpleChart
              width={980}
              height={500}
              points={shapedPoints}
              highlightIds={selectedIds}
              selectionBox={selectionBox}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          ) : <p className="empty-state">Start by recording an emotional day.</p>}

          {sliceMode && selectedIds.size > 0 && (
            <div className="bottom-bar extract-bar">
              <span>{selectedIds.size} moments selected</span>
              <button onClick={() => setSelectedIds(new Set([...selectedIds]))}>Extract Pattern</button>
            </div>
          )}
        </section>

        <aside className="right-panel">
          <h3>Closest Geometry Matches</h3>
          {geometryMatches.map((match) => <p key={match.model}>✓ {match.model} ({match.confidence}%)</p>)}
          <h3>Pattern summaries</h3>
          {summaries.map((summary) => <p key={summary}>{summary}</p>)}
          <h3>Intentions</h3>
          <div className="intent-grid">
            {INTENTIONS.map((intent) => <button key={intent.label} onClick={() => addIntention(intent.label, intent.target)}>{intent.label}</button>)}
          </div>
          {progress.map((item) => (
            <div key={item.id} className="progress-row">
              <span>{item.label}</span>
              <div><i style={{ width: `${item.score}%` }} /></div>
              <button onClick={() => removeIntention(item.id)}>×</button>
            </div>
          ))}
        </aside>
      </div>

      {showLoad && <DatasetImport onLoaded={() => setShowLoad(false)} />}
    </section>
  );
};
