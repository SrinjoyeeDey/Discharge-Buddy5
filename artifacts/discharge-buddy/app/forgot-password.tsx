import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { TranslateText as Text } from "@/components/TranslateText";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { getApiUrl } from "@/utils/apiUrl";

const PURPLE = "#6C47FF";
const WHITE = "#FFFFFF";
const MUTED = "#64748B";
const TEXT = "#1E293B";

type Step = "email" | "otp" | "newPassword";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>([]);

  // ── Step 1: Request OTP ────────────────────────────────────────────────────
  const handleRequestOTP = async () => {
    if (!email.trim()) { setError("Please enter your email address"); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (d.error === "USE_GOOGLE_SIGNIN") {
          setError("This account uses Google Sign-In. Please sign in with Google instead.");
          return;
        }
        throw new Error(d.error || "Failed to send reset code");
      }
      // Always advance (security: don't reveal if email exists)
      setStep("otp");
      startResendCooldown();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  const otpCode = otp.join("");

  const handleOTPInput = (text: string, idx: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[idx] = digit;
    setOtp(newOtp);
    if (digit && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  const handleOTPKeyPress = (key: string, idx: number) => {
    if (key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerifyOTP = () => {
    if (otpCode.length < 6) { setError("Please enter the full 6-digit code"); return; }
    setError(null);
    setStep("newPassword");
  };

  // ── Step 3: Reset Password ────────────────────────────────────────────────
  const handleResetPassword = async () => {
    setError(null);
    if (!newPassword) { setError("Please enter a new password"); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: otpCode, newPassword }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to reset password");
      Alert.alert(
        "Password Reset!",
        "Your password has been updated. Please sign in with your new password.",
        [{ text: "Sign In", onPress: () => router.replace("/login") }]
      );
    } catch (err: any) {
      setError(err.message);
      if (err.message?.toLowerCase().includes("expired") || err.message?.toLowerCase().includes("invalid")) {
        // Go back to OTP step
        setStep("otp");
        setOtp(["", "", "", "", "", ""]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      await fetch(`${getApiUrl()}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      startResendCooldown();
      setOtp(["", "", "", "", "", ""]);
    } finally {
      setLoading(false);
    }
  };

  // ── Renders ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <LinearGradient
        colors={["#4c1d95", PURPLE]}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={WHITE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === "email" ? "Forgot Password" : step === "otp" ? "Enter Code" : "New Password"}
        </Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Step progress dots */}
      <View style={styles.stepRow}>
        {(["email", "otp", "newPassword"] as Step[]).map((s, i) => (
          <View key={s} style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={[styles.stepDot, step === s && styles.stepDotActive,
              (step === "otp" && i === 0) || (step === "newPassword" && i <= 1) ? styles.stepDotDone : null
            ]}>
              {((step === "otp" && i === 0) || (step === "newPassword" && i <= 1)) ? (
                <Feather name="check" size={10} color={WHITE} />
              ) : (
                <Text style={[styles.stepDotText, step === s && { color: WHITE }]}>{i + 1}</Text>
              )}
            </View>
            {i < 2 && <View style={styles.stepLine} />}
          </View>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Error */}
        {!!error && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Step 1: Email ── */}
        {step === "email" && (
          <>
            <View style={styles.iconCircle}>
              <Feather name="mail" size={32} color={PURPLE} />
            </View>
            <Text style={styles.stepTitle}>Reset Your Password</Text>
            <Text style={styles.stepSub}>
              Enter the email address associated with your account. We'll send a 6-digit code to reset your password.
            </Text>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={16} color={MUTED} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={MUTED}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleRequestOTP}
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleRequestOTP}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color={WHITE} /> : (
                <Text style={styles.primaryBtnText}>Send Reset Code</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* ── Step 2: OTP ── */}
        {step === "otp" && (
          <>
            <View style={styles.iconCircle}>
              <Feather name="shield" size={32} color={PURPLE} />
            </View>
            <Text style={styles.stepTitle}>Check Your Email</Text>
            <Text style={styles.stepSub}>
              We sent a 6-digit code to{"\n"}
              <Text style={{ color: PURPLE, fontFamily: "Inter_700Bold" }}>{email}</Text>
              {"\n"}Enter it below. It expires in 15 minutes.
            </Text>

            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={r => { otpRefs.current[i] = r; }}
                  style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                  value={digit}
                  onChangeText={t => handleOTPInput(t, i)}
                  onKeyPress={({ nativeEvent }) => handleOTPKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  selectionColor={PURPLE}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleVerifyOTP}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>Verify Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResend}
              disabled={resendCooldown > 0 || loading}
              style={styles.resendBtn}
            >
              <Text style={[styles.resendText, resendCooldown > 0 && { color: MUTED }]}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep("email")} style={styles.backLink}>
              <Feather name="arrow-left" size={14} color={MUTED} />
              <Text style={styles.backLinkText}>Change email</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Step 3: New Password ── */}
        {step === "newPassword" && (
          <>
            <View style={styles.iconCircle}>
              <Feather name="lock" size={32} color={PURPLE} />
            </View>
            <Text style={styles.stepTitle}>Create New Password</Text>
            <Text style={styles.stepSub}>
              Choose a strong password. It must be at least 6 characters.
            </Text>

            <View style={styles.inputWrap}>
              <Feather name="lock" size={16} color={MUTED} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="New password"
                placeholderTextColor={MUTED}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ paddingRight: 14 }}>
                <Feather name={showPass ? "eye-off" : "eye"} size={16} color={MUTED} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrap}>
              <Feather name="check-circle" size={16} color={MUTED} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Confirm new password"
                placeholderTextColor={MUTED}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleResetPassword}
              />
            </View>

            {/* Password strength indicator */}
            {newPassword.length > 0 && (
              <View style={styles.strengthRow}>
                {[...Array(4)].map((_, i) => {
                  const strength = newPassword.length >= 12 ? 4 : newPassword.length >= 8 ? 3 : newPassword.length >= 6 ? 2 : 1;
                  const colors = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"];
                  return (
                    <View
                      key={i}
                      style={[styles.strengthBar, { backgroundColor: i < strength ? colors[strength - 1] : "#e2e8f0" }]}
                    />
                  );
                })}
                <Text style={styles.strengthLabel}>
                  {newPassword.length < 6 ? "Too short" : newPassword.length < 8 ? "Weak" : newPassword.length < 12 ? "Good" : "Strong"}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color={WHITE} /> : (
                <Text style={styles.primaryBtnText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WHITE },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    color: WHITE, fontSize: 18, fontFamily: "Inter_700Bold",
  },

  stepRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", paddingVertical: 20,
    backgroundColor: "#f8fafc",
  },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#e2e8f0",
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: PURPLE },
  stepDotDone: { backgroundColor: "#10b981" },
  stepDotText: { fontSize: 12, fontFamily: "Inter_700Bold", color: MUTED },
  stepLine: { width: 40, height: 2, backgroundColor: "#e2e8f0", marginHorizontal: 4 },

  content: {
    paddingHorizontal: 24, paddingTop: 8, alignItems: "center",
  },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fef2f2", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#fecaca", width: "100%", marginBottom: 16,
  },
  errorText: { flex: 1, color: "#ef4444", fontSize: 13, fontFamily: "Inter_500Medium" },

  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#f5f3ff",
    alignItems: "center", justifyContent: "center",
    marginTop: 20, marginBottom: 20,
  },
  stepTitle: {
    fontSize: 22, fontFamily: "Inter_800ExtraBold", color: TEXT,
    textAlign: "center", marginBottom: 10,
  },
  stepSub: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: MUTED,
    textAlign: "center", lineHeight: 22, marginBottom: 28,
  },

  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f8fafc", borderRadius: 14,
    borderWidth: 1.5, borderColor: "#e2e8f0",
    width: "100%", marginBottom: 14,
  },
  inputIcon: { paddingLeft: 14 },
  input: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 10,
    fontSize: 15, fontFamily: "Inter_500Medium", color: TEXT,
  },

  primaryBtn: {
    backgroundColor: PURPLE, borderRadius: 50,
    paddingVertical: 16, width: "100%",
    alignItems: "center", marginTop: 8,
  },
  primaryBtnText: { color: WHITE, fontSize: 16, fontFamily: "Inter_700Bold" },

  // OTP
  otpRow: {
    flexDirection: "row", gap: 10, marginBottom: 28,
  },
  otpBox: {
    width: 46, height: 56, borderRadius: 12,
    borderWidth: 2, borderColor: "#e2e8f0",
    fontSize: 22, fontFamily: "Inter_700Bold",
    color: TEXT, backgroundColor: "#f8fafc",
  },
  otpBoxFilled: { borderColor: PURPLE, backgroundColor: "#f5f3ff" },

  resendBtn: { marginTop: 20, alignItems: "center" },
  resendText: { color: PURPLE, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  backLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  backLinkText: { color: MUTED, fontSize: 13, fontFamily: "Inter_500Medium" },

  // Password strength
  strengthRow: {
    flexDirection: "row", alignItems: "center", gap: 6, width: "100%", marginBottom: 16,
  },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: MUTED, width: 70 },
});
