import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useVoiceSession } from '@/hooks/assistant/useVoiceSession';
import { useAssistantContext } from '@/hooks/assistant/useAssistantContext';
import { useAssistantEvents } from '@/hooks/assistant/useAssistantEvents';
import { useApp, type SymptomLog } from '@/context/AppContext';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { LOCALE_BY_LANG, type Language } from '@/constants/translations';
import { loadHistory, appendTurns, recentForPrompt } from '@/utils/conversationMemory';
import { describeScreen } from '@/utils/contextEngine';

export type AssistantState =
  | 'idle'
  | 'initializing'
  | 'listening'
  | 'speech_detected'
  | 'transcribing'
  | 'sending'
  | 'processing'
  | 'speaking'
  | 'sleeping'
  | 'error'
  | 'permission_denied'
  | 'interrupted';

interface AssistantContextValue {
  state: AssistantState;
  isVisible: boolean;
  meteringSharedValue: any;
  lastTranscript: string | null;
  lastReply: string | null;
  error: string | null;
  startAssistant: () => Promise<void>;
  stopAssistant: () => Promise<void>;
  cancelAssistant: () => Promise<void>;
  dismissOverlay: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}

// ── Voice → screen map. Every target the backend intent router can return for a
//    NAVIGATE intent has a destination + a human label spoken back to the user. ──
const NAV_ROUTES: Record<string, { path: string; label: string }> = {
  medicines: { path: '/(tabs)/medicines', label: 'your medicines' },
  symptoms: { path: '/(tabs)/symptoms', label: 'your symptoms' },
  progress: { path: '/(tabs)/progress', label: 'your progress' },
  schedule: { path: '/(tabs)/schedule', label: 'your schedule' },
  followups: { path: '/(tabs)/followups', label: 'your follow ups' },
  home: { path: '/(tabs)', label: 'home' },
  journal: { path: '/journal', label: 'your journal' },
  scan: { path: '/scan', label: 'the prescription scanner' },
  chat: { path: '/chat', label: 'the chat' },
  profile: { path: '/profile', label: 'your profile' },
  settings: { path: '/settings', label: 'settings' },
  notifications: { path: '/notifications', label: 'your notifications' },
  emergency: { path: '/emergency', label: 'the emergency screen' },
  family: { path: '/family/dashboard', label: 'the family dashboard' },
};

// LOCALE_BY_LANG is the shared source of truth (constants/translations.ts).

const LANG_SWITCH_REPLY: Partial<Record<Language, string>> = {
  en: 'Okay, switching to English.',
  hi: 'ठीक है, अब मैं हिंदी में बात करूँगा।',
  es: 'De acuerdo, ahora hablaré en español.',
  ur: 'ٹھیک ہے، اب میں اردو میں بات کروں گا۔',
  bn: 'ঠিক আছে, এখন আমি বাংলায় কথা বলব।',
};

// Strip emojis / pictographs so the TTS engine doesn't read them aloud.
function stripForSpeech(text: string): string {
  return text
    .replace(
      /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA9F}\u{1FAA0}-\u{1FAFF}\u{200D}\u{20E3}\u{FE0F}]/gu,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

const isBengaliText = (text: string) => /[\u0980-\u09FF]/.test(text);
const isHindiText = (text: string) => /[\u0900-\u097F]/.test(text);

const SYMPTOM_LOCALIZATION: Record<string, Record<string, string>> = {
  en: {
    Dizziness: 'dizziness',
    Headache: 'headache',
    Nausea: 'nausea',
    Pain: 'pain',
    Fever: 'fever',
    Cough: 'cough',
    Fatigue: 'fatigue',
    'Shortness of Breath': 'shortness of breath',
    Symptom: 'symptom',
  },
  bn: {
    Dizziness: 'মাথা ঘোরা (dizziness)',
    Headache: 'মাথা ব্যথা (headache)',
    Nausea: 'বমি বমি ভাব (nausea)',
    Pain: 'ব্যথা (pain)',
    Fever: 'জ্বর (fever)',
    Cough: 'কাশি (cough)',
    Fatigue: 'দুর্বলতা (fatigue)',
    'Shortness of Breath': 'শ্বাসকষ্ট (shortness of breath)',
    Symptom: 'উপসর্গ (symptom)',
  },
  hi: {
    Dizziness: 'चक्कर आना (dizziness)',
    Headache: 'सिरदर्द (headache)',
    Nausea: 'उल्टी सा लगना (nausea)',
    Pain: 'दर्द (pain)',
    Fever: 'बुखार (fever)',
    Cough: 'खांसी (cough)',
    Fatigue: 'थकान (fatigue)',
    'Shortness of Breath': 'सांस लेने में तकलीफ (shortness of breath)',
    Symptom: 'लक्षण (symptom)',
  }
};

function extractSymptom(text: string, lang: string): string {
  const t = text.toLowerCase();
  
  if (t.includes('ghur') || t.includes('dizzy') || t.includes('dizziness') || t.includes('dizi') || t.includes('giddiness')) {
    return 'Dizziness';
  }
  if (t.includes('betha') || t.includes('byatha') || t.includes('pain') || t.includes('sore') || t.includes('hurt')) {
    if (t.includes('matha') || t.includes('head')) {
      return 'Headache';
    }
    return 'Pain';
  }
  if (t.includes('headache') || t.includes('head ache')) {
    return 'Headache';
  }
  if (t.includes('bomi') || t.includes('nausea') || t.includes('vomit') || t.includes('vomiting')) {
    return 'Nausea';
  }
  if (t.includes('jwor') || t.includes('jhor') || t.includes('fever') || t.includes('temp') || t.includes('temperature') || t.includes('bukhar')) {
    return 'Fever';
  }
  if (t.includes('kashi') || t.includes('cough') || t.includes('cold') || t.includes('khansi')) {
    return 'Cough';
  }
  if (t.includes('durbol') || t.includes('fatigue') || t.includes('tired') || t.includes('weak') || t.includes('thakan')) {
    return 'Fatigue';
  }
  if (t.includes('sash') || t.includes('breath') || t.includes('sob') || t.includes('gasp') || t.includes('saf')) {
    return 'Shortness of Breath';
  }
  
  return 'Symptom';
}

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AssistantState>('idle');
  const [isVisible, setIsVisible] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [lastReply, setLastReply] = useState<string | null>(null);

  const { activeModule } = useAssistantContext();
  const events = useAssistantEvents();
  const {
    api,
    user,
    language,
    setLanguage,
    logout,
    triggerEmergency,
    todayDoses,
    updateDoseStatus,
    stopSpeaking,
  } = useApp();

  const userKey = user?.email || 'guest';

  // When true, the assistant keeps the mic open after answering a conversational
  // (CHAT) turn so the user can keep talking hands-free. Any explicit stop,
  // navigation or action clears it so we never loop forever.
  const continueConversationRef = useRef(false);
  const startAssistantRef = useRef<() => Promise<void>>(async () => {});
  const pendingSymptomLogRef = useRef<{ symptom: string; lang: string } | null>(null);

  // ── Speak a phrase and resolve when playback finishes. ──
  const speak = useCallback(
    (text: string, localeOverride?: string) =>
      new Promise<void>((resolve) => {
        const clean = stripForSpeech(text);
        if (!clean) {
          resolve();
          return;
        }

        let resolved = false;
        const safeResolve = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };

        // Safety timeout: average reading rate is ~12-15 chars per second.
        // We set the timeout to clean.length / 12 * 1000 + 3000ms buffer.
        const estimatedDurationMs = Math.max(3000, (clean.length / 12) * 1000);
        const timeoutId = setTimeout(() => {
          console.warn("[Assistant] TTS playback timed out after estimated duration:", estimatedDurationMs);
          safeResolve();
        }, estimatedDurationMs);

        try {
          Speech.stop();
          Speech.speak(clean, {
            language: localeOverride || LOCALE_BY_LANG[language] || 'en-US',
            pitch: 1.0,
            rate: 0.95,
            onDone: () => {
              clearTimeout(timeoutId);
              safeResolve();
            },
            onStopped: () => {
              clearTimeout(timeoutId);
              safeResolve();
            },
            onError: () => {
              clearTimeout(timeoutId);
              safeResolve();
            },
          });
        } catch (e) {
          console.warn("[Assistant] Speech.speak threw error:", e);
          clearTimeout(timeoutId);
          safeResolve();
        }
      }),
    [language],
  );

  const finish = useCallback(() => {
    setState('idle');
    setIsVisible(false);
  }, []);

  // ── Handlers for ACTION-type intents (things that DO something). ──
  const handleAction = useCallback(
    async (target: string, currentTranscript: string): Promise<void> => {
      let reply = '';

      switch (target) {
        case 'TAKE_MEDICINE': {
          const lowerTranscript = currentTranscript.toLowerCase();
          const isAll = lowerTranscript.includes('all');
          let pendingDoses = todayDoses.filter((d) => d.status === 'pending');
          
          if (pendingDoses.length === 0) {
            reply = `I don't see any pending doses right now — you're all caught up!`;
          } else {
            const mentionedMed = pendingDoses.find(d => lowerTranscript.includes(d.medicineName.toLowerCase()));
            
            let dosesToMark = [];
            if (mentionedMed && isAll) {
              dosesToMark = pendingDoses.filter(d => d.medicineName.toLowerCase() === mentionedMed.medicineName.toLowerCase());
            } else if (mentionedMed) {
              dosesToMark = [mentionedMed];
            } else if (isAll) {
              dosesToMark = pendingDoses;
            } else {
              dosesToMark = [pendingDoses[0]];
            }

            try {
              await Promise.all(dosesToMark.map(d => updateDoseStatus(d.id, 'taken')));
              const names = Array.from(new Set(dosesToMark.map(d => d.medicineName))).join(' and ');
              reply = `Done. I've marked ${names} as taken. Great job staying on track!`;
            } catch {
              reply = `I couldn't update those doses just now. Please try from the medicines screen.`;
            }
          }
          setLastReply(reply);
          setState('speaking');
          await speak(reply);
          finish();
          return;
        }
        case 'NAVIGATE_TO_MEDICINES': {
          reply = `I cannot update schedules directly, but I am taking you to the medicines page where you can change the timings.`;
          setLastReply(reply);
          setState('speaking');
          await speak(reply);
          router.push('/(tabs)/medicines');
          finish();
          return;
        }
        case 'LOG_SYMPTOM': {
          const activeLang = isBengaliText(currentTranscript) ? 'bn' : (isHindiText(currentTranscript) ? 'hi' : language);
          const symptomKey = extractSymptom(currentTranscript, activeLang);
          
          pendingSymptomLogRef.current = {
            symptom: symptomKey,
            lang: activeLang
          };
          
          const localizedDict = SYMPTOM_LOCALIZATION[activeLang] || SYMPTOM_LOCALIZATION['en'];
          const localizedSymptom = localizedDict[symptomKey] || symptomKey;
          
          let reply = '';
          if (activeLang === 'bn') {
            reply = `আপনার ${localizedSymptom} এর তীব্রতা ১ থেকে ৫ এর মধ্যে কত? ৫ হচ্ছে সবচেয়ে বেশি।`;
          } else if (activeLang === 'hi') {
            reply = `आपके ${localizedSymptom} की तीव्रता 1 से 5 के बीच कितनी है? 5 सबसे अधिक है।`;
          } else {
            reply = `How would you rate the severity of your ${localizedSymptom} from 1 to 5, with 5 being the most severe?`;
          }
          
          router.push('/(tabs)/symptoms' as any);
          
          setLastReply(reply);
          setState('speaking');
          await speak(reply, LOCALE_BY_LANG[activeLang]);
          
          setTimeout(() => {
            if (continueConversationRef.current) {
              startAssistantRef.current();
            }
          }, 500);
          return;
        }
        case 'ADD_MEDICINE': {
          reply = 'Opening your medicines so you can add a new one.';
          setLastReply(reply);
          setState('speaking');
          router.push('/(tabs)/medicines' as any);
          await speak(reply);
          finish();
          return;
        }
        case 'TRIGGER_EMERGENCY': {
          reply = "Hang on — I'm getting help for you right now.";
          setLastReply(reply);
          setState('speaking');
          try {
            await triggerEmergency();
          } catch {
            // Even if the alert call fails, still take the user to the SOS screen.
          }
          router.push('/emergency' as any);
          await speak(reply);
          finish();
          return;
        }
        case 'LOGOUT': {
          reply = 'Okay, logging you out. Take care!';
          setLastReply(reply);
          setState('speaking');
          continueConversationRef.current = false;
          await speak(reply);
          finish();
          logout();
          return;
        }
        case 'LANG_EN':
        case 'LANG_HI':
        case 'LANG_ES':
        case 'LANG_UR':
        case 'LANG_BN': {
          const code = target.replace('LANG_', '').toLowerCase() as Language;
          setLanguage(code);
          reply = LANG_SWITCH_REPLY[code] || 'Okay.';
          setLastReply(reply);
          setState('speaking');
          await speak(reply, LOCALE_BY_LANG[code]);
          finish();
          return;
        }
        case 'SEND_NOTE_TO_FAMILY': {
          // Extract the core message from the transcript. Typical patterns:
          //  "Tell my daughter I had lunch" → "I had lunch"
          //  "Let my son know that I took my medicine" → "I took my medicine"
          //  "Inform family I am feeling better" → "I am feeling better"
          const noteMatch = currentTranscript.match(
            /(?:tell|let|inform|notify)\s+(?:my\s+\w+|family|caregiver)\s+(?:that\s+|to\s+)?(.+)/i
          );
          const noteText = noteMatch?.[1]?.trim() || currentTranscript;

          setState('processing');
          try {
            const result = await api.sendVoiceNote(currentTranscript, noteText);
            reply = result.success
              ? `Done. I've sent your message to your family: "${noteText}".`
              : `I recorded your note, but couldn't reach your family right now. They'll see it when they're online.`;
          } catch {
            reply = `I wasn't able to send the note right now. Please try again in a moment.`;
          }
          setLastReply(reply);
          setState('speaking');
          await speak(reply);
          finish();
          return;
        }
        default: {
          // Unrecognised action → treat as a conversation so the user still gets a reply.
          await handleChatRef.current(currentTranscript || '');
          return;
        }
      }
    },
    [todayDoses, updateDoseStatus, triggerEmergency, logout, setLanguage, speak, finish, api],
  );

  // ── Conversational fallback: ask Mr. Meddy and speak the answer. ──
  const handleChatRef = useRef<(text: string) => Promise<void>>(async () => {});
  const handleChat = useCallback(
    async (text: string): Promise<void> => {
      setState('processing');
      const activeLang = isBengaliText(text) ? 'bn' : (isHindiText(text) ? 'hi' : language);
      let message = "I'm right here with you.";
      try {
        // Share the same persisted memory as the chat screen (Phase 5), and tell
        // the model which screen the user is on (Phase 7) for "what is this?".
        const priorHistory = await loadHistory(userKey);
        const screenHint = describeScreen(activeModule).hint;
        const res = await api.getChatResponse(text, activeLang, recentForPrompt(priorHistory), screenHint);
        if (res?.message) message = res.message;
      } catch {
        message = "I'm having a little trouble connecting right now. Please try again in a moment.";
      }

      appendTurns(userKey, [
        { role: 'user', text },
        { role: 'assistant', text: message },
      ]).catch(() => {});

      setLastReply(message);
      setState('speaking');
      await speak(message, LOCALE_BY_LANG[activeLang]);

      // Keep the conversation going hands-free if the user hasn't cancelled.
      if (continueConversationRef.current) {
        setTimeout(() => {
          if (continueConversationRef.current) {
            startAssistantRef.current();
          }
        }, 500);
      } else {
        finish();
      }
    },
    [api, speak, finish, language, userKey, activeModule],
  );
  useEffect(() => {
    handleChatRef.current = handleChat;
  }, [handleChat]);

  const handleSymptomSeverityRating = async (transcript: string) => {
    if (!pendingSymptomLogRef.current) return;
    
    const { symptom, lang } = pendingSymptomLogRef.current;
    const cleanText = transcript.toLowerCase().trim();
    let severity = 0;
    
    const digitMatch = cleanText.match(/[1-5]/);
    if (digitMatch) {
      severity = parseInt(digitMatch[0], 10);
    } else {
      if (cleanText.includes('one') || cleanText.includes('ek') || cleanText.includes('এক')) severity = 1;
      else if (cleanText.includes('two') || cleanText.includes('dui') || cleanText.includes('do') || cleanText.includes('দুই')) severity = 2;
      else if (cleanText.includes('three') || cleanText.includes('tin') || cleanText.includes('teen') || cleanText.includes('তিন')) severity = 3;
      else if (cleanText.includes('four') || cleanText.includes('char') || cleanText.includes('chaar') || cleanText.includes('চার')) severity = 4;
      else if (cleanText.includes('five') || cleanText.includes('paanch') || cleanText.includes('pac') || cleanText.includes('পাঁচ')) severity = 5;
    }
    
    if (severity >= 1 && severity <= 5) {
      const newLog: SymptomLog = {
        id: Math.random().toString(),
        date: new Date().toISOString().split('T')[0],
        symptoms: [symptom],
        severity: severity,
        notes: `Logged via Voice Assistant in ${lang === 'bn' ? 'Bengali' : (lang === 'hi' ? 'Hindi' : 'English')}.`,
        riskLevel: severity >= 4 ? 'high' : (severity === 3 ? 'medium' : 'low'),
      };
      
      try {
        await api.addSymptomLog(newLog);
      } catch (err) {
        console.error("Failed to add symptom log:", err);
      }
      
      pendingSymptomLogRef.current = null;
      
      const localizedDict = SYMPTOM_LOCALIZATION[lang] || SYMPTOM_LOCALIZATION['en'];
      const localizedSymptom = localizedDict[symptom] || symptom;
      
      let reply = '';
      if (lang === 'bn') {
        reply = `তীব্রতা ${severity} এর সাথে আপনার ${localizedSymptom} যোগ করা হয়েছে। আপনার পরিবারের সদস্যদের সতর্ক করা হয়েছে।`;
      } else if (lang === 'hi') {
        reply = `Severity ${severity} के साथ आपका ${localizedSymptom} दर्ज कर लिया गया है। आपके परिवार को सूचित कर दिया गया है।`;
      } else {
        reply = `Logged ${localizedSymptom} with a severity rating of ${severity}. Caregiver and family alerts have been updated.`;
      }
      
      setLastReply(reply);
      setState('speaking');
      await speak(reply, LOCALE_BY_LANG[lang as Language]);
      
      if (continueConversationRef.current) {
        setTimeout(() => {
          if (continueConversationRef.current) {
            startAssistantRef.current();
          }
        }, 500);
      } else {
        finish();
      }
    } else {
      let reply = '';
      if (lang === 'bn') {
        reply = 'দয়া করে আপনার উপসর্গের তীব্রতা ১ থেকে ৫ এর মধ্যে কত বলুন। ৫ হচ্ছে সবচেয়ে বেশি তীব্র।';
      } else if (lang === 'hi') {
        reply = 'कृपया अपने लक्षण की तीव्रता 1 से 5 के बीच बताएं, जहां 5 सबसे अधिक है।';
      } else {
        reply = "Please tell me a severity rating from 1 to 5, with 5 being the most severe.";
      }
      
      setLastReply(reply);
      setState('speaking');
      await speak(reply, LOCALE_BY_LANG[lang as Language]);
      
      setTimeout(() => {
        if (continueConversationRef.current) {
          startAssistantRef.current();
        }
      }, 500);
    }
  };

  // ── The heart of the assistant: transcript → intent → action / answer. ──
  const handleTranscript = useCallback(
    async (text: string | null): Promise<void> => {
      if (!text || !text.trim()) {
        events.publish('TRANSCRIPTION_FAILED');
        setLastReply(null);
        setState('speaking');
        await speak("Sorry, I didn't catch that. Please try again.");
        if (continueConversationRef.current) {
          setTimeout(() => {
            if (continueConversationRef.current) {
              startAssistantRef.current();
            }
          }, 500);
        } else {
          finish();
        }
        return;
      }

      const transcript = text.trim();
      setLastTranscript(transcript);
      events.publish('TRANSCRIPTION_SUCCESS', { text: transcript, context: activeModule });
      
      if (pendingSymptomLogRef.current) {
        await handleSymptomSeverityRating(transcript);
        return;
      }
      
      setState('processing');

      let result: { intent: string; target: string; confidence: number };
      try {
        result = await api.getIntent(transcript, activeModule || 'unknown');
      } catch (err) {
        console.warn('[Assistant] Intent parse failed, falling back to chat', err);
        result = { intent: 'CHAT', target: '', confidence: 0 };
      }

      const intent = (result?.intent || '').toUpperCase();
      const target = result?.target || '';

      if (intent === 'NAVIGATE' && NAV_ROUTES[target]) {
        const route = NAV_ROUTES[target];
        const reply = `Opening ${route.label}.`;
        setLastReply(reply);
        setState('speaking');
        router.push(route.path as any);
        await speak(reply);
        finish();
        return;
      }

      if (intent === 'ACTION' && target) {
        await handleAction(target, transcript);
        return;
      }

      // CHAT, UNKNOWN, or an unmapped target → conversational answer.
      await handleChat(transcript);
    },
    [api, activeModule, events, speak, finish, handleAction, handleChat],
  );
  const handleTranscriptRef = useRef(handleTranscript);
  useEffect(() => {
    handleTranscriptRef.current = handleTranscript;
  }, [handleTranscript]);

  const {
    isListening,
    isTranscribing,
    meteringSharedValue,
    error: sessionError,
    startSession,
    stopSession,
    cancelSession,
  } = useVoiceSession({
    onTranscript: (t) => handleTranscriptRef.current(t),
  });

  // Reflect the mic lifecycle into the visible state. This effect only ever
  // *raises* listening/transcribing/error — it never forces 'idle', so it can't
  // stomp the processing/speaking phases the pipeline drives explicitly.
  useEffect(() => {
    if (sessionError) {
      setState((s) => (s === 'speaking' ? s : 'error'));
    } else if (isTranscribing) {
      setState('transcribing');
    } else if (isListening) {
      setState('listening');
    }
  }, [isListening, isTranscribing, sessionError]);

  const startAssistant = useCallback(async () => {
    continueConversationRef.current = true;
    setState('initializing');
    setIsVisible(true);
    setLastTranscript(null);
    setLastReply(null);
    events.publish('SPEECH_STARTED');

    try {
      await stopSpeaking().catch(() => {});
      Speech.stop();
      await startSession();
    } catch {
      setState('error');
    }
  }, [startSession, stopSpeaking, events]);
  useEffect(() => {
    startAssistantRef.current = startAssistant;
  }, [startAssistant]);

  // Manual "Send Now": just stop the recording. The transcript is delivered to
  // handleTranscript through the onTranscript callback, so the pipeline runs once.
  const stopAssistant = useCallback(async () => {
    setState('transcribing');
    await stopSession();
  }, [stopSession]);

  const cancelAssistant = useCallback(async () => {
    continueConversationRef.current = false;
    Speech.stop();
    await stopSpeaking().catch(() => {});
    await cancelSession();
    setState('idle');
    setIsVisible(false);
    setLastReply(null);
  }, [cancelSession, stopSpeaking]);

  const dismissOverlay = useCallback(() => {
    if (state === 'idle' || state === 'error') {
      setIsVisible(false);
    } else {
      cancelAssistant();
    }
  }, [state, cancelAssistant]);

  const value = useMemo(
    () => ({
      state,
      isVisible,
      meteringSharedValue,
      lastTranscript,
      lastReply,
      error: sessionError,
      startAssistant,
      stopAssistant,
      cancelAssistant,
      dismissOverlay,
    }),
    [
      state,
      isVisible,
      meteringSharedValue,
      lastTranscript,
      lastReply,
      sessionError,
      startAssistant,
      stopAssistant,
      cancelAssistant,
      dismissOverlay,
    ],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
