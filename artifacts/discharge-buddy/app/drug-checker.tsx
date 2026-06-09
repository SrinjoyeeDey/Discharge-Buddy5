import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { TranslateText as Text } from "@/components/TranslateText";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimPressable } from "@/components/AnimPressable";
import { useApp, type DrugCheckResult } from "@/context/AppContext";
import { MockProvider } from "@/context/MockProvider";
import { cacheGet, cacheSet, CACHE_KEYS } from "@/utils/offlineCache";

const PURPLE = "#6C47FF";
const WHITE = "#FFFFFF";
const BACKGROUND = "#F5F4FB";
const FOREGROUND = "#1E1B4B";
const MUTED = "#6B7280";
const BORDER = "#E8E4FF";

const SEVERITY = {
  high: { color: "#EF4444", label: "High", icon: "alert-octagon" as const },
  moderate: { color: "#F59E0B", label: "Moderate", icon: "alert-triangle" as const },
  mild: { color: "#0EA5E9", label: "Mild", icon: "info" as const },
};

export default function DrugCheckerScreen() {
  const insets = useSafeAreaInsets();
  const { medicines, api, isOnline } = useApp();
  const topInset = Platform.OS === "web" ? 0 : insets.top;

  const initialNames = useMemo(
    () => medicines.map((m) => (m.dosage ? `${m.name} ${m.dosage}` : m.name)).filter(Boolean),
    [medicines]
  );

  const [meds, setMeds] = useState<string[]>(initialNames);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DrugCheckResult | null>(null);
  const [usedOffline, setUsedOffline] = useState(false);

  useEffect(() => {
    setMeds(initialNames);
  }, [initialNames]);

  const addMed = () => {
    const v = draft.trim();
    if (!v) return;
    if (!meds.some((m) => m.toLowerCase() === v.toLowerCase())) setMeds((p) => [...p, v]);
    setDraft("");
  };

  const removeMed = (name: string) => setMeds((p) => p.filter((m) => m !== name));

  const runCheck = async () => {
    if (meds.length < 2) {
      setResult({ interactions: [], foodWarnings: [], summary: "Add at least two medicines to check for interactions.", hasCritical: false });
      return;
    }
    setLoading(true);
    setUsedOffline(false);
    try {
      const res = await api.checkDrugInteractions(meds);
      setResult(res);
      cacheSet(CACHE_KEYS.drugCheck, res);
    } catch (e) {
      // Offline / server unreachable → deterministic local keyword check.
      const offline = await new MockProvider().checkDrugInteractions(meds);
      const cached = await cacheGet<DrugCheckResult>(CACHE_KEYS.drugCheck);
      setResult(offline.interactions.length ? offline : cached?.data ?? offline);
      setUsedOffline(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: BACKGROUND }]}>
      <LinearGradient
        colors={["#4B26C8", PURPLE, "#8B5CF6"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.headerBg, { paddingTop: topInset + 20 }]}
      >
        <View style={styles.headerTop}>
          <AnimPressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={WHITE} />
          </AnimPressable>
          <Text style={styles.headerTitle}>Drug Interaction Checker</Text>
          <View style={{ width: 38 }} />
        </View>
        <Text style={styles.headerSub}>Check your medicines for conflicts</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Medicines to check</Text>
          <Text style={styles.cardHint}>Your current medicines are loaded. Add anything else you take.</Text>

          <View style={styles.chipWrap}>
            {meds.map((m) => (
              <View key={m} style={styles.chip}>
                <Text style={styles.chipText}>{m}</Text>
                <TouchableOpacity onPress={() => removeMed(m)} hitSlop={8}>
                  <Feather name="x" size={13} color={PURPLE} />
                </TouchableOpacity>
              </View>
            ))}
            {meds.length === 0 && <Text style={styles.emptyHint}>No medicines added yet.</Text>}
          </View>

          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a medicine (e.g. Ibuprofen)"
              placeholderTextColor="#94a3b8"
              onSubmitEditing={addMed}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addMed}>
              <Feather name="plus" size={20} color={WHITE} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[styles.checkBtn, loading && { opacity: 0.7 }]} onPress={runCheck} disabled={loading} activeOpacity={0.85}>
          {loading ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <>
              <Feather name="shield" size={18} color={WHITE} />
              <Text style={styles.checkBtnText}>Check Interactions</Text>
            </>
          )}
        </TouchableOpacity>

        {!isOnline && (
          <View style={styles.offlineNote}>
            <Feather name="wifi-off" size={14} color="#92400E" />
            <Text style={styles.offlineNoteText}>You are offline. Results use a limited on-device database.</Text>
          </View>
        )}

        {result && !loading && (
          <View style={{ marginTop: 18 }}>
            {result.summary ? (
              <View style={[styles.summaryCard, { borderColor: result.hasCritical ? `${SEVERITY.high.color}40` : BORDER, backgroundColor: result.hasCritical ? `${SEVERITY.high.color}08` : WHITE }]}>
                <Feather name={result.hasCritical ? "alert-octagon" : "check-circle"} size={20} color={result.hasCritical ? SEVERITY.high.color : "#10B981"} />
                <Text style={styles.summaryText}>{result.summary}</Text>
              </View>
            ) : null}

            {usedOffline && (
              <Text style={styles.offlineTag}>Offline check</Text>
            )}

            {result.interactions.length === 0 ? (
              <View style={styles.clearCard}>
                <Text style={{ fontSize: 44, marginBottom: 6 }}>✅</Text>
                <Text style={styles.clearTitle}>No conflicts detected</Text>
                <Text style={styles.clearSub}>Keep taking your medicines as prescribed.</Text>
              </View>
            ) : (
              result.interactions.map((it, i) => {
                const sev = SEVERITY[it.severity] ?? SEVERITY.mild;
                return (
                  <View key={i} style={[styles.interCard, { borderLeftColor: sev.color }]}>
                    <View style={styles.interHeader}>
                      <Feather name={sev.icon} size={18} color={sev.color} />
                      <Text style={styles.interPair}>{(it.pair || []).join("  +  ")}</Text>
                      <View style={[styles.sevBadge, { backgroundColor: `${sev.color}18` }]}>
                        <Text style={[styles.sevBadgeText, { color: sev.color }]}>{sev.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.interDesc}>{it.description}</Text>
                    {it.advice ? (
                      <View style={styles.adviceRow}>
                        <Feather name="info" size={13} color={MUTED} />
                        <Text style={styles.adviceText}>{it.advice}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}

            {result.foodWarnings && result.foodWarnings.length > 0 && (
              <View style={styles.foodCard}>
                <Text style={styles.foodTitle}>Food & lifestyle notes</Text>
                {result.foodWarnings.map((f, i) => (
                  <View key={i} style={styles.foodRow}>
                    <Feather name="coffee" size={13} color="#F59E0B" />
                    <Text style={styles.foodText}>{f}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.disclaimer}>
              This is an informational screening, not medical advice. Always confirm with your doctor or pharmacist before changing any medication.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBg: {
    paddingHorizontal: 20, paddingBottom: 24, gap: 4,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: "hidden",
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: WHITE, flex: 1, textAlign: "center" },
  headerSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", textAlign: "center" },

  card: { backgroundColor: WHITE, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: BORDER, gap: 6 },
  cardTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: FOREGROUND },
  cardHint: { fontSize: 13, fontFamily: "Inter_400Regular", color: MUTED, marginBottom: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: `${PURPLE}12`, borderColor: `${PURPLE}30`, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipText: { color: PURPLE, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyHint: { color: "#94a3b8", fontSize: 13, fontFamily: "Inter_400Regular" },
  addRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: FOREGROUND, fontFamily: "Inter_400Regular" },
  addBtn: { width: 46, height: 46, borderRadius: 12, backgroundColor: PURPLE, alignItems: "center", justifyContent: "center" },

  checkBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: PURPLE, paddingVertical: 16, borderRadius: 16, marginTop: 16 },
  checkBtnText: { color: WHITE, fontSize: 16, fontFamily: "Inter_700Bold" },

  offlineNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 12, padding: 12, marginTop: 12 },
  offlineNoteText: { color: "#92400E", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  offlineTag: { alignSelf: "flex-start", color: MUTED, fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 8 },

  summaryCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  summaryText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: FOREGROUND, lineHeight: 20 },

  clearCard: { alignItems: "center", paddingVertical: 36, gap: 4 },
  clearTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: FOREGROUND },
  clearSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: MUTED },

  interCard: { backgroundColor: WHITE, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, borderLeftWidth: 5, marginBottom: 12, gap: 8 },
  interHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  interPair: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold", color: FOREGROUND },
  sevBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  sevBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  interDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#334155", lineHeight: 20 },
  adviceRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10 },
  adviceText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: MUTED, lineHeight: 18 },

  foodCard: { backgroundColor: WHITE, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, marginTop: 4, marginBottom: 12, gap: 8 },
  foodTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: FOREGROUND, marginBottom: 2 },
  foodRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  foodText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#334155", lineHeight: 18 },

  disclaimer: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94a3b8", lineHeight: 18, marginTop: 8, textAlign: "center" },
});
