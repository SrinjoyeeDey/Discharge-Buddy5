import { customFetch } from "@workspace/api-client-react";
import type { IDataProvider } from "./types";
import type { Medicine, DoseLog, SymptomLog, FollowUp, JournalEntry, Patient, PrescriptionAnalysisResult, AppUser } from "./AppContext";

export class ApiProvider implements IDataProvider {
  async getMedicines(): Promise<Medicine[]> {
    const res = await customFetch<{ medicines: Medicine[] }>("/api/medicines");
    return res.medicines;
  }

  async getTodayDoses(): Promise<DoseLog[]> {
    const res = await customFetch<{ doseLogs: DoseLog[] }>("/api/medicines/doses/today");
    return res.doseLogs;
  }

  async getAdherenceHistory(): Promise<any[]> {
    const res = await customFetch<{ history: any[] }>("/api/medicines/adherence/history");
    return res.history;
  }

  async updateDoseStatus(doseId: string, status: DoseLog["status"], snoozeMinutes?: number): Promise<void> {
    await customFetch(`/api/medicines/doses/${doseId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, snoozeMinutes })
    });
  }

  async getSymptomLogs(): Promise<SymptomLog[]> {
    const res = await customFetch<{ symptomLogs: SymptomLog[] }>("/api/activity/symptoms");
    return res.symptomLogs;
  }

  async addSymptomLog(log: SymptomLog): Promise<void> {
    await customFetch("/api/activity/symptoms", {
      method: "POST",
      body: JSON.stringify(log)
    });
  }

  async getJournalEntries(): Promise<JournalEntry[]> {
    const res = await customFetch<{ journalEntries: JournalEntry[] }>("/api/activity/journal");
    return res.journalEntries;
  }

  async addJournalEntry(entry: JournalEntry): Promise<void> {
    await customFetch("/api/activity/journal", {
      method: "POST",
      body: JSON.stringify(entry)
    });
  }

  // Not implemented on backend yet, fallback to empty array
  async getFollowUps(): Promise<FollowUp[]> {
    const res = await customFetch<{ data: FollowUp[] }>("/api/followups");
    return res.data;
  }
  
  async addFollowUp(followUp: FollowUp): Promise<void> {
    await customFetch("/api/followups", {
      method: "POST",
      body: JSON.stringify({
        title: followUp.title,
        doctorName: followUp.doctorName,
        scheduledDate: followUp.dateTime, // Map dateTime to backend's scheduledDate
        location: followUp.location,
        notes: followUp.notes,
        type: "appointment"
      })
    });
  }

  async completeFollowUp(id: string): Promise<void> {
    await customFetch(`/api/followups/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" })
    });
  }

  async simplifyInstruction(text: string): Promise<string> {
    const res = await customFetch<{ simplified: string }>("/api/language/simplify", {
      method: "POST",
      body: JSON.stringify({ text })
    });
    return res.simplified;
  }

  async getRecoveryTrends(): Promise<any> {
    const res = await customFetch("/api/recovery/trends");
    return res;
  }

  async triggerEmergency(): Promise<void> {
    await customFetch("/api/emergency", {
      method: "POST"
    });
  }

  async registerPushToken(token: string): Promise<void> {
    await customFetch("/api/auth/push-token", {
      method: "POST",
      body: JSON.stringify({ token })
    });
  }

  async getLinkedPatients(): Promise<Patient[]> {
    const res = await customFetch<{ patients: Patient[] }>("/api/caregiver/patients");
    return res.patients || [];
  }

  async getFamilyMembers(): Promise<Patient[]> {
    const res = await customFetch<{ members: Patient[] }>("/api/family/members");
    return res.members || [];
  }

  async addFamilyMember(data: any): Promise<Patient> {
    const res = await customFetch<{ member: Patient }>("/api/family/members", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.member;
  }

  async linkFamilyMember(email: string): Promise<Patient> {
    const res = await customFetch<{ member: Patient }>("/api/family/members/link", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    return res.member;
  }

  async linkPatientByCode(code: string): Promise<Patient> {
    const res = await customFetch<{ patient: Patient }>("/api/links", {
      method: "POST",
      body: JSON.stringify({ linkCode: code })
    });
    return res.patient;
  }

  async getMyLinkCode(): Promise<string> {
    const res = await customFetch<{ code: string }>("/api/links/my-code");
    return res.code;
  }

  async resetMyLinkCode(): Promise<string> {
    const res = await customFetch<{ code: string }>("/api/links/my-code/reset", {
      method: "POST"
    });
    return res.code;
  }

  async createDischargePlan(payload: any): Promise<{ planId: string }> {
    return await customFetch<{ planId: string }>("/api/caregiver/create-plan", {
      method: "POST",
      body: JSON.stringify({ data: payload }),
    });
  }

  async scanPrescription(imageBase64: string): Promise<PrescriptionAnalysisResult> {
    return await customFetch("/api/ocr/scan", {
      method: "POST",
      body: JSON.stringify({ imageBase64 }),
    });
  }

  async addMedicine(medicine: Omit<Medicine, "id">): Promise<Medicine> {
    return await customFetch<Medicine>("/api/medicines", {
      method: "POST",
      body: JSON.stringify(medicine)
    });
  }

  async updateMedicine(id: string, updates: Partial<Medicine>): Promise<void> {
    await customFetch(`/api/medicines/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates)
    });
  }

  async deleteMedicine(id: string): Promise<void> {
    await customFetch(`/api/medicines/${id}`, {
      method: "DELETE"
    });
  }

  async updateProfile(updates: Partial<AppUser>): Promise<AppUser> {
    const res = await customFetch<{ user: AppUser }>("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(updates)
    });
    return res.user;
  }

  async changePassword(old: string, newP: string): Promise<void> {
    await customFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ old, newP })
    });
  }

  async submitFeedback(type: string, message: string): Promise<void> {
    await customFetch("/api/support/feedback", {
      method: "POST",
      body: JSON.stringify({ type, message })
    });
  }

  async getDischargePlan(id: string, devData?: any): Promise<any> {
    // If it's dev mode, we pass the data in the body for normalization
    return await customFetch(`/api/discharge/${id}`, {
      method: id === "dev" ? "POST" : "GET",
      body: id === "dev" ? JSON.stringify({ data: devData }) : undefined
    });
  }

  async importDischargePlan(planId: string, mode: "merge" | "replace", devData?: any): Promise<void> {
    await customFetch("/api/discharge/import", {
      method: "POST",
      body: JSON.stringify({ planId, mode, data: devData })
    });
  }

  async generateTTS(text: string): Promise<{ audioContent: string }> {
    return await customFetch<{ audioContent: string }>("/api/ai/tts", {
      method: "POST",
      body: JSON.stringify({ text })
    });
  }

  async getChatResponse(userQuery: string, language?: string, history?: { role: "user" | "assistant"; text: string }[], screenContext?: string): Promise<{ message: string; actions: { type: string; label: string }[] }> {
    console.log("[ApiProvider] Fetching chat response for:", userQuery, "lang:", language, "history:", history?.length ?? 0, "screen:", screenContext);
    try {
      const res = await customFetch<{ message: string; actions: { type: string; label: string }[] }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ userQuery, language, history, screenContext })
      });
      console.log("[ApiProvider] Chat response received:", res);
      return res;
    } catch (err) {
      console.error("[ApiProvider] Chat request failed:", err);
      throw err;
    }
  }

  async transcribeAudio(audioBase64: string, fileExtension?: string, language?: string): Promise<string> {
    console.log("[ApiProvider] Transcribing audio...");
    try {
      const res = await customFetch<{ text: string }>("/api/ai/stt", {
        method: "POST",
        body: JSON.stringify({ audioBase64, fileExtension, language })
      });
      return res.text;
    } catch (err) {
      console.error("[ApiProvider] STT request failed:", err);
      throw err;
    }
  }

  async getIntent(text: string, context?: string): Promise<{ intent: string, target: string, confidence: number }> {
    return await customFetch<{ intent: string, target: string, confidence: number }>("/api/ai/intent", {
      method: "POST",
      body: JSON.stringify({ text, context })
    });
  }

  async sendVoiceNote(transcript: string, patientNote?: string): Promise<{ success: boolean; message: string }> {
    return await customFetch<{ success: boolean; message: string }>("/api/voice-notes", {
      method: "POST",
      body: JSON.stringify({ transcript, patientNote }),
    });
  }

}
