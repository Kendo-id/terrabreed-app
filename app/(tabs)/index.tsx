import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Svg, { Path, Line, Text as SvgText, Circle } from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import { router } from "expo-router";
import { useServer } from "@/context/ServerContext";
import { useIncubator } from "@/context/IncubatorContext";
import { GaugeCircle } from "@/components/GaugeCircle";
import { SensorCard } from "@/components/SensorCard";
import { AlertBanner } from "@/components/AlertBanner";

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = SCREEN_W - 56;
const CHART_H = 90;
const PAD = { left: 28, right: 8, top: 8, bottom: 16 };

function LiveChart({
  data,
  valueKey,
  color,
  min,
  max,
  unit,
}: {
  data: Array<{ ts: number; temp: number; humidity: number }>;
  valueKey: "temp" | "humidity";
  color: string;
  min: number;
  max: number;
  unit: string;
}) {
  const colors = useColors();
  if (data.length < 2) {
    return (
      <View style={{ height: CHART_H, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }}>
          Mengumpulkan data...
        </Text>
      </View>
    );
  }

  const w = CHART_W - PAD.left - PAD.right;
  const h = CHART_H - PAD.top - PAD.bottom;

  const normalize = (v: number) => {
    const pct = Math.max(0, Math.min(1, (v - min) / (max - min)));
    return PAD.top + h * (1 - pct);
  };

  const points = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1)) * w,
    y: normalize(d[valueKey]),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + h} L${PAD.left},${PAD.top + h} Z`;

  const yLabels = [min, max];
  const latest = data[data.length - 1][valueKey];

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {yLabels.map((v) => (
        <Line
          key={v}
          x1={PAD.left}
          x2={CHART_W - PAD.right}
          y1={normalize(v)}
          y2={normalize(v)}
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="3,4"
        />
      ))}
      {yLabels.map((v) => (
        <SvgText key={v} x={PAD.left - 3} y={normalize(v) + 4} fontSize={8} fill={colors.mutedForeground} textAnchor="end">
          {v}{unit}
        </SvgText>
      ))}
      <Path d={areaPath} fill={color + "28"} />
      <Path d={linePath} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={4}
        fill={color}
      />
      <SvgText
        x={points[points.length - 1].x + 6}
        y={points[points.length - 1].y + 4}
        fontSize={9}
        fill={color}
        fontWeight="bold"
      >
        {latest.toFixed(1)}{unit}
      </SvgText>
    </Svg>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { serverUrl } = useServer();
  const { sensor, status, incubation, history, isConnected, isLoading, lastUpdated, refreshNow } = useIncubator();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshNow();
    setTimeout(() => setRefreshing(false), 1000);
  }, [refreshNow]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const formatTime = (d: Date | null) => {
    if (!d) return "--";
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const incubationProgress = incubation.active && incubation.elapsed_days && incubation.total_days
    ? Math.min(1, incubation.elapsed_days / incubation.total_days)
    : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.card, colors.background]}
        style={[styles.header, { paddingTop: topPad + 12 }]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>TerraBreed</Text>
            <View style={styles.connRow}>
              <View style={[styles.connDot, { backgroundColor: isConnected ? colors.accent : colors.destructive }]} />
              <Text style={[styles.connLabel, { color: colors.mutedForeground }]}>
                {isConnected ? `Update ${formatTime(lastUpdated)}` : "Tidak terhubung"}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push("/history")} style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="bar-chart-2" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        {incubation.active && (
          <Pressable
            onPress={() => router.push("/incubation-detail")}
            style={({ pressed }) => [styles.incubationBadge, {
              backgroundColor: colors.primary + "22",
              borderColor: colors.primary + "44",
              opacity: pressed ? 0.8 : 1,
            }]}
          >
            <Feather name="clock" size={13} color={colors.primary} />
            <Text style={[styles.incubationText, { color: colors.primary }]}>
              {incubation.species?.charAt(0).toUpperCase()}{incubation.species?.slice(1)} · Hari ke-{incubation.elapsed_days}/{incubation.total_days} · {incubation.total_eggs ?? 0} telur
            </Text>
            <View style={[styles.progressBarOuter, { backgroundColor: colors.primary + "30" }]}>
              <View style={[styles.progressBarInner, { backgroundColor: colors.primary, width: `${incubationProgress * 100}%` as `${number}%` }]} />
            </View>
            <Feather name="chevron-right" size={13} color={colors.primary} />
          </Pressable>
        )}
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 90 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {!isConnected && !isLoading && (
          <AlertBanner
            message="Gagal terhubung ke server. Pastikan jaringan aktif."
            type="error"
          />
        )}

        {/* Main Gauges */}
        <View style={styles.gaugesRow}>
          <GaugeCircle
            value={sensor.temp}
            min={30}
            max={45}
            target={sensor.target_temp}
            unit="°C"
            label="Suhu Aktif"
            color={colors.temperatureColor}
            size={160}
          />
          <GaugeCircle
            value={sensor.humidity}
            min={20}
            max={100}
            target={sensor.target_humid}
            unit="%"
            label="Kelembaban"
            color={colors.humidityColor}
            size={160}
          />
        </View>

        {/* Target Bar */}
        <View style={[styles.targetBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.targetItem}>
            <Feather name="target" size={14} color={colors.mutedForeground} />
            <Text style={[styles.targetLabel, { color: colors.mutedForeground }]}>Target Suhu</Text>
            <Text style={[styles.targetValue, { color: colors.temperatureColor }]}>{sensor.target_temp}°C</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.targetItem}>
            <Feather name="droplet" size={14} color={colors.mutedForeground} />
            <Text style={[styles.targetLabel, { color: colors.mutedForeground }]}>Target Lembab</Text>
            <Text style={[styles.targetValue, { color: colors.humidityColor }]}>{sensor.target_humid}%</Text>
          </View>
        </View>

        {/* Live Chart Widget */}
        <View style={[styles.chartWidget, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.chartWidgetHeader}>
            <Feather name="activity" size={15} color={colors.temperatureColor} />
            <Text style={[styles.chartWidgetTitle, { color: colors.foreground }]}>Live Monitoring</Text>
            <Text style={[styles.chartWidgetCount, { color: colors.mutedForeground }]}>
              {history.length} poin
            </Text>
          </View>

          <Text style={[styles.chartSubLabel, { color: colors.mutedForeground }]}>Suhu (°C)</Text>
          <LiveChart
            data={history}
            valueKey="temp"
            color={colors.temperatureColor}
            min={34}
            max={42}
            unit="°"
          />

          <View style={[styles.chartDivider, { backgroundColor: colors.border }]} />

          <Text style={[styles.chartSubLabel, { color: colors.mutedForeground }]}>Kelembaban (%)</Text>
          <LiveChart
            data={history}
            valueKey="humidity"
            color={colors.humidityColor}
            min={30}
            max={90}
            unit="%"
          />
        </View>

        {/* Sensor Cards Row 1 */}
        <View style={styles.cardRow}>
          <SensorCard
            icon="thermometer"
            label="DS18B20 #1"
            value={sensor.temp_ds1.toFixed(1)}
            unit="°C"
            color={colors.temperatureColor}
            status={Math.abs(sensor.temp_ds1 - sensor.target_temp) <= 1 ? "ok" : "warn"}
          />
          <SensorCard
            icon="thermometer"
            label="DS18B20 #2"
            value={sensor.temp_ds2.toFixed(1)}
            unit="°C"
            color={colors.temperatureColor}
            status={Math.abs(sensor.temp_ds2 - sensor.target_temp) <= 1 ? "ok" : "warn"}
          />
        </View>

        {/* Sensor Cards Row 2 */}
        <View style={styles.cardRow}>
          <SensorCard
            icon="wind"
            label="SHT31"
            value={sensor.temp_sht.toFixed(1)}
            unit="°C"
            color={colors.fanColor}
            status="ok"
          />
          <SensorCard
            icon="layers"
            label="Posisi Rak"
            value={status.tray_position || (status.tray_tilted ? "Kiri" : "Kanan")}
            unit=""
            color={colors.accent}
            subtitle={`Motor: ${status.motor_state}`}
          />
        </View>

        {/* Device Status */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>STATUS PERANGKAT</Text>
        <View style={styles.deviceGrid}>
          {[
            { label: "Pemanas", icon: "zap" as const, active: status.heater, color: colors.heaterColor },
            { label: "Humidifier", icon: "droplet" as const, active: status.humidifier, color: colors.humidityColor },
            { label: "Kipas", icon: "wind" as const, active: status.fan, color: colors.fanColor },
            { label: "Mode Auto", icon: "cpu" as const, active: status.auto_mode, color: colors.primary },
          ].map((item) => (
            <View key={item.label} style={[styles.deviceChip, {
              backgroundColor: item.active ? item.color + "18" : colors.card,
              borderColor: item.active ? item.color + "66" : colors.border,
            }]}>
              <Feather name={item.icon} size={14} color={item.active ? item.color : colors.mutedForeground} />
              <Text style={[styles.deviceChipLabel, { color: item.active ? item.color : colors.mutedForeground }]}>
                {item.label}
              </Text>
              <Text style={[styles.deviceChipStatus, { color: item.active ? item.color : colors.mutedForeground }]}>
                {item.active ? "ON" : "OFF"}
              </Text>
            </View>
          ))}
        </View>

        {/* Interval Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Interval Balik</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{status.turn_interval_min} menit</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Feather name="clock" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Durasi Motor</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{status.turn_duration_sec} detik</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  connRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  connDot: { width: 7, height: 7, borderRadius: 4 },
  connLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  incubationBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  incubationText: { fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 },
  progressBarOuter: { width: 40, height: 4, borderRadius: 2, overflow: "hidden" },
  progressBarInner: { height: 4, borderRadius: 2 },
  scroll: { padding: 16, gap: 12 },
  gaugesRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 8 },
  targetBar: { flexDirection: "row", borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  targetItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, padding: 12 },
  targetLabel: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  targetValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  divider: { width: 1 },
  chartWidget: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 6 },
  chartWidgetHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  chartWidgetTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  chartWidgetCount: { fontSize: 11, fontFamily: "Inter_400Regular" },
  chartSubLabel: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
  chartDivider: { height: 1, marginVertical: 4 },
  cardRow: { flexDirection: "row", gap: 10 },
  sectionTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginTop: 4 },
  deviceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  deviceChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  deviceChipLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  deviceChipStatus: { fontSize: 11, fontFamily: "Inter_700Bold" },
  infoCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  infoLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
