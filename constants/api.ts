import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEFAULT_BASE_URL = "https://kendo-assistant.com/terrabreed";
const STORAGE_KEY = "@terrabreed_server_url";

/** Baca URL server dari AsyncStorage (sync-safe via cached value) */
let _cachedUrl: string = DEFAULT_BASE_URL;
AsyncStorage.getItem(STORAGE_KEY).then((v) => {
  if (v) _cachedUrl = v.replace(/\/$/, "");
});

export function getBaseUrl(): string {
  return _cachedUrl;
}

export const API = {
  sensorLatest:      () => `${getBaseUrl()}/api/sensor/latest`,
  sensorHistory:     (minutes: number) => `${getBaseUrl()}/api/sensor/history?minutes=${minutes}`,
  sensorStats:       () => `${getBaseUrl()}/api/sensor/stats`,
  alarms:            (limit = 20) => `${getBaseUrl()}/api/alarms?limit=${limit}`,
  chat:              () => `${getBaseUrl()}/api/chat`,
  chatClear:         () => `${getBaseUrl()}/api/chat/clear`,
  command:           () => `${getBaseUrl()}/api/command`,
  incubationCurrent: () => `${getBaseUrl()}/api/incubation/current`,
  incubationStart:   () => `${getBaseUrl()}/api/incubation/start`,
  incubationFinish:  () => `${getBaseUrl()}/api/incubation/finish`,
  settings:          () => `${getBaseUrl()}/api/settings`,
  tts:               () => `${getBaseUrl()}/api/tts`,
  stt:               () => `${getBaseUrl()}/api/stt`,
  ping:              () => `${getBaseUrl()}/api/ping`,
};

/**
 * Fetch wrapper dengan timeout.
 * Otomatis pakai URL dari AsyncStorage (sudah di-cache).
 */
export async function apiFetch(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 8000, ...rest } = options;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Coba ping satu host:port, return ms jika OK atau null jika gagal.
 * Dipakai oleh subnet scanner.
 */
export async function pingHost(baseUrl: string, timeoutMs = 3000): Promise<number | null> {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${baseUrl}/api/ping`, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok || res.status < 500) return Date.now() - start;
    return null;
  } catch {
    return null;
  }
}
