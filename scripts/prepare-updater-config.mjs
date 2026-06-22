import fs from "node:fs";
import path from "node:path";
import { loadAetherUpdaterConfig, getProjectRoot } from "./lib/aether-env.mjs";

const root = getProjectRoot();
const tauriConfPath = path.join(root, "src-tauri", "tauri.conf.json");
const overlayPath = path.join(root, "tauri.updater.conf.json");

const { endpoint, publicKey } = loadAetherUpdaterConfig();

if (!endpoint || !publicKey) {
  console.warn("[prepare-updater] Missing AETHER_UPDATER_ENDPOINT or AETHER signing public key.");
  console.warn("[prepare-updater] Configure signing/aether.key.pub or AETHER_UPDATER_PUBLIC_KEY in .env");
  process.exit(0);
}

const overlay = {
  plugins: {
    updater: {
      endpoints: [endpoint],
      pubkey: publicKey,
      windows: { installMode: "passive" },
    },
  },
};

fs.writeFileSync(overlayPath, `${JSON.stringify(overlay, null, 2)}\n`);

const tauriConfig = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
tauriConfig.plugins ??= {};
tauriConfig.plugins.updater = {
  ...tauriConfig.plugins.updater,
  endpoints: [endpoint],
  pubkey: publicKey,
  windows: { installMode: "passive" },
};
fs.writeFileSync(tauriConfPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);

console.log("[prepare-updater] Updater config ready");
console.log(`[prepare-updater] Endpoint: ${endpoint}`);
