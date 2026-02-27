import { useEffect } from 'react';
import './app.css';
import { useGeomodeStore } from './state/store';
import { ExplorerScreen } from './ui/explorer/ExplorerScreen';

export const App = () => {
  const hydrate = useGeomodeStore((s) => s.hydrate);
  const hydrated = useGeomodeStore((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) return <p className="boot">Initializing GEOMODE field…</p>;

  return <main><ExplorerScreen /></main>;
};
