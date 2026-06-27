import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useNotes } from "../context/NotesContext";
import { formatLocation } from "../lib/location";

export default function NotesScreen({ navigation }) {
  const { notes, isOnline, isLoading, fetchNotesFromServer } = useNotes();
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchNotesFromServer().catch(() => {});
      return () => {
        active = false;
      };
    }, [fetchNotesFromServer])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchNotesFromServer();
    } finally {
      setRefreshing(false);
    }
  }, [fetchNotesFromServer]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = notes.filter((n) => !n.is_deleted);
    if (!q) return visible;
    return visible.filter(
      (n) =>
        (n.title || "").toLowerCase().includes(q) ||
        (n.content || "").toLowerCase().includes(q)
    );
  }, [notes, query]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate("NoteDetail", { id: item.id })}
    >
      {item.photo ? <Image source={{ uri: item.photo }} style={styles.thumb} /> : null}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title || "Untitled"}
        </Text>
        <Text style={styles.cardPreview} numberOfLines={2}>
          {item.content || "No content"}
        </Text>
        {item.location ? (
          <Text style={styles.cardLocation} numberOfLines={1}>
            📍 {formatLocation(item.location)}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBar}>
          <Text style={styles.offlineText}>⚠️ Offline — showing local notes</Text>
        </View>
      )}

      <TextInput
        style={styles.search}
        placeholder="Search notes…"
        placeholderTextColor="#94a3b8"
        value={query}
        onChangeText={setQuery}
        clearButtonMode="while-editing"
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={filtered.length === 0 && styles.emptyWrap}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>{isLoading ? "Loading…" : "No notes yet. Tap + to add one."}</Text>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("NoteDetail", { id: null })}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  offlineBar: { backgroundColor: "#ef4444", paddingVertical: 8, alignItems: "center" },
  offlineText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  search: {
    margin: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    fontSize: 15,
    color: "#0f172a",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  thumb: { width: 64, height: 64 },
  cardBody: { flex: 1, padding: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  cardPreview: { fontSize: 13, color: "#64748b" },
  cardLocation: { fontSize: 12, color: "#3b82f6", marginTop: 6 },
  emptyWrap: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 40 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: { color: "#fff", fontSize: 30, lineHeight: 32, fontWeight: "300" },
});
