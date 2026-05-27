import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import { useIncubator } from "@/context/IncubatorContext";
import { API, apiFetch } from "@/constants/api";

const SPECIES_INFO: Record<string, { days: number; emoji: string; tempRange: string; humidRange: string }> = {
  ayam:   { days: 21, emoji: "🐔", tempRange: "37.5–38°C", humidRange: "55–65%" },
  bebek:  { days: 28, emoji: "🦆", tempRange: "37.5–38°C", humidRange: "60–70%" },
  puyuh:  { days: 17, emoji: "🪺", tempRange: "37.5–38°C", humidRange: "50–60%" },
  angsa:  { days: 30, emoji: "🪿", tempRange: "37.5–38°C", humidRange: "55–65%" },
  kalkun: { days: 28, emoji: "🦃", tempRange: "37.5–38°C", humidRange: "55–65%" },
};

/**
 * ProgressRing menggunakan SVG strokeDashoffset — arc benar sesuai progress.
 * Fix dari versi lama yang hanya pakai border View.
 */
function ProgressRing({
  progress,
  size,
  color,
  bgColor,
}: {
  progress: number;
  size: number;
  color: string;
  bgColor: string;
}) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(1, Math.max(0, progress));
  // Arc dimulai dari atas (rotate -90deg)
  const dashOffset = circumference * (1 - clampedProgress);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        {/* Track */}
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={bgColor} strokeWidth={strokeWidth} fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation={-90} origin={`${cx},${cy}`}
        />
      </Svg>
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color }}>
          {Math.round(clampedProgress * 100)}%
        </Text>
        <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color, opacity: 0.7 }}>
          selesai
        </Text>
      </View>
    </View>
  );
}

export default function IncubationDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { incubation, refreshNow } = useIncubator();
  const [finishModalVisible, setFinishModalVisible] = useState(false);
  const [hatchedInput, setHatchedInput] = useState("0");
  const [infertileInput, setInfertileInput] = useState("0");
  const [finishing, setFinishing] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const info = incubation.species ? SPECIES_INFO[incubation.species.toLowerCase()] : null;
  const progress =
    incubation.elapsed_days && incubation.total_days
      ? Math.min(1, incubation.elapsed_days / incubation.total_days)
      : 0;

  const daysLeft =
    incubation.total_days && incubation.elapsed_days !== undefined
      ? Math.max(0, incubation.total_days - incubation.elapsed_days)
      : null;

  const startedDate = incubation.started_at
    ? new Date(incubation.started_at * 1000).toLocaleDateString("id-ID", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const expectedHatch =
    incubation.started_at && incubation.total_days
      ? new Date((incubation.started_at + incubation.total_days * 86400) * 1000).toLocaleDateString(
          "id-ID", { day: "numeric", month: "long", year: "numeric" }
        )
      : null;

  const confirmFinish = async () => {
    if (!incubation.id) return;
    setFinishing(true);
    try {
      await apiFetch(API.incubationFinish, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:        incubation.id,
          hatched:   parseInt(hatchedInput)   || 0,
          infertile: parseInt(infertileInput) || 0,
          notes:     "",
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFinishModalVisible(false);
      refreshNow();
      Alert.alert(
        "Sesi Selesai",
        `Menetas: ${hatchedInput} | Infertil: ${infertileInput}`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch {
      Alert.alert("Error", "Gagal menyimpan hasil inkubasi.");
    } finally {
      setFinishing(false);
    }
  };

  if (!incubation.active) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Sesi Inkubasi</Text>
        </View>
        <View style={styles.emptyCenter}>
          <Feather name="inbox" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.foreground }]}>Tidak ada sesi aktif</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Mulai sesi baru melalui TERRA AI atau Pengaturan.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Finish Modal */}
      <Modal visible={finishModalVisible} transparent animationType="fade" onRequestClose={() => setFinishModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Selesaikan Sesi</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Masukkan hasil akhir penetasan.
            </Text>
            {[
              { label: "Telur menetas", val: hatchedInput, set: setHatchedInput },
              { label: "Telur infertil", val: infertileInput, set: setInfertileInput },
            ].map((f) => (
              <View key={f.label} style={[styles.modalInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.modalInputLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                <TextInput
                  value={f.val}
                  onChangeText={f.set}
                  keyboardType="numeric"
                  style={[styles.modalInputField, { color: colors.foreground }]}
                  selectTextOnFocus
                />
              </View>
            ))}
            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setFinishModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Batal</Text>
              </Pressable>
              <Pressable
                onPress={confirmFinish}
                disabled={finishing}
                style={[styles.modalBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>{finishing ? "..." : "Simpan"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <LinearGradient
        colors={[colors.card, colors.background]}
        style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {info?.emoji ?? "🥚"} Sesi Inkubasi
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {incubation.species?.charAt(0).toUpperCase()}{incubation.species?.slice(1)} · {incubation.total_eggs ?? 0} telur
          </Text>
        </View>
        <View style={[styles.activeBadge, { backgroundColor: colors.accent + "22", borderColor: colors.accent }]}>
          <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
          <Text style={[styles.activeText, { color: colors.accent }]}>Aktif</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.progressRow}>
            <ProgressRing progress={progress} size={100} color={colors.primary} bgColor={colors.primary + "22"} />
            <View style={styles.progressInfo}>
              <View style={styles.progressStat}>
                <Text style={[styles.progressStatValue, { color: colors.foreground }]}>Hari {incubation.elapsed_days}</Text>
                <Text style={[styles.progressStatLabel, { color: colors.mutedForeground }]}>dari {incubation.total_days} hari</Text>
              </View>
              <View style={[styles.dividerH, { backgroundColor: colors.border }]} />
              <View style={styles.progressStat}>
                <Text style={[styles.progressStatValue, { color: daysLeft === 0 ? colors.accent : colors.foreground }]}>
                  {daysLeft === 0 ? "Siap menetas!" : `${daysLeft} hari lagi`}
                </Text>
                <Text style={[styles.progressStatLabel, { color: colors.mutedForeground }]}>perkiraan menetas</Text>
              </View>
            </View>
          </View>
          <View style={[styles.progressBarOuter, { backgroundColor: colors.primary + "22" }]}>
            <View style={[styles.progressBarInner, { backgroundColor: colors.primary, width: `${progress * 100}%` as `${number}%` }]} />
          </View>
        </View>

        {/* Detail */}
        <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DETAIL SESI</Text>
          {[
            { icon: "calendar", label: "Mulai Inkubasi", value: startedDate || "--" },
            { icon: "clock", label: "Perkiraan Menetas", value: expectedHatch || "--" },
            { icon: "package", label: "Jumlah Telur", value: `${incubation.total_eggs ?? 0} butir` },
            { icon: "tag", label: "Spesies", value: `${info?.emoji ?? ""} ${incubation.species?.charAt(0).toUpperCase()}${incubation.species?.slice(1) || "--"}` },
            ...(incubation.notes ? [{ icon: "file-text", label: "Catatan", value: incubation.notes }] : []),
          ].map((row, i, arr) => (
            <React.Fragment key={row.label}>
              <View style={styles.detailRow}>
                <View style={[styles.detailIcon, { backgroundColor: colors.muted }]}>
                  <Feather name={row.icon as any} size={14} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{row.value}</Text>
              </View>
              {i < arr.length - 1 && <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* Species guide */}
        {info && (
          <View style={[styles.speciesCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
            <Text style={[styles.sectionLabel, { color: colors.primary + "99" }]}>
              PANDUAN {incubation.species?.toUpperCase()}
            </Text>
            <View style={styles.speciesGrid}>
              {[
                { icon: "thermometer", label: "Suhu Ideal", value: info.tempRange },
                { icon: "droplet", label: "Kelembaban", value: info.humidRange },
                { icon: "clock", label: "Durasi Total", value: `${info.days} hari` },
              ].map((item) => (
                <View key={item.label} style={[styles.speciesItem, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name={item.icon as any} size={16} color={colors.primary} />
                  <Text style={[styles.speciesItemValue, { color: colors.foreground }]}>{item.value}</Text>
                  <Text style={[styles.speciesItemLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Milestones */}
        <View style={[styles.milestoneCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MILESTONE</Text>
          {getMilestones(incubation.species || "", incubation.total_days || 21).map((m) => {
            const passed = (incubation.elapsed_days || 0) >= m.day;
            return (
              <View key={m.day} style={styles.milestone}>
                <View style={[styles.milestoneDot, {
                  backgroundColor: passed ? colors.accent : colors.border,
                  borderColor: passed ? colors.accent : colors.border,
                }]}>
                  {passed && <Feather name="check" size={10} color="#fff" />}
                </View>
                <View style={styles.milestoneInfo}>
                  <Text style={[styles.milestoneDay, { color: passed ? colors.accent : colors.mutedForeground }]}>Hari {m.day}</Text>
                  <Text style={[styles.milestoneDesc, { color: colors.foreground }]}>{m.label}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Finish button */}
        <Pressable
          onPress={() => { setHatchedInput("0"); setInfertileInput("0"); setFinishModalVisible(true); }}
          style={({ pressed }) => [styles.finishBtn, {
            backgroundColor: colors.accent + "18",
            borderColor: colors.accent,
            opacity: pressed ? 0.7 : 1,
          }]}
        >
          <Feather name="check-circle" size={20} color={colors.accent} />
          <Text style={[styles.finishBtnText, { color: colors.accent }]}>Selesaikan Sesi Inkubasi</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function getMilestones(species: string, totalDays: number) {
  const r = totalDays / 21;
  return [
    { day: 1,                    label: "Inkubasi dimulai" },
    { day: Math.round(3 * r),    label: "Embrio mulai berkembang" },
    { day: Math.round(7 * r),    label: "Detak jantung terdeteksi" },
    { day: Math.round(14 * r),   label: "Bulu mulai tumbuh" },
    { day: Math.round(18 * r),   label: "Stop balik telur, naikkan kelembaban" },
    { day: totalDays,            label: "Perkiraan menetas 🐣" },
  ];
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 16, gap: 12 },
  emptyCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  progressCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  progressInfo: { flex: 1, gap: 8 },
  progressStat: { gap: 2 },
  progressStatValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  progressStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  dividerH: { height: 1 },
  progressBarOuter: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressBarInner: { height: 8, borderRadius: 4 },
  detailCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 12 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  detailIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  detailLabel: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  detailValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right", maxWidth: "55%" },
  detailDivider: { height: 1, marginLeft: 38 },
  speciesCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  speciesGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  speciesItem: { flex: 1, minWidth: 80, alignItems: "center", gap: 4, padding: 12, borderRadius: 12 },
  speciesItemValue: { fontSize: 13, fontFamily: "Inter_700Bold" },
  speciesItemLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  milestoneCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  milestone: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  milestoneDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  milestoneInfo: { flex: 1 },
  milestoneDay: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  milestoneDesc: { fontSize: 13, fontFamily: "Inter_400Regular" },
  finishBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 16, borderWidth: 1.5 },
  finishBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalBox: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 24, gap: 14 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  modalInput: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 12, borderWidth: 1 },
  modalInputLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  modalInputField: { fontSize: 20, fontFamily: "Inter_700Bold", minWidth: 60, textAlign: "right" },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  modalBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
