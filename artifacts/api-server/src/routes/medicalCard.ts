import { Router } from "express";
import { db, medicalCards, patients, medicines, users, eq, and } from "@workspace/db";
import type { AuthRequest } from "../middlewares/auth";
import { requireAuth, optionalAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import crypto from "crypto";

const router = Router();

/**
 * Helper: Generate SHA256 hash of the QR code data for secure lookup
 */
function generateQRHash(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Helper: Build QR code payload from medical card data
 */
interface MedicalCardData {
    patientId: string;
    patientName: string;
    bloodType?: string;
    allergies?: string;
    diseases?: string;
    currentMedications?: Array<{ name: string; dosage: string; frequency: string }>;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    createdAt: string;
}

function buildQRPayload(cardData: MedicalCardData): string {
    return JSON.stringify({
        type: "medical_card",
        patientId: cardData.patientId,
        patientName: cardData.patientName,
        bloodType: cardData.bloodType || "Unknown",
        allergies: cardData.allergies || "None",
        diseases: cardData.diseases || "None",
        currentMedications: cardData.currentMedications || [],
        emergencyContactName: cardData.emergencyContactName,
        emergencyContactPhone: cardData.emergencyContactPhone,
        createdAt: cardData.createdAt,
        // Add a checksum to prevent tampering
        checksum: generateQRHash(JSON.stringify({
            patientId: cardData.patientId,
            bloodType: cardData.bloodType,
            allergies: cardData.allergies,
        })),
    });
}

/**
 * GET /api/medical-card
 * Retrieve the authenticated user's medical card (patient only).
 * If it doesn't exist, create one from their current profile data.
 */
router.get("/", requireAuth, async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user?.linkedPatientId) {
            return res.status(400).json({ error: "You don't have a patient profile" });
        }

        // Fetch patient + existing medical card
        const [patient] = await db
            .select()
            .from(patients)
            .where(eq(patients.id, user.linkedPatientId));

        if (!patient) {
            return res.status(404).json({ error: "Patient not found" });
        }

        let [card] = await db
            .select()
            .from(medicalCards)
            .where(eq(medicalCards.patientId, user.linkedPatientId));

        // If card doesn't exist, create it from user's current medical data
        if (!card) {
            // Fetch all active medicines for this patient
            const patientMedicines = await db
                .select()
                .from(medicines)
                .where(and(
                    eq(medicines.patientId, user.linkedPatientId),
                    eq(medicines.status, "active")
                ));

            const medicationsData = patientMedicines.map(m => ({
                name: m.name,
                dosage: m.dosage,
                frequency: m.frequency,
            }));

            const cardPayload: MedicalCardData = {
                patientId: patient.id,
                patientName: patient.name,
                bloodType: user.bloodType || "Unknown",
                allergies: user.allergies || "None reported",
                diseases: patient.condition || "See medical records",
                currentMedications: medicationsData,
                emergencyContactName: user.emergencyContactName || "Not set",
                emergencyContactPhone: user.emergencyContactPhone || "Not set",
                createdAt: new Date().toISOString(),
            };

            const qrValue = buildQRPayload(cardPayload);
            const qrHash = generateQRHash(qrValue);

            [card] = await db
                .insert(medicalCards)
                .values({
                    patientId: user.linkedPatientId,
                    userId: user.id,
                    bloodType: user.bloodType,
                    allergies: user.allergies,
                    diseases: patient.condition,
                    currentMedications: medicationsData,
                    emergencyContactName: user.emergencyContactName,
                    emergencyContactPhone: user.emergencyContactPhone,
                    qrCodeValue: qrValue,
                    qrCodeHash: qrHash,
                    isPublic: true,
                })
                .returning();
        }

        // Return the card (but don't expose qrCodeHash to frontend)
        const { qrCodeHash: _, ...safeCard } = card;
        return res.json(safeCard);
    } catch (error) {
        logger.error({ err: error }, "GET medical card failed");
        return res.status(500).json({ error: "Failed to retrieve medical card" });
    }
});

/**
 * POST /api/medical-card
 * Create or update the authenticated user's medical card with new data.
 */
router.post("/", requireAuth, async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user?.linkedPatientId) {
            return res.status(400).json({ error: "You don't have a patient profile" });
        }

        const {
            bloodType,
            allergies,
            diseases,
            emergencyContactName,
            emergencyContactPhone,
        } = req.body;

        // Validate input
        if (!bloodType || !emergencyContactPhone) {
            return res.status(400).json({
                error: "bloodType and emergencyContactPhone are required",
            });
        }

        // Fetch patient for name
        const [patient] = await db
            .select()
            .from(patients)
            .where(eq(patients.id, user.linkedPatientId));

        if (!patient) {
            return res.status(404).json({ error: "Patient not found" });
        }

        // Fetch active medicines for this patient
        const patientMedicines = await db
            .select()
            .from(medicines)
            .where(and(
                eq(medicines.patientId, user.linkedPatientId),
                eq(medicines.status, "active")
            ));

        const medicationsData = patientMedicines.map(m => ({
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
        }));

        // Build new QR payload
        const cardPayload: MedicalCardData = {
            patientId: patient.id,
            patientName: patient.name,
            bloodType,
            allergies: allergies || "None reported",
            diseases: diseases || patient.condition || "See medical records",
            currentMedications: medicationsData,
            emergencyContactName: emergencyContactName || "Not set",
            emergencyContactPhone,
            createdAt: new Date().toISOString(),
        };

        const qrValue = buildQRPayload(cardPayload);
        const qrHash = generateQRHash(qrValue);

        // Upsert the medical card
        const [card] = await db
            .insert(medicalCards)
            .values({
                patientId: user.linkedPatientId,
                userId: user.id,
                bloodType,
                allergies: allergies || "None reported",
                diseases: diseases || patient.condition,
                currentMedications: medicationsData,
                emergencyContactName: emergencyContactName || "Not set",
                emergencyContactPhone,
                qrCodeValue: qrValue,
                qrCodeHash: qrHash,
                isPublic: true,
            })
            .onConflictDoUpdate({
                target: medicalCards.patientId,
                set: {
                    bloodType,
                    allergies: allergies || "None reported",
                    diseases: diseases || patient.condition,
                    currentMedications: medicationsData,
                    emergencyContactName: emergencyContactName || "Not set",
                    emergencyContactPhone,
                    qrCodeValue: qrValue,
                    qrCodeHash: qrHash,
                    updatedAt: new Date(),
                },
            })
            .returning();

        const { qrCodeHash: _, ...safeCard } = card;
        return res.json({ success: true, card: safeCard });
    } catch (error) {
        logger.error({ err: error }, "POST medical card failed");
        return res.status(500).json({ error: "Failed to save medical card" });
    }
});

/**
 * GET /api/medical-card/scan/:qrHash
 * PUBLIC endpoint — retrieve medical card data by QR code hash (for emergency responders).
 * No authentication required; the hash acts as the bearer credential.
 */
router.get("/scan/:qrHash", optionalAuth, async (req: AuthRequest, res) => {
    try {
        const { qrHash } = req.params;

        if (!qrHash || qrHash.length !== 64) {
            return res.status(400).json({ error: "Invalid QR code" });
        }

        // Find the medical card by hash
        const [card] = await db
            .select()
            .from(medicalCards)
            .where(and(
                eq(medicalCards.qrCodeHash, qrHash),
                eq(medicalCards.isPublic, true)
            ));

        if (!card) {
            return res.status(404).json({ error: "Medical card not found or not public" });
        }

        // Update access tracking
        await db
            .update(medicalCards)
            .set({
                accessedAt: new Date(),
                accessCount: card.accessCount + 1,
            })
            .where(eq(medicalCards.id, card.id));

        // Parse and return the QR payload
        try {
            const payload = JSON.parse(card.qrCodeValue || "{}");
            return res.json(payload);
        } catch {
            return res.status(500).json({ error: "Failed to parse medical card data" });
        }
    } catch (error) {
        logger.error({ err: error }, "GET scan medical card failed");
        return res.status(500).json({ error: "Failed to retrieve medical card" });
    }
});

/**
 * POST /api/medical-card/regenerate
 * Regenerate the QR code for the authenticated user's medical card
 * (useful if the old code was compromised).
 */
router.post("/regenerate", requireAuth, async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user?.linkedPatientId) {
            return res.status(400).json({ error: "You don't have a patient profile" });
        }

        const [card] = await db
            .select()
            .from(medicalCards)
            .where(eq(medicalCards.patientId, user.linkedPatientId));

        if (!card) {
            return res.status(404).json({ error: "Medical card not found" });
        }

        // Generate a new hash (the QR payload stays the same, but hash is new)
        const newHash = generateQRHash(card.qrCodeValue + Math.random().toString());

        const [updatedCard] = await db
            .update(medicalCards)
            .set({
                qrCodeHash: newHash,
                updatedAt: new Date(),
            })
            .where(eq(medicalCards.id, card.id))
            .returning();

        const { qrCodeHash: _, ...safeCard } = updatedCard;
        return res.json({
            success: true,
            message: "QR code regenerated successfully",
            card: safeCard,
        });
    } catch (error) {
        logger.error({ err: error }, "POST regenerate medical card failed");
        return res.status(500).json({ error: "Failed to regenerate QR code" });
    }
});

/**
 * DELETE /api/medical-card
 * Disable/delete the authenticated user's medical card (emergency responders can't scan anymore).
 */
router.delete("/", requireAuth, async (req: AuthRequest, res) => {
    try {
        const user = req.user;
        if (!user?.linkedPatientId) {
            return res.status(400).json({ error: "You don't have a patient profile" });
        }

        const [card] = await db
            .select()
            .from(medicalCards)
            .where(eq(medicalCards.patientId, user.linkedPatientId));

        if (!card) {
            return res.status(404).json({ error: "Medical card not found" });
        }

        // Mark as not public instead of deleting
        await db
            .update(medicalCards)
            .set({
                isPublic: false,
                updatedAt: new Date(),
            })
            .where(eq(medicalCards.id, card.id));

        return res.json({ success: true, message: "Medical card disabled" });
    } catch (error) {
        logger.error({ err: error }, "DELETE medical card failed");
        return res.status(500).json({ error: "Failed to delete medical card" });
    }
});

export default router;
