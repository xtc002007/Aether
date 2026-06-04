import React, { useState, useEffect } from "react";
import { SearchTask, AppSettings } from "../types";
import { listen } from "@tauri-apps/api/event";
import { Play } from "lucide-react";

interface SearchTasksViewProps {
  projectId: string;
  searchTasks: SearchTask[];
  settings: AppSettings;
  onCancel: () => void;
  onReminder: (type: "warning" | "info" | "success" | "error", message: string) => void;
}

export default function SearchTasksView({
  projectId,
  searchTasks,
  settings,
  onCancel,
  onReminder,
}: SearchTasksViewProps) {
  const cn = settings.language === "zh";
  const [liveTasks, setLiveTasks] = useState<SearchTask[]>(searchTasks);
  const [isRunning, setIsRunning] = useState(false);

  // Sync with parent when searchTasks changes
  useEffect(() => {
    setLiveTasks(searchTasks);
  }, [searchTasks]);

  // P1-10: Listen for real-time progress events
  useEffect(() => {
    let unlisten1: (() => void) | undefined;
    let unlisten2: (() => void) | undefined;
    (async () => {
      unlisten1 = await listen<{ stage: string; message: string; progressPct: number }>(
        "analysis-progress",
        (event) => {
          if (event.payload.stage === "searching") {
            setIsRunning(true);
          }
          if (event.payload.stage === "complete" || event.payload.stage === "loading") {
            setIsRunning(false);
          }
        }
      );
      // A5/B3: Listen for per-query task-progress events
      unlisten2 = await listen<{
        platform: string; query: string; status: string;
        count: number; durationMs: number; logs: string; retryCount: number;
      }>("task-progress", (event) => {
        const tp = event.payload;
        setIsRunning(true);
        setLiveTasks(prev => {
          const existing = prev.findIndex(t => t.platform === tp.platform && t.query === tp.query);
          const newTask: SearchTask = {
            platform: tp.platform,
            query: tp.query,
            status: tp.status as SearchTask["status"],
            count: tp.count,
            durationMs: tp.durationMs,
            logs: tp.logs,
            retryCount: tp.retryCount,
            startedAt: new Date().toISOString(),
          };
          if (existing >= 0) {
            const copy = [...prev];
            copy[existing] = newTask;
            return copy;
          }
          return [...prev, newTask];
        });
      });
    })();
    return () => { unlisten1?.(); unlisten2?.(); };
  }, [projectId]);

  const emptyPlatforms = Array.from(
    new Set(liveTasks.filter((t) => t.status === "empty").map((t) => t.platform))
  );

  const handleCancel = async () => {
    try {
      await onCancel();
      onReminder("warning", cn ? "已发送取消信号，正在终止搜索..." : "Cancellation signal sent, stopping...");
    } catch (err) {
      onReminder("error", String(err));
    }
  };

  if (liveTasks.length === 0 && !isRunning) {
    return (
      <div className="bg-white rounded-xl border border-gray-250 p-6 text-left shadow-sm animate-fade-in dark:bg-[#191816] dark:border-[#3E3A35]">
        <div className="text-center py-12 text-gray-400">
          <Play size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{cn ? "暂无搜索任务记录" : "No search task records"}</p>
          <p className="text-xs mt-1">
            {cn ? "点击「开启全网并联分析」启动调研" : "Launch a parallel scan to see tasks here"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-250 p-6 text-left shadow-sm space-y-6 animate-fade-in dark:bg-[#191816] dark:border-[#3E3A35]">
      {/* Empty platform warning */}
      {emptyPlatforms.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-xs dark:bg-amber-900/20 dark:border-amber-700">
          <p className="font-bold text-amber-800 dark:text-amber-300 mb-1">
            {cn
              ? "以下平台返回了 0 条结果"
              : "The following platforms returned 0 results"}
            :
          </p>
          <p className="text-amber-700 dark:text-amber-400">
            {emptyPlatforms.join("、")}
          </p>
          <p className="text-amber-600 mt-2 leading-relaxed dark:text-amber-500">
            {cn
              ? "Google、G2 等平台需要配置 SERP_API_KEY 或 SERPER_API_KEY 才能获取真实数据。请在系统环境变量中设置后重启应用。"
              : "Google, G2, and similar platforms require SERP_API_KEY or SERPER_API_KEY set as environment variables. Restart after configuring."}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-2">
        <div className="flex items-center gap-2">
          <Play className="text-indigo-600" size={16} />
          <h2 className="text-base font-bold text-gray-900 font-mono dark:text-white">
            {cn ? "并行采集任务监控" : "Parallel Crawler Monitor"}
          </h2>
          {isRunning && (
            <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse dark:bg-indigo-900/30 dark:text-indigo-300">
              {cn ? "运行中" : "RUNNING"}
            </span>
          )}
        </div>
        {isRunning && (
          <button
            onClick={handleCancel}
            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold px-3 py-1.5 rounded cursor-pointer font-mono uppercase flex items-center gap-1 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
          >
            {cn ? "取消运行" : "Cancel"}
          </button>
        )}
      </div>

      {/* Platform Parallel View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from(new Set(liveTasks.map((t) => t.platform))).map((platform) => {
          const pts = liveTasks.filter((t) => t.platform === platform);
          const succeeded = pts.filter((t) => t.status === "success").length;
          const empty = pts.filter((t) => t.status === "empty").length;
          const failed = pts.filter((t) => t.status === "failed").length;
          const totalResults = pts.reduce((sum, t) => sum + (t.count || 0), 0);
          const totalDuration = pts.reduce((sum, t) => sum + (t.durationMs || 0), 0);
          const dotColor =
            succeeded > 0 ? "bg-emerald-500" : failed > 0 ? "bg-red-500" : "bg-amber-500";
          return (
            <div
              key={platform}
              className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm dark:bg-[#22201D] dark:border-[#3E3A35]"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm text-gray-900 font-mono dark:text-white">
                  {platform}
                </span>
                <span className={`w-2 h-2 rounded-full ${dotColor}`} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-gray-500 mb-2">
                <div>
                  {cn ? "结果" : "Results"}:{" "}
                  <b className={totalResults > 0 ? "text-emerald-600" : "text-amber-600"}>
                    {totalResults}
                  </b>
                </div>
                <div>
                  {cn ? "空返回" : "Empty"}:{" "}
                  <b className={empty > 0 ? "text-amber-600" : "text-gray-400"}>{empty}</b>
                </div>
                <div>
                  {cn ? "耗时" : "Time"}: <b>{totalDuration}ms</b>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden dark:bg-[#3E3A35]">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{
                    width: `${pts.length > 0 ? ((succeeded + empty) / pts.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Task List */}
      <div className="space-y-3.5">
        {liveTasks.map((task, idx) => (
          <div
            key={idx}
            className="p-4 rounded-lg border border-gray-200 bg-white shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 dark:bg-[#22201D] dark:border-[#3E3A35]"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-950 font-mono dark:text-white">
                  {task.platform}
                </span>
                <span className="text-[9px] bg-slate-100 text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 font-mono dark:bg-[#3E3A35] dark:text-gray-300">
                  {task.query}
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed font-sans">{task.logs}</p>
            </div>
            <div className="shrink-0 flex items-center gap-4 text-xs font-mono text-gray-500">
              <span>{task.durationMs}ms</span>
              {task.retryCount > 0 && (
                <span className="text-amber-600">
                  {cn ? "重试" : "Retry"}: {task.retryCount}
                </span>
              )}
              <span
                className={`font-bold px-2.5 py-0.5 rounded border text-[10px] uppercase ${
                  task.status === "success"
                    ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                    : task.status === "empty"
                    ? "text-amber-600 bg-amber-50 border-amber-200"
                    : task.status === "failed"
                    ? "text-red-600 bg-red-50 border-red-100"
                    : "text-amber-600 bg-amber-50 border-amber-100"
                }`}
              >
                {task.status === "success"
                  ? "SUCCESS"
                  : task.status === "empty"
                  ? "0 RESULTS"
                  : task.status === "failed"
                  ? "FAILED"
                  : task.status.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Log Terminal */}
      <div className="bg-slate-900 rounded-lg p-5 text-gray-200 font-mono text-xs space-y-2 border border-gray-800">
        <div className="text-[10px] text-gray-400 uppercase flex items-center gap-2 border-b border-slate-800 pb-2 mb-2">
          LOG CONSOLE
        </div>
        {Array.from(new Set(liveTasks.map((t) => t.platform))).map((platform) => {
          const pts = liveTasks.filter((t) => t.platform === platform);
          const total = pts.reduce((s, t) => s + (t.count || 0), 0);
          const failed = pts.filter((t) => t.status === "failed").length;
          const empty = pts.filter((t) => t.status === "empty").length;
          const color =
            total > 0 ? "text-emerald-400" : failed > 0 ? "text-red-400" : "text-amber-400";
          const statusText =
            total > 0 ? `+${total} results` : failed > 0 ? "FAILED" : "0 results";
          return (
            <p key={platform} className={color}>
              &gt; [{platform}] {pts.length} queries → {statusText}
            </p>
          );
        })}
        <p className="text-gray-500 pt-2 border-t border-slate-800">
          &gt;{" "}
          {cn
            ? "提示: 黄色 = 返回 0 结果（可能需要 API Key）"
            : "Tip: Amber = 0 results (API key may be needed)"}
        </p>
      </div>
    </div>
  );
}
