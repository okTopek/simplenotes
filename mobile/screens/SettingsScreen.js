import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useNotes } from "../context/NotesContext";
import {
  requestNotificationPermission,
  scheduleDailyReminder,
  cancelReminders,
  notifyNow,
} from "../lib/notifications";

const APP_VERSION = "1.0.0";

export default function SettingsScreen() {
  const { notes, isOnline, apiUrl, fetchNotesFromServer, clearCache } = useNotes();
  const [syncing, setSyncing] = useState(false);
  const [storageBytes, setStorageBytes] = useState(0);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  const measureStorage = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const entries = await AsyncStorage.multiGet(keys);
      const bytes = entries.reduce((sum, [k, v]) => sum + k.length + (v ? v.length : 0), 0);
      setStorageBytes(bytes);
    } catch (err) {
      setStorageBytes(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      measureStorage();
    }, [measureStorage])
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetchNotesFromServer();
      await measureStorage();
      if (notificationsOn) {
        await notifyNow("✅ Sync complete", "Your notes are up to date.");
      }
      Alert.alert("Sync complete", "Notes are up to date.");
    } catch (err) {
      Alert.alert("Sync failed", "Could not reach the server.");
    } finally {
      setSyncing(false);
    }
  };

  const toggleNotifications = async (value) => {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert("Permission needed", "Enable notifications in system settings to get reminders.");
        return;
      }
      await scheduleDailyReminder(9, 0);
      setNotificationsOn(true);
      Alert.alert("Reminders on", "A daily reminder is set for 9:00 AM.");
    } else {
      await cancelReminders();
      setNotificationsOn(false);
    }
  };

  const handleClear = () => {
    Alert.alert("Clear local cache", "This removes notes stored on this device. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearCache();
          await measureStorage();
          Alert.alert("Cache cleared", "Local notes removed.");
        },
      },
    ]);
  };

  const kb = (storageBytes / 1024).toFixed(1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Sync">
        <TouchableOpacity style={[styles.btn, styles.primary]} onPress={handleSync} disabled={syncing}>
          {syncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>🔄 Manual sync</Text>}
        </TouchableOpacity>
        <Row label="Connection" value={isOnline ? "🟢 Online" : "🔴 Offline"} />
      </Section>

      <Section title="Preferences">
        <SwitchRow label="Daily reminder" value={notificationsOn} onValueChange={toggleNotifications} />
        <SwitchRow label="Auto-sync on open" value={autoSync} onValueChange={setAutoSync} />
      </Section>

      <Section title="Storage">
        <Row label="Notes stored" value={`${notes.length}`} />
        <Row label="Local storage used" value={`${kb} KB`} />
        <TouchableOpacity style={[styles.btn, styles.danger]} onPress={handleClear}>
          <Text style={styles.btnText}>🗑️ Clear cache</Text>
        </TouchableOpacity>
      </Section>

      <Section title="About">
        <Row label="App" value="SimpleNotes" />
        <Row label="Version" value={APP_VERSION} />
        <Row label="API" value={apiUrl} />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SwitchRow({ label, value, onValueChange }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: "#3b82f6", false: "#cbd5e1" }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  rowLabel: { fontSize: 15, color: "#0f172a" },
  rowValue: { fontSize: 14, color: "#64748b", maxWidth: "60%" },
  btn: { borderRadius: 10, paddingVertical: 13, alignItems: "center", marginVertical: 8 },
  primary: { backgroundColor: "#3b82f6" },
  danger: { backgroundColor: "#ef4444" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
