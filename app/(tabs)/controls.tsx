import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useIncubator } from "@/context/IncubatorContext";
import { ControlToggle } from "@/components/ControlToggle";
import { AlertBanner } from "@/components/AlertBanner";

export default function ControlsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { status, isConnected, sendCommand } = useIncubator();
  const [loading, setLoading] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const toggle = async (command: string, currentValue: boolean) => {
    setLoading(command);
    const ok = await sendCommand(command, !currentValue ? "on" : "off");
    if (ok) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(null);
  };

  const turnNow = async () => {
    setLoading("turn_now");
    const ok = await sendCommand("turn_now", true);
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setLoading(null);
  };

  const stopMotor = async () => {
    setLoading("motor_stop");
    const ok = await sendCommand("motor_stop", true);
    if (ok) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(null);
  };

  const reboot = () => {
    Alert.alert("Reboot ESP32", "Yakin mau reboot controller?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Reboot",
        style: "destructive",
        onPress: async () => {
          setLoading("reboot");
          await sendCommand("reboot", true);
          setLoading(null);
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Kontrol Perangkat</Text>
        <View
          style={[
            styles.modeChip,
            {
              backgroundColor: status.auto_mode
                ? colors.accent + "22"
                : colors.primary + "22",
              borderColor: status.auto_mode ? colors.accent : colors.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.modeText,
              { color: status.auto_mode ? colors.accent : colors.primary },
            ]}
          >
            {status.auto_mode ? "Mode Otomatis" : "Mode Manual"}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 90 }]}
      >
        {!isConnected && (
          <AlertBanner
            message="Tidak terhubung ke server. Perintah mungkin tidak terkirim."
            type="error"
          />
        )}

        {/* Mode Auto */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          MODE OPERASI
        </Text>
        <Pressable
          onPress={() => toggle("auto_mode", status.auto_mode)}
          style={({ pressed }) => [
            styles.bigToggle,
            {
              backgroundColor: status.auto_mode ? colors.accent + "15" : colors.card,
              borderColor: status.auto_mode ? colors.accent : colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.bigToggleIcon,
              {
                backgroundColor: status.auto_mode
                  ? colors.accent + "22"
                  : colors.muted,
              },
            ]}
          >
            <Feather
              name="cpu"
              size={26}
              color={status.auto_mode ? colors.accent : colors.mutedForeground}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bigToggleTitle, { color: colors.foreground }]}>
              Mode Otomatis
            </Text>
            <Text
              style={[styles.bigToggleSubtitle, { color: colors.mutedForeground }]}
            >
              PID kontrol suhu & kelembaban secara otomatis
            </Text>
          </View>
          <View
            style={[
              styles.pill,
              { backgroundColor: status.auto_mode ? colors.accent : colors.muted },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                {
                  color: status.auto_mode ? "#fff" : colors.mutedForeground,
                },
              ]}
            >
              {status.auto_mode ? "ON" : "OFF"}
            </Text>
          </View>
        </Pressable>

        {/* Main Actuators */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          AKTUATOR UTAMA
        </Text>
        <View style={styles.grid}>
          <ControlToggle
            icon="zap"
            label="Pemanas"
            sublabel="SSR → Elemen AC"
            active={status.heater}
            color={colors.heaterColor}
            loading={loading === "heater"}
            onToggle={() => toggle("heater", status.heater)}
          />
          <ControlToggle
            icon="droplet"
            label="Humidifier"
            sublabel="Ultrasonik 5V"
            active={status.humidifier}
            color={colors.humidityColor}
            loading={loading === "humidifier"}
            onToggle={() => toggle("humidifier", status.humidifier)}
          />
        </View>
        <View style={styles.grid}>
          <ControlToggle
            icon="wind"
            label="Kipas Sirkulasi"
            sublabel="DC 12V"
            active={status.fan}
            color={colors.fanColor}
            loading={loading === "fan"}
            onToggle={() => toggle("fan", status.fan)}
          />
          <ControlToggle
            icon="toggle-right"
            label="Relay Spare"
            sublabel="Cadangan / Lampu"
            active={status.spare ?? false}
            color={colors.secondary}
            loading={loading === "spare"}
            onToggle={() => toggle("spare", status.spare ?? false)}
          />
        </View>

        {/* Motor / Egg Turner */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          PEMBALIK RAK TELUR
        </Text>
        <View
          style={[
            styles.motorCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.motorStatus}>
            <View
              style={[
                styles.motorDot,
                {
                  backgroundColor:
                    status.motor_state === "stop"
                      ? colors.mutedForeground
                      : colors.primary,
                },
              ]}
            />
            <Text style={[styles.motorLabel, { color: colors.foreground }]}>
              Motor:{" "}
              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>
                {status.motor_state?.toUpperCase() || "STOP"}
              </Text>
            </Text>
            <Text style={[styles.trayPos, { color: colors.mutedForeground }]}>
              Posisi: {status.tray_position || (status.tray_tilted ? "Kiri" : "Kanan")}
            </Text>
          </View>

          <View style={styles.motorBtns}>
            <Pressable
              onPress={turnNow}
              disabled={loading === "turn_now"}
              style={({ pressed }) => [
                styles.motorBtn,
                {
                  backgroundColor: colors.primary + "18",
                  borderColor: colors.primary,
                  opacity: pressed || loading === "turn_now" ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="refresh-cw" size={18} color={colors.primary} />
              <Text style={[styles.motorBtnText, { color: colors.primary }]}>
                {loading === "turn_now" ? "Memutar..." : "Putar Sekarang"}
              </Text>
            </Pressable>

            <Pressable
              onPress={stopMotor}
              disabled={loading === "motor_stop"}
              style={({ pressed }) => [
                styles.motorBtn,
                {
                  backgroundColor: colors.destructive + "18",
                  borderColor: colors.destructive,
                  opacity: pressed || loading === "motor_stop" ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="square" size={18} color={colors.destructive} />
              <Text style={[styles.motorBtnText, { color: colors.destructive }]}>
                Stop Motor
              </Text>
            </Pressable>
          </View>

          <View
            style={[styles.intervalInfo, { borderTopColor: colors.border }]}
          >
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={[styles.intervalText, { color: colors.mutedForeground }]}>
              Interval {status.turn_interval_min} mnt · Durasi{" "}
              {status.turn_duration_sec} dtk
            </Text>
          </View>
        </View>

        {/* System */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          SISTEM
        </Text>
        <Pressable
          onPress={reboot}
          disabled={loading === "reboot"}
          style={({ pressed }) => [
            styles.dangerBtn,
            {
              backgroundColor: colors.destructive + "15",
              borderColor: colors.destructive + "66",
              opacity: pressed || loading === "reboot" ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="refresh-cw" size={18} color={colors.destructive} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.dangerBtnTitle, { color: colors.destructive }]}>
              {loading === "reboot" ? "Rebooting..." : "Reboot ESP32"}
            </Text>
            <Text style={[styles.dangerBtnSub, { color: colors.mutedForeground }]}>
              Restart controller — mesin tetap berjalan
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.destructive} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 8,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  modeChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  modeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 16, gap: 10 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginTop: 6,
  },
  bigToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  bigToggleIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bigToggleTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  bigToggleSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pillText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  grid: { flexDirection: "row", gap: 10 },
  motorCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  motorStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
  },
  motorDot: { width: 8, height: 8, borderRadius: 4 },
  motorLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  trayPos: { fontSize: 12, fontFamily: "Inter_400Regular" },
  motorBtns: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  motorBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  motorBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  intervalInfo: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
  },
  intervalText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  dangerBtnTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  dangerBtnSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
