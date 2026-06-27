import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNotes } from "../context/NotesContext";

export default function CameraScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState("back");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef(null);
  const { addNote } = useNotes();

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>📷 Camera access needed</Text>
        <Text style={styles.permText}>SimpleNotes uses the camera to attach photos to notes.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Grant permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    setBusy(true);
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      setPhoto(result.uri);
    } catch (err) {
      Alert.alert("Camera error", "Could not capture the photo.");
    } finally {
      setBusy(false);
    }
  };

  const saveAsNote = async () => {
    setBusy(true);
    try {
      await addNote({
        title: `Photo note ${new Date().toLocaleDateString()}`,
        content: "Captured from the camera.",
        photo,
      });
      setPhoto(null);
      navigation.navigate("Notes");
    } catch (err) {
      Alert.alert("Error", "Could not save the note.");
    } finally {
      setBusy(false);
    }
  };

  if (photo) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: photo }} style={styles.preview} />
        <View style={styles.previewActions}>
          <TouchableOpacity style={[styles.btn, styles.retake]} onPress={() => setPhoto(null)} disabled={busy}>
            <Text style={styles.btnText}>↺ Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.save]} onPress={saveAsNote} disabled={busy}>
            <Text style={styles.btnText}>{busy ? "Saving…" : "💾 Save as note"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.flipBtn}
          onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
        >
          <Text style={styles.flipText}>🔄</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shutter} onPress={takePhoto} disabled={busy} activeOpacity={0.7}>
          {busy ? <ActivityIndicator color="#fff" /> : <View style={styles.shutterInner} />}
        </TouchableOpacity>
        <View style={styles.flipBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#f8fafc" },
  permTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  permText: { color: "#64748b", textAlign: "center", marginBottom: 20 },
  camera: { flex: 1 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingVertical: 24,
    backgroundColor: "#000",
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },
  flipBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  flipText: { fontSize: 26 },
  preview: { flex: 1, resizeMode: "contain" },
  previewActions: { flexDirection: "row", padding: 16, backgroundColor: "#000", gap: 12 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  retake: { backgroundColor: "#475569" },
  save: { backgroundColor: "#10b981" },
  primaryBtn: { backgroundColor: "#3b82f6", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
