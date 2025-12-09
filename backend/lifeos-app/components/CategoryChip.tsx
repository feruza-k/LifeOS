// /components/CategoryChip.tsx
import { View, Text, StyleSheet } from "react-native";

export function CategoryChip({ color, label }: { color: string; label: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color + "22" }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 50,
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    color: "#333",
    fontWeight: "500",
  },
});
