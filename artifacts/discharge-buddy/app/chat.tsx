import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, } from 'react-native';
import { TranslateText as Text } from '@/components/TranslateText';
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp, LinearTransition, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from "react-native-reanimated";

import { useApp } from "@/context/AppContext";
import { NeuralOrb } from "@/components/NeuralOrb";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { loadHistory, appendTurns, recentForPrompt, clearHistory } from "@/utils/conversationMemory";
import { describeScreen } from "@/utils/contextEngine";
import { useAssistantContext } from "@/hooks/assistant/useAssistantContext";

const { width } = Dimensions.get("window");
const PURPLE = "#6C47FF";
const PURPLE_LIGHT = "#F5F3FF";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  actions?: { type: string; label: string }[];
}

const ACTION_ICONS: Record<string, string> = {
  LOG_SYMPTOM: "📋",
  CONTACT_CAREGIVER: "👨‍⚕️",
  START_MEDITATION: "🧘",
  RETRY: "🔄",
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { api, user, speakNeural, stopSpeaking, isSpeaking, speakingTargetId, addNotification, language } = useApp();

  const isAISpeakingGlobal = isSpeaking && speakingTargetId === "chat_ai";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: `Hello ${user?.name?.split(" ")[0] || "there"}! I'm Mr. Meddy (V2), your recovery companion. How are you feeling today? 💜`,
      sender: "ai",
      actions: [
        { type: "LOG_SYMPTOM", label: "Log Symptom" },
        { type: "START_MEDITATION", label: "Start Calm Session" },
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Per-user key for the shared conversation memory (Phase 5).
  const userKey = user?.email || "guest";
  const { activeModule } = useAssistantContext();

  // Rehydrate prior turns on mount so Buddy remembers across app launches.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const past = await loadHistory(userKey);
      if (cancelled || past.length === 0) return;
      const restored: Message[] = past.map((t, i) => ({
        id: `mem_${t.ts}_${i}`,
        text: t.text,
        sender: t.role === "assistant" ? "ai" : "user",
      }));
      // Keep the welcome bubble first, then the restored history.
      setMessages((prev) => [prev[0], ...restored]);
    })();
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  /*
  useEffect(() => {
    // Speak the welcome message with a short delay
    const t = setTimeout(() => {
      speakNeural(messages[0].text, messages[0].id);
    }, 600);
    return () => clearTimeout(t);
  }, []);
  */

  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), text: textToSend.trim(), sender: "user" };
    setMessages(prev => {
      const next = [...prev, userMsg];
      console.log("[ChatScreen] setMessages (User) -> count:", next.length);
      return next;
    });
    setInput("");
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log("[ChatScreen] handleSend triggered with input:", userMsg.text);
    try {
      // Pass recent conversation so Buddy can resolve follow-ups (Phase 5).
      const priorHistory = await loadHistory(userKey);
      const response = await api.getChatResponse(userMsg.text, language, recentForPrompt(priorHistory), describeScreen(activeModule).hint);
      console.log("[ChatScreen] Got response from API:", response);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: response.message,
        sender: "ai",
        actions: response.actions,
      };
      setMessages(prev => {
        const next = [...prev, aiMsg];
        console.log("[ChatScreen] setMessages (AI) -> count:", next.length);
        return next;
      });
      // Persist both turns so the memory survives navigation and app restarts.
      appendTurns(userKey, [
        { role: "user", text: userMsg.text },
        { role: "assistant", text: response.message },
      ]).catch(() => { });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
      console.log("[ChatScreen] AI Message added to state. Now triggering TTS...");
      speakNeural(response.message, aiMsg.id).catch(e => console.error("[ChatScreen] TTS Background Error:", e));
    } catch (err) {
      console.error("[ChatScreen] handleSend error:", err);
      const errorMsg: Message = {
        id: "err_" + Date.now(),
        text: "I'm having a little trouble connecting. Please rest a bit and try again. 💜",
        sender: "ai",
        actions: [{ type: "RETRY", label: "Try Again" }],
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => sendMessage(input);

  const handleClearConversation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await clearHistory(userKey);
    setMessages((prev) => [prev[0]]);
  };

  const handleAction = (action: { type: string; label: string }) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    switch (action.type) {
      case "LOG_SYMPTOM":
        router.push("/symptoms");
        break;
      case "START_MEDITATION":
        router.push("/recovery-support");
        break;
      case "CONTACT_CAREGIVER":
        addNotification({
          title: "Caregiver Notified",
          body: "Your caregiver has been informed about your current symptoms.",
          icon: "user",
          color: "#6C47FF",
        });
        break;
      case "RETRY":
        if (messages.length > 1) {
          const lastUserMsg = [...messages].reverse().find(m => m.sender === "user");
          if (lastUserMsg) {
            setInput(lastUserMsg.text);
          }
        }
        break;
      default:
        // Act as a quick reply for dynamically generated AI actions
        sendMessage(action.label);
        break;
    }
  };

  console.log("[ChatScreen] Rendering with messages:", messages.length);
  return (
    <View style={styles.container}>
      {/* Soft Pastel Gradient Background */}
      <LinearGradient
        colors={["#E0E7FF", "#F5F3FF", "#FCE7F3"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative Background Blobs */}
      <View style={[styles.blob, { top: 80, left: -60, backgroundColor: "rgba(216, 180, 254, 0.35)" }]} />
      <View style={[styles.blob, { bottom: 120, right: -60, backgroundColor: "rgba(186, 230, 253, 0.35)" }]} />
      <View style={[styles.blob, { top: "50%", left: "20%", backgroundColor: "rgba(253, 186, 233, 0.2)", width: 180, height: 180, borderRadius: 90 }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="chevron-left" size={22} color={PURPLE} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Mr. Meddy</Text>
          <Text style={styles.headerSub}>{isSpeaking ? "Speaking…" : "Recovery Companion"}</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={handleClearConversation}>
          <Feather name="trash-2" size={18} color={PURPLE} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, borderStyle: 'solid', borderColor: 'red', borderWidth: 0 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {/* Central Orb Hero */}
          <View style={styles.orbSection}>
            <View style={styles.mainOrbWrapper}>
              <NeuralOrb isSpeaking={isSpeaking} isProcessing={isLoading || isListening || isTranscribing} isAssistant={true} />
            </View>
            {isListening ? (
              <Text style={[styles.orbHint, { color: PURPLE, fontWeight: 'bold' }]}>🎙️ Recording... tap the mic to send</Text>
            ) : isTranscribing ? (
              <Text style={[styles.orbHint, { color: "#9333EA", fontWeight: 'bold' }]}>⏳ Transcribing your speech...</Text>
            ) : !isSpeaking && !isLoading && (
              <Text style={styles.orbHint}>Tap 🎙️ to speak, tap again to send to Mr. Meddy</Text>
            )}
          </View>

          {/* Message Thread */}
          <View style={styles.messageList}>
            {messages.map((msg, idx) => (
              <Animated.View
                key={msg.id}
                style={[
                  styles.messageWrapper,
                  msg.sender === "user" ? styles.userMsgWrapper : styles.aiMsgWrapper,
                ]}
              >
                {msg.sender === "ai" && (
                  <View style={styles.aiAvatar}>
                    <Text style={styles.aiAvatarText}>M</Text>
                  </View>
                )}
                <View style={[msg.sender === "user" ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }, { flex: 1 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={[styles.bubble, msg.sender === "user" ? styles.userBubble : styles.aiBubble]}>
                      <Text style={[styles.bubbleText, msg.sender === "user" ? styles.userText : styles.aiText]}>
                        {msg.text}
                      </Text>
                    </View>

                    {msg.sender === "ai" && (
                      <VoiceButton
                        text={msg.text}
                        msgId={msg.id}
                        isSpeaking={isSpeaking}
                        speakingTargetId={speakingTargetId}
                        speakNeural={speakNeural}
                      />
                    )}
                  </View>
                  {msg.actions && msg.actions.length > 0 && (
                    <View style={styles.actionRow}>
                      {msg.actions.map((action, i) => (
                        <TouchableOpacity
                          key={i}
                          style={styles.actionChip}
                          onPress={() => handleAction(action)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.actionEmoji}>{ACTION_ICONS[action.type] || "💊"}</Text>
                          <Text style={styles.actionLabel}>{action.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </Animated.View>
            ))}

            {isTranscribing && (
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color="#9333EA" style={{ marginRight: 8 }} />
                <Text style={[styles.typingText, { color: "#9333EA" }]}>Transcribing your speech…</Text>
              </View>
            )}

            {isLoading && (
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color={PURPLE} style={{ marginRight: 8 }} />
                <Text style={styles.typingText}>Mr. Meddy is thinking…</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Input Bar */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder={isListening ? "Listening..." : isTranscribing ? "Transcribing..." : "How are you feeling?"}
              placeholderTextColor="#A0AEC0"
              value={input}
              onChangeText={(t) => {
                console.log("[ChatScreen] Input changed:", t);
                setInput(t);
              }}
              onSubmitEditing={handleSend}
              multiline={false}
              returnKeyType="send"
              editable={!isTranscribing && !isLoading && !isListening}
            />
            {input.trim() ? (
              <TouchableOpacity
                onPress={handleSend}
                style={[styles.sendBtn, isLoading && styles.sendBtnDisabled]}
                disabled={isLoading}
              >
                <Feather name="send" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <VoiceInputButton
                onTranscriptionComplete={(text) => {
                  console.log("[ChatScreen] Voice transcription complete:", text);
                  setInput(text);
                  sendMessage(text);
                }}
                onListeningStateChange={setIsListening}
                onTranscribingStateChange={setIsTranscribing}
                disabled={isLoading}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const VoiceButton = ({ text, msgId, isSpeaking, speakingTargetId, speakNeural }: any) => {
  const isActive = isSpeaking && speakingTargetId === msgId;
  return (
    <TouchableOpacity onPress={() => speakNeural(text, msgId)} style={styles.voiceBtnContainer}>
      <Feather name={isActive ? "volume-2" : "volume-1"} size={13} color={isActive ? PURPLE : "#94A3B8"} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  blob: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    // React Native doesn't support CSS blur directly; use opacity for the tint effect
    opacity: 0.9,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  headerSub: { fontSize: 12, color: "#7C3AED", fontFamily: "Inter_500Medium", marginTop: 1 },
  scrollContent: { paddingBottom: 120 },
  orbSection: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 24,
  },
  mainOrbWrapper: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  orbHint: {
    fontSize: 13,
    color: "#94A3B8",
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
  messageList: { paddingHorizontal: 16 },
  messageWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 16,
    gap: 8,
  },
  userMsgWrapper: { justifyContent: "flex-end" },
  aiMsgWrapper: { justifyContent: "flex-start" },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  aiAvatarText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  bubble: {
    maxWidth: width * 0.72,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: PURPLE,
    borderBottomRightRadius: 6,
    alignSelf: "flex-end",
  },
  aiBubble: {
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    borderBottomLeftRadius: 6,
  },
  bubbleText: { fontSize: 15, lineHeight: 22, fontFamily: "Inter_500Medium" },
  userText: { color: "#fff" },
  aiText: { color: "#1E1B4B" },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 8,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.65)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(108, 71, 255, 0.2)",
  },
  actionEmoji: { fontSize: 14 },
  actionLabel: { fontSize: 13, color: PURPLE, fontFamily: "Inter_600SemiBold" },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 40,
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.65)",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  typingText: { fontSize: 14, color: "#7C3AED", fontFamily: "Inter_500Medium" },
  inputContainer: {
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(108,71,255,0.15)",
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: "#1E1B4B",
    fontFamily: "Inter_500Medium",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#A78BFA",
  },
  voiceBtnContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "rgba(108,71,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
});
