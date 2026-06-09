import { Router } from "express";
import { z } from "zod";
import { db, donorProfiles, bloodRequests, eq, and, desc } from "@workspace/db";
import { requireAuth, optionalAuth, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  BLOOD_TYPES,
  compatibleDonorTypes,
  haversineKm,
  isBloodType,
  type BloodType,
} from "../lib/bloodCompat";

const router = Router();

const coord = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const donorSchema = z.object({
  name: z.string().min(1),
  bloodType: z.enum(BLOOD_TYPES as [string, ...string[]]),
  phone: z.string().min(3),
  area: z.string().optional(),
  city: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isAvailable: z.boolean().optional(),
  lastDonation: z.string().optional(), // YYYY-MM-DD
});

const requestSchema = z.object({
  patientName: z.string().min(1),
  bloodType: z.enum(BLOOD_TYPES as [string, ...string[]]),
  unitsNeeded: z.number().int().min(1).max(20).optional(),
  hospital: z.string().min(1),
  area: z.string().optional(),
  city: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  urgency: z.enum(["low", "normal", "critical"]).optional(),
  contactPhone: z.string().min(3),
  note: z.string().optional(),
});

function withDistance<T extends { latitude: string | null; longitude: string | null }>(
  rows: T[],
  lat: number | null,
  lng: number | null,
): (T & { distanceKm: number | null })[] {
  return rows.map((r) => {
    let distanceKm: number | null = null;
    if (lat !== null && lng !== null && r.latitude && r.longitude) {
      distanceKm = Math.round(haversineKm(lat, lng, Number(r.latitude), Number(r.longitude)) * 10) / 10;
    }
    return { ...r, distanceKm };
  });
}

function sortByDistance<T extends { distanceKm: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    return a.distanceKm - b.distanceKm;
  });
}

// ─── Donor community ──────────────────────────────────────────────────────────

/** Join / update my donor profile in the community. */
router.post("/donors", requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = donorSchema.parse(req.body);
    const userId = req.user!.id;

    const values = {
      userId,
      name: data.name,
      bloodType: data.bloodType as BloodType,
      phone: data.phone,
      area: data.area ?? null,
      city: data.city ?? null,
      latitude: data.latitude != null ? String(data.latitude) : null,
      longitude: data.longitude != null ? String(data.longitude) : null,
      isAvailable: data.isAvailable ?? true,
      lastDonation: data.lastDonation ?? null,
    };

    const [profile] = await db
      .insert(donorProfiles)
      .values(values)
      .onConflictDoUpdate({ target: donorProfiles.userId, set: values })
      .returning();

    res.json({ profile });
  } catch (err: any) {
    logger.error({ err }, "Failed to save donor profile");
    res.status(400).json({ error: err.message || "Failed to save donor profile" });
  }
});

/** My donor profile (null if I haven't joined). */
router.get("/donors/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [profile] = await db
      .select()
      .from(donorProfiles)
      .where(eq(donorProfiles.userId, req.user!.id));
    res.json({ profile: profile ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load donor profile" });
  }
});

/**
 * Nearby community donors. Optional filters:
 *   lat,lng  -> compute distance + sort by proximity
 *   bloodType -> only donors whose blood is compatible with this recipient type
 *   radiusKm -> cap by distance (only applied when coords provided)
 */
router.get("/donors/nearby", optionalAuth, async (req, res) => {
  try {
    const lat = coord(req.query.lat);
    const lng = coord(req.query.lng);
    const radiusKm = coord(req.query.radiusKm);
    const recipient = req.query.bloodType;

    const rows = await db
      .select()
      .from(donorProfiles)
      .where(eq(donorProfiles.isAvailable, true));

    let filtered = rows;
    if (isBloodType(recipient)) {
      const allowed = new Set(compatibleDonorTypes(recipient));
      filtered = filtered.filter((d) => allowed.has(d.bloodType as BloodType));
    }

    let withDist = sortByDistance(withDistance(filtered, lat, lng));
    if (radiusKm !== null && lat !== null && lng !== null) {
      withDist = withDist.filter((d) => d.distanceKm !== null && d.distanceKm <= radiusKm);
    }

    res.json({ donors: withDist });
  } catch (err: any) {
    logger.error({ err }, "Failed to load nearby donors");
    res.status(500).json({ error: err.message || "Failed to load nearby donors" });
  }
});

// ─── Blood requests ───────────────────────────────────────────────────────────

/** Broadcast a new blood request to the community. */
router.post("/requests", requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = requestSchema.parse(req.body);
    const [request] = await db
      .insert(bloodRequests)
      .values({
        requesterId: req.user!.id,
        patientName: data.patientName,
        bloodType: data.bloodType as BloodType,
        unitsNeeded: data.unitsNeeded ?? 1,
        hospital: data.hospital,
        area: data.area ?? null,
        city: data.city ?? null,
        latitude: data.latitude != null ? String(data.latitude) : null,
        longitude: data.longitude != null ? String(data.longitude) : null,
        urgency: data.urgency ?? "normal",
        contactPhone: data.contactPhone,
        note: data.note ?? null,
      })
      .returning();

    res.json({ request });
  } catch (err: any) {
    logger.error({ err }, "Failed to create blood request");
    res.status(400).json({ error: err.message || "Failed to create blood request" });
  }
});

/** Open requests near the user (critical first, then proximity). */
router.get("/requests/nearby", optionalAuth, async (req, res) => {
  try {
    const lat = coord(req.query.lat);
    const lng = coord(req.query.lng);
    const radiusKm = coord(req.query.radiusKm);

    const rows = await db
      .select()
      .from(bloodRequests)
      .where(eq(bloodRequests.status, "open"))
      .orderBy(desc(bloodRequests.createdAt));

    let withDist = withDistance(rows, lat, lng);
    if (radiusKm !== null && lat !== null && lng !== null) {
      withDist = withDist.filter((r) => r.distanceKm !== null && r.distanceKm <= radiusKm);
    }

    // Critical requests bubble to the top, then nearest.
    const urgencyRank = { critical: 0, normal: 1, low: 2 } as const;
    withDist.sort((a, b) => {
      const u = urgencyRank[a.urgency] - urgencyRank[b.urgency];
      if (u !== 0) return u;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    res.json({ requests: withDist });
  } catch (err: any) {
    logger.error({ err }, "Failed to load nearby requests");
    res.status(500).json({ error: err.message || "Failed to load nearby requests" });
  }
});

/** Update status of a request you created (fulfilled / cancelled / open). */
router.patch("/requests/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const status = z.enum(["open", "fulfilled", "cancelled"]).parse(req.body?.status);
    const id = String(req.params.id);
    const [updated] = await db
      .update(bloodRequests)
      .set({ status })
      .where(and(eq(bloodRequests.id, id), eq(bloodRequests.requesterId, req.user!.id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Request not found or not yours" });
      return;
    }
    res.json({ request: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update request" });
  }
});

export default router;
