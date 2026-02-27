import { useMemo, useState } from 'react';
import { inferSchema, parseCsv } from '../../core/schema/csv';
import { useGeomodeStore } from '../../state/store';
import type { FieldType, ViewConfig } from '../../types/models';

const SAMPLE_CSV = `date,value,group\n2024-01-01,10,A\n2024-01-02,12,A\n2024-01-03,9,B\n2024-01-04,11,B\n2024-01-05,8,A\n2024-01-06,14,A\n2024-01-07,7,B\n2024-01-08,15,B`;

export const DatasetImport = () => {
  const addDataset = useGeomodeStore((s) => s.addDataset);
  const [name, setName] = useState('Sample Dataset');
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [error, setError] = useState<string>();
  const [typeOverrides, setTypeOverrides] = useState<Record<string, FieldType>>({});
  const [indexFieldOverride, setIndexFieldOverride] = useState<string>('');

  const preview = useMemo(() => {
    try {
      const dataset = parseCsv(name || 'Untitled Dataset', csvText);
      const inferred = inferSchema(dataset);
      return { dataset, inferred };
    } catch {
      return undefined;
    }
  }, [name, csvText]);

  const importDataset = () => {
    try {
      const dataset = parseCsv(name || 'Untitled Dataset', csvText);
      const inferred = inferSchema(dataset);
      const schema = {
        ...inferred,
        indexField: indexFieldOverride || inferred.indexField,
        fields: inferred.fields.map((field) => ({
          ...field,
          type: typeOverrides[field.name] ?? field.type,
        })),
      };

      const numericField = schema.fields.find((f) => f.type === 'number')?.name ?? schema.indexField;
      const viewConfig: ViewConfig = {
        datasetId: dataset.id,
        embeddingDim: 2,
        xField: schema.indexField,
        yField: numericField,
      };

      addDataset(dataset, schema, viewConfig);
      setError(undefined);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="load-panel">
      <h2>Load</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dataset name" />
      <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={8} />
      {preview && (
        <div className="load-field-grid">
          {preview.inferred.fields.map((field) => (
            <div key={field.name} className="load-field-row">
              <span>{field.name}</span>
              <select
                value={typeOverrides[field.name] ?? field.type}
                onChange={(e) => setTypeOverrides((prev) => ({ ...prev, [field.name]: e.target.value as FieldType }))}
              >
                <option value="number">number</option>
                <option value="category">category</option>
                <option value="time">time</option>
              </select>
              <label>
                <input
                  type="radio"
                  name="indexField"
                  checked={(indexFieldOverride || preview.inferred.indexField) === field.name}
                  onChange={() => setIndexFieldOverride(field.name)}
                />
                index
              </label>
            </div>
          ))}
        </div>
      )}
      <button onClick={importDataset}>Load</button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
};
