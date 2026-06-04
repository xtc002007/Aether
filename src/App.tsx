import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { ResearchProject, AppSettings, SerializedProject, SystemReminder, PlatformWeights, ProjectSnapshot, ExportRecord } from "./types";
import { DEFAULT_SETTINGS, DEFAULT_PLATFORM_WEIGHTS } from "./mockData";

import HomeView from "./components/HomeView";
import OverviewView from "./components/OverviewView";
import IdeaModelingView from "./components/IdeaModelingView";
import CompetitorView from "./components/CompetitorView";
import UserVoiceView from "./components/UserVoiceView";
import EvaluationView from "./components/EvaluationView";
import StrategyView from "./components/StrategyView";
import SearchTasksView from "./components/SearchTasksView";
import ValidationView from "./components/ValidationView";
import SettingView from "./components/SettingView";
import PlatformConfigView from "./components/PlatformConfigView";
import CompareView from "./components/CompareView";
import SnapshotManager from "./components/SnapshotManager";

import {
  Home, Layers, Settings, Play, Layout,
  ChevronLeft, ChevronRight, HelpCircle, ArrowLeftRight,
  Download, Compass, CheckSquare, Search,
  MessageSquare, Sliders, Radio, RefreshCw, FileText as ReportIcon,
  ClipboardCopy, Bell, History, X as XIcon
} from "lucide-react";

export default function App() {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [currentTab, setCurrentTab] = useState<string>("home");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRightDrawerCollapsed, setIsRightDrawerCollapsed] = useState(false);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  const [reminders, setReminders] = useState<SystemReminder[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showSnapshotManager, setShowSnapshotManager] = useState(false);
  const [snapshotManagerProjectId, setSnapshotManagerProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ title: string; content: string; platform: string }[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isReSearching, setIsReSearching] = useState(false);

  const cn = settings.language === "zh";

  const addReminder = useCallback((type: SystemReminder["type"], message: string) => {
    const id = `rem-${Date.now()}`;
    setReminders(prev => [...prev, { id, type, message, timestamp: new Date().toISOString(), dismissed: false }]);
    setTimeout(() => {
      setReminders(prev => prev.filter(r => r.id !== id));
    }, 8000);
  }, []);

  const dismissReminder = (id: string) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, dismissed: true } : r));
  };

  // Check Tauri availability on mount
  useEffect(() => {
    async function init() {
      try {
        const isTauri = !!(window as any).__TAURI_INTERNALS__;
        if (!isTauri) {
          setConnectionError(cn
            ? "未检测到 Tauri 运行时。请在 Tauri 桌面应用中运行。"
            : "Tauri runtime not detected. Please run in the Tauri desktop app.");
          setInitialLoading(false);
          return;
        }

        const [projList, appSettings] = await Promise.all([
          invoke<SerializedProject[]>("get_projects").catch(() => [] as SerializedProject[]),
          invoke<AppSettings>("get_settings").catch(() => DEFAULT_SETTINGS as any),
        ]);

        if (appSettings) {
          setSettings(appSettings as AppSettings);
        }

        if (projList && projList.length > 0) {
          const first = projList[0];
          const detail = await invoke<ResearchProject>("get_project", { projectId: first.id })
            .catch(() => null);

          if (detail) {
            setProjects([detail]);
            setSelectedProjectId(first.id);
          }

          for (let i = 1; i < projList.length; i++) {
            invoke<ResearchProject>("get_project", { projectId: projList[i].id })
              .then(detail => {
                setProjects(prev => prev.find(p => p.id === detail.id) ? prev : [...prev, detail]);
              })
              .catch(() => {});
          }

          // Recovery: check for interrupted analyses
          for (const sp of projList) {
            if (sp.status === "searching" || sp.status === "modeling") {
              try {
                const snaps = await invoke<ProjectSnapshot[]>("list_snapshots", { projectId: sp.id });
                if (snaps.length > 0) {
                  const latest = snaps[0];
                  const stageCn = latest.checkpointStage === "platform_queries_done" ? "平台查询完成"
                    : latest.checkpointStage === "signals_extracted" ? "信号提取完成"
                    : latest.checkpointStage || "最近保存点";
                  addReminder("warning", cn
                    ? `项目「${sp.name}」的分析被中断，可恢复至：${stageCn}`
                    : `Analysis for "${sp.name}" was interrupted. Recover from: ${latest.checkpointStage || "last checkpoint"}`);
                }
              } catch (_) {}
            }
          }
        }
      } catch (err) {
        console.error("Init error:", err);
        setConnectionError(String(err));
      } finally {
        setInitialLoading(false);
      }
    }
    init();
  }, []);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null;

  useEffect(() => {
    if (settings.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.theme]);

  useEffect(() => {
    if (selectedProject) {
      document.title = cn
        ? `【Aether】${selectedProject.name} - 产品想法验证系统`
        : `[Aether] ${selectedProject.name} - Idea Research`;
    } else {
      document.title = "Aether - 产品想法调研与决策系统";
    }
  }, [selectedProjectId, settings.language, projects]);

  useEffect(() => {
    if (currentTab === "export") { loadExportHistory(); }
  }, [currentTab]);

  const [progressStage, setProgressStage] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const [progressWarning, setProgressWarning] = useState("");

  const handleCreateProject = async (formData: {
    statement: string; productForm: string; targetUser: string; scenario: string; researchMode: string;
  }) => {
    setIsCreating(true);
    setSearchProgress(0);
    setProgressStage(cn ? "开始创建..." : "Starting...");
    setProgressMessage("");
    setProgressWarning("");
    setCurrentTab("home");

    // Subscribe to real-time progress events from backend
    const unlisten = await listen<{ stage: string; message: string; progressPct: number }>("analysis-progress", (event) => {
      setProgressStage(event.payload.stage);
      if (event.payload.stage === "warning") {
        setProgressWarning(prev => prev ? prev + "\n" + event.payload.message : event.payload.message);
      } else {
        setProgressMessage(event.payload.message);
      }
      setSearchProgress(event.payload.progressPct);
    });

    try {
      const newProject = await invoke<ResearchProject>("create_project", {
        statement: formData.statement,
        productForm: formData.productForm,
        targetUser: formData.targetUser,
        scenario: formData.scenario,
        researchMode: formData.researchMode,
      });

      const enabledPlatforms = ["Reddit", "Google Search", "Bing", "G2 / Capterra", "App Store", "Google Play", "Quora", "Trustpilot"];
      const analyzed = await invoke<ResearchProject>("analyze_idea", {
        projectId: newProject.id,
        statement: formData.statement,
        productForm: formData.productForm,
        targetUser: formData.targetUser,
        scenario: formData.scenario,
        enabledPlatforms,
        platformWeights: DEFAULT_PLATFORM_WEIGHTS,
        researchMode: formData.researchMode,
      });

      setSearchProgress(100);
      setProgressStage(cn ? "完成" : "Complete");
      setProjects(prev => [analyzed, ...prev]);
      setSelectedProjectId(analyzed.id);

      const totalResults = analyzed.searchTasks.reduce((s, t) => s + (t.count || 0), 0);
      const emptyPlatforms = [...new Set(analyzed.searchTasks.filter(t => t.status === "empty").map(t => t.platform))];
      let completionMsg = cn
        ? `研究完成！共采集 ${totalResults} 条数据（${analyzed.searchTasks.length} 个任务）。`
        : `Complete! Collected ${totalResults} results (${analyzed.searchTasks.length} tasks).`;
      if (emptyPlatforms.length > 0) {
        completionMsg += " " + (cn
          ? `⚠️ ${emptyPlatforms.join("、")} 返回 0 条结果——需要配置 SERP_API_KEY。`
          : ` ⚠️ ${emptyPlatforms.join(", ")} returned 0 results — configure SERP_API_KEY.`);
      }
      addReminder(totalResults > 0 ? "success" : "warning", completionMsg);

      setTimeout(() => {
        setIsCreating(false);
        setCurrentTab("overview");
      }, 500);
    } catch (err) {
      console.error("Create project error:", err);
      setIsCreating(false);
      addReminder("error", cn ? `创建失败: ${String(err)}` : `Creation failed: ${String(err)}`);
    } finally {
      unlisten();
    }
  };

  const handleReevaluate = async (strategyMode?: string) => {
    if (!selectedProject) return;
    setIsLoading(true);
    try {
      const result = await invoke<ResearchProject>("re_evaluate", {
        projectId: selectedProject.id,
        platformWeights: selectedProject.platformWeights,
        strategyMode: strategyMode || null,
      });
      setProjects(prev => prev.map(p => p.id === selectedProject.id ? result : p));
      addReminder("success", cn ? "评估已重新计算" : "Evaluation recalculated");
    } catch (err) {
      console.error("Re-evaluate error:", err);
      addReminder("error", String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReSearch = async () => {
    if (!selectedProject) return;
    setIsReSearching(true);
    setSearchProgress(0);
    setProgressStage(cn ? "开始迭代搜索..." : "Starting iterative search...");
    setProgressMessage("");
    setProgressWarning("");

    const unlisten = await listen<{ stage: string; message: string; progressPct: number }>("analysis-progress", (event) => {
      setProgressStage(event.payload.stage);
      if (event.payload.stage === "warning") {
        setProgressWarning(prev => prev ? prev + "\n" + event.payload.message : event.payload.message);
      } else {
        setProgressMessage(event.payload.message);
      }
      setSearchProgress(event.payload.progressPct);
    });

    try {
      const p = selectedProject;
      const analyzed = await invoke<ResearchProject>("analyze_idea", {
        projectId: p.id,
        statement: p.ideaModel.statement,
        productForm: p.ideaModel.productForm,
        targetUser: p.ideaModel.targetUser,
        scenario: p.ideaModel.useScenario,
        enabledPlatforms: p.enabledPlatforms,
        platformWeights: p.platformWeights,
        researchMode: p.researchMode,
      });

      setSearchProgress(100);
      setProjects(prev => prev.map(proj => proj.id === analyzed.id ? analyzed : proj));

      const totalResults = analyzed.searchTasks.reduce((s, t) => s + (t.count || 0), 0);
      addReminder("success", cn
        ? `迭代搜索完成！采集 ${totalResults} 条新数据，评估与策略已刷新。`
        : `Re-search complete! ${totalResults} new results. Evaluation & strategy refreshed.`);
    } catch (err) {
      console.error("Re-search error:", err);
      addReminder("error", cn ? `迭代搜索失败: ${String(err)}` : `Re-search failed: ${String(err)}`);
    } finally {
      setIsReSearching(false);
      unlisten();
    }
  };

  const handleUpdateProject = async (updated: ResearchProject) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    try {
      await invoke("update_project", {
        projectId: updated.id,
        projectData: updated,
      });
    } catch (err) {
      console.error("Failed to persist project:", err);
    }
  };

  const handleSelectProject = async (id: string) => {
    setSelectedProjectId(id);
    const existing = projects.find(p => p.id === id);
    if (existing && existing.evaluation?.dimensions?.length > 0) return;

    try {
      const full = await invoke<ResearchProject>("get_project", { projectId: id });
      setProjects(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx >= 0) { const copy = [...prev]; copy[idx] = full; return copy; }
        return [...prev, full];
      });
    } catch (err) {
      console.error("Failed to load project:", err);
    }
  };

  const handleOpenSnapshotManager = (projectId: string) => {
    setSnapshotManagerProjectId(projectId);
    setShowSnapshotManager(true);
  };

  const handleRestoreFromSnapshot = (restoredProject: ResearchProject) => {
    setProjects(prev => prev.map(p => p.id === restoredProject.id ? restoredProject : p));
    setSelectedProjectId(restoredProject.id);
    setShowSnapshotManager(false);
    addReminder("success", cn
      ? `已从快照恢复项目「${restoredProject.name}」`
      : `Project "${restoredProject.name}" restored from snapshot`);
  };

  const [reportContent, setReportContent] = useState<string>("");
  const [reportLoading, setReportLoading] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportRecord[]>([]);

  const loadExportHistory = async () => {
    try {
      const history = await invoke<ExportRecord[]>("get_export_history");
      setExportHistory(history);
    } catch (_) {}
  };

  const fetchReport = async (format: "markdown" | "html" | "json"): Promise<string> => {
    if (!selectedProject) return "";
    setReportLoading(true);
    try {
      const result = await invoke<{ markdown: string; html: string; json: string }>("export_report", {
        projectId: selectedProject.id,
        format: format,
      });
      let content: string;
      if (format === "markdown") content = result.markdown;
      else if (format === "html") content = result.html;
      else content = result.json;
      setReportContent(content);
      return content;
    } catch (err) {
      console.error("Failed to load report:", err);
      setReportContent(String(err));
      return "";
    } finally {
      setReportLoading(false);
    }
  };

  // P2-6: Dynamic context panel content per tab
  const renderContextContent = () => {
    if (!selectedProject) {
      return (
        <div className="space-y-4 text-xs">
          <div>
            <h4 className="font-bold text-gray-900 border-b border-gray-50 pb-1 flex items-center gap-1 dark:text-white">
              <HelpCircle size={13} className="text-gray-400" />{cn ? "上下文助手" : "Context Helper"}
            </h4>
            <p className="text-gray-600 font-sans leading-relaxed pt-2 dark:text-gray-400">
              {cn ? "选择左侧导航进入对应工作区。" : "Select a nav item to enter the workspace."}
            </p>
          </div>
        </div>
      );
    }

    const p = selectedProject;
    switch (currentTab) {
      case "overview":
        return (
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-gray-900 border-b border-gray-50 pb-1 flex items-center gap-1 dark:text-white">
                <HelpCircle size={13} className="text-gray-400" />{cn ? "项目快照" : "Project Snapshot"}
              </h4>
              <div className="space-y-1.5 pt-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "竞品" : "Competitors"}:</span>
                  <span className="font-bold text-indigo-700">{p.competitors.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "用户声音" : "Voices"}:</span>
                  <span className="font-bold text-indigo-700">{p.userVoices.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "信号" : "Signals"}:</span>
                  <span className="font-bold text-indigo-700">{p.signals.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "搜索任务" : "Tasks"}:</span>
                  <span className="font-bold text-indigo-700">{p.searchTasks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "置信度" : "Confidence"}:</span>
                  <span className="font-bold text-indigo-700">{p.evaluation.confidenceScore}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "研究模式" : "Mode"}:</span>
                  <span className="font-bold">{p.researchMode === "deep" ? (cn ? "深度" : "Deep") : (cn ? "快速" : "Quick")}</span>
                </div>
              </div>
            </div>
            {p.evaluation.keyOpportunities && (
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] leading-relaxed">
                <span className="font-bold block mb-1">{cn ? "关键机会" : "Key Opportunities"}</span>
                {p.evaluation.keyOpportunities}
              </div>
            )}
            {p.evaluation.keyRisks && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-900 border border-rose-200 text-[10px] leading-relaxed">
                <span className="font-bold block mb-1">{cn ? "主要风险" : "Key Risks"}</span>
                {p.evaluation.keyRisks}
              </div>
            )}
          </div>
        );

      case "modeling":
        return (
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-gray-900 border-b border-gray-50 pb-1 flex items-center gap-1 dark:text-white">
                <HelpCircle size={13} className="text-gray-400" />{cn ? "建模摘要" : "Model Summary"}
              </h4>
              <div className="space-y-1.5 pt-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "类别数" : "Categories"}:</span>
                  <span className="font-bold">{p.ideaModel.categories.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "关键词数" : "Keywords"}:</span>
                  <span className="font-bold">{p.ideaModel.suggestedKeywords.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "产品形态" : "Product Form"}:</span>
                  <span className="font-bold">{p.ideaModel.productForm}</span>
                </div>
              </div>
              {p.ideaModel.categories.length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] text-gray-400 font-mono uppercase block mb-1">{cn ? "类别" : "Categories"}</span>
                  <div className="flex flex-wrap gap-1">
                    {p.ideaModel.categories.slice(0, 8).map((c, i) => (
                      <span key={i} className="bg-indigo-50 text-indigo-700 text-[9px] font-mono px-1.5 py-0.5 rounded">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {p.ideaModel.suggestedKeywords.length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] text-gray-400 font-mono uppercase block mb-1">{cn ? "关键词" : "Keywords"}</span>
                  <div className="flex flex-wrap gap-1">
                    {p.ideaModel.suggestedKeywords.slice(0, 6).map((kw, i) => (
                      <span key={i} className="bg-gray-100 text-gray-600 text-[9px] font-mono px-1.5 py-0.5 rounded">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case "competitors":
        return (
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-gray-900 border-b border-gray-50 pb-1 flex items-center gap-1 dark:text-white">
                <HelpCircle size={13} className="text-gray-400" />{cn ? "竞品格局" : "Competitive Landscape"}
              </h4>
              <div className="space-y-1.5 pt-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "直接竞品" : "Direct"}:</span>
                  <span className="font-bold">{p.competitors.filter(c => c.categoryGroup.includes("Direct") || c.categoryGroup.includes("直接")).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "间接竞品" : "Indirect"}:</span>
                  <span className="font-bold">{p.competitors.filter(c => c.categoryGroup.includes("Indirect") || c.categoryGroup.includes("间接")).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "替代方案" : "Alternatives"}:</span>
                  <span className="font-bold">{p.competitors.filter(c => c.categoryGroup.includes("Alternative") || c.categoryGroup.includes("替代")).length}</span>
                </div>
              </div>
            </div>
            {p.competitors.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-[10px] leading-relaxed">
                <span className="font-bold block mb-1">{cn ? "提示" : "Tip"}</span>
                {cn ? "在左侧类别树中筛选竞品，点击卡片查看差异化分析。竞品分组可通过下拉菜单调整。" : "Filter competitors in the category tree. Click a card for differentiation analysis. Regroup via dropdown."}
              </div>
            )}
          </div>
        );

      case "evaluation":
        return (
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-gray-900 border-b border-gray-50 pb-1 flex items-center gap-1 dark:text-white">
                <HelpCircle size={13} className="text-gray-400" />{cn ? "评估洞察" : "Evaluation Insights"}
              </h4>
              <div className="space-y-2 pt-2">
                {p.evaluation.dimensions.filter(d => d.score >= 8).length > 0 && (
                  <div>
                    <span className="text-[10px] text-emerald-600 font-mono uppercase block mb-1">{cn ? "优势维度" : "Strengths"}</span>
                    {p.evaluation.dimensions.filter(d => d.score >= 8).map((d, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{d.name}: {d.score}/10</span>
                      </div>
                    ))}
                  </div>
                )}
                {p.evaluation.dimensions.filter(d => d.score <= 4).length > 0 && (
                  <div>
                    <span className="text-[10px] text-rose-600 font-mono uppercase block mb-1">{cn ? "薄弱维度" : "Weaknesses"}</span>
                    {p.evaluation.dimensions.filter(d => d.score <= 4).map((d, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{d.name}: {d.score}/10</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pt-1 border-t border-gray-100 dark:border-[#3E3A35]">
                  <span className="text-gray-500">{cn ? "使用「修正动作」面板补充数据或调整权重后点击重新计算。" : "Use the Corrective Actions panel to add data, then recalculate."}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case "strategy":
        return (
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-gray-900 border-b border-gray-50 pb-1 flex items-center gap-1 dark:text-white">
                <HelpCircle size={13} className="text-gray-400" />{cn ? "策略上下文" : "Strategy Context"}
              </h4>
              <div className="space-y-3 pt-2 font-sans">
                <div className="p-3 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 text-[11px] leading-relaxed">
                  <span className="font-bold block mb-1">{cn ? "市场局面" : "Market Scenario"}</span>
                  {p.strategy.marketScenario}
                </div>
                <div className="p-3 rounded-lg bg-slate-50 text-gray-700 border border-gray-200 text-[10px] leading-relaxed">
                  <span className="font-bold block mb-1">{cn ? "策略模式说明" : "Strategy Mode Guide"}</span>
                  <ul className="space-y-1">
                    <li><b>{cn ? "保守切入" : "Conservative"}:</b> {cn ? "控制风险，先验证后扩展" : "Min risk, validate then expand"}</li>
                    <li><b>{cn ? "激进切入" : "Aggressive"}:</b> {cn ? "高举高打，快速占领" : "Move fast, capture fast"}</li>
                    <li><b>{cn ? "低成本优先" : "Low-Cost"}:</b> {cn ? "最小资源验证核心假设" : "Minimum resources to prove hypothesis"}</li>
                    <li><b>{cn ? "高差异化" : "High Diff"}:</b> {cn ? "攻击竞品最薄弱环节" : "Attack weakest competitor points"}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case "tasks":
        return (
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-gray-900 border-b border-gray-50 pb-1 flex items-center gap-1 dark:text-white">
                <HelpCircle size={13} className="text-gray-400" />{cn ? "任务摘要" : "Task Summary"}
              </h4>
              <div className="space-y-1.5 pt-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "成功" : "Success"}:</span>
                  <span className="font-bold text-emerald-600">{p.searchTasks.filter(t => t.status === "success").length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "空返回" : "Empty"}:</span>
                  <span className="font-bold text-amber-600">{p.searchTasks.filter(t => t.status === "empty").length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "失败" : "Failed"}:</span>
                  <span className="font-bold text-rose-600">{p.searchTasks.filter(t => t.status === "failed").length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "总结果数" : "Total Results"}:</span>
                  <span className="font-bold">{p.searchTasks.reduce((s, t) => s + (t.count || 0), 0)}</span>
                </div>
              </div>
              {!p.searchTasks.length && (
                <p className="text-gray-400 pt-2">{cn ? "尚未执行搜索任务。" : "No search tasks executed yet."}</p>
              )}
            </div>
          </div>
        );

      case "platforms":
        return (
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-gray-900 border-b border-gray-50 pb-1 flex items-center gap-1 dark:text-white">
                <HelpCircle size={13} className="text-gray-400" />{cn ? "平台状态" : "Platform Status"}
              </h4>
              <div className="space-y-1.5 pt-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "启用平台" : "Enabled"}:</span>
                  <span className="font-bold text-emerald-600">{p.enabledPlatforms.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{cn ? "研究模式" : "Mode"}:</span>
                  <span className="font-bold">{p.researchMode === "deep" ? (cn ? "深度" : "Deep") : (cn ? "快速" : "Quick")}</span>
                </div>
              </div>
              <div className="pt-2">
                <span className="text-[10px] text-gray-400 font-mono uppercase block mb-1">{cn ? "已启用" : "Enabled"}</span>
                <div className="flex flex-wrap gap-1">
                  {p.enabledPlatforms.map((pf, i) => (
                    <span key={i} className="bg-emerald-50 text-emerald-700 text-[9px] font-mono px-1.5 py-0.5 rounded border border-emerald-200">{pf}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-gray-900 border-b border-gray-50 pb-1 flex items-center gap-1 dark:text-white">
                <HelpCircle size={13} className="text-gray-400" />{cn ? "上下文助手" : "Context Helper"}
              </h4>
              <p className="text-gray-600 font-sans leading-relaxed pt-2 dark:text-gray-400">
                {cn ? "选择左侧导航进入对应工作区。" : "Select a nav item to enter the workspace."}
              </p>
            </div>
          </div>
        );
    }
  };

  const unreadReminders = reminders.filter(r => !r.dismissed);

  return (
    <div className={`min-h-screen bg-[#FDFCFB] text-[#1C1C1C] font-sans flex flex-col transition duration-300 ${settings.theme === "dark" ? "dark:bg-[#121211] dark:text-[#F5F3EF]" : ""}`}>

      {/* Global Header */}
      <header className="bg-white text-[#1C1C1C] px-8 py-4 border-b border-[#E5E2DE] flex items-center justify-between shrink-0 dark:bg-[#191816] dark:border-[#3E3A35]">
        <div className="flex items-center gap-3">
          <div className="bg-black p-2 text-white dark:bg-white dark:text-black">
            <Radio className="animate-pulse" size={16} />
          </div>
          <div>
            <h1 className="text-xl font-serif italic font-bold tracking-tight flex items-center gap-2 text-black dark:text-white">
              Aether
              {selectedProject && (
                <span className="hidden md:inline-flex bg-[#F9F8F6] text-[#1C1C1C] text-[9px] font-mono font-bold px-2 py-0.5 border border-[#E5E2DE] dark:bg-[#22201D] dark:text-[#F5F3EF] dark:border-[#3E3A35]">
                  {selectedProject.name}
                </span>
              )}
            </h1>
            <p className="text-[10px] text-[#8C8882] font-mono tracking-widest uppercase font-bold hidden sm:block">
              {cn ? "全网采配与九维商业研判工作台" : "Multi-Platform Research & Decision Workstation"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {projects.length > 0 && (
            <select
              className="bg-white hover:bg-[#F9F8F6] text-[#1C1C1C] text-xs font-semibold py-1.5 px-3 border border-[#E5E2DE] focus:outline-none font-sans cursor-pointer dark:bg-[#22201D] dark:text-white dark:border-[#3E3A35]"
              value={selectedProjectId}
              onChange={(e) => { handleSelectProject(e.target.value); setCurrentTab("overview"); }}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => setSettings(prev => ({ ...prev, language: prev.language === "zh" ? "en" : "zh" }))}
            className="bg-white hover:bg-[#F9F8F6] text-[#1C1C1C] p-1.5 border border-[#E5E2DE] font-mono text-xs font-bold w-12 text-center cursor-pointer transition dark:bg-[#22201D] dark:text-white dark:border-[#3E3A35]"
            title="Toggle language"
          >
            {cn ? "EN" : "中"}
          </button>

          {/* FTS5 Search */}
          <div className="relative">
            <div className="flex items-center gap-1 bg-[#F9F8F6] border border-[#E5E2DE] rounded px-2 py-1 dark:bg-[#22201D] dark:border-[#3E3A35]">
              <Search size={12} className="text-[#8C8882]" />
              <input
                type="text"
                className="bg-transparent text-xs w-32 md:w-48 focus:outline-none dark:text-gray-200"
                placeholder={cn ? "全文搜索证据..." : "Search documents..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    setSearching(true);
                    setShowSearch(true);
                    try {
                      const results = await invoke<[string, string, string][]>("search_documents", { query: searchQuery.trim() });
                      setSearchResults(results.map(([title, content, platform]) => ({ title, content, platform })));
                    } catch (_) { setSearchResults([]); }
                    setSearching(false);
                  }
                }}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setShowSearch(false); }} className="text-[#8C8882] hover:text-red-500"><XIcon size={10} /></button>
              )}
            </div>
            {showSearch && (
              <div className="absolute top-full right-0 mt-2 w-96 max-h-80 overflow-y-auto bg-white border border-[#E5E2DE] rounded-lg shadow-xl z-50 dark:bg-[#191816] dark:border-[#3E3A35]">
                <div className="p-3 border-b border-[#E5E2DE] flex items-center justify-between dark:border-[#3E3A35]">
                  <span className="text-[10px] font-bold text-gray-500 font-mono uppercase">
                    {searching ? (cn ? "搜索中..." : "Searching...") : `${searchResults.length} ${cn ? "条结果" : "results"}`}
                  </span>
                  <button onClick={() => setShowSearch(false)} className="text-gray-400 hover:text-red-500"><XIcon size={12} /></button>
                </div>
                {searchResults.length === 0 && !searching ? (
                  <div className="p-6 text-center text-xs text-gray-400">{cn ? "未找到匹配结果" : "No matching results"}</div>
                ) : (
                  searchResults.map((r, i) => (
                    <div key={i} className="p-3 border-b border-gray-50 hover:bg-slate-50 dark:border-[#3E3A35] dark:hover:bg-[#22201D]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] bg-slate-100 text-gray-500 font-mono px-1.5 py-0.5 rounded dark:bg-[#3E3A35]">{r.platform}</span>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 line-clamp-1">{r.title}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed dark:text-gray-400">{r.content}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* System Reminders indicator */}
          <button
            onClick={() => setIsRightDrawerCollapsed(false)}
            className="relative p-1.5 hover:bg-[#F9F8F6] transition cursor-pointer"
            title={cn ? "系统提醒" : "System Reminders"}
          >
            <Bell size={16} className="text-[#5C5852]" />
            {unreadReminders.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadReminders.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Navigation */}
        <nav className={`bg-[#F9F8F6] text-[#1C1C1C] border-r border-[#E5E2DE] flex flex-col justify-between transition-all duration-300 shrink-0 dark:bg-[#191816] dark:border-[#3E3A35] dark:text-[#F5F3EF] ${isSidebarCollapsed ? "w-16" : "w-60"}`}>
          <div className="space-y-1.5 py-4 px-3 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E5E2DE] px-1 text-[#8C8882] text-[10px] font-mono font-bold uppercase tracking-widest">
              <span>{!isSidebarCollapsed && (cn ? "工作流程" : "WORKFLOW")}</span>
              <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hover:text-black p-1 rounded transition cursor-pointer">
                {isSidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
              </button>
            </div>
            {[
              { id: "home", label: cn ? "研究新建" : "Home & Create", icon: Home },
              { id: "overview", label: cn ? "项目总览" : "Overview", icon: Layout, needsProject: true },
              { id: "modeling", label: cn ? "想法建模" : "Idea Modeling", icon: Layers, needsProject: true },
              { id: "platforms", label: cn ? "平台配置" : "Platforms", icon: Settings, needsProject: true },
              { id: "tasks", label: cn ? "搜索任务" : "Search Tasks", icon: Play, needsProject: true },
              { id: "competitors", label: cn ? "类别与竞品" : "Competitors", icon: Compass, needsProject: true },
              { id: "voices", label: cn ? "用户声音" : "User Voices", icon: MessageSquare, needsProject: true },
              { id: "evaluation", label: cn ? "评估结论" : "Assessment", icon: Sliders, needsProject: true },
              { id: "strategy", label: cn ? "策略建议" : "Strategy", icon: Compass, needsProject: true },
              { id: "validation", label: cn ? "验证行动" : "Validation", icon: CheckSquare, needsProject: true },
              { id: "compare", label: cn ? "对比项目" : "Compare", icon: ArrowLeftRight },
              { id: "export", label: cn ? "报告导出" : "Export", icon: ReportIcon, needsProject: true },
              { id: "versions", label: cn ? "版本历史" : "Versions", icon: History, needsProject: true, isSnapshot: true },
              { id: "settings", label: cn ? "设置中心" : "Settings", icon: Settings },
            ].map(menu => {
              const IconComp = menu.icon;
              const isActive = currentTab === menu.id;
              const disabled = menu.needsProject && !selectedProject;
              return (
                <button
                  key={menu.id}
                  onClick={() => {
                    if (disabled) return;
                    if ((menu as any).isSnapshot) {
                      handleOpenSnapshotManager(selectedProject!.id);
                    } else {
                      setCurrentTab(menu.id);
                    }
                  }}
                  className={`w-full text-left text-xs p-2.5 transition duration-150 flex items-center gap-3 relative cursor-pointer font-sans uppercase tracking-wider text-[11px] font-medium ${
                    disabled ? "opacity-30 cursor-not-allowed" : ""
                  } ${
                    isActive
                      ? "bg-[#1C1C1C] text-white font-bold dark:bg-white dark:text-black"
                      : "text-[#5C5852] hover:bg-[#E5E2DE] hover:text-[#1C1C1C] dark:text-[#8C8882] dark:hover:bg-[#22201D] dark:hover:text-white"
                  }`}
                  title={menu.label}
                >
                  <IconComp size={14} className="shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">{menu.label}</span>}
                  {isActive && !isSidebarCollapsed && (
                    <div className="absolute right-2 top-3.5 w-1.5 h-1.5 rounded-full bg-white dark:bg-black" />
                  )}
                </button>
              );
            })}
          </div>
          {!isSidebarCollapsed && (
            <div className="p-3 border-t border-[#E5E2DE] text-center text-[10px] text-[#8C8882] font-mono uppercase tracking-widest dark:border-[#3E3A35]">
              <div>Aether v0.1 — Tauri</div>
              <div>{cn ? "本地优先 · 自包含" : "Local-first · Self-contained"}</div>
            </div>
          )}
        </nav>

        {/* Main Workspace */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#FDFCFB] dark:bg-[#121211]">

          {connectionError && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <p className="text-amber-800 font-bold text-sm">{cn ? "连接提示" : "Connection Notice"}</p>
              <p className="text-amber-700 text-xs mt-2 font-mono">{connectionError}</p>
              <p className="text-amber-600 text-xs mt-2">
                {cn ? "请通过 Tauri 桌面应用启动，或运行 npm run tauri dev" : "Please launch via Tauri desktop app, or run npm run tauri dev"}
              </p>
            </div>
          )}

          {initialLoading && (
            <div className="flex items-center justify-center h-full py-32">
              <div className="space-y-4 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-black border-t-transparent rounded-full mx-auto" />
                <p className="text-xs text-[#8C8882] font-mono uppercase tracking-widest">
                  {cn ? "正在加载研究数据..." : "Loading research data..."}
                </p>
              </div>
            </div>
          )}

          {currentTab === "home" && (
            <HomeView
              projects={projects}
              onSelectProject={(id) => { handleSelectProject(id); setCurrentTab("overview"); }}
              onCreateProject={handleCreateProject}
              settings={settings}
              isCreating={isCreating}
              searchProgress={searchProgress}
              progressStage={progressStage}
              progressMessage={progressMessage}
              progressWarning={progressWarning}
              onOpenSnapshotManager={handleOpenSnapshotManager}
            />
          )}

          {currentTab === "overview" && selectedProject && (
            <OverviewView
              project={selectedProject}
              settings={settings}
              onNavigate={(tab) => setCurrentTab(tab)}
              onExport={() => setCurrentTab("export")}
              onReSearch={handleReSearch}
              isReSearching={isReSearching}
              reSearchProgress={searchProgress}
              reSearchStage={progressStage}
              reSearchMessage={progressMessage}
            />
          )}

          {currentTab === "modeling" && selectedProject && (
            <IdeaModelingView project={selectedProject} settings={settings} onUpdateProject={handleUpdateProject} />
          )}

          {currentTab === "platforms" && selectedProject && (
            <PlatformConfigView project={selectedProject} settings={settings} onUpdateProject={handleUpdateProject} />
          )}

          {currentTab === "tasks" && selectedProject && (
            <SearchTasksView
              projectId={selectedProject.id}
              searchTasks={selectedProject.searchTasks}
              settings={settings}
              onCancel={async () => { await invoke("cancel_analysis", { projectId: selectedProject.id }); }}
              onReminder={addReminder}
            />
          )}

          {currentTab === "competitors" && selectedProject && (
            <CompetitorView project={selectedProject} settings={settings} onUpdateProject={handleUpdateProject} />
          )}

          {currentTab === "voices" && selectedProject && (
            <UserVoiceView project={selectedProject} settings={settings} onUpdateProject={handleUpdateProject}
              onSelectVoice={(id) => { setActiveVoiceId(id); setIsRightDrawerCollapsed(false); }} />
          )}

          {currentTab === "evaluation" && selectedProject && (
            <EvaluationView project={selectedProject} settings={settings} onUpdateProject={handleUpdateProject}
              onReevaluate={handleReevaluate} isLoading={isLoading}
              onNavigateToTab={(tab) => setCurrentTab(tab)} />
          )}

          {currentTab === "strategy" && selectedProject && (
            <StrategyView project={selectedProject} settings={settings}
              onSwitchMode={(mode) => {
                // Adjust platform weights based on strategy mode
                let adjustedWeights = { ...selectedProject.platformWeights };
                switch (mode) {
                  case "conservative":
                    adjustedWeights.reddit = 1.5;
                    adjustedWeights.g2 = 1.3;
                    break;
                  case "aggressive":
                    adjustedWeights.google = 1.5;
                    adjustedWeights.productHunt = 1.3;
                    break;
                  case "low_cost_first":
                    adjustedWeights.reddit = 1.5;
                    adjustedWeights.xTwitter = 1.2;
                    break;
                  case "high_diff":
                    adjustedWeights.g2 = 1.5;
                    adjustedWeights.store = 1.5;
                    break;
                }
                const updated = { ...selectedProject, platformWeights: adjustedWeights };
                handleUpdateProject(updated);
                handleReevaluate(mode);
              }}
              isLoading={isLoading}
            />
          )}

          {currentTab === "validation" && selectedProject && (
            <ValidationView project={selectedProject} settings={settings} />
          )}

          {currentTab === "compare" && (
            <CompareView settings={settings} onSelectProject={(id) => { handleSelectProject(id); setCurrentTab("overview"); }} />
          )}

          {currentTab === "export" && selectedProject && (
            <div className="bg-white rounded-xl border border-gray-250 p-6 text-left shadow-sm space-y-6 animate-fade-in font-sans dark:bg-[#191816] dark:border-[#3E3A35]">
              <div className="space-y-2">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Download className="text-indigo-600" size={18} />
                  <h2 className="text-base font-bold text-gray-900 font-mono uppercase dark:text-white">{cn ? "导出研究报告" : "Export Research Report"}</h2>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed font-sans">{cn ? "导出格式：Markdown / HTML / JSON。包含建模、竞品、评估、策略和验证计划。" : "Export formats: Markdown / HTML / JSON. Includes modeling, competitors, evaluation, strategy, and validation plan."}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <div className="bg-slate-900 text-gray-200 rounded-lg p-5 font-mono text-xs h-[400px] overflow-y-auto border border-gray-800 leading-relaxed">
                    {reportLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
                      </div>
                    ) : reportContent ? (
                      <pre className="whitespace-pre-wrap">{reportContent}</pre>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        {cn ? "点击右侧按钮加载报告" : "Click a button to load report"}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-5 border border-indigo-100 bg-indigo-50/20 rounded-xl space-y-3 dark:border-indigo-800">
                    <h4 className="font-bold text-indigo-950 text-sm dark:text-indigo-200">{cn ? "一键导出" : "Export Actions"}</h4>
                    <button
                      onClick={async () => {
                        const md = await fetchReport("markdown");
                        if (md) {
                          navigator.clipboard.writeText(md);
                          addReminder("success", cn ? "已复制到剪贴板" : "Copied to clipboard");
                        }
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer">
                      <ClipboardCopy size={13} />{cn ? "加载并复制 Markdown" : "Load & Copy Markdown"}
                    </button>
                    <button
                      onClick={async () => {
                        const md = await fetchReport("markdown");
                        if (md) {
                          try {
                            const path = await save({
                              defaultPath: `${selectedProject!.id}-research.md`,
                              filters: [{ name: "Markdown", extensions: ["md"] }],
                            });
                            if (path) { await writeTextFile(path, md); addReminder("success", cn ? "Markdown 已保存" : "Markdown saved"); }
                          } catch (_) {
                            // Fallback: browser download
                            const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = `${selectedProject!.id}-research.md`;
                            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                          }
                        }
                      }}
                      className="w-full bg-white hover:bg-slate-50 border border-gray-250 text-gray-700 font-semibold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer dark:bg-[#22201D] dark:text-gray-200 dark:border-[#3E3A35]">
                      <Download size={13} />{cn ? "下载 .md 文件" : "Save .md file"}
                    </button>
                    <button
                      onClick={async () => {
                        const json = await fetchReport("json");
                        if (json) {
                          try {
                            const path = await save({
                              defaultPath: `${selectedProject!.id}-data.json`,
                              filters: [{ name: "JSON", extensions: ["json"] }],
                            });
                            if (path) { await writeTextFile(path, json); addReminder("success", cn ? "JSON 已保存" : "JSON saved"); }
                          } catch (_) {
                            const blob = new Blob([json], { type: "application/json;charset=utf-8" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = `${selectedProject!.id}-data.json`;
                            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                          }
                        }
                      }}
                      className="w-full bg-white hover:bg-slate-50 border border-gray-250 text-gray-700 font-semibold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer dark:bg-[#22201D] dark:text-gray-200 dark:border-[#3E3A35]">
                      <Download size={13} />{cn ? "下载 .json 数据" : "Save .json data"}
                    </button>
                    <button
                      onClick={async () => {
                        const html = await fetchReport("html");
                        if (html) {
                          try {
                            const path = await save({
                              defaultPath: `${selectedProject!.id}-report.html`,
                              filters: [{ name: "HTML", extensions: ["html"] }],
                            });
                            if (path) { await writeTextFile(path, html); addReminder("success", cn ? "HTML 已保存" : "HTML saved"); }
                          } catch (_) {
                            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = `${selectedProject!.id}-report.html`;
                            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                          }
                        }
                      }}
                      className="w-full bg-white hover:bg-slate-50 border border-gray-250 text-gray-700 font-semibold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer dark:bg-[#22201D] dark:text-gray-200 dark:border-[#3E3A35]">
                      <Download size={13} />{cn ? "下载 .html 报告" : "Save .html report"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Export history */}
              {exportHistory.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-bold text-gray-900 mb-3 dark:text-white">
                    {cn ? "最近导出记录" : "Recent Export History"}
                  </h3>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {exportHistory.map((rec) => (
                      <div key={rec.id} className="flex items-center justify-between text-xs bg-gray-50 p-2.5 rounded border border-gray-100 dark:bg-[#22201D] dark:border-[#3E3A35]">
                        <span className="font-mono text-gray-600 dark:text-gray-300">{rec.format.toUpperCase()}</span>
                        <span className="text-gray-400">{rec.generatedAt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentTab === "settings" && (
            <SettingView settings={settings} onUpdateSettings={setSettings} />
          )}
        </main>

        {/* Right Context Drawer */}
        <aside className={`border-l border-gray-200 bg-white transition-all duration-300 flex flex-col justify-between shrink-0 text-left dark:bg-[#191816] dark:border-[#3E3A35] ${isRightDrawerCollapsed ? "w-0 overflow-hidden border-l-0" : "w-80"}`}>
          <div className="p-5 space-y-5 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-150">
              <span className="text-xs font-bold font-mono text-gray-400 uppercase tracking-wide">{cn ? "上下文助手" : "Context Helper"}</span>
              <button onClick={() => setIsRightDrawerCollapsed(true)} className="hover:text-red-500 font-bold p-1 rounded font-mono text-gray-400 cursor-pointer">×</button>
            </div>

            {/* P2-6: Dynamic per-tab context content */}
            {renderContextContent()}

            {/* Reminders */}
            {unreadReminders.length > 0 && (
              <div className="pt-4 border-t border-gray-150 space-y-2">
                <h4 className="font-bold text-xs text-gray-500 font-mono uppercase">{cn ? "系统提醒" : "Reminders"}</h4>
                {unreadReminders.map(r => (
                  <div key={r.id} className={`p-2 rounded-lg text-[10px] border flex items-start justify-between ${
                    r.type === "error" ? "bg-red-50 border-red-200 text-red-800" :
                    r.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-800" :
                    "bg-emerald-50 border-emerald-200 text-emerald-800"
                  }`}>
                    <span className="flex-1">{r.message}</span>
                    <button onClick={() => dismissReminder(r.id)} className="shrink-0 ml-2 text-gray-400 hover:text-gray-600">×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Voice detail */}
            {currentTab === "voices" && activeVoiceId && selectedProject && (() => {
              const v = selectedProject.userVoices.find(x => x.id === activeVoiceId);
              if (!v) return null;
              return (
                <div className="pt-4 border-t border-gray-150 space-y-3.5 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-mono text-[9px] text-gray-400 uppercase block">{cn ? "原始证据快照" : "Voice Detail"}</span>
                    <h5 className="font-bold text-gray-900 dark:text-white">{v.title}</h5>
                  </div>
                  <p className="text-gray-600 bg-slate-50 p-3 rounded-lg border border-gray-200 leading-relaxed font-sans dark:bg-[#22201D] dark:text-gray-300 dark:border-[#3E3A35]">"{v.content}"</p>
                  <div className="text-[10px] text-gray-400 font-mono space-y-0.5">
                    <div>{cn ? "用户" : "User"}: @{v.userName}</div>
                    <div>{cn ? "来源" : "Source"}: {v.platform}</div>
                    <div>{cn ? "时间" : "Date"}: {v.timestamp}</div>
                    <div>{cn ? "情绪" : "Sentiment"}: {v.sentiment}</div>
                    <div>{cn ? "可信度" : "Strength"}: {v.strength}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {v.topics.map((t, i) => (
                      <span key={i} className="bg-slate-100 text-slate-700 text-[9px] font-mono px-1.5 py-0.5 rounded dark:bg-[#3E3A35] dark:text-gray-300">#{t}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="p-4 bg-slate-50 border-t border-gray-100 text-center text-[10px] text-gray-400 font-mono dark:bg-[#22201D] dark:border-[#3E3A35]">
            {cn ? "本面板随流程自适应" : "Adapts to current tab"}
          </div>
        </aside>

        {isRightDrawerCollapsed && (
          <button
            onClick={() => setIsRightDrawerCollapsed(false)}
            className="fixed right-4 bottom-4 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition cursor-pointer z-40"
            title={cn ? "打开上下文助手" : "Open context helper"}>
            <HelpCircle size={20} />
          </button>
        )}
      </div>
      {/* Snapshot Manager Modal */}
      {showSnapshotManager && snapshotManagerProjectId && (
        <SnapshotManager
          projectId={snapshotManagerProjectId}
          projectName={selectedProject?.name || ""}
          isOpen={showSnapshotManager}
          onClose={() => setShowSnapshotManager(false)}
          settings={settings}
          onRestoreComplete={handleRestoreFromSnapshot}
        />
      )}
    </div>
  );
}
