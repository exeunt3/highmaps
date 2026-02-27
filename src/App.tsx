import { useEffect, useMemo, useState } from 'react';
import './app.css';
import { useGeomodeStore } from './state/store';
import { ExplorerScreen } from './ui/explorer/ExplorerScreen';
import { LogScreen } from './ui/log/LogScreen';
import { SimulationScreen } from './ui/explorer/SimulationScreen';

type PageId = 'log' | 'map' | 'simulation';

const getPageFromHash = (): PageId => {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'map') return 'map';
  if (hash === 'simulation') return 'simulation';
  return 'log';
};

export const App = () => {
  const hydrate = useGeomodeStore((s) => s.hydrate);
  const hydrated = useGeomodeStore((s) => s.hydrated);
  const [page, setPage] = useState<PageId>(() => getPageFromHash());

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onHash = () => setPage(getPageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const title = useMemo(() => {
    if (page === 'map') return 'Geometry Map';
    if (page === 'simulation') return 'Year Simulation';
    return 'Daily Log';
  }, [page]);

  if (!hydrated) return <p className="boot">Initializing GEOMODE field…</p>;

  return (
    <main>
      <nav className="app-nav">
        <strong>{title}</strong>
        <div className="mode-tabs">
          <a href="#log" className={page === 'log' ? 'active' : ''}>Daily Log</a>
          <a href="#map" className={page === 'map' ? 'active' : ''}>Geometry Map</a>
          <a href="#simulation" className={page === 'simulation' ? 'active' : ''}>Simulation</a>
        </div>
      </nav>
      {page === 'map' && <ExplorerScreen />}
      {page === 'simulation' && <SimulationScreen />}
      {page === 'log' && <LogScreen />}
    </main>
  );
};
