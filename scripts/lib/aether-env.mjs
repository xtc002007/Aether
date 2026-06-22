import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP_SLUG = "aether";
export const SIGNING_DIR = "signing";
export const DEFAULT_PRIVATE_KEY_PATH = `${SIGNING_DIR}/${APP_SLUG}.key`;
export const DEFAULT_PUBLIC_KEY_PATH = `${SIGNING_DIR}/${APP_SLUG}.key.pub`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const envPath = path.join(root, ".env");

const LEGACY_ENV_ALIASES = {
  AETHER_SIGNING_PRIVATE_KEY_PATH: "TAURI_SIGNING_PRIVATE_KEY_PATH",
  AETHER_SIGNING_PUBLIC_KEY_PATH: "TAURI_SIGNING_PUBLIC_KEY_PATH",
  AETHER_SIGNING_PRIVATE_KEY_PASSWORD: "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
  AETHER_UPDATER_PUBLIC_KEY: "TAURI_UPDATER_PUBLIC_KEY",
  AETHER_UPDATER_ENDPOINT: "TAURI_UPDATER_ENDPOINT",
};

export function getProjectRoot() {
  return root;
}

export function readEnv(name) {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess.replace(/^["']|["']$/g, "");

  if (!fs.existsSync(envPath)) return null;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (key !== name) continue;
    return trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

export function readEnvWithLegacy(name) {
  return readEnv(name) ?? (LEGACY_ENV_ALIASES[name] ? readEnv(LEGACY_ENV_ALIASES[name]) : null);
}

export function resolveProjectPath(relativeOrAbsolutePath) {
  if (!relativeOrAbsolutePath) return null;
  const expanded = relativeOrAbsolutePath.replace(
    /^%USERPROFILE%/i,
    process.env.USERPROFILE || process.env.HOME || "",
  );
  return path.isAbsolute(expanded) ? expanded : path.join(root, expanded);
}

export function readFileIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8").trim();
}

export function loadAetherUpdaterConfig() {
  const endpoint = readEnvWithLegacy("AETHER_UPDATER_ENDPOINT");
  const privateKeyPath = resolveProjectPath(
    readEnvWithLegacy("AETHER_SIGNING_PRIVATE_KEY_PATH") || DEFAULT_PRIVATE_KEY_PATH,
  );
  const publicKeyPath = resolveProjectPath(
    readEnvWithLegacy("AETHER_SIGNING_PUBLIC_KEY_PATH") || DEFAULT_PUBLIC_KEY_PATH,
  );
  const publicKey =
    readEnvWithLegacy("AETHER_UPDATER_PUBLIC_KEY") || readFileIfExists(publicKeyPath);
  const privateKeyPassword = readEnvWithLegacy("AETHER_SIGNING_PRIVATE_KEY_PASSWORD");

  return {
    endpoint,
    publicKey,
    privateKeyPath,
    publicKeyPath,
    privateKeyPassword,
    privateKeyContent: readFileIfExists(privateKeyPath),
  };
}
