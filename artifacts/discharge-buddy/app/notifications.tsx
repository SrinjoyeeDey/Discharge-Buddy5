import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform, ScrollView, StyleSheet, Switch, View, Pressable,  } from 'react-native';
import { TranslateText as Text } from '@/components/TranslateText';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";

const TEAL = "#0891b2";
const TEAL_DARK = "#0c4a6e";
const WHITE = "#ffffff";

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  
  const { 
    notifications, 
    clearAllNotifications, 
    markNotificationRead,
    doseAlerts,
    setDoseAlerts,
    appAlerts,
    setAppAlerts
  } = useApp();

  const unreadCount = notifications.flatMap(g => g.items).filter(i => !i.read).length;
  const hasNotifs = notifications.some(g => g.items.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 32 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topInset + 12 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={WHITE} />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badgeChip}>
              <Text style={styles.badgeText}>{unreadCount} new</Text>
            </View>
          )}
        </View>
        <View style={styles.waveDivider} />

        {/* Toggle settings */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <View style={[styles.toggleIcon, { backgroundColor: `${TEAL}15` }]}>
                <Feather name="bell" size={18} color={TEAL} />
              </View>
              <View>
                <Text style={styles.toggleTitle}>Dose Reminders</Text>
                <Text style={styles.toggleSub}>Get alerted before each dose</Text>
              </View>
            </View>
            <Switch
              value={doseAlerts}
              onValueChange={setDoseAlerts}
              trackColor={{ false: "#e2e8f0", true: `${TEAL}60` }}
              thumbColor={doseAlerts ? TEAL : "#cbd5e1"}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <View style={[styles.toggleIcon, { backgroundColor: "#8b5cf620" }]}>
                <Feather name="smartphone" size={18} color="#8b5cf6" />
              </View>
              <View>
                <Text style={styles.toggleTitle}>App Notifications</Text>
                <Text style={styles.toggleSub}>Updates, tips and alerts</Text>
              </View>
            </View>
            <Switch
              value={appAlerts}
              onValueChange={setAppAlerts}
              trackColor={{ false: "#e2e8f0", true: "#8b5cf640" }}
              thumbColor={appAlerts ? "#8b5cf6" : "#cbd5e1"}
            />
          </View>
        </View>

        {/* Notification groups */}
        {notifications.map((group, gi) => (
          <View key={gi} style={styles.group}>
            <Text style={styles.groupLabel}>{group.group}</Text>
            {group.items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => markNotificationRead(item.id)}
                style={({ pressed }) => [
                  styles.notifRow, 
                  !item.read && styles.notifRowUnread,
                  pressed && { opacity: 0.7 }
                ]}
              >
                <View style={[styles.notifIcon, { backgroundColor: `${item.color}15` }]}>
                  <Feather name={item.icon} size={18} color={item.color} />
                </View>
                <View style={styles.notifContent}>
                  <View style={styles.notifTitleRow}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <View style={styles.timeRow}>
                      <Text style={styles.notifTime}>{item.time}</Text>
                      {!item.read && <View style={[styles.unreadDot, { backgroundColor: item.color }]} />}
                    </View>
                  </View>
                  <Text style={styles.notifBody}>{item.body}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}

        {!hasNotifs && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <Feather name="bell-off" size={32} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySub}>No new notifications at the moment.</Text>
          </View>
        )}

        {/* Clear all */}
        {hasNotifs && (
          <Pressable 
            style={({ pressed }) => [
              styles.clearBtn,
              pressed && { opacity: 0.6 }
            ]} 
            onPress={clearAllNotifications}
          >
            <Feather name="trash-2" size={16} color="#ef4444" />
            <Text style={styles.clearText}>Clear all notifications</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: TEAL_DARK,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
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
    flex: 1,
    color: WHITE,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  badgeChip: {
    backgroundColor: "#fbbf24",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1a1a1a" },

  waveDivider: {
    height: 28,
    backgroundColor: TEAL_DARK,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 8,
  },

  toggleCard: {
    marginHorizontal: 18,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0f172a" },
  toggleSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748b", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginHorizontal: 12 },

  group: { marginBottom: 4 },
  groupLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  notifRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    position: "relative",
  },
  notifRowUnread: {
    backgroundColor: "#f0f9ff",
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  notifTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0f172a" },
  notifTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  notifBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#475569", lineHeight: 18 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  clearText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#ef4444" },
  
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0f172a", marginBottom: 8 },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748b", textAlign: "center" },
});
