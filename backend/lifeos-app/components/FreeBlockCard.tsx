// /components/FreeBlockCard.tsx
import { View, Text, StyleSheet } from "react-native";

export function FreeBlockCard({ block }: { block: any }) {
  return (
    <View style={styles.card}>
      <Text style={styles.text}>
        Free block from {block.start} to {block.end}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#EFEFEF",
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  text: {
    color: "#444",
    fontSize: 14,
  },
});
