const DB_NAME = 'geomode_db';
const STORE_NAME = 'kv';
const STATE_KEY = 'geomode_state_v1';

const openDb = async (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onerror = () => reject(request.error);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  };
  request.onsuccess = () => resolve(request.result);
});

export const saveState = async (state: string): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(state, STATE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

export const loadState = async (): Promise<string | null> => {
  const db = await openDb();
  const value = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve((request.result as string | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
};
