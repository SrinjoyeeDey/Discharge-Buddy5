import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from "react-native";
import { TranslateText as Text } from "@/components/TranslateText";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimPressable } from "@/components/AnimPressable";
import { useApp, type BloodDonor, type BloodRequestItem, type BloodType, type NearbyQuery } from "@/context/AppContext";
import { MockProvider } from "@/context/MockProvider";
import { cacheGet, cacheSet, CACHE_KEYS } from "@/utils/offlineCache";

const RED = "#E11D48";
const RED_DARK = "#9F1239";
const WHITE = "#FFFFFF";
const BACKGROUND = "#FFF1F2";
const FOREGROUND = "#1E1B4B";
const MUTED = "#6B7280";
const BORDER = "#FBCFE8";

const BLOOD_TYPES: BloodType[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const URGENCY = {
  critical: { color: "#DC2626", label: "Critical" },
  normal: { color: "#F59E0B", label: "Needed" },
  low: { color: "#10B981", label: "Routine" },
};

type Tab = "requests" | "donors" | "profile";

const offlineApi = new MockProvider();

export default function BloodNetworkScreen() {
  const insets = useSafeAreaInsets();
  const { api, user, isOnline } = useApp();
  const topInset = Platform.OS === "web" ? 0 : insets.top;

  const [tab, setTab] = useState<Tab>("requests");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [usedOffline, setUsedOffline] = useState(false);

  const [donors, setDonors] = useState<BloodDonor[]>([]);
  const [requests, setRequests] = useState<BloodRequestItem[]>([]);
  const [filterType, setFilterType] = useState<BloodType | null>(null);

  const [profile, setProfile] = useState<BloodDonor | null>(null);
  const [form, setForm] = useState({ name: "", bloodType: "O+" as BloodType, phone: "", area: "", isAvailable: true });

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqForm, setReqForm] = useState({ patientName: "", bloodType: "O+" as BloodType, unitsNeeded: "1", hospital: "", area: "", contactPhone: "", urgency: "normal" as "low" | "normal" | "critical", note: "" });
  const [saving, setSaving] = useState(false);

  const nearbyQuery = (extra?: Partial<NearbyQuery>): NearbyQuery => ({
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    ...extra,
  });

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getNearbyBloodRequests(nearbyQuery());
      setRequests(data);
      setUsedOffline(false);
      cacheSet(CACHE_KEYS.bloodRequests, data);
    } catch {
      const cached = await cacheGet<BloodRequestItem[]>(CACHE_KEYS.bloodRequests);
      setRequests(cached?.data ?? (await offlineApi.getNearbyBloodRequests(nearbyQuery())));
      setUsedOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const loadDonors = async () => {
    setLoading(true);
    try {
      const data = await api.getNearbyDonors(nearbyQuery(filterType ? { bloodType: filterType } : undefined));
      setDonors(data);
      setUsedOffline(false);
      cacheSet(CACHE_KEYS.donors, data);
    } catch {
      const cached = await cacheGet<BloodDonor[]>(CACHE_KEYS.donors);
      setDonors(cached?.data ?? (await offlineApi.getNearbyDonors(filterType ? { bloodType: filterType } : {})));
      setUsedOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      const p = await api.getMyDonorProfile();
      setProfile(p);
      if (p) setForm({ name: p.name, bloodType: p.bloodType, phone: p.phone, area: p.area ?? "", isAvailable: p.isAvailable });
      else if (user?.name) setForm((f) => ({ ...f, name: user.name }));
    } catch {
      if (user?.name) setForm((f) => ({ ...f, name: user.name }));
    }
  };

  useEffect(() => { loadProfile(); }, []);
  useEffect(() => {
    if (tab === "requests") loadRequests();
    if (tab === "donors") loadDonors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, coords]);
  useEffect(() => {
    if (tab === "donors") loadDonors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const useMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location off", "Enable location to sort donors and requests by distance.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert("Location unavailable", "Could not get your location right now.");
    }
  };

  const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);

  const saveProfile = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      Alert.alert("Missing info", "Please enter your name and phone number.");
      return;
    }
    setSaving(true);
    try {
      const p = await api.upsertDonorProfile({
        name: form.name.trim(),
        bloodType: form.bloodType,
        phone: form.phone.trim(),
        area: form.area.trim() || undefined,
        isAvailable: form.isAvailable,
        ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
      });
      setProfile(p);
      Alert.alert("Saved", form.isAvailable ? "You're now visible to nearby blood requests." : "Your profile is saved. You're marked unavailable.");
    } catch (e: any) {
      Alert.alert("Could not save", isOnline ? (e?.message || "Please try again.") : "You appear to be offline. Try again when connected.");
    } finally {
      setSaving(false);
    }
  };

  const submitRequest = async () => {
    if (!reqForm.patientName.trim() || !reqForm.hospital.trim() || !reqForm.contactPhone.trim()) {
      Alert.alert("Missing info", "Please fill patient name, hospital and a contact number.");
      return;
    }
    setSaving(true);
    try {
      await api.createBloodRequest({
        patientName: reqForm.patientName.trim(),
        bloodType: reqForm.bloodType,
        unitsNeeded: Math.max(1, parseInt(reqForm.unitsNeeded) || 1),
        hospital: reqForm.hospital.trim(),
        area: reqForm.area.trim() || undefined,
        urgency: reqForm.urgency,
        contactPhone: reqForm.contactPhone.trim(),
        note: reqForm.note.trim() || undefined,
        ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
      });
      setShowRequestModal(false);
      setReqForm({ patientName: "", bloodType: "O+", unitsNeeded: "1", hospital: "", area: "", contactPhone: "", urgency: "normal", note: "" });
      loadRequests();
      Alert.alert("Request posted", "Nearby donors can now see your request.");
    } catch (e: any) {
      Alert.alert("Could not post", isOnline ? (e?.message || "Please try again.") : "You appear to be offline. Your request needs a connection to broadcast.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: BACKGROUND }]}>
      <LinearGradient
        colors={[RED_DARK, RED, "#FB7185"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.headerBg, { paddingTop: topInset + 20 }]}
      >
        <View style={styles.headerTop}>
          <AnimPressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={WHITE} />
          </AnimPressable>
          <Text style={styles.headerTitle}>Blood Network</Text>
          <AnimPressable onPress={useMyLocation} style={styles.backBtn}>
            <Feather name={coords ? "map-pin" : "navigation"} size={18} color={WHITE} />
          </AnimPressable>
        </View>
        <Text style={styles.headerSub}>{coords ? "Showing your area" : "Find donors & requests near you"}</Text>

        <View style={styles.tabRow}>
          {(["requests", "donors", "profile"] as Tab[]).map((tb) => (
            <TouchableOpacity key={tb} onPress={() => setTab(tb)} style={[styles.tabBtn, tab === tb && styles.tabBtnActive]} activeOpacity={0.8}>
              <Text style={[styles.tabText, tab === tb && styles.tabTextActive]}>
                {tb === "requests" ? "Requests" : tb === "donors" ? "Donors" : "My Profile"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        {usedOffline && tab !== "profile" && (
          <View style={styles.offlineNote}>
            <Feather name="wifi-off" size={14} color="#92400E" />
            <Text style={styles.offlineNoteText}>Offline — showing saved community data.</Text>
          </View>
        )}

        {tab === "requests" && (
          <>
            <TouchableOpacity style={styles.newReqBtn} onPress={() => setShowRequestModal(true)} activeOpacity={0.85}>
              <Feather name="plus-circle" size={18} color={WHITE} />
              <Text style={styles.newReqText}>Request Blood</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator color={RED} style={{ marginTop: 40 }} />
            ) : requests.length === 0 ? (
              <EmptyState icon="droplet" title="No active requests" sub="There are no open blood requests near you right now." />
            ) : (
              requests.map((r) => {
                const u = URGENCY[r.urgency] ?? URGENCY.normal;
                return (
                  <View key={r.id} style={[styles.reqCard, { borderLeftColor: u.color }]}>
                    <View style={styles.reqTop}>
                      <View style={styles.bloodBadge}><Text style={styles.bloodBadgeText}>{r.bloodType}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reqName}>{r.patientName}</Text>
                        <Text style={styles.reqMeta}>{r.hospital}{r.area ? ` · ${r.area}` : ""}</Text>
                      </View>
                      <View style={[styles.urgBadge, { backgroundColor: `${u.color}18` }]}>
                        <Text style={[styles.urgText, { color: u.color }]}>{u.label}</Text>
                      </View>
                    </View>
                    <View style={styles.reqBottom}>
                      <Text style={styles.reqUnits}>{r.unitsNeeded} unit{r.unitsNeeded > 1 ? "s" : ""} needed{r.distanceKm != null ? `  ·  ${r.distanceKm} km` : ""}</Text>
                      <TouchableOpacity style={styles.callBtn} onPress={() => call(r.contactPhone)}>
                        <Feather name="phone" size={14} color={WHITE} />
                        <Text style={styles.callText}>Call</Text>
                      </TouchableOpacity>
                    </View>
                    {r.note ? <Text style={styles.reqNote}>{r.note}</Text> : null}
                  </View>
                );
              })
            )}
          </>
        )}

        {tab === "donors" && (
          <>
            <Text style={styles.filterLabel}>Filter by patient's blood type (shows compatible donors)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              <TypeChip label="All" active={filterType === null} onPress={() => setFilterType(null)} />
              {BLOOD_TYPES.map((bt) => (
                <TypeChip key={bt} label={bt} active={filterType === bt} onPress={() => setFilterType(bt)} />
              ))}
            </ScrollView>

            {loading ? (
              <ActivityIndicator color={RED} style={{ marginTop: 40 }} />
            ) : donors.length === 0 ? (
              <EmptyState icon="users" title="No donors found" sub="No available donors match this filter near you." />
            ) : (
              donors.map((d) => (
                <View key={d.id} style={styles.donorCard}>
                  <View style={styles.bloodBadge}><Text style={styles.bloodBadgeText}>{d.bloodType}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.donorName}>{d.name}</Text>
                    <Text style={styles.reqMeta}>{d.area ?? d.city ?? "Nearby"}{d.distanceKm != null ? `  ·  ${d.distanceKm} km` : ""}</Text>
                  </View>
                  <TouchableOpacity style={styles.callBtn} onPress={() => call(d.phone)}>
                    <Feather name="phone" size={14} color={WHITE} />
                    <Text style={styles.callText}>Call</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}

        {tab === "profile" && (
          <View style={styles.profileCard}>
            <Text style={styles.profileTitle}>{profile ? "Your donor profile" : "Join the donor community"}</Text>
            <Text style={styles.profileSub}>Be visible to nearby people who urgently need blood.</Text>

            <Field label="FULL NAME">
              <TextInput style={styles.input} value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} placeholder="Your name" placeholderTextColor="#94a3b8" />
            </Field>

            <Text style={styles.inputLabel}>BLOOD TYPE</Text>
            <View style={styles.typeGrid}>
              {BLOOD_TYPES.map((bt) => (
                <TouchableOpacity key={bt} onPress={() => setForm((f) => ({ ...f, bloodType: bt }))} style={[styles.typeCell, form.bloodType === bt && styles.typeCellActive]}>
                  <Text style={[styles.typeCellText, form.bloodType === bt && styles.typeCellTextActive]}>{bt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Field label="PHONE">
              <TextInput style={styles.input} value={form.phone} onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))} placeholder="Contact number" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />
            </Field>
            <Field label="AREA / LOCALITY">
              <TextInput style={styles.input} value={form.area} onChangeText={(t) => setForm((f) => ({ ...f, area: t }))} placeholder="e.g. Koramangala" placeholderTextColor="#94a3b8" />
            </Field>

            <View style={styles.availRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.availTitle}>Available to donate</Text>
                <Text style={styles.availSub}>Turn off to hide from new requests.</Text>
              </View>
              <Switch value={form.isAvailable} onValueChange={(v) => setForm((f) => ({ ...f, isAvailable: v }))} trackColor={{ true: RED }} />
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={saveProfile} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color={WHITE} /> : <Text style={styles.saveText}>{profile ? "Update Profile" : "Join Community"}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={showRequestModal} transparent animationType="slide" onRequestClose={() => setShowRequestModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Request Blood</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Field label="PATIENT NAME">
                <TextInput style={styles.input} value={reqForm.patientName} onChangeText={(t) => setReqForm((f) => ({ ...f, patientName: t }))} placeholder="Patient name" placeholderTextColor="#94a3b8" />
              </Field>

              <Text style={styles.inputLabel}>BLOOD TYPE NEEDED</Text>
              <View style={styles.typeGrid}>
                {BLOOD_TYPES.map((bt) => (
                  <TouchableOpacity key={bt} onPress={() => setReqForm((f) => ({ ...f, bloodType: bt }))} style={[styles.typeCell, reqForm.bloodType === bt && styles.typeCellActive]}>
                    <Text style={[styles.typeCellText, reqForm.bloodType === bt && styles.typeCellTextActive]}>{bt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="UNITS">
                    <TextInput style={styles.input} value={reqForm.unitsNeeded} onChangeText={(t) => setReqForm((f) => ({ ...f, unitsNeeded: t.replace(/[^0-9]/g, "") }))} keyboardType="numeric" placeholder="1" placeholderTextColor="#94a3b8" />
                  </Field>
                </View>
                <View style={{ flex: 2 }}>
                  <Field label="HOSPITAL">
                    <TextInput style={styles.input} value={reqForm.hospital} onChangeText={(t) => setReqForm((f) => ({ ...f, hospital: t }))} placeholder="Hospital name" placeholderTextColor="#94a3b8" />
                  </Field>
                </View>
              </View>

              <Field label="AREA / LOCALITY">
                <TextInput style={styles.input} value={reqForm.area} onChangeText={(t) => setReqForm((f) => ({ ...f, area: t }))} placeholder="e.g. Bannerghatta Rd" placeholderTextColor="#94a3b8" />
              </Field>
              <Field label="CONTACT NUMBER">
                <TextInput style={styles.input} value={reqForm.contactPhone} onChangeText={(t) => setReqForm((f) => ({ ...f, contactPhone: t }))} keyboardType="phone-pad" placeholder="Phone donors can call" placeholderTextColor="#94a3b8" />
              </Field>

              <Text style={styles.inputLabel}>URGENCY</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                {(["low", "normal", "critical"] as const).map((u) => (
                  <TouchableOpacity key={u} onPress={() => setReqForm((f) => ({ ...f, urgency: u }))} style={[styles.urgPick, reqForm.urgency === u && { backgroundColor: URGENCY[u].color, borderColor: URGENCY[u].color }]}>
                    <Text style={[styles.urgPickText, reqForm.urgency === u && { color: WHITE }]}>{URGENCY[u].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Field label="NOTE (OPTIONAL)">
                <TextInput style={[styles.input, { minHeight: 60 }]} value={reqForm.note} onChangeText={(t) => setReqForm((f) => ({ ...f, note: t }))} multiline placeholder="Any extra details" placeholderTextColor="#94a3b8" />
              </Field>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowRequestModal(false)} disabled={saving}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSave, saving && { opacity: 0.7 }]} onPress={submitRequest} disabled={saving}>
                {saving ? <ActivityIndicator color={WHITE} /> : <Text style={styles.modalSaveText}>Post Request</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TypeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.typeChip, active && styles.typeChipActive]}>
      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      {children}
    </View>
  );
}

function EmptyState({ icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Feather name={icon} size={28} color={RED} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBg: { paddingHorizontal: 20, paddingBottom: 16, gap: 6, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: "hidden" },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: WHITE },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)" },
  tabRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, padding: 4, marginTop: 10 },
  tabBtn: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 999 },
  tabBtnActive: { backgroundColor: WHITE },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.9)" },
  tabTextActive: { color: RED },

  offlineNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 12, padding: 10, marginBottom: 12 },
  offlineNoteText: { color: "#92400E", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },

  newReqBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: RED, paddingVertical: 14, borderRadius: 16, marginBottom: 16 },
  newReqText: { color: WHITE, fontSize: 15, fontFamily: "Inter_700Bold" },

  bloodBadge: { width: 48, height: 48, borderRadius: 14, backgroundColor: `${RED}12`, alignItems: "center", justifyContent: "center" },
  bloodBadgeText: { color: RED, fontSize: 16, fontFamily: "Inter_700Bold" },

  reqCard: { backgroundColor: WHITE, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: BORDER, borderLeftWidth: 5, marginBottom: 12, gap: 12 },
  reqTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  reqName: { fontSize: 16, fontFamily: "Inter_700Bold", color: FOREGROUND },
  reqMeta: { fontSize: 13, fontFamily: "Inter_400Regular", color: MUTED, marginTop: 2 },
  urgBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  urgText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  reqBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reqUnits: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#334155" },
  reqNote: { fontSize: 13, fontFamily: "Inter_400Regular", color: MUTED, lineHeight: 18, fontStyle: "italic" },
  callBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#10B981", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  callText: { color: WHITE, fontSize: 13, fontFamily: "Inter_700Bold" },

  filterLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: MUTED, marginBottom: 8 },
  typeChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER },
  typeChipActive: { backgroundColor: RED, borderColor: RED },
  typeChipText: { fontSize: 14, fontFamily: "Inter_700Bold", color: MUTED },
  typeChipTextActive: { color: WHITE },

  donorCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: WHITE, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 10 },
  donorName: { fontSize: 16, fontFamily: "Inter_700Bold", color: FOREGROUND },

  empty: { alignItems: "center", paddingTop: 56, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: `${RED}12`, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: FOREGROUND },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: MUTED, textAlign: "center", paddingHorizontal: 30, lineHeight: 20 },

  profileCard: { backgroundColor: WHITE, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: BORDER },
  profileTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: FOREGROUND },
  profileSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: MUTED, marginTop: 2, marginBottom: 16 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#94a3b8", marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: "#F1F5F9", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: FOREGROUND, fontFamily: "Inter_400Regular" },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  typeCell: { width: 56, paddingVertical: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  typeCellActive: { backgroundColor: `${RED}15`, borderColor: RED },
  typeCellText: { fontSize: 15, fontFamily: "Inter_700Bold", color: MUTED },
  typeCellTextActive: { color: RED },
  availRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18, marginTop: 2 },
  availTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: FOREGROUND },
  availSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED, marginTop: 2 },
  saveBtn: { backgroundColor: RED, paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  saveText: { color: WHITE, fontSize: 16, fontFamily: "Inter_700Bold" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: WHITE, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "92%" },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", marginBottom: 14 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: FOREGROUND, marginBottom: 16 },
  urgPick: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "transparent" },
  urgPickText: { fontSize: 13, fontFamily: "Inter_700Bold", color: MUTED },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 15, alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 14 },
  modalCancelText: { color: "#64748b", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  modalSave: { flex: 2, paddingVertical: 15, alignItems: "center", backgroundColor: RED, borderRadius: 14 },
  modalSaveText: { color: WHITE, fontFamily: "Inter_700Bold", fontSize: 15 },
});
