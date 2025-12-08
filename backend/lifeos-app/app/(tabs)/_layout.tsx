import { Tabs } from "expo-router";
import { Text } from "react-native";

// --- THEME COLOR ---
const ACTIVE_COLOR = "#8F5774"; // Deep Blush/Mauve (Primary Accent)

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Set the active tab color to the new Primary Accent
        tabBarActiveTintColor: ACTIVE_COLOR, 
        tabBarStyle: { 
          paddingBottom: 8, 
          paddingTop: 8, 
          height: 60,
          backgroundColor: "white",
          borderTopColor: "#EAEAEA", // Subtle top border
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color }) => (
            // Using a simple emoji for now, which takes the active color
            <Text style={{ fontSize: 20, color }}>📅</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: "Assistant",
          tabBarIcon: ({ color }) => (
            // Using a simple emoji for now, which takes the active color
            <Text style={{ fontSize: 20, color }}>💬</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => (
            // Using a simple emoji for now, which takes the active color
            <Text style={{ fontSize: 20, color }}>🧭</Text>
          ),
        }}
      />
    </Tabs>
  );
}