export type PrimitiveValue = string | number | boolean | null;

export interface DatasetRow {
  id: string;
  [field: string]: PrimitiveValue;
}

export interface Dataset {
  id: string;
  name: string;
  rows: DatasetRow[];
}

export type FieldType = 'number' | 'category' | 'time';

export interface SchemaField {
  name: string;
  type: FieldType;
}

export interface FieldSchema {
  datasetId: string;
  indexField: string;
  fields: SchemaField[];
}

export interface ViewConfig {
  datasetId: string;
  embeddingDim: 2 | 3;
  xField: string;
  yField: string;
  zField?: string;
}

export interface EmbeddedPoint {
  id: string;
  index: number;
  x: number;
  y: number;
  z?: number;
}

export interface TransformConfig {
  transformId: string;
  params: Record<string, number>;
}

export interface ExtractorConfig {
  extractorId: string;
  params: Record<string, number>;
}

export interface DerivedDataset extends Dataset {
  sourceDatasetId: string;
  extractorId: string;
}
