import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View,  } from 'react-native';
import { TranslateText as Text } from '@/components/TranslateText';
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { AnimPressable } from "@/components/AnimPressable";

const PURPLE = "#6C47FF";
const WHITE = "#ffffff";

export default function EmergencyCardScreen() {
  const insets = useSafeAreaInsets();
  const { user, medicines, patient, setUser } = useApp();
  const topInset = Platform.OS === "web" ? 0 : insets.top;
  const [editing, setEditing] = useState(false);

  const [bloodType, setBloodType] = useState(user?.bloodType ?? "O+");
  const [allergies, setAllergies] = useState(user?.allergies ?? "Penicillin");
  const [ecName, setEcName] = useState(user?.emergencyContactName ?? "Jane Doe");
  const [ecPhone, setEcPhone] = useState(user?.emergencyContactPhone ?? "+1 (555) 911-0000");

  const handleSave = () => {
    if (user) {
      setUser({ ...user, bloodType, allergies, emergencyContactName: ecName, emergencyContactPhone: ecPhone });
    }
    setEditing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F4FB" }}>
      {/* Header */}
      <LinearGradient
        colors={["#4B26C8", PURPLE, "#8B5CF6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topInset + 20 }]}
      >
        <View style={styles.decor1} />
        <View style={styles.decor2} />
        <View style={styles.decor3} />
        <View style={styles.headerRow}>
          <AnimPressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={WHITE} />
          </AnimPressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerEmoji}></Text>
            <Text style={styles.headerTitle}>Emergency Card</Text>
          </View>
          <AnimPressable onPress={() => editing ? handleSave() : setEditing(true)} style={styles.editBtn}>
            <Feather name={editing ? "save" : "edit-2"} size={16} color={PURPLE} />
          </AnimPressable>
        </View>
        <Text style={styles.headerSub}>Show this to emergency responders</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient identity */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconWrap, { backgroundColor: `${PURPLE}15` }]}>
              <Feather name="user" size={18} color={PURPLE} />
            </View>
            <Text style={styles.cardTitle}>Patient Information</Text>
          </View>
          <Row label="Name" value={user?.name ?? patient?.name ?? "—"} />
          <Row label="Age" value={patient?.age ? `${patient.age} years` : "—"} />
          <Row label="Condition" value={patient?.condition ?? "—"} />
          {editing ? (
            <>
              <EditRow label="Blood Type" value={bloodType} onChange={setBloodType} />
              <EditRow label="Known Allergies" value={allergies} onChange={setAllergies} />
            </>
          ) : (
            <>
              <Row label="Blood Type" value={bloodType} highlight />
              <Row label="Known Allergies" value={allergies} danger />
            </>
          )}
        </View>

        {/* Current medicines */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconWrap, { backgroundColor: `${PURPLE}15` }]}>
              <Feather name="package" size={18} color={PURPLE} />
            </View>
            <Text style={styles.cardTitle}>Current Medications</Text>
          </View>
          {medicines.map((m, i) => (
            <View key={m.id} style={[styles.medRow, i < medicines.length - 1 && styles.medRowBorder]}>
              <View style={[styles.medDot, { backgroundColor: m.color }]} />
              <View style={styles.medInfo}>
                <Text style={styles.medName}>{m.name} — {m.dosage}</Text>
                <Text style={styles.medFreq}>{m.frequency}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Emergency contact */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconWrap, { backgroundColor: `${PURPLE}15` }]}>
              <Feather name="phone" size={18} color={PURPLE} />
            </View>
            <Text style={styles.cardTitle}>Emergency Contact</Text>
          </View>
          {editing ? (
            <>
              <EditRow label="Name" value={ecName} onChange={setEcName} />
              <EditRow label="Phone" value={ecPhone} onChange={setEcPhone} />
            </>
          ) : (
            <>
              <Row label="Name" value={ecName} />
              <Row label="Phone" value={ecPhone} highlight />
            </>
          )}
        </View>

        {/* Discharge info */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconWrap, { backgroundColor: "#f59e0b15" }]}>
              <Feather name="calendar" size={18} color="#f59e0b" />
            </View>
            <Text style={styles.cardTitle}>Discharge Info</Text>
          </View>
          <Row label="Discharge Date" value={patient?.dischargeDate ? new Date(patient.dischargeDate).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" }) : "—"} />
          <Row label="Recovery Phase" value="Active Recovery" />
        </View>

        {/* Call button */}
        <AnimPressable style={styles.callBtn} onPress={() => {}}>
          <LinearGradient
            colors={["#4B26C8", PURPLE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.callBtnGrad}
          >
            <Feather name="phone" size={20} color={WHITE} />
            <Text style={styles.callBtnText}>Call Emergency Contact</Text>
          </LinearGradient>
        </AnimPressable>

        <Text style={styles.footerNote}>
          🔒 This information is stored only on your device and is not shared without your consent.
        </Text>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, highlight && rowStyles.highlight, danger && rowStyles.danger]}>
        {value}
      </Text>
    </View>
  );
}

function EditRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={rowStyles.editRow}>
      <Text style={rowStyles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={rowStyles.input}
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  editRow: { paddingVertical: 4 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#64748b", flex: 1 },
  value: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#1E1B4B", flex: 2, textAlign: "right" },
  highlight: { color: PURPLE },
  danger: { color: "#EF4444" },
  input: {
    borderWidth: 1.5,
    borderColor: "#E8E4FF",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#1E1B4B",
    marginTop: 4,
    backgroundColor: "#fff",
  },
});

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
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
  headerRow: { flexDirection: "row", alignItems: "center" },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  headerEmoji: { fontSize: 22 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: WHITE },
  editBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: WHITE, alignItems: "center", justifyContent: "center",
  },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", textAlign: "center" },

  content: { padding: 16, paddingBottom: 40, gap: 14 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 18,
    gap: 10,
    borderWidth: 1.5,
    borderColor: "#E8E4FF",
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1E1B4B" },

  medRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  medRowBorder: { borderBottomWidth: 1, borderBottomColor: "#fff1f4" },
  medDot: { width: 10, height: 10, borderRadius: 5 },
  medInfo: { flex: 1 },
  medName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#1E1B4B" },
  medFreq: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748b" },

  callBtn: { borderRadius: 50, overflow: "hidden", marginTop: 10 },
  callBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16,
  },
  callBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: WHITE },
  footerNote: {
    fontSize: 11, fontFamily: "Inter_400Regular", color: "#94a3b8",
    textAlign: "center", lineHeight: 16, marginTop: 10,
  },
});
