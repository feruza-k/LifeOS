// /components/TaskCard.tsx
import { Card } from "react-native-paper";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { CategoryChip } from "./CategoryChip";

export function TaskCard({ task, onPress }: { task: any; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <Card style={styles.card} elevation={2}>
        <Card.Content style={{ paddingVertical: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.title}>{task.title}</Text>
            {task.category && (
              <CategoryChip color={task.color ?? "#999"} label={task.category} />
            )}
          </View>

          <Text style={styles.time}>
            {task.time}
            {task.end_datetime
              ? ` – ${task.end_datetime.split(" ")[1]}`
              : ""}
          </Text>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  time: {
    fontSize: 13,
    marginTop: 4,
    color: "rgba(51,51,51,0.6)",
  },
});
