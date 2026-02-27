import { create } from 'zustand';
import { extractorRegistry } from '../core/extractors/registry';
import { transformRegistry } from '../core/transforms/registry';
import type {
  Dataset,
  DerivedDataset,
  ExtractorConfig,
  FieldSchema,
  TransformConfig,
  ViewConfig,
} from '../types/models';
import { loadState, saveState } from '../core/storage/indexedDb';

interface GeomodeState {
  datasets: Dataset[];
  schemas: Record<string, FieldSchema>;
  viewConfigs: Record<string, ViewConfig>;
  transformConfig: TransformConfig;
  extractorConfig: ExtractorConfig;
  derivedDatasets: DerivedDataset[];
  selectedDatasetId?: string;
  selectedDerivedId?: string;
  hydrated: boolean;
  addDataset: (dataset: Dataset, schema: FieldSchema, viewConfig: ViewConfig) => void;
  setSchema: (datasetId: string, schema: FieldSchema) => void;
  setViewConfig: (datasetId: string, viewConfig: ViewConfig) => void;
  setTransformConfig: (config: TransformConfig) => void;
  setExtractorConfig: (config: ExtractorConfig) => void;
  addDerivedDataset: (dataset: DerivedDataset) => void;
  setSelectedDataset: (datasetId: string) => void;
  setSelectedDerived: (datasetId?: string) => void;
  hydrate: () => Promise<void>;
}

const initialTransform = transformRegistry.list()[0];
const initialExtractor = extractorRegistry.list()[0];

export const useGeomodeStore = create<GeomodeState>((set, get) => ({
  datasets: [],
  schemas: {},
  viewConfigs: {},
  transformConfig: {
    transformId: initialTransform?.id ?? 'identity',
    params: initialTransform?.paramSchema ?? {},
  },
  extractorConfig: {
    extractorId: initialExtractor?.id ?? 'phase_trace',
    params: initialExtractor?.paramSchema ?? {},
  },
  derivedDatasets: [],
  hydrated: false,
  addDataset: (dataset, schema, viewConfig) => set((state) => ({
    datasets: [...state.datasets, dataset],
    schemas: { ...state.schemas, [dataset.id]: schema },
    viewConfigs: { ...state.viewConfigs, [dataset.id]: viewConfig },
    selectedDatasetId: dataset.id,
  })),
  setSchema: (datasetId, schema) => set((state) => ({ schemas: { ...state.schemas, [datasetId]: schema } })),
  setViewConfig: (datasetId, viewConfig) => set((state) => ({ viewConfigs: { ...state.viewConfigs, [datasetId]: viewConfig } })),
  setTransformConfig: (config) => set({ transformConfig: config }),
  setExtractorConfig: (config) => set({ extractorConfig: config }),
  addDerivedDataset: (dataset) => set((state) => ({
    derivedDatasets: [...state.derivedDatasets, dataset],
    selectedDerivedId: dataset.id,
  })),
  setSelectedDataset: (datasetId) => set({ selectedDatasetId: datasetId }),
  setSelectedDerived: (datasetId) => set({ selectedDerivedId: datasetId }),
  hydrate: async () => {
    const raw = await loadState();
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GeomodeState>;
      set({
        datasets: parsed.datasets ?? [],
        schemas: parsed.schemas ?? {},
        viewConfigs: parsed.viewConfigs ?? {},
        transformConfig: parsed.transformConfig ?? get().transformConfig,
        extractorConfig: parsed.extractorConfig ?? get().extractorConfig,
        derivedDatasets: parsed.derivedDatasets ?? [],
        selectedDatasetId: parsed.selectedDatasetId,
        selectedDerivedId: parsed.selectedDerivedId,
        hydrated: true,
      });
      return;
    }
    set({ hydrated: true });
  },
}));

useGeomodeStore.subscribe((state) => {
  if (!state.hydrated) return;
  const serializable = {
    datasets: state.datasets,
    schemas: state.schemas,
    viewConfigs: state.viewConfigs,
    transformConfig: state.transformConfig,
    extractorConfig: state.extractorConfig,
    derivedDatasets: state.derivedDatasets,
    selectedDatasetId: state.selectedDatasetId,
    selectedDerivedId: state.selectedDerivedId,
  };
  void saveState(JSON.stringify(serializable));
});
