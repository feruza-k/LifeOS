import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, Card, ActivityIndicator, FAB } from "react-native-paper";
import { useRouter } from "expo-router";

// --- THEME COLORS ---
const COLORS = {
  Primary: "#8F5774",    // Deep Blush/Mauve (Primary Accent)
  Background: "#F7F4F0", // Pale Off-White/Linen
  TextPrimary: "#333333", // Soft Black
  TextSecondary: "rgba(51, 51, 51, 0.6)", // Soft Black with opacity for subtitles
};

// --- CONFIGURATION ---
const BASE_URL = "http://127.0.0.1:8000"; 
/* 🚨 IMPORTANT FIX FOR NETWORK ERROR:
    If you still see "Network request failed", replace "127.0.0.1" 
    above with your host machine's local network IP address (e.g., "http://192.168.1.5:8000").
*/

// ------------------------------------------
// TYPES (UPDATED)
// ------------------------------------------
type TaskItem = {
  id: string;
  title: string;
  time: string;
  end_datetime?: string | null;
  category?: string | null;
};

type TaskGroup = {
  label: string;
  tasks: TaskItem[];
};

type LoadLevel = "Light" | "Optimal" | "Heavy" | "Unknown";

type TodayResponse = {
  groups: TaskGroup[];
  // New field for Load Awareness
  current_load_level: LoadLevel; 
};

// ------------------------------------------
// COMPONENT: Load Status Header
// ------------------------------------------
type LoadStatusProps = {
    loadLevel: LoadLevel;
};

function LoadStatusHeader({ loadLevel }: LoadStatusProps) {
    let color;
    let message;

    switch (loadLevel) {
        case "Heavy":
            color = "#FF9A8D"; // Soft Red/Salmon
            message = "Heavy Load. Be gentle with yourself today.";
            break;
        case "Optimal":
            color = COLORS.Primary;
            message = "Optimal Load. Ready to build consistency.";
            break;
        case "Light":
            color = "#A6D9B6"; // Soft Green
            message = "Light Load. Time for a small, meaningful win.";
            break;
        case "Unknown":
        default:
            color = "#E0E0E0"; // Soft Gray
            message = "Checking your energy level...";
            break;
    }

    return (
        <View style={[styles.loadStatusContainer, { backgroundColor: color }]}>
            <Text style={styles.loadStatusText}>{message}</Text>
        </View>
    );
}

// ------------------------------------------
// MAIN COMPONENT
// ------------------------------------------
export default function TodayScreen() {
  const [loading, setLoading] = useState(true);
  const [todayData, setTodayData] = useState<TodayResponse | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchToday();
  }, []);

  async function fetchToday() {
    try {
      setLoading(true);
      // 🚨 FIX: Use the configured BASE_URL
      const res = await fetch(`${BASE_URL}/assistant/today`);
      
      const data = await res.json();
      setTodayData(data);
    } catch (err) {
      console.log("Error fetching today:", err);
      // Fallback data structure to prevent crash if backend is down
      setTodayData({
        groups: [],
        current_load_level: "Unknown",
      });
    } finally {
      setLoading(false);
    }
  }

  const todayString = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Today</Text>
        <Text style={styles.date}>{todayString}</Text>
      </View>

      {/* LOAD STATUS DASHBOARD ELEMENT */}
      {todayData?.current_load_level && (
        <LoadStatusHeader loadLevel={todayData.current_load_level} />
      )}
      

      {/* LOADING */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.Primary} />
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* GROUPS */}
          {todayData?.groups?.map((group: TaskGroup, idx: number) => (
            <View key={idx} style={styles.groupSection}>
              <Text style={styles.groupLabel}>{group.label}</Text>

              {group.tasks.length === 0 ? (
                <Text style={styles.emptyText}>No tasks here.</Text>
              ) : (
                group.tasks.map((task: TaskItem) => (
                  <Card key={task.id} style={styles.card} elevation={2}>
                    <Card.Title
                      title={task.title}
                      subtitle={
                        task.end_datetime
                          ? `${task.time} – ${task.end_datetime.split(" ")[1]}`
                          : task.time
                      }
                      titleStyle={styles.cardTitle}
                      subtitleStyle={styles.cardSubtitle}
                    />
                  </Card>
                ))
              )}
            </View>
          ))}
          {/* Add padding at the bottom for FAB clearance */}
          <View style={{ height: 100 }} /> 
        </ScrollView>
      )}

      {/* FAB — Opens Chat */}
      <FAB
        icon="message-plus"
        label="Assistant"
        style={styles.fab}
        color="white"
        onPress={() => {
          router.push("/chat"); 
        }}
      />
    </View>
  );
}

// ------------------------------------------
// STYLES
// ------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 60,
    backgroundColor: COLORS.Background,
  },
  scrollView: {
    marginTop: 20,
  },

  // HEADER
  headerContainer: {
    marginBottom: 10,
  },
  header: {
    fontSize: 34,
    fontWeight: "700",
    color: COLORS.TextPrimary,
  },
  date: {
    fontSize: 16,
    color: COLORS.TextSecondary,
    marginTop: -4,
  },

  // LOAD STATUS STYLES (NEW)
  loadStatusContainer: {
    padding: 14,
    borderRadius: 12,
    marginTop: 15,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3, 
  },
  loadStatusText: {
    fontSize: 15,
    fontWeight: "600",
    color: "white", 
    textAlign: "center",
  },
  // --- END LOAD STATUS STYLES ---


  // GROUPS
  groupSection: {
    marginBottom: 28,
  },
  groupLabel: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    color: COLORS.TextPrimary,
  },
  emptyText: {
    color: COLORS.TextSecondary,
    fontSize: 14,
    marginLeft: 4,
  },

  // CARDS
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1.5,
    elevation: 2, 
    paddingVertical: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.TextPrimary,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.TextSecondary,
    marginTop: -2,
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: COLORS.Primary,
    borderRadius: 40,
    zIndex: 10, 
  },
});