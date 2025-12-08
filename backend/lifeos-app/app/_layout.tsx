import { Stack } from "expo-router";
import { PaperProvider, DefaultTheme } from "react-native-paper";

// --- THEME COLORS ---
const COLORS = {
  Primary: "#8F5774",    // Deep Blush/Mauve (Primary Accent)
  Background: "#F7F4F0", // Pale Off-White/Linen
  TextPrimary: "#333333", // Soft Black
};

// ------------------------------------------
// 1. CONFIGURE CUSTOM REACT NATIVE PAPER THEME
// ------------------------------------------
const LifeOSTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    // Apply your custom colors globally
    primary: COLORS.Primary,
    background: COLORS.Background,
    onSurface: COLORS.TextPrimary, // Used for general text on background surfaces
    // You can customize more here if needed
  },
  // Ensure we use the roundness/shape for a warm, modern feel
  roundness: 8, 
};


// ------------------------------------------
// 2. ROOT LAYOUT COMPONENT
// ------------------------------------------
export default function RootLayout() {
  return (
    // Wrap the entire app in the PaperProvider with the custom theme
    <PaperProvider theme={LifeOSTheme}>
      <Stack 
        screenOptions={{ 
          headerShown: false,
          // Set the main background color for screens without custom styles
          contentStyle: { 
            backgroundColor: COLORS.Background 
          } 
        }} 
      />
    </PaperProvider>
  );
}