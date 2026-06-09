export type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export const BLOOD_TYPES: BloodType[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// For a given recipient blood type, the donor types whose blood can be safely
// transfused into them. O- is the universal donor; AB+ is the universal recipient.
const DONORS_FOR_RECIPIENT: Record<BloodType, BloodType[]> = {
  "O-": ["O-"],
  "O+": ["O-", "O+"],
  "A-": ["O-", "A-"],
  "A+": ["O-", "O+", "A-", "A+"],
  "B-": ["O-", "B-"],
  "B+": ["O-", "O+", "B-", "B+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
};

/** Donor blood types that can donate to the given recipient type. */
export function compatibleDonorTypes(recipient: BloodType): BloodType[] {
  return DONORS_FOR_RECIPIENT[recipient] ?? [];
}

/** Whether a donor of `donorType` can give to a recipient of `recipientType`. */
export function canDonate(donorType: BloodType, recipientType: BloodType): boolean {
  return compatibleDonorTypes(recipientType).includes(donorType);
}

export function isBloodType(value: unknown): value is BloodType {
  return typeof value === "string" && (BLOOD_TYPES as string[]).includes(value);
}

/** Great-circle distance between two lat/lng points in kilometres (Haversine). */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
