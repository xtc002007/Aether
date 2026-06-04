import React, { useState, useEffect } from "react";
import { ResearchProject, AppSettings, AppStats } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  FolderPlus, Plus, Calendar, CheckCircle2, AlertCircle, PlayCircle, Loader2,
  Layers, Database, BarChart3, Radio, FileText, ArrowRight, Sparkles, Trash2, History,
  Zap, Telescope, Activity, Server
} from "lucide-react";

interface HomeViewProps {
  projects: ResearchProject[];
  onSelectProject: (id: string) => void;
  onCreateProject: (formData: {
    statement: string;
    productForm: string;
    targetUser: string;
    scenario: string;
    researchMode: string;
  }) => void;
  settings: AppSettings;
  isCreating: boolean;
  searchProgress: number;
  progressStage?: string;
  progressMessage?: string;
  progressWarning?: string;
  onOpenSnapshotManager?: (projectId: string) => void;
}

export default function HomeView({
  projects, onSelectProject, onCreateProject, settings,
  isCreating, searchProgress,
  progressStage, progressMessage, progressWarning,
  onOpenSnapshotManager,
}: HomeViewProps) {
  const [statement, setStatement] = useState("");
  const [productForm, setProductForm] = useState("SaaS");
  const [targetUser, setTargetUser] = useState("");
  const [scenario, setScenario] = useState("");
  const [researchMode, setResearchMode] = useState("quick");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [snapshotCounts, setSnapshotCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<AppStats>({ totalProjects: 0, totalCompetitors: 0, totalRawDocuments: 0, recent7dProjects: 0 });

  // B5: Track running analysis tasks
  const [runningTasks, setRunningTasks] = useState<{
    platform: string; query: string; status: string; count: number; durationMs: number;
  }[]>([]);
  const [isAnyRunning, setIsAnyRunning] = useState(false);
  const [runningPlatforms, setRunningPlatforms] = useState<string[]>([]);

  const cn = settings.language === "zh";

  // B5: Listen to task-progress for real-time background task cards
  useEffect(() => {
    let unlisten1: (() => void) | undefined;
    let unlisten2: (() => void) | undefined;
    (async () => {
      unlisten1 = await listen<{ stage: string }>("analysis-progress", (event) => {
        if (event.payload.stage === "searching") setIsAnyRunning(true);
        if (event.payload.stage === "complete") {
          setIsAnyRunning(false);
          setRunningTasks([]);
          setRunningPlatforms([]);
        }
      });
      unlisten2 = await listen<{
        platform: string; query: string; status: string; count: number; durationMs: number;
      }>("task-progress", (event) => {
        const tp = event.payload;
        setIsAnyRunning(true);
        setRunningTasks(prev => {
          const existing = prev.findIndex(t => t.platform === tp.platform && t.query === tp.query);
          const newTask = { platform: tp.platform, query: tp.query, status: tp.status, count: tp.count, durationMs: tp.durationMs };
          if (existing >= 0) { const copy = [...prev]; copy[existing] = newTask; return copy; }
          return [...prev, newTask];
        });
        setRunningPlatforms(prev => prev.includes(tp.platform) ? prev : [...prev, tp.platform]);
      });
    })();
    return () => { unlisten1?.(); unlisten2?.(); };
  }, []);

  useEffect(() => {
    async function loadCounts() {
      try {
        const counts = await invoke<[string, number][]>("get_snapshot_counts");
        const map: Record<string, number> = {};
        for (const [pid, count] of counts) {
          map[pid] = count;
        }
        setSnapshotCounts(map);
      } catch (_) {}
      try {
        const s = await invoke<AppStats>("get_stats");
        setStats(s);
      } catch (_) {}
    }
    loadCounts();
  }, [projects.length]);

  const handleDeleteProject = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(cn ? `确定要删除项目「${name}」吗？此操作不可恢复。` : `Delete project "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await invoke("delete_project", { projectId: id });
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const templates = [
    {
      id: "saas",
      name: cn ? "B2B SaaS 效率工具" : "B2B SaaS Utility",
      desc: cn ? "适合探索细分定位与大厂差评差值的效率软件" : "Explore niche positioning vs enterprise bloats",
      form: "SaaS",
      idea: cn ? "专注于敏捷团队的多平台日程同步，支持一键脱水归档，绝无广告干扰" : "Synchronized cross-platform agile team scheduling, offline-first files"
    },
    {
      id: "app",
      name: cn ? "消费类移动 App" : "Consumer Mobile App",
      desc: cn ? "高度测试应用商店评分分布、痛点崩溃率与买断制意向" : "Track app store rating bugs and buyout micro-payment interest",
      form: "Mobile App",
      idea: cn ? "为跑步发烧友打造的手戴单击记录卡，支持物理手表旋钮，离线运行" : "Single-tap smartwatch record logger for high frequency jogging, 100% local database"
    },
    {
      id: "plugin",
      name: cn ? "浏览器 / 开源挂载插件" : "Chrome / IDE / Git Extension",
      desc: cn ? "评估开发者、办公一族的特定单点使用痛点与拦截率" : "Evaluate browser freelancers' micro point pain points and conversion",
      form: "Browser Extension",
      idea: cn ? "一键拦截网页牛皮癣广告以及社交媒体弹窗、静默过滤干扰，极其轻便" : "Block webpage trackers and distracting social notifications via local rules"
    }
  ];

  const handleApplyTemplate = (tpl: typeof templates[0]) => {
    setSelectedTemplate(tpl.id);
    setStatement(tpl.idea);
    setProductForm(tpl.form);
    setTargetUser(cn ? "高频重度使用的特定垂直群体" : "Power vertical user cohort");
    setScenario(cn ? "日常工作中频繁被该痛点打断的核心情况" : "Routine daily workspace triggers");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statement.trim()) return;
    onCreateProject({
      statement,
      productForm,
      targetUser,
      scenario,
      researchMode
    });
  };

  return (
    <div className="space-y-8 animate-fade-in p-2 text-[#1C1C1C]">
      {/* Visual Identity Hero */}
      <div className="bg-[#F9F8F6] p-8 text-[#1C1C1C] border border-[#E5E2DE] relative overflow-hidden">
        <div className="relative z-10 max-w-db space-y-4">
          <div className="inline-flex items-center gap-2 border border-[#1C1C1C]/20 text-[#5C5852] px-3 py-1 bg-white text-[10px] uppercase tracking-widest font-mono font-bold">
            <Radio size={10} className="animate-pulse text-[#1C1C1C]" />
            {cn ? "AI STUDIO 系统第 1 版" : "AI STUDIO ENGINE V1"}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif italic tracking-tight font-bold text-[#1C1C1C] leading-tight">
            {cn ? "全网产品想法调研与决策系统" : "Product Idea Research & Decision Workstation"}
          </h1>
          <p className="text-[#5C5852] text-sm md:text-base leading-relaxed font-sans">
            {cn 
              ? "在投入开发前，对新构想进行全网多渠道证据回收：自动化抓取 Reddit、Google Search、G2评价和应用商店原始声音；扫描竞品、聚类高频不满意度主题，输出 9 维评估报告并自动设计落地页行动计划。"
              : "Run deep multi-platform excavations before writing code: aggregate Reddit posts, SEO positions, G2 negatives, and play store stars; map competitor pricing, cluster pain points, and output 9-dimensional strategic actions."}
          </p>
        </div>

        {/* 4 Pillars Metrics from DB */}
        <div className="grid grid-cols-4 gap-6 mt-8 pt-8 border-t border-[#E5E2DE] text-left">
          <div className="space-y-1">
            <div className="text-[#8C8882] text-[10px] font-mono uppercase tracking-widest font-bold">{cn ? "调研项目总数" : "Total Projects"}</div>
            <div className="text-2xl md:text-3xl font-serif italic font-bold text-[#1C1C1C]">{stats.totalProjects}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[#8C8882] text-[10px] font-mono uppercase tracking-widest font-bold">{cn ? "已扫描竞争对手" : "Agg. Competitors"}</div>
            <div className="text-2xl md:text-3xl font-serif italic font-bold text-[#1C1C1C]">{stats.totalCompetitors}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[#8C8882] text-[10px] font-mono uppercase tracking-widest font-bold">{cn ? "原始证据总数" : "Raw Documents"}</div>
            <div className="text-2xl md:text-3xl font-serif italic font-bold text-[#1C1C1C]">{stats.totalRawDocuments}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[#8C8882] text-[10px] font-mono uppercase tracking-widest font-bold">{cn ? "最近 7 天新增" : "Recent 7 Days"}</div>
            <div className="text-2xl md:text-3xl font-serif italic font-bold text-[#1C1C1C]">{stats.recent7dProjects}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Quick Launch System */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-[#E5E2DE] p-6 lg:p-8">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-[#E5E2DE]">
              <FolderPlus className="text-[#1C1C1C]" size={18} />
              <h2 className="text-lg font-serif italic font-bold text-[#1C1C1C]">
                {cn ? "配置项目与触发多平台扫描" : "Configure & Initiate Parallel Scan"}
              </h2>
            </div>

            {isCreating ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative w-20 h-20">
                  <Loader2 className="animate-spin text-black w-full h-full" />
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold text-[#1C1C1C]">
                    {searchProgress}%
                  </div>
                </div>
                <div className="space-y-3 max-w-md w-full">
                  <h3 className="font-serif italic font-bold text-gray-900 text-lg">
                    {cn ? "多平台搜索引擎调度中..." : "Scouting Multiple Platforms..."}
                  </h3>
                  <div className="w-full bg-[#F9F8F6] border border-[#E5E2DE] h-2 overflow-hidden">
                    <div 
                      className="bg-black h-full transition-all duration-300" 
                      style={{ width: `${searchProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#5C5852] font-mono uppercase tracking-wider">
                    {progressStage || (cn ? "正在处理..." : "Processing...")}
                  </p>
                  {progressWarning && (
                    <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-300 rounded p-3 mt-2 font-sans leading-relaxed whitespace-pre-line">
                      {progressWarning}
                    </p>
                  )}
                  {progressMessage && (
                    <p className="text-[10px] text-[#8C8882] font-sans mt-1">
                      {progressMessage}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[#1C1C1C] font-mono uppercase tracking-widest block">
                    {cn ? "核心产品想法 (必填)" : "Core Product Idea / Statement (Required)"}
                  </label>
                  <textarea
                    rows={3}
                    className="w-full border border-[#E5E2DE] p-3 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black font-sans bg-white transition-all text-[#1C1C1C]"
                    placeholder={cn ? "例如：一款基于大模型的自动化合并代码自动评审工具，专门指出重度漏洞，摒弃无关唠叨..." : "e.g., A lightweight automated scheduler with single-click logging and auto AI tagging list..."}
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#1C1C1C] font-mono uppercase tracking-widest block">
                      {cn ? "拟定产品形态" : "Proposed Product Form"}
                    </label>
                    <select
                      className="w-full border border-[#E5E2DE] p-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black focus:border-black font-sans cursor-pointer"
                      value={productForm}
                      onChange={(e) => setProductForm(e.target.value)}
                    >
                      <option value="SaaS">B2B SaaS / Web App</option>
                      <option value="Mobile App">{cn ? "移动客户端 (Mobile App)" : "Mobile App"}</option>
                      <option value="Browser Extension">{cn ? "浏览器/插件 (Extension)" : "Browser Extension"}</option>
                      <option value="AI Agent">AI Agent / CI Plugin</option>
                      <option value="Hardware">{cn ? "软硬一体化设备" : "Hardware + Software Bundle"}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#1C1C1C] font-mono uppercase tracking-widest block">
                      {cn ? "目标用户群描述 (可选)" : "Target Audience Descriptor (Optional)"}
                    </label>
                    <input
                      type="text"
                      className="w-full border border-[#E5E2DE] p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder={cn ? "例如：独立开发者、中小合伙团队、远程设计师" : "e.g., Freelancers, solo developers, PMs"}
                      value={targetUser}
                      onChange={(e) => setTargetUser(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[#1C1C1C] font-mono uppercase tracking-widest block">
                    {cn ? "主力触发使用场景 (可选)" : "Primary Target Scene (Optional)"}
                  </label>
                  <input
                    type="text"
                    className="w-full border border-[#E5E2DE] p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                    placeholder={cn ? "例如：研发在合并 GitHub Pull Request 时，静默触发并以代码批注回显" : "e.g., Capturing gym negative lifts during 3-minute resting loops"}
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                  />
                </div>

                {/* Templates Shelf */}
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-bold text-[#5C5852] font-mono tracking-widest uppercase block">
                    {cn ? "快速调入预设配置模板：" : "Apply sample layout configuration templates:"}
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {templates.map((tpl) => (
                      <button
                        type="button"
                        key={tpl.id}
                        onClick={() => handleApplyTemplate(tpl)}
                        className={`text-left p-4 border text-xs transition-all duration-200 cursor-pointer ${
                          selectedTemplate === tpl.id 
                            ? "border-black bg-black text-white" 
                            : "border-[#E5E2DE] hover:border-black bg-white text-[#1C1C1C]"
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1 font-sans uppercase tracking-wider text-[11px]">
                          <Plus size={11} className={selectedTemplate === tpl.id ? "text-white" : "text-black"} />
                          {tpl.name}
                        </div>
                        <div className={`mt-2 line-clamp-2 ${selectedTemplate === tpl.id ? "text-gray-300" : "text-[#5C5852]"}`}>{tpl.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Research Mode Selector */}
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-bold text-[#5C5852] font-mono tracking-widest uppercase block">
                    {cn ? "研究深度模式" : "Research Depth Mode"}
                  </span>
                  <div className="flex gap-3">
                    <label className={`flex items-center gap-2 p-3 border cursor-pointer transition flex-1 ${
                      researchMode === "quick" ? "border-black bg-black text-white" : "border-[#E5E2DE] bg-white text-[#1C1C1C] hover:border-black"
                    }`}>
                      <input type="radio" name="researchMode" value="quick" checked={researchMode === "quick"}
                        onChange={() => setResearchMode("quick")} className="sr-only" />
                      <Zap size={14} />
                      <div>
                        <div className="font-bold text-xs">{cn ? "快速模式" : "Quick"}</div>
                        <div className="text-[10px] opacity-70">{cn ? "核心平台，单轮搜索" : "Core platforms, single-round"}</div>
                      </div>
                    </label>
                    <label className={`flex items-center gap-2 p-3 border cursor-pointer transition flex-1 ${
                      researchMode === "deep" ? "border-black bg-black text-white" : "border-[#E5E2DE] bg-white text-[#1C1C1C] hover:border-black"
                    }`}>
                      <input type="radio" name="researchMode" value="deep" checked={researchMode === "deep"}
                        onChange={() => setResearchMode("deep")} className="sr-only" />
                      <Telescope size={14} />
                      <div>
                        <div className="font-bold text-xs">{cn ? "深度模式" : "Deep"}</div>
                        <div className="text-[10px] opacity-70">{cn ? "两轮搜索 + 社区词汇精化" : "Two-round + vocab refinement"}</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E5E2DE] flex justify-end">
                  <button
                    type="submit"
                    className="bg-[#1C1C1C] hover:bg-black text-white font-bold text-[10px] uppercase tracking-widest py-3 px-6 transition duration-200 flex items-center gap-2 cursor-pointer border border-[#1C1C1C]"
                  >
                    <Radio size={14} />
                    {cn ? "开启全网并联分析" : "Launch Parallel Multi-Engine Scans"}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Background Tasks + Historical Projects */}
        <div className="space-y-6">
          {/* B5: Background Running Task Cards */}
          {isAnyRunning && (
            <div className="bg-amber-50/80 border border-amber-300 p-5 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 pb-3 border-b border-amber-200">
                <Activity size={16} className="text-amber-700 animate-pulse" />
                <h2 className="text-sm font-serif italic font-bold text-amber-900">
                  {cn ? "后台采集运行中" : "Background Collection Running"}
                </h2>
                <span className="text-[10px] text-amber-600 font-mono ml-auto">
                  {runningPlatforms.length} {cn ? "个平台" : "platforms"} · {runningTasks.length} {cn ? "个任务" : "tasks"}
                </span>
              </div>
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                {runningPlatforms.map(platform => {
                  const pts = runningTasks.filter(t => t.platform === platform);
                  const done = pts.filter(t => t.status === "success" || t.status === "empty").length;
                  const total = pts.length;
                  const totalResults = pts.reduce((s, t) => s + t.count, 0);
                  return (
                    <div key={platform} className="flex items-center justify-between p-2 bg-white rounded border border-amber-200 text-xs">
                      <div className="flex items-center gap-2">
                        <Server size={12} className="text-amber-600" />
                        <span className="font-mono font-bold text-gray-800">{platform}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
                        <span>{done}/{total} {cn ? "完成" : "done"}</span>
                        <span className="font-bold text-emerald-600">{totalResults} {cn ? "结果" : "results"}</span>
                        <div className="w-16 bg-gray-100 h-1 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white border border-[#E5E2DE] p-6">
            <div className="flex items-center gap-2 pb-4 mb-4 border-b border-[#E5E2DE]">
              <Layers className="text-[#1C1C1C]" size={16} />
              <h2 className="text-lg font-serif italic font-bold text-[#1C1C1C]">
                {cn ? "最近研究的项目库" : "Recent Research Projects"}
              </h2>
            </div>

            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {projects.length === 0 ? (
                <div className="text-center py-8 text-[#8C8882] text-xs italic">
                  {cn ? "无可用的项目。请在左侧发起首次调研。" : "No research projects found. Create one to begin."}
                </div>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    className="p-4 border border-[#E5E2DE] hover:border-black bg-white transition cursor-pointer flex flex-col gap-2 group relative text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-[#1C1C1C] text-sm line-clamp-1 group-hover:italic transition">
                        {project.name || project.ideaModel.statement}
                      </h3>
                      <div className="shrink-0 flex items-center">
                        {project.status === "completed" && (
                          <span className="inline-flex items-center gap-1 bg-black text-white border border-black px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider">
                            <CheckCircle2 size={8} />
                            {cn ? "已完毕" : "DONE"}
                          </span>
                        )}
                        {project.status === "new" && (
                          <span className="inline-flex items-center gap-1 bg-[#F9F8F6] text-[#5C5852] border border-[#E5E2DE] px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider">
                            <PlayCircle size={8} />
                            {cn ? "未运行" : "IDLE"}
                          </span>
                        )}
                        {(project.status === "searching" || project.status === "modeling") && (
                          <span className="inline-flex items-center gap-1 border border-black text-[#1C1C1C] px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider animate-pulse">
                            <Loader2 size={8} className="animate-spin" />
                            {cn ? "读取中" : "RUN"}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-[#5C5852] line-clamp-2 leading-relaxed">
                      {project.ideaModel.statement}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-[#8C8882] pt-2 border-t border-gray-100 font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {project.createdAt}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">
                          {project.competitors.length} {cn ? "个竞品" : "Comps"} · {project.userVoices.length} {cn ? "条反响" : "Voices"}
                          {(snapshotCounts[project.id] ?? 0) > 0 && (
                            <> · <span className="text-indigo-600">{snapshotCounts[project.id]} {cn ? "版本" : "vers"}</span></>
                          )}
                        </span>
                        {onOpenSnapshotManager && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenSnapshotManager(project.id); }}
                            className="text-indigo-500 hover:text-indigo-700 p-1 rounded transition cursor-pointer"
                            title={cn ? "版本历史" : "Version history"}
                          >
                            <History size={10} />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeleteProject(project.id, project.name || project.ideaModel.statement, e)}
                          className="text-gray-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                          title={cn ? "删除项目" : "Delete project"}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Informational Tips Card */}
          <div className="bg-[#F9F8F6] border border-[#E5E2DE] p-6 text-left space-y-3">
            <h4 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-widest font-mono flex items-center gap-2">
              <Sparkles size={14} className="text-black" />
              {cn ? "为什么要调研之后做决策？" : "Why Research Inputs First?"}
            </h4>
            <p className="text-xs text-[#5C5852] leading-relaxed">
              {cn
                ? "独立的软件工程师与决策团队最大的风险在『闭门造车』，用半年写出一个根本没人要或者大厂功能早已涵盖、体验完爆的伪需求。本工具帮您在写下第一行代码前，理智地用来自 Reddit、App Store 的高饱和度负面吐槽作为设计突破口，进行降维拦截式定位。"
                : "The primary risk for solo developers is over-engineering a pseudo-demand. Finding dense poor G2/Reddit complaints serves as the most strategic product layout weapon to intercept premium incumbents."}
            </p>
          </div>

          {/* System Reminders */}
          <div className="bg-white border border-[#E5E2DE] p-6 space-y-3">
            <h4 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-widest font-mono flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-500" />
              {cn ? "系统状态与提醒" : "System Status & Reminders"}
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded p-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span>{cn ? "首次使用建议在「设置中心」检查各平台配置" : "First-time users: check platform configs in Settings"}</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{cn ? "数据库正常运行 (SQLite WAL 模式)" : "Database operational (SQLite WAL mode)"}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 bg-gray-50 border border-gray-200 rounded p-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                <span>{cn ? "支持 8 类数据源，默认启用 4 个核心平台" : "8 data source types, 4 core platforms enabled by default"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
