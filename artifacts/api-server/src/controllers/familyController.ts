import { Request, Response } from "express";
import { db, patients, users, medicines, doseLogs, symptomLogs, followUps, eq, inArray } from "@workspace/db";
import type { AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getManagedPatients } from "../lib/managedPatients";

export class FamilyController {
  /**
   * GET /api/family/members
   * Returns all patients linked to the family user
   */
  static async getMembers(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const linkedPatients = await getManagedPatients(req.user.id);
      if (linkedPatients.length === 0) {
        return res.json({ members: [] });
      }

      const patientIds = linkedPatients.map(p => p.id);

      // Fetch all nested relations in parallel
      const [allMedicines, allSymptomLogs, allFollowUps] = await Promise.all([
        db.select().from(medicines).where(inArray(medicines.patientId, patientIds)),
        db.select().from(symptomLogs).where(inArray(symptomLogs.patientId, patientIds)),
        db.select().from(followUps).where(inArray(followUps.patientId, patientIds)),
      ]);

      const allMedicineIds = allMedicines.map(m => m.id);
      const allDoseLogs = allMedicineIds.length > 0 
        ? await db.select().from(doseLogs).where(inArray(doseLogs.medicineId, allMedicineIds))
        : [];

      const formattedMembers = linkedPatients.map(p => {
        const pMeds = allMedicines.filter(m => m.patientId === p.id);
        const medIds = pMeds.map(m => m.id);
        const pDoseLogs = allDoseLogs.filter(d => medIds.includes(d.medicineId));
        const pSymptomLogs = allSymptomLogs.filter(s => s.patientId === p.id);
        const pFollowUps = allFollowUps.filter(f => f.patientId === p.id);

        return {
          ...p,
          medicines: pMeds,
          doseLogs: pDoseLogs,
          symptomLogs: pSymptomLogs,
          followUps: pFollowUps
        };
      });

      return res.json({ members: formattedMembers });
    } catch (error: any) {
      logger.error({ error: error.message }, "[FamilyController] getMembers failed");
      return res.status(500).json({ error: "Failed to fetch family members", detail: error.message });
    }
  }

  /**
   * POST /api/family/members
   * Manually adds a new family member (patient)
   */
  static async addMember(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const { name, age, condition, emergencyContact } = req.body;

      if (!name) return res.status(400).json({ error: "Name is required" });

      const [newPatient] = await db.insert(patients).values({
        name,
        age: age ? parseInt(age) : 0,
        condition: condition || "Healthy",
        dischargeDate: new Date(),
        emergencyContact: emergencyContact || req.user.phone || "Unknown",
        caregiverId: req.user.id,
      }).returning();

      return res.status(201).json({ member: newPatient });
    } catch (error: any) {
      logger.error({ error: error.message }, "[FamilyController] addMember failed");
      return res.status(500).json({ error: "Failed to add family member", detail: error.message });
    }
  }

  /**
   * POST /api/family/members/link
   * Links an existing patient account via email (Option 2)
   */
  static async linkMember(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      // Find the patient user by email
      const [patientUser] = await db.select().from(users).where(eq(users.email, email));
      if (!patientUser || patientUser.role !== "patient") {
        return res.status(404).json({ error: "Patient account not found with this email" });
      }

      if (!patientUser.linkedPatientId) {
         return res.status(400).json({ error: "This patient account is not fully set up." });
      }

      // Link the caregiver ID of the patient record to this family user
      const [updatedPatient] = await db.update(patients)
        .set({ caregiverId: req.user.id })
        .where(eq(patients.id, patientUser.linkedPatientId))
        .returning();

      return res.json({ success: true, member: updatedPatient });
    } catch (error: any) {
      logger.error({ error: error.message }, "[FamilyController] linkMember failed");
      return res.status(500).json({ error: "Failed to link family member", detail: error.message });
    }
  }
}
