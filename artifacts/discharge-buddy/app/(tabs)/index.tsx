import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, Platform, ScrollView, StyleSheet, TouchableOpacity, View, ActivityIndicator, Linking } from 'react-native';
import { TranslateText as Text } from '@/components/TranslateText';
import Svg, { Circle, G, Rect, Text as SvgText, TSpan } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "@/constants/translations";

import { MascotBuddy } from "@/components/MascotBuddy";
import { AnimPressable } from "@/components/AnimPressable";
import colors from "@/constants/colors";
import { useApp, getLevel } from "@/context/AppContext";
import { useSidebar } from "@/context/SidebarContext";
import { SuccessBurst } from "@/components/SuccessBurst";

const { width } = Dimensions.get("window");
const theme = colors.light;
const PURPLE = "#6C47FF";
const PURPLE_LIGHT = "#EDE9FE";

const edgePad = Math.min(width * 0.05, 20);
const isSmall = width < 360;

function CircularProgress({ pct, size = 96 }: { pct: number; size?: number }) {
  const stroke = 9;
  const r = (size - stroke * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  const animPct = useRef(new Animated.Value(0)).current;
  const [displayPct, setDisplayPct] = useState(0);

  useEffect(() => {
    Animated.timing(animPct, {
      toValue: pct,
      duration: 900,
      useNativeDriver: false,
    }).start();
    animPct.addListener(({ value }) => setDisplayPct(Math.round(value)));
    return () => animPct.removeAllListeners();
  }, [pct]);

  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} fill="none" />
      <Circle
        cx={cx} cy={cy} r={r}
        stroke="#ffffff"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${cx},${cy}`}
      />
      <SvgText
        x={cx} y={cy - 5}
        textAnchor="middle"
        fill="#ffffff"
        fontSize={isSmall ? "20" : "22"}
        fontFamily="Inter_700Bold"
      >
        {displayPct}
        <TSpan fontSize={isSmall ? "11" : "13"} dx="4" dy="-4">%</TSpan>
      </SvgText>
      <SvgText
        x={cx} y={cy + 13}
        textAnchor="middle"
        fill="rgba(255,255,255,0.75)"
        fontSize="9"
        fontFamily="Inter_500Medium"
      >
        adherence
      </SvgText>
    </Svg>
  );
}

function WeeklyBars({ history = [] }: { history: any[] }) {
  const today = new Date();
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const todayIdx = (today.getDay() + 6) % 7;
  const chartW = width - edgePad * 2 - 32; 
  const barW = Math.min(22, (chartW - 6 * 8) / 7); 
  const barH = isSmall ? 52 : 60;
  const gap = (chartW - days.length * barW) / (days.length - 1);

  const vals = new Array(7).fill(0);
  history.forEach(h => {
    if (h.date) {
      const d = new Date(h.date);
      const dayOfWeek = (d.getDay() + 6) % 7;
      vals[dayOfWeek] = h.percentage;
    }
  });

  return (
    <Svg width={chartW} height={barH + 22} viewBox={`0 0 ${chartW} ${barH + 22}`}>
      {days.map((d, i) => {
        const pct = vals[i] / 100;
        const h = Math.max(4, Math.round(pct * barH));
        const x = i * (barW + gap);
        const y = barH - h;
        const isToday = i === todayIdx;
        return (
          <G key={i}>
            <Rect x={x} y={0} width={barW} height={barH} rx={barW / 2} ry={barW / 2} fill="rgba(255,255,255,0.12)" />
            {pct > 0 && (
              <Rect x={x} y={y} width={barW} height={h} rx={barW / 2} ry={barW / 2}
                fill={isToday ? "#fff" : "rgba(255,255,255,0.6)"} />
            )}
            <SvgText
              x={x + barW / 2} y={barH + 17}
              textAnchor="middle"
              fill={isToday ? "#fff" : "rgba(255,255,255,0.55)"}
              fontSize={isSmall ? "9" : "10"}
              fontWeight={isToday ? "700" : "500"}
            >{d}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function StatChip({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <View style={[styles.statChip, { backgroundColor: `${color}22` }]}>
      <Text style={[styles.statChipNum, { color: "#fff" }]}>{count}</Text>
      <Text style={[styles.statChipLbl, { color: "rgba(255,255,255,0.7)" }]}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, color, onPress, delay = 0 }: { icon: any; label: string; color: string; onPress: () => void; delay?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 320, delay, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 8, delay } as any),
    ]).start();
  }, []);

  return (
    <TouchableOpacity
      style={styles.quickItem}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, friction: 8 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start()}
      activeOpacity={1}
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale }, { translateY: slideAnim }], alignItems: "center" }}>
        <View style={[styles.quickCircle, { backgroundColor: `${color}12`, borderColor: `${color}24` }]}>
          <Feather name={icon} size={isSmall ? 20 : 22} color={color} />
        </View>
        <Text style={styles.quickLabel} numberOfLines={1}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Skeleton shimmer block for startup loading ───────────────────────────────
function SkeletonBox({ w, h, radius = 10, mt = 0 }: { w: number | string; h: number; radius?: number; mt?: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  return (
    <Animated.View
      style={[
        { width: w as any, height: h, borderRadius: radius, backgroundColor: "rgba(255,255,255,0.45)", marginTop: mt },
        { opacity },
      ]}
    />
  );
}

function HomeSkeletonLoader({ topInset }: { topInset: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#F5F4FB" }}>
      {/* Purple header skeleton */}
      <LinearGradient
        colors={["#4B26C8", PURPLE, "#8B5CF6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerBg, { paddingTop: topInset + 14, paddingHorizontal: edgePad, paddingBottom: 28 }]}
      >
        {/* top bar */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <SkeletonBox w={42} h={42} radius={21} />
          <View style={{ flex: 1, marginHorizontal: 10, gap: 6 }}>
            <SkeletonBox w="50%" h={12} radius={6} />
            <SkeletonBox w="70%" h={18} radius={8} />
          </View>
          <SkeletonBox w={42} h={42} radius={21} />
        </View>
        {/* mascot placeholder */}
        <View style={{ alignItems: "center", marginVertical: 4 }}>
          <SkeletonBox w={84} h={84} radius={42} />
          <SkeletonBox w={120} h={14} radius={7} mt={8} />
        </View>
        {/* stats row */}
        <View style={{ flexDirection: "row", gap: 14, marginTop: 14 }}>
          <SkeletonBox w={96} h={96} radius={48} />
          <View style={{ flex: 1, gap: 8, justifyContent: "center" }}>
            <SkeletonBox w="40%" h={12} radius={6} />
            <SkeletonBox w="60%" h={30} radius={8} />
            <SkeletonBox w="50%" h={10} radius={5} />
          </View>
        </View>
        {/* weekly bars */}
        <View style={{ marginTop: 18, flexDirection: "row", gap: 8, justifyContent: "center" }}>
          {[40, 60, 50, 70, 80, 55, 45].map((h, i) => (
            <SkeletonBox key={i} w={22} h={h} radius={11} />
          ))}
        </View>
      </LinearGradient>
      {/* body cards */}
      <View style={{ padding: edgePad, gap: 14, marginTop: 20 }}>
        <SkeletonBox w="100%" h={58} radius={18} />
        <SkeletonBox w="100%" h={58} radius={18} />
        <SkeletonBox w="100%" h={58} radius={18} />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, role, activePatientId, familyMembers, setActivePatientId, isInitializing } = useApp();

  if (!user && !isInitializing) return <Redirect href="/login" />;
  if (isInitializing) {
    const topInset = Platform.OS === "web" ? 67 : insets.top;
    return <HomeSkeletonLoader topInset={topInset} />;
  }
  if (!user) return <Redirect href="/login" />;
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  if (role === "caregiver") {
    return <Redirect href="/caregiver/dashboard" />;
  }

  // Family member viewing a specific patient's dashboard
  if (role === "family") {
    if (!activePatientId) {
      // No member selected — go back to family dashboard
      return <Redirect href="/family/dashboard" />;
    }
    const activeMember = familyMembers.find(m => m.id === activePatientId);
    return (
      <View style={{ flex: 1 }}>
        {/* "Back to Family" top bar */}
        <View style={[styles.familyBar, { paddingTop: topInset + 8 }]}>
          <TouchableOpacity
            style={styles.familyBackBtn}
            onPress={() => {
              setActivePatientId(null);
              router.replace("/family/dashboard");
            }}
          >
            <Feather name="arrow-left" size={16} color="#6C47FF" />
            <Text style={styles.familyBackText}>Family Dashboard</Text>
          </TouchableOpacity>
          {activeMember && (
            <Text style={styles.familyViewingText} numberOfLines={1}>
              Viewing: {activeMember.name}
            </Text>
          )}
        </View>
        <PatientDashboard topInset={0} />
      </View>
    );
  }

  return <PatientDashboard topInset={topInset} />;
}

function PatientDashboard({ topInset }: { topInset: number }) {
  const { 
    user, todayDoses, medicines, followUps, updateDoseStatus, language, 
    doseHistory, recoverySuggestion, clearRecoverySuggestion, refreshData,
    streak, xp, speakNeural, isSpeaking, speakingTargetId, notifications
  } = useApp();

  // ── XP / Level pill ──────────────────────────────────────────────────────────
  const level = getLevel(xp);
  const xpInLevel = xp - level.min;
  const xpNeeded = level.max - level.min;
  const xpPct = Math.min(1, xpInLevel / xpNeeded);

  // Count unread notifications across all groups
  const unreadCount = (notifications || []).reduce(
    (sum, group) => sum + group.items.filter((n) => !n.read).length,
    0
  );
  const { open: openSidebar } = useSidebar();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const isGreetingSpeaking = isSpeaking && speakingTargetId === "patient_greeting";

  const handleDailyGreeting = async () => {
    if (isGreetingSpeaking) {
      await speakNeural("");
      return;
    }

    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const doseCount = todayDoses.length;
    const greeting = `Good morning ${user?.name || 'there'}! Today is ${todayStr}. You have ${doseCount} ${doseCount === 1 ? 'dose' : 'doses'} scheduled today. Your current streak is ${streak} days. Keep up the great work on your recovery!`;
    
    await speakNeural(greeting, "patient_greeting");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refreshData();
    setIsRefreshing(false);
  };

  const doses = todayDoses || [];
  const meds = medicines || [];
  const fus = followUps || [];

  const taken = doses.filter((d) => d.status === "taken").length;
  const total = doses.length;
  const missed = doses.filter((d) => d.status === "missed").length;
  const pending = doses.filter((d) => d.status === "pending").length;
  const adherencePct = total > 0 ? Math.round((taken / total) * 100) : 0;
  const upcomingFollowUp = fus.find((f) => !f.completed);
  const [showAll, setShowAll] = useState(false);
  const [mascotTrigger, setMascotTrigger] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const heroFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(heroFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const recentActivity = doses
    .filter(d => d.status !== "taken")
    .slice(0, showAll ? undefined : 4)
    .map((dose) => ({ dose, med: meds.find((m) => m.id === dose.medicineId) }));

  const riskColor = missed >= 2 ? "#EF4444" : missed === 1 ? "#F59E0B" : "#22C55E";
  const riskLabel = missed >= 2 ? "High Risk" : missed === 1 ? "Moderate" : "On Track";

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F4FB" }}>
      <StatusBar style="light" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
      >
        <LinearGradient
          colors={["#4B26C8", PURPLE, "#8B5CF6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerBg, { paddingTop: topInset + 14 }]}
        >
          <View style={styles.decor1} />
          <View style={styles.decor2} />
          <View style={styles.decor3} />

          <Animated.View style={[styles.headerTop, { opacity: heroFade }]}>
            <AnimPressable onPress={openSidebar} style={styles.iconBtn}>
              <Feather name="menu" size={21} color="#fff" />
            </AnimPressable>
            <View style={styles.headerInfo}>
              <Text style={styles.welcomeText}>{t('dashboard_hi', language)},</Text>
              <TouchableOpacity 
                onPress={handleDailyGreeting}
                style={styles.greetingRow}
                activeOpacity={0.7}
              >
                <Text style={styles.nameText} numberOfLines={1}>{user?.name} 👋</Text>
                <View style={[styles.voiceSmallBtn, isGreetingSpeaking && { backgroundColor: 'rgba(255,255,255,0.35)' }]}>
                  <Feather name={isGreetingSpeaking ? "volume-x" : "volume-2"} size={14} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AnimPressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/scan-qr' as any); }}
                style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.22)' }]}
              >
                <Feather name="maximize" size={18} color="#fff" />
              </AnimPressable>
              <AnimPressable onPress={() => router.push("/notifications")} style={styles.iconBtn}>
                <Feather name="bell" size={19} color="#fff" />
                {unreadCount > 0 && <View style={styles.notifDot} />}
              </AnimPressable>
            </View>
          </Animated.View>

          <MascotBuddy size={isSmall ? 76 : 84} trigger={mascotTrigger} />

          {/* ── XP / Level pill + Streak badge ──────────────────────── */}
          <View style={styles.xpPill}>
            <Text style={styles.xpLevelBadge}>Lv {level.level}</Text>
            <View style={styles.xpBarBg}>
              <Animated.View style={[styles.xpBarFill, { width: `${xpPct * 100}%` }]} />
            </View>
            <Text style={styles.xpText}>{xpInLevel}/{xpNeeded} XP</Text>
          </View>
          {streak > 0 && (
            <View style={styles.streakBadgePill}>
              <Text style={styles.streakFireText}>🔥</Text>
              <Text style={styles.streakBadgePillText}>{streak} Day Streak</Text>
            </View>
          )}

          <View style={styles.statsBlock}>
            <View style={styles.statsRow1}>
              <View style={styles.ringWrap}>
                <CircularProgress pct={adherencePct} size={isSmall ? 88 : 96} />
              </View>
              <View style={styles.dosesBlock}>
                <View style={[styles.riskBadge, { backgroundColor: `${riskColor}25` }]}>
                  <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
                  <Text style={styles.riskText}>{riskLabel}</Text>
                </View>
                <Text style={styles.dosesMain} numberOfLines={1} adjustsFontSizeToFit>
                  {taken}/{total}
                </Text>
                <Text style={styles.dosesLabel}>{t("takenToday", language)}</Text>
              </View>
            </View>

            <View style={styles.statsRow2}>
              <StatChip count={missed} label="missed" color="#EF4444" />
              <View style={styles.statsDivider} />
              <StatChip count={pending} label="pending" color="#F59E0B" />
              <View style={styles.statsDivider} />
              <StatChip count={taken} label="taken" color="#22C55E" />
            </View>
          </View>

          <View style={styles.weeklyWrap}>
            <View style={styles.weeklyHeader}>
              <Feather name="bar-chart-2" size={13} color="rgba(255,255,255,0.65)" />
              <Text style={styles.weeklyLabel}>This Week</Text>
            </View>
            <WeeklyBars history={doseHistory} />
          </View>
        </LinearGradient>

        {recoverySuggestion && (
          <RecoverySupportBanner 
            suggestion={recoverySuggestion} 
            onDismiss={clearRecoverySuggestion}
            onStart={() => {
              clearRecoverySuggestion();
              router.push("/recovery-support" as any);
            }}
          />
        )}

        <View style={styles.quickSection}>
          <Text style={styles.sectionTitle}>{t("reminders", language)}</Text>
          <View style={styles.quickRow}>
            <QuickAction icon="calendar" label="Schedule" color="#8B5CF6" delay={0}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/schedule" as any); }} />
            <QuickAction icon="activity" label="Symptoms" color="#EF4444" delay={40}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/symptoms" as any); }} />
            <QuickAction icon="wind" label="Meditation" color="#A21CAF" delay={80}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/meditation" as any); }} />
          </View>
          <View style={[styles.quickRow, { marginTop: 18 }]}>
            <QuickAction icon="message-circle" label="AI Help" color="#06B6D4" delay={120}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/chat" as any); }} />
            <QuickAction icon="book" label="Journal" color="#10B981" delay={160}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/journal" as any); }} />
            <QuickAction icon="alert-triangle" label="Emergency" color="#F59E0B" delay={200}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); Linking.openURL("tel:112"); }} />
          </View>
          <View style={[styles.quickRow, { marginTop: 18 }]}>
            <QuickAction icon="droplet" label="Blood Network" color="#E11D48" delay={240}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/blood-network" as any); }} />
            <QuickAction icon="shield" label="Drug Check" color="#6C47FF" delay={280}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/drug-checker" as any); }} />
            <QuickAction icon="phone-call" label="Emergency" color="#EF4444" delay={320}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/emergency" as any); }} />
          </View>
        </View>

        {upcomingFollowUp && (
          <AnimPressable
            onPress={() => router.push("/followups" as any)}
            style={styles.followupCard}
          >
            <LinearGradient colors={["#EDE9FE", "#F5F3FF"]} style={styles.followupGrad}>
              <View style={styles.followupLeft}>
                <View style={styles.followupIconWrap}>
                  <Feather name="calendar" size={18} color={PURPLE} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.followupTitle}>Upcoming Appointment</Text>
                  <Text style={styles.followupName} numberOfLines={1}>{upcomingFollowUp.title}</Text>
                  <Text style={styles.followupDate} numberOfLines={1}>
                    {new Date(upcomingFollowUp.dateTime).toLocaleDateString("en", {
                      weekday: "short", month: "short", day: "numeric",
                    })} · {upcomingFollowUp.doctorName}
                  </Text>
                </View>
              </View>
              <View style={styles.followupArrow}>
                <Feather name="chevron-right" size={16} color={PURPLE} />
              </View>
            </LinearGradient>
          </AnimPressable>
        )}

        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.sectionTitle}>Recent Doses</Text>
              <TouchableOpacity onPress={handleRefresh} disabled={isRefreshing}>
                <Feather name="refresh-cw" size={14} color={PURPLE} style={{ opacity: isRefreshing ? 0.5 : 1 }} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setShowAll(!showAll)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.seeAll}>{showAll ? "Show less" : "See all"}</Text>
            </TouchableOpacity>
          </View>

          {recentActivity.length === 0 ? (
            <View style={styles.emptyDoses}>
              <Text style={styles.emptyEmoji}>🌟</Text>
              <Text style={styles.emptyText}>All doses are clear today!</Text>
            </View>
          ) : (
            recentActivity.map(({ dose, med }, idx) => {
              if (!med) return null;
              const statusColor = dose.status === "taken" ? "#22C55E" : dose.status === "missed" ? "#EF4444" : PURPLE;
              const statusIcon = dose.status === "taken" ? "check-circle" : dose.status === "missed" ? "x-circle" : "clock";
              return (
                <DoseRow
                  key={dose.id}
                  dose={dose}
                  med={med}
                  statusColor={statusColor}
                  statusIcon={statusIcon}
                  delay={idx * 60}
                  onPress={() => {
                    if (dose.status === "pending") {
                      updateDoseStatus(dose.id, "taken");
                      setMascotTrigger(prev => prev + 1);
                      setShowSuccess(true);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                  }}
                />
              );
            })
          )}
        </View>
      </ScrollView>
      <SuccessBurst 
        visible={showSuccess} 
        onComplete={() => setShowSuccess(false)} 
      />
    </View>
  );
}

function DoseRow({ dose, med, statusColor, statusIcon, delay, onPress }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 9, delay } as any),
    ]).start();
  }, []);

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start()}
      activeOpacity={1}
      disabled={dose.status !== "pending"}
    >
      <Animated.View
        style={[
          styles.doseRow,
          { opacity: fadeAnim, transform: [{ scale }, { translateY: slideAnim }] },
        ]}
      >
        <View style={[styles.doseIcon, { backgroundColor: `${med.color}15` }]}>
          <Feather name="package" size={18} color={med.color} />
        </View>
        <View style={styles.doseInfo}>
          <Text style={styles.doseName} numberOfLines={1}>{dose.medicineName}</Text>
          <Text style={styles.doseSub} numberOfLines={1}>{med.dosage} · {dose.scheduledTime}</Text>
        </View>
        <View style={[styles.doseStatus, { backgroundColor: `${statusColor}12` }]}>
          <Feather name={statusIcon as any} size={17} color={statusColor} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function CaregiverDashboard({ topInset }: { topInset: number }) {
  const { user, linkedPatients, isSpeaking, speakingTargetId, speakNeural } = useApp();
  const { open: openSidebar } = useSidebar();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const patient = (linkedPatients || [])[0];

  // ── Computed caregiver header stats ─────────────────────────────────────────
  const allPatients = linkedPatients || [];

  // Average adherence: for each patient compute taken/total from their doseLogs,
  // fall back to riskScore-derived estimate if doseLogs are absent.
  const avgAdherence = (() => {
    if (allPatients.length === 0) return null;
    const pcts = allPatients.map((p) => {
      const logs = p.doseLogs ?? [];
      if (logs.length === 0) {
        // Derive a rough adherence from riskScore (higher risk → lower adherence)
        return p.riskScore != null ? Math.max(0, 100 - p.riskScore) : null;
      }
      const taken = logs.filter((d) => d.status === "taken").length;
      return Math.round((taken / logs.length) * 100);
    }).filter((v): v is number => v !== null);
    if (pcts.length === 0) return null;
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  })();

  // Alert count: patients flagged as High risk
  const alertCount = allPatients.filter(
    (p) => p.riskLevel === "High"
  ).length;

  // Overall status label
  const overallStatus = (() => {
    if (allPatients.length === 0) return "No patients";
    if (alertCount > 0) return "Needs Attn.";
    const modCount = allPatients.filter((p) => p.riskLevel === "Moderate").length;
    if (modCount > 0) return "Moderate";
    return "Stable";
  })();

  const statusColor = alertCount > 0 ? "#EF4444" : overallStatus === "Moderate" ? "#F59E0B" : "#22C55E";

  const heroFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(heroFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const isBriefingSpeaking = isSpeaking && speakingTargetId === "caregiver_briefing";

  const handleGlobalBriefing = async () => {
    if (isBriefingSpeaking) {
      await speakNeural("");
      return;
    }

    const highRiskCount = (linkedPatients || []).filter(p => p.riskLevel === 'High').length;
    const modRiskCount = (linkedPatients || []).filter(p => p.riskLevel === 'Moderate').length;
    const totalPatients = (linkedPatients || []).length;

    let briefing = `Hello ${user?.name || 'Caregiver'}. You have ${totalPatients} patients under your care. `;
    if (highRiskCount > 0) {
      briefing += `${highRiskCount} patients are at high risk and require immediate attention. `;
    }
    if (modRiskCount > 0) {
      briefing += `${modRiskCount} patients are at moderate risk with some missed doses or deteriorating symptoms. `;
    }
    if (highRiskCount === 0 && modRiskCount === 0) {
      briefing += `All patients are currently stable and on track with their recovery plans. `;
    }
    briefing += `You can tap on any patient for a detailed clinical handover.`;

    await speakNeural(briefing, "caregiver_briefing");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F4FB" }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 110 }}>
        <LinearGradient
          colors={["#4B26C8", PURPLE, "#8B5CF6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerBg, { paddingTop: topInset + 14 }]}
        >
          <View style={styles.decor1} />
          <View style={styles.decor2} />
          <Animated.View style={[styles.headerTop, { opacity: heroFade }]}>
            <AnimPressable onPress={openSidebar} style={styles.iconBtn}>
              <Feather name="menu" size={21} color="#fff" />
            </AnimPressable>
            <View style={styles.greetBlock}>
              <Text style={styles.greetText}>Caregiver Mode</Text>
              <TouchableOpacity 
                onPress={handleGlobalBriefing}
                style={styles.greetingRow}
                activeOpacity={0.7}
              >
                <Text style={styles.nameText} numberOfLines={1}>{(user?.name ?? "Caregiver").split(" ")[0]} 💜</Text>
                <View style={[styles.voiceSmallBtn, isBriefingSpeaking && { backgroundColor: 'rgba(255,255,255,0.35)' }]}>
                  <Feather name={isBriefingSpeaking ? "volume-x" : "volume-2"} size={14} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>
            <AnimPressable onPress={() => {}} style={styles.iconBtn}>
              <Feather name="settings" size={19} color="#fff" />
            </AnimPressable>
          </Animated.View>
          <MascotBuddy size={isSmall ? 76 : 84} message="Hi! Let's keep our patient safe today! 💜" />
          <View style={styles.careStats}>
            <View style={styles.careStat}>
              <Text style={styles.careStatVal}>
                {avgAdherence !== null ? `${avgAdherence}%` : "—"}
              </Text>
              <Text style={styles.careStatLbl}>Adherence</Text>
            </View>
            <View style={styles.careStatDivider} />
            <View style={styles.careStat}>
              <Text style={[styles.careStatVal, alertCount > 0 && { color: "#EF4444" }]}>
                {alertCount}
              </Text>
              <Text style={styles.careStatLbl}>Alerts</Text>
            </View>
            <View style={styles.careStatDivider} />
            <View style={styles.careStat}>
              <Text style={[styles.careStatVal, { color: statusColor }]}>
                {overallStatus}
              </Text>
              <Text style={styles.careStatLbl}>Status</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.quickSection}>
          <Text style={styles.sectionTitle}>Caregiver Actions</Text>
          <View style={styles.quickRow}>
            <QuickAction icon="eye" label="Monitor" color={PURPLE} delay={0} onPress={() => router.push("/caregiver/monitor" as any)} />
            <QuickAction icon="plus-circle" label="Issue Plan" color={PURPLE} delay={30} onPress={() => router.push("/caregiver/create-plan" as any)} />
            <QuickAction icon="bell" label="Remind" color="#F59E0B" delay={60} onPress={() => router.push("/caregiver/remind" as any)} />
            <QuickAction icon="message-circle" label="Message" color="#06B6D4" delay={120} onPress={() => router.push("/caregiver/message" as any)} />
            <QuickAction icon="alert-triangle" label="Alert" color="#EF4444" delay={180} onPress={() => router.push("/caregiver/alert" as any)} />
          </View>
        </View>

        {patient && (
          <CaregiverPatientCard patient={patient} />
        )}
      </ScrollView>
    </View>
  );
}

function CaregiverPatientCard({ patient }: { patient: any }) {
  const { fetchBriefing, isSpeaking, speakingTargetId, speakNeural } = useApp();
  const [isLoading, setIsLoading] = useState(false);

  const isMeSpeaking = isSpeaking && speakingTargetId === patient.id;

  const handleBriefing = async () => {
    if (isMeSpeaking) {
      await speakNeural(""); // Stop
      return;
    }

    setIsLoading(true);
    try {
      const summary = await fetchBriefing(patient.id);
      await speakNeural(summary, patient.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const score = patient.riskScore || 0;
  const level = patient.riskLevel || "Low";
  const riskColor = level === "High" ? "#EF4444" : level === "Moderate" ? "#F59E0B" : "#22C55E";

  return (
    <View style={styles.cpCard}>
      <View style={styles.patientMain}>
        <View style={styles.cpAvatar}>
          <Feather name="user" size={22} color={PURPLE} />
        </View>
        <View style={styles.cpInfo}>
          <Text style={styles.cpName} numberOfLines={1}>{patient.name}</Text>
          <Text style={styles.cpStatus} numberOfLines={1}>
            {patient.condition} · {patient.age} yrs
          </Text>
        </View>
        <TouchableOpacity 
          onPress={handleBriefing}
          style={styles.neuralContainer}
        >
          {isMeSpeaking ? (
            <View style={styles.volumeCircle}>
               <Feather name="volume-x" size={18} color={PURPLE} />
            </View>
          ) : isLoading ? (
            <ActivityIndicator size="small" color={PURPLE} />
          ) : (
            <View style={styles.volumeCircle}>
              <Feather name="volume-2" size={18} color={PURPLE} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.riskEngine}>
        <View style={styles.riskHeader}>
          <Feather name="shield" size={14} color="#64748B" />
          <Text style={styles.riskTitle}>AI RISK SCORE</Text>
          <View style={[styles.riskLevelBadge, { backgroundColor: `${riskColor}15` }]}>
            <Text style={[styles.riskLevelText, { color: riskColor }]}>{level}</Text>
          </View>
        </View>
        
        <View style={styles.riskGaugeBg}>
          <Animated.View 
            style={[
              styles.riskGaugeFill, 
              { width: `${score}%`, backgroundColor: riskColor }
            ]} 
          />
        </View>
        
        <View style={styles.riskFooter}>
          <Text style={styles.riskScoreText}>{score}/100</Text>
          <Text style={styles.riskMessage}>
            {level === "High" ? "Immediate attention required" : "Patient condition is stable"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function RecoverySupportBanner({ suggestion, onDismiss, onStart }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 } as any),
    ]).start();
  }, []);

  const bgColor = suggestion.type === 'sleep' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.92)';
  const accentColor = suggestion.type === 'sleep' ? '#1E1B4B' : PURPLE;
  const icon = suggestion.type === 'sleep' ? 'moon' : suggestion.type === 'calm' ? 'wind' : 'refresh-cw';

  return (
    <Animated.View style={[
      styles.supportBanner, 
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }], backgroundColor: bgColor }
    ]}>
      <View style={styles.supportContent}>
        <View style={[styles.supportIcon, { backgroundColor: `${accentColor}15` }]}>
          <Feather name={icon} size={20} color={accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.supportTitle, { color: '#1E1B4B' }]}>{suggestion.title}</Text>
          <Text style={[styles.supportBody, { color: '#64748B' }]}>{suggestion.body}</Text>
        </View>
        <TouchableOpacity onPress={onStart} style={[styles.supportBtn, { backgroundColor: accentColor }]}>
          <Text style={[styles.supportBtnText, { color: '#fff' }]}>Start</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} style={styles.supportClose}>
          <Feather name="x" size={16} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerBg: { paddingBottom: 24, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: "hidden" },
  decor1: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.05)", top: -60, right: -50 },
  decor2: { position: "absolute", width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(255,255,255,0.04)", bottom: -20, left: -20 },
  decor3: { position: "absolute", width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.06)", top: 80, left: 30 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: edgePad, marginBottom: 4 },
  chatHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  assistantHero: {
    marginTop: 15,
    marginHorizontal: edgePad,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    marginBottom: 20,
  },
  assistantContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assistantText: { flex: 1 },
  assistantTitle: { fontSize: 18, color: '#fff', fontFamily: 'Inter_700Bold' },
  assistantSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: 'Inter_400Regular' },
  assistantOrbWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  headerInfo: { flex: 1, paddingHorizontal: 8 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  voiceSmallBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  welcomeText: { fontSize: 16, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_500Medium" },
  greetBlock: { alignItems: "center", flex: 1, paddingHorizontal: 8 },
  greetText: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_400Regular" },
  nameText: { color: "#fff", fontSize: isSmall ? 17 : 19, fontFamily: "Inter_700Bold" },
  notifDot: { position: "absolute", top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FCD34D", borderWidth: 1.5, borderColor: PURPLE },
  statsBlock: { marginHorizontal: edgePad, marginTop: 8, gap: 12 },
  statsRow1: { flexDirection: "row", alignItems: "center", gap: 16 },
  ringWrap: { alignItems: "center", justifyContent: "center" },
  dosesBlock: { flex: 1, gap: 4, minWidth: 0 },
  riskBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  riskDot: { width: 6, height: 6, borderRadius: 3 },
  riskText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  dosesMain: { color: "#fff", fontSize: isSmall ? 26 : 32, fontFamily: "Inter_700Bold", lineHeight: isSmall ? 32 : 38, includeFontPadding: false },
  dosesLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular" },
  statsRow2: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 18, padding: 12, justifyContent: "space-around" },
  statChip: { flex: 1, alignItems: "center", gap: 2 },
  statChipNum: { fontSize: isSmall ? 16 : 18, fontFamily: "Inter_700Bold" },
  statChipLbl: { fontSize: 10, fontFamily: "Inter_400Regular" },
  statsDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.2)" },
  weeklyWrap: { backgroundColor: "rgba(255,255,255,0.09)", borderRadius: 22, padding: 14, marginHorizontal: edgePad, marginTop: 16 },
  weeklyHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  weeklyLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_500Medium" },
  quickSection: { paddingHorizontal: edgePad, paddingTop: 26, paddingBottom: 4 },
  quickRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  quickItem: { alignItems: "center", flex: 1, paddingHorizontal: 2 },
  quickCircle: { width: isSmall ? 52 : 58, height: isSmall ? 52 : 58, borderRadius: isSmall ? 26 : 29, alignItems: "center", justifyContent: "center", borderWidth: 1.5, marginBottom: 7, shadowColor: "#6C47FF", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  quickLabel: { fontSize: isSmall ? 10 : 11, fontFamily: "Inter_600SemiBold", color: "#4B5563", textAlign: "center" },
  followupCard: { marginHorizontal: edgePad, marginTop: 18, borderRadius: 22, overflow: "hidden" },
  followupGrad: { padding: 16, flexDirection: "row", alignItems: "center" },
  followupLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  followupIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: PURPLE, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2, flexShrink: 0 },
  followupTitle: { fontSize: 10, fontFamily: "Inter_500Medium", color: PURPLE, marginBottom: 1 },
  followupName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  followupDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 1 },
  followupArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  recentSection: { paddingHorizontal: edgePad, paddingTop: 22 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: isSmall ? 16 : 17, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: PURPLE },
  doseRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 18, padding: 13, marginBottom: 9, shadowColor: PURPLE, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  doseIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  doseInfo: { flex: 1, minWidth: 0 },
  doseName: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  doseSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 1 },
  doseStatus: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  emptyDoses: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyEmoji: { fontSize: 34 },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#6B7280" },
  careStats: { flexDirection: "row", marginHorizontal: edgePad, marginTop: 16, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, padding: 16, alignItems: "center", justifyContent: "space-between" },
  careStat: { flex: 1, alignItems: "center" },
  careStatVal: { color: "#fff", fontSize: isSmall ? 18 : 20, fontFamily: "Inter_700Bold" },
  careStatLbl: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  careStatDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)" },
  patientCard: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: edgePad, marginTop: 14, backgroundColor: "#fff", borderRadius: 20, padding: 14, shadowColor: PURPLE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  patientAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: PURPLE_LIGHT, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  patientInfo: { flex: 1, minWidth: 0 },
  patientName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  patientStatus: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  patientBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, flexShrink: 0 },
  patientBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  scrollContent: { paddingHorizontal: 0 },

  // XP level pill
  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  xpLevelBadge: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  xpBarBg: {
    width: isSmall ? 70 : 88,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#FCD34D",
  },
  xpText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  streakBadge: {
    backgroundColor: "rgba(252,211,77,0.22)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.4)",
  },
  streakText: {
    color: "#FCD34D",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  // Prominent streak pill shown below the XP bar
  streakBadgePill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(252,211,77,0.2)",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.5)",
  },
  streakFireText: { fontSize: 18 },
  streakBadgePillText: {
    color: "#FCD34D",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },

  // Family viewing bar
  familyBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
    backgroundColor: '#EDE9FE', borderBottomWidth: 1, borderBottomColor: '#DDD6FE',
  },
  familyBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  familyBackText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#6C47FF' },
  familyViewingText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#7C3AED', flex: 1, textAlign: 'right' },

  // Recovery Support Styles
  supportBanner: { marginHorizontal: 16, marginTop: -20, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, zIndex: 100 },
  supportContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  supportIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  supportTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  supportBody: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)' },
  supportBtn: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  supportBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#1E1B4B' },
  supportClose: { padding: 4 },
  // Caregiver Patient Card Styles
  cpCard: {
    marginHorizontal: edgePad,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  patientMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  cpAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  cpInfo: { flex: 1 },
  cpName: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  cpStatus: { fontSize: 13, color: "#64748B", marginTop: 2 },
  neuralContainer: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PURPLE_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  briefingBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  riskEngine: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  riskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  riskTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#64748B",
    letterSpacing: 1,
    flex: 1,
  },
  riskLevelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  riskLevelText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  riskGaugeBg: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  riskGaugeFill: { height: "100%", borderRadius: 3 },
  riskFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  riskScoreText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  riskMessage: { fontSize: 11, color: "#64748B" },
});
