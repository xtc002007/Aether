import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getSystemProxyCandidates } from "./lib/system-proxy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const localUpdaterProxyUrls = [
  "http://127.0.0.1:7890",
  "http://127.0.0.1:7897",
  "http://127.0.0.1:1087",
  "http://127.0.0.1:10809",
  "http://127.0.0.1:6152",
];

const connectTimeoutSec = 8;
const maxTimeSec = 30;
const proxyProbeMs = 400;

function readEnv(name) {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess.replace(/^["']|["']$/g, "");

  const envPath = path.join(root, ".env");
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

function parseVersion(version) {
  return version.replace(/^v/i, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function isNewer(remote, local) {
  const a = parseVersion(remote);
  const b = parseVersion(local);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

function parseProxyUrl(proxyUrl) {
  const url = new URL(proxyUrl);
  return {
    host: url.hostname,
    port: Number.parseInt(url.port || "80", 10),
  };
}

function isProxyReachable(proxyUrl) {
  const { host, port } = parseProxyUrl(proxyUrl);
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(proxyProbeMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function buildProxyCandidates() {
  const seen = new Set();
  const candidates = [];

  const add = (proxy) => {
    const normalized = proxy?.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  for (const proxy of getSystemProxyCandidates()) add(proxy);

  for (const proxy of [
    readEnv("UPDATER_PROXY"),
    readEnv("HTTPS_PROXY"),
    readEnv("HTTP_PROXY"),
    process.env.HTTPS_PROXY,
    process.env.HTTP_PROXY,
    ...localUpdaterProxyUrls,
  ]) {
    add(proxy);
  }

  return candidates;
}

function fetchWithCurl(endpoint, proxy) {
  const args = [
    "-sSL",
    "--connect-timeout", String(connectTimeoutSec),
    "--max-time", String(maxTimeSec),
  ];
  if (proxy) args.push("-x", proxy);
  args.push(endpoint);

  const result = spawnSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(detail || `curl exit code ${result.status}`);
  }

  return JSON.parse(result.stdout);
}

async function fetchWithNode(endpoint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), maxTimeSec * 1000);

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchManifest(endpoint, proxy) {
  try {
    return fetchWithCurl(endpoint, proxy);
  } catch (curlErr) {
    if (proxy) throw curlErr;
    try {
      return await fetchWithNode(endpoint);
    } catch (nodeErr) {
      const curlMessage = curlErr instanceof Error ? curlErr.message : String(curlErr);
      const nodeMessage = nodeErr instanceof Error ? nodeErr.message : String(nodeErr);
      throw new Error(`curl: ${curlMessage}; fetch: ${nodeMessage}`);
    }
  }
}

async function fetchManifestWithFallback(endpoint) {
  const proxyCandidates = buildProxyCandidates();
  const errors = [];
  const skipped = [];

  for (const proxy of proxyCandidates) {
    const reachable = await isProxyReachable(proxy);
    if (!reachable) {
      skipped.push(`${proxy} (port closed)`);
      continue;
    }

    try {
      console.log(`[updater-test] Trying fetch via: ${proxy}`);
      const manifest = await fetchManifest(endpoint, proxy);
      console.log(`[updater-test] Fetch OK via: ${proxy}`);
      return manifest;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${proxy}: ${message}`);
    }
  }

  try {
    console.log("[updater-test] Trying fetch via: direct");
    const manifest = await fetchManifest(endpoint, null);
    console.log("[updater-test] Fetch OK via: direct");
    return manifest;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`direct: ${message}`);
  }

  const skippedText = skipped.length
    ? `\nSkipped unreachable proxies:\n${skipped.map((line) => `  - ${line}`).join("\n")}`
    : "";

  throw new Error(
    `All fetch attempts failed.\n${errors.map((line) => `  - ${line}`).join("\n")}${skippedText}\n` +
      "Fix: start Clash/V2Ray, then add to .env:\n" +
      "  UPDATER_PROXY=http://127.0.0.1:7890\n" +
      "(use your actual proxy port)"
  );
}

const offlinePath = process.argv[2];
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const localVersion = packageJson.version;
const endpoint = readEnv("AETHER_UPDATER_ENDPOINT") ?? readEnv("TAURI_UPDATER_ENDPOINT");
  ?? "https://github.com/xtc002007/Aether/releases/latest/download/latest.json";

console.log(`[updater-test] Local version : ${localVersion}`);
console.log(`[updater-test] Endpoint      : ${endpoint}`);

const manifest = offlinePath
  ? JSON.parse(fs.readFileSync(path.resolve(offlinePath), "utf8"))
  : await fetchManifestWithFallback(endpoint);

if (offlinePath) {
  console.log(`[updater-test] Using offline manifest: ${path.resolve(offlinePath)}`);
}

const remoteVersion = manifest.version;
const platform = manifest.platforms?.["windows-x86_64"];

console.log(`[updater-test] Remote version: ${remoteVersion}`);
console.log(`[updater-test] Update URL    : ${platform?.url ?? "(missing)"}`);
console.log(`[updater-test] Signature     : ${platform?.signature ? "present" : "missing"}`);

if (isNewer(remoteVersion, localVersion)) {
  console.log(`[updater-test] RESULT: Update available (${localVersion} -> ${remoteVersion})`);
  process.exitCode = 0;
} else if (remoteVersion === localVersion) {
  console.log("[updater-test] RESULT: Already on latest version.");
  process.exitCode = 1;
} else {
  console.log(`[updater-test] RESULT: Local version (${localVersion}) is newer than remote (${remoteVersion}).`);
  process.exitCode = 1;
}
