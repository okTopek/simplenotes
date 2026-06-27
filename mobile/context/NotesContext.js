import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
const STORAGE_KEY = "@simplenotes/notes";

const api = axios.create({ baseURL: API_URL, timeout: 15000 });

const NotesContext = createContext(null);

export function NotesProvider({ children }) {
  const [notes, setNotes] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const hydrated = useRef(false);
  const notesRef = useRef([]);

  const persist = useCallback(async (next) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.error("[NotesContext] persist failed", err);
    }
  }, []);

  const loadFromStorage = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error("[NotesContext] load failed", err);
      return [];
    }
  }, []);

  const fetchNotesFromServer = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/notes", { params: { limit: 500 } });
      setIsOnline(true);
      // photo now syncs via the server; location is still device-only. Server
      // wins for photo, but fall back to a local photo (e.g. taken before photo
      // sync existed) so older images aren't lost.
      const localMeta = {};
      notesRef.current.forEach((n) => {
        if (n.location || n.photo) {
          localMeta[n.id] = { location: n.location || null, photo: n.photo || null };
        }
      });
      const merged = data.map((n) => {
        const local = localMeta[n.id];
        if (!local) return n;
        return {
          ...n,
          location: n.location || local.location,
          photo: n.photo || local.photo,
        };
      });
      setNotes(merged);
      await persist(merged);
      return merged;
    } catch (err) {
      setIsOnline(false);
      const local = await loadFromStorage();
      setNotes(local);
      return local;
    } finally {
      setIsLoading(false);
    }
  }, [loadFromStorage, persist]);

  useEffect(() => {
    let active = true;
    (async () => {
      const local = await loadFromStorage();
      if (active) {
        setNotes(local);
        hydrated.current = true;
      }
      await fetchNotesFromServer();
    })();
    return () => {
      active = false;
    };
  }, [fetchNotesFromServer, loadFromStorage]);

  useEffect(() => {
    notesRef.current = notes;
    if (hydrated.current) persist(notes);
  }, [notes, persist]);

  const addNote = useCallback(
    async (input) => {
      const now = new Date().toISOString();
      const note = {
        id: uuidv4(),
        title: input.title || "",
        content: input.content || "",
        photo: input.photo || null,
        location: input.location || null,
        created_at: now,
        updated_at: now,
        is_deleted: false,
        user_id: "default_user",
      };
      setNotes((prev) => [note, ...prev]);
      try {
        const { data } = await api.post("/notes", {
          title: note.title,
          content: note.content,
          photo: note.photo,
        });
        setIsOnline(true);
        setNotes((prev) =>
          prev.map((n) =>
            n.id === note.id ? { ...data, location: note.location } : n
          )
        );
      } catch (err) {
        setIsOnline(false);
      }
      return note;
    },
    []
  );

  const updateNote = useCallback(async (id, patch) => {
    const updated_at = new Date().toISOString();
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at } : n))
    );
    try {
      await api.put(`/notes/${id}`, {
        title: patch.title,
        content: patch.content,
      });
      setIsOnline(true);
    } catch (err) {
      setIsOnline(false);
    }
  }, []);

  const deleteNote = useCallback(async (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.delete(`/notes/${id}`);
      setIsOnline(true);
    } catch (err) {
      setIsOnline(false);
    }
  }, []);

  const getNoteById = useCallback(
    (id) => notes.find((n) => n.id === id) || null,
    [notes]
  );

  const clearCache = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setNotes([]);
  }, []);

  const value = {
    notes,
    isOnline,
    isLoading,
    apiUrl: API_URL,
    addNote,
    updateNote,
    deleteNote,
    getNoteById,
    fetchNotesFromServer,
    clearCache,
  };

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within a NotesProvider");
  return ctx;
}
