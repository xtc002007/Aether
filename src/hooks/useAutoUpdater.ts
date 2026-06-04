import { useState, useCallback, useEffect, useRef } from "react";
import { checkNativeAppUpdate, type NativeAppUpdate, type NativeAppUpdateProgress } from "../updater";

const defaultAutoUpdateCheckIntervalMs = 6 * 60 * 60 * 1000;

export type AutoUpdaterOptions = {
  autoCheck?: boolean;
  checkIntervalMs?: number;
};

export function useAutoUpdater(enabled = true, options: AutoUpdaterOptions = {}) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<NativeAppUpdateProgress | null>(null);
  const [readyToRestart, setReadyToRestart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadedUpdateRef = useRef<NativeAppUpdate | null>(null);
  const autoCheck = options.autoCheck ?? true;
  const checkIntervalMs = options.checkIntervalMs ?? defaultAutoUpdateCheckIntervalMs;

  const checkForUpdates = useCallback(async () => {
    if (!enabled || checking) return;
    setChecking(true);
    setError(null);

    try {
      const update = await checkNativeAppUpdate();
      if (update) {
        setUpdateAvailable(true);
        return update;
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setChecking(false);
    }
    return null;
  }, [enabled, checking]);

  const downloadUpdate = useCallback(async (update: NativeAppUpdate) => {
    if (downloading) return;
    if (downloadedUpdateRef.current?.version === update.version) {
      setReadyToRestart(true);
      return;
    }

    setDownloading(true);
    setDownloadProgress({ contentLength: null, downloaded: 0, progress: null });

    try {
      await update.downloadAndInstall({
        onProgress: (progress) => setDownloadProgress(progress)
      });
      downloadedUpdateRef.current = update;
      setReadyToRestart(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setDownloading(false);
    }
  }, [downloading]);

  const restartApp = useCallback(async () => {
    const update = downloadedUpdateRef.current;
    if (!update) return;
    try {
      await update.restart();
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    if (!autoCheck || !enabled) return;
    let cancelled = false;

    async function backgroundCheck() {
      try {
        const update = await checkNativeAppUpdate();
        if (!cancelled && update) {
          setUpdateAvailable(true);
          downloadedUpdateRef.current = update;
        }
      } catch {
        // Silent background check
      }
    }

    backgroundCheck();
    const interval = window.setInterval(backgroundCheck, checkIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [autoCheck, checkIntervalMs, enabled]);

  return {
    updateAvailable,
    checking,
    downloading,
    downloadProgress,
    readyToRestart,
    error,
    checkForUpdates,
    downloadUpdate: () => {
      const update = downloadedUpdateRef.current;
      if (update) return downloadUpdate(update);
      return Promise.resolve();
    },
    restartApp
  };
}
