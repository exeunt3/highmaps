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

export const PRIMARY_EMOTIONS = [
  'calm',
  'joy',
  'gratitude',
  'tenderness',
  'curiosity',
  'confidence',
  'awe',
  'desire',
  'playfulness',
  'focus',
  'anticipation',
  'hope',
  'sadness',
  'anxiety',
  'irritation',
  'anger',
  'frustration',
  'shame',
  'loneliness',
  'envy',
  'guilt',
  'confusion',
  'overwhelm',
  'fatigue',
  'numbness',
] as const;

export const NARRATIVE_ATOMS = [
  'beginning',
  'invitation',
  'departure',
  'commitment',
  'setup',
  'exploration',
  'rising_action',
  'training',
  'bonding',
  'search',
  'expansion',
  'complication',
  'conflict',
  'pressure',
  'reversal',
  'doubt',
  'fragmentation',
  'turning_point',
  'crisis',
  'climax',
  'revelation',
  'decision',
  'falling_action',
  'integration',
  'repair',
  'resolution',
  'return',
  'aftermath',
  'digression',
  'stasis',
  'echo',
  'recurrence',
] as const;

type Role = 'protagonist' | 'support' | 'observer';

export interface EmotionEntry {
  primaryEmotion: (typeof PRIMARY_EMOTIONS)[number];
  secondaryEmotions: Array<(typeof PRIMARY_EMOTIONS)[number]>;
  valence: number;
  arousal: number;
  energy: number;
  clarity: number;
  sociality: number;
  stressors: string[];
  regulators: string[];
  note?: string;
}

export interface NarrativeEntry {
  atoms: Array<(typeof NARRATIVE_ATOMS)[number]>;
  role: Role;
  conflictLevel: number;
  agencyLevel: number;
  closureLevel: number;
}

export interface GeomodeEntry {
  id: string;
  date: string;
  emotion: EmotionEntry;
  narrative: NarrativeEntry;
  groupId?: string;
}

export interface Intention {
  id: string;
  label: string;
  target: number;
}

interface GeomodeState {
  // legacy dataset path
  datasets: Dataset[];
  schemas: Record<string, FieldSchema>;
  viewConfigs: Record<string, ViewConfig>;
  transformConfig: TransformConfig;
  extractorConfig: ExtractorConfig;
  derivedDatasets: DerivedDataset[];
  selectedDatasetId?: string;
  selectedDerivedId?: string;

  // new product path
  entries: GeomodeEntry[];
  intentions: Intention[];

  hydrated: boolean;
  addDataset: (dataset: Dataset, schema: FieldSchema, viewConfig: ViewConfig) => void;
  setSchema: (datasetId: string, schema: FieldSchema) => void;
  setViewConfig: (datasetId: string, viewConfig: ViewConfig) => void;
  setTransformConfig: (config: TransformConfig) => void;
  setExtractorConfig: (config: ExtractorConfig) => void;
  addDerivedDataset: (dataset: DerivedDataset) => void;
  setSelectedDataset: (datasetId: string) => void;
  setSelectedDerived: (datasetId?: string) => void;

  upsertEntry: (date: string, update: { emotion?: Partial<EmotionEntry>; narrative?: Partial<NarrativeEntry>; groupId?: string }) => void;
  setGroupForEntries: (entryIds: string[], groupId?: string) => void;
  addIntention: (label: string, target: number) => void;
  removeIntention: (id: string) => void;
  hydrate: () => Promise<void>;
}

const initialTransform = transformRegistry.list()[0];
const initialExtractor = extractorRegistry.list()[0];

const defaultEmotion = (): EmotionEntry => ({
  primaryEmotion: 'calm',
  secondaryEmotions: [],
  valence: 0,
  arousal: 2,
  energy: 2,
  clarity: 2,
  sociality: 0,
  stressors: [],
  regulators: [],
  note: '',
});

const defaultNarrative = (): NarrativeEntry => ({
  atoms: [],
  role: 'observer',
  conflictLevel: 0,
  agencyLevel: 0,
  closureLevel: 0,
});

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
  entries: [],
  intentions: [],
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
  upsertEntry: (date, update) => set((state) => {
    const existing = state.entries.find((entry) => entry.date === date);
    if (existing) {
      return {
        entries: state.entries.map((entry) => entry.date === date ? {
          ...entry,
          ...update,
          emotion: { ...entry.emotion, ...update.emotion },
          narrative: { ...entry.narrative, ...update.narrative },
        } : entry),
      };
    }

    return {
      entries: [...state.entries, {
        id: crypto.randomUUID(),
        date,
        emotion: { ...defaultEmotion(), ...(update.emotion ?? {}) },
        narrative: { ...defaultNarrative(), ...(update.narrative ?? {}) },
        groupId: update.groupId,
      }].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }),
  setGroupForEntries: (entryIds, groupId) => set((state) => ({
    entries: state.entries.map((entry) => entryIds.includes(entry.id) ? { ...entry, groupId } : entry),
  })),
  addIntention: (label, target) => set((state) => ({
    intentions: [...state.intentions, { id: crypto.randomUUID(), label, target }],
  })),
  removeIntention: (id) => set((state) => ({ intentions: state.intentions.filter((item) => item.id !== id) })),
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
        entries: parsed.entries ?? [],
        intentions: parsed.intentions ?? [],
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
    entries: state.entries,
    intentions: state.intentions,
  };
  void saveState(JSON.stringify(serializable));
});
