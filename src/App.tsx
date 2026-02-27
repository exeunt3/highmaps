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
      <h1>GEOMODE</h1>
      <p className="app-subtitle">A vivid geometry playground for transforming and extracting shape-driven datasets.</p>
      <DatasetImport />
      <ExplorerScreen />
      <DerivedDatasetViewer />
    </main>
  );
};
