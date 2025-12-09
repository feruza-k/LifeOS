// /components/LoadMeter.tsx
import { View, Text, StyleSheet } from "react-native";

export function LoadMeter({ load }: { load: string }) {
  const colors: any = {
    empty: "#CFCFCF",
    light: "#A6D9B6",
    medium: "#8F5774",
    heavy: "#D97D74",
  };

  const labels: any = {
    empty: "Open day ahead.",
    light: "Light load today.",
    medium: "A balanced day.",
    heavy: "A full schedule — go gently.",
  };

  return (
    <View style={[styles.container, { backgroundColor: colors[load] + "33" }]}>
      <Text style={styles.label}>{labels[load] ?? ""}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    borderRadius: 12,
    marginVertical: 20,
  },
  label: {
    textAlign: "center",
    color: "#333",
    fontWeight: "600",
  },
});
