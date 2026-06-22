import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppSettings, PlatformConfig } from "../types";
import type { NativeAppUpdateProgress } from "../updater";
import {
  Settings, Globe, Zap, Database, Cpu, Monitor, Wrench, Sliders,
  Trash2, RefreshCw, Save, BellRing, ShieldCheck, HelpCircle, HardDrive,
  Check, XCircle, Loader2, Download
} from "lucide-react";

interface SettingViewProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  updateChecking?: boolean;
  updateDownloading?: boolean;
  updateInstalling?: boolean;
  updateProgress?: NativeAppUpdateProgress | null;
  readyToRestart?: boolean;
  updateAvailable?: boolean;
  updateError?: string | null;
  remoteVersion?: string | null;
  onCheckForUpdates?: () => Promise<unknown>;
  onDownloadUpdate?: () => Promise<boolean>;
  onRestartUpdate?: () => void;
}

type SaveStatus = { kind: "idle" } | { kind: "saving" } | { kind: "ok"; msg: string } | { kind: "err"; msg: string };

export default function SettingView({
  settings,
  onUpdateSettings,
  updateChecking = false,
  updateDownloading = false,
  updateInstalling = false,
  updateProgress = null,
  readyToRestart = false,
  updateAvailable = false,
  updateError = null,
  remoteVersion = null,
  onCheckForUpdates,
  onDownloadUpdate,
  onRestartUpdate,
}: SettingViewProps) {
  const [activeTab, setActiveTab] = useState<string>("platforms");
  const [platformConfigs, setPlatformConfigs] = useState<PlatformConfig[]>([]);
  const [configsLoaded, setConfigsLoaded] = useState(false);
  const [configsLoadError, setConfigsLoadError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [logLevel, setLogLevel] = useState(settings.logLevel || "info");
  const [queryLimit, setQueryLimit] = useState(20);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });
  const [appVersion, setAppVersion] = useState<string>("…");

  const cn = settings.language === "zh";
  const t = (cnT: string, enT: string) => cn ? cnT : enT;
  const isUpdating = updateChecking || updateDownloading || updateInstalling;

  // ── Load Data ──
  useEffect(() => {
    let active = true;
    async function loadVersion() {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        const version = await getVersion();
        if (active) setAppVersion(version);
      } catch {
        if (active) setAppVersion(import.meta.env.VITE_APP_VERSION ?? "dev");
      }
    }
    loadVersion();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [configs, key] = await Promise.all([
          invoke<PlatformConfig[]>("get_platform_configs"),
          invoke<string>("get_api_key"),
        ]);
        if (cancelled) return;
        setPlatformConfigs(configs);
        setApiKey(key);
        setApiKeyLoaded(true);
        setConfigsLoadError(null);
      } catch (e: any) {
        if (cancelled) return;
        console.error("Failed to load settings:", e);
        setConfigsLoadError(String(e));
        // Fallback so UI still renders
        if (platformConfigs.length === 0) {
          setPlatformConfigs(getFallbackPlatforms());
        }
      }
      setConfigsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Helpers ──
  const showSaveResult = useCallback((ok: boolean, msg: string) => {
    setSaveStatus(ok ? { kind: "ok", msg } : { kind: "err", msg });
    setTimeout(() => setSaveStatus({ kind: "idle" }), 2500);
  }, []);

  const persistSettings = useCallback(async (updated: AppSettings) => {
    onUpdateSettings(updated);
    try {
      await invoke("update_settings", { settings: updated });
      showSaveResult(true, t("设置已保存", "Settings saved"));
    } catch (e: any) {
      console.error("update_settings failed:", e);
      showSaveResult(false, String(e));
    }
  }, [onUpdateSettings, showSaveResult, cn]);

  // ── Platform Config Actions ──
  const savePlatformConfig = useCallback(async (config: PlatformConfig) => {
    setSaveStatus({ kind: "saving" });
    try {
      await invoke("update_platform_config", { config });
      showSaveResult(true, t(`${config.name} 已保存`, `${config.name} saved`));
    } catch (e: any) {
      console.error("update_platform_config failed:", e);
      showSaveResult(false, String(e));
    }
  }, [showSaveResult, cn]);

  const togglePlatform = useCallback(async (name: string) => {
    const updated = platformConfigs.map(c =>
      c.name === name ? { ...c, enabled: !c.enabled } : c
    );
    setPlatformConfigs(updated);
    const changed = updated.find(c => c.name === name);
    if (changed) await savePlatformConfig(changed);
  }, [platformConfigs, savePlatformConfig]);

  const updatePlatformField = useCallback(async (name: string, field: string, value: any) => {
    const updated = platformConfigs.map(c =>
      c.name === name ? { ...c, [field]: value } : c
    );
    setPlatformConfigs(updated);
    const changed = updated.find(c => c.name === name);
    if (changed) await savePlatformConfig(changed);
  }, [platformConfigs, savePlatformConfig]);

  const toggleQueryTemplate = useCallback(async (platformName: string, templateIdx: number) => {
    const updated = platformConfigs.map(c => {
      if (c.name === platformName) {
        const templates = c.queryTemplates.map((qt, i) =>
          i === templateIdx ? { ...qt, enabled: !qt.enabled } : qt
        );
        return { ...c, queryTemplates: templates };
      }
      return c;
    });
    setPlatformConfigs(updated);
    const changed = updated.find(c => c.name === platformName);
    if (changed) await savePlatformConfig(changed);
  }, [platformConfigs, savePlatformConfig]);

  const updateSignalWeight = useCallback(async (platformName: string, key: string, val: number) => {
    const updated = platformConfigs.map(c => {
      if (c.name === platformName) {
        return { ...c, signalWeights: { ...c.signalWeights, [key]: val } };
      }
      return c;
    });
    setPlatformConfigs(updated);
    const changed = updated.find(c => c.name === platformName);
    if (changed) await savePlatformConfig(changed);
  }, [platformConfigs, savePlatformConfig]);

  // ── API Key ──
  const saveApiKey = useCallback(async () => {
    setSaveStatus({ kind: "saving" });
    try {
      await invoke("save_api_key", { apiKey: apiKey.trim() });
      showSaveResult(true, t("API Key 已保存到数据库", "API Key saved to database"));
    } catch (e: any) {
      console.error("save_api_key failed:", e);
      showSaveResult(false, String(e));
    }
  }, [apiKey, showSaveResult, cn]);

  // ── Log Level ──
  const handleSaveLogLevel = useCallback((level: string) => {
    setLogLevel(level);
    persistSettings({ ...settings, logLevel: level });
  }, [settings, persistSettings]);

  const handleCheckUpdates = useCallback(async () => {
    if (!onCheckForUpdates) return;
    setUpdateStatus(null);
    const update = await onCheckForUpdates();
    if (readyToRestart) {
      setUpdateStatus(t("更新已下载，点击「立即升级」完成安装。", "Update downloaded. Click Upgrade Now to install."));
      return;
    }
    if (update) {
      setUpdateStatus(t("发现新版本，正在下载...", "New version found. Downloading..."));
      if (onDownloadUpdate) {
        const ok = await onDownloadUpdate();
        if (ok) {
          setUpdateStatus(t("更新已下载，点击「立即升级」完成安装。", "Update downloaded. Click Upgrade Now to install."));
        } else {
          setUpdateStatus(t("下载失败，请稍后重试。", "Download failed. Please try again later."));
        }
      }
      return;
    }
    setUpdateStatus(t("当前已是最新版本。", "You are on the latest version."));
  }, [onCheckForUpdates, onDownloadUpdate, readyToRestart, cn]);

  // ── Clear Cache ──
  const handleClearCache = useCallback(async () => {
    setSaveStatus({ kind: "saving" });
    try {
      await invoke("clear_cache");
      showSaveResult(true, t("缓存已清理", "Cache cleared"));
    } catch (e: any) {
      console.error("clear_cache failed:", e);
      showSaveResult(false, String(e));
    }
  }, [showSaveResult, cn]);

  // ── Sub tab definitions ──
  const subTabs = [
    { id: "platforms", label: t("全局平台设置", "Global Platforms"), icon: Globe },
    { id: "queries", label: t("默认查询规则", "Query Rules"), icon: Wrench },
    { id: "weights", label: t("默认评分与权重", "Scoring & Weights"), icon: Sliders },
    { id: "storage", label: t("数据与存储", "Data & Storage"), icon: HardDrive },
    { id: "performance", label: t("并行与性能", "Performance"), icon: Cpu },
    { id: "app", label: t("应用设置", "App Settings"), icon: Monitor },
  ];

  // ── Status Badge ──
  const StatusBadge = () => {
    if (saveStatus.kind === "idle") return null;
    if (saveStatus.kind === "saving") return (
      <span className="text-[10px] text-indigo-600 font-mono font-bold flex items-center gap-1 animate-pulse">
        <Loader2 size={10} className="animate-spin" /> {t("保存中...", "Saving...")}
      </span>
    );
    if (saveStatus.kind === "ok") return (
      <span className="text-[10px] text-emerald-600 font-mono font-bold flex items-center gap-1">
        <Check size={10} /> {saveStatus.msg}
      </span>
    );
    if (saveStatus.kind === "err") return (
      <span className="text-[10px] text-red-600 font-mono font-bold flex items-center gap-1">
        <XCircle size={10} /> {saveStatus.msg}
      </span>
    );
    return null;
  };

  // ── Render Sections ──

  const renderPlatformSettings = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{t("配置各平台的启用状态、优先级和采集参数。", "Configure enable/disable, priority, and crawl params per platform.")}</p>
        <StatusBadge />
      </div>
      {platformConfigs.map((plat) => (
        <div key={plat.name} className={`p-4 border rounded-lg space-y-3 bg-white transition ${plat.enabled ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-gray-900 text-sm">{plat.name}</span>
              <span className="text-[10px] text-gray-400 font-mono ml-2">{plat.platformType}</span>
            </div>
            <button
              onClick={() => togglePlatform(plat.name)}
              className={`text-xs font-semibold px-3 py-1 rounded-md cursor-pointer transition ${
                plat.enabled ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {plat.enabled ? t("已启用", "ON") : t("已禁用", "OFF")}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-mono block">{t("优先级", "Priority")}</label>
              <select value={plat.priority}
                onChange={(e) => updatePlatformField(plat.name, "priority", parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded p-1.5 text-xs bg-white font-mono cursor-pointer">
                {[1,2,3,4,5,6,7,8,9,10].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-mono block">{t("并发数", "Concurrency")}</label>
              <select value={plat.maxConcurrency}
                onChange={(e) => updatePlatformField(plat.name, "maxConcurrency", parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded p-1.5 text-xs bg-white font-mono cursor-pointer">
                {[1,2,3,4,5,6,8].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-mono block">{t("超时(秒)", "Timeout(s)")}</label>
              <select value={Math.round(plat.timeoutMs / 1000)}
                onChange={(e) => updatePlatformField(plat.name, "timeoutMs", parseInt(e.target.value) * 1000)}
                className="w-full border border-gray-200 rounded p-1.5 text-xs bg-white font-mono cursor-pointer">
                {[5,10,15,20,30,60].map(p => <option key={p} value={p}>{p}s</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-mono block">{t("最大页数", "Max Pages")}</label>
              <select value={plat.maxPages}
                onChange={(e) => updatePlatformField(plat.name, "maxPages", parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded p-1.5 text-xs bg-white font-mono cursor-pointer">
                {[1,2,3,5,10].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderQuerySettings = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{t("管理各平台的默认查询模板，启用/禁用具体查询类型。", "Manage default query templates per platform.")}</p>
        <StatusBadge />
      </div>
      {platformConfigs.filter(c => c.queryTemplates && c.queryTemplates.length > 0).length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          {t("加载查询模板中...", "Loading query templates...")}
        </div>
      ) : (
        platformConfigs.filter(c => c.queryTemplates.length > 0).map((plat) => (
          <div key={plat.name} className="border border-gray-200 rounded-lg p-4 bg-white space-y-2">
            <h4 className="font-bold text-xs text-gray-800 font-mono">{plat.name}</h4>
            {plat.queryTemplates.map((qt, qi) => (
              <div key={qi} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="space-y-0.5 flex-1 mr-4">
                  <span className="text-xs font-semibold text-gray-700">{qt.name}</span>
                  <code className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-mono block break-all">{qt.template}</code>
                </div>
                <button
                  onClick={() => toggleQueryTemplate(plat.name, qi)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded cursor-pointer transition shrink-0 ${
                    qt.enabled ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  {qt.enabled ? "ON" : "OFF"}
                </button>
              </div>
            ))}
          </div>
        ))
      )}
      <div className="space-y-2 pt-2">
        <label className="text-[10px] font-bold text-gray-500 font-mono uppercase block">{t("默认查询上限", "Default Query Limit")}</label>
        <input type="range" min="5" max="50" value={queryLimit}
          onChange={(e) => setQueryLimit(parseInt(e.target.value))}
          className="w-full accent-indigo-600 cursor-pointer" />
        <div className="flex justify-between text-[10px] text-gray-400 font-mono">
          <span>5</span><span className="font-bold text-indigo-600">{queryLimit}</span><span>50</span>
        </div>
      </div>
    </div>
  );

  const renderWeightSettings = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{t("调整各平台在不同信号维度的权重。", "Adjust per-platform signal weights.")}</p>
        <StatusBadge />
      </div>
      {platformConfigs.filter(c => c.enabled).map((plat) => (
        <div key={plat.name} className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
          <h4 className="font-bold text-xs text-gray-800 font-mono uppercase">{plat.name}</h4>
          <div className="space-y-2">
            {([
              { key: "demandSignal" as const, label: t("需求信号", "Demand") },
              { key: "dissatisfactionSignal" as const, label: t("不满信号", "Dissat.") },
              { key: "reviewCredibility" as const, label: t("可信度", "Cred.") },
              { key: "freshness" as const, label: t("新鲜度", "Fresh") },
            ]).map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-gray-600 w-16 shrink-0">{label}</span>
                <input type="range" min="0.1" max="2.0" step="0.1"
                  value={plat.signalWeights[key]}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setPlatformConfigs(prev => prev.map(c =>
                      c.name === plat.name ? { ...c, signalWeights: { ...c.signalWeights, [key]: val } } : c
                    ));
                  }}
                  onMouseUp={() => updateSignalWeight(plat.name, key, plat.signalWeights[key])}
                  onTouchEnd={() => updateSignalWeight(plat.name, key, plat.signalWeights[key])}
                  className="flex-1 accent-indigo-600 cursor-pointer h-1.5" />
                <span className="text-[10px] font-mono font-bold text-indigo-700 w-8 text-right">{plat.signalWeights[key].toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderStorageSettings = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusBadge />
      </div>
      <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-3">
        <h4 className="font-bold text-xs text-gray-800 font-mono uppercase flex items-center gap-2">
          <Database size={14} /> {t("SQLite 数据库", "SQLite Database")}
        </h4>
        <input type="text" className="w-full border border-gray-250 p-2 text-xs font-mono rounded bg-gray-50"
          value={settings.sqlitePath} readOnly />
        <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
          <span>{t("状态", "Status")}: <span className="text-emerald-600 font-bold">● HEALTHY</span></span>
          <span>WAL {t("模式", "Mode")}</span>
        </div>
      </div>
      <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-3">
        <h4 className="font-bold text-xs text-gray-800 font-mono uppercase flex items-center gap-2">
          <HardDrive size={14} /> {t("缓存与清理", "Cache & Cleanup")}
        </h4>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">{t("保留原始 HTML", "Save Original HTML")}</span>
          <button onClick={() => persistSettings({ ...settings, saveHtml: !settings.saveHtml })}
            className={`text-xs px-3 py-1 rounded font-semibold cursor-pointer transition ${
              settings.saveHtml ? "bg-slate-800 text-white hover:bg-slate-900" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}>
            {settings.saveHtml ? t("保留", "ON") : t("丢弃", "OFF")}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">{t("自动备份", "Auto Backup")}</span>
          <button onClick={() => persistSettings({ ...settings, autoBackup: !settings.autoBackup })}
            className={`text-xs px-3 py-1 rounded font-semibold cursor-pointer transition ${
              settings.autoBackup ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}>
            {settings.autoBackup ? t("开启", "ON") : t("关闭", "OFF")}
          </button>
        </div>
        <button onClick={handleClearCache}
          className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer mt-2 transition">
          <Trash2 size={12} /> {t("清空临时缓存", "Flush Temporary Cache")}
        </button>
      </div>
    </div>
  );

  const renderPerformanceSettings = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusBadge />
      </div>
      <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-3">
        <h4 className="font-bold text-xs text-gray-800 font-mono uppercase flex items-center gap-2">
          <Cpu size={14} /> {t("全局并发控制", "Global Concurrency Control")}
        </h4>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">{t("全局最大并行查询数", "Global Max Parallel Queries")}</span>
          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{settings.globalMaxConcurrent}</span>
        </div>
        <input type="range" min="1" max="16" value={settings.globalMaxConcurrent}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            onUpdateSettings({ ...settings, globalMaxConcurrent: val });
          }}
          onMouseUp={() => persistSettings(settings)}
          onTouchEnd={() => persistSettings(settings)}
          className="w-full accent-indigo-600 cursor-pointer" />
        <div className="flex justify-between text-[10px] text-gray-400 font-mono">
          <span>1</span><span>8</span><span>16</span>
        </div>
      </div>
      <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-3">
        <h4 className="font-bold text-xs text-gray-800 font-mono uppercase">{t("研究模式预设", "Research Mode Presets")}</h4>
        <div className="flex gap-3">
          <button onClick={() => persistSettings({ ...settings, defaultCrawlDepth: "quick" })}
            className={`flex-1 p-3 rounded-lg border text-xs transition cursor-pointer ${
              settings.defaultCrawlDepth === "quick" ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold" : "border-gray-200 text-gray-600 hover:bg-slate-50"
            }`}>
            <Zap size={14} className="mx-auto mb-1" />
            <div className="font-semibold">{t("快速模式", "Quick Mode")}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">1pg / 10res</div>
          </button>
          <button onClick={() => persistSettings({ ...settings, defaultCrawlDepth: "deep" })}
            className={`flex-1 p-3 rounded-lg border text-xs transition cursor-pointer ${
              settings.defaultCrawlDepth === "deep" ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold" : "border-gray-200 text-gray-600 hover:bg-slate-50"
            }`}>
            <Database size={14} className="mx-auto mb-1" />
            <div className="font-semibold">{t("深度模式", "Deep Mode")}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">3pg / 30res</div>
          </button>
        </div>
      </div>
    </div>
  );

  const renderAppSettings = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusBadge />
      </div>

      {/* API Key */}
      <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-3">
        <h4 className="font-bold text-xs text-gray-800 font-mono uppercase flex items-center gap-2">
          <ShieldCheck size={14} /> DeepSeek API Key
        </h4>
        <p className="text-[10px] text-gray-500">{t("用于驱动想法建模和策略生成。Key 保存在本地数据库和 .env 文件。", "Powers idea modeling & strategy. Stored in local DB and .env file.")}</p>
        <div className="flex gap-2">
          <input type="password" className="flex-1 border border-gray-250 p-2 text-xs font-mono rounded"
            placeholder="sk-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <button onClick={saveApiKey}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition flex items-center gap-1.5 shrink-0">
            <Save size={12} /> {t("保存", "Save")}
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-3">
        <h4 className="font-bold text-xs text-gray-800 font-mono uppercase flex items-center gap-2">
          <Monitor size={14} /> {t("外观", "Appearance")}
        </h4>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">{t("界面语言", "Language")}</span>
          <button onClick={() => persistSettings({ ...settings, language: settings.language === "zh" ? "en" : "zh" })}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer font-mono transition">
            <Globe size={12} className="inline mr-1" />{settings.language === "zh" ? "简体中文" : "English"}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">{t("主题", "Theme")}</span>
          <button onClick={() => persistSettings({ ...settings, theme: settings.theme === "dark" ? "light" : "dark" })}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition ${
              settings.theme === "dark" ? "bg-slate-800 text-white hover:bg-slate-900" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}>
            {settings.theme === "dark" ? t("深色", "Dark") : t("浅色", "Light")}
          </button>
        </div>
      </div>

      {/* App Updates */}
      <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-3">
        <h4 className="font-bold text-xs text-gray-800 font-mono uppercase flex items-center gap-2">
          <Download size={14} /> {t("应用更新", "App Updates")}
        </h4>

        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
          <span className="text-xs text-gray-600">{t("当前版本", "Current Version")}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-gray-900">v{appVersion}</span>
            {isUpdating && (
              <span className="inline-flex items-center gap-1 text-amber-600" title={updateChecking ? t("检查更新中", "Checking for updates") : t("下载更新中", "Downloading update")}>
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[10px] font-mono animate-pulse">
                  {updateDownloading && updateProgress?.progress != null
                    ? `${updateProgress.progress}%`
                    : updateChecking
                      ? t("检查中", "Checking")
                      : updateInstalling
                        ? t("安装中", "Installing")
                        : t("下载中", "Downloading")}
                </span>
              </span>
            )}
            {readyToRestart && !isUpdating && (
              <span className="text-[10px] font-mono font-bold text-emerald-600 animate-pulse">
                {t("待升级", "Ready")}
              </span>
            )}
          </div>
        </div>

        {remoteVersion && updateAvailable && (
          <p className="text-[10px] text-indigo-700 font-mono">
            {t(`发现新版本 v${remoteVersion}`, `New version v${remoteVersion} available`)}
          </p>
        )}

        {updateError && (
          <p className="text-[10px] text-red-600 font-mono break-all">{updateError}</p>
        )}

        <p className="text-[10px] text-gray-500">
          {t("启动时自动检查更新，并在后台下载。关闭后仅可手动检查。", "Auto-check on startup and download in background. When off, use manual check only.")}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">{t("自动更新", "Auto Update")}</span>
          <button
            onClick={() => persistSettings({ ...settings, autoUpdateEnabled: !settings.autoUpdateEnabled })}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition ${
              settings.autoUpdateEnabled ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            {settings.autoUpdateEnabled ? t("开启", "ON") : t("关闭", "OFF")}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCheckUpdates}
            disabled={updateChecking || updateDownloading || updateInstalling || !onCheckForUpdates}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition flex items-center gap-1.5"
          >
            {updateChecking ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {updateChecking ? t("检查中...", "Checking...") : t("检查更新", "Check for Updates")}
          </button>
          {readyToRestart && onRestartUpdate && (
            <button
              onClick={onRestartUpdate}
              disabled={updateInstalling}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition flex items-center gap-1.5"
            >
              {updateInstalling ? <Loader2 size={12} className="animate-spin" /> : null}
              {updateInstalling ? t("安装中...", "Installing...") : t("立即升级", "Upgrade Now")}
            </button>
          )}
          {updateDownloading && (
            <span className="text-[10px] text-amber-700 font-mono flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />
              {updateProgress?.progress != null
                ? `${t("下载中", "Downloading")} ${updateProgress.progress}%`
                : t("下载中...", "Downloading...")}
            </span>
          )}
          {!updateDownloading && updateAvailable && !readyToRestart && (
            <span className="text-[10px] text-indigo-700 font-mono">{t("有新版本可用", "Update available")}</span>
          )}
        </div>
        {updateStatus && (
          <p className="text-[10px] text-gray-600 font-mono">{updateStatus}</p>
        )}
      </div>

      {/* Log Level */}
      <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-3">
        <h4 className="font-bold text-xs text-gray-800 font-mono uppercase flex items-center gap-2">
          <BellRing size={14} /> {t("通知与日志", "Logs")}
        </h4>
        <select value={logLevel} onChange={(e) => handleSaveLogLevel(e.target.value)}
          className="w-full border border-gray-250 p-2 text-xs rounded bg-white font-mono cursor-pointer">
          <option value="info">INFO ({t("默认", "default")})</option>
          <option value="debug">DEBUG</option>
          <option value="warn">WARN</option>
          <option value="error">ERROR</option>
        </select>
      </div>

      {/* Reset */}
      <div className="p-4 border border-amber-200 rounded-lg bg-amber-50/30 space-y-2">
        <h4 className="font-bold text-xs text-amber-800 font-mono uppercase flex items-center gap-2">
          <RefreshCw size={14} /> {t("重置与恢复", "Reset & Recovery")}
        </h4>
        <p className="text-[10px] text-amber-700">{t("重置所有配置到默认值。项目数据不受影响。", "Reset all settings to defaults.")}</p>
        <button onClick={() => {
          if (confirm(t("确定要重置所有配置吗？", "Reset all settings to defaults?"))) {
            const defaults: AppSettings = { language: "zh", theme: "light", globalMaxConcurrent: 8, defaultCrawlDepth: "quick", autoBackup: true, autoUpdateEnabled: true, saveHtml: false, sqlitePath: "./data/aether.db", logLevel: "info" };
            setLogLevel("info");
            setApiKey("");
            persistSettings(defaults);
          }
        }}
          className="bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 w-fit transition">
          <RefreshCw size={12} /> {t("恢复默认设置", "Restore Defaults")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in p-1 text-left">
      <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-6">
          <Settings className="text-gray-700" size={18} />
          <h2 className="text-lg font-bold text-gray-900 font-mono">{t("设置中心", "Settings Center")}</h2>
        </div>

        <div className="flex flex-wrap gap-1.5 pb-6 border-b border-gray-100">
          {subTabs.map(tab => {
            const IconComp = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === tab.id ? "bg-black text-white" : "text-gray-600 hover:bg-slate-50"
                }`}>
                <IconComp size={13} />{tab.label}
              </button>
            );
          })}
        </div>

        <div className="pt-4 max-w-3xl">
          {!configsLoaded ? (
            <div className="flex items-center justify-center py-16 gap-2 text-sm text-gray-400">
              <Loader2 size={18} className="animate-spin" />
              {t("正在加载配置...", "Loading settings...")}
            </div>
          ) : configsLoadError ? (
            <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-xs text-red-700">
              <strong>{t("配置加载失败", "Config load failed")}:</strong> {configsLoadError}
              <p className="mt-2">{t("将使用默认配置，但保存可能不可用。请检查数据库连接。", "Using defaults; save may be unavailable. Check DB.")}</p>
            </div>
          ) : (
            <>
              {activeTab === "platforms" && renderPlatformSettings()}
              {activeTab === "queries" && renderQuerySettings()}
              {activeTab === "weights" && renderWeightSettings()}
              {activeTab === "storage" && renderStorageSettings()}
              {activeTab === "performance" && renderPerformanceSettings()}
              {activeTab === "app" && renderAppSettings()}
            </>
          )}
        </div>
      </div>

      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 flex items-start gap-3">
        <HelpCircle className="text-indigo-400 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1 text-xs text-indigo-950">
          <h5 className="font-bold">{t("关于数据隐私", "About Data Privacy")}</h5>
          <p className="text-indigo-900/80 leading-relaxed font-sans">{t(
            "所有配置和 API Key 均存储在本地 SQLite 数据库 (%APPDATA%/Aether/aether.db) 中，不会上传至任何第三方。研究数据完全保留在您的本地设备上。",
            "All settings and API keys are stored in your local SQLite database. Research data stays entirely on your device."
          )}</p>
        </div>
      </div>
    </div>
  );
}

function getFallbackPlatforms(): PlatformConfig[] {
  return [
    { name: "Google Search", enabled: true, priority: 10, platformType: "search_engine", baseUrls: ["https://www.google.com/search"], queryTemplates: [{ name: "Category Query", template: "{core_keyword} tools alternatives", enabled: true, queryType: "category", applicableProductTypes: [] }, { name: "Problem Query", template: "{problem} solution software {year}", enabled: true, queryType: "problem", applicableProductTypes: [] }, { name: "Competitor Compare", template: "{competitor_name} vs alternative", enabled: true, queryType: "compare", applicableProductTypes: [] }], rateLimitRps: 2.0, timeoutMs: 15000, maxPages: 3, maxResults: 30, maxConcurrency: 4, retryCount: 2, backoffStrategy: "exponential", defaultRegion: "global", defaultLanguage: "en", participateQuick: true, participateDeep: true, parseFields: { title: true, summary: true, comments: true, rating: true, date: true, author: true, rawHtml: false }, signalWeights: { demandSignal: 1.0, dissatisfactionSignal: 0.7, reviewCredibility: 0.8, freshness: 1.2 } },
    { name: "Bing", enabled: true, priority: 8, platformType: "search_engine", baseUrls: ["https://www.bing.com"], queryTemplates: [{ name: "Category Query", template: "{core_keyword} tools alternatives comparison", enabled: true, queryType: "category", applicableProductTypes: [] }, { name: "Problem Query", template: "{problem} solution software {year}", enabled: true, queryType: "problem", applicableProductTypes: [] }, { name: "Competitor Compare", template: "{competitor_name} vs alternative", enabled: true, queryType: "compare", applicableProductTypes: [] }], rateLimitRps: 2.0, timeoutMs: 15000, maxPages: 3, maxResults: 30, maxConcurrency: 4, retryCount: 2, backoffStrategy: "exponential", defaultRegion: "global", defaultLanguage: "en", participateQuick: true, participateDeep: true, parseFields: { title: true, summary: true, comments: true, rating: true, date: true, author: true, rawHtml: false }, signalWeights: { demandSignal: 0.9, dissatisfactionSignal: 0.6, reviewCredibility: 0.7, freshness: 1.1 } },
    { name: "Reddit", enabled: true, priority: 9, platformType: "social_forum", baseUrls: ["https://www.reddit.com"], queryTemplates: [{ name: "Pain Point Dig", template: "r/{subreddit} {problem} frustrated", enabled: true, queryType: "task", applicableProductTypes: [] }, { name: "Alternative Search", template: "alternative to {competitor_name} reddit", enabled: true, queryType: "compare", applicableProductTypes: [] }, { name: "Recommendation", template: "r/{subreddit} best {category} tool", enabled: true, queryType: "category", applicableProductTypes: [] }], rateLimitRps: 1.5, timeoutMs: 12000, maxPages: 2, maxResults: 25, maxConcurrency: 3, retryCount: 3, backoffStrategy: "exponential", defaultRegion: "global", defaultLanguage: "en", participateQuick: true, participateDeep: true, parseFields: { title: true, summary: true, comments: true, rating: true, date: true, author: true, rawHtml: false }, signalWeights: { demandSignal: 1.2, dissatisfactionSignal: 1.5, reviewCredibility: 0.9, freshness: 1.0 } },
    { name: "Quora", enabled: true, priority: 6, platformType: "social_forum", baseUrls: ["https://www.quora.com"], queryTemplates: [{ name: "Problem Discovery", template: "what is the best {category} tool for", enabled: true, queryType: "category", applicableProductTypes: [] }, { name: "Alternative Discussion", template: "alternative to {competitor_name} for", enabled: true, queryType: "compare", applicableProductTypes: [] }], rateLimitRps: 1.5, timeoutMs: 12000, maxPages: 2, maxResults: 25, maxConcurrency: 3, retryCount: 2, backoffStrategy: "exponential", defaultRegion: "global", defaultLanguage: "en", participateQuick: true, participateDeep: true, parseFields: { title: true, summary: true, comments: true, rating: true, date: true, author: true, rawHtml: false }, signalWeights: { demandSignal: 1.0, dissatisfactionSignal: 1.1, reviewCredibility: 0.8, freshness: 0.9 } },
    { name: "G2 / Capterra", enabled: true, priority: 8, platformType: "review_site", baseUrls: ["https://www.g2.com"], queryTemplates: [{ name: "Review Mining", template: "{core_keyword} review complaints {year}", enabled: true, queryType: "problem", applicableProductTypes: [] }, { name: "Competitor Scrape", template: "{competitor_name} reviews pros cons", enabled: true, queryType: "brand", applicableProductTypes: [] }], rateLimitRps: 1.0, timeoutMs: 15000, maxPages: 3, maxResults: 20, maxConcurrency: 2, retryCount: 2, backoffStrategy: "exponential", defaultRegion: "us", defaultLanguage: "en", participateQuick: true, participateDeep: true, parseFields: { title: true, summary: true, comments: true, rating: true, date: true, author: true, rawHtml: false }, signalWeights: { demandSignal: 0.8, dissatisfactionSignal: 1.5, reviewCredibility: 1.2, freshness: 0.8 } },
    { name: "Trustpilot", enabled: true, priority: 7, platformType: "review_site", baseUrls: ["https://www.trustpilot.com"], queryTemplates: [{ name: "Company Review", template: "{core_keyword} review complaints trustpilot", enabled: true, queryType: "problem", applicableProductTypes: [] }, { name: "Category Comparison", template: "best {category} 2026 trustpilot", enabled: true, queryType: "category", applicableProductTypes: [] }], rateLimitRps: 1.0, timeoutMs: 15000, maxPages: 3, maxResults: 25, maxConcurrency: 2, retryCount: 2, backoffStrategy: "exponential", defaultRegion: "global", defaultLanguage: "en", participateQuick: true, participateDeep: true, parseFields: { title: true, summary: true, comments: true, rating: true, date: true, author: true, rawHtml: false }, signalWeights: { demandSignal: 0.7, dissatisfactionSignal: 1.4, reviewCredibility: 1.1, freshness: 0.8 } },
    { name: "App Store", enabled: true, priority: 7, platformType: "app_store", baseUrls: ["https://apps.apple.com"], queryTemplates: [{ name: "Rating Mining", template: "{core_keyword} app store rating crash", enabled: true, queryType: "category", applicableProductTypes: [] }, { name: "Feature Requests", template: "{competitor_name} missing feature ios", enabled: true, queryType: "intent", applicableProductTypes: [] }], rateLimitRps: 2.0, timeoutMs: 10000, maxPages: 2, maxResults: 50, maxConcurrency: 3, retryCount: 2, backoffStrategy: "exponential", defaultRegion: "us", defaultLanguage: "en", participateQuick: true, participateDeep: true, parseFields: { title: true, summary: true, comments: true, rating: true, date: true, author: true, rawHtml: false }, signalWeights: { demandSignal: 0.9, dissatisfactionSignal: 1.3, reviewCredibility: 1.0, freshness: 1.0 } },
    { name: "Google Play", enabled: true, priority: 7, platformType: "app_store", baseUrls: ["https://play.google.com"], queryTemplates: [{ name: "App Search", template: "{core_keyword}", enabled: true, queryType: "category", applicableProductTypes: [] }, { name: "Review Mining", template: "{core_keyword} review complaints", enabled: true, queryType: "problem", applicableProductTypes: [] }], rateLimitRps: 2.0, timeoutMs: 10000, maxPages: 2, maxResults: 50, maxConcurrency: 3, retryCount: 2, backoffStrategy: "exponential", defaultRegion: "us", defaultLanguage: "en", participateQuick: true, participateDeep: true, parseFields: { title: true, summary: true, comments: true, rating: true, date: true, author: true, rawHtml: false }, signalWeights: { demandSignal: 0.9, dissatisfactionSignal: 1.2, reviewCredibility: 1.0, freshness: 1.0 } },
  ];
}
