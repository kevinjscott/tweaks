"use client";

/** Imported GLB blobs live in IndexedDB (too large for localStorage). Scenarios only store the modelId. */
const DB = "pga27-studio";
const STORE = "glb";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const mem = new Map<string, ArrayBuffer>();

export async function putModel(id: string, data: ArrayBuffer) {
  mem.set(id, data);
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(data, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // memory copy still works for this session
  }
}

export async function getModel(id: string): Promise<ArrayBuffer | null> {
  const hit = mem.get(id);
  if (hit) return hit;
  try {
    const db = await open();
    const data = await new Promise<ArrayBuffer | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(id);
      r.onsuccess = () => resolve(r.result as ArrayBuffer | undefined);
      r.onerror = () => reject(r.error);
    });
    if (data) mem.set(id, data);
    return data ?? null;
  } catch {
    return null;
  }
}
