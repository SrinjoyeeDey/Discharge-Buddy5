import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Tiny JSON-on-AsyncStorage cache so feature screens can keep working in poor
 * network / rural conditions by falling back to the last good payload.
 */
const PREFIX = "db_cache_";

export async function cacheSet(key: string, data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(`${PREFIX}${key}`, JSON.stringify({ at: Date.now(), data }));
  } catch (e) {
    console.warn("[offlineCache] set failed", key, e);
  }
}

export async function cacheGet<T>(key: string): Promise<{ data: T; at: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { data: parsed.data as T, at: parsed.at as number };
  } catch (e) {
    console.warn("[offlineCache] get failed", key, e);
    return null;
  }
}

export const CACHE_KEYS = {
  donors: "blood_donors",
  bloodRequests: "blood_requests",
  drugCheck: "drug_check",
  emergencyInfo: "emergency_info",
} as const;
