import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface ControlToggleProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sublabel?: string;
  active: boolean;
  color: string;
  loading?: boolean;
  onToggle: () => void;
}

export function ControlToggle({ icon, label, sublabel, active, color, loading, onToggle }: ControlToggleProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onToggle}
      disabled={loading}
      style={({ pressed }) => [
        styles.root,
        {
          backgroundColor: active ? color + "18" : colors.card,
          borderColor: active ? color : colors.border,
          opacity: pressed || loading ? 0.75 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: active ? color + "22" : colors.muted }]}>
        {loading
          ? <ActivityIndicator size="small" color={active ? color : colors.mutedForeground} />
          : <Feather name={icon} size={20} color={active ? color : colors.mutedForeground} />}
      </View>
      <Text style={[styles.label, { color: colors.foreground }]} numberOfLines={1}>{label}</Text>
      {sublabel && <Text style={[styles.sublabel, { color: colors.mutedForeground }]} numberOfLines={1}>{sublabel}</Text>}
      <View style={[styles.dot, { backgroundColor: active ? color : colors.border }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, borderRadius: 16, borderWidth: 1.5, padding: 14, alignItems: "flex-start", gap: 8, minHeight: 110 },
  iconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sublabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  dot: { width: 8, height: 8, borderRadius: 4, position: "absolute", top: 12, right: 12 },
});
