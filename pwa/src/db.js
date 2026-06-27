export const DB_NAME = "simplenotes";
export const DB_VERSION = 1;
export const NOTES_STORE = "notes";
export const PENDING_STORE = "pending";

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        db.createObjectStore(NOTES_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

export async function putNotes(notes) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(NOTES_STORE, "readwrite");
    const store = transaction.objectStore(NOTES_STORE);
    notes.forEach((note) => store.put(note));
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAllNotes() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = tx(db, NOTES_STORE, "readonly").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function putNote(note) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = tx(db, NOTES_STORE, "readwrite").put(note);
    request.onsuccess = () => resolve(note);
    request.onerror = () => reject(request.error);
  });
}

export async function removeNote(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = tx(db, NOTES_STORE, "readwrite").delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export async function queuePending(note) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = tx(db, PENDING_STORE, "readwrite").put(note);
    request.onsuccess = () => resolve(note);
    request.onerror = () => reject(request.error);
  });
}

export async function getPending() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = tx(db, PENDING_STORE, "readonly").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function clearPending(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = tx(db, PENDING_STORE, "readwrite").delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}
