import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Platform, ScrollView, StyleSheet, TouchableOpacity, View, Image, Alert, ActivityIndicator,
} from 'react-native';
import { TranslateText as Text } from '@/components/TranslateText';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import { useApp } from "@/context/AppContext";
import { MyLinkCodeCard } from "@/components/MyLinkCodeCard";

const TEAL = "#0891b2";
const TEAL_DARK = "#0c4a6e";
const WHITE = "#ffffff";
const ACCENT = "#00B894";
const PURPLE = "#6C47FF";

// OCR Service runs on port 8100 on the same machine as the API server.
// On Android, localhost doesn't resolve — use the same LAN IP as the API server.
const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const OCR_SERVICE_URL = API_BASE.replace(/:3000\/?$/, ':8100').replace(/\/$/, '');

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { user, role, streak, todayDoses, medicines, authMethod } = useApp();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey(prev => prev + 1);
    }, [])
  );

  const adherence = todayDoses.length > 0
    ? Math.round((todayDoses.filter(d => d.status === "taken").length / todayDoses.length) * 100)
    : 0;

  const handleShareReport = async () => {
    try {
      setIsGenerating(true);

      // 1. Prepare data
      const reportData = {
        name: user?.name || "Patient",
        period: "Last 7 Days",
        adherence: adherence,
        taken: todayDoses.filter(d => d.status === 'taken').length,
        missed: todayDoses.filter(d => d.status === 'missed').length,
        total: todayDoses.length,
        medications: medicines.map(m => ({
          name: m.name,
          dosage: m.dosage,
          status: todayDoses.find(d => d.medicineId === m.id)?.status === 'taken' ? 'Completed Today' : 'Pending'
        })),
        insights: [
          adherence > 80 ? "Consistency is excellent this week." : "Try to be more consistent with evening doses.",
          streak > 3 ? `Great job maintaining a ${streak}-day streak!` : "Starting a new streak today!"
        ],
        summary: adherence > 85
          ? "You've maintained exceptional consistency this week. Your recovery is on a very positive trajectory."
          : "Good progress! There is some slight room for improvement in dose timing consistency.",
        recommendations: [
          "Set evening reminders to avoid missed doses.",
          "Keep your medications in a visible, convenient spot.",
          "Continue monitoring your daily symptoms."
        ]
      };

      const fileName = `Recovery_Report_${user?.name?.replace(/\s/g, '_') || 'User'}.pdf`;

      // 2. Handle Web Download (Memory-based)
      if (Platform.OS === 'web') {
        const response = await fetch(`${OCR_SERVICE_URL}/generate-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportData),
        });
        if (!response.ok) throw new Error("Failed to generate report on server");
        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
        return;
      }

      // 3. Handle Mobile Share/Download (fetch + writeAsString)
      const response = await fetch(`${OCR_SERVICE_URL}/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });
      if (!response.ok) throw new Error("Failed to generate report on server");

      const blob = await response.blob();
      const fileUri = `${(FileSystem as any).documentDirectory}${fileName}`;

      // Convert blob to base64 for saving
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });

      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: 'base64',
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share your Recovery Report',
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (error) {
      console.error("Report Generation Error:", error);
      Alert.alert("Error", "Could not generate report. Please ensure the server is running.");
    } finally {
      setIsGenerating(false);
    }
  };

  const STATS = [
    { label: "Day Streak", value: streak.toString() },
    { label: "Doses Today", value: `${todayDoses.filter(d => d.status === "taken").length}/${todayDoses.length}` },
    { label: "Adherence", value: `${adherence}%` },
  ];

  const FIELDS = [
    { label: "USERNAME", value: user?.name ? `@${user.name.toLowerCase().replace(/\s/g, "")}` : "" },
    { label: "FULL NAME", value: user?.name ?? "" },
    { label: "EMAIL ADDRESS", value: user?.email ?? "" },
    { label: "PHONE", value: user?.phone ?? "" },
    { label: "ROLE", value: role === "caregiver" ? "Caregiver" : "Patient" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      {isGenerating && (
        <View style={styles.overlay}>
          <View style={styles.loaderCard}>
            <ActivityIndicator size="large" color={TEAL} />
            <Text style={styles.loaderText}>Generating Medical Report...</Text>
          </View>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 32 }}
      >
        <View style={[styles.header, { paddingTop: topInset + 12 }]}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={20} color={WHITE} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{user?.name ?? "Profile"}</Text>
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={styles.backBtn}
          >
            <Feather name="settings" size={20} color={WHITE} />
          </TouchableOpacity>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.decCircle1} />
          <View style={styles.decCircle2} />
          <View style={styles.decCircle3} />

          <View style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
              ) : (
                <Feather name={role === "caregiver" ? "users" : "user"} size={44} color={TEAL} />
              )}
            </View>
            <TouchableOpacity style={styles.editBadge} onPress={() => router.push("/profile/edit")}>
              <Feather name="edit-2" size={12} color={WHITE} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.waveBottom} />

        <View style={styles.statsBar}>
          {STATS.map((s, i) => (
            <View key={i} style={[styles.statItem, i < STATS.length - 1 && styles.statBorder]}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.infoCard}>
          {FIELDS.map((f, i) => (
            <View key={i} style={[styles.fieldRow, i < FIELDS.length - 1 && styles.fieldBorder]}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <Text style={[styles.fieldValue, !f.value && styles.fieldValueEmpty]}>
                {f.value || "Not added yet"}
              </Text>
            </View>
          ))}
        </View>

        {role === "patient" && (
          <>
            <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
              <MyLinkCodeCard />
            </View>

            <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
              <TouchableOpacity
                style={styles.medicalCardBtn}
                onPress={() => router.push("/medical-card")}
              >
                <View style={styles.medicalCardIcon}>
                  <Feather name="heart" size={20} color={WHITE} />
                </View>
                <View style={styles.medicalCardContent}>
                  <Text style={styles.medicalCardTitle}>Medical Emergency Card</Text>
                  <Text style={styles.medicalCardDesc}>QR code for emergency responders</Text>
                </View>
                <Feather name="chevron-right" size={18} color={WHITE} />
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push("/profile/edit")}
          >
            <View style={[styles.actionIcon, { backgroundColor: `${TEAL}15` }]}>
              <Feather name="edit" size={18} color={TEAL} />
            </View>
            <Text style={styles.actionLabel}>Edit Profile</Text>
            <Feather name="chevron-right" size={18} color="#94a3b8" />
          </TouchableOpacity>

          {authMethod !== "google" && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push("/profile/change-password")}
            >
              <View style={[styles.actionIcon, { backgroundColor: `#8b5cf615` }]}>
                <Feather name="lock" size={18} color="#8b5cf6" />
              </View>
              <Text style={styles.actionLabel}>Change Password</Text>
              <Feather name="chevron-right" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleShareReport}
          >
            <View style={[styles.actionIcon, { backgroundColor: `${ACCENT}15` }]}>
              <Feather name="share-2" size={18} color={ACCENT} />
            </View>
            <Text style={styles.actionLabel}>Share Recovery Report</Text>
            <Feather name="chevron-right" size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push("/help")}
          >
            <View style={[styles.actionIcon, { backgroundColor: `${PURPLE}15` }]}>
              <Feather name="help-circle" size={18} color={PURPLE} />
            </View>
            <Text style={styles.actionLabel}>Help & Feedback</Text>
            <Feather name="chevron-right" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: TEAL_DARK,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: WHITE,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  avatarSection: {
    backgroundColor: TEAL_DARK,
    alignItems: "center",
    paddingBottom: 40,
    marginTop: -60,
    paddingTop: 0,
    position: "relative",
  },
  decCircle1: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    left: 30,
    top: 10,
  },
  decCircle2: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
    left: 60,
    top: 40,
  },
  decCircle3: {
    position: "absolute",
    width: 55,
    height: 55,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    right: 40,
    top: 20,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.4)",
    position: "relative",
  },
  avatarInner: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#f0f9ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 43,
  },
  editBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: WHITE,
  },
  waveBottom: {
    backgroundColor: TEAL_DARK,
    height: 32,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    marginTop: -1,
  },
  statsBar: {
    flexDirection: "row",
    marginHorizontal: 18,
    marginTop: 20,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
  },
  statBorder: {
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: TEAL_DARK,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748b",
  },
  infoCard: {
    marginHorizontal: 18,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  fieldRow: {
    paddingVertical: 14,
    gap: 4,
  },
  fieldBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#94a3b8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  fieldValue: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#1e293b",
  },
  fieldValueEmpty: {
    color: "#cbd5e1",
    fontFamily: "Inter_400Regular",
  },
  actions: {
    marginHorizontal: 18,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#1e293b",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderCard: {
    backgroundColor: WHITE,
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    gap: 16,
  },
  loaderText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: TEAL_DARK,
  },
  medicalCardBtn: {
    backgroundColor: "linear-gradient(135deg, #e63e3e 0%, #dc2626 100%)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  medicalCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  medicalCardContent: {
    flex: 1,
  },
  medicalCardTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: WHITE,
  },
  medicalCardDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
  },
});
