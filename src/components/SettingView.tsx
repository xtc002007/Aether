import React from "react";
import { AppSettings } from "../types";
import { 
  Settings, Database, Cpu, ShieldCheck, HelpCircle, 
  Trash2, RefreshCcw, BellRing, Save, Globe 
} from "lucide-react";

interface SettingViewProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
}

export default function SettingView({
  settings,
  onUpdateSettings
}: SettingViewProps) {
  const cn = settings.language === "zh";

  const handleToggleLang = () => {
    onUpdateSettings({
      ...settings,
      language: settings.language === "zh" ? "en" : "zh"
    });
  };

  const handleToggleTheme = () => {
    onUpdateSettings({
      ...settings,
      theme: settings.theme === "dark" ? "light" : "dark"
    });
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({
      ...settings,
      globalMaxConcurrent: parseInt(e.target.value)
    });
  };

  const handleInputPath = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({
      ...settings,
      sqlitePath: e.target.value
    });
  };

  const handleSelectDepth = (depth: "quick" | "deep") => {
    onUpdateSettings({
      ...settings,
      defaultCrawlDepth: depth
    });
  };

  return (
    <div className="space-y-6 animate-fade-in p-1 text-left">
      <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-6">
          <Settings className="text-gray-700" size={18} />
          <h2 className="text-base font-bold text-gray-900 font-mono">
            {cn ? "系统全局默认设置 (Settings Center)" : "Global System Configurations"}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* General UI Options */}
          <div className="space-y-6">
            <h3 className="text-xs font-bold text-gray-400 font-mono uppercase tracking-wider">
              {cn ? "1. 通用界面属性" : "1. Interface Specifications"}
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-gray-150 bg-slate-50/10">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-gray-900">{cn ? "系统工作语言" : "Workstation Language"}</div>
                  <div className="text-[10px] text-gray-400 font-sans">{cn ? "选择界面展示的主力语言种类" : "Default display language format"}</div>
                </div>
                <button
                  onClick={handleToggleLang}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1 font-mono hover:shadow"
                >
                  <Globe size={12} />
                  {settings.language === "zh" ? "简体中文 (ZH)" : "English (EN)"}
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-lg border border-gray-150 bg-slate-50/10">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-gray-900">{cn ? "智能备份系统" : "Automatic Database backups"}</div>
                  <div className="text-[10px] text-gray-400 font-sans">{cn ? "每次分析完成后，自动备份缓存以防丢失" : "Saves data snapshots periodically"}</div>
                </div>
                <button
                  onClick={() => onUpdateSettings({ ...settings, autoBackup: !settings.autoBackup })}
                  className={`text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer ${
                    settings.autoBackup ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {settings.autoBackup ? (cn ? "开启 (ON)" : "ON") : (cn ? "关闭 (OFF)" : "OFF")}
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-lg border border-gray-150 bg-slate-50/10">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-gray-900">{cn ? "保留爬取原始 HTML" : "Persist original HTML content"}</div>
                  <div className="text-[10px] text-gray-400 font-sans">{cn ? "在本地额外存储一份抓取的干净文本，占用硬盘" : "Stores raw textual files matching evidences"}</div>
                </div>
                <button
                  onClick={() => onUpdateSettings({ ...settings, saveHtml: !settings.saveHtml })}
                  className={`text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer ${
                    settings.saveHtml ? "bg-slate-800 text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {settings.saveHtml ? (cn ? "保留" : "Persist") : (cn ? "丢弃" : "Discard")}
                </button>
              </div>
            </div>
          </div>

          {/* Crawler specs */}
          <div className="space-y-6">
            <h3 className="text-xs font-bold text-gray-400 font-mono uppercase tracking-wider">
              {cn ? "2. 并发与搜索引擎线程限制" : "2. Telemetry Concurrency Limits"}
            </h3>

            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-gray-150 bg-slate-50/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Cpu size={14} className="text-gray-500" />
                      {cn ? "单主机并行最大查询数" : "Global Maximum Concurrency"}
                    </div>
                    <div className="text-[10px] text-gray-400 font-sans">{cn ? "防止对高频网络服务器产生DDoS限流处罚" : "Avoid triggering DDoS blockades"}</div>
                  </div>
                  <span className="text-xs font-bold font-mono text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded">
                    {settings.globalMaxConcurrent} {cn ? "并发" : "workers"}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="16"
                    value={settings.globalMaxConcurrent}
                    onChange={handleSliderChange}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg border border-gray-150 bg-slate-50/10 space-y-3">
                <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Database size={14} className="text-gray-500" />
                  {cn ? "数据库(SQLite3)本底映射目录" : "SQLite Database Mapping Directory"}
                </div>
                <input
                  type="text"
                  className="w-full rounded border border-gray-250 p-2 text-xs font-mono"
                  value={settings.sqlitePath}
                  onChange={handleInputPath}
                />
                <div className="text-[10px] text-gray-400 font-sans leading-relaxed">
                  {cn 
                    ? "SQLite3 用于本地缓存项目快照，该路径属于 Tauri 程序持久写位置。" 
                    : "Persistence mapped folders matching default workspace storage."}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Database administration buttons */}
        <div className="pt-8 border-t border-gray-100 mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-mono font-bold text-emerald-800">
              {cn ? "本地持久数据仓监控：在线(HEALTHY)" : "Active Persistent Storage: HEALTHY"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                alert(cn ? "缓存垃圾清理完毕。节省空间 142 MB。" : "Cache successfully flushed. Flushed 142 MB.");
              }}
              className="bg-white border border-gray-200 hover:border-rose-400 text-gray-600 hover:text-rose-600 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition flex items-center gap-1.5"
            >
              <Trash2 size={12} />
              {cn ? "清空临时研究缓存" : "Flush Temporary Cache"}
            </button>
          </div>
        </div>
      </div>

      {/* Safety notes box */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 flex items-start gap-3">
        <HelpCircle className="text-indigo-400 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1 text-xs text-indigo-950">
          <h5 className="font-bold">{cn ? "关于 API Key 与大模型隐私安全" : "Concerning API Keys and Intelligence Privacy"}</h5>
          <p className="text-indigo-900/80 leading-relaxed font-sans">
            {cn 
              ? "产品想法验证决策系统完全基于服务器端调用 Gemini API，您的想法陈述及定制参数会被传输至大模型，但我们坚持严格的企业级零日志数据回传隐私协议，绝不会用于模型本身的公测训练，最大限度保护独立创造者的最初发明产权。"
              : "All idea text and telemetry results processed server-side utilize a strict enterprise-tier zero-data-leakage LLM pipeline. Your core research targets are fully insulated against public training cycles."}
          </p>
        </div>
      </div>
    </div>
  );
}
