import { ServerSetup } from "@/components/ServerSetup";
import { router } from "expo-router";

export default function ServerSetupModal() {
  return <ServerSetup onDismiss={() => router.back()} />;
}
