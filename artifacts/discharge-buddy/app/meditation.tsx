import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { TranslateText as Text } from '@/components/TranslateText';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withTiming, 
  withSequence,
  Easing,
  interpolate
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';

const { width } = Dimensions.get('window');
const theme = colors.light;
const PURPLE = "#6C47FF";
const PURPLE_LIGHT = "#EDE9FE";
const MAROON = "#BE185D";

const ORB_SIZE = Math.min(width * 0.6, 250);

const QUOTES = [
  "Peace comes from within. Do not seek it without. - Buddha",
  "The soul always knows what to do to heal itself. - Caroline Myss",
  "Quiet the mind, and the soul will speak. - Ma Jaya Sati Bhagavati",
  "Meditation is not evasion; it is a serene encounter with reality. - Thich Nhat Hanh",
  "Within you, there is a stillness and a sanctuary to which you can retreat at any time. - Hermann Hesse",
  "The goal of meditation is not to get rid of thoughts, but to realize that you are more than your thoughts. - Unknown",
  "Meditation is the discovery that the point of life is always arrived at in the immediate moment. - Alan Watts"
];


export default function MeditationTimerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const initialDuration = params.duration ? parseInt(params.duration as string, 10) * 60 : 300;
  const [timeLeft, setTimeLeft] = useState(initialDuration); 
  const [isActive, setIsActive] = useState(!!params.duration);
  const [customMin, setCustomMin] = useState(params.duration ? (params.duration as string) : '5');
  const [customSec, setCustomSec] = useState('0');
  const [quote, setQuote] = useState(QUOTES[0]);

  // Orb animation values
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (isActive) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 4000, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
          withTiming(1, { duration: 4000, easing: Easing.bezier(0.42, 0, 0.58, 1) })
        ),
        -1,
        false
      );
      opacity.value = withRepeat(
        withTiming(1, { duration: 4000 }),
        -1,
        true
      );
    } else {
      scale.value = withTiming(1);
      opacity.value = withTiming(0.6);
    }
  }, [isActive]);

  const animatedOrbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  useEffect(() => {
    let interval: any;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsActive(!isActive);
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsActive(false);
    const mins = parseInt(customMin) || 0;
    const secs = parseInt(customSec) || 0;
    setTimeLeft(mins * 60 + secs);
  };

  const setPreset = (mins: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsActive(false);
    setTimeLeft(mins * 60);
    setCustomMin(mins.toString());
    setCustomSec('0');
  };

  const handleSetCustom = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsActive(false);
    const mins = parseInt(customMin) || 0;
    const secs = parseInt(customSec) || 0;
    setTimeLeft(mins * 60 + secs);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.compactContainer}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="chevron-left" size={28} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>MEDITATION TIMER</Text>
              <Text style={styles.subtitle}>BY DISCHARGE BUDDY</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          {/* Timer Display */}
          <View style={styles.timerWrapper}>
            <Animated.View style={[styles.orb, animatedOrbStyle]}>
              <View style={styles.innerOrb}>
                <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
              </View>
            </Animated.View>
            {/* Soft decorative rings */}
            <View style={[styles.ring, { width: ORB_SIZE + 40, height: ORB_SIZE + 40, opacity: 0.1 }]} />
            <View style={[styles.ring, { width: ORB_SIZE + 80, height: ORB_SIZE + 80, opacity: 0.05 }]} />
          </View>

          {/* Presets */}
          <View style={styles.presetsContainer}>
            {[5, 10, 15, 20, 30].map((mins) => (
              <TouchableOpacity 
                key={mins} 
                style={styles.presetBtn}
                onPress={() => setPreset(mins)}
              >
                <Text style={styles.presetText}>{mins} min</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Time */}
          <View style={styles.customContainer}>
            <Text style={styles.customLabel}>Or set custom time:</Text>
            <View style={styles.customInputRow}>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  value={customMin}
                  onChangeText={setCustomMin}
                  keyboardType="number-pad"
                  placeholder="0"
                />
                <Text style={styles.inputLabel}>minutes</Text>
              </View>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  value={customSec}
                  onChangeText={setCustomSec}
                  keyboardType="number-pad"
                  placeholder="0"
                />
                <Text style={styles.inputLabel}>seconds</Text>
              </View>
              <TouchableOpacity style={styles.setBtn} onPress={handleSetCustom}>
                <Text style={styles.setBtnText}>Set</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Controls */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity 
              style={[styles.mainBtn, { backgroundColor: PURPLE }]} 
              onPress={handleStartPause}
            >
              <Text style={styles.mainBtnText}>{isActive ? 'Pause' : 'Start'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.mainBtn, { backgroundColor: '#A21CAF' }]} 
              onPress={handleReset}
            >
              <Text style={styles.mainBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Quote */}
          <View style={styles.quoteContainer}>
            <Text style={styles.quoteText}>"{quote}"</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  compactContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#1E1B4B',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
    marginTop: 4,
    letterSpacing: 1,
  },
  timerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: ORB_SIZE + 60,
    marginBottom: 20,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: PURPLE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 2,
  },
  innerOrb: {
    width: ORB_SIZE * 0.85,
    height: ORB_SIZE * 0.85,
    borderRadius: (ORB_SIZE * 0.85) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  timerText: {
    fontSize: 48,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  ring: {
    position: 'absolute',
    borderRadius: 1000,
    borderWidth: 2,
    borderColor: PURPLE,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  presetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PURPLE,
    backgroundColor: '#FFF',
  },
  presetText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: PURPLE,
  },
  customContainer: {
    width: '100%',
    paddingHorizontal: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  customLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
    marginBottom: 15,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#1E1B4B',
    backgroundColor: '#F8FAFC',
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
  },
  setBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PURPLE,
  },
  setBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: PURPLE,
  },

  controlsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  mainBtn: {
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mainBtnText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  quoteContainer: {
    paddingHorizontal: 40,
  },
  quoteText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },
});
