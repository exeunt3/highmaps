import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './core/transforms/defaults';
import './core/extractors/defaults';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
