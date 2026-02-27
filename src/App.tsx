import { useEffect } from 'react';
import './app.css';
import { useGeomodeStore } from './state/store';
import { DatasetImport } from './ui/dataset/DatasetImport';
import { ExplorerScreen } from './ui/explorer/ExplorerScreen';
import { DerivedDatasetViewer } from './ui/derived/DerivedDatasetViewer';

export const App = () => {
  const hydrate = useGeomodeStore((s) => s.hydrate);
  const hydrated = useGeomodeStore((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) return <p>Loading...</p>;

  return (
    <main>
      <h1>GEOMODE — Guided Geometry Explorer</h1>
      <p className="section-subtitle">
        Follow the three steps below to upload data, shape a view, and export a focused result.
      </p>
      <DatasetImport />
      <ExplorerScreen />
      <DerivedDatasetViewer />
    </main>
  );
};
