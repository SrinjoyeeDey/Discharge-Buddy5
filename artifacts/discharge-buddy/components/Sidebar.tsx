import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Animated, Platform, ScrollView, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View, Image } from 'react-native';
import { TranslateText as Text } from '@/components/TranslateText';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useSidebar } from "@/context/SidebarContext";
import { AnimPressable } from "@/components/AnimPressable";
import { ShareLinkQRModal } from "@/components/ShareLinkQRModal";

const TEAL = "#0891b2";
const TEAL_DARK = "#0c4a6e";
const WHITE = "#ffffff";

const MENU_ITEMS = [
  { icon: "user" as const, label: "View Profile", route: "/profile" },
  { icon: "calendar" as const, label: "My Schedule", route: "/(tabs)/schedule" },
  { icon: "bell" as const, label: "Notifications", route: "/notifications" },
  { icon: "activity" as const, label: "Activity Log", route: "/(tabs)/symptoms" },
  { icon: "droplet" as const, label: "Blood Network", route: "/blood-network" },
  { icon: "shield" as const, label: "Drug Interaction Checker", route: "/drug-checker" },
  { icon: "wind" as const, label: "Meditation Timer", route: "/meditation" },
  { icon: "settings" as const, label: "Settings", route: "/settings" },
  { icon: "help-circle" as const, label: "Help & Feedback", route: "/help" },
];


export function Sidebar() {
  const { isOpen, close, translateX, overlayOpacity, SIDEBAR_WIDTH } = useSidebar();
  const { user, role, setRole, setUser } = useApp();
  const [showLinkQr, setShowLinkQr] = useState(false);
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const handleNav = (route: string | null) => {
    close();
    if (route) {
      setTimeout(() => router.push(route as any), 300);
    }
  };

  const handleLogout = () => {
    close();
    setTimeout(() => {
      setRole(null as any);
      setUser(null as any);
      router.replace("/login");
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={close}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.45)", opacity: overlayOpacity },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          { width: SIDEBAR_WIDTH, transform: [{ translateX }] },
        ]}
      >
        {/* Profile header */}
        <View style={[styles.profileHeader, { paddingTop: topInset + 10 }]}>
          <View style={styles.headerTopRow}>
            <AnimPressable onPress={close} style={styles.closeBtn}>
              <Feather name="x" size={24} color={WHITE} />
            </AnimPressable>
            <View style={{ flex: 1 }} />
          </View>

          <AnimPressable onPress={() => handleNav("/profile")} style={styles.avatarContainer}>
            <View style={styles.avatarLarge}>
              {user?.avatar || user?.profilePicture ? (
                <Image source={{ uri: user?.avatar || user?.profilePicture }} style={{ width: 84, height: 84, borderRadius: 42 }} />
              ) : (
                <Feather name={role === "caregiver" ? "users" : "user"} size={32} color={TEAL} />
              )}
            </View>
            <View style={styles.editBadge}>
              <Feather name="edit-2" size={10} color={WHITE} />
            </View>
          </AnimPressable>

          <Text style={styles.profileName} numberOfLines={1}>{user?.name ?? "User"}</Text>
          <Text style={styles.profileRole}>{role === "caregiver" ? "Caregiver" : "Patient"}</Text>
        </View>

        {/* Scrollable menu area */}
        <ScrollView 
          style={styles.menuScroll} 
          contentContainerStyle={styles.menuScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {MENU_ITEMS.map((item, i) => (
            <AnimPressable
              key={i}
              style={styles.menuItem}
              onPress={() => handleNav(item.route)}
            >
              <View style={styles.menuIconWrapper}>
                <Feather name={item.icon} size={18} color={TEAL} />
              </View>
              <Text style={styles.menuLabel} numberOfLines={1}>{item.label}</Text>
              <Feather name="chevron-right" size={14} color="#94a3b8" />
            </AnimPressable>
          ))}

          {role === 'patient' ? (
            <AnimPressable
              style={[styles.menuItem, styles.qrMenuItem]}
              onPress={() => setShowLinkQr(true)}
            >
              <View style={styles.menuIconWrapper}>
                <Feather name="share-2" size={18} color={TEAL} />
              </View>
              <Text style={styles.menuLabel} numberOfLines={1}>Share Link QR</Text>
              <Feather name="chevron-right" size={14} color="#94a3b8" />
            </AnimPressable>
          ) : null}
        </ScrollView>

        {/* Logout button at fixed bottom */}
        <View style={[styles.logoutArea, { paddingBottom: bottomInset + 16 }]}>
          <AnimPressable style={styles.logoutBtn} onPress={handleLogout}>
            <Feather name="log-out" size={18} color={WHITE} />
            <Text style={styles.logoutText}>Log out</Text>
          </AnimPressable>
        </View>
      </Animated.View>
      <ShareLinkQRModal visible={showLinkQr} onClose={() => setShowLinkQr(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: WHITE,
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 10, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 20,
    overflow: "hidden",
  },

  profileHeader: {
    backgroundColor: TEAL_DARK,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarContainer: {
    alignSelf: "center",
    position: "relative",
    marginBottom: 14,
  },
  avatarLarge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: WHITE,
  },
  profileName: {
    color: WHITE,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 2,
  },
  profileRole: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },

  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 16,
    marginBottom: 6,
    backgroundColor: "#f8fafc",
  },
  qrMenuItem: {
    marginTop: 8,
    backgroundColor: "#EFF6FF",
  },
  menuIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f0f9ff",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#334155",
  },

  logoutArea: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: WHITE,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: TEAL_DARK,
    paddingVertical: 16,
    borderRadius: 16,
  },
  logoutText: {
    color: WHITE,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
