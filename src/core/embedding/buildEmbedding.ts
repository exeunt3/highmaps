import type { Dataset, EmbeddedPoint, FieldSchema, ViewConfig } from '../../types/models';

const asNumeric = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const date = Date.parse(value);
    if (!Number.isNaN(date)) return date;
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) return asNumber;
  }
  return 0;
};

export const buildEmbedding = (
  dataset: Dataset,
  schema: FieldSchema,
  viewConfig: ViewConfig,
): EmbeddedPoint[] => {
  const sortedRows = [...dataset.rows].sort((a, b) => {
    const av = asNumeric(a[schema.indexField]);
    const bv = asNumeric(b[schema.indexField]);
    return av - bv;
  });

  return sortedRows.map((row, index) => ({
    id: row.id,
    index,
    x: asNumeric(row[viewConfig.xField]),
    y: asNumeric(row[viewConfig.yField]),
    z: viewConfig.zField ? asNumeric(row[viewConfig.zField]) : undefined,
  }));
};
