import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useState, useCallback } from "react";
import {
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
    Alert,
    TextInput,
    ActivityIndicator,
} from "react-native";
import { TranslateText as Text } from "@/components/TranslateText";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { AnimPressable } from "@/components/AnimPressable";

const TEAL = "#0891b2";
const TEAL_DARK = "#0c4a6e";
const WHITE = "#ffffff";
const PURPLE = "#6C47FF";

interface FamilyLink {
    id: string;
    patientUserId: string;
    familyUserId: string;
    relationship: string;
    status: "pending" | "accepted" | "rejected";
    createdAt: string;
    acceptedAt?: string;
}

export default function LinkPatientScreen() {
    const insets = useSafeAreaInsets();
    const { api, user } = useApp();
    const topInset = Platform.OS === "web" ? 67 : insets.top;

    const [familyEmail, setFamilyEmail] = useState("");
    const [relationship, setRelationship] = useState("family");
    const [loading, setLoading] = useState(false);
    const [myLinks, setMyLinks] = useState<{ linksAsPatient: FamilyLink[]; linksAsFamily: FamilyLink[] } | null>(null);
    const [loadingLinks, setLoadingLinks] = useState(true);

    const loadMyLinks = useCallback(async () => {
        try {
            setLoadingLinks(true);
            const links = await api.getMyFamilyLinks();
            setMyLinks(links);
        } catch (err) {
            console.error("Failed to load links:", err);
        } finally {
            setLoadingLinks(false);
        }
    }, [api]);

    useFocusEffect(
        useCallback(() => {
            loadMyLinks();
        }, [loadMyLinks])
    );

    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleInviteFamily = async () => {
        if (!familyEmail.trim()) {
            Alert.alert("Error", "Please enter a family member's email address");
            return;
        }

        if (!isValidEmail(familyEmail)) {
            Alert.alert("Error", "Please enter a valid email address");
            return;
        }

        try {
            setLoading(true);
            const result = await api.linkPatientByEmail(familyEmail, relationship);

            Alert.alert("Success", "Invitation sent! They'll see a notification when they accept.");
            setFamilyEmail("");
            setRelationship("family");

            // Reload links
            await loadMyLinks();
        } catch (err: any) {
            console.error("Failed to send invite:", err);
            Alert.alert(
                "Error",
                err.message || "Failed to send invitation. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveLink = async (linkId: string) => {
        Alert.alert("Remove Link", "Are you sure you want to remove this family link?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Remove",
                onPress: async () => {
                    try {
                        await api.removeFamilyLink(linkId);
                        await loadMyLinks();
                        Alert.alert("Success", "Family link removed");
                    } catch (err) {
                        Alert.alert("Error", "Failed to remove link");
                    }
                },
                style: "destructive",
            },
        ]);
    };

    const pendingLinks = myLinks?.linksAsPatient.filter((l) => l.status === "pending") || [];
    const acceptedLinks = myLinks?.linksAsPatient.filter((l) => l.status === "accepted") || [];

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={{ flex: 1, backgroundColor: WHITE }}>
                {/* Header */}
                <LinearGradient
                    colors={[TEAL_DARK, TEAL, "#06b6d4"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.header, { paddingTop: topInset + 20 }]}
                >
                    <View style={styles.decor1} />
                    <View style={styles.decor2} />
                    <View style={styles.headerRow}>
                        <AnimPressable onPress={() => router.back()} style={styles.backBtn}>
                            <Feather name="arrow-left" size={20} color={WHITE} />
                        </AnimPressable>
                        <View style={styles.headerCenter}>
                            <Text style={styles.headerTitle}>Link Family Member</Text>
                        </View>
                        <View style={{ width: 36 }} />
                    </View>
                    <Text style={styles.headerSub}>Share your emergency updates</Text>
                </LinearGradient>

                <ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Invite Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>👨‍👩‍👧 Invite Family Member</Text>

                        <View style={styles.card}>
                            <Text style={styles.inputLabel}>Email Address</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="family@example.com"
                                placeholderTextColor="#cbd5e1"
                                value={familyEmail}
                                onChangeText={setFamilyEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                editable={!loading}
                            />

                            <Text style={styles.inputLabel}>Relationship</Text>
                            <View style={styles.relationshipGrid}>
                                {["family", "caregiver", "spouse", "parent", "child"].map((rel) => (
                                    <TouchableOpacity
                                        key={rel}
                                        style={[
                                            styles.relationshipBtn,
                                            relationship === rel && styles.relationshipBtnActive,
                                        ]}
                                        onPress={() => setRelationship(rel)}
                                        disabled={loading}
                                    >
                                        <Text
                                            style={[
                                                styles.relationshipBtnText,
                                                relationship === rel && styles.relationshipBtnTextActive,
                                            ]}
                                        >
                                            {rel.charAt(0).toUpperCase() + rel.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
                                onPress={handleInviteFamily}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={WHITE} />
                                ) : (
                                    <>
                                        <Feather name="send" size={16} color={WHITE} />
                                        <Text style={styles.sendBtnText}>Send Invitation</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <View style={styles.infoBanner}>
                                <Feather name="info" size={14} color={PURPLE} />
                                <Text style={styles.infoBannerText}>
                                    Once they accept, they'll be able to see your real-time status updates.
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Active Links Section */}
                    {acceptedLinks.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>✅ Connected Family</Text>
                            <View style={styles.linksList}>
                                {acceptedLinks.map((link) => (
                                    <View key={link.id} style={styles.linkItem}>
                                        <View style={styles.linkIcon}>
                                            <Feather name="check-circle" size={20} color="#10b981" />
                                        </View>
                                        <View style={styles.linkInfo}>
                                            <Text style={styles.linkTitle}>{link.relationship.toUpperCase()}</Text>
                                            <Text style={styles.linkSubtitle}>Sharing dashboard access</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => handleRemoveLink(link.id)}
                                            style={styles.removeBtn}
                                        >
                                            <Feather name="trash-2" size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Pending Links Section */}
                    {pendingLinks.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>⏳ Pending Invitations</Text>
                            <View style={styles.linksList}>
                                {pendingLinks.map((link) => (
                                    <View key={link.id} style={styles.linkItem}>
                                        <View style={[styles.linkIcon, { backgroundColor: "#fff7ed" }]}>
                                            <Feather name="clock" size={20} color="#f59e0b" />
                                        </View>
                                        <View style={styles.linkInfo}>
                                            <Text style={styles.linkTitle}>{link.relationship.toUpperCase()}</Text>
                                            <Text style={styles.linkSubtitle}>Awaiting acceptance</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => handleRemoveLink(link.id)}
                                            style={styles.removeBtn}
                                        >
                                            <Feather name="x" size={18} color="#cbd5e1" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Empty State */}
                    {loadingLinks ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={TEAL} />
                        </View>
                    ) : acceptedLinks.length === 0 && pendingLinks.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIcon}>
                                <Feather name="users" size={40} color="#cbd5e1" />
                            </View>
                            <Text style={styles.emptyStateTitle}>No Family Links Yet</Text>
                            <Text style={styles.emptyStateText}>
                                Start by inviting a family member using their email address above.
                            </Text>
                        </View>
                    ) : null}

                    {/* Help Section */}
                    <View style={styles.helpSection}>
                        <View style={styles.helpItem}>
                            <View style={[styles.helpNum, { backgroundColor: `${TEAL}20` }]}>
                                <Text style={[styles.helpNumText, { color: TEAL }]}>1</Text>
                            </View>
                            <View style={styles.helpContent}>
                                <Text style={styles.helpTitle}>Enter Email</Text>
                                <Text style={styles.helpDesc}>Add a family member's email address</Text>
                            </View>
                        </View>

                        <View style={styles.helpItem}>
                            <View style={[styles.helpNum, { backgroundColor: "#f3e8ff" }]}>
                                <Text style={[styles.helpNumText, { color: PURPLE }]}>2</Text>
                            </View>
                            <View style={styles.helpContent}>
                                <Text style={styles.helpTitle}>Send Invite</Text>
                                <Text style={styles.helpDesc}>They'll receive an email invitation</Text>
                            </View>
                        </View>

                        <View style={styles.helpItem}>
                            <View style={[styles.helpNum, { backgroundColor: "#fef2f2" }]}>
                                <Text style={[styles.helpNumText, { color: "#ef4444" }]}>3</Text>
                            </View>
                            <View style={styles.helpContent}>
                                <Text style={styles.helpTitle}>Share Updates</Text>
                                <Text style={styles.helpDesc}>Post status updates they can see</Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 20,
        paddingBottom: 24,
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        overflow: "hidden",
    },
    decor1: {
        position: "absolute",
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: "rgba(255,255,255,0.05)",
        top: -60,
        right: -50,
    },
    decor2: {
        position: "absolute",
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: "rgba(255,255,255,0.04)",
        bottom: -20,
        left: -20,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "rgba(255,255,255,0.2)",
        alignItems: "center",
        justifyContent: "center",
    },
    headerCenter: {
        alignItems: "center",
        flex: 1,
    },
    headerTitle: {
        fontSize: 22,
        fontFamily: "Inter_700Bold",
        color: WHITE,
    },
    headerSub: {
        fontSize: 12,
        fontFamily: "Inter_400Regular",
        color: "rgba(255,255,255,0.8)",
        textAlign: "center",
        marginTop: 8,
    },
    content: {
        padding: 16,
        gap: 20,
        paddingBottom: 40,
    },
    section: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: "Inter_700Bold",
        color: "#1e293b",
        marginLeft: 4,
    },
    card: {
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1.5,
        borderColor: "#e2e8f0",
        gap: 16,
    },
    inputLabel: {
        fontSize: 11,
        fontFamily: "Inter_600SemiBold",
        color: "#64748b",
        textTransform: "uppercase",
    },
    input: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        fontFamily: "Inter_400Regular",
        color: "#1e293b",
    },
    relationshipGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 4,
    },
    relationshipBtn: {
        flex: 1,
        minWidth: "30%",
        backgroundColor: "#f8fafc",
        borderWidth: 1.5,
        borderColor: "#e2e8f0",
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center",
    },
    relationshipBtnActive: {
        backgroundColor: TEAL,
        borderColor: TEAL,
    },
    relationshipBtnText: {
        fontSize: 12,
        fontFamily: "Inter_600SemiBold",
        color: "#64748b",
    },
    relationshipBtnTextActive: {
        color: WHITE,
    },
    sendBtn: {
        backgroundColor: TEAL,
        borderRadius: 12,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 8,
    },
    sendBtnDisabled: {
        opacity: 0.6,
    },
    sendBtnText: {
        color: WHITE,
        fontSize: 14,
        fontFamily: "Inter_600SemiBold",
    },
    infoBanner: {
        backgroundColor: "#f3e8ff",
        padding: 12,
        borderRadius: 10,
        flexDirection: "row",
        gap: 8,
        alignItems: "flex-start",
    },
    infoBannerText: {
        flex: 1,
        fontSize: 12,
        fontFamily: "Inter_400Regular",
        color: PURPLE,
        lineHeight: 16,
    },
    linksList: {
        gap: 10,
    },
    linkItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: WHITE,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        gap: 12,
    },
    linkIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#f0fdf4",
        alignItems: "center",
        justifyContent: "center",
    },
    linkInfo: {
        flex: 1,
    },
    linkTitle: {
        fontSize: 12,
        fontFamily: "Inter_700Bold",
        color: "#1e293b",
        textTransform: "uppercase",
    },
    linkSubtitle: {
        fontSize: 11,
        fontFamily: "Inter_400Regular",
        color: "#94a3b8",
        marginTop: 2,
    },
    removeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#fef2f2",
        alignItems: "center",
        justifyContent: "center",
    },
    emptyState: {
        alignItems: "center",
        paddingVertical: 40,
        gap: 12,
    },
    emptyIcon: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: "#f1f5f9",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    emptyStateTitle: {
        fontSize: 16,
        fontFamily: "Inter_600SemiBold",
        color: "#1e293b",
    },
    emptyStateText: {
        fontSize: 13,
        fontFamily: "Inter_400Regular",
        color: "#64748b",
        textAlign: "center",
        paddingHorizontal: 20,
    },
    loadingContainer: {
        paddingVertical: 40,
        alignItems: "center",
    },
    helpSection: {
        gap: 12,
        marginTop: 16,
    },
    helpItem: {
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-start",
    },
    helpNum: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    helpNumText: {
        fontSize: 16,
        fontFamily: "Inter_700Bold",
    },
    helpContent: {
        flex: 1,
        paddingTop: 4,
    },
    helpTitle: {
        fontSize: 13,
        fontFamily: "Inter_600SemiBold",
        color: "#1e293b",
    },
    helpDesc: {
        fontSize: 12,
        fontFamily: "Inter_400Regular",
        color: "#64748b",
        marginTop: 2,
    },
});
