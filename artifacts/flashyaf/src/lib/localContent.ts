// IndexedDB-backed storage for flash notes text and voice-note audio blobs,
// used when the user chooses to keep their journal content local-only
// (not synced to the cloud). Keyed by the flash document's id so it can be
// merged back in on read (see HistoryScreen.tsx).

const DB_NAME = "flashyaf_local_content";
const DB_VERSION = 1;
const STORE_NAME = "flashContent";

export interface LocalFlashContent {
  id: string; // matches the Firestore flash document id
  notes?: string;
  audioBlob?: Blob;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalFlashContent(
  id: string,
  data: { notes?: string; audioBlob?: Blob }
): Promise<void> {
  const db = await openDb();
  const existing = await getLocalFlashContent(id);
  const merged: LocalFlashContent = {
    ...(existing || { id, updatedAt: Date.now() }),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.audioBlob !== undefined ? { audioBlob: data.audioBlob } : {}),
    id,
    updatedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(merged);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalFlashContent(id: string): Promise<LocalFlashContent | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllLocalFlashContent(): Promise<LocalFlashContent[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Ask the browser to grant persistent storage so local-only notes and voice
// recordings in IndexedDB aren't silently evicted under storage pressure.
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist || !navigator.storage.persisted) {
    return false;
  }
  const already = await navigator.storage.persisted();
  if (already) return true;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
