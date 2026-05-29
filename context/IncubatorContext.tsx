import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { API, apiFetch } from "@/constants/api";

export interface SensorData {
  temp: number;
  temp_ds1: number;
  temp_ds2: number;
  temp_sht: number;
  humidity: number;
  target_temp: number;
  target_humid: number;
}

export interface DeviceStatus {
  heater: boolean;
  humidifier: boolean;
  fan: boolean;
  spare: boolean;
  auto_mode: boolean;
  tray_tilted: boolean;
  tray_position: string;
  motor_state: string;
  turn_interval_min: number;
  turn_duration_sec: number;
}

export interface IncubationSession {
  active: boolean;
  id?: number;
  started_at?: number;
  species?: string;
  total_days?: number;
  total_eggs?: number;
  elapsed_days?: number;
  notes?: string;
}

export interface SensorSnapshot {
  ts: number;
  temp: number;
  humidity: number;
}

const DEFAULT_SENSOR: SensorData = {
  temp: 0, temp_ds1: 0, temp_ds2: 0, temp_sht: 0,
  humidity: 0, target_temp: 37.5, target_humid: 60,
};

const DEFAULT_STATUS: DeviceStatus = {
  heater: false, humidifier: false, fan: false, spare: false,
  auto_mode: true, tray_tilted: false, tray_position: "center",
  motor_state: "stop", turn_interval_min: 120, turn_duration_sec: 8,
};

const MAX_HISTORY = 60;
const POLL_INTERVAL_MS = 3000;

interface IncubatorContextType {
  sensor: SensorData;
  status: DeviceStatus;
  incubation: IncubationSession;
  history: SensorSnapshot[];
  isConnected: boolean;
  isLoading: boolean;
  lastUpdated: Date | null;
  errorMsg: string | null;
  sendCommand: (command: string, value: unknown) => Promise<boolean>;
  refreshNow: () => void;
}

const IncubatorContext = createContext<IncubatorContextType | null>(null);

export function IncubatorProvider({ children }: { children: React.ReactNode }) {
  const [sensor, setSensor] = useState<SensorData>(DEFAULT_SENSOR);
  const [status, setStatus] = useState<DeviceStatus>(DEFAULT_STATUS);
  const [incubation, setIncubation] = useState<IncubationSession>({ active: false });
  const [history, setHistory] = useState<SensorSnapshot[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>("active");

  const fetchSensorData = useCallback(async () => {
    try {
      const res = await apiFetch(API.sensorLatest(), { timeoutMs: 5000 });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (data.sensor) {
        setSensor((prev) => {
          const next = { ...prev, ...data.sensor };
          setHistory((h) => {
            const snap: SensorSnapshot = { ts: Date.now(), temp: next.temp, humidity: next.humidity };
            const updated = [...h, snap];
            return updated.length > MAX_HISTORY ? updated.slice(updated.length - MAX_HISTORY) : updated;
          });
          return next;
        });
      }
      if (data.status) setStatus((prev) => ({ ...prev, ...data.status }));
      setIsConnected(true);
      setErrorMsg(null);
      setLastUpdated(new Date());
    } catch (e: unknown) {
      setIsConnected(false);
      const isTimeout = e instanceof Error && e.name === "AbortError";
      setErrorMsg(isTimeout
        ? "Timeout. Server tidak merespons dalam 5 detik."
        : "Gagal terhubung ke server. Pastikan jaringan aktif.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchIncubation = useCallback(async () => {
    try {
      const res = await apiFetch(API.incubationCurrent(), { timeoutMs: 5000 });
      if (!res.ok) return;
      const data = await res.json();
      setIncubation(data);
    } catch {}
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    fetchSensorData();
    pollRef.current = setInterval(() => {
      if (appStateRef.current === "active") fetchSensorData();
    }, POLL_INTERVAL_MS);
  }, [fetchSensorData]);

  useEffect(() => {
    startPolling();
    fetchIncubation();
    const incPoll = setInterval(() => {
      if (appStateRef.current === "active") fetchIncubation();
    }, 30000);
    const sub = AppState.addEventListener("change", (next) => {
      appStateRef.current = next;
      if (next === "active") { fetchSensorData(); fetchIncubation(); }
    });
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearInterval(incPoll);
      sub.remove();
    };
  }, [startPolling, fetchSensorData, fetchIncubation]);

  const sendCommand = useCallback(async (command: string, value: unknown): Promise<boolean> => {
    try {
      const res = await apiFetch(API.command(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, value }),
        timeoutMs: 5000,
      });
      if (!res.ok) return false;
      const data = await res.json();
      await fetchSensorData();
      return data.ok === true;
    } catch { return false; }
  }, [fetchSensorData]);

  const refreshNow = useCallback(() => {
    fetchSensorData();
    fetchIncubation();
  }, [fetchSensorData, fetchIncubation]);

  return (
    <IncubatorContext.Provider value={{
      sensor, status, incubation, history, isConnected,
      isLoading, lastUpdated, errorMsg, sendCommand, refreshNow,
    }}>
      {children}
    </IncubatorContext.Provider>
  );
}

export function useIncubator() {
  const ctx = useContext(IncubatorContext);
  if (!ctx) throw new Error("useIncubator must be used within IncubatorProvider");
  return ctx;
}
