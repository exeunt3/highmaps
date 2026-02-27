import { useMemo, useState } from 'react';
import { buildEmbedding } from '../../core/embedding/buildEmbedding';
import { extractorRegistry } from '../../core/extractors/registry';
import { transformRegistry } from '../../core/transforms/registry';
import { useGeomodeStore } from '../../state/store';
import { SimpleChart } from '../components/SimpleChart';

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
    setExtractorConfig,
    addDerivedDataset,
  } = useGeomodeStore();
  const [morph, setMorph] = useState(1);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId) ?? datasets[0];
  const schema = selectedDataset ? schemas[selectedDataset.id] : undefined;
  const viewConfig = selectedDataset ? viewConfigs[selectedDataset.id] : undefined;

  const baselinePoints = useMemo(() => {
    if (!selectedDataset || !schema || !viewConfig) return [];
    return buildEmbedding(selectedDataset, schema, viewConfig);
  }, [selectedDataset, schema, viewConfig]);

  const transformDef = transformRegistry.get(transformConfig.transformId);
  const transformedPoints = useMemo(
    () => transformDef.apply(baselinePoints, transformConfig.params),
    [baselinePoints, transformDef, transformConfig.params],
  );

  const morphedPoints = useMemo(
    () => baselinePoints.map((p, i) => {
      const t = transformedPoints[i] ?? p;
      return {
        ...p,
        x: p.x * (1 - morph) + t.x * morph,
        y: p.y * (1 - morph) + t.y * morph,
      };
    }),
    [baselinePoints, transformedPoints, morph],
  );

  const extractorDef = extractorRegistry.get(extractorConfig.extractorId);
  const previewSelection = useMemo(
    () => extractorDef.preview(transformedPoints, extractorConfig.params),
    [transformedPoints, extractorConfig, extractorDef],
  );

  const runExtraction = () => {
    if (!selectedDataset) return;
    const derived = extractorDef.materialize(selectedDataset, transformedPoints, extractorConfig.params);
    addDerivedDataset(derived);
  };

  if (!selectedDataset || !schema || !viewConfig) {
    return <section><h2>2) Shape Explorer</h2><p className="empty-state">Import a dataset to explore.</p></section>;
  }

  return (
    <section>
      <h2>2) Shape Explorer</h2>
      <div className="explorer-grid">
        <div className="panel">
          <label>Dataset: </label>
          <select value={selectedDataset.id} onChange={(e) => setSelectedDataset(e.target.value)}>
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
            ))}
          </select>
          <h4>Baseline Shape</h4>
          <SimpleChart points={baselinePoints} colorMode="cool" />
        </div>

        <div className="panel">
          <label>Transform: </label>
          <select
            value={transformConfig.transformId}
            onChange={(e) => {
              const next = transformRegistry.get(e.target.value);
              setTransformConfig({ transformId: next.id, params: { ...next.paramSchema } });
            }}
          >
            {transformRegistry.list().map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {Object.entries(transformDef.paramSchema).map(([key]) => (
            <label key={key} style={{ display: 'block' }}>
              {key}
              <input
                type="number"
                value={transformConfig.params[key] ?? 0}
                onChange={(e) => setTransformConfig({
                  ...transformConfig,
                  params: { ...transformConfig.params, [key]: Number(e.target.value) },
                })}
              />
            </label>
          ))}
          <label style={{ display: 'block' }}>
            Morph {morph.toFixed(2)}
            <input type="range" min={0} max={1} step={0.01} value={morph} onChange={(e) => setMorph(Number(e.target.value))} />
          </label>
          <h4>Vivid Morph</h4>
          <SimpleChart points={morphedPoints} highlightIds={previewSelection} colorMode="vivid" />
        </div>
      </div>

      <h3>Extractor</h3>
      <div className="controls-row">
        <label>Extractor: </label>
        <select
          value={extractorConfig.extractorId}
          onChange={(e) => {
            const next = extractorRegistry.get(e.target.value);
            setExtractorConfig({ extractorId: next.id, params: { ...next.paramSchema } });
          }}
        >
          {extractorRegistry.list().map((extractor) => (
            <option key={extractor.id} value={extractor.id}>{extractor.name}</option>
          ))}
        </select>
      </div>
      {Object.entries(extractorDef.paramSchema).map(([key]) => (
        <label key={key} style={{ display: 'block' }}>
          {key}
          <input
            type="number"
            value={extractorConfig.params[key] ?? 0}
            onChange={(e) => setExtractorConfig({
              ...extractorConfig,
              params: { ...extractorConfig.params, [key]: Number(e.target.value) },
            })}
          />
        </label>
      ))}
      <button onClick={runExtraction}>Materialize derived dataset</button>
    </section>
  );
};
