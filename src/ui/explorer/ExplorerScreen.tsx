import { useEffect, useMemo, useState, type PointerEvent } from 'react';
import type { EmbeddedPoint } from '../../types/models';
import { useGeomodeStore, type GeomodeEntry } from '../../state/store';
import { projectPoints, SimpleChart } from '../components/SimpleChart';

const SHAPES = ['sphere', 'hypersphere', 'tesseract', 'simplex4'] as const;
type ShapeId = (typeof SHAPES)[number];
type GraphLayer = 'emotion' | 'narrative' | 'both';

const INTENTIONS = [
  { label: 'Stabilize weekly baseline', target: 0.75 },
  { label: 'Increase calm frequency', target: 0.8 },
  { label: 'Increase resolution days', target: 0.7 },
  { label: 'Reduce volatility', target: 0.25 },
  { label: 'Balance valence/arousal', target: 0.6 },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const shapeProjection = (shapeId: ShapeId, points: EmbeddedPoint[]) => points.map((point, i) => {
  const t = i / Math.max(1, points.length - 1);
  const theta = t * Math.PI * 2;
  const phi = t * Math.PI;

  switch (shapeId) {
    case 'sphere':
      return {
        ...point,
        x: Math.cos(theta) * Math.sin(phi) * 2.3,
        y: Math.cos(phi) * 2.3,
        z: Math.sin(theta) * Math.sin(phi) * 2.3,
      };
    case 'hypersphere': {
      const chi = t * Math.PI * 1.5;
      const w = Math.cos(chi);
      return {
        ...point,
        x: Math.cos(theta) * Math.sin(phi) * (1.4 + w),
        y: Math.sin(theta) * Math.sin(phi) * (1.4 + w),
        z: Math.cos(phi) * (1.4 + w),
      };
    }
    case 'tesseract': {
      const corners = [
        [-1, -1, -1, -1], [1, -1, -1, -1], [-1, 1, -1, -1], [1, 1, -1, -1],
        [-1, -1, 1, -1], [1, -1, 1, -1], [-1, 1, 1, -1], [1, 1, 1, -1],
        [-1, -1, -1, 1], [1, -1, -1, 1], [-1, 1, -1, 1], [1, 1, -1, 1],
        [-1, -1, 1, 1], [1, -1, 1, 1], [-1, 1, 1, 1], [1, 1, 1, 1],
      ] as const;
      const idx = Math.floor(t * corners.length) % corners.length;
      const [x, y, z, w] = corners[idx];
      const perspective4d = 1 / (2.4 - w * 0.75);
      return {
        ...point,
        x: x * perspective4d * 3,
        y: y * perspective4d * 3,
        z: z * perspective4d * 3,
      };
    }
    case 'simplex4': {
      const verts = [
        [1, 1, 1, -1 / Math.sqrt(5)],
        [1, -1, -1, -1 / Math.sqrt(5)],
        [-1, 1, -1, -1 / Math.sqrt(5)],
        [-1, -1, 1, -1 / Math.sqrt(5)],
        [0, 0, 0, 4 / Math.sqrt(5)],
      ] as const;
      const idx = Math.floor(t * verts.length) % verts.length;
      const [x, y, z, w] = verts[idx];
      const perspective4d = 1 / (2.2 - w * 0.65);
      return {
        ...point,
        x: x * perspective4d * 3,
        y: y * perspective4d * 3,
        z: z * perspective4d * 3,
      };
    }
  }
});

const toEmotionPoints = (entries: GeomodeEntry[]): EmbeddedPoint[] => entries.map((entry, index) => ({
  id: `${entry.id}|emotion`,
  index,
  x: index,
  y: entry.emotion.valence,
  z: entry.emotion.arousal - 2,
}));

const toNarrativePoints = (entries: GeomodeEntry[]): EmbeddedPoint[] => entries.map((entry, index) => ({
  id: `${entry.id}|narrative`,
  index,
  x: index,
  y: entry.narrative.agencyLevel - entry.narrative.conflictLevel,
  z: entry.narrative.closureLevel - 2,
}));

const computeSummary = (entries: GeomodeEntry[]) => {
  if (entries.length === 0) return [];
  const valences = entries.map((entry) => entry.emotion.valence);
  const meanValence = valences.reduce((a, b) => a + b, 0) / valences.length;
  const volatility = valences.slice(1).reduce((acc, value, i) => acc + Math.abs(value - valences[i]), 0) / Math.max(1, valences.length - 1);
  const calmRate = entries.filter((entry) => entry.emotion.primaryEmotion === 'calm').length / entries.length;
  const resolutionRate = entries.filter((entry) => entry.narrative.atoms.includes('resolution')).length / entries.length;

  return [
    meanValence >= 1 ? 'Mean valence is mostly positive.' : meanValence <= -1 ? 'Mean valence is mostly negative.' : 'Mean valence is balanced.',
    volatility > 2 ? `High volatility across last ${Math.min(7, entries.length)} entries.` : 'Volatility is steady.',
    calmRate > 0.4 ? 'Calm appears often in logged days.' : 'Calm appears infrequently in logged days.',
    resolutionRate > 0.35 ? 'Resolution atoms are recurring in narrative tags.' : 'Resolution atoms are still sparse.',
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

  switch (model) {
    case 'Line':
      return points.reduce((acc, p, i) => acc + Math.abs(p.y - (points[0].y + (yTrend / points.length) * i)), 0) / points.length;
    case 'Cycle':
      return radii.reduce((acc, r) => acc + Math.abs(r - avgR), 0) / points.length;
    case 'Spiral':
      return points.reduce((acc, p, i) => acc + Math.abs(Math.hypot(p.x - centerX, p.y - centerY) - (i / points.length) * avgR * 1.8), 0) / points.length;
    case 'Helix':
      return points.reduce((acc, p) => acc + Math.abs(Math.abs(p.x - centerX) - avgR), 0) / points.length;
    default:
      return 999;
  }
};

export const ExplorerScreen = () => {
  const { entries, intentions, addIntention, removeIntention } = useGeomodeStore();
  const [shapeId, setShapeId] = useState<ShapeId>('sphere');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number }>();
  const [graphLayer, setGraphLayer] = useState<GraphLayer>('both');
  const [rotation, setRotation] = useState({ yaw: 0.4, pitch: -0.3, roll: 0 });
  const [rotating, setRotating] = useState<{ x: number; y: number }>();
  const [autoSpin, setAutoSpin] = useState(true);

  const basePoints = useMemo(() => {
    if (graphLayer === 'emotion') return toEmotionPoints(entries);
    if (graphLayer === 'narrative') return toNarrativePoints(entries);
    return [...toEmotionPoints(entries), ...toNarrativePoints(entries)];
  }, [entries, graphLayer]);

  const shapedPoints = useMemo(() => shapeProjection(shapeId, basePoints), [shapeId, basePoints]);
  const chartPoints = useMemo(() => projectPoints(shapedPoints, 1300, 650, rotation), [shapedPoints, rotation]);

  const summaries = useMemo(() => computeSummary(entries), [entries]);
  const geometryMatches = useMemo(() => {
    const projected = chartPoints.map((p) => ({ x: p.px, y: p.py }));
    const models = ['Line', 'Cycle', 'Spiral', 'Helix'];
    return models.map((model) => {
      const error = fitError(projected, model);
      return { model, confidence: Math.round(clamp(100 - error * 8, 8, 98)) };
    }).sort((a, b) => b.confidence - a.confidence);
  }, [chartPoints]);


  useEffect(() => {
    if (!autoSpin || rotating) return;
    const id = window.setInterval(() => {
      setRotation((prev) => ({ ...prev, yaw: prev.yaw + 0.02 }));
    }, 40);
    return () => window.clearInterval(id);
  }, [autoSpin, rotating]);

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

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.shiftKey || event.button === 1 || event.button === 2) {
      setRotating({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      return;
    }
    setSelectionBox({ x: event.clientX - rect.left, y: event.clientY - rect.top, w: 0, h: 0 });
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (rotating) {
      const dx = x - rotating.x;
      const dy = y - rotating.y;
      setRotation((prev) => ({
        ...prev,
        yaw: prev.yaw + dx * 0.015,
        pitch: clamp(prev.pitch + dy * 0.012, -1.3, 1.3),
      }));
      setRotating({ x, y });
      return;
    }
    if (!selectionBox) return;
    setSelectionBox((prev) => prev ? { ...prev, w: x - prev.x, h: y - prev.y } : prev);
  };

  const onPointerUp = () => {
    if (rotating) {
      setRotating(undefined);
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

  return (
    <section className="geomode-shell">
      <header className="top-bar">
        <strong>GEOMODE — Geometry map</strong>
      </header>

      <div className="content-grid">
        <aside className="left-panel panel-block">
          <h3>Timeline cards</h3>
          {entries.map((entry) => (
            <button key={entry.id} className="entry-card" onClick={() => setSelectedIds(new Set([`${entry.id}|emotion`, `${entry.id}|narrative`]))}>
              <span>{entry.date}</span>
              <span>{entry.emotion.primaryEmotion}</span>
            </button>
          ))}
        </aside>

        <section className="center-panel">
          <div className="shape-strip inline">
            {SHAPES.map((shape) => (
              <button key={shape} className={shapeId === shape ? 'selected' : ''} onClick={() => setShapeId(shape)}>{shape}</button>
            ))}
            <button onClick={() => setAutoSpin((prev) => !prev)}>{autoSpin ? 'Pause spin' : 'Auto spin'}</button>
            <span className="hint">Shift+drag/middle-drag = rotate 3D · Click nodes = toggle highlight · Drag box = range highlight</span>
          </div>
          <label>Graph layer
            <select value={graphLayer} onChange={(event) => setGraphLayer(event.target.value as GraphLayer)}>
              <option value="emotion">Emotion only</option>
              <option value="narrative">Narrative only</option>
              <option value="both">Both together</option>
            </select>
          </label>

          {entries.length > 0 ? (
            <SimpleChart
              width={1300}
              height={650}
              points={shapedPoints}
              highlightIds={selectedIds}
              selectionBox={selectionBox}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointClick={(id) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              rotation={rotation}
            />
          ) : <p className="empty-state">No logs yet. Add entries on the Daily log page first.</p>}
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
    </section>
  );
};
