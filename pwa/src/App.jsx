import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import NotesList from "./components/NotesList.jsx";
import NoteEditor from "./components/NoteEditor.jsx";
import OfflineIndicator from "./components/OfflineIndicator.jsx";
import {
  getAllNotes,
  putNotes,
  putNote,
  removeNote,
  queuePending,
  getPending,
  clearPending,
} from "./db.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: API_URL, timeout: 8000 });

function NoteDetail({ note, onEdit, onDelete }) {
  if (!note) {
    return (
      <section className="detail detail--empty">
        <p>Select a note or create a new one.</p>
      </section>
    );
  }
  return (
    <section className="detail card">
      <div className="detail__header">
        <h2>{note.title || "Untitled"}</h2>
        <div className="detail__actions">
          <button className="btn btn--ghost" onClick={() => onEdit(note)}>
            Edit
          </button>
          <button className="btn btn--danger" onClick={() => onDelete(note)}>
            Delete
          </button>
        </div>
      </div>
      <p className="detail__content">{note.content || "No content"}</p>
      {note.updated_at && (
        <p className="detail__meta">Updated {new Date(note.updated_at).toLocaleString()}</p>
      )}
    </section>
  );
}

export default function App() {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [offlineNotes, setOfflineNotes] = useState({});
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );

  const pendingCount = useMemo(() => Object.keys(offlineNotes).length, [offlineNotes]);

  const saveToIndexedDB = useCallback(async (list) => {
    try {
      await putNotes(list);
    } catch (err) {
      console.error("[IndexedDB] save failed", err);
    }
  }, []);

  const loadFromIndexedDB = useCallback(async () => {
    try {
      return await getAllNotes();
    } catch (err) {
      console.error("[IndexedDB] load failed", err);
      return [];
    }
  }, []);

  const refreshPending = useCallback(async () => {
    const pending = await getPending();
    const map = {};
    pending.forEach((p) => (map[p.id] = p));
    setOfflineNotes(map);
    return pending;
  }, []);

  const requestBackgroundSync = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg && "sync" in reg) {
        await reg.sync.register("sync-notes");
      }
    } catch (err) {
      console.warn("[backgroundSync] unavailable", err.message);
    }
  }, []);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/notes", { params: { limit: 500 } });
      setNotes(data);
      await saveToIndexedDB(data);
    } catch (err) {
      console.warn("[fetchNotes] falling back to IndexedDB", err.message);
      const cached = await loadFromIndexedDB();
      setNotes(cached);
    } finally {
      setLoading(false);
    }
  }, [loadFromIndexedDB, saveToIndexedDB]);

  const syncPending = useCallback(async () => {
    const pending = await getPending();
    if (pending.length === 0) return;
    try {
      await api.post("/sync", { notes: pending.map(({ _pending, ...n }) => n) });
      await Promise.all(pending.map((p) => clearPending(p.id)));
      await refreshPending();
      await fetchNotes();
    } catch (err) {
      console.warn("[syncPending] still offline?", err.message);
    }
  }, [fetchNotes, refreshPending]);

  const saveNote = useCallback(
    async (draft) => {
      setSaving(true);
      const isNew = !draft.id;
      const optimistic = {
        ...draft,
        id: draft.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      };
      try {
        let saved;
        if (isOnline) {
          const res = isNew
            ? await api.post("/notes", { title: optimistic.title, content: optimistic.content })
            : await api.put(`/notes/${draft.id}`, { title: draft.title, content: draft.content });
          saved = res.data;
          await putNote(saved);
        } else {
          saved = { ...optimistic, _pending: true };
          await putNote(saved);
          await queuePending(saved);
          await refreshPending();
          requestBackgroundSync();
        }
        setNotes((prev) => {
          const without = prev.filter((n) => n.id !== draft.id && n.id !== saved.id);
          return [saved, ...without];
        });
        setSelectedNote(saved);
        setIsEditing(false);
      } catch (err) {
        console.error("[saveNote] failed", err);
      } finally {
        setSaving(false);
      }
    },
    [isOnline, refreshPending, requestBackgroundSync]
  );

  const deleteNote = useCallback(
    async (note) => {
      try {
        if (isOnline) {
          await api.delete(`/notes/${note.id}`);
        } else {
          await queuePending({ ...note, is_deleted: true, _pending: true });
          await refreshPending();
          requestBackgroundSync();
        }
        await removeNote(note.id);
        setNotes((prev) => prev.filter((n) => n.id !== note.id));
        if (selectedNote?.id === note.id) {
          setSelectedNote(null);
          setIsEditing(false);
        }
      } catch (err) {
        console.error("[deleteNote] failed", err);
      }
    },
    [isOnline, refreshPending, requestBackgroundSync, selectedNote]
  );

  useEffect(() => {
    fetchNotes();
    refreshPending();
  }, [fetchNotes, refreshPending]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event) => {
      if (event.data?.type === "SYNC_COMPLETE") {
        refreshPending();
        fetchNotes();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [fetchNotes, refreshPending]);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      syncPending();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [syncPending]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleNew = () => {
    setSelectedNote(null);
    setIsEditing(true);
  };

  const decorated = notes.map((n) => ({ ...n, _pending: !!offlineNotes[n.id] }));

  return (
    <div className="app">
      <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} />

      <header className="topbar">
        <h1 className="brand">📝 SimpleNotes</h1>
        <div className="topbar__right">
          {loading && <span className="spinner" aria-label="loading" />}
          <button
            className="btn btn--ghost"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <main className="layout">
        <NotesList
          notes={decorated}
          selectedId={selectedNote?.id}
          query={query}
          onQueryChange={setQuery}
          onSelect={(note) => {
            setSelectedNote(note);
            setIsEditing(false);
          }}
          onNew={handleNew}
        />

        <div className="content">
          {isEditing ? (
            <NoteEditor
              note={selectedNote}
              saving={saving}
              onSave={saveNote}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <NoteDetail note={selectedNote} onEdit={() => setIsEditing(true)} onDelete={deleteNote} />
          )}
        </div>
      </main>
    </div>
  );
}
