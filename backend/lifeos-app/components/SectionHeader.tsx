// /components/SectionHeader.tsx
import { Text, View, StyleSheet } from "react-native";

export function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 28,
    marginBottom: 10,
  },
  text: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
});
