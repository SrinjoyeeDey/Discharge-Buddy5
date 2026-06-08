import AsyncStorage from "@react-native-async-storage/async-storage";
import type { IDataProvider } from "./types";
import type { Medicine, DoseLog, SymptomLog, FollowUp, JournalEntry, Patient, PrescriptionAnalysisResult, AppUser } from "./AppContext";
import { ALL_ACHIEVEMENTS } from "./AppContext";

const STORAGE_KEY = "discharge_buddy_data_v2";

const DEMO_MEDICINES: Medicine[] = [
  {
    id: "m1",
    name: "Metformin",
    dosage: "500mg",
    frequency: "Twice daily",
    times: ["08:00", "20:00"],
    instructions: "Take with meals to reduce GI side effects. Monitor blood glucose regularly.",
    simplifiedInstructions: "Take this pill with breakfast and dinner. It helps control your blood sugar.",
    startDate: new Date().toISOString(),
    color: "#0891b2",
    totalPills: 60,
  },
  {
    id: "m2",
    name: "Lisinopril",
    dosage: "10mg",
    frequency: "Once daily",
    times: ["08:00"],
    instructions: "Take in the morning. Monitor blood pressure. Avoid NSAIDs.",
    simplifiedInstructions: "Take this pill every morning. It lowers your blood pressure. Avoid ibuprofen.",
    startDate: new Date().toISOString(),
    color: "#10b981",
    totalPills: 30,
  },
];

const DEMO_FOLLOW_UPS: FollowUp[] = [
  {
    id: "f1",
    title: "Cardiology Follow-up",
    doctorName: "Dr. Sarah Mitchell",
    dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    location: "City Heart Hospital, Room 204",
    notes: "Bring latest BP readings and medication list",
    completed: false,
  }
];

export const DEMO_PATIENTS: Patient[] = [
  {
    id: "p1",
    name: "Mary Smith",
    age: 68,
    condition: "Post-op Knee Replacement",
    dischargeDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    medicines: DEMO_MEDICINES,
    doseLogs: [
      { id: "dl1", medicineId: "m1", medicineName: "Metformin", scheduledTime: "08:00", takenAt: null, status: "missed", date: new Date().toISOString().split("T")[0] } as any,
      { id: "dl2", medicineId: "m2", medicineName: "Lisinopril", scheduledTime: "08:00", takenAt: null, status: "missed", date: new Date().toISOString().split("T")[0] } as any,
    ],
    symptomLogs: [
      { id: "s1", date: new Date().toISOString(), symptoms: ["Pain", "Fever"], severity: 7, notes: "Fever persisting", riskLevel: "high" }
    ],
    followUps: DEMO_FOLLOW_UPS,
    emergencyContact: "John Smith (+1 555-0101)",
  },
  {
    id: "p2",
    name: "Riya Patel",
    age: 45,
    condition: "Viral Pneumonia Recovery",
    dischargeDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    medicines: [
      { id: "m3", name: "Azithromycin", dosage: "500mg", frequency: "Once daily", times: ["09:00"], instructions: "Take with food", simplifiedInstructions: "Take with breakfast", startDate: new Date().toISOString(), color: "#f59e0b" },
    ],
    doseLogs: [
      { id: "dl3", medicineId: "m3", medicineName: "Azithromycin", scheduledTime: "09:00", takenAt: new Date().toISOString(), status: "taken", date: new Date().toISOString().split("T")[0] } as any,
    ],
    symptomLogs: [
      { id: "s2", date: new Date().toISOString(), symptoms: ["Cough"], severity: 4, notes: "Cough reducing", riskLevel: "medium" as any }
    ],
    followUps: [],
    emergencyContact: "Rahul Patel (+91 9876543210)",
  },
  {
    id: "p3",
    name: "Amit Kumar",
    age: 52,
    condition: "Post Appendectomy",
    dischargeDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    medicines: [
      { id: "m4", name: "Amoxicillin", dosage: "250mg", frequency: "Twice daily", times: ["08:00", "20:00"], instructions: "Complete the course", simplifiedInstructions: "Take with or without food", startDate: new Date().toISOString(), color: "#10b981" },
    ],
    doseLogs: [
      { id: "dl4", medicineId: "m4", medicineName: "Amoxicillin", scheduledTime: "08:00", takenAt: new Date().toISOString(), status: "taken", date: new Date().toISOString().split("T")[0] } as any,
      { id: "dl5", medicineId: "m4", medicineName: "Amoxicillin", scheduledTime: "20:00", takenAt: new Date().toISOString(), status: "taken", date: new Date().toISOString().split("T")[0] } as any,
    ],
    symptomLogs: [
      { id: "s3", date: new Date().toISOString(), symptoms: [], severity: 1, notes: "Recovering well", riskLevel: "low" }
    ],
    followUps: [],
    emergencyContact: "Sunita Kumar (+91 9123456789)",
  },
];

export class MockProvider implements IDataProvider {
  
  private async getData() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  }

  private async saveData(data: any) {
    const existing = await this.getData();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...data }));
  }

  async getMedicines(): Promise<Medicine[]> {
    const data = await this.getData();
    return data.medicines || DEMO_MEDICINES;
  }

  async getTodayDoses(): Promise<DoseLog[]> {
    const medicines = await this.getMedicines();
    const today = new Date().toISOString().split("T")[0];
    const doses: DoseLog[] = [];
    
    for (const med of medicines) {
      for (const time of med.times) {
        const [hour] = time.split(":").map(Number);
        const now = new Date();
        const status: DoseLog["status"] = hour < now.getHours() - 1 ? (Math.random() > 0.4 ? "taken" : "missed") : "pending";
        
        doses.push({
          id: `${med.id}_${time}_${today}`,
          medicineId: med.id,
          medicineName: med.name,
          scheduledTime: time,
          status,
          takenAt: status === "taken" ? new Date().toISOString() : undefined,
          date: today,
        });
      }
    }
    return doses;
  }

  async getAdherenceHistory(): Promise<any[]> {
    return [
      { date: "2024-03-18", percentage: 92 },
      { date: "2024-03-19", percentage: 100 },
      { date: "2024-03-20", percentage: 75 },
      { date: "2024-03-21", percentage: 90 },
      { date: "2024-03-22", percentage: 100 },
      { date: "2024-03-23", percentage: 85 },
      { date: "2024-03-24", percentage: 0 },
    ];
  }

  async updateDoseStatus(_doseId: string, _status: DoseLog["status"], _snoozeMinutes?: number): Promise<void> {
    await new Promise(r => setTimeout(r, 200));
  }

  async getSymptomLogs(): Promise<SymptomLog[]> {
    const data = await this.getData();
    return data.symptomLogs || [];
  }

  async addSymptomLog(log: SymptomLog): Promise<void> {
    const logs = await this.getSymptomLogs();
    await this.saveData({ symptomLogs: [log, ...logs] });
  }

  async getJournalEntries(): Promise<JournalEntry[]> {
    const data = await this.getData();
    return data.journalEntries || [];
  }

  async addJournalEntry(entry: JournalEntry): Promise<void> {
    const entries = await this.getJournalEntries();
    await this.saveData({ journalEntries: [entry, ...entries] });
  }

  async getFollowUps(): Promise<FollowUp[]> {
    const data = await this.getData();
    return data.followUps || DEMO_FOLLOW_UPS;
  }

  async addFollowUp(followUp: FollowUp): Promise<void> {
    const followUps = await this.getFollowUps();
    await this.saveData({ followUps: [followUp, ...followUps] });
  }

  async completeFollowUp(id: string): Promise<void> {
    const followUps = await this.getFollowUps();
    const updated = followUps.map(f => f.id === id ? { ...f, completed: true } : f);
    await this.saveData({ followUps: updated });
  }

  async simplifyInstruction(text: string): Promise<string> {
    return text + " (Simplified)";
  }

  async getRecoveryTrends(): Promise<any> {
    return { data: [] };
  }

  async triggerEmergency(): Promise<void> {
    console.log("Mock emergency triggered");
  }

  async registerPushToken(token: string): Promise<void> {
    console.log("Mock push token registered:", token);
  }

  async getLinkedPatients(): Promise<Patient[]> {
    return DEMO_PATIENTS;
  }

  async getFamilyMembers(): Promise<Patient[]> {
    const data = await this.getData();
    return data.familyMembers || [];
  }

  async addFamilyMember(memberData: any): Promise<Patient> {
    const members = await this.getFamilyMembers();
    const newMember: Patient = {
      id: `fm_${Date.now()}`,
      name: memberData.name,
      age: parseInt(memberData.age) || 0,
      condition: memberData.condition || "Healthy",
      dischargeDate: new Date().toISOString(),
      emergencyContact: memberData.emergencyContact || "Unknown",
      caregiverId: "local-family-user",
      createdAt: new Date().toISOString(),
    };
    await this.saveData({ familyMembers: [...members, newMember] });
    return newMember;
  }

  async linkFamilyMember(_email: string): Promise<Patient> {
    // In mock mode, simulate a successful link
    const mockLinked: Patient = {
      id: `linked_${Date.now()}`,
      name: "Linked Family Member",
      age: 40,
      condition: "Recovering",
      dischargeDate: new Date().toISOString(),
      emergencyContact: "Unknown",
      caregiverId: "local-family-user",
      createdAt: new Date().toISOString(),
    };
    const members = await this.getFamilyMembers();
    await this.saveData({ familyMembers: [...members, mockLinked] });
    return mockLinked;
  }

  async linkPatientByCode(_code: string): Promise<Patient> {
    const normalized = _code.trim().toUpperCase();
    const patients = DEMO_PATIENTS;
    let target: Patient | undefined;

    if (normalized === "DB-DEMO12") {
      target = patients[0];
    } else if (normalized === "DB-DEMO34") {
      target = patients[1] || patients[0];
    } else {
      // If the code is unknown, simulate an invalid code error.
      const error: any = new Error("INVALID_CODE");
      error.status = 404;
      throw error;
    }

    const members = await this.getFamilyMembers();
    const alreadyLinked = members.find(m => m.id === target?.id);
    if (alreadyLinked && target) {
      return alreadyLinked;
    }

    if (target) {
      await this.saveData({ familyMembers: [...members, target] });
      return target;
    }

    throw new Error("Failed to link patient");
  }

  async getMyLinkCode(): Promise<string> {
    return "DB-DEMO12";
  }

  async resetMyLinkCode(): Promise<string> {
    return "DB-DEMO34";
  }

  async scanPrescription(_imageBase64: string): Promise<PrescriptionAnalysisResult> {
    await new Promise(r => setTimeout(r, 1500));
    return {
      medicines: [
        {
          name: "Amlodipine",
          dosage: "5mg",
          frequency: "Once daily",
          duration: "30 days",
          timing: "Morning",
          notes: "For blood pressure",
          confidence: 95,
          low_confidence: false,
          simplifiedInstructions: "Take this pill every morning. It controls blood pressure.",
          times: ["08:00"]
        }
      ],
      general_instructions: "Take as directed.",
      explanation: "This is a mock prescription result.",
      warnings: [],
      overall_confidence: 95,
      ocr_source: "mock",
      processing_note: "Mock result for development"
    };
  }

  async addMedicine(medData: Omit<Medicine, "id">): Promise<Medicine> {
    const medicines = await this.getMedicines();
    const newMed: Medicine = {
      ...medData,
      id: `m_${Date.now()}`
    };
    await this.saveData({ medicines: [newMed, ...medicines] });
    return newMed;
  }

  async updateMedicine(id: string, updates: Partial<Medicine>): Promise<void> {
    const medicines = await this.getMedicines();
    const updated = medicines.map(m => m.id === id ? { ...m, ...updates } : m);
    await this.saveData({ medicines: updated });
  }

  async deleteMedicine(id: string): Promise<void> {
    const meds = await this.getMedicines();
    await this.saveData({ medicines: meds.filter(m => m.id !== id) });
  }

  async updateProfile(updates: Partial<AppUser>): Promise<AppUser> {
    const data = await this.getData();
    const currentUser = data.user || { id: "u1", name: "User", email: "user@example.com", role: "patient" };
    const updatedUser = { 
      ...currentUser, 
      ...updates 
    };
    await this.saveData({ user: updatedUser });
    return updatedUser;
  }

  async changePassword(_old: string, _newP: string): Promise<void> {
    await new Promise(r => setTimeout(r, 600));
  }

  async submitFeedback(_type: string, _message: string): Promise<void> {
    console.log("Mock feedback submitted:", { _type, _message });
    await new Promise(r => setTimeout(r, 800));
  }

  async getDischargePlan(id: string, devData?: any): Promise<any> {
    if (id === "dev") return devData;
    return {
      patientName: "John Doe",
      medicines: [
        { name: "Paracetamol", dosage: "500mg", frequency: "BD", duration: 5 }
      ]
    };
  }

  async importDischargePlan(_planId: string, _mode: "merge" | "replace", _devData?: any): Promise<void> {
    await new Promise(r => setTimeout(r, 1000));
  }

  async createDischargePlan(payload: any): Promise<{ planId: string }> {
    return { planId: "mock-plan-id" };
  }

  async generateTTS(text: string): Promise<{ audioContent: string }> {
    console.log("Mock TTS generating for:", text);
    return { audioContent: "" }; // Return empty in mock
  }

  async getChatResponse(query: string, language?: string, history?: { role: "user" | "assistant"; text: string }[], screenContext?: string): Promise<{ message: string; actions: { type: string; label: string }[] }> {
    await new Promise(r => setTimeout(r, 1000));
    return {
      message: "I'm Mr. Meddy (Mock Fallback). It looks like I'm not connected to the live server right now, but I can still help you with demo features!",
      actions: [
        { type: "LOG_SYMPTOM", label: "Log Symptom" },
        { type: "START_MEDITATION", label: "Start Calm Session" }
      ]
    };
  }

  async transcribeAudio(audioBase64: string, fileExtension?: string, language?: string): Promise<string> {
    return "This is a mocked transcription of your audio.";
  }

  async getIntent(text: string, context?: string): Promise<{ intent: string, target: string, confidence: number }> {
    return { intent: "UNKNOWN", target: "", confidence: 1.0 };
  }

  async sendVoiceNote(transcript: string, patientNote?: string): Promise<{ success: boolean; message: string }> {
    console.log("[MockProvider] sendVoiceNote:", transcript, patientNote);
    return { success: true, message: "Note sent (mock)" };
  }

  async scheduleVoiceReminder(data: { patientId: string; medicineName?: string; messageText: string; audioBase64?: string; scheduledTime: string }): Promise<{ success: boolean; reminder: any }> {
    console.log("[MockProvider] scheduleVoiceReminder:", data);
    return { success: true, reminder: { id: "mock-reminder-id", ...data, isDelivered: false, createdAt: new Date().toISOString() } };
  }

  async getScheduledVoiceReminders(): Promise<any[]> {
    return [];
  }

  async getDueVoiceReminders(): Promise<any[]> {
    return [];
  }

  async markVoiceReminderDelivered(id: string): Promise<void> {
    console.log("[MockProvider] markVoiceReminderDelivered:", id);
  }
}
