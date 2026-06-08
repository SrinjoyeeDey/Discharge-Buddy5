import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useAssistant } from './AssistantProvider';
import { VoiceOrb } from './VoiceOrb';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistantContext } from '@/hooks/assistant/useAssistantContext';
import { useApp } from '@/context/AppContext';
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');

const PURPLE = '#6C47FF';

/**
 * Global Assistant Overlay that sits on top of the entire application.
 * 
 * It renders TWO layers:
 *  1. A persistent FAB (Floating Action Button) in the bottom-right corner — ALWAYS visible,
 *     EXCEPT on the /chat screen where the chatbot has its own mic UI.
 *  2. A full panel that appears when the assistant is active.
 */
export function AssistantOverlay() {
  const { 
    state,
    isVisible,
    meteringSharedValue,
    lastTranscript,
    lastReply,
    error,
    startAssistant,
    cancelAssistant,
    stopAssistant,
  } = useAssistant();

  const { activeModule, pathname } = useAssistantContext();
  const { user, api, speakNeural } = useApp();
  const insets = useSafeAreaInsets();
  const isActive = isVisible && state !== 'idle';

  const [currentDueReminder, setCurrentDueReminder] = useState<any | null>(null);
  const [playbackSound, setPlaybackSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playAudio = async (base64: string) => {
    try {
      setIsPlaying(true);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const dataUri = `data:audio/m4a;base64,${base64}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri: dataUri },
        { shouldPlay: true }
      );
      setPlaybackSound(sound);
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          sound.unloadAsync().catch(() => {});
          setPlaybackSound(null);
        }
      });
    } catch (e) {
      console.warn("Playback error:", e);
      setIsPlaying(false);
    }
  };

  const togglePlay = async () => {
    if (!currentDueReminder?.audioBase64) return;
    if (isPlaying && playbackSound) {
      await playbackSound.stopAsync().catch(() => {});
      await playbackSound.unloadAsync().catch(() => {});
      setPlaybackSound(null);
      setIsPlaying(false);
    } else {
      await playAudio(currentDueReminder.audioBase64);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'patient') return;

    const checkDueReminders = async () => {
      try {
        const due = await api.getDueVoiceReminders();
        if (due && due.length > 0) {
          const reminder = due[0];
          setCurrentDueReminder(reminder);
          
          if (reminder.messageText) {
            await speakNeural(`Reminder: ${reminder.messageText}`);
          }
          
          if (reminder.audioBase64) {
            await playAudio(reminder.audioBase64);
          }
          
          await api.markVoiceReminderDelivered(reminder.id);
        }
      } catch (e) {
        console.warn("Failed to check due reminders:", e);
      }
    };

    checkDueReminders();
    const interval = setInterval(checkDueReminders, 15000);
    return () => clearInterval(interval);
  }, [user, api]);

  // Hide the FAB completely when on chat/scan screens or onboarding/auth screens
  const isChatScreen = activeModule === 'chatbot' || pathname?.includes('/scan');
  const isAuthScreen = !user;
  const shouldHideFab = isChatScreen || isAuthScreen;

  // Drag logic
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = offsetX.value + e.translationX;
      translateY.value = offsetY.value + e.translationY;
    })
    .onEnd(() => {
      offsetX.value = translateX.value;
      offsetY.value = translateY.value;
    });

  const animatedFabStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  if (shouldHideFab && !isVisible) return null;

  return (
    // box-none: passes touches through to the children but not the container itself
    <View style={styles.root} pointerEvents="box-none">

      {/* ── 2. Active Panel (slide up from bottom) ── */}
      

      {isVisible && (
        <View
            style={styles.panelCentered}
            pointerEvents="auto"
          >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.statusDot} />
              <Text style={styles.title}>Voice Assistant</Text>
            </View>
            <TouchableOpacity onPress={cancelAssistant} style={styles.closeButton}>
              <Feather name="x" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Orb */}
          <View style={styles.orbContainer}>
            {/** Compute dynamic orb size based on activity */}
            <VoiceOrb
                  state={state}
                  meteringSharedValue={meteringSharedValue}
                  size={120}
                />
          </View>

          {/* Status text */}
          <View style={styles.statusContainer}>
            {state === 'initializing' && <Text style={styles.statusText}>Starting up...</Text>}
            {state === 'listening'    && <Text style={styles.statusText}>Listening... (stops automatically)</Text>}
            {state === 'transcribing' && <Text style={styles.statusText}>Understanding you...</Text>}
            {state === 'processing'   && <Text style={styles.statusText}>Got it! Working on it...</Text>}
            {state === 'speaking'     && <Text style={styles.statusText}>Buddy is speaking...</Text>}
            {state === 'error'        && <Text style={styles.errorText}>{error || "Something went wrong"}</Text>}

            {lastTranscript && state !== 'error' && (
              <Text style={styles.transcriptText}>"{lastTranscript}"</Text>
            )}

            {lastReply && (state === 'speaking' || state === 'processing') && (
              <Text style={styles.replyText}>{lastReply}</Text>
            )}
          </View>

          {/* Manual stop button — tap instead of waiting */}
          {state === 'listening' && (
            <TouchableOpacity style={styles.stopButton} onPress={stopAssistant}>
              <Feather name="send" size={16} color="#FFF" />
              <Text style={styles.stopButtonText}>Send Now</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── 1. Floating Action Button (FAB) — ALWAYS visible ── */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[styles.fabContainer, { bottom: insets.bottom + 100 }, animatedFabStyle]}
          pointerEvents="auto"
        >
          <TouchableOpacity
            style={[styles.fab, isActive && styles.fabActive]}
            onPress={isVisible ? cancelAssistant : startAssistant}
            activeOpacity={0.85}
          >
            <Feather
              name={isActive ? 'x' : 'mic'}
              size={24}
              color={isActive ? '#FFF' : PURPLE}
            />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>

      {currentDueReminder && (
        <Animated.View 
          entering={ZoomIn} 
          exiting={ZoomOut} 
          style={styles.dueReminderOverlay}
          pointerEvents="auto"
        >
          <View style={styles.dueReminderCard}>
            <View style={styles.dueReminderHeader}>
              <View style={styles.dueReminderHeaderLeft}>
                <Feather name="bell" size={20} color={PURPLE} />
                <Text style={styles.dueReminderTitle}>Scheduled Voice Reminder</Text>
              </View>
              <TouchableOpacity 
                onPress={async () => {
                  if (playbackSound) {
                    await playbackSound.stopAsync().catch(() => {});
                    await playbackSound.unloadAsync().catch(() => {});
                    setPlaybackSound(null);
                  }
                  setIsPlaying(false);
                  setCurrentDueReminder(null);
                }}
                style={styles.dueReminderClose}
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {currentDueReminder.medicineName && (
              <View style={styles.dueReminderMedRow}>
                <Feather name="layers" size={14} color="#8B5CF6" />
                <Text style={styles.dueReminderMedText}>Medicine: {currentDueReminder.medicineName}</Text>
              </View>
            )}

            <Text style={styles.dueReminderMsg}>"{currentDueReminder.messageText}"</Text>

            {currentDueReminder.audioBase64 && (
              <TouchableOpacity 
                style={[styles.dueReminderPlayBtn, isPlaying && styles.dueReminderPlayBtnActive]} 
                onPress={togglePlay}
              >
                <Feather name={isPlaying ? "square" : "play"} size={18} color={isPlaying ? "#FFF" : PURPLE} />
                <Text style={[styles.dueReminderPlayBtnText, isPlaying && styles.dueReminderPlayBtnTextActive]}>
                  {isPlaying ? "Stop Voice Message" : "Listen to Voice Message"}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.dueReminderDismissBtn}
              onPress={async () => {
                if (playbackSound) {
                  await playbackSound.stopAsync().catch(() => {});
                  await playbackSound.unloadAsync().catch(() => {});
                  setPlaybackSound(null);
                }
                setIsPlaying(false);
                setCurrentDueReminder(null);
              }}
            >
              <Text style={styles.dueReminderDismissBtnText}>Got it, thanks!</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // FAB
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 100, // Safe default, overrides the inline style below if needed
    alignItems: 'center',
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  fabActive: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  // Active panel
  panelCentered: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 32,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#1E293B',
  },
  closeButton: {
    padding: 4,
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    marginBottom: 12,
    // Ensure it appears above other elements
    zIndex: 10,
    elevation: 10,
  },
  statusContainer: {
    alignItems: 'center',
    minHeight: 44,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#EF4444',
    textAlign: 'center',
  },
  transcriptText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  replyText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#1E293B',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PURPLE,
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: 'center',
    marginTop: 16,
  },
  stopButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  dueReminderOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    elevation: 20,
    padding: 20,
  },
  dueReminderCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  dueReminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  dueReminderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dueReminderTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#1E293B',
  },
  dueReminderClose: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },
  dueReminderMedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  dueReminderMedText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#6C47FF',
  },
  dueReminderMsg: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#334155',
    lineHeight: 22,
    marginVertical: 10,
    fontStyle: 'italic',
  },
  dueReminderPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#6C47FF',
    backgroundColor: '#EDE9FE',
    borderRadius: 14,
    paddingVertical: 12,
    marginVertical: 10,
  },
  dueReminderPlayBtnActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  dueReminderPlayBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#6C47FF',
  },
  dueReminderPlayBtnTextActive: {
    color: '#FFF',
  },
  dueReminderDismissBtn: {
    backgroundColor: '#6C47FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  dueReminderDismissBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#FFF',
  },
});
