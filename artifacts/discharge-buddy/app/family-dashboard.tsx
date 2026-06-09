import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    RefreshControl,
    ActivityIndicator,
} from "react-native";
import { TranslateText as Text } from "@/components/TranslateText";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { AnimPressable } from "@/components/AnimPressable";

const TEAL = "#0891b2";
const TEAL_DARK = "#0c4a6e";
const WHITE = "#ffffff";

const STATUS_COLORS: Record<string, string> = {
    stable: "#10b981",
    improving: "#3b82f6",
    declining: "#f59e0b",
    critical: "#ef4444",
    "in-hospital": "#8b5cf6",
    discharged: "#06b6d4",
};

const STATUS_LABELS: Record<string, string> = {
    stable: "Stable",
    improving: "Improving",
    declining: "Declining",
    critical: "Critical",
    "in-hospital": "In Hospital",
    discharged: "Discharged",
};

interface PatientStatus {
    id: string;
    patientUserId: string;
    hospitalName?: string;
    currentStatus: string;
    statusNote?: string;
    updatedByUserId: string;
    updatedAt: string;
    createdAt: string;
}

interface DashboardData {
    patient: {
        id: string;
        name: string;
        email: string;
        phone?: string;
        condition?: string;
        dischargeDate?: string;
    };
    relationship: string;
    currentStatus: PatientStatus | null;
    statusHistory: PatientStatus[];
}

export default function FamilyDashboardScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const patientUserId = params.patientUserId as string;

    const { api } = useApp();
    const topInset = Platform.OS === "web" ? 67 : insets.top;

    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDashboard = async () => {
        if (!patientUserId) {
            setError("Patient ID not provided");
            setLoading(false);
            return;
        }

        try {
            setError(null);
            const data = await api.getFamilyDashboard(patientUserId);
            setDashboard(data);
        } catch (err) {
            console.error("Failed to load dashboard:", err);
            setError("Failed to load patient dashboard");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadDashboard();

        // Auto-refresh every 30 seconds
        const interval = setInterval(() => {
            loadDashboard();
        }, 30000);

        return () => clearInterval(interval);
    }, [patientUserId]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadDashboard();
    }, []);

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={TEAL} />
                <Text style={styles.loadingText}>Loading patient dashboard...</Text>
            </View>
        );
    }

    if (error || !dashboard) {
        return (
            <View style={[styles.container, styles.center]}>
                <View style={styles.errorBox}>
                    <Feather name="alert-circle" size={40} color="#ef4444" />
                    <Text style={styles.errorTitle}>Unable to Load</Text>
                    <Text style={styles.errorText}>{error || "Patient data not found"}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={loadDashboard}>
                        <Text style={styles.retryBtnText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const currentStatus = dashboard.currentStatus;
    const statusColor = currentStatus ? STATUS_COLORS[currentStatus.currentStatus] || TEAL : "#94a3b8";
    const statusLabel = currentStatus ? STATUS_LABELS[currentStatus.currentStatus] || "Unknown" : "No updates";

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
                        <Text style={styles.headerTitle}>Patient Dashboard</Text>
                    </View>
                    <View style={{ width: 36 }} />
                </View>
                <Text style={styles.headerSub}>Real-time status updates</Text>
            </LinearGradient>

            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
            >
                {/* Patient Card */}
                <View style={styles.patientCard}>
                    <View style={styles.patientHeader}>
                        <View style={styles.avatarPlaceholder}>
                            <Feather name="user" size={28} color={TEAL} />
                        </View>
                        <View style={styles.patientInfo}>
                            <Text style={styles.patientName}>{dashboard.patient.name}</Text>
                            <Text style={styles.patientRelationship}>{dashboard.relationship || "Family Member"}</Text>
                        </View>
                    </View>

                    {dashboard.patient.condition && (
                        <View style={styles.patientDetail}>
                            <Text style={styles.detailLabel}>Condition</Text>
                            <Text style={styles.detailValue}>{dashboard.patient.condition}</Text>
                        </View>
                    )}

                    {dashboard.patient.phone && (
                        <View style={styles.patientDetail}>
                            <Text style={styles.detailLabel}>Contact</Text>
                            <TouchableOpacity onPress={() => { }}>
                                <Text style={[styles.detailValue, styles.phoneLink]}>{dashboard.patient.phone}</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {dashboard.patient.dischargeDate && (
                        <View style={styles.patientDetail}>
                            <Text style={styles.detailLabel}>Expected Discharge</Text>
                            <Text style={styles.detailValue}>
                                {new Date(dashboard.patient.dischargeDate).toLocaleDateString("en", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Current Status Card */}
                <View style={styles.statusCard}>
                    <View style={styles.statusHeader}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <View style={styles.statusContent}>
                            <Text style={styles.statusLabel}>Current Status</Text>
                            <Text style={[styles.statusValue, { color: statusColor }]}>{statusLabel}</Text>
                        </View>
                        <View style={styles.lastUpdateBadge}>
                            <Feather name="refresh-cw" size={12} color={TEAL} />
                            <Text style={styles.lastUpdateText}>30s ago</Text>
                        </View>
                    </View>

                    {currentStatus?.statusNote && (
                        <View style={styles.statusNoteBox}>
                            <Text style={styles.statusNote}>{currentStatus.statusNote}</Text>
                        </View>
                    )}

                    {currentStatus?.hospitalName && (
                        <View style={styles.hospitalBox}>
                            <Feather name="map-pin" size={16} color={TEAL} />
                            <Text style={styles.hospitalName}>{currentStatus.hospitalName}</Text>
                        </View>
                    )}

                    <Text style={styles.statusTime}>
                        Updated {currentStatus ? new Date(currentStatus.updatedAt).toLocaleTimeString() : "N/A"}
                    </Text>
                </View>

                {/* Status History */}
                {dashboard.statusHistory.length > 0 && (
                    <View style={styles.historySection}>
                        <Text style={styles.sectionTitle}>📊 Status History</Text>

                        {dashboard.statusHistory.map((update, index) => (
                            <View
                                key={update.id}
                                style={[styles.historyItem, index === dashboard.statusHistory.length - 1 && styles.historyItemLast]}
                            >
                                <View style={styles.historyTimeline}>
                                    <View
                                        style={[
                                            styles.historyDot,
                                            { backgroundColor: STATUS_COLORS[update.currentStatus] || TEAL },
                                        ]}
                                    />
                                    {index < dashboard.statusHistory.length - 1 && <View style={styles.historyLine} />}
                                </View>

                                <View style={styles.historyContent}>
                                    <View style={styles.historyHeader}>
                                        <Text style={styles.historyStatus}>{STATUS_LABELS[update.currentStatus] || update.currentStatus}</Text>
                                        <Text style={styles.historyTime}>
                                            {new Date(update.updatedAt).toLocaleTimeString("en", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </Text>
                                    </View>

                                    {update.statusNote && <Text style={styles.historyNote}>{update.statusNote}</Text>}

                                    <Text style={styles.historyDate}>
                                        {new Date(update.updatedAt).toLocaleDateString("en", {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* No History */}
                {dashboard.statusHistory.length === 0 && (
                    <View style={styles.emptyState}>
                        <Feather name="inbox" size={40} color="#cbd5e1" />
                        <Text style={styles.emptyStateTitle}>No Status Updates Yet</Text>
                        <Text style={styles.emptyStateText}>Once the patient posts an update, it will appear here.</Text>
                    </View>
                )}

                {/* Info Banner */}
                <View style={styles.infoBanner}>
                    <Feather name="info" size={16} color={TEAL} />
                    <Text style={styles.infoBannerText}>
                        This dashboard auto-refreshes every 30 seconds. You're receiving real-time updates from {dashboard.patient.name}.
                    </Text>
                </View>
            </ScrollView>
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
    errorBox: {
        alignItems: "center",
        paddingHorizontal: 30,
        paddingVertical: 40,
    },
    errorTitle: {
        fontSize: 18,
        fontFamily: "Inter_700Bold",
        color: "#1e293b",
        marginTop: 16,
        marginBottom: 8,
    },
    errorText: {
        fontSize: 14,
        fontFamily: "Inter_400Regular",
        color: "#64748b",
        textAlign: "center",
        marginBottom: 24,
    },
    retryBtn: {
        backgroundColor: TEAL,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryBtnText: {
        color: WHITE,
        fontSize: 14,
        fontFamily: "Inter_600SemiBold",
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
        paddingBottom: 40,
        gap: 16,
    },
    patientCard: {
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1.5,
        borderColor: "#e2e8f0",
        gap: 12,
    },
    patientHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f1f5f9",
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: `${TEAL}15`,
        alignItems: "center",
        justifyContent: "center",
    },
    patientInfo: {
        flex: 1,
    },
    patientName: {
        fontSize: 16,
        fontFamily: "Inter_700Bold",
        color: "#1e293b",
    },
    patientRelationship: {
        fontSize: 12,
        fontFamily: "Inter_400Regular",
        color: "#64748b",
        marginTop: 2,
    },
    patientDetail: {
        paddingVertical: 8,
    },
    detailLabel: {
        fontSize: 11,
        fontFamily: "Inter_600SemiBold",
        color: "#94a3b8",
        textTransform: "uppercase",
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 14,
        fontFamily: "Inter_500Medium",
        color: "#1e293b",
    },
    phoneLink: {
        color: "#0284c7",
    },
    statusCard: {
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1.5,
        borderColor: "#e2e8f0",
        gap: 12,
    },
    statusHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    statusContent: {
        flex: 1,
    },
    statusLabel: {
        fontSize: 11,
        fontFamily: "Inter_500Medium",
        color: "#94a3b8",
        textTransform: "uppercase",
    },
    statusValue: {
        fontSize: 16,
        fontFamily: "Inter_700Bold",
        marginTop: 2,
    },
    lastUpdateBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: `${TEAL}15`,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    lastUpdateText: {
        fontSize: 11,
        fontFamily: "Inter_500Medium",
        color: TEAL,
    },
    statusNoteBox: {
        backgroundColor: "#f8fafc",
        padding: 12,
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: TEAL,
    },
    statusNote: {
        fontSize: 13,
        fontFamily: "Inter_400Regular",
        color: "#1e293b",
        lineHeight: 18,
    },
    hospitalBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: "#f0f9ff",
        borderRadius: 8,
    },
    hospitalName: {
        fontSize: 13,
        fontFamily: "Inter_500Medium",
        color: TEAL,
        flex: 1,
    },
    statusTime: {
        fontSize: 11,
        fontFamily: "Inter_400Regular",
        color: "#cbd5e1",
    },
    historySection: {
        paddingTop: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: "Inter_700Bold",
        color: "#1e293b",
        marginBottom: 12,
    },
    historyItem: {
        flexDirection: "row",
        gap: 12,
        paddingBottom: 16,
    },
    historyItemLast: {
        paddingBottom: 0,
    },
    historyTimeline: {
        alignItems: "center",
    },
    historyDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        marginTop: 2,
    },
    historyLine: {
        width: 2,
        flex: 1,
        backgroundColor: "#e2e8f0",
        marginVertical: 4,
    },
    historyContent: {
        flex: 1,
        paddingTop: 2,
    },
    historyHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    historyStatus: {
        fontSize: 14,
        fontFamily: "Inter_600SemiBold",
        color: "#1e293b",
    },
    historyTime: {
        fontSize: 12,
        fontFamily: "Inter_400Regular",
        color: "#94a3b8",
    },
    historyNote: {
        fontSize: 12,
        fontFamily: "Inter_400Regular",
        color: "#475569",
        marginBottom: 6,
        lineHeight: 16,
    },
    historyDate: {
        fontSize: 11,
        fontFamily: "Inter_400Regular",
        color: "#cbd5e1",
    },
    emptyState: {
        alignItems: "center",
        paddingVertical: 40,
        gap: 12,
    },
    emptyStateTitle: {
        fontSize: 16,
        fontFamily: "Inter_600SemiBold",
        color: "#1e293b",
    },
    emptyStateText: {
        fontSize: 13,
        fontFamily: "Inter_400Regular",
        color: "#94a3b8",
        textAlign: "center",
    },
    infoBanner: {
        flexDirection: "row",
        backgroundColor: `${TEAL}08`,
        padding: 12,
        borderRadius: 12,
        gap: 10,
        alignItems: "flex-start",
    },
    infoBannerText: {
        flex: 1,
        fontSize: 12,
        fontFamily: "Inter_400Regular",
        color: TEAL_DARK,
        lineHeight: 16,
    },
});
