import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const localUpdaterProxyUrls = [
  "http://127.0.0.1:7890",
  "http://127.0.0.1:7897",
  "http://127.0.0.1:1087",
  "http://127.0.0.1:10809",
  "http://127.0.0.1:6152"
] as const;

export type NativeAppUpdateProgress = {
  contentLength: number | null;
  downloaded: number;
  progress: number | null;
};

export type NativeAppUpdate = {
  body?: string;
  currentVersion: string;
  date?: string;
  download: (callbacks?: { onProgress?: (progress: NativeAppUpdateProgress) => unknown }) => Promise<unknown>;
  installAndRestart: () => Promise<unknown>;
  version: string;
};

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function resolveProxyCandidates() {
  const seen = new Set<string>();
  const candidates: string[] = [];

  const add = (proxy?: string | null) => {
    const normalized = proxy?.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  if (isTauriRuntime()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      add(await invoke<string | null>("get_system_proxy_url"));
    } catch {
      // System proxy lookup is optional.
    }
  }

  for (const proxy of localUpdaterProxyUrls) add(proxy);
  return candidates;
}

async function checkWithLocalProxyFallback() {
  for (const proxy of await resolveProxyCandidates()) {
    try {
      return await check({ proxy });
    } catch {
      // Local proxies are optional; fall through to the next candidate or direct check.
    }
  }
  return check();
}

function resolveProgress(downloaded: number, contentLength: number | null) {
  if (!contentLength || contentLength <= 0) return null;
  return Math.min(100, Math.round((downloaded / contentLength) * 100));
}

function emitProgress({
  contentLength,
  downloaded,
  onProgress
}: {
  contentLength: number | null;
  downloaded: number;
  onProgress?: (progress: NativeAppUpdateProgress) => unknown;
}) {
  onProgress?.({
    contentLength,
    downloaded,
    progress: resolveProgress(downloaded, contentLength)
  });
}

function trackDownloadProgress(
  update: Awaited<ReturnType<typeof check>>,
  callbacks: { onProgress?: (progress: NativeAppUpdateProgress) => unknown } = {}
) {
  if (!update) return Promise.resolve();

  let contentLength: number | null = null;
  let downloaded = 0;

  return update.download((event: DownloadEvent) => {
    if (event.event === "Started") {
      contentLength = event.data.contentLength ?? null;
      downloaded = 0;
      emitProgress({ contentLength, downloaded, onProgress: callbacks.onProgress });
      return;
    }

    if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      emitProgress({ contentLength, downloaded, onProgress: callbacks.onProgress });
      return;
    }

    if (event.event === "Finished") {
      if (contentLength !== null) downloaded = contentLength;
      emitProgress({ contentLength, downloaded, onProgress: callbacks.onProgress });
    }
  });
}

export async function checkNativeAppUpdate(): Promise<NativeAppUpdate | null> {
  if (!isTauriRuntime()) return null;

  const update = await checkWithLocalProxyFallback();
  if (!update) return null;

  return {
    body: update.body,
    currentVersion: update.currentVersion,
    date: update.date,
    download(callbacks = {}) {
      return trackDownloadProgress(update, callbacks);
    },
    async installAndRestart() {
      await update.install();
      await relaunch();
    },
    version: update.version
  };
}
