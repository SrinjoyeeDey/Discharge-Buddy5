import { pgTable, text, integer, timestamp, boolean, pgEnum, uuid, varchar, date, decimal, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["patient", "caregiver", "family", "doctor"]);
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);
export const doseStatusEnum = pgEnum("dose_status", ["taken", "missed", "pending", "snoozed"]);
export const linkRelationshipEnum = pgEnum("link_relationship", ["family", "caregiver"]);
export const linkStatusEnum = pgEnum("link_status", ["active", "revoked"]);
export const bloodTypeEnum = pgEnum("blood_type", ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
export const bloodUrgencyEnum = pgEnum("blood_urgency", ["low", "normal", "critical"]);
export const bloodRequestStatusEnum = pgEnum("blood_request_status", ["open", "fulfilled", "cancelled"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role"),
  linkedPatientId: uuid("linked_patient_id"),
  bloodType: text("blood_type"),
  allergies: text("allergies"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  phone: text("phone"),
  avatar: text("avatar"),
  password: text("password"),
  pushToken: text("push_token"),
  hospital: text("hospital"),
  designation: text("designation"),
  department: text("department"),
  registrationNumber: text("registration_number"),
  specialization: text("specialization"),
  relationshipPreference: text("relationship_preference"),
  anchorTimes: jsonb("anchor_times").default({
    morning: "08:00",
    afternoon: "14:00",
    evening: "20:00",
    night: "22:00"
  }),
  isEmailVerified: boolean("is_email_verified").default(false).notNull(),
  emailVerificationCode: text("email_verification_code"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  caregiverId: uuid("caregiver_id").references(() => users.id), // Legacy single-manager link (kept for notifications)
  name: text("name").notNull(),
  age: integer("age").notNull(),
  condition: text("condition").notNull(),
  dischargeDate: timestamp("discharge_date").notNull(),
  emergencyContact: text("emergency_contact").notNull(),
  linkCode: varchar("link_code", { length: 12 }).unique(), // Shareable code (e.g. DB-7G4K2P)
  linkCodeIssuedAt: timestamp("link_code_issued_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Many-to-many: which managers (family / caregiver users) are linked to a patient.
export const careLinks = pgTable("care_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  managerId: uuid("manager_id").references(() => users.id).notNull(),
  relationship: linkRelationshipEnum("relationship").notNull(),
  status: linkStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqPatientManager: unique("care_links_patient_manager_unique").on(t.patientId, t.managerId),
}));

export const medicines = pgTable("medicines", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  name: text("name").notNull(),
  dosage: text("dosage").notNull(),
  frequency: text("frequency").notNull(),
  times: text("times").array().notNull(), // Array of strings like ["08:00", "20:00"]
  instructions: text("instructions"),
  simplifiedInstructions: text("simplified_instructions"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  color: text("color").default("#0891b2"),
  totalPills: integer("total_pills"),
  status: text("status", { enum: ["active", "archived"] }).default("active").notNull(),
  planId: uuid("plan_id"), // Optional link to a specific discharge plan
});

export const doseLogs = pgTable("dose_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  medicineId: uuid("medicine_id").references(() => medicines.id).notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  takenAt: timestamp("taken_at"),
  status: doseStatusEnum("status").default("pending").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  snoozedUntil: timestamp("snoozed_until"),
  lastNotifiedAt: timestamp("last_notified_at"),
  escalatedToCaregiver: boolean("escalated_to_caregiver").default(false),
});

export const symptomLogs = pgTable("symptom_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  date: timestamp("date").defaultNow().notNull(),
  symptoms: text("symptoms").array().notNull(),
  severity: integer("severity").notNull(),
  notes: text("notes"),
  riskLevel: riskLevelEnum("risk_level").notNull(),
});

export const followUps = pgTable("follow_ups", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  title: text("title").notNull(),
  doctorName: text("doctor_name").notNull(),
  dateTime: timestamp("date_time").notNull(),
  location: text("location").notNull(),
  notes: text("notes"),
  completed: boolean("completed").default(false).notNull(),
});

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  date: timestamp("date").defaultNow().notNull(),
  mood: integer("mood").notNull(),
  energy: integer("energy").notNull(),
  text: text("text").notNull(),
});

export const emergencyAlerts = pgTable("emergency_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  status: text("status").default("active").notNull(),
});

// Follow-up Manager
export const followups = pgTable("followups", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  reminderDaysBefore: integer("reminder_days_before").default(1),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).default('upcoming'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Language Simplifier
export const medicalTermsDictionary = pgTable("medical_terms_dictionary", {
  id: uuid("id").primaryKey().defaultRandom(),
  abbreviation: varchar("abbreviation", { length: 50 }).notNull().unique(),
  simpleMeaning: varchar("simple_meaning", { length: 255 }).notNull(),
  fullTerm: varchar("full_term", { length: 255 }),
  category: varchar("category", { length: 50 }),
});

// Recovery Tracker
export const recoveryLogs = pgTable("recovery_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  logDate: date("log_date").notNull(),
  painLevel: integer("pain_level"),
  energyLevel: integer("energy_level"),
  fever: boolean("fever").default(false),
  feverTemp: decimal("fever_temp", { precision: 4, scale: 1 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  unq: unique().on(t.userId, t.logDate),
}));

// Data Storage
export const prescriptions = pgTable("prescriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  imageUrl: text("image_url"),
  rawText: text("raw_text"),
  extractedData: jsonb("extracted_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Feedback & Support
export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Discharge Plans & Versioning
export const dischargePlans = pgTable("discharge_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  hospitalName: text("hospital_name"),
  data: jsonb("data").notNull(), // The raw plan JSON
  version: integer("version").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Scheduled Voice Reminders for Caregivers/Family to Patients
export const scheduledVoiceReminders = pgTable("scheduled_voice_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id").references(() => users.id).notNull(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  medicineName: text("medicine_name"),
  messageText: text("message_text").notNull(),
  audioBase64: text("audio_base64"),
  scheduledTime: timestamp("scheduled_time").notNull(),
  isDelivered: boolean("is_delivered").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Emergency Blood Network — community donor registry (location-aware)
export const donorProfiles = pgTable("donor_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id), // null for seeded community members
  name: text("name").notNull(),
  bloodType: bloodTypeEnum("blood_type").notNull(),
  phone: text("phone").notNull(),
  area: text("area"), // neighbourhood / locality
  city: text("city"),
  latitude: decimal("latitude", { precision: 9, scale: 6 }),
  longitude: decimal("longitude", { precision: 9, scale: 6 }),
  isAvailable: boolean("is_available").default(true).notNull(),
  lastDonation: date("last_donation"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqUser: unique("donor_profiles_user_unique").on(t.userId),
}));

// Emergency Blood Network — blood requests broadcast to the nearby community
export const bloodRequests = pgTable("blood_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  requesterId: uuid("requester_id").references(() => users.id), // null for seeded demo requests
  patientName: text("patient_name").notNull(),
  bloodType: bloodTypeEnum("blood_type").notNull(),
  unitsNeeded: integer("units_needed").default(1).notNull(),
  hospital: text("hospital").notNull(),
  area: text("area"),
  city: text("city"),
  latitude: decimal("latitude", { precision: 9, scale: 6 }),
  longitude: decimal("longitude", { precision: 9, scale: 6 }),
  urgency: bloodUrgencyEnum("urgency").default("normal").notNull(),
  contactPhone: text("contact_phone").notNull(),
  note: text("note"),
  status: bloodRequestStatusEnum("status").default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertPatientSchema = createInsertSchema(patients);
export const insertMedicineSchema = createInsertSchema(medicines);
export const insertDoseLogSchema = createInsertSchema(doseLogs);
export const insertSymptomLogSchema = createInsertSchema(symptomLogs);
export const insertFollowUpSchema = createInsertSchema(followUps);
export const insertJournalEntrySchema = createInsertSchema(journalEntries);
export const insertEmergencyAlertSchema = createInsertSchema(emergencyAlerts);
export const insertFollowupSchema = createInsertSchema(followups);
export const insertRecoveryLogSchema = createInsertSchema(recoveryLogs);
export const insertPrescriptionSchema = createInsertSchema(prescriptions);
export const insertFeedbackSchema = createInsertSchema(feedback);
export const insertDischargePlanSchema = createInsertSchema(dischargePlans);
export const insertScheduledVoiceReminderSchema = createInsertSchema(scheduledVoiceReminders);
export const selectScheduledVoiceReminderSchema = createSelectSchema(scheduledVoiceReminders);
export const insertDonorProfileSchema = createInsertSchema(donorProfiles);
export const insertBloodRequestSchema = createInsertSchema(bloodRequests);
