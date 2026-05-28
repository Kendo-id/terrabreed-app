import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Svg, { Polyline } from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import { useIncubator } from "@/context/IncubatorContext";
import { API, apiFetch } from "@/constants/api";

interface AlarmRecord {
  id: number;
  ts: number;
  type: string;
  message: string;
  value: number;
  resolved: boolean;
}

interface IncubationRecord {
  id: number;
  started_at: number;
  finished_at?: number;
  species: string;
  total_eggs: number;
  hatched?: number;
  infertile?: number;
  total_days: number;
  notes?: string;
}

type TabKey = "sensor" | "alarms" | "sessions";

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { history } = useIncubator();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [tab, setTab] = useState<TabKey>("sensor");
  const [alarms, setAlarms] = useState<AlarmRecord[]>([]);
  const [sessions, setSessions] = useState<IncubationRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAlarms = useCallback(async () => {
    try {
      const res = await apiFetch(API.alarms(50));
      if (!res.ok) return;
      const d = await res.json();
      setAlarms(d.alarms ?? []);
    } catch {}
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await apiFetch(API.sensorHistory(1440)); // last 24h metadata
      if (!res.ok) return;
      const d = await res.json();
      setSessions(d.sessions ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    if (tab === "alarms" && alarms.length === 0) fetchAlarms();
    if (tab === "sessions" && sessions.length === 0) fetchSessions();
  }, [tab]);

  const onRefresh = async () => {
    setLoading(true);
    if (tab === "alarms") await fetchAlarms();
    if (tab === "sessions") await fetchSessions();
    setLoading(false);
  };

  // Mini sparkline dari history sensor
  const SparkLine = ({ data, color, width = 120, height = 36 }: { data: number[]; color: string; width?: number; height?: number }) => {
    if (data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return (
      <Svg width={width} height={height}>
        <Polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  };

  const tempData = history.map((s) => s.temp);
  const humidData = history.map((s) => s.humidity);

  const TABS: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "sensor", label: "Grafik", icon: "activity" },
    { key: "alarms", label: "Alarm", icon: "bell" },
    { key: "sessions", label: "Sesi", icon: "archive" },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Riwayat</Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)}
            style={[styles.tabItem, tab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}>
            <Feather name={t.icon} size={16} color={tab === t.key ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.tabText, { color: tab === t.key ? colors.primary : colors.mutedForeground }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Sensor history sparklines */}
      {tab === "sensor" && (
        <FlatList
          data={[1]}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={() => (
            <View style={{ gap: 12 }}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                DATA TERAKHIR {history.length} TITIK
              </Text>

              {/* Temp chart */}
              <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.chartHeader}>
                  <Feather name="thermometer" size={14} color={colors.temperatureColor} />
                  <Text style={[styles.chartTitle, { color: colors.foreground }]}>Suhu</Text>
                  <Text style={[styles.chartVal, { color: colors.temperatureColor }]}>
                    {tempData.length ? `${tempData[tempData.length - 1].toFixed(1)}°C` : "--"}
                  </Text>
                </View>
                <View style={styles.sparkWrap}>
                  {tempData.length >= 2
                    ? <SparkLine data={tempData} color={colors.temperatureColor} width={280} height={60} />
                    : <Text style={[styles.noData, { color: colors.mutedForeground }]}>Belum ada data cukup</Text>}
                </View>
                {tempData.length >= 2 && (
                  <View style={styles.chartFooter}>
                    <Text style={[styles.chartMeta, { color: colors.mutedForeground }]}>
                      Min {Math.min(...tempData).toFixed(1)}°C  ·  Max {Math.max(...tempData).toFixed(1)}°C
                    </Text>
                  </View>
                )}
              </View>

              {/* Humidity chart */}
              <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.chartHeader}>
                  <Feather name="droplet" size={14} color={colors.humidityColor} />
                  <Text style={[styles.chartTitle, { color: colors.foreground }]}>Kelembaban</Text>
                  <Text style={[styles.chartVal, { color: colors.humidityColor }]}>
                    {humidData.length ? `${humidData[humidData.length - 1].toFixed(0)}%` : "--"}
                  </Text>
                </View>
                <View style={styles.sparkWrap}>
                  {humidData.length >= 2
                    ? <SparkLine data={humidData} color={colors.humidityColor} width={280} height={60} />
                    : <Text style={[styles.noData, { color: colors.mutedForeground }]}>Belum ada data cukup</Text>}
                </View>
                {humidData.length >= 2 && (
                  <View style={styles.chartFooter}>
                    <Text style={[styles.chartMeta, { color: colors.mutedForeground }]}>
                      Min {Math.min(...humidData).toFixed(0)}%  ·  Max {Math.max(...humidData).toFixed(0)}%
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* Alarms list */}
      {tab === "alarms" && (
        <FlatList
          data={alarms}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="bell-off" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tidak ada alarm</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.alarmItem, {
              backgroundColor: colors.card,
              borderColor: item.resolved ? colors.border : colors.destructive + "44",
              borderLeftColor: item.resolved ? colors.border : colors.destructive,
              borderLeftWidth: 3,
            }]}>
              <View style={styles.alarmRow}>
                <Feather name={item.resolved ? "check-circle" : "alert-triangle"} size={16}
                  color={item.resolved ? colors.accent : colors.destructive} />
                <Text style={[styles.alarmMsg, { color: colors.foreground }]}>{item.message}</Text>
              </View>
              <Text style={[styles.alarmMeta, { color: colors.mutedForeground }]}>
                {new Date(item.ts * 1000).toLocaleString("id-ID")}  ·  Nilai: {item.value?.toFixed?.(1) ?? item.value}
                {item.resolved ? "  ·  ✓ Teratasi" : ""}
              </Text>
            </View>
          )}
        />
      )}

      {/* Sessions list */}
      {tab === "sessions" && (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Belum ada sesi inkubasi</Text>
            </View>
          }
          renderItem={({ item }) => {
            const startDate = new Date(item.started_at * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
            const hatchRate = item.hatched && item.total_eggs
              ? ((item.hatched / item.total_eggs) * 100).toFixed(0) + "%"
              : item.finished_at ? "—" : "Aktif";
            return (
              <View style={[styles.sessionItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sessionRow}>
                  <Text style={[styles.sessionSpecies, { color: colors.foreground }]}>
                    {item.species?.charAt(0).toUpperCase()}{item.species?.slice(1)}
                  </Text>
                  <View style={[styles.sessionBadge, { backgroundColor: item.finished_at ? colors.muted : colors.accent + "22", borderColor: item.finished_at ? colors.border : colors.accent }]}>
                    <Text style={[styles.sessionBadgeText, { color: item.finished_at ? colors.mutedForeground : colors.accent }]}>
                      {item.finished_at ? "Selesai" : "Aktif"}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
                  {item.total_eggs ?? 0} telur  ·  {item.total_days} hari  ·  Mulai {startDate}
                </Text>
                {item.finished_at && (
                  <Text style={[styles.sessionResult, { color: colors.primary }]}>
                    Menetas: {item.hatched ?? 0}  ·  Infertil: {item.infertile ?? 0}  ·  Success rate: {hatchRate}
                  </Text>
                )}
                {item.notes ? <Text style={[styles.sessionNotes, { color: colors.mutedForeground }]}>{item.notes}</Text> : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 16, gap: 10 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  chartHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  chartTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  chartVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sparkWrap: { alignItems: "center" },
  chartFooter: {},
  chartMeta: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  noData: { fontSize: 12, fontFamily: "Inter_400Regular", paddingVertical: 16 },
  empty: { alignItems: "center", gap: 10, padding: 40 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  alarmItem: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  alarmRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  alarmMsg: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  alarmMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sessionItem: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  sessionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sessionSpecies: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sessionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  sessionBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  sessionMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sessionResult: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sessionNotes: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic" },
});
