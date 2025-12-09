// /components/InsightCard.tsx
import { View, Text, StyleSheet } from "react-native";

export function InsightCard({ insight }: { insight: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.text}>{insight}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    backgroundColor: "white",
    borderRadius: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E6E6E6",
  },
  text: {
    fontSize: 14,
    color: "#333",
  },
});
