import { useEffect, useMemo, useState } from 'react';
import './app.css';
import { useGeomodeStore } from './state/store';
import { ExplorerScreen } from './ui/explorer/ExplorerScreen';
import { LogScreen } from './ui/log/LogScreen';

type PageId = 'log' | 'map';

const getPageFromHash = (): PageId => {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'map') return 'map';
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
        </div>
      </nav>
      {page === 'map' && <ExplorerScreen />}
      {page === 'log' && <LogScreen />}
    </main>
  );
};
