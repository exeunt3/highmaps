import { useEffect, useMemo, useState, type PointerEventHandler, type WheelEventHandler } from 'react';
import { buildEmbedding } from '../../core/embedding/buildEmbedding';
import { datasetToCsv, datasetToJson, downloadText } from '../../core/derive/export';
import { extractorRegistry } from '../../core/extractors/registry';
import { transformRegistry } from '../../core/transforms/registry';
import { useGeomodeStore } from '../../state/store';
import type { EmbeddedPoint } from '../../types/models';
import { SimpleChart } from '../components/SimpleChart';
import { DatasetImport } from '../dataset/DatasetImport';

const SHAPES = [
  { id: 'line', label: 'Line' },
  { id: 'circle', label: 'Circle' },
  { id: 'spiral', label: 'Spiral' },
  { id: 'helix', label: 'Helix' },
  { id: 'cylinder', label: 'Cylinder' },
  { id: 'torus', label: 'Torus' },
  { id: 'sphere_projection', label: 'Sphere projection' },
  { id: 'mobius_strip', label: 'Möbius strip' },
  { id: 'klein_projection', label: 'Klein bottle projection' },
  { id: 'hyperbolic_disk', label: 'Hyperbolic disk' },
  { id: 'hypersphere_projection', label: 'Hypersphere projection' },
  { id: 'tesseract_projection', label: 'Tesseract projection' },
] as const;

const shapeProjection = (shapeId: string, points: EmbeddedPoint[], period: number, radiusScale: number, tightness: number) => {
  const safePeriod = Math.max(1, period);
  return points.map((point, i) => {
    const t = i / safePeriod;
    const theta = 2 * Math.PI * t * tightness;
    const radius = radiusScale * (0.5 + t * 0.18);

    switch (shapeId) {
      case 'line':
        return { ...point, x: i, y: 0 };
      case 'circle':
        return { ...point, x: Math.cos(theta) * radiusScale, y: Math.sin(theta) * radiusScale };
      case 'spiral':
        return { ...point, x: radius * Math.cos(theta), y: radius * Math.sin(theta) };
      case 'helix':
        return { ...point, x: Math.cos(theta) * radiusScale, y: (Math.sin(theta * 0.5) + t) * radiusScale };
      case 'cylinder':
        return { ...point, x: Math.cos(theta) * radiusScale, y: (i % safePeriod) / safePeriod * 5 - 2.5 };
      case 'torus': {
        const phi = 2 * Math.PI * (i / Math.max(points.length, 1));
        const ring = 1.4 + 0.5 * Math.cos(theta);
        return { ...point, x: ring * Math.cos(phi), y: ring * Math.sin(phi) + 0.6 * Math.sin(theta) };
      }
      case 'sphere_projection':
        return { ...point, x: Math.cos(theta) * Math.sin(t), y: Math.cos(t * Math.PI) };
      case 'mobius_strip': {
        const u = 2 * Math.PI * (i / Math.max(points.length, 1));
        const v = Math.sin(theta) * 0.8;
        return { ...point, x: (1 + (v / 2) * Math.cos(u / 2)) * Math.cos(u), y: (1 + (v / 2) * Math.cos(u / 2)) * Math.sin(u) };
      }
      case 'klein_projection': {
        const u = 2 * Math.PI * (i / Math.max(points.length, 1));
        return { ...point, x: Math.cos(u) * (Math.cos(theta) + 1.5), y: Math.sin(u) * (Math.cos(theta) + 0.7) };
      }
      case 'hyperbolic_disk': {
        const r = Math.tanh(t * radiusScale * 0.45);
        return { ...point, x: r * Math.cos(theta), y: r * Math.sin(theta) };
      }
      case 'hypersphere_projection': {
        const psi = 2 * Math.PI * (i / Math.max(points.length, 1));
        return { ...point, x: Math.sin(theta) * Math.cos(psi), y: Math.sin(psi) * Math.cos(theta * 0.5) };
      }
      case 'tesseract_projection': {
        const q = Math.sin(theta);
        return { ...point, x: Math.sign(q) * (1 + 0.4 * Math.cos(theta * 2)), y: Math.sign(Math.cos(theta)) * (1 + 0.4 * Math.sin(theta * 2)) };
      }
      default:
        return point;
    }
  });
};

export const ExplorerScreen = () => {
  const {
    datasets,
    schemas,
    viewConfigs,
    selectedDatasetId,
    setSelectedDataset,
    transformConfig,
    setTransformConfig,
    extractorConfig,
    addDerivedDataset,
    derivedDatasets,
    selectedDerivedId,
    setSelectedDerived,
  } = useGeomodeStore();

  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 300, y: 260 });
  const [shapeId, setShapeId] = useState<(typeof SHAPES)[number]['id']>('spiral');
  const [showLoadPanel, setShowLoadPanel] = useState(datasets.length === 0);
  const [hint, setHint] = useState('Scroll changes period • drag changes radius/tightness • Shift+drag changes phase');
  const [isDragging, setIsDragging] = useState(false);
  const [sliceMode, setSliceMode] = useState(false);
  const [sliceOffset, setSliceOffset] = useState(0);
  const [sliceAngle, setSliceAngle] = useState(0);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId) ?? datasets[0];
  const schema = selectedDataset ? schemas[selectedDataset.id] : undefined;
  const viewConfig = selectedDataset ? viewConfigs[selectedDataset.id] : undefined;
  const selectedDerived = derivedDatasets.find((d) => d.id === selectedDerivedId) ?? derivedDatasets[0];

  useEffect(() => {
    if (datasets.length > 0) setShowLoadPanel(false);
  }, [datasets.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        setShapeMenuOpen((prev) => !prev);
      }
      if (event.key.toLowerCase() === 's') {
        setSliceMode((prev) => !prev);
        setHint('Slice mode: drag to move plane, Shift+drag rotates plane, Enter commits cut.');
      }
      if (event.key === 'Enter' && sliceMode && selectedDataset) {
        const extractor = extractorRegistry.get('phase_trace');
        const derived = extractor.materialize(selectedDataset, projectedPoints, extractorConfig.params);
        addDerivedDataset({ ...derived, name: `${selectedDataset.name} - sliced` });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sliceMode, selectedDataset, addDerivedDataset, extractorConfig.params]);

  const baselinePoints = useMemo(() => {
    if (!selectedDataset || !schema || !viewConfig) return [];
    return buildEmbedding(selectedDataset, schema, viewConfig);
  }, [selectedDataset, schema, viewConfig]);

  const transformDef = transformRegistry.get('spiral_wrap_2d');
  const transformedPoints = useMemo(
    () => transformDef.apply(baselinePoints, transformConfig.params),
    [baselinePoints, transformDef, transformConfig.params],
  );

  const projectedPoints = useMemo(
    () => shapeProjection(
      shapeId,
      transformedPoints,
      transformConfig.params.period ?? 7,
      transformConfig.params.radius_scale ?? 1,
      transformConfig.params.tightness ?? 1,
    ),
    [shapeId, transformedPoints, transformConfig.params.period, transformConfig.params.radius_scale, transformConfig.params.tightness],
  );

  const highlighted = useMemo(() => {
    if (!sliceMode) return extractorRegistry.get('phase_trace').preview(projectedPoints, extractorConfig.params);

    const selected = new Set<string>();
    const nx = Math.cos(sliceAngle);
    const ny = Math.sin(sliceAngle);

    projectedPoints.forEach((point) => {
      const distance = point.x * nx + point.y * ny - sliceOffset;
      if (Math.abs(distance) < 0.15) selected.add(point.id);
    });

    return selected;
  }, [sliceMode, projectedPoints, extractorConfig.params, sliceAngle, sliceOffset]);

  const onWheel: WheelEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    const delta = Math.sign(event.deltaY);
    setTransformConfig({
      transformId: 'spiral_wrap_2d',
      params: {
        ...transformConfig.params,
        period: Math.max(2, (transformConfig.params.period ?? 7) - delta),
      },
    });
    setHint(`Period ${Math.max(2, (transformConfig.params.period ?? 7) - delta)} • shape ${SHAPES.find((shape) => shape.id === shapeId)?.label}`);
  };

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    if (!isDragging) return;

    if (sliceMode) {
      if (event.shiftKey) {
        setSliceAngle((prev) => prev + event.movementX * 0.01);
      } else {
        setSliceOffset((prev) => prev + (event.movementX - event.movementY) * 0.004);
      }
      return;
    }

    if (event.shiftKey) {
      const phase = Math.max(0, Math.round((extractorConfig.params.phase ?? 0) + event.movementX * 0.06));
      useGeomodeStore.setState({
        extractorConfig: {
          ...extractorConfig,
          params: {
            ...extractorConfig.params,
            phase,
          },
        },
      });
      setHint(`Phase ${phase}`);
      return;
    }

    const nextRadius = Math.max(0.2, (transformConfig.params.radius_scale ?? 1) + event.movementY * -0.008);
    const nextTightness = Math.max(0.2, (transformConfig.params.tightness ?? 1) + event.movementX * 0.006);

    setTransformConfig({
      transformId: 'spiral_wrap_2d',
      params: {
        ...transformConfig.params,
        radius_scale: nextRadius,
        tightness: nextTightness,
      },
    });
    setHint(`Radius ${nextRadius.toFixed(2)} • Tightness ${nextTightness.toFixed(2)}`);
  };

  const onPointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const runSlice = () => {
    if (!selectedDataset) return;
    const extractor = extractorRegistry.get('phase_trace');
    const nextParams = {
      period: Math.max(2, Math.round(transformConfig.params.period ?? 7)),
      phase: Math.max(0, Math.round(extractorConfig.params.phase ?? 0)),
    };
    const derived = extractor.materialize(selectedDataset, projectedPoints, nextParams);
    addDerivedDataset({ ...derived, name: `${selectedDataset.name} - slice` });
    setHint('Slice materialized as new object.');
  };

  return (
    <section className="instrument-shell" onContextMenu={(event) => {
      event.preventDefault();
      setMenuPosition({ x: event.clientX, y: event.clientY });
      setShapeMenuOpen(true);
    }}>
      <div className="hud top-left">
        <strong>GEOMODE</strong>
        <div className="hud-row">
          <button onClick={() => setShowLoadPanel((prev) => !prev)}>Load</button>
          <button onClick={() => setSliceMode((prev) => !prev)} className={sliceMode ? 'active' : ''}>Slice (S)</button>
          {selectedDerived && (
            <>
              <button onClick={() => downloadText(`${selectedDerived.name}.csv`, datasetToCsv(selectedDerived), 'text/csv')}>Export CSV</button>
              <button onClick={() => downloadText(`${selectedDerived.name}.json`, datasetToJson(selectedDerived), 'application/json')}>Export JSON</button>
            </>
          )}
        </div>
      </div>

      {datasets.length > 0 && (
        <div className="hud top-right">
          <label>
            Object
            <select value={selectedDataset?.id} onChange={(e) => setSelectedDataset(e.target.value)}>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
              ))}
            </select>
          </label>
          {derivedDatasets.length > 0 && (
            <label>
              Slice
              <select value={selectedDerived?.id} onChange={(e) => setSelectedDerived(e.target.value)}>
                {derivedDatasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="hud bottom-center">{hint}</div>

      {showLoadPanel && <DatasetImport />}

      <div
        className="geometry-stage"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {baselinePoints.length === 0 ? <p className="empty-state">Load a dataset to enter the geometry field.</p> : (
          <SimpleChart points={projectedPoints} width={1100} height={650} highlightIds={highlighted} colorMode="vivid" />
        )}
        {sliceMode && <button className="slice-commit" onClick={runSlice}>Enter Slice</button>}
      </div>

      <button className="shape-trigger" onClick={() => setShapeMenuOpen((prev) => !prev)}>◌</button>
      {shapeMenuOpen && (
        <div className="shape-menu" style={{ left: menuPosition.x - 135, top: menuPosition.y - 135 }}>
          {SHAPES.map((shape, index) => {
            const angle = (Math.PI * 2 * index) / SHAPES.length - Math.PI / 2;
            const x = Math.cos(angle) * 96;
            const y = Math.sin(angle) * 96;
            return (
              <button
                key={shape.id}
                className={`shape-item ${shape.id === shapeId ? 'selected' : ''}`}
                style={{ transform: `translate(${x}px, ${y}px)` }}
                onClick={() => {
                  setShapeId(shape.id);
                  setShapeMenuOpen(false);
                  setHint(`Shape: ${shape.label}`);
                }}
              >
                {shape.label}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
