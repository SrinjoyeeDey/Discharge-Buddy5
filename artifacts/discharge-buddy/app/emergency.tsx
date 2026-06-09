import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { TranslateText as Text } from '@/components/TranslateText';
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmergencyButton } from "@/components/EmergencyButton";
import { AnimPressable } from "@/components/AnimPressable";
import { useApp } from "@/context/AppContext";

const PURPLE = "#6C47FF";
const WHITE = "#ffffff";
const BACKGROUND = "#F5F4FB";
const CARD_BG = "#ffffff";
const FOREGROUND = "#1E1B4B";
const MUTED = "#6B7280";
const BORDER = "#E8E4FF";
const DESTRUCTIVE = "#EF4444";
const WARNING = "#F59E0B";
const SUCCESS = "#10B981";

export default function EmergencyScreen() {
  const insets = useSafeAreaInsets();
  const { patient } = useApp();

  const topInset = Platform.OS === "web" ? 0 : insets.top;

  const DANGER_SIGNS = [
    { sign: "Chest pain or pressure", urgent: true },
    { sign: "Difficulty breathing", urgent: true },
    { sign: "Sudden confusion or disorientation", urgent: true },
    { sign: "Slurred speech or facial drooping", urgent: true },
    { sign: "Severe dizziness or loss of balance", urgent: true },
    { sign: "Rapid or irregular heartbeat", urgent: false },
    { sign: "Severe vomiting or inability to keep medicines down", urgent: false },
    { sign: "Sudden severe swelling", urgent: false },
    { sign: "High fever (above 38.5°C / 101.3°F)", urgent: false },
    { sign: "Unusual bleeding", urgent: false },
  ];

  return (
    <View style={[styles.container, { backgroundColor: BACKGROUND }]}>
      <LinearGradient
        colors={["#4B26C8", PURPLE, "#8B5CF6"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.headerBg, { paddingTop: topInset + 20 }]}
      >
        <View style={styles.decor1} />
        <View style={styles.decor2} />
        <View style={styles.decor3} />
        <View style={styles.headerTop}>
          <AnimPressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={WHITE} />
          </AnimPressable>
          <Text style={styles.headerTitle}>Emergency</Text>
          <View style={{ width: 38 }} />
        </View>
        <Text style={styles.headerSub}>Immediate help and contacts</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.emergencyCard, { backgroundColor: `${DESTRUCTIVE}10`, borderColor: `${DESTRUCTIVE}40` }]}>
          <Text style={[styles.cardTitle, { color: DESTRUCTIVE }]}>Emergency Alert</Text>
          <Text style={[styles.cardSubtitle, { color: MUTED }]}>
            Press and hold to notify your caregiver and share your location
          </Text>
          <View style={styles.btnWrapper}>
            <EmergencyButton />
          </View>
        </View>

        <AnimPressable
          onPress={() => router.push("/blood-network" as any)}
          style={[styles.bloodCard, { backgroundColor: "#E11D4810", borderColor: "#E11D4840" }]}
        >
          <View style={[styles.contactIcon, { backgroundColor: "#E11D4815" }]}>
            <Feather name="droplet" size={18} color="#E11D48" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: "#E11D48", fontSize: 16 }]}>Find Blood Donors</Text>
            <Text style={[styles.cardSubtitle, { color: MUTED, fontSize: 13, textAlign: "left" }]}>
              Reach nearby donors or post an urgent blood request
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color="#E11D48" />
        </AnimPressable>

        <View style={[styles.contactCard, { backgroundColor: CARD_BG, borderColor: BORDER }]}>
          <Text style={[styles.contactTitle, { color: FOREGROUND }]}>Emergency Contacts</Text>
          {[
            { label: "Emergency Contact", number: patient?.emergencyContact ?? "Not set", icon: "user" as const },
            { label: "Emergency Services", number: "112 / 911", icon: "phone-call" as const },
            { label: "Hospital Helpline", number: "1800-XXX-XXXX", icon: "home" as const },
          ].map((c, i) => (
            <View key={i} style={[styles.contactRow, { borderBottomColor: BORDER }]}>
              <View style={[styles.contactIcon, { backgroundColor: `${PURPLE}15` }]}>
                <Feather name={c.icon} size={16} color={PURPLE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactLabel, { color: MUTED }]}>{c.label}</Text>
                <Text style={[styles.contactNumber, { color: FOREGROUND }]}>{c.number}</Text>
              </View>
              <AnimPressable style={[styles.callBtn, { backgroundColor: `${SUCCESS}15` }]} onPress={() => {}}>
                <Feather name="phone" size={16} color={SUCCESS} />
              </AnimPressable>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: FOREGROUND }]}>Danger Signs — Seek Help Immediately</Text>

        {DANGER_SIGNS.map((item, i) => (
          <View
            key={i}
            style={[
              styles.dangerRow,
              {
                backgroundColor: item.urgent ? `${DESTRUCTIVE}08` : CARD_BG,
                borderColor: item.urgent ? `${DESTRUCTIVE}30` : BORDER,
              },
            ]}
          >
            <Feather
              name={item.urgent ? "alert-triangle" : "alert-circle"}
              size={18}
              color={item.urgent ? DESTRUCTIVE : WARNING}
            />
            <Text
              style={[
                styles.dangerText,
                { color: item.urgent ? DESTRUCTIVE : FOREGROUND },
              ]}
            >
              {item.sign}
            </Text>
            {item.urgent && (
              <View style={[styles.urgentBadge, { backgroundColor: `${DESTRUCTIVE}20` }]}>
                <Text style={[{ color: DESTRUCTIVE, fontSize: 11, fontFamily: "Inter_700Bold" }]}>URGENT</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBg: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 4,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
  },
  decor1: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)", top: -60, right: -50,
  },
  decor2: {
    position: "absolute", width: 110, height: 110, borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.04)", bottom: -20, left: -20,
  },
  decor3: {
    position: "absolute", width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.06)", top: 80, left: 30,
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: WHITE },
  headerSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  emergencyCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  cardSubtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  btnWrapper: { marginTop: 10 },
  bloodCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  contactCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 24,
    gap: 6,
  },
  contactTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 12 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  contactIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  contactLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  contactNumber: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  callBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 14 },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  dangerText: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  urgentBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});
