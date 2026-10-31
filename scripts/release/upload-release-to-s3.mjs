import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { toLatestBundleName } from "./release-s3.mjs";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function walkFiles(rootDir) {
  const stack = [rootDir];
  const files = [];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir || !fs.existsSync(currentDir)) continue;
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) { stack.push(fullPath); continue; }
      if (entry.isFile()) files.push(fullPath);
    }
  }
  return files;
}

function findSetupExe(rootDir) {
  const matches = walkFiles(rootDir)
    .filter((filePath) => /_setup\.exe$/i.test(path.basename(filePath)))
    .sort();
  if (matches.length === 0) {
    throw new Error(`No *_setup.exe found under ${rootDir}`);
  }
  return matches[0];
}

const root = process.env.RELEASE_ASSETS_ROOT || "release-assets";
const appId = requireEnv("APP_ID");
const version = requireEnv("RELEASE_VERSION").replace(/^v/i, "");
const bucket = process.env.S3_RELEASES_BUCKET || "nexustools-website-static";
const region = process.env.AWS_REGION || "us-east-2";

const setupPath = findSetupExe(root);
const bundleName = path.basename(setupPath);
const latestName = toLatestBundleName(bundleName);

const versionedKey = `releases/${appId}/${version}/${bundleName}`;
const latestKey = `releases/${appId}/latest/${latestName}`;

function upload(targetKey) {
  const args = [
    "s3", "cp", setupPath, `s3://${bucket}/${targetKey}`,
    "--content-type", "application/vnd.microsoft.portable-executable",
    "--content-disposition", `attachment; filename="${bundleName}"`,
    "--region", region,
  ];
  execSync(`aws ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`, {
    stdio: "inherit",
    shell: true,
  });
}

console.log(`[upload-release] Uploading ${bundleName} → s3://${bucket}/${versionedKey}`);
upload(versionedKey);

console.log(`[upload-release] Publishing latest alias → s3://${bucket}/${latestKey}`);
upload(latestKey);

console.log("[upload-release] Done.");
