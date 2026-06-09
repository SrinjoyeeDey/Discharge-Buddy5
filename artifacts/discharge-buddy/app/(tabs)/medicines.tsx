import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState, useEffect } from "react";
import {
  Platform, ScrollView, StyleSheet, TouchableOpacity, View, Modal, TextInput, KeyboardAvoidingView, Alert, ActivityIndicator, Dimensions,  } from 'react-native';
import { TranslateText as Text } from '@/components/TranslateText';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  SharedValue 
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { MedicineCard } from "@/components/MedicineCard";
import { AnimPressable } from "@/components/AnimPressable";
import { MascotBuddy } from "@/components/MascotBuddy";
import { TimeSegmentedControl } from "@/components/TimeSegmentedControl";
import { SuccessBurst } from "@/components/SuccessBurst";
import { Medicine, useApp } from "@/context/AppContext";

const { width } = Dimensions.get("window");
const edgePad = Math.min(width * 0.05, 20);
const PURPLE = "#6C47FF";
const PURPLE_LIGHT = "#EDE9FE";
const WHITE = "#FFFFFF";

const TIME_SLOTS: { label: string; range: [string, string]; icon: any; color: string; gradient: readonly [string, string] }[] = [
  { label: "Early Morning", range: ["00:00", "06:00"], icon: "sunrise", color: "#6366F1", gradient: ["#818CF8", "#6366F1"] },
  { label: "Morning", range: ["06:00", "12:00"], icon: "sun", color: "#0EA5E9", gradient: ["#38BDF8", "#0EA5E9"] },
  { label: "Afternoon", range: ["12:00", "17:00"], icon: "cloud", color: "#10B981", gradient: ["#34D399", "#10B981"] },
  { label: "Evening", range: ["17:00", "21:00"], icon: "sunset", color: "#1E1B4B", gradient: ["#312E81", "#1E1B4B"] },
  { label: "Night", range: ["21:00", "24:00"], icon: "moon", color: "#0F172A", gradient: ["#1E1B4B", "#0F172A"] },
];

function computeRefillDays(med: Medicine): number {
  const dosesPerDay = med.times.length;
  const pills = med.totalPills ?? 30;
  const daysSinceStart = Math.floor((Date.now() - new Date(med.startDate).getTime()) / (1000 * 60 * 60 * 24));
  const usedPills = daysSinceStart * dosesPerDay;
  const remaining = Math.max(0, pills - usedPills);
  return Math.floor(remaining / dosesPerDay);
}


const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 50,
    padding: 4,
    height: 48,
    position: 'relative',
  },
  slider: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: WHITE,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  btn: { 
    flex: 1,
    alignItems: "center", 
    justifyContent: "center",
    zIndex: 1,
    borderRadius: 50,
  },
  btnActive: {
    backgroundColor: WHITE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  text: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)" },
  textActive: { color: PURPLE },
});

function RefillCard({ med }: { med: Medicine }) {
  const days = computeRefillDays(med);
  const total = med.totalPills ?? 30;
  const usedPct = Math.min(1, Math.max(0, 1 - (days * med.times.length) / total));
  const color = days <= 7 ? "#EF4444" : days <= 14 ? "#F59E0B" : "#10B981";

  return (
    <AnimPressable onPress={() => { }} style={rfStyles.card}>
      <View style={rfStyles.row}>
        <View style={[rfStyles.colorBar, { backgroundColor: med.color }]} />
        <View style={rfStyles.info}>
          <Text style={rfStyles.name}>{med.name}</Text>
          <Text style={rfStyles.dosage}>{med.dosage} · {med.frequency}</Text>
        </View>
        <View style={[rfStyles.badge, { backgroundColor: `${color}15` }]}>
          <Feather name="refresh-cw" size={11} color={color} />
          <Text style={[rfStyles.badgeText, { color }]}>
            {days <= 0 ? "Refill!" : `${days}d`}
          </Text>
        </View>
      </View>
      <View style={rfStyles.barBg}>
        <View style={[rfStyles.barFill, { width: `${usedPct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={rfStyles.barLabel}>{days > 0 ? `${days} days of supply remaining` : "Needs refill now"}</Text>
    </AnimPressable>
  );
}

const rfStyles = StyleSheet.create({
  card: {
    backgroundColor: WHITE, borderRadius: 20, padding: 16, gap: 12,
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  colorBar: { width: 5, height: 40, borderRadius: 3 },
  info: { flex: 1 },
  name: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  dosage: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  badgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  barBg: { height: 8, borderRadius: 4, backgroundColor: "#F3F0FF", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  barLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
});

export default function MedicinesScreen() {
  const insets = useSafeAreaInsets();
  const { medicines, todayDoses, updateDoseStatus, addMedicine, updateMedicine, deleteMedicine } = useApp();
  const [activeTab, setActiveTab] = useState<"today" | "all" | "refills">("today");
  const [dayTimeFilter, setDayTimeFilter] = useState<string>("Morning");
  const [containerWidth, setContainerWidth] = useState(0);
  const [mascotTrigger, setMascotTrigger] = useState(0);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [deletingMedId, setDeletingMedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const topInset = Platform.OS === "web" ? 0 : insets.top;

  const getDosesForSlot = (range: [string, string]) =>
    todayDoses
      .filter(d => d.status !== "taken")
      .filter((dose) => {
        const [h, m] = dose.scheduledTime.split(":").map(Number);
        const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const slot = TIME_SLOTS.find(s => t >= s.range[0] && t < s.range[1]);
        return slot?.label === dayTimeFilter;
      });

  const takenCount = todayDoses.filter((d) => d.status === "taken").length;
  const totalCount = todayDoses.length;
  const progressPct = totalCount > 0 ? takenCount / totalCount : 0;

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);

  const FREQUENCY_OPTIONS = [
    "Daily", "Twice Daily", "3 Times Daily", "4 Times Daily", 
    "Weekly", "Monthly", "As Needed"
  ];

  const saveMedicine = async (medToSave: Medicine) => {
    setIsSaving(true);
    try {
      if (medToSave.id) {
        await updateMedicine(medToSave.id, medToSave);
      } else {
        const { id, ...medData } = medToSave;
        await addMedicine(medData);
      }
      setEditingMed(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Save Failed", err.message || "An unexpected error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingMed || isSaving) return;
    
    if (!editingMed.name?.trim()) {
      Alert.alert("Error", "Please enter a medicine name.");
      return;
    }

    if (!editingMed.totalPills) {
      setShowSupplyModal(true);
      return;
    }

    await saveMedicine(editingMed);
  };

  const handleDelete = (id: string) => {
    setDeletingMedId(id);
  };

  const confirmDelete = async () => {
    if (!deletingMedId) return;
    try {
      await deleteMedicine(deletingMedId);
      setDeletingMedId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F4FB" }}>
      <LinearGradient
        colors={["#4B26C8", PURPLE, "#8B5CF6"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topInset + 24 }]}
      >
        <View style={styles.decor1} />
        <View style={styles.decor2} />
        <View style={styles.decor3} />
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Text style={styles.headerTitle}>My Medicines</Text>
            </View>
            <Text style={styles.headerSub}>{takenCount} of {totalCount} taken today</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <AnimPressable
              onPress={() => router.push("/drug-checker" as any)}
              style={styles.scanBtn}
            >
              <Feather name="shield" size={20} color={PURPLE} />
            </AnimPressable>
            <AnimPressable
              onPress={() => router.push("/scan")}
              style={styles.scanBtn}
            >
              <Feather name="camera" size={20} color={PURPLE} />
            </AnimPressable>
          </View>
        </View>

        <View style={{ marginTop: 4, width: '100%' }}>
          <MascotBuddy size={45} trigger={mascotTrigger} />
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
          </View>
          <Text style={styles.progressPct}>{Math.round(progressPct * 100)}%</Text>
        </View>

        <View 
          style={tabStyles.container}
        >
          {(["today", "all", "refills"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                setActiveTab(tab);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[tabStyles.btn, activeTab === tab && tabStyles.btnActive]}
              activeOpacity={0.7}
            >
              <Text style={[
                tabStyles.text, 
                activeTab === tab && tabStyles.textActive
              ]}>
                {tab === "today" ? "Today" : tab === "all" ? "All Meds" : "Refills"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >

        {(activeTab === "today" || activeTab === "all") && medicines.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 4, paddingTop: 4, paddingBottom: 12 }}>
            <TouchableOpacity 
              onPress={() => setShowFilterModal(true)} 
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
            >
              <Feather name="filter" size={14} color="#475569" />
              <Text style={{ color: '#475569', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{dayTimeFilter} ▾</Text>
            </TouchableOpacity>
          </View>
        )}
        {activeTab === "today" ? (
          totalCount === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 52, marginBottom: 8 }}>✅</Text>
              <Text style={styles.emptyTitle}>All clear today!</Text>
              <Text style={styles.emptySub}>No doses scheduled yet</Text>
            </View>
          ) : (
            <View>
              {TIME_SLOTS.filter(slot => slot.label === dayTimeFilter).map((slot) => {
                const doses = getDosesForSlot(slot.range);
                if (doses.length === 0) return null;
                const slotTaken = doses.filter((d) => d.status === "taken").length;
                return (
                  <View key={slot.label} style={styles.slotSection}>
                    <View style={styles.slotHeader}>
                        <LinearGradient
                          colors={slot.gradient}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          style={styles.slotIconWrap}
                        >
                          <Feather name={slot.icon as any} size={20} color={WHITE} />
                        </LinearGradient>
                      <Text style={styles.slotLabel}>{slot.label}</Text>
                      <View style={[styles.slotBadge, { backgroundColor: `${slot.color}15` }]}>
                        <Text style={[styles.slotBadgeText, { color: slot.color }]}>{slotTaken}/{doses.length}</Text>
                      </View>
                    </View>
                    {doses.map((dose, idx) => {
                      const med = medicines.find((m) => m.id === dose.medicineId);
                      if (!med) return null;
                      return (
                        <MedicineCard
                          key={dose.id || `dose-${idx}`}
                          medicine={med}
                          dose={dose}
                          onTake={(id) => {
                            updateDoseStatus(id, "taken");
                            setMascotTrigger(prev => prev + 1);
                            setShowSuccess(true);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }}
                          onSnooze={(id) => {
                            updateDoseStatus(id, "snoozed", 15);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }}
                        />
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )
        ) : activeTab === "refills" ? (
          <View style={styles.refillSection}>
            <View style={styles.refillHeader}>
              <Text style={{ fontSize: 28 }}>💊</Text>
              <View>
                <Text style={styles.refillTitle}>Refill Tracker</Text>
                <Text style={styles.refillSub}>Monitor your medication supply</Text>
              </View>
            </View>
            {medicines.map((med) => <RefillCard key={med.id} med={med} />)}
          </View>
        ) : medicines.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 52, marginBottom: 8 }}>📋</Text>
            <Text style={styles.emptyTitle}>No medicines yet</Text>
            <Text style={styles.emptySub}>Scan a prescription to get started</Text>
            <TouchableOpacity
              onPress={() => router.push("/scan")}
              style={styles.emptyBtn}
              activeOpacity={0.85}
            >
              <Feather name="camera" size={16} color={WHITE} />
              <Text style={styles.emptyBtnText}>Scan Prescription</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setEditingMed({
                id: "",
                name: "",
                dosage: "",
                frequency: "Daily",
                times: ["08:00"],
                instructions: "",
                simplifiedInstructions: "",
                startDate: new Date().toISOString(),
                color: PURPLE
              })}
              style={[styles.manualAddBtn, { marginTop: 10, width: '80%', alignSelf: 'center' }]}
              activeOpacity={0.7}
            >
              <Feather name="plus-circle" size={20} color={PURPLE} />
              <Text style={styles.manualAddText}>Enter Manually</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.allGrid}>
            <TouchableOpacity
              onPress={() => setEditingMed({
                id: "",
                name: "",
                dosage: "",
                frequency: "Daily",
                times: ["08:00"],
                instructions: "",
                simplifiedInstructions: "",
                startDate: new Date().toISOString(),
                color: PURPLE
              })}
              style={styles.manualAddBtn}
              activeOpacity={0.7}
            >
              <Feather name="plus-circle" size={20} color={PURPLE} />
              <Text style={styles.manualAddText}>Add Medicine Manually</Text>
            </TouchableOpacity>

            {(() => {
              const slot = TIME_SLOTS.find(s => s.label === dayTimeFilter);
              const filtered = slot 
                ? medicines.filter(med => 
                    med.times.some(time => {
                      const [h, m] = time.split(":").map(Number);
                      const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                      return t >= slot.range[0] && t < slot.range[1];
                    })
                  )
                : medicines;
              
              if (filtered.length === 0) {
                return (
                  <View style={[styles.empty, { paddingTop: 20 }]}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
                    <Text style={styles.emptyTitle}>No meds in this slot</Text>
                    <Text style={styles.emptySub}>Try another time of day</Text>
                  </View>
                );
              }

              return filtered.map((med, idx) => (
                <MedicineCard
                  key={med.id || `med-${idx}`}
                  medicine={med}
                  compact
                  onEdit={(m) => setEditingMed({ ...m })}
                  onDelete={(id) => handleDelete(id)}
                />
              ));
            })()}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!editingMed} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={[styles.modalBlur, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Medicine</Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>NAME</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editingMed?.name}
                    onChangeText={(t) => setEditingMed(prev => prev ? { ...prev, name: t } : null)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>DOSAGE</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editingMed?.dosage}
                    onChangeText={(t) => setEditingMed(prev => prev ? { ...prev, dosage: t } : null)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>FREQUENCY</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <TouchableOpacity 
                        key={opt}
                        onPress={() => setEditingMed(prev => prev ? { ...prev, frequency: opt } : null)}
                        style={[
                          styles.freqBadge,
                          editingMed?.frequency === opt && styles.freqBadgeActive
                        ]}
                      >
                        <Text style={[
                          styles.freqText,
                          editingMed?.frequency === opt && styles.freqTextActive
                        ]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={styles.inputLabel}>DOSAGE TIMES</Text>
                    <TouchableOpacity 
                      onPress={() => setEditingMed(prev => prev ? { ...prev, times: [...prev.times, "08:00"] } : null)}
                    >
                      <Feather name="plus-circle" size={18} color={PURPLE} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.timeGrid}>
                    {editingMed?.times.map((time, idx) => (
                        <TouchableOpacity 
                          key={idx} 
                          style={styles.timeItem}
                          activeOpacity={0.7}
                          onPress={() => {
                            setEditingTimeIndex(idx);
                            setShowTimePicker(true);
                          }}
                        >
                          <Feather name="clock" size={14} color={PURPLE} />
                          <Text style={styles.timeText}>{time}</Text>
                          <View style={{ width: 1, height: 14, backgroundColor: `${PURPLE}30`, marginHorizontal: 4 }} />
                          <TouchableOpacity 
                            onPress={() => {
                              const newTimes = [...(editingMed?.times || [])];
                              newTimes.splice(idx, 1);
                              setEditingMed(prev => prev ? { ...prev, times: newTimes } : null);
                            }}
                          >
                            <Feather name="x" size={12} color="#94a3b8" />
                          </TouchableOpacity>
                        </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>DURATION (DAYS)</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
                    <TextInput 
                      style={[styles.textInput, { flex: 1 }]}
                      keyboardType="numeric"
                      placeholder="e.g. 7"
                      onChangeText={(t) => {
                        const days = parseInt(t);
                        if (!isNaN(days) && editingMed?.startDate) {
                          const end = new Date(editingMed.startDate);
                          end.setDate(end.getDate() + days);
                          setEditingMed(prev => prev ? { ...prev, endDate: end.toISOString() } : null);
                        }
                      }}
                    />
                    <Text style={{ color: "#64748b", fontSize: 12 }}>
                      {editingMed?.endDate ? `Ends: ${new Date(editingMed.endDate).toLocaleDateString()}` : "Set duration"}
                    </Text>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>TOTAL SUPPLY (PILLS)</Text>
                  <TextInput 
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="e.g. 30"
                    value={editingMed?.totalPills ? editingMed.totalPills.toString() : ""}
                    onChangeText={(t) => {
                      const pills = parseInt(t);
                      setEditingMed(prev => prev ? { ...prev, totalPills: isNaN(pills) ? undefined : pills } : null);
                    }}
                  />
                  <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>
                    Used for tracking refills.
                  </Text>
                </View>


                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>INSTRUCTIONS</Text>
                  <TextInput 
                    style={[styles.textInput, { minHeight: 48, maxHeight: 150 }]}
                    multiline
                    value={editingMed?.instructions}
                    onChangeText={(t) => setEditingMed(prev => prev ? { ...prev, instructions: t, simplifiedInstructions: t } : null)}
                    placeholder="Take after meals..."
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </ScrollView>

              {showTimePicker && (
                <DateTimePicker
                  value={(() => {
                    const [h, m] = (editingMed?.times[editingTimeIndex!] || "08:00").split(":").map(Number);
                    const d = new Date();
                    d.setHours(h, m, 0, 0);
                    return d;
                  })()}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  onChange={(event: DateTimePickerEvent, date?: Date) => {
                    setShowTimePicker(false);
                    if (date && editingTimeIndex !== null) {
                      const newTimes = [...(editingMed?.times || [])];
                      newTimes[editingTimeIndex] = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
                      setEditingMed(prev => prev ? { ...prev, times: newTimes } : null);
                    }
                  }}
                />
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setEditingMed(null)}
                  disabled={isSaving}
                  activeOpacity={0.6}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSave, isSaving && { opacity: 0.7 }]}
                  onPress={handleUpdate}
                  disabled={isSaving}
                  activeOpacity={0.8}
                >
                  {isSaving ? (
                    <ActivityIndicator color={WHITE} size="small" />
                  ) : (
                    <Text style={styles.modalSaveText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Deletion Modal */}
      {!!deletingMedId && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setDeletingMedId(null)}>
          <View style={styles.modalBlur}>
            <View style={[styles.modalContent, { width: "85%", alignItems: "center" }]}>
              <View style={[styles.iconBtn, { backgroundColor: "#FEE2E2", marginBottom: 16, width: 60, height: 60, borderRadius: 30 }]}>
                <Feather name="trash-2" size={28} color="#EF4444" />
              </View>
              <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Delete Medication?</Text>
              <Text style={{ 
                textAlign: "center", 
                color: "#64748b", 
                fontFamily: "Inter_400Regular",
                marginBottom: 24,
                lineHeight: 20
              }}>
                This will permanently remove {medicines.find(m => m.id === deletingMedId)?.name || "this medication"} and all associated dosage history.
              </Text>

              <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
                <TouchableOpacity
                  style={[styles.modalCancel, { backgroundColor: "#F1F5F9" }]}
                  onPress={() => setDeletingMedId(null)}
                >
                  <Text style={styles.modalCancelText}>Keep it</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSave, { backgroundColor: "#EF4444", flex: 1.5 }]}
                  onPress={confirmDelete}
                >
                  <Text style={styles.modalSaveText}>Yes, Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Supply Warning Modal */}
      {showSupplyModal && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setShowSupplyModal(false)}>
          <View style={styles.modalBlur}>
            <View style={[styles.modalContent, { width: "85%", alignItems: "center" }]}>
              <View style={[styles.iconBtn, { backgroundColor: `${PURPLE}15`, marginBottom: 16, width: 60, height: 60, borderRadius: 30 }]}>
                <Feather name="package" size={28} color={PURPLE} />
              </View>
              <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Missing Total Supply</Text>
              <Text style={{ 
                textAlign: "center", 
                color: "#64748b", 
                fontFamily: "Inter_400Regular",
                marginBottom: 24,
                lineHeight: 20
              }}>
                You haven't specified the total number of pills. This is needed to track your refills.
              </Text>

              <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
                <TouchableOpacity
                  style={[styles.modalCancel, { backgroundColor: "#F1F5F9" }]}
                  onPress={() => setShowSupplyModal(false)}
                >
                  <Text style={styles.modalCancelText}>Enter Amount</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSave, { flex: 1.5 }]}
                  onPress={() => {
                    setShowSupplyModal(false);
                    if (editingMed) {
                        saveMedicine({ ...editingMed, totalPills: 30 });
                    }
                  }}
                >
                  <Text style={styles.modalSaveText}>Assume 30</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Time Filter Modal */}
      {showFilterModal && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setShowFilterModal(false)}>
          <View style={styles.modalBlur}>
            <View style={[styles.modalContent, { width: "85%", alignItems: "center" }]}>
              <View style={[styles.iconBtn, { backgroundColor: `${PURPLE}15`, marginBottom: 16, width: 60, height: 60, borderRadius: 30 }]}>
                <Feather name="clock" size={28} color={PURPLE} />
              </View>
              <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Select Time of Day</Text>
              
              <View style={{ width: '100%', marginBottom: 20 }}>
                {TIME_SLOTS.filter(s => s.label !== "Early Morning").map(slot => (
                  <TouchableOpacity
                    key={slot.label}
                    style={[
                      { padding: 14, borderRadius: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
                      dayTimeFilter === slot.label ? { backgroundColor: PURPLE } : { backgroundColor: '#F1F5F9' }
                    ]}
                    onPress={() => {
                      setDayTimeFilter(slot.label);
                      setShowFilterModal(false);
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Feather name={slot.icon as any} size={20} color={dayTimeFilter === slot.label ? WHITE : '#64748b'} />
                    <Text style={[{ fontSize: 16, fontFamily: "Inter_600SemiBold" }, dayTimeFilter === slot.label ? { color: WHITE } : { color: '#1E1B4B' }]}>
                      {slot.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.modalCancel, { backgroundColor: "#F1F5F9", width: '100%' }]}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <SuccessBurst 
        visible={showSuccess} 
        onComplete={() => setShowSuccess(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
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
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: WHITE },
  headerSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  scanBtn: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: WHITE, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
  },
  progressWrap: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  progressBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.22)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: WHITE },
  progressPct: { fontSize: 14, fontFamily: "Inter_700Bold", color: WHITE, width: 40, textAlign: "right" },
  tabWrap: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 50, padding: 5,
  },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120, gap: 8 },
  slotSection: { marginBottom: 8 },
  slotHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginBottom: 16, marginTop: 10,
  },
  slotIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  slotLabel: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1E1B4B", flex: 1, letterSpacing: -0.3 },
  slotBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50 },
  slotBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  allGrid: { gap: 2 },
  refillSection: { gap: 14 },
  refillHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
  refillTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  refillSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  empty: { alignItems: "center", paddingTop: 64, gap: 10 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: PURPLE, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 50, marginTop: 12,
  },
  emptyBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: WHITE },
  filterTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1E1B4B", textAlign: "center" },
  filterSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", marginTop: 4 },
  manualAddBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, backgroundColor: WHITE, borderRadius: 20,
    marginBottom: 16, borderWidth: 1, borderStyle: "dashed",
    borderColor: "rgba(108, 71, 255, 0.3)",
  },
  manualAddText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: PURPLE },
  freqBadge: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "#f1f5f9",
    marginRight: 8, borderWidth: 1, borderColor: "#e2e8f0"
  },
  freqBadgeActive: { backgroundColor: `${PURPLE}15`, borderColor: PURPLE },
  freqText: { color: "#64748b", fontSize: 14 },
  freqTextActive: { color: PURPLE, fontWeight: "600" },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  timeItem: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: `${PURPLE}10`, borderRadius: 12,
    borderWidth: 1, borderColor: `${PURPLE}30`
  },
  timeText: { color: PURPLE, fontWeight: "600", fontSize: 14 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center", justifyContent: "center",
  },
  modalOverlay: { flex: 1 },
  modalBlur: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalContent: {
    backgroundColor: "rgba(255, 255, 255, 0.9)", // Glassy white
    borderRadius: 24,
    padding: 24,
    width: "90%",
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1E1B4B", marginBottom: 20, textAlign: "center" },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#94a3b8", marginBottom: 8, letterSpacing: 0.5 },
  textInput: {
    backgroundColor: "rgba(0, 0, 0, 0.05)", // Subtle translucent dark for visibility
    borderRadius: 12,
    padding: 14,
    color: "#1E1B4B",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalCancel: { 
    flex: 1, 
    paddingVertical: 14, 
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 15,
  },
  modalCancelText: { color: "#64748b", fontFamily: "Inter_600SemiBold" },
  modalSave: {
    flex: 2,
    backgroundColor: PURPLE,
    paddingVertical: 14,
    borderRadius: 15,
    alignItems: "center"
  },
  modalSaveText: { color: "#fff", fontFamily: "Inter_700Bold" },
});
