/**
 * ServerContext
 * Menyimpan base URL server ke AsyncStorage.
 * Default: https://kendo-assistant.com/terrabreed
 * User bisa ubah manual atau scan subnet.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_URL = "https://kendo-assistant.com/terrabreed";
const STORAGE_KEY = "@terrabreed_server_url";

interface ServerContextType {
  serverUrl: string;
  isConfigured: boolean;
  saveServerUrl: (url: string) => Promise<void>;
  resetServerUrl: () => Promise<void>;
}

const ServerContext = createContext<ServerContextType>({
  serverUrl: DEFAULT_URL,
  isConfigured: false,
  saveServerUrl: async () => {},
  resetServerUrl: async () => {},
});

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [serverUrl, setServerUrl] = useState(DEFAULT_URL);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        setServerUrl(stored);
        setIsConfigured(true);
      }
    });
  }, []);

  const saveServerUrl = useCallback(async (url: string) => {
    const clean = url.replace(/\/$/, "");
    await AsyncStorage.setItem(STORAGE_KEY, clean);
    setServerUrl(clean);
    setIsConfigured(true);
  }, []);

  const resetServerUrl = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setServerUrl(DEFAULT_URL);
    setIsConfigured(false);
  }, []);

  return (
    <ServerContext.Provider value={{ serverUrl, isConfigured, saveServerUrl, resetServerUrl }}>
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  return useContext(ServerContext);
}

export { DEFAULT_URL };
