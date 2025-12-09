// /app/task/[id].tsx

import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from "react-native";
import { BASE_URL } from "../../constants/config";
import { CategoryChip } from "../../components/CategoryChip";

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [task, setTask] = useState<any>(null);

  async function fetchTask() {
    const res = await fetch(`${BASE_URL}/tasks`);
    const data = await res.json();
    const found = data.find((t: any) => t.id === id);
    setTask(found);
  }

  useEffect(() => {
    fetchTask();
  }, []);

  if (!task) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "#333" }}>Loading...</Text>
      </View>
    );
  }

  async function deleteTask() {
    await fetch(`${BASE_URL}/tasks/${id}/delete`, { method: "POST" }).catch(() => {});
    Alert.alert("Deleted", "Task removed.");
    router.back();
  }

  function reschedule() {
    const msg = `Move ${task.title} to `;
    router.push({
      pathname: "/chat",
      params: { prefill: msg },
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{task.title}</Text>

      {task.category && (
        <CategoryChip label={task.category} color={task.color ?? "#999"} />
      )}

      <Text style={styles.timeBlock}>
        {task.datetime}
        {task.end_datetime ? ` → ${task.end_datetime}` : ""}
      </Text>

      {task.notes && (
        <Text style={styles.notes}>Notes: {task.notes}</Text>
      )}

      <View style={{ height: 20 }} />

      <TouchableOpacity style={styles.buttonPrimary} onPress={reschedule}>
        <Text style={styles.buttonText}>Reschedule</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonDanger} onPress={deleteTask}>
        <Text style={styles.buttonText}>Delete</Text>
      </TouchableOpacity>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#F7F4F0",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#333",
  },
  timeBlock: {
    marginTop: 20,
    fontSize: 16,
    color: "#555",
  },
  notes: {
    marginTop: 20,
    fontSize: 14,
    color: "#444",
  },
  buttonPrimary: {
    backgroundColor: "#8F5774",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 30,
  },
  buttonDanger: {
    backgroundColor: "#C85A5A",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
});
