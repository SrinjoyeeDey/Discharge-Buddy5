import type { Medicine, DoseLog, SymptomLog, FollowUp, JournalEntry, Patient, PrescriptionAnalysisResult, AppUser } from "./AppContext";

export interface IDataProvider {
  getMedicines(): Promise<Medicine[]>;
  getTodayDoses(): Promise<DoseLog[]>;
  getAdherenceHistory(): Promise<any[]>;
  updateDoseStatus(doseId: string, status: DoseLog["status"], snoozeMinutes?: number): Promise<void>;
  
  getSymptomLogs(): Promise<SymptomLog[]>;
  addSymptomLog(log: SymptomLog): Promise<void>;
  
  getJournalEntries(): Promise<JournalEntry[]>;
  addJournalEntry(entry: JournalEntry): Promise<void>;
  
  getFollowUps(): Promise<FollowUp[]>;
  addFollowUp(followUp: FollowUp): Promise<void>;
  completeFollowUp(id: string): Promise<void>;

  simplifyInstruction(text: string): Promise<string>;
  getRecoveryTrends(): Promise<any>;

  triggerEmergency(): Promise<void>;
  registerPushToken(token: string): Promise<void>;
  getLinkedPatients(): Promise<Patient[]>;
  getFamilyMembers(): Promise<Patient[]>;
  addFamilyMember(data: any): Promise<Patient>;
  linkFamilyMember(email: string): Promise<Patient>;
  linkPatientByCode(code: string): Promise<Patient>;
  getMyLinkCode(): Promise<string>;
  resetMyLinkCode(): Promise<string>;
  scanPrescription(imageBase64: string): Promise<PrescriptionAnalysisResult>;
  addMedicine(medicine: Omit<Medicine, "id">): Promise<Medicine>;
  updateMedicine(id: string, updates: Partial<Medicine>): Promise<void>;
  deleteMedicine(id: string): Promise<void>;
  
  updateProfile(updates: Partial<AppUser>): Promise<AppUser>;
  changePassword(old: string, newP: string): Promise<void>;
  submitFeedback(type: string, message: string): Promise<void>;
  getDischargePlan(id: string, devData?: any): Promise<any>;
  importDischargePlan(planId: string, mode: "merge" | "replace", devData?: any): Promise<void>;
  createDischargePlan(payload: any): Promise<{ planId: string }>;
  generateTTS(text: string): Promise<{ audioContent: string }>;
  getChatResponse(query: string, language?: string, history?: { role: "user" | "assistant"; text: string }[], screenContext?: string): Promise<{ message: string; actions: { type: string; label: string }[] }>;
  transcribeAudio(audioBase64: string, fileExtension?: string, language?: string): Promise<string>;
  getIntent(text: string, context?: string): Promise<{ intent: string, target: string, confidence: number }>;
  sendVoiceNote(transcript: string, patientNote?: string): Promise<{ success: boolean; message: string }>;
  scheduleVoiceReminder(data: { patientId: string; medicineName?: string; messageText: string; audioBase64?: string; scheduledTime: string }): Promise<{ success: boolean; reminder: any }>;
  getScheduledVoiceReminders(): Promise<any[]>;
  getDueVoiceReminders(): Promise<any[]>;
  markVoiceReminderDelivered(id: string): Promise<void>;
}
