import "react-native-get-random-values";
import React from "react";
import { Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import "./lib/notifications";
import { NotesProvider } from "./context/NotesContext";
import NotesScreen from "./screens/NotesScreen";
import NoteDetailScreen from "./screens/NoteDetailScreen";
import CameraScreen from "./screens/CameraScreen";
import SettingsScreen from "./screens/SettingsScreen";

const COLORS = {
  primary: "#3b82f6",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#94a3b8",
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const screenHeader = {
  headerStyle: { backgroundColor: COLORS.primary },
  headerTintColor: "#ffffff",
  headerTitleStyle: { fontWeight: "700" },
};

function NotesStack() {
  return (
    <Stack.Navigator screenOptions={screenHeader}>
      <Stack.Screen name="NotesList" component={NotesScreen} options={{ title: "📝 SimpleNotes" }} />
      <Stack.Screen name="NoteDetail" component={NoteDetailScreen} options={{ title: "Note" }} />
    </Stack.Navigator>
  );
}

function TabIcon({ emoji, focused }) {
  return <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>;
}

export default function App() {
  return (
    <NotesProvider>
      <NavigationContainer>
        <StatusBar style="light" backgroundColor={COLORS.primary} />
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: COLORS.muted,
            tabBarStyle: {
              backgroundColor: "#ffffff",
              borderTopColor: COLORS.border,
              height: 60,
              paddingBottom: 8,
              paddingTop: 6,
            },
            tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
          }}
        >
          <Tab.Screen
            name="Notes"
            component={NotesStack}
            options={{
              tabBarIcon: ({ focused }) => <TabIcon emoji="📝" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Camera"
            component={CameraScreen}
            options={{
              tabBarIcon: ({ focused }) => <TabIcon emoji="📷" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </NotesProvider>
  );
}
