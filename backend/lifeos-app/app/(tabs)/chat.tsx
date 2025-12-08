import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// --- THEME COLORS ---
const COLORS = {
  Primary: "#8F5774",    // Deep Blush/Mauve
  Background: "#F7F4F0", // Soft warm neutral
  TextPrimary: "#333333",
  InputBackground: "#F2F2F2",
  NoButtonBg: "#E0E0E0",
};

// --- BACKEND URL ---
// ⚠️ IMPORTANT: Replace with your local IP if using Expo Go on phone
const BASE_URL = "http://192.168.1.9:8000";


export default function ChatScreen() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "✨ Welcome to LifeOS.\nYour schedule, habits, and tasks — all in one place.\nHow can I help?",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const scrollViewRef = useRef<ScrollView | null>(null);
  const insets = useSafeAreaInsets();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // ----------------------------------------------
  // FOLLOW-UP MESSAGE (YES / NO)
  // ----------------------------------------------
  async function sendFollowUp(answer: string) {
    setMessages((prev) => [...prev, { role: "user", text: answer }]);
    setLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: answer }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.assistant_response,
          ui: data.ui,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "❌ Error contacting backend." },
      ]);
    }

    setLoading(false);
  }

  // ----------------------------------------------
  // SEND MAIN MESSAGE
  // ----------------------------------------------
  async function sendMessage() {
    if (!input.trim()) return;

    const newMsg = { role: "user", text: input };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMsg.text }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.assistant_response,
          ui: data.ui,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "❌ Error contacting backend." },
      ]);
    }

    setLoading(false);
  }

  // ----------------------------------------------
  // RENDER CONFIRMATION BUTTONS
  // ----------------------------------------------
  function renderConfirmationButtons() {
    return (
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.choiceButton, { backgroundColor: COLORS.Primary }]}
          onPress={() => sendFollowUp("yes")}
        >
          <Text style={styles.choiceText}>Yes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.choiceButton, { backgroundColor: COLORS.NoButtonBg }]}
          onPress={() => sendFollowUp("no")}
        >
          <Text style={[styles.choiceText, { color: COLORS.TextPrimary }]}>
            No
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ----------------------------------------------
  // RENDER EACH MESSAGE BUBBLE
  // ----------------------------------------------
  function renderMessage(m: any, index: number) {
    const isUser = m.role === "user";

    const showActions =
      m.ui &&
      ["confirm_create", "confirm_reschedule", "apply_reschedule", "suggest-slot"]
        .includes(m.ui.action);

    return (
      <View
        key={index}
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text style={isUser ? styles.userText : styles.assistantText}>{m.text}</Text>

        {showActions && renderConfirmationButtons()}
      </View>
    );
  }

  // ----------------------------------------------
  // UI
  // ----------------------------------------------
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 20}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map(renderMessage)}

          {loading && (
            <ActivityIndicator style={{ marginTop: 12 }} color={COLORS.Primary} />
          )}
        </ScrollView>

        {/* INPUT BAR */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 12 }]}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            value={input}
            onChangeText={setInput}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.sendButton, { opacity: input.trim() ? 1 : 0.5 }]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
          >
            <Text style={{ color: "white", fontWeight: "bold" }}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ----------------------------------------------
// STYLES
// ----------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.Background,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 130,
  },

  bubble: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 18,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1.5,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: COLORS.Primary,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "white",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#EAEAEA",
    borderBottomLeftRadius: 4,
  },
  userText: {
    color: "white",
  },
  assistantText: {
    color: COLORS.TextPrimary,
  },

  inputBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
    backgroundColor: "white",
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderColor: "#e8e8e8",
  },

  input: {
    flex: 1,
    backgroundColor: COLORS.InputBackground,
    padding: 12,
    borderRadius: 12,
    marginRight: 10,
    fontSize: 16,
    color: COLORS.TextPrimary,
  },

  sendButton: {
    backgroundColor: COLORS.Primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
  },

  buttonRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 10,
  },
  choiceButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  choiceText: {
    fontWeight: "600",
    color: "white",
  },
});
