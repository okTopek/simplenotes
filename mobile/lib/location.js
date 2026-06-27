import * as Location from "expo-location";

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission not granted");
  }
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: Number(position.coords.latitude.toFixed(5)),
    longitude: Number(position.coords.longitude.toFixed(5)),
  };
}

export function formatLocation(loc) {
  if (!loc) return null;
  return `${loc.latitude}, ${loc.longitude}`;
}
