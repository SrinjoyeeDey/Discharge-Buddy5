import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import {
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
    Alert,
    ActivityIndicator,
    Modal,
    Share,
} from "react-native";
import { TranslateText as Text } from "@/components/TranslateText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import { useApp } from "@/context/AppContext";
import { AnimPressable } from "@/components/AnimPressable";

const TEAL = "#0891b2";
const TEAL_DARK = "#0c4a6e";
const WHITE = "#ffffff";
const ACCENT = "#00B894";

interface MedicalCard {
    id: string;
    patientId: string;
    userId: string;
    bloodType?: string;
    allergies?: string;
    diseases?: string;
    currentMedications?: Array<{ name: string; dosage: string; frequency: string }>;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    qrCodeValue?: string;
    isPublic: boolean;
    accessedAt?: string;
    accessCount: number;
    createdAt: string;
    updatedAt: string;
}

export default function MedicalCardScreen() {
    const insets = useSafeAreaInsets();
    const { user, api } = useApp();
    const topInset = Platform.OS === "web" ? 0 : insets.top;

    const [medicalCard, setMedicalCard] = useState<MedicalCard | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrRef, setQrRef] = useState<any>(null);

    // Form state
    const [bloodType, setBloodType] = useState("");
    const [allergies, setAllergies] = useState("");
    const [diseases, setDiseases] = useState("");
    const [ecName, setEcName] = useState("");
    const [ecPhone, setEcPhone] = useState("");

    // Load medical card on mount
    useEffect(() => {
        loadMedicalCard();
    }, []);

    const loadMedicalCard = async () => {
        try {
            setLoading(true);
            const card = await api.getMedicalCard();
            setMedicalCard(card);

            // Initialize form with card data
            setBloodType(card.bloodType || "O+");
            setAllergies(card.allergies || "");
            setDiseases(card.diseases || "");
            setEcName(card.emergencyContactName || "");
            setEcPhone(card.emergencyContactPhone || "");
        } catch (error) {
            console.error("Failed to load medical card:", error);
            Alert.alert("Error", "Failed to load your medical card");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!bloodType.trim()) {
            Alert.alert("Required", "Please enter your blood type");
            return;
        }
        if (!ecPhone.trim()) {
            Alert.alert("Required", "Please enter an emergency contact phone");
            return;
        }

        try {
            setLoading(true);
            const updatedCard = await api.saveMedicalCard({
                bloodType: bloodType.trim(),
                allergies: allergies.trim() || undefined,
                diseases: diseases.trim() || undefined,
                emergencyContactName: ecName.trim() || undefined,
                emergencyContactPhone: ecPhone.trim(),
            });

            setMedicalCard(updatedCard);
            setEditing(false);
            Alert.alert("Success", "Your medical card has been updated");
        } catch (error) {
            console.error("Failed to save medical card:", error);
            Alert.alert("Error", "Failed to save your medical card");
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerateQR = async () => {
        Alert.alert(
            "Regenerate QR Code?",
            "This will create a new QR code. The old one will no longer work. Are you sure?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Regenerate",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const updatedCard = await api.regenerateMedicalCardQR();
                            setMedicalCard(updatedCard);
                            Alert.alert("Success", "QR code regenerated");
                        } catch (error) {
                            console.error("Failed to regenerate QR:", error);
                            Alert.alert("Error", "Failed to regenerate QR code");
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleDisableCard = async () => {
        Alert.alert(
            "Disable Medical Card?",
            "Emergency responders will no longer be able to scan your QR code. You can re-enable it anytime.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Disable",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await api.deleteMedicalCard();
                            setMedicalCard(null);
                            Alert.alert("Success", "Medical card has been disabled");
                        } catch (error) {
                            console.error("Failed to disable medical card:", error);
                            Alert.alert("Error", "Failed to disable medical card");
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleDownloadQR = async () => {
        try {
            if (!qrRef) return;

            setLoading(true);
            // Convert QR to base64 and save
            qrRef.toDataURL((data: string) => {
                if (Platform.OS === "web") {
                    // Web: download directly
                    const link = document.createElement("a");
                    link.href = `data:image/png;base64,${data}`;
                    link.download = `discharge-buddy-medical-qr-${user?.name?.replace(/\s/g, "-")}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    // Mobile: save to file system and share
                    const fileName = `medical-qr-${Date.now()}.png`;
                    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

                    FileSystem.writeAsStringAsync(fileUri, data, {
                        encoding: "base64",
                    }).then(() => {
                        Sharing.shareAsync(fileUri, {
                            mimeType: "image/png",
                            dialogTitle: "Share QR Code",
                        });
                    });
                }
                setLoading(false);
            });
        } catch (error) {
            console.error("Failed to download QR:", error);
            Alert.alert("Error", "Failed to download QR code");
            setLoading(false);
        }
    };

    const handleShareQRLink = async () => {
        if (!medicalCard?.qrCodeValue) return;

        try {
            const qrHash = medicalCard.qrCodeValue ?
                JSON.parse(medicalCard.qrCodeValue).checksum :
                "unknown";

            const baseUrl = Platform.OS === "web"
                ? window.location.origin
                : "https://discharge-buddy.com"; // Replace with actual domain

            const publicLink = `${baseUrl}/public/medical-card/${qrHash}`;

            if (Platform.OS === "web") {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(publicLink);
                    Alert.alert("Copied", "Link copied to clipboard");
                }
            } else {
                await Share.share({
                    title: "My Emergency Medical Card",
                    message: `View my emergency medical card: ${publicLink}`,
                    url: publicLink,
                });
            }
        } catch (error) {
            console.error("Failed to share QR link:", error);
            Alert.alert("Error", "Failed to share QR code");
        }
    };

    if (loading && !medicalCard) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={TEAL} />
                <Text style={styles.loadingText}>Loading your medical card...</Text>
            </View>
        );
    }

    if (!medicalCard) {
        return (
            <View style={[styles.container, styles.center]}>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>🏥</Text>
                    <Text style={styles.emptyTitle}>No Medical Card</Text>
                    <Text style={styles.emptyText}>
                        Create your first medical emergency card to allow responders quick access to critical information.
                    </Text>
                    <TouchableOpacity
                        style={styles.createButton}
                        onPress={() => {
                            setEditing(true);
                            setBloodType("O+");
                            setEcPhone("");
                        }}
                    >
                        <Text style={styles.createButtonText}>Create Medical Card</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
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
                        <Text style={styles.headerEmoji}>🏥</Text>
                        <Text style={styles.headerTitle}>Medical Card</Text>
                    </View>
                    <AnimPressable
                        onPress={() => (editing ? handleSave() : setEditing(true))}
                        style={styles.editBtn}
                        disabled={loading}
                    >
                        <Feather name={editing ? "save" : "edit-2"} size={16} color={TEAL_DARK} />
                    </AnimPressable>
                </View>
                <Text style={styles.headerSub}>
                    {editing ? "Edit your information" : "Emergency responders can access this"}
                </Text>
            </LinearGradient>

            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* QR Code Section */}
                <View style={styles.qrSection}>
                    <Text style={styles.sectionTitle}>🔲 Your QR Code</Text>
                    <View style={styles.qrContainer}>
                        {medicalCard.qrCodeValue ? (
                            <QRCode
                                ref={setQrRef}
                                value={medicalCard.qrCodeValue}
                                size={200}
                                color={TEAL_DARK}
                                backgroundColor={WHITE}
                            />
                        ) : (
                            <View style={styles.qrPlaceholder}>
                                <Text style={styles.qrPlaceholderText}>QR Code</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.qrHint}>
                        Emergency responders can scan this QR code to access your medical information instantly.
                    </Text>
                    <View style={styles.qrActions}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.secondaryBtn]}
                            onPress={handleDownloadQR}
                            disabled={loading}
                        >
                            <Feather name="download" size={16} color={TEAL} />
                            <Text style={styles.secondaryBtnText}>Download</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.secondaryBtn]}
                            onPress={handleShareQRLink}
                            disabled={loading}
                        >
                            <Feather name="share-2" size={16} color={TEAL} />
                            <Text style={styles.secondaryBtnText}>Share Link</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.secondaryBtn]}
                            onPress={handleRegenerateQR}
                            disabled={loading}
                        >
                            <Feather name="refresh-cw" size={16} color={TEAL} />
                            <Text style={styles.secondaryBtnText}>Regenerate</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Medical Information */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>💊 Medical Information</Text>

                    {editing ? (
                        <>
                            <EditField
                                label="Blood Type"
                                value={bloodType}
                                onChangeText={setBloodType}
                                placeholder="O+"
                            />
                            <EditField
                                label="Allergies"
                                value={allergies}
                                onChangeText={setAllergies}
                                placeholder="e.g., Penicillin, Nuts"
                                multiline
                            />
                            <EditField
                                label="Conditions / Diseases"
                                value={diseases}
                                onChangeText={setDiseases}
                                placeholder="e.g., Diabetes, Hypertension"
                                multiline
                            />
                        </>
                    ) : (
                        <>
                            <InfoRow label="Blood Type" value={bloodType || "—"} highlight />
                            <InfoRow label="Allergies" value={allergies || "None"} danger />
                            <InfoRow label="Conditions" value={diseases || "None"} />
                        </>
                    )}
                </View>

                {/* Emergency Contact */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>📱 Emergency Contact</Text>

                    {editing ? (
                        <>
                            <EditField
                                label="Contact Name"
                                value={ecName}
                                onChangeText={setEcName}
                                placeholder="Name"
                            />
                            <EditField
                                label="Contact Phone"
                                value={ecPhone}
                                onChangeText={setEcPhone}
                                placeholder="+1 (555) 000-0000"
                                keyboardType="phone-pad"
                            />
                        </>
                    ) : (
                        <>
                            <InfoRow label="Name" value={ecName || "Not set"} />
                            <InfoRow label="Phone" value={ecPhone || "Not set"} highlight />
                        </>
                    )}
                </View>

                {/* Access Statistics */}
                {!editing && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>📊 Access Statistics</Text>
                        <InfoRow
                            label="Times Accessed"
                            value={medicalCard.accessCount?.toString() || "0"}
                        />
                        <InfoRow
                            label="Last Accessed"
                            value={
                                medicalCard.accessedAt
                                    ? new Date(medicalCard.accessedAt).toLocaleDateString()
                                    : "Never"
                            }
                        />
                    </View>
                )}

                {/* Danger Zone */}
                {!editing && (
                    <View style={styles.dangerZone}>
                        <TouchableOpacity
                            style={styles.dangerBtn}
                            onPress={handleDisableCard}
                            disabled={loading}
                        >
                            <Feather name="lock" size={18} color="#ef4444" />
                            <Text style={styles.dangerBtnText}>Disable Medical Card</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Info Note */}
                <View style={styles.infoNote}>
                    <Feather name="info" size={16} color={TEAL} />
                    <Text style={styles.infoNoteText}>
                        Your medical card is encrypted and secure. Emergency responders can only access it by scanning your QR code.
                    </Text>
                </View>
            </ScrollView>

            {/* QR Modal */}
            <Modal visible={showQRModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity
                            style={styles.modalClose}
                            onPress={() => setShowQRModal(false)}
                        >
                            <Feather name="x" size={24} color={TEAL_DARK} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Your Medical QR Code</Text>
                        {medicalCard.qrCodeValue && (
                            <QRCode
                                value={medicalCard.qrCodeValue}
                                size={250}
                                color={TEAL_DARK}
                                backgroundColor={WHITE}
                            />
                        )}
                        <Text style={styles.modalSubtitle}>
                            Show this code to emergency responders for instant access to your medical information.
                        </Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function InfoRow({
    label,
    value,
    highlight,
    danger,
}: {
    label: string;
    value: string;
    highlight?: boolean;
    danger?: boolean;
}) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text
                style={[
                    styles.infoValue,
                    highlight && styles.infoValueHighlight,
                    danger && styles.infoValueDanger,
                ]}
            >
                {value}
            </Text>
        </View>
    );
}

function EditField({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType = "default",
    multiline = false,
}: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    keyboardType?: string;
    multiline?: boolean;
}) {
    return (
        <View style={styles.editFieldGroup}>
            <Text style={styles.editLabel}>{label}</Text>
            <TextInput
                style={[styles.editInput, multiline && styles.editInputMultiline]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#cbd5e1"
                keyboardType={keyboardType as any}
                multiline={multiline}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: WHITE,
    },
    center: {
        alignItems: "center",
        justifyContent: "center",
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: "#64748b",
        fontFamily: "Inter_500Medium",
    },
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
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
    },
    headerEmoji: {
        fontSize: 22,
    },
    headerTitle: {
        fontSize: 22,
        fontFamily: "Inter_700Bold",
        color: WHITE,
    },
    editBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: WHITE,
        alignItems: "center",
        justifyContent: "center",
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
        paddingBottom: 40,
        gap: 16,
    },
    qrSection: {
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1.5,
        borderColor: "#e2e8f0",
        alignItems: "center",
        gap: 12,
    },
    qrContainer: {
        padding: 16,
        backgroundColor: "#f8fafc",
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    qrPlaceholder: {
        width: 200,
        height: 200,
        borderRadius: 12,
        backgroundColor: "#e2e8f0",
        alignItems: "center",
        justifyContent: "center",
    },
    qrPlaceholderText: {
        fontSize: 14,
        color: "#94a3b8",
        fontFamily: "Inter_500Medium",
    },
    qrHint: {
        fontSize: 12,
        color: "#64748b",
        fontFamily: "Inter_400Regular",
        textAlign: "center",
        marginTop: 8,
    },
    qrActions: {
        flexDirection: "row",
        gap: 8,
        marginTop: 8,
        width: "100%",
        justifyContent: "center",
        flexWrap: "wrap",
    },
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    secondaryBtn: {
        borderWidth: 1.5,
        borderColor: TEAL,
        backgroundColor: `${TEAL}08`,
    },
    secondaryBtnText: {
        fontSize: 12,
        fontFamily: "Inter_600SemiBold",
        color: TEAL,
    },
    card: {
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1.5,
        borderColor: "#e2e8f0",
        gap: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: "Inter_700Bold",
        color: "#1e293b",
        marginBottom: 8,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#f1f5f9",
    },
    infoLabel: {
        fontSize: 12,
        fontFamily: "Inter_500Medium",
        color: "#64748b",
        textTransform: "uppercase",
    },
    infoValue: {
        fontSize: 14,
        fontFamily: "Inter_600SemiBold",
        color: "#1e293b",
    },
    infoValueHighlight: {
        color: TEAL,
    },
    infoValueDanger: {
        color: "#ef4444",
    },
    editFieldGroup: {
        gap: 6,
        marginBottom: 12,
    },
    editLabel: {
        fontSize: 11,
        fontFamily: "Inter_600SemiBold",
        color: "#64748b",
        textTransform: "uppercase",
    },
    editInput: {
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        fontFamily: "Inter_500Medium",
        color: "#1e293b",
        backgroundColor: "#f8fafc",
    },
    editInputMultiline: {
        minHeight: 60,
        textAlignVertical: "top",
    },
    dangerZone: {
        marginTop: 16,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: "#fecaca",
    },
    dangerBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#fef2f2",
        borderWidth: 1.5,
        borderColor: "#fecaca",
        borderRadius: 12,
    },
    dangerBtnText: {
        fontSize: 14,
        fontFamily: "Inter_600SemiBold",
        color: "#ef4444",
    },
    infoNote: {
        flexDirection: "row",
        backgroundColor: `${TEAL}08`,
        padding: 12,
        borderRadius: 12,
        gap: 10,
        alignItems: "flex-start",
    },
    infoNoteText: {
        flex: 1,
        fontSize: 12,
        fontFamily: "Inter_400Regular",
        color: TEAL_DARK,
        lineHeight: 16,
    },
    emptyState: {
        alignItems: "center",
        paddingHorizontal: 30,
        paddingVertical: 40,
    },
    emptyIcon: {
        fontSize: 60,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontFamily: "Inter_700Bold",
        color: "#1e293b",
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        fontFamily: "Inter_400Regular",
        color: "#64748b",
        textAlign: "center",
        marginBottom: 24,
        lineHeight: 20,
    },
    createButton: {
        backgroundColor: TEAL,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 10,
    },
    createButtonText: {
        fontSize: 14,
        fontFamily: "Inter_700Bold",
        color: WHITE,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        justifyContent: "center",
    },
    modalContent: {
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 24,
        alignItems: "center",
        gap: 16,
        marginHorizontal: 20,
    },
    modalClose: {
        alignSelf: "flex-end",
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: "Inter_700Bold",
        color: "#1e293b",
    },
    modalSubtitle: {
        fontSize: 13,
        fontFamily: "Inter_400Regular",
        color: "#64748b",
        textAlign: "center",
        lineHeight: 18,
    },
});
