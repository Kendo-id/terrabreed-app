import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface SensorCardProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: number | string;
  unit: string;
  target?: number;
  color: string;
  trend?: "up" | "down" | "stable";
}

export function SensorCard({ icon, label, value, unit, target, color, trend }: SensorCardProps) {
  const colors = useColors();
  const numVal = typeof value === "string" ? parseFloat(value) : value;
  const isOk = target !== undefined
    ? Math.abs(numVal - target) <= (target * 0.03)
    : true;
  const statusColor = isOk ? colors.accent : colors.warning;
  const trendIcon = trend === "up" ? "trending-up" : trend === "down" ? "trending-down" : "minus";

  return (
    <View style={[styles.root, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: colors.foreground }]}>
            {typeof value === "number" ? value.toFixed(1) : value}
          </Text>
          <Text style={[styles.unit, { color: colors.mutedForeground }]}>{unit}</Text>
          {trend && <Feather name={trendIcon} size={14} color={statusColor} style={styles.trend} />}
        </View>
        {target !== undefined && (
          <Text style={[styles.target, { color: colors.mutedForeground }]}>
            Target:{" "}
            <Text style={{ color: statusColor, fontFamily: "Inter_600SemiBold" }}>
              {target.toFixed(1)}{unit}
            </Text>
          </Text>
        )}
      </View>
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
  label: { fontSize: 11, fontFamily: "Inter_500Medium" },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  value: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  unit: { fontSize: 12, fontFamily: "Inter_500Medium" },
  trend: { marginLeft: 2 },
  target: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statusDot: { width: 8, height: 8, borderRadius: 4, position: "absolute", top: 10, right: 10 },
});
