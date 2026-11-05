/**
 * Uploaded images live in IndexedDB (not localStorage), keyed by an asset
 * id. Room JSON only stores the id. Assets are never deleted automatically
 * — only when the user removes them from the image library.
 */

const DB_NAME = "internetrooms-assets";
const DB_VERSION = 1;
const STORE = "assets";

export interface StoredAsset {
  id: string;
  blob: Blob;
  /** MIME type of the stored (re-encoded) image. */
  type: string;
  width: number;
  height: number;
  size: number;
  createdAt: string;
}

export type AssetSummary = Omit<StoredAsset, "blob">;

let dbPromise: Promise<IDBDatabase> | null = null;
const listeners = new Set<() => void>();
const urlCache = new Map<string, Promise<string | null>>();

export function isAssetStoreAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (!isAssetStoreAvailable()) {
    return Promise.reject(new Error("This browser can't store uploaded images."));
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Couldn't open image storage."));
    }).catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        let result: T;
        request.onsuccess = () => {
          result = request.result;
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error ?? new Error("Image storage error."));
        tx.onabort = () => reject(tx.error ?? new Error("Image storage was interrupted."));
      }),
  );
}

function notify() {
  for (const listener of listeners) listener();
}

/** Subscribe to asset additions/removals. Returns an unsubscribe function. */
export function subscribeToAssets(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function putAsset(asset: StoredAsset): Promise<void> {
  await run("readwrite", (store) => store.put(asset));
  notify();
}

export async function getAsset(id: string): Promise<StoredAsset | null> {
  const asset = await run<StoredAsset | undefined>("readonly", (store) => store.get(id));
  return asset ?? null;
}

export async function listAssets(): Promise<AssetSummary[]> {
  const all = await run<StoredAsset[]>("readonly", (store) => store.getAll());
  return all
    .map(({ blob: _blob, ...summary }) => summary)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteAsset(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
  const cached = urlCache.get(id);
  urlCache.delete(id);
  const url = await cached;
  if (url) URL.revokeObjectURL(url);
  notify();
}

/**
 * Returns a blob: URL for an asset, or null if it no longer exists. URLs
 * are cached for the session so every widget showing the same asset
 * shares one URL.
 */
export function getAssetUrl(id: string): Promise<string | null> {
  let cached = urlCache.get(id);
  if (!cached) {
    cached = getAsset(id)
      .then((asset) => (asset ? URL.createObjectURL(asset.blob) : null))
      .catch(() => null);
    urlCache.set(id, cached);
    // Don't cache misses forever: the asset might be uploaded later.
    void cached.then((url) => {
      if (url === null) urlCache.delete(id);
    });
  }
  return cached;
}

/** For tests: forget the open connection and cached URLs. */
export function resetAssetStoreForTests() {
  dbPromise?.then((db) => db.close()).catch(() => {});
  dbPromise = null;
  urlCache.clear();
  listeners.clear();
}
