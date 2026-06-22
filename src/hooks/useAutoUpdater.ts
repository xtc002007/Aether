import { useState, useCallback, useEffect, useRef } from "react";
import { checkNativeAppUpdate, type NativeAppUpdate, type NativeAppUpdateProgress } from "../updater";

const defaultAutoUpdateCheckIntervalMs = 6 * 60 * 60 * 1000;

export type AutoUpdaterOptions = {
  autoCheck?: boolean;
  checkIntervalMs?: number;
};

export function useAutoUpdater(autoCheckEnabled = true, options: AutoUpdaterOptions = {}) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<NativeAppUpdateProgress | null>(null);
  const [readyToRestart, setReadyToRestart] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);

  const downloadedUpdateRef = useRef<NativeAppUpdate | null>(null);
  const availableUpdateRef = useRef<NativeAppUpdate | null>(null);
  const autoCheck = options.autoCheck ?? true;
  const checkIntervalMs = options.checkIntervalMs ?? defaultAutoUpdateCheckIntervalMs;

  const downloadUpdate = useCallback(async (update: NativeAppUpdate) => {
    if (downloading || installing) return false;
    if (downloadedUpdateRef.current?.version === update.version) {
      setReadyToRestart(true);
      return true;
    }

    setDownloading(true);
    setDownloadProgress({ contentLength: null, downloaded: 0, progress: null });
    setError(null);

    try {
      await update.download({
        onProgress: (progress) => setDownloadProgress(progress)
      });
      downloadedUpdateRef.current = update;
      setReadyToRestart(true);
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    } finally {
      setDownloading(false);
    }
  }, [downloading, installing]);

  const checkForUpdates = useCallback(async () => {
    if (checking) return null;
    setChecking(true);
    setError(null);

    try {
      const update = await checkNativeAppUpdate();
      if (update) {
        availableUpdateRef.current = update;
        setUpdateAvailable(true);
        setRemoteVersion(update.version);
        return update;
      }
      availableUpdateRef.current = null;
      setUpdateAvailable(false);
      setRemoteVersion(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setChecking(false);
    }
    return null;
  }, [checking]);

  const downloadAvailableUpdate = useCallback(async () => {
    const update = availableUpdateRef.current;
    if (!update) return false;
    return downloadUpdate(update);
  }, [downloadUpdate]);

  const restartApp = useCallback(async () => {
    const update = downloadedUpdateRef.current;
    if (!update || installing) return;
    setInstalling(true);
    setError(null);
    try {
      await update.installAndRestart();
    } catch (err) {
      setError(String(err));
      setInstalling(false);
    }
  }, [installing]);

  useEffect(() => {
    if (!autoCheck || !autoCheckEnabled) return;
    let cancelled = false;

    async function backgroundCheck() {
      try {
        const update = await checkNativeAppUpdate();
        if (!cancelled && update) {
          availableUpdateRef.current = update;
          setUpdateAvailable(true);
          setRemoteVersion(update.version);
          if (downloadedUpdateRef.current?.version === update.version) {
            setReadyToRestart(true);
            return;
          }
          setDownloading(true);
          setDownloadProgress({ contentLength: null, downloaded: 0, progress: null });
          try {
            await update.download({
              onProgress: (progress) => {
                if (!cancelled) setDownloadProgress(progress);
              }
            });
            downloadedUpdateRef.current = update;
            setReadyToRestart(true);
          } catch (err) {
            console.error("Silent background update download failed:", err);
            if (!cancelled) setError(String(err));
          } finally {
            if (!cancelled) setDownloading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Background update check failed:", err);
          setError(String(err));
        }
      }
    }

    backgroundCheck();
    const interval = window.setInterval(backgroundCheck, checkIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [autoCheck, checkIntervalMs, autoCheckEnabled]);

  return {
    updateAvailable,
    checking,
    downloading,
    installing,
    downloadProgress,
    readyToRestart,
    error,
    remoteVersion,
    checkForUpdates,
    downloadAvailableUpdate,
    restartApp
  };
}
