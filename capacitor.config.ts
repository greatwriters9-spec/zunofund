import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zunofund.mobile",
  appName: "Zuno",
  webDir: "public",
  server: {
    url: "https://www.zunofund.com",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: ["www.zunofund.com", "zunofund.com"],
  },
  android: {
    backgroundColor: "#05080F",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
