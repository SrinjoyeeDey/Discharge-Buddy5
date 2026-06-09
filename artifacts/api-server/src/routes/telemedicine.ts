import { Router } from "express";
import { db, telemedicineeSessions, telemedicineMessages, users, patients, medicines, doseLogs, eq, and, desc } from "@workspace/db";
import type { AuthRequest } from "../middlewares/auth";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();
router.use(requireAuth);

/**
 * POST /api/telemedicine/start
 * Patient starts a new telemedicine session.
 * AI will begin collecting symptoms and creating a summary.
 */
router.post("/start", async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (user.role !== "patient") {
            return res.status(403).json({ error: "Only patients can start telemedicine sessions" });
        }

        // Check for active session
        const [activeSession] = await db
            .select()
            .from(telemedicineeSessions)
            .where(
                and(
                    eq(telemedicineeSessions.patientUserId, user.id),
                    eq(telemedicineeSessions.status, "active")
                )
            );

        if (activeSession) {
            return res.status(400).json({
                error: "Active session exists",
                message: "You already have an active telemedicine session",
                sessionId: activeSession.id,
            });
        }

        // Create new session in pending status
        const [session] = await db
            .insert(telemedicineeSessions)
            .values({
                patientUserId: user.id,
                status: "pending",
            })
            .returning();

        // Add initial AI message to start symptom collection
        const [aiMessage] = await db
            .insert(telemedicineMessages)
            .values({
                sessionId: session.id,
                senderId: user.id, // Store as system/AI message
                senderType: "ai",
                message: "Hello! I'm your health assistant. I'm here to help collect information about your symptoms and health concerns. Please tell me:\n\n1. What symptoms are you experiencing today?\n2. When did they start?\n3. How severe would you rate them (1-10)?\n\nTake your time, and provide as much detail as you feel comfortable sharing.",
            })
            .returning();

        // Transition to active
        const [activeSessionData] = await db
            .update(telemedicineeSessions)
            .set({ status: "active" })
            .where(eq(telemedicineeSessions.id, session.id))
            .returning();

        return res.json({
            success: true,
            session: activeSessionData,
            message: "Telemedicine session started",
        });
    } catch (error) {
        logger.error({ err: error }, "POST /telemedicine/start failed");
        return res.status(500).json({ error: "Failed to start telemedicine session" });
    }
});

/**
 * POST /api/telemedicine/message
 * Send a message in a telemedicine session.
 * Auto-responds with AI summary suggestions if patient messages exceed threshold.
 */
router.post("/message", async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { sessionId, message, senderType } = req.body;

        if (!sessionId || !message) {
            return res.status(400).json({ error: "Missing required fields: sessionId, message" });
        }

        // Get session
        const [session] = await db
            .select()
            .from(telemedicineeSessions)
            .where(eq(telemedicineeSessions.id, sessionId));

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        // Verify user authorization (patient or assigned doctor)
        if (user.id !== session.patientUserId && user.id !== session.doctorId) {
            return res.status(403).json({ error: "Not authorized for this session" });
        }

        // Determine sender type
        let finalSenderType = senderType || (user.role === "patient" ? "patient" : "doctor");
        if (user.id === session.patientUserId) {
            finalSenderType = "patient";
        } else {
            finalSenderType = "doctor";
        }

        // Insert message
        const [newMessage] = await db
            .insert(telemedicineMessages)
            .values({
                sessionId,
                senderId: user.id,
                senderType: finalSenderType as any,
                message,
            })
            .returning();

        // If patient message, generate AI response after 2+ patient messages
        if (finalSenderType === "patient") {
            const patientMessageCount = await db
                .select()
                .from(telemedicineMessages)
                .where(
                    and(
                        eq(telemedicineMessages.sessionId, sessionId),
                        eq(telemedicineMessages.senderType, "patient")
                    )
                );

            if (patientMessageCount.length >= 2 && !session.aiSummary) {
                // Generate AI summary from patient messages
                const patientMsgs = patientMessageCount
                    .map((m: any) => m.message)
                    .join(" ");

                const aiSummary = `SYMPTOM SUMMARY:\n${patientMsgs}\n\n[AI Summary Ready - Doctor has been notified]`;

                const [aiResponse] = await db
                    .insert(telemedicineMessages)
                    .values({
                        sessionId,
                        senderId: user.id,
                        senderType: "ai",
                        message:
                            "Thank you for sharing those details. I've prepared a summary of your symptoms for the doctor's review. They will be notified and can join the chat shortly to discuss your condition further.",
                    })
                    .returning();

                // Update session with summary
                await db
                    .update(telemedicineeSessions)
                    .set({ aiSummary })
                    .where(eq(telemedicineeSessions.id, sessionId));
            }
        }

        return res.json({
            success: true,
            message: newMessage,
        });
    } catch (error) {
        logger.error({ err: error }, "POST /telemedicine/message failed");
        return res.status(500).json({ error: "Failed to send message" });
    }
});

/**
 * GET /api/telemedicine/session/:id
 * Get session details including messages and summary.
 */
router.get("/session/:id", async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = req.params;

        // Get session
        const [session] = await db
            .select()
            .from(telemedicineeSessions)
            .where(eq(telemedicineeSessions.id, id));

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        // Verify authorization
        if (user.id !== session.patientUserId && user.id !== session.doctorId) {
            return res.status(403).json({ error: "Not authorized for this session" });
        }

        // Get all messages
        const messages = await db
            .select()
            .from(telemedicineMessages)
            .where(eq(telemedicineMessages.sessionId, id))
            .orderBy(telemedicineMessages.createdAt);

        // Get patient info
        const [patientUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, session.patientUserId));

        // Get doctor info if assigned
        let doctorUser = null;
        if (session.doctorId) {
            const [doc] = await db
                .select()
                .from(users)
                .where(eq(users.id, session.doctorId));
            doctorUser = doc;
        }

        return res.json({
            success: true,
            session: {
                ...session,
                patient: patientUser
                    ? {
                        id: patientUser.id,
                        name: patientUser.name,
                        email: patientUser.email,
                        phone: patientUser.phone,
                    }
                    : null,
                doctor: doctorUser
                    ? {
                        id: doctorUser.id,
                        name: doctorUser.name,
                        email: doctorUser.email,
                        designation: doctorUser.designation,
                        specialization: doctorUser.specialization,
                    }
                    : null,
            },
            messages,
        });
    } catch (error) {
        logger.error({ err: error }, "GET /telemedicine/session/:id failed");
        return res.status(500).json({ error: "Failed to get session details" });
    }
});

/**
 * GET /api/telemedicine/sessions
 * List all sessions for the authenticated user.
 */
router.get("/sessions", async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        let sessions;

        if (user.role === "patient") {
            // Patients see their own sessions
            sessions = await db
                .select()
                .from(telemedicineeSessions)
                .where(eq(telemedicineeSessions.patientUserId, user.id))
                .orderBy(desc(telemedicineeSessions.createdAt));
        } else if (user.role === "doctor") {
            // Doctors see sessions where they're assigned
            sessions = await db
                .select()
                .from(telemedicineeSessions)
                .where(eq(telemedicineeSessions.doctorId, user.id))
                .orderBy(desc(telemedicineeSessions.createdAt));
        } else {
            return res.status(403).json({ error: "Only patients and doctors can view sessions" });
        }

        // Enrich with patient data
        const enriched = await Promise.all(
            sessions.map(async (session: any) => {
                const [patientUser] = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, session.patientUserId));

                return {
                    ...session,
                    patient: patientUser
                        ? {
                            id: patientUser.id,
                            name: patientUser.name,
                            email: patientUser.email,
                        }
                        : null,
                };
            })
        );

        return res.json({
            success: true,
            sessions: enriched,
        });
    } catch (error) {
        logger.error({ err: error }, "GET /telemedicine/sessions failed");
        return res.status(500).json({ error: "Failed to fetch sessions" });
    }
});

/**
 * POST /api/telemedicine/share-report
 * Patient shares their medical report/data with doctor in the session.
 */
router.post("/share-report", async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (user.role !== "patient") {
            return res.status(403).json({ error: "Only patients can share reports" });
        }

        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: "Missing sessionId" });
        }

        // Get session
        const [session] = await db
            .select()
            .from(telemedicineeSessions)
            .where(eq(telemedicineeSessions.id, sessionId));

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        if (session.patientUserId !== user.id) {
            return res.status(403).json({ error: "Not your session" });
        }

        // Compile medical report
        const [patientRecord] = await db
            .select()
            .from(patients)
            .where(eq(patients.id, user.linkedPatientId || ""));

        const medicines_ = await db
            .select()
            .from(medicines)
            .where(eq(medicines.patientId, user.linkedPatientId || ""));

        const recentDoseLogs = await db
            .select()
            .from(doseLogs)
            .where(eq(doseLogs.patientId, user.linkedPatientId || ""))
            .orderBy(desc(doseLogs.date))
            .limit(14); // Last 2 weeks

        const reportSummary = `MEDICAL REPORT SHARED\n\n**Patient:** ${user.name}\n**Age:** ${patientRecord?.age || "N/A"}\n**Condition:** ${patientRecord?.condition || "N/A"}\n**Blood Type:** ${user.bloodType || "N/A"}\n**Allergies:** ${user.allergies || "None reported"}\n\n**Current Medications:** ${medicines_.length > 0 ? medicines_.map((m: any) => `${m.name} (${m.dosage})`).join(", ") : "None"}\n\n**Recent Medication Adherence:** ${recentDoseLogs.length > 0 ? `${Math.round((recentDoseLogs.filter((d: any) => d.status === "taken").length / recentDoseLogs.length) * 100)}% (Last 14 days)` : "No data"}\n\n[Report shared at ${new Date().toISOString()}]`;

        // Post as system message
        const [reportMessage] = await db
            .insert(telemedicineMessages)
            .values({
                sessionId,
                senderId: user.id,
                senderType: "patient",
                message: reportSummary,
            })
            .returning();

        return res.json({
            success: true,
            message: reportMessage,
            report: {
                patientName: user.name,
                age: patientRecord?.age,
                condition: patientRecord?.condition,
                bloodType: user.bloodType,
                allergies: user.allergies,
                currentMedications: medicines_.map((m: any) => ({
                    name: m.name,
                    dosage: m.dosage,
                    frequency: m.frequency,
                })),
                recentAdherence: recentDoseLogs.length > 0
                    ? Math.round((recentDoseLogs.filter((d: any) => d.status === "taken").length / recentDoseLogs.length) * 100)
                    : 0,
            },
        });
    } catch (error) {
        logger.error({ err: error }, "POST /telemedicine/share-report failed");
        return res.status(500).json({ error: "Failed to share report" });
    }
});

/**
 * PATCH /api/telemedicine/session/:id/complete
 * Mark a telemedicine session as completed.
 */
router.patch("/session/:id/complete", async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = req.params;

        // Get session
        const [session] = await db
            .select()
            .from(telemedicineeSessions)
            .where(eq(telemedicineeSessions.id, id));

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        // Verify authorization (patient or doctor)
        if (user.id !== session.patientUserId && user.id !== session.doctorId) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // Update status
        const [updatedSession] = await db
            .update(telemedicineeSessions)
            .set({ status: "completed" })
            .where(eq(telemedicineeSessions.id, id))
            .returning();

        return res.json({
            success: true,
            session: updatedSession,
            message: "Session completed",
        });
    } catch (error) {
        logger.error({ err: error }, "PATCH /telemedicine/session/:id/complete failed");
        return res.status(500).json({ error: "Failed to complete session" });
    }
});

export default router;
