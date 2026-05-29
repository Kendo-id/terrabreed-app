/**
 * ServerSetup
 * Full-screen modal untuk:
 * 1. Input URL server manual
 * 2. Scan subnet WiFi untuk cari TerraBreed server
 *
 * Dipanggil dari dashboard saat isConnected = false atau belum ada config.
 */
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useServer, DEFAULT_URL } from "@/context/ServerContext";
import { pingHost } from "@/constants/api";
import * as Network from "expo-network";

interface ScanResult {
  url: string;
  ms: number;
  ip: string;
}

interface Props {
  onDismiss?: () => void;
}

const PORTS = [5000, 5001, 8000, 8080, 443, 80];
const PATHS = ["/terrabreed", ""];

export function ServerSetup({ onDismiss }: Props) {
  const colors = useColors();
  const { serverUrl, saveServerUrl } = useServer();

  const [manualUrl, setManualUrl] = useState(serverUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [testMs, setTestMs] = useState<number | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const cancelRef = useRef(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── Test koneksi manual ──────────────────────────────────────────
  const testConnection = async () => {
    const url = manualUrl.trim().replace(/\/$/, "");
    if (!url) return;
    setTesting(true);
    setTestResult(null);
    const ms = await pingHost(url, 5000);
    if (ms !== null) {
      setTestResult("ok");
      setTestMs(ms);
    } else {
      setTestResult("fail");
      setTestMs(null);
    }
    setTesting(false);
  };

  const saveManual = async () => {
    const url = manualUrl.trim().replace(/\/$/, "");
    if (!url) return;
    setTesting(true);
    const ms = await pingHost(url, 6000);
    setTesting(false);
    if (ms !== null) {
      await saveServerUrl(url);
      onDismiss?.();
    } else {
      Alert.alert(
        "Tidak Terjangkau",
        `Tidak bisa terhubung ke:\n${url}\n\nPastikan:\n• HP terhubung WiFi yang sama\n• Server TerraBreed sudah menyala\n• URL/port sudah benar`,
        [
          { text: "Tetap Simpan", onPress: async () => { await saveServerUrl(url); onDismiss?.(); } },
          { text: "Coba Lagi", style: "cancel" },
        ]
      );
    }
  };

  // ── Subnet scanner ───────────────────────────────────────────────
  const detectSubnet = async (): Promise<string | null> => {
    try {
      const ip = await Network.getIpAddressAsync();
      if (!ip || ip === "0.0.0.0") return null;
      // Ambil 3 oktet pertama: 192.168.1.x → 192.168.1
      const parts = ip.split(".");
      return parts.slice(0, 3).join(".");
    } catch {
      return null;
    }
  };

  const startScan = useCallback(async () => {
    const subnet = await detectSubnet();
    if (!subnet) {
      Alert.alert("WiFi Tidak Terdeteksi", "Pastikan HP sudah terhubung ke jaringan WiFi lokal.");
      return;
    }

    cancelRef.current = false;
    setScanning(true);
    setScanResults([]);
    setScanProgress(0);

    // Build kandidat URL: subnet.1..254 × port × path
    const hosts: { ip: string; port: number; path: string }[] = [];
    for (let i = 1; i <= 254; i++) {
      for (const port of PORTS) {
        for (const path of PATHS) {
          hosts.push({ ip: `${subnet}.${i}`, port, path });
        }
      }
    }
    setScanTotal(hosts.length);
    progressAnim.setValue(0);

    const found: ScanResult[] = [];
    const BATCH = 30; // probe paralel sekaligus

    for (let i = 0; i < hosts.length; i += BATCH) {
      if (cancelRef.current) break;
      const batch = hosts.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async ({ ip, port, path }) => {
          const proto = port === 443 ? "https" : "http";
          const url = port === 80 || port === 443
            ? `${proto}://${ip}${path}`
            : `${proto}://${ip}:${port}${path}`;
          const ms = await pingHost(url, 1500);
          if (ms !== null) return { url, ms, ip };
          return null;
        })
      );
      results.forEach((r) => {
        if (r.status === "fulfilled" && r.value) {
          found.push(r.value);
          setScanResults((prev) => [...prev, r.value!]);
        }
      });
      const done = Math.min(i + BATCH, hosts.length);
      setScanProgress(done);
      Animated.timing(progressAnim, {
        toValue: done / hosts.length,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }

    setScanning(false);
    if (found.length === 0 && !cancelRef.current) {
      Alert.alert("Tidak Ditemukan", `Tidak ada server TerraBreed di subnet ${subnet}.0/24\n\nCoba input URL manual.`);
    }
  }, []);

  const stopScan = () => {
    cancelRef.current = true;
  };

  const selectResult = async (r: ScanResult) => {
    await saveServerUrl(r.url);
    onDismiss?.();
  };

  const progressPct = scanTotal > 0 ? scanProgress / scanTotal : 0;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + "22" }]}>
            <Feather name="server" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Konfigurasi Server</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Hubungkan ke TerraBreed server di jaringan lokal
            </Text>
          </View>
          {onDismiss && (
            <Pressable onPress={onDismiss} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {/* Manual Input */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            <Feather name="edit-2" size={13} /> Input Manual
          </Text>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
            Masukkan IP lokal atau hostname server. Contoh:{" "}
            <Text style={{ fontFamily: "Inter_600SemiBold" }}>http://192.168.1.10:5000/terrabreed</Text>
          </Text>

          <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor:
            testResult === "ok" ? colors.accent :
            testResult === "fail" ? colors.destructive : colors.border
          }]}>
            <Feather name="link" size={16} color={colors.mutedForeground} style={{ marginLeft: 12 }} />
            <TextInput
              value={manualUrl}
              onChangeText={(v) => { setManualUrl(v); setTestResult(null); }}
              placeholder="http://192.168.x.x:5000/terrabreed"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground }]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {testing && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />}
            {testResult === "ok" && <Feather name="check-circle" size={18} color={colors.accent} style={{ marginRight: 12 }} />}
            {testResult === "fail" && <Feather name="x-circle" size={18} color={colors.destructive} style={{ marginRight: 12 }} />}
          </View>

          {testResult === "ok" && testMs && (
            <Text style={[styles.testInfo, { color: colors.accent }]}>
              ✓ Server merespons dalam {testMs}ms
            </Text>
          )}
          {testResult === "fail" && (
            <Text style={[styles.testInfo, { color: colors.destructive }]}>
              ✗ Tidak bisa terhubung. Cek IP, port, dan koneksi WiFi.
            </Text>
          )}

          <View style={styles.btnRow}>
            <Pressable
              onPress={testConnection}
              disabled={testing || !manualUrl.trim()}
              style={({ pressed }) => [styles.btnOutline, {
                borderColor: colors.primary,
                opacity: pressed || testing || !manualUrl.trim() ? 0.6 : 1,
              }]}
            >
              <Feather name="wifi" size={15} color={colors.primary} />
              <Text style={[styles.btnOutlineText, { color: colors.primary }]}>Test</Text>
            </Pressable>
            <Pressable
              onPress={saveManual}
              disabled={testing || !manualUrl.trim()}
              style={({ pressed }) => [styles.btnFill, {
                backgroundColor: colors.primary,
                opacity: pressed || testing || !manualUrl.trim() ? 0.7 : 1,
                flex: 2,
              }]}
            >
              {testing
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="save" size={15} color="#fff" />}
              <Text style={styles.btnFillText}>Simpan & Hubungkan</Text>
            </Pressable>
          </View>

          {/* Quick presets */}
          <Text style={[styles.presetLabel, { color: colors.mutedForeground }]}>Preset cepat:</Text>
          <View style={styles.presetRow}>
            {[
              "https://kendo-assistant.com/terrabreed",
              "http://10.10.10.1:5000/terrabreed",
              "http://192.168.1.1:5000/terrabreed",
            ].map((preset) => (
              <Pressable
                key={preset}
                onPress={() => { setManualUrl(preset); setTestResult(null); }}
                style={({ pressed }) => [styles.presetChip, {
                  backgroundColor: manualUrl === preset ? colors.primary + "18" : colors.muted,
                  borderColor: manualUrl === preset ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Text style={[styles.presetChipText, {
                  color: manualUrl === preset ? colors.primary : colors.mutedForeground,
                }]} numberOfLines={1}>
                  {preset.replace("https://", "").replace("http://", "")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Subnet Scanner */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            <Feather name="search" size={13} /> Scan Subnet Otomatis
          </Text>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
            Scan seluruh subnet WiFi untuk menemukan server TerraBreed. Pastikan HP di jaringan yang sama dengan server.
          </Text>

          {!scanning ? (
            <Pressable
              onPress={startScan}
              style={({ pressed }) => [styles.btnFill, { backgroundColor: colors.secondary, opacity: pressed ? 0.8 : 1 }]}
            >
              <Feather name="radio" size={16} color="#fff" />
              <Text style={styles.btnFillText}>Mulai Scan Subnet</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 10 }}>
              {/* Progress bar */}
              <View style={[styles.progressOuter, { backgroundColor: colors.muted }]}>
                <Animated.View style={[styles.progressInner, {
                  backgroundColor: colors.secondary,
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                }]} />
              </View>
              <Text style={[styles.scanStatus, { color: colors.mutedForeground }]}>
                Scanning {scanProgress}/{scanTotal} host... ({Math.round(progressPct * 100)}%)
              </Text>
              <Pressable
                onPress={stopScan}
                style={({ pressed }) => [styles.btnOutline, { borderColor: colors.destructive, opacity: pressed ? 0.8 : 1 }]}
              >
                <Feather name="stop-circle" size={15} color={colors.destructive} />
                <Text style={[styles.btnOutlineText, { color: colors.destructive }]}>Stop</Text>
              </Pressable>
            </View>
          )}

          {/* Hasil scan */}
          {scanResults.length > 0 && (
            <View style={{ marginTop: 12, gap: 8 }}>
              <Text style={[styles.foundLabel, { color: colors.accent }]}>
                {scanResults.length} server ditemukan:
              </Text>
              {scanResults.map((r, i) => (
                <Pressable
                  key={i}
                  onPress={() => selectResult(r)}
                  style={({ pressed }) => [styles.resultItem, {
                    backgroundColor: colors.accent + "12",
                    borderColor: colors.accent,
                    opacity: pressed ? 0.8 : 1,
                  }]}
                >
                  <View style={styles.resultLeft}>
                    <View style={[styles.resultDot, { backgroundColor: colors.accent }]} />
                    <View>
                      <Text style={[styles.resultUrl, { color: colors.foreground }]} numberOfLines={1}>
                        {r.url}
                      </Text>
                      <Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>
                        {r.ip}  ·  {r.ms}ms
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => selectResult(r)}
                    style={[styles.useBtn, { backgroundColor: colors.accent }]}
                  >
                    <Text style={styles.useBtnText}>Gunakan</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Info */}
        <View style={[styles.infoBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
          <Feather name="info" size={14} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            TerraBreed server berjalan di router GL-B1300. Pastikan HP terhubung ke WiFi hotspot yang sama. Default port: 5000 (HTTP) atau 443 (HTTPS).
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  closeBtn: { padding: 6 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1.5, overflow: "hidden" },
  input: { flex: 1, paddingHorizontal: 10, paddingVertical: 13, fontSize: 13, fontFamily: "Inter_400Regular" },
  testInfo: { fontSize: 12, fontFamily: "Inter_500Medium" },
  btnRow: { flexDirection: "row", gap: 8 },
  btnOutline: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5 },
  btnOutlineText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  btnFill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12 },
  btnFillText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  presetLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  presetChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, maxWidth: "100%" },
  presetChipText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  progressOuter: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressInner: { height: 6, borderRadius: 3 },
  scanStatus: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  foundLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  resultItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 12, borderWidth: 1 },
  resultLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  resultDot: { width: 8, height: 8, borderRadius: 4 },
  resultUrl: { fontSize: 13, fontFamily: "Inter_500Medium" },
  resultMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  useBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  useBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
