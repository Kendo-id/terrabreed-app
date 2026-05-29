import React, { useEffect, useRef, useState } from "react";
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
  Switch,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";

import { useColors } from "@/hooks/useColors";
import { router } from "expo-router";
import { useServer } from "@/context/ServerContext";
import { useIncubator } from "@/context/IncubatorContext";
import { API, apiFetch } from "@/constants/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type SpeciesKey = "ayam" | "bebek" | "kalkun" | "puyuh" | "angsa" | "custom";

const SPECIES_PRESETS: Record<SpeciesKey, { temp: number; humid: number; days: number; label: string }> = {
  ayam:   { temp: 37.5, humid: 60, days: 21, label: "Ayam Kampung" },
  bebek:  { temp: 37.8, humid: 65, days: 28, label: "Bebek" },
  kalkun: { temp: 37.5, humid: 60, days: 28, label: "Kalkun" },
  puyuh:  { temp: 37.5, humid: 60, days: 17, label: "Puyuh" },
  angsa:  { temp: 37.6, humid: 65, days: 30, label: "Angsa" },
  custom: { temp: 37.5, humid: 60, days: 21, label: "Custom" },
};

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sensor, status, incubation, isConnected, refreshNow } = useIncubator();
  const { serverUrl } = useServer();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // isDirty: true saat user sedang edit — cegah useEffect reset input
  const isDirty = useRef(false);

  const [targetTemp, setTargetTemp] = useState(String(sensor.target_temp));
  const [targetHumid, setTargetHumid] = useState(String(sensor.target_humid));
  const [turnInterval, setTurnInterval] = useState(String(status.turn_interval_min));
  const [turnDuration, setTurnDuration] = useState(String(status.turn_duration_sec));
  const [widgetEnabled, setWidgetEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  // Incubation form
  const [species, setSpecies] = useState<SpeciesKey>("ayam");
  const [totalEggs, setTotalEggs] = useState("100");
  const [sessionNotes, setSessionNotes] = useState("");
  const [startingSession, setStartingSession] = useState(false);

  // Modal untuk finish incubation (ganti Alert.prompt yang crash di Android)
  const [finishModalVisible, setFinishModalVisible] = useState(false);
  const [hatchedInput, setHatchedInput] = useState("0");
  const [infertileInput, setInfertileInput] = useState("0");
  const [finishing, setFinishing] = useState(false);

  // Notification widget update interval
  const notifInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync input dari server HANYA jika user tidak sedang mengetik
  useEffect(() => {
    if (!isDirty.current) {
      setTargetTemp(String(sensor.target_temp));
      setTargetHumid(String(sensor.target_humid));
      setTurnInterval(String(status.turn_interval_min));
      setTurnDuration(String(status.turn_duration_sec));
    }
  }, [sensor.target_temp, sensor.target_humid, status.turn_interval_min, status.turn_duration_sec]);

  // Update notifikasi widget secara periodik
  useEffect(() => {
    if (widgetEnabled) {
      const updateNotif = async () => {
        await Notifications.scheduleNotificationAsync({
          identifier: "terrabreed-widget",
          content: {
            title: "TerraBreed Monitor",
            body: `Suhu: ${sensor.temp.toFixed(1)}°C | Lembab: ${sensor.humidity.toFixed(0)}% | ${status.auto_mode ? "Auto" : "Manual"}`,
            sticky: true,
            data: { type: "widget" },
          },
          trigger: null,
        }).catch(() => {});
      };
      updateNotif();
      notifInterval.current = setInterval(updateNotif, 5000);
    }
    return () => {
      if (notifInterval.current) clearInterval(notifInterval.current);
    };
  }, [widgetEnabled, sensor.temp, sensor.humidity, status.auto_mode]);

  const saveSettings = async () => {
    setSaving(true);
    isDirty.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiFetch(API.settings, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_temp:    parseFloat(targetTemp)   || sensor.target_temp,
          target_humid:   parseFloat(targetHumid)  || sensor.target_humid,
          turn_interval:  parseInt(turnInterval)   || status.turn_interval_min,
          turn_duration:  parseInt(turnDuration)   || status.turn_duration_sec,
        }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      refreshNow();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Error", "Gagal menyimpan pengaturan. Cek koneksi ke server.");
    } finally {
      setSaving(false);
    }
  };

  const startIncubation = async () => {
    const preset = SPECIES_PRESETS[species];
    setStartingSession(true);
    try {
      const res = await apiFetch(API.incubationStart, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          species,
          total_days: preset.days,
          total_eggs: parseInt(totalEggs) || 0,
          notes: sessionNotes,
          source: "mobile_app",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        refreshNow();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Sesi Dimulai", `Inkubasi ${preset.label} (${totalEggs} telur) berhasil dibuat.`);
      }
    } catch {
      Alert.alert("Error", "Gagal membuat sesi inkubasi. Cek koneksi.");
    } finally {
      setStartingSession(false);
    }
  };

  // Ganti Alert.prompt → custom Modal (karena Alert.prompt tidak ada di Android)
  const openFinishModal = () => {
    if (!incubation.active) return;
    setHatchedInput("0");
    setInfertileInput("0");
    setFinishModalVisible(true);
  };

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
      setFinishModalVisible(false);
      refreshNow();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Selesai", `Sesi inkubasi berhasil ditutup. Menetas: ${hatchedInput}, infertil: ${infertileInput}.`);
    } catch {
      Alert.alert("Error", "Gagal menutup sesi inkubasi.");
    } finally {
      setFinishing(false);
    }
  };

  const toggleWidget = async (val: boolean) => {
    setWidgetEnabled(val);
    if (val) {
      const { status: permStatus } = await Notifications.requestPermissionsAsync();
      if (permStatus !== "granted") {
        setWidgetEnabled(false);
        Alert.alert("Izin Diperlukan", "Aktifkan notifikasi untuk widget suhu.");
        return;
      }
    } else {
      if (notifInterval.current) clearInterval(notifInterval.current);
      await Notifications.cancelScheduledNotificationAsync("terrabreed-widget").catch(() => {});
      await Notifications.dismissAllNotificationsAsync();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Finish Modal — cross-platform, ganti Alert.prompt */}
      <Modal
        visible={finishModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFinishModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Selesaikan Inkubasi</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Masukkan hasil penetasan untuk catatan statistik.
            </Text>

            <View style={[styles.modalInput, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Text style={[styles.modalInputLabel, { color: colors.mutedForeground }]}>Telur menetas</Text>
              <TextInput
                value={hatchedInput}
                onChangeText={setHatchedInput}
                keyboardType="numeric"
                style={[styles.modalInputField, { color: colors.foreground }]}
                selectTextOnFocus
              />
            </View>
            <View style={[styles.modalInput, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Text style={[styles.modalInputLabel, { color: colors.mutedForeground }]}>Telur infertil</Text>
              <TextInput
                value={infertileInput}
                onChangeText={setInfertileInput}
                keyboardType="numeric"
                style={[styles.modalInputField, { color: colors.foreground }]}
                selectTextOnFocus
              />
            </View>

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
                style={[styles.modalBtn, { backgroundColor: colors.destructive, borderColor: colors.destructive }]}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  {finishing ? "Menyimpan..." : "Selesaikan"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Pengaturan</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 90 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Widget */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>WIDGET HOMESCREEN</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.widgetIcon, { backgroundColor: colors.primary + "22" }]}>
              <Feather name="thermometer" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardLabel, { color: colors.foreground }]}>Notifikasi Suhu Real-time</Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                {widgetEnabled
                  ? `${sensor.temp.toFixed(1)}°C | ${sensor.humidity.toFixed(0)}% — update tiap 5 detik`
                  : "Tampilkan suhu & kelembaban di panel notifikasi"}
              </Text>
            </View>
            <Switch
              value={widgetEnabled}
              onValueChange={toggleWidget}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Sesi Inkubasi */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SESI INKUBASI</Text>
        {incubation.active ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.row}>
              <Feather name="clock" size={18} color={colors.accent} />
              <Text style={[styles.cardLabel, { color: colors.foreground }]}>Sesi Aktif</Text>
            </View>
            <View style={styles.sessionInfo}>
              <Text style={[styles.sessionSpecies, { color: colors.primary }]}>
                {incubation.species?.charAt(0).toUpperCase()}{incubation.species?.slice(1)}
              </Text>
              <Text style={[styles.sessionDetail, { color: colors.mutedForeground }]}>
                {incubation.total_eggs ?? 0} telur · Hari ke-{incubation.elapsed_days}/{incubation.total_days}
              </Text>
            </View>
            <Pressable
              onPress={openFinishModal}
              style={({ pressed }) => [styles.finishBtn, {
                backgroundColor: colors.destructive + "18",
                borderColor: colors.destructive,
                opacity: pressed ? 0.8 : 1,
              }]}
            >
              <Feather name="check-circle" size={16} color={colors.destructive} />
              <Text style={[styles.finishBtnText, { color: colors.destructive }]}>Selesaikan Inkubasi</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.foreground }]}>Buat Sesi Baru</Text>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Jenis Hewan</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(Object.keys(SPECIES_PRESETS) as SpeciesKey[]).map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => setSpecies(k)}
                    style={[styles.speciesChip, {
                      backgroundColor: species === k ? colors.primary + "22" : colors.muted,
                      borderColor: species === k ? colors.primary : colors.border,
                    }]}
                  >
                    <Text style={[styles.speciesChipText, { color: species === k ? colors.primary : colors.mutedForeground }]}>
                      {SPECIES_PRESETS[k].label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View style={[styles.numInput, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Text style={[styles.numInputLabel, { color: colors.mutedForeground }]}>Jumlah Telur</Text>
              <TextInput
                value={totalEggs}
                onChangeText={setTotalEggs}
                keyboardType="numeric"
                style={[styles.numInputField, { color: colors.foreground }]}
              />
            </View>

            <TextInput
              value={sessionNotes}
              onChangeText={setSessionNotes}
              placeholder="Catatan (opsional)..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.notesInput, { backgroundColor: colors.muted, color: colors.foreground }]}
            />

            {species !== "custom" && (
              <View style={[styles.presetInfo, { backgroundColor: colors.accent + "11" }]}>
                <Text style={[styles.presetInfoText, { color: colors.mutedForeground }]}>
                  Preset: {SPECIES_PRESETS[species].temp}°C · {SPECIES_PRESETS[species].humid}% · {SPECIES_PRESETS[species].days} hari
                </Text>
              </View>
            )}

            <Pressable
              onPress={startIncubation}
              disabled={startingSession}
              style={({ pressed }) => [styles.startBtn, { backgroundColor: colors.primary, opacity: pressed || startingSession ? 0.8 : 1 }]}
            >
              <Feather name="play" size={16} color="#fff" />
              <Text style={styles.startBtnText}>{startingSession ? "Memulai..." : "Mulai Inkubasi"}</Text>
            </Pressable>
          </View>
        )}

        {/* ESP32 Settings */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PENGATURAN ESP32</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: "Target Suhu", value: targetTemp, onChange: setTargetTemp, unit: "°C" },
            { label: "Target Kelembaban", value: targetHumid, onChange: setTargetHumid, unit: "%" },
            { label: "Interval Balik", value: turnInterval, onChange: setTurnInterval, unit: "menit" },
            { label: "Durasi Motor", value: turnDuration, onChange: setTurnDuration, unit: "detik" },
          ].map((f) => (
            <View key={f.label} style={[styles.numInput, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.numInputLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <TextInput
                  value={f.value}
                  onChangeText={(v) => { isDirty.current = true; f.onChange(v); }}
                  onBlur={() => { isDirty.current = false; }}
                  keyboardType="numeric"
                  style={[styles.numInputField, { color: colors.foreground }]}
                />
                <Text style={[styles.numInputUnit, { color: colors.mutedForeground }]}>{f.unit}</Text>
              </View>
            </View>
          ))}

          <Pressable
            onPress={saveSettings}
            disabled={saving}
            style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary, opacity: pressed || saving ? 0.8 : 1 }]}
          >
            <Feather name="save" size={16} color="#fff" />
            <Text style={styles.saveBtnText}>{saving ? "Menyimpan..." : "Simpan Pengaturan"}</Text>
          </Pressable>
        </View>

        {/* Server Info */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>INFO SERVER</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Feather name="server" size={14} color={colors.mutedForeground} />
            <Text style={[styles.cardSub, { color: colors.mutedForeground, flex: 1 }]} numberOfLines={1}>
              {serverUrl.replace("https://","").replace("http://","")}
            </Text>
            <View style={[styles.connDot, { backgroundColor: isConnected ? colors.accent : colors.destructive }]} />
            <Text style={[styles.connText, { color: isConnected ? colors.accent : colors.destructive }]}>
              {isConnected ? "Terhubung" : "Offline"}
            </Text>
          </View>
          {[
            { icon: "cpu" as const,   text: "ESP32 · incubator_01" },
            { icon: "radio" as const, text: "MQTT · 10.10.10.1:1883" },
            { icon: "shield" as const, text: "HTTPS + self-signed cert" },
          ].map((r) => (
            <View key={r.text} style={styles.row}>
              <Feather name={r.icon} size={14} color={colors.mutedForeground} />
              <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{r.text}</Text>
            </View>
          ))}
          <Pressable
            onPress={() => router.push("/server-setup")}
            style={({ pressed }) => [styles.changeServerBtn, {
              backgroundColor: colors.primary + "15",
              borderColor: colors.primary + "44",
              opacity: pressed ? 0.8 : 1,
            }]}
          >
            <Feather name="settings" size={14} color={colors.primary} />
            <Text style={[styles.changeServerText, { color: colors.primary }]}>Ganti / Scan Server</Text>
            <Feather name="chevron-right" size={14} color={colors.primary} style={{ marginLeft: "auto" }} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  scroll: { padding: 16, gap: 10 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginTop: 6 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  widgetIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sessionInfo: { gap: 4 },
  sessionSpecies: { fontSize: 20, fontFamily: "Inter_700Bold" },
  sessionDetail: { fontSize: 13, fontFamily: "Inter_400Regular" },
  finishBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  finishBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },
  speciesChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  speciesChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  numInput: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 12, borderWidth: 1 },
  numInputLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  numInputField: { fontSize: 16, fontFamily: "Inter_700Bold", minWidth: 50, textAlign: "right" },
  numInputUnit: { fontSize: 12, fontFamily: "Inter_400Regular" },
  notesInput: { borderRadius: 12, padding: 12, fontSize: 13, fontFamily: "Inter_400Regular" },
  presetInfo: { padding: 10, borderRadius: 10 },
  presetInfoText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12 },
  startBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalBox: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 24, gap: 14 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  modalInput: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 12, borderWidth: 1 },
  modalInputLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  modalInputField: { fontSize: 20, fontFamily: "Inter_700Bold", minWidth: 60, textAlign: "right" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  modalBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  connDot: { width: 7, height: 7, borderRadius: 4 },
  connText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  changeServerBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  changeServerText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
