import { Router } from "express";
import { db, users, familyLinks, patientStatusUpdates, patients, eq, and, desc, isNull, ne } from "@workspace/db";
import type { AuthRequest } from "../middlewares/auth";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { sendVerificationEmail } from "../lib/email";

const router = Router();
router.use(requireAuth);

/**
 * POST /api/family/link
 * Patient invites a family member by email to view their emergency dashboard.
 */
router.post("/link", async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { familyEmail, relationship } = req.body;

        if (!familyEmail || !familyEmail.trim()) {
            return res.status(400).json({ error: "familyEmail is required" });
        }

        // Find the family member by email
        const [familyUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, familyEmail.toLowerCase()));

        if (!familyUser) {
            return res.status(404).json({
                error: "User not found",
                message: `No user found with email ${familyEmail}`,
            });
        }

        if (familyUser.id === user.id) {
            return res.status(400).json({ error: "Cannot link to yourself" });
        }

        // Check if link already exists
        const [existingLink] = await db
            .select()
            .from(familyLinks)
            .where(
                and(
                    eq(familyLinks.patientUserId, user.id),
                    eq(familyLinks.familyUserId, familyUser.id)
                )
            );

        if (existingLink) {
            return res.status(400).json({
                error: "Link already exists",
                message: `Family link already ${existingLink.status}`,
            });
        }

        // Create the family link (starts as pending)
        const [link] = await db
            .insert(familyLinks)
            .values({
                patientUserId: user.id,
                familyUserId: familyUser.id,
                relationship: relationship || "family",
                status: "pending",
            })
            .returning();

        // Send invitation email to family member
        try {
            await sendVerificationEmail(
                familyUser.email,
                link.id, // Use link ID as token
                `${user.name || "A patient"} invited you`,
                `Visit the app to accept or reject the family link invitation.`
            );
        } catch (emailErr) {
            logger.warn({ err: emailErr }, "Failed to send family link email");
            // Don't fail the whole request, just warn
        }

        return res.json({
            success: true,
            link,
            message: "Invitation sent to family member",
        });
    } catch (error) {
        logger.error({ err: error }, "POST /family/link failed");
        return res.status(500).json({ error: "Failed to create family link" });
    }
});

/**
 * POST /api/family/link/:linkId/accept
 * Family member accepts the link invitation.
 */
router.post("/link/:linkId/accept", async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { linkId } = req.params;

        // Find the link
        const [link] = await db
            .select()
            .from(familyLinks)
            .where(eq(familyLinks.id, linkId));

        if (!link) {
            return res.status(404).json({ error: "Link not found" });
        }

        // Verify this user is the family member being invited
        if (link.familyUserId !== user.id) {
            return res.status(403).json({ error: "Forbidden" });
        }

        // Update link status to accepted
        const [updatedLink] = await db
            .update(familyLinks)
            .set({
                status: "accepted",
                acceptedAt: new Date(),
            })
            .where(eq(familyLinks.id, linkId))
            .returning();

        return res.json({
            success: true,
            link: updatedLink,
            message: "Family link accepted",
        });
    } catch (error) {
        logger.error({ err: error }, "POST /family/link/:linkId/accept failed");
        return res.status(500).json({ error: "Failed to accept family link" });
    }
});

/**
 * POST /api/family/link/:linkId/reject
 * Family member rejects the link invitation.
 */
router.post("/link/:linkId/reject", async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { linkId } = req.params;

        // Find the link
        const [link] = await db
            .select()
            .from(familyLinks)
            .where(eq(familyLinks.id, linkId));

        if (!link) {
            return res.status(404).json({ error: "Link not found" });
        }

        // Verify this user is the family member being invited
        if (link.familyUserId !== user.id) {
            return res.status(403).json({ error: "Forbidden" });
        }

        // Update link status to rejected
        const [updatedLink] = await db
            .update(familyLinks)
            .set({
                status: "rejected",
            })
            .where(eq(familyLinks.id, linkId))
            .returning();

        return res.json({
            success: true,
            message: "Family link rejected",
        });
    } catch (error) {
        logger.error({ err: error }, "POST /family/link/:linkId/reject failed");
        return res.status(500).json({ error: "Failed to reject family link" });
    }
});

/**
 * GET /api/family/dashboard/:patientUserId
 * Family member views patient's emergency status dashboard.
 * Auth required + must be linked to patient.
 */
router.get("/dashboard/:patientUserId", async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { patientUserId } = req.params;

        // Verify this user has an accepted link to the patient
        const [link] = await db
            .select()
            .from(familyLinks)
            .where(
                and(
                    eq(familyLinks.patientUserId, patientUserId),
                    eq(familyLinks.familyUserId, user.id),
                    eq(familyLinks.status, "accepted")
                )
            );

        if (!link) {
            return res.status(403).json({
                error: "Not linked",
                message: "You are not linked to this patient",
            });
        }

        // Get patient user info
        const [patientUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, patientUserId));

        if (!patientUser) {
            return res.status(404).json({ error: "Patient not found" });
        }

        // Get patient's main patient record (for condition info)
        const [patientRecord] = await db
            .select()
            .from(patients)
            .where(eq(patients.id, patientUser.linkedPatientId || ""));

        // Get latest status update
        const [latestStatus] = await db
            .select()
            .from(patientStatusUpdates)
            .where(eq(patientStatusUpdates.patientUserId, patientUserId))
            .orderBy(desc(patientStatusUpdates.updatedAt))
            .limit(1);

        // Get recent status history (last 10)
        const statusHistory = await db
            .select()
            .from(patientStatusUpdates)
            .where(eq(patientStatusUpdates.patientUserId, patientUserId))
            .orderBy(desc(patientStatusUpdates.updatedAt))
            .limit(10);

        return res.json({
            patient: {
                id: patientUser.id,
                name: patientUser.name,
                email: patientUser.email,
                phone: patientUser.phone,
                condition: patientRecord?.condition,
                dischargeDate: patientRecord?.dischargeDate,
            },
            relationship: link.relationship,
            currentStatus: latestStatus || null,
            statusHistory: statusHistory || [],
            message: "Dashboard loaded successfully",
        });
    } catch (error) {
        logger.error({ err: error }, "GET /family/dashboard/:patientUserId failed");
        return res.status(500).json({ error: "Failed to load dashboard" });
    }
});

/**
 * POST /api/family/status-update
 * Patient or caregiver posts a new status update for family to see.
 */
router.post("/status-update", async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { patientUserId, hospitalName, currentStatus, statusNote } = req.body;

        if (!patientUserId || !currentStatus) {
            return res.status(400).json({
                error: "Missing required fields: patientUserId, currentStatus",
            });
        }

        // Verify this user is the patient or linked to the patient
        if (patientUserId !== user.id) {
            // Check if this user has a link to the patient
            const [link] = await db
                .select()
                .from(familyLinks)
                .where(
                    and(
                        eq(familyLinks.patientUserId, patientUserId),
                        eq(familyLinks.familyUserId, user.id),
                        eq(familyLinks.status, "accepted")
                    )
                );

            if (!link) {
                return res.status(403).json({
                    error: "Forbidden",
                    message: "You can only post updates for yourself or linked patients",
                });
            }
        }

        // Create status update
        const [statusUpdate] = await db
            .insert(patientStatusUpdates)
            .values({
                patientUserId,
                hospitalName: hospitalName || null,
                currentStatus,
                statusNote: statusNote || null,
                updatedByUserId: user.id,
            })
            .returning();

        return res.json({
            success: true,
            statusUpdate,
            message: "Status update posted",
        });
    } catch (error) {
        logger.error({ err: error }, "POST /family/status-update failed");
        return res.status(500).json({ error: "Failed to post status update" });
    }
});

/**
 * GET /api/family/my-links
 * Get all family links for the authenticated user (both directions).
 */
router.get("/my-links", async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Get links where I am the patient
        const linksAsPatient = await db
            .select()
            .from(familyLinks)
            .where(eq(familyLinks.patientUserId, user.id));

        // Get links where I am the family member
        const linksAsFamily = await db
            .select()
            .from(familyLinks)
            .where(eq(familyLinks.familyUserId, user.id));

        return res.json({
            success: true,
            linksAsPatient,
            linksAsFamily,
        });
    } catch (error) {
        logger.error({ err: error }, "GET /family/my-links failed");
        return res.status(500).json({ error: "Failed to fetch links" });
    }
});

/**
 * DELETE /api/family/link/:linkId
 * Remove a family link.
 */
router.delete("/link/:linkId", async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { linkId } = req.params;

        // Find the link
        const [link] = await db
            .select()
            .from(familyLinks)
            .where(eq(familyLinks.id, linkId));

        if (!link) {
            return res.status(404).json({ error: "Link not found" });
        }

        // Verify this user owns the link (is patient or family)
        if (link.patientUserId !== user.id && link.familyUserId !== user.id) {
            return res.status(403).json({ error: "Forbidden" });
        }

        // Delete the link
        await db.delete(familyLinks).where(eq(familyLinks.id, linkId));

        return res.json({
            success: true,
            message: "Family link removed",
        });
    } catch (error) {
        logger.error({ err: error }, "DELETE /family/link/:linkId failed");
        return res.status(500).json({ error: "Failed to delete family link" });
    }
});

export default router;
