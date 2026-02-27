import { buildEmbedding } from '../../core/embedding/buildEmbedding';
import { datasetToCsv, datasetToJson, downloadText } from '../../core/derive/export';
import { useGeomodeStore } from '../../state/store';
import type { FieldSchema, ViewConfig } from '../../types/models';
import { SimpleChart } from '../components/SimpleChart';

const makeDerivedSchema = (datasetId: string): FieldSchema => ({
  datasetId,
  indexField: 'cycle_number',
  fields: [
    { name: 'cycle_number', type: 'number' },
    { name: 'phase', type: 'number' },
  ],
});

const makeDerivedView = (datasetId: string): ViewConfig => ({
  datasetId,
  embeddingDim: 2,
  xField: 'cycle_number',
  yField: 'value',
});

export const DerivedDatasetViewer = () => {
  const { derivedDatasets, selectedDerivedId, setSelectedDerived } = useGeomodeStore();
  const selected = derivedDatasets.find((d) => d.id === selectedDerivedId) ?? derivedDatasets[0];

  if (!selected) {
    return <section><h2>3) Derived Dataset Viewer</h2><p>No derived datasets yet.</p></section>;
  }

  const points = buildEmbedding(selected, makeDerivedSchema(selected.id), makeDerivedView(selected.id));

  return (
    <section>
      <h2>3) Derived Dataset Viewer</h2>
      <label>Dataset: </label>
      <select value={selected.id} onChange={(e) => setSelectedDerived(e.target.value)}>
        {derivedDatasets.map((dataset) => (
          <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
        ))}
      </select>
      <p>Row count: {selected.rows.length}</p>
      <SimpleChart points={points} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => downloadText(`${selected.name}.csv`, datasetToCsv(selected), 'text/csv')}>Export CSV</button>
        <button onClick={() => downloadText(`${selected.name}.json`, datasetToJson(selected), 'application/json')}>Export JSON</button>
      </div>
    </section>
  );
};
