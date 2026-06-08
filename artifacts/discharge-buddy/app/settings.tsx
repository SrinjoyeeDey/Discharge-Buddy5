import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Switch, TouchableOpacity, View, Pressable, Alert } from 'react-native';
import { TranslateText as Text } from '@/components/TranslateText';
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";

const TEAL = "#0891b2";
const TEAL_DARK = "#0c4a6e";
const WHITE = "#ffffff";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { 
    logout, 
    hapticsEnabled, 
    setHapticsEnabled, 
    language, 
    setLanguage, 
    resetOnboarding,
    doseAlerts,
    setDoseAlerts,
    appAlerts,
    setAppAlerts
  } = useApp();
  const [darkMode, setDarkMode] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);

  const handleDarkModeToggle = (val: boolean) => {
    setDarkMode(val);
    Alert.alert("Dark Mode", "Dark Mode is Coming Soon!");
  };

  const languages = [
    { label: "English", value: "en", flag: "🇺🇸" },
    { label: "हिंदी (Hindi)", value: "hi", flag: "🇮🇳" },
    { label: "বাংলা (Bengali)", value: "bn", flag: "🇮🇳" },
    { label: "తెలుగు (Telugu)", value: "te", flag: "🇮🇳" },
    { label: "मराठी (Marathi)", value: "mr", flag: "🇮🇳" },
    { label: "தமிழ் (Tamil)", value: "ta", flag: "🇮🇳" },
    { label: "اردو (Urdu)", value: "ur", flag: "🇮🇳" },
    { label: "ગુજરાતી (Gujarati)", value: "gu", flag: "🇮🇳" },
    { label: "ಕನ್ನಡ (Kannada)", value: "kn", flag: "🇮🇳" },
    { label: "മലയാളം (Malayalam)", value: "ml", flag: "🇮🇳" },
    { label: "ଓଡ଼ିଆ (Odia)", value: "or", flag: "🇮🇳" },
    { label: "ਪੰਜਾਬੀ (Punjabi)", value: "pa", flag: "🇮🇳" },
    { label: "অসমীয়া (Assamese)", value: "as", flag: "🇮🇳" },
    { label: "Español (Spanish)", value: "es", flag: "🇪🇸" },
  ];

  const currentLangLabel = languages.find(l => l.value === language)?.label || "English";

  const handleLogout = () => {
    logout();
  };

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 32 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topInset + 12 }]}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={20} color={WHITE} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <TouchableOpacity style={styles.backBtn}>
            <Feather name="moon" size={20} color={WHITE} />
          </TouchableOpacity>
        </View>
        <View style={styles.waveDivider} />

        {/* Account section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: `${TEAL}15` }]}>
              <Feather name="user" size={20} color={TEAL} />
            </View>
            <Text style={styles.sectionTitle}>Account</Text>
          </View>

          {[
            { label: "Edit Profile", icon: "edit" as const, onPress: () => router.push("/profile/edit") },
            { label: "Change Password", icon: "lock" as const, onPress: () => router.push("/profile/change-password") },
            { label: "Connect Social", icon: "link" as const, onPress: () => Alert.alert("Connect Social", "Social accounts connected successfully!") },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={styles.row} onPress={item.onPress}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Feather name="chevron-right" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Notifications section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "#f59e0b20" }]}>
              <Feather name="bell" size={20} color="#f59e0b" />
            </View>
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Dose Reminders</Text>
            <Switch
              value={doseAlerts}
              onValueChange={setDoseAlerts}
              trackColor={{ false: "#e2e8f0", true: `${TEAL}60` }}
              thumbColor={doseAlerts ? TEAL : "#cbd5e1"}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>App Notifications</Text>
            <Switch
              value={appAlerts}
              onValueChange={setAppAlerts}
              trackColor={{ false: "#e2e8f0", true: `${TEAL}60` }}
              thumbColor={appAlerts ? TEAL : "#cbd5e1"}
            />
          </View>
        </View>

        {/* Display section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "#8b5cf620" }]}>
              <Feather name="monitor" size={20} color="#8b5cf6" />
            </View>
            <Text style={styles.sectionTitle}>Display</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Dark Mode</Text>
            <Switch
              value={darkMode}
              onValueChange={handleDarkModeToggle}
              trackColor={{ false: "#e2e8f0", true: "#8b5cf640" }}
              thumbColor={darkMode ? "#8b5cf6" : "#cbd5e1"}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Haptic Feedback</Text>
            <Switch
              value={hapticsEnabled}
              onValueChange={setHapticsEnabled}
              trackColor={{ false: "#e2e8f0", true: "#8b5cf640" }}
              thumbColor={hapticsEnabled ? "#8b5cf6" : "#cbd5e1"}
            />
          </View>
          <TouchableOpacity style={styles.row} onPress={() => setShowLangModal(true)}>
            <Text style={styles.rowLabel}>Language</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{currentLangLabel}</Text>
              <Feather name="chevron-right" size={18} color="#94a3b8" />
            </View>
          </TouchableOpacity>
        </View>

        {/* App section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "#ec489920" }]}>
              <Feather name="layers" size={20} color="#ec4899" />
            </View>
            <Text style={styles.sectionTitle}>App</Text>
          </View>
          <TouchableOpacity 
            style={styles.row} 
            onPress={() => {
              resetOnboarding();
              router.replace("/onboarding");
            }}
          >
            <Text style={styles.rowLabel}>Restart Tutorial</Text>
            <Feather name="refresh-cw" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* More section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "#10b98120" }]}>
              <Feather name="map" size={20} color="#10b981" />
            </View>
            <Text style={styles.sectionTitle}>More</Text>
          </View>

          {[
            { label: "Privacy Policy", icon: "shield" as const, onPress: () => Alert.alert("Privacy Policy", "Discharge Buddy respects your privacy. All your audio records and prescription details are encrypted and kept confidential.") },
            { label: "Terms of Service", icon: "file-text" as const, onPress: () => Alert.alert("Terms of Service", "By using Discharge Buddy, you agree to our terms of service. This app is an assistant and not a substitute for professional medical advice.") },
            { label: "About DischargeBuddy", icon: "info" as const, onPress: () => Alert.alert("About Discharge Buddy", "Discharge Buddy v1.2.0 - Supporting Caregivers & Families during post-discharge recovery.") },
            { label: "Rate the App", icon: "star" as const, onPress: () => Alert.alert("Rate the App", "Thank you for rating! 5 stars recorded ❤️") },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={styles.row} onPress={item.onPress}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Feather name="chevron-right" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout button */}
        <View style={styles.logoutSection}>
          <View style={[styles.sectionHeader, { marginBottom: 0 }]}>
            <View style={[styles.sectionIcon, { backgroundColor: "#ef444420" }]}>
              <Feather name="log-out" size={20} color="#ef4444" />
            </View>
            <TouchableOpacity onPress={handleLogout} style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: "#ef4444" }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Language Modal */}
        <Modal
          visible={showLangModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowLangModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowLangModal(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Language</Text>
                <TouchableOpacity onPress={() => setShowLangModal(false)}>
                  <Feather name="x" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={true}
                bounces={true}
                style={{ maxHeight: 420 }}
              >
                {languages.map((lang) => (
                  <TouchableOpacity
                    key={lang.value}
                    style={[
                      styles.langItem,
                      language === lang.value && styles.langItemActive
                    ]}
                    onPress={() => {
                      setLanguage(lang.value as any);
                      setShowLangModal(false);
                    }}
                  >
                    <Text style={styles.langFlag}>{lang.flag}</Text>
                    <Text style={[
                      styles.langLabel,
                      language === lang.value && styles.langLabelActive
                    ]}>{lang.label}</Text>
                    {language === lang.value && (
                      <Feather name="check" size={20} color="#0891b2" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
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
    paddingBottom: 20,
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
  waveDivider: {
    height: 28,
    backgroundColor: TEAL_DARK,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 16,
  },

  section: {
    marginHorizontal: 18,
    marginBottom: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: WHITE,
    marginBottom: 0,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#0f172a",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#334155",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#94a3b8",
  },

  logoutSection: {
    marginHorizontal: 18,
    backgroundColor: "#fff5f5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
    overflow: "hidden",
    paddingVertical: 4,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#0f172a",
  },
  langItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  langItemActive: {
    backgroundColor: "#f0f9ff",
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  langFlag: { fontSize: 24 },
  langLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "#334155",
  },
  langLabelActive: {
    color: "#0891b2",
    fontFamily: "Inter_700Bold",
  },
});
