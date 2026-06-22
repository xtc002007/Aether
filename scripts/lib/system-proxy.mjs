import { spawnSync } from "node:child_process";

function normalizeProxyUrl(server) {
  const trimmed = server?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

export function getWindowsSystemProxyUrl() {
  if (process.platform !== "win32") return null;

  const script = [
    "$s = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'",
    "if ($s.ProxyEnable -ne 1 -or -not $s.ProxyServer) { exit 1 }",
    "$server = ($s.ProxyServer -split ';' | Select-Object -First 1).Trim()",
    "if ($server -notmatch '^https?://') { $server = \"http://$server\" }",
    "Write-Output $server",
  ].join("; ");

  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) return null;
  return normalizeProxyUrl(result.stdout);
}

export function getSystemProxyCandidates() {
  const seen = new Set();
  const candidates = [];

  const add = (proxy) => {
    const normalized = normalizeProxyUrl(proxy);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  add(getWindowsSystemProxyUrl());
  return candidates;
}
