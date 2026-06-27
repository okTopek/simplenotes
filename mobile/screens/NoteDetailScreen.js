import React, { useLayoutEffect, useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { useNotes } from "../context/NotesContext";
import { getCurrentLocation, formatLocation } from "../lib/location";

export default function NoteDetailScreen({ route, navigation }) {
  const { id } = route.params || {};
  const { getNoteById, addNote, updateNote, deleteNote } = useNotes();
  const existing = id ? getNoteById(id) : null;

  const [title, setTitle] = useState(existing?.title || "");
  const [content, setContent] = useState(existing?.content || "");
  const [location, setLocation] = useState(existing?.location || null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleTagLocation = async () => {
    setLocating(true);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
    } catch (err) {
      Alert.alert("Location unavailable", "Permission denied or location could not be read.");
    } finally {
      setLocating(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({ title: id ? "Edit Note" : "New Note" });
  }, [navigation, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (id && existing) {
        await updateNote(id, { title: title.trim(), content, location });
      } else {
        await addNote({ title: title.trim(), content, location });
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert("Error", "Could not save the note.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert("Delete note", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteNote(id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {existing?.photo ? <Image source={{ uri: existing.photo }} style={styles.photo} /> : null}

      <TextInput
        style={styles.title}
        placeholder="Title"
        placeholderTextColor="#94a3b8"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.body}
        placeholder="Write your note…"
        placeholderTextColor="#94a3b8"
        value={content}
        onChangeText={setContent}
        multiline
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.btn, styles.location]}
        onPress={handleTagLocation}
        disabled={locating}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>
          {locating ? "Locating…" : location ? `📍 ${formatLocation(location)}` : "📍 Tag location"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.save, saving && styles.disabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>{saving ? "Saving…" : "Save"}</Text>
      </TouchableOpacity>

      {id && (
        <TouchableOpacity style={[styles.btn, styles.delete]} onPress={handleDelete} activeOpacity={0.85}>
          <Text style={styles.btnText}>Delete</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16 },
  photo: { width: "100%", height: 200, borderRadius: 12, marginBottom: 16 },
  title: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  body: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#0f172a",
    minHeight: 200,
    marginBottom: 16,
  },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: "center", marginBottom: 12 },
  save: { backgroundColor: "#10b981" },
  location: { backgroundColor: "#3b82f6" },
  delete: { backgroundColor: "#ef4444" },
  disabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
