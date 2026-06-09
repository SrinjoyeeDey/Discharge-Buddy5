import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";

/**
 * Global "you are offline" banner. Mounted once near the navigation root so it
 * appears on every screen. Slides down when connectivity drops and tucks away
 * when it returns — emergency and cached data remain usable underneath.
 */
export function OfflineBanner() {
  const { isOnline } = useApp();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-80)).current;
  const topInset = Platform.OS === "web" ? 0 : insets.top;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOnline ? -80 : 0,
      duration: 260,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [isOnline, translateY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { paddingTop: topInset + 8, transform: [{ translateY }] }]}
    >
      <View style={styles.pill}>
        <Feather name="wifi-off" size={14} color="#FFFFFF" />
        <Text style={styles.text}>Offline — showing saved info</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1E293B",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  text: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
