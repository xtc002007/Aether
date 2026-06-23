import fs from "node:fs";

const apiUrl = process.env.NEXUSTOOLS_API_URL;
const configKey = process.env.NEXUSTOOLS_CONFIG_KEY;
const appId = process.env.APP_ID || "aether";
const manifestPath = process.env.MANIFEST_PATH || "release-assets/latest.json";

if (!apiUrl || !configKey) {
  console.log("Skipping manifest sync: NEXUSTOOLS_API_URL or NEXUSTOOLS_CONFIG_KEY not configured.");
  process.exit(0);
}

if (!fs.existsSync(manifestPath)) {
  throw new Error(`Manifest not found: ${manifestPath}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const endpoint = `${apiUrl}/api/apps/${appId}/updates/latest?platform=windows-x64`;

const body = {
  updates: {
    direct: {
      endpoint,
      platforms: ["windows-x64"],
      manifest,
    },
  },
};

const response = await fetch(`${apiUrl}/api/apps/${appId}`, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${configKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`Failed to sync updater manifest (${response.status}): ${text}`);
}

console.log(`Synced updater manifest for ${appId} to ${endpoint}`);
