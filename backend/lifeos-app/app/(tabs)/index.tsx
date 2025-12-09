// /app/(tabs)/index.tsx
import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { FAB } from "react-native-paper";
import { useRouter } from "expo-router";
import { useBootstrap } from "../../hooks/useBootstrap";
import { getDynamicGreeting } from "../../utils/getGreeting";

import { SectionHeader } from "../../components/SectionHeader";
import { TaskCard } from "../../components/TaskCard";
import { FreeBlockCard } from "../../components/FreeBlockCard";
import { InsightCard } from "../../components/InsightCard";
import { LoadMeter } from "../../components/LoadMeter";

export default function TodayScreen() {
  const router = useRouter();
  const { data, loading, refreshing, refresh, fetchBootstrap } = useBootstrap();

  useEffect(() => {
    fetchBootstrap();
  }, []);

  const today = data?.today;
  const suggestions = data?.suggestions?.suggestions ?? [];
  const conflicts = data?.conflicts ?? [];

  return (
    <View style={styles.container}>
      {/* GREETING */}
      <Text style={styles.greeting}>{getDynamicGreeting()}</Text>

      {/* LOAD METER */}
      {today && <LoadMeter load={today.load} />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        {/* MORNING */}
        <SectionHeader title="Morning" />
        {today?.morning_tasks?.length ? (
          today.morning_tasks.map((t: any) => (
            <TaskCard
              key={t.id}
              task={t}
              onPress={() =>
                router.push({
                  pathname: "../task/[id]",
                  params: { id: t.id },
                })
              }
            />
          ))
        ) : (
          <Text style={styles.empty}>No morning tasks.</Text>
        )}

        {/* AFTERNOON */}
        <SectionHeader title="Afternoon" />
        {today?.afternoon_tasks?.length ? (
          today.afternoon_tasks.map((t: any) => (
            <TaskCard
              key={t.id}
              task={t}
              onPress={() =>
                router.push({
                  pathname: "../task/[id]",
                  params: { id: t.id },
                })
              }
            />
          ))
        ) : (
          <Text style={styles.empty}>No afternoon tasks.</Text>
        )}

        {/* EVENING */}
        <SectionHeader title="Evening" />
        {today?.evening_tasks?.length ? (
          today.evening_tasks.map((t: any) => (
            <TaskCard
              key={t.id}
              task={t}
              onPress={() =>
                router.push({
                  pathname: "../task/[id]",
                  params: { id: t.id },
                })
              }
            />
          ))
        ) : (
          <Text style={styles.empty}>No evening tasks.</Text>
        )}

        {/* FREE BLOCKS */}
        <SectionHeader title="Free Blocks" />
        {today?.free_blocks?.length ? (
          today.free_blocks.map((b: any, idx: number) => (
            <FreeBlockCard key={idx} block={b} />
          ))
        ) : (
          <Text style={styles.empty}>No free blocks today.</Text>
        )}

        {/* INSIGHTS */}
        <SectionHeader title="Insights" />

        {suggestions.map((s: any, idx: number) => (
          <InsightCard key={idx} insight={s.message} />
        ))}

        {conflicts.length > 0 && (
          <InsightCard insight={`You have ${conflicts.length} conflict(s) today.`} />
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <FAB
        icon="message-plus"
        label="Assistant"
        style={styles.fab}
        color="white"
        onPress={() => router.push("/chat")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 60,
    backgroundColor: "#F7F4F0",
  },
  greeting: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  empty: {
    color: "rgba(51,51,51,0.6)",
    fontSize: 14,
    marginTop: 4,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#8F5774",
  },
});
