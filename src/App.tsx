import React, { useState, useEffect } from "react";
import { ResearchProject, AppSettings } from "./types";
import { MOCK_PROJECTS, DEFAULT_SETTINGS } from "./mockData";

// Components Imports
import HomeView from "./components/HomeView";
import CompetitorView from "./components/CompetitorView";
import UserVoiceView from "./components/UserVoiceView";
import EvaluationView from "./components/EvaluationView";
import StrategyView from "./components/StrategyView";
import ValidationView from "./components/ValidationView";
import SettingView from "./components/SettingView";
import PlatformConfigView from "./components/PlatformConfigView";

// Lucide Icons
import { 
  Home, Layers, Settings, FileText, Layout, 
  ChevronLeft, ChevronRight, HelpCircle, ArrowLeftRight, 
  Download, Globe, Zap, AlertTriangle, Compass, CheckSquare, 
  MessageSquare, Sliders, Play, Radio, RefreshCw, FileText as ReportIcon,
  LogOut, ClipboardCopy, Badge
} from "lucide-react";

export default function App() {
  const [projects, setProjects] = useState<ResearchProject[]>(MOCK_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("p-ai-code-reviewer");
  const [currentTab, setCurrentTab] = useState<string>("home");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  // Wizards & loading triggers
  const [isCreating, setIsCreating] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Layout Folders toggles
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRightDrawerCollapsed, setIsRightDrawerCollapsed] = useState(false);

  // Selection Detail slots
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);

  const cn = settings.language === "zh";

  // Get active selected project
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null;

  // Sync title with active project name
  useEffect(() => {
    if (selectedProject) {
      document.title = cn 
        ? `【工作台】${selectedProject.name} - 产品想法验证系统` 
        : `[Workstation] ${selectedProject.name} - IdeaVerify`;
    } else {
      document.title = cn ? "产品想法验证与智能决策系统" : "Product Idea Research & Decision System";
    }
  }, [selectedProjectId, settings.language, projects]);

  // Create Project Callback
  const handleCreateProject = async (formData: {
    statement: string;
    productForm: string;
    targetUser: string;
    scenario: string;
  }) => {
    setIsCreating(true);
    setSearchProgress(5);
    setCurrentTab("home");

    // Progress counter simulation that syncs with actual API speed
    const prgInterval = setInterval(() => {
      setSearchProgress(prev => {
        if (prev >= 95) {
          clearInterval(prgInterval);
          return 95;
        }
        return prev + Math.floor(Math.random() * 8) + 1;
      });
    }, 450);

    try {
      const response = await fetch("/api/analyze-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement: formData.statement,
          productForm: formData.productForm,
          targetUser: formData.targetUser,
          scenario: formData.scenario,
          language: settings.language
        })
      });

      const data = await response.json();
      
      clearInterval(prgInterval);
      setSearchProgress(100);

      const parsedProject: ResearchProject = {
        id: "proj-" + Date.now(),
        name: cn ? `想法：${formData.statement.slice(0, 10)}...` : `Idea: ${formData.statement.slice(0, 12)}...`,
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: "completed",
        ideaModel: data.ideaModel,
        searchTasks: data.searchTasks || [],
        competitors: data.competitors || [],
        userVoices: data.userVoices || [],
        evaluation: data.evaluation,
        strategy: data.strategy,
        validationPlan: data.validationPlan || [],
        platformWeights: {
          reddit: 1.0,
          google: 1.0,
          g2: 1.0,
          store: 1.0
        },
        enabledPlatforms: ["Reddit", "Google Search", "G2 / Capterra", "App Store"]
      };

      setProjects(prev => [parsedProject, ...prev]);
      setSelectedProjectId(parsedProject.id);
      setTimeout(() => {
        setIsCreating(false);
        setCurrentTab("overview");
      }, 500);

    } catch (err) {
      console.error("Analysis trigger error:", err);
      // fallback handled gracefully by server. Use simulation
      clearInterval(prgInterval);
      setIsCreating(false);
    }
  };

  // Re-evaluation weights and sliders trigger
  const handleReevaluate = async () => {
    if (!selectedProject) return;
    setIsLoading(true);

    try {
      const resp = await fetch("/api/re-evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectData: selectedProject,
          activePlatformIds: selectedProject.enabledPlatforms,
          platformWeights: selectedProject.platformWeights,
          language: settings.language
        })
      });

      const updatedVal = await resp.json();

      setProjects(prev => prev.map(p => {
        if (p.id === selectedProject.id) {
          return {
            ...p,
            evaluation: {
              ...p.evaluation,
              ...updatedVal.evaluation
            },
            strategy: {
              ...p.strategy,
              ...updatedVal.strategy
            }
          };
        }
        return p;
      }));

      alert(cn ? "重量分配重算成功！九维价值与最佳路径已刷新校准。" : "Re-evaluation values calibrated successfully across dimensions.");
    } catch (err) {
      console.error("Re-evaluation trigger crashed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProject = (updated: ResearchProject) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  // Export files generation strings compiling
  const compiledMarkdownFile = selectedProject ? `# ${selectedProject.name} 产品想法 intelligence 汇报书
- **撰写时间**: ${selectedProject.createdAt}
- **项目定位**: ${selectedProject.strategy.positioningStatement}

## 一、想法建模大纲
- **构想一句话陈述**: ${selectedProject.ideaModel.statement}
- **目标核心群体**: ${selectedProject.ideaModel.targetUser}
- **主要Job-To-Be-Done**: ${selectedProject.ideaModel.coreJob}

## 二、同业竞争研究 (共 ${selectedProject.competitors.length} 个)
${selectedProject.competitors.map(c => `### 竞品: ${c.name}
- 定位: ${c.positioning}
- 定价: ${c.pricing}
- 不满度痛点: ${c.cons}
- 差异机遇点: ${c.opportunity}`).join("\n\n")}

## 三、九维商业价值评定
- 推荐总建议: ${selectedProject.evaluation.overallRecommendation}
- 置信可信度得分: ${selectedProject.evaluation.confidenceScore}%

### 个体刻度
${selectedProject.evaluation.dimensions.map(d => `- **${d.name}**: ${d.score}/10 — 理由: ${d.reason}`).join("\n")}

## 四、下一步低成本 MVP 验证指南
${selectedProject.validationPlan.map(v => `### 阶梯: ${v.category} (${v.duration})
- 测试指标: ${v.target}
- 落地行动: ${v.action}
- 文案资产大纲:\n${v.details}`).join("\n\n")}
` : "";

  // Right Contextual Drawer Dynamic helper data
  const getContextHelpAndReminders = () => {
    switch (currentTab) {
      case "home":
        return {
          title: cn ? "研究前置舱 (Welcome)" : "Home Instructions",
          tip: cn 
            ? "选择底下的模板、或在文本框输入您的想法直接启动。系统会自动开启 Reddit 和 Google API 组，爬取差评和 SEO 回流定位。" 
            : "Use the predefined template block or type any raw description to trigger semantic search tasks.",
          warnings: cn ? "※ 本系统内置 Gemini 深度挖掘，请避免输入公司绝对私密代码。" : "Avoid posting strict NDA sensitive keywords."
        };
      case "overview":
        return {
          title: cn ? "仪表盘驾驶舱 (Dashboard)" : "Dashboard Telemetry",
          tip: cn 
            ? "这一页是该分析项目的总体汇报结论摘要。查看左侧大标题推荐（置信度高说明该定位有强数据证据链支撑）。" 
            : "Audit findings summary page. Pay attention to confidence score which guarantees high citation consistencies.",
          warnings: cn ? "※ 推荐切入路径能极好地帮助您的首版设计绕开大厂盲点。" : "Suggested lancut avoids incumbents core moats."
        };
      case "modeling":
        return {
          title: cn ? "想法结构建模 (Structural Modeling)" : "Idea Specification",
          tip: cn 
            ? "大模型将您含糊的一句话拆解为用户、场景、核心任务、以及搜索关键词。您可以把觉得有偏差的干扰词在右边排除。" 
            : "Deconstructs sentences to core JTBD fields. Exclude misaligned keywords in the right column.",
          warnings: cn ? "※ 高保真的精准关键词有助于后继自定义补充搜索时精度更准。" : "Accurate keyword arrays produce superior custom query outputs."
        };
      case "platforms":
        return {
          title: cn ? "爬虫分发配置 (Crawl Toggles)" : "Crawler Parameters",
          tip: cn 
            ? "在这里允许您为该项目独立增加或关闭采集源（如给移动 APP 强制打开 Apple App Store 评论采集）。" 
            : "Configure custom crawlers date scopes or manually toggle specific stores for mobile app configurations.",
          warnings: cn ? "※ 并发线程拉大可能会造成被目标站点临时拦截，建议使用 4-8 并发。" : "High concurrent threads trigger temporary proxy backoffs."
        };
      case "tasks":
        return {
          title: cn ? "搜寻实时任务日志 (Task Monitor)" : "Active Threads logs",
          tip: cn 
            ? "显示并行的搜索引擎模拟接口状态。如果遇到失败，可以查看解析日志并重试。" 
            : "Visualizes automated parallel crawling logs. In case of issues, review backtrack reasons.",
          warnings: cn ? "※ 检索失败通常由于该垂直词太宽泛或遭遇严格解析限流。" : "Failures commonly represent overly broad queries."
        };
      case "competitors":
        return {
          title: cn ? "同业竞争卡片矩阵 (Competitor Map)" : "Incumbents Repository",
          tip: cn 
            ? "分门别类地对比竞品。选择一项核心竞争卡片，右侧直接对比他们的 Pros/Cons 优劣和我们的针对性超车路线。" 
            : "Categorize competing products. Explore direct opportunities to intercept bloated layouts in the right shelf.",
          warnings: cn ? "※ 自有数据库快照在清空缓存时仍会保留各项目的卡片资产。" : "Storage directories persist custom added competitor files."
        };
      case "voices":
        return {
          title: cn ? "全网求助与痛点怨气流 (Friction Mining)" : "Frictions & Comments",
          tip: cn 
            ? "这是整个决策工作台最本命的『事实来源』。所有的主题不满意度（聚类）都是从差评原文里分析归结的。" 
            : "Crucial fact repository. Frictions are parsed dynamically from direct App Store poor reviews.",
          warnings: cn ? "※ 双击任一条原始吐槽，将直接调入右侧详情抽屉查看链接。" : "Double check target comment details for original citations."
        };
      case "evaluation":
        return {
          title: cn ? "九维资产分析盘 (Value Assessment)" : "9-Dimensional Value",
          tip: cn 
            ? "评估新产品到底值不值得做。您可以拖拽其滑块来修正您的初始预期，并点击『重新加权算战略』获得最新的方案重组。" 
            : "Manual sliders calibrator. Tweaking ranks will reorganize Strategy outputs on the next tab.",
          warnings: cn ? "※ 极高痛点和 极易验证 是独立创造者初期最重要的两个黄金阀值。" : "High pain severity & easy MVP are solo founders golden indexes."
        };
      case "strategy":
        return {
          title: cn ? "切入重叠定位战略 (Positioning)" : "Strategy & Positioning",
          tip: cn 
            ? "系统自动输出您的差异化定位名片。强烈建议研发初期对照并严格执行其【Must-Have】与【Avoid】研发边界。" 
            : "Must have features skeleton specs. Check scope-creeping against prohibited feature listings.",
          warnings: cn ? "※ 大厂都在高举功能全。您的核心杀伤力纯粹来自于『轻量只解决一个刚需、秒开』。" : "Incumbents compete on features. You compete strictly on simplicity & speed."
        };
      case "validation":
        return {
          title: cn ? "轻量级假设行动书 (Action Plan)" : "Action Blueprints",
          tip: cn 
            ? "点击具体的卡片可以复制已经为您生成好的：5条调研话术指南、静默LandingPage落地页文案蓝图、或定投广告词。" 
            : "Check tasks to complete the test phase. Ready-made texts are optimized for instant copy-pasting.",
          warnings: cn ? "※ 用户访谈的第一条红线是不可以引诱发问，请依照大纲诚恳沟通。" : "Direct leading questions ruin semantic telemetry integrity."
        };
      default:
        return {
          title: cn ? "上下文助手 (Telemetry Center)" : "Contextual Telemetry",
          tip: cn ? "正在深入浏览产品情报和多维决策模块。右侧将根据您的激活栏自适应引导辅助。" : "Select any active item to load full supporting facts and checklists.",
          warnings: ""
        };
    }
  };

  const activeHelp = getContextHelpAndReminders();

  return (
    <div className={`min-h-screen bg-[#FDFCFB] text-[#1C1C1C] font-sans flex flex-col transition duration-300 ${settings.theme === "dark" ? "dark:bg-[#121211] dark:text-[#F5F3EF]" : ""}`}>
      
      {/* Upper Global Navigation shell Header */}
      <header className="bg-white text-[#1C1C1C] px-8 py-4 border-b border-[#E5E2DE] flex items-center justify-between shrink-0 dark:bg-[#191816] dark:border-[#3E3A35]">
        <div className="flex items-center gap-3">
          <div className="bg-black p-2 text-white dark:bg-white dark:text-black">
            <Radio className="animate-pulse" size={16} />
          </div>
          <div>
            <h1 className="text-xl font-serif italic font-bold tracking-tight flex items-center gap-2 text-black dark:text-white">
              Aether.
              {selectedProject && (
                <span className="hidden md:inline-flex bg-[#F9F8F6] text-[#1C1C1C] text-[9px] font-mono font-bold px-2 py-0.5 border border-[#E5E2DE] dark:bg-[#22201D] dark:text-[#F5F3EF] dark:border-[#3E3A35]">
                  {selectedProject.name}
                </span>
              )}
            </h1>
            <p className="text-[10px] text-[#8C8882] font-mono tracking-widest uppercase font-bold hidden sm:block">
              {cn ? "全网采配与九维商业研判工作台" : "Multi-Platform Audit & Assessment Workstation"}
            </p>
          </div>
        </div>

        {/* Project Selector & Language switcher */}
        <div className="flex items-center gap-3">
          <select
            className="bg-white hover:bg-[#F9F8F6] text-[#1C1C1C] text-xs font-semibold py-1.5 px-3 border border-[#E5E2DE] focus:outline-none font-sans cursor-pointer dark:bg-[#22201D] dark:text-white dark:border-[#3E3A35]"
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setCurrentTab("overview");
            }}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                📁 {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setSettings(prev => ({
                ...prev,
                language: prev.language === "zh" ? "en" : "zh"
              }));
            }}
            className="bg-white hover:bg-[#F9F8F6] text-[#1C1C1C] p-1.5 border border-[#E5E2DE] font-mono text-xs font-bold w-12 text-center cursor-pointer transition dark:bg-[#22201D] dark:text-white dark:border-[#3E3A35]"
            title="Toggle display language"
          >
            {cn ? "EN" : "中"}
          </button>
        </div>
      </header>

      {/* Main Container Layout: Three tier interface mapping */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Drawer Navigator Sidebar */}
        <nav className={`bg-[#F9F8F6] text-[#1C1C1C] border-r border-[#E5E2DE] flex flex-col justify-between transition-all duration-300 shrink-0 dark:bg-[#191816] dark:border-[#3E3A35] dark:text-[#F5F3EF] ${
          isSidebarCollapsed ? "w-16" : "w-60"
        }`}>
          <div className="space-y-1.5 py-4 px-3 overflow-y-auto">
            {/* Nav Headers selectors */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E5E2DE] px-1 text-[#8C8882] text-[10px] font-mono font-bold uppercase tracking-widest">
              <span>{!isSidebarCollapsed && (cn ? "工作流程" : "WORKFLOW")}</span>
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hover:text-black p-1 rounded transition cursor-pointer"
              >
                {isSidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
              </button>
            </div>

            {/* Menu Items */}
            {[
              { id: "home", label: cn ? "研究新建" : "Home & Create", icon: Home },
              { id: "overview", label: cn ? "项目总览" : "Project Overview", icon: Layout, requiresProject: true },
              { id: "modeling", label: cn ? "想法建模" : "Idea Modeling", icon: Layers, requiresProject: true },
              { id: "platforms", label: cn ? "平台配置" : "Platforms Config", icon: Settings, requiresProject: true },
              { id: "tasks", label: cn ? "搜索任务" : "Search Tasks", icon: Play, requiresProject: true },
              { id: "competitors", label: cn ? "类别与竞品" : "Competitors", icon: Compass, requiresProject: true },
              { id: "voices", label: cn ? "用户声音" : "User Voices", icon: MessageSquare, requiresProject: true },
              { id: "evaluation", label: cn ? "评估结论" : "Assessment Matrix", icon: Sliders, requiresProject: true },
              { id: "strategy", label: cn ? "策略建议" : "Strategic Gaps", icon: Compass, requiresProject: true },
              { id: "validation", label: cn ? "验证行动" : "Validation Play", icon: CheckSquare, requiresProject: true },
              { id: "export", label: cn ? "报告导出" : "Export Files", icon: ReportIcon, requiresProject: true },
              { id: "settings", label: cn ? "设置中心" : "Settings", icon: Settings },
            ].map((menu) => {
              const IconComp = menu.icon;
              const isActive = currentTab === menu.id;
              
              return (
                <button
                  key={menu.id}
                  onClick={() => setCurrentTab(menu.id)}
                  className={`w-full text-left text-xs p-2.5 transition duration-150 flex items-center gap-3 relative cursor-pointer font-sans uppercase tracking-wider text-[11px] font-medium ${
                    isActive 
                      ? "bg-[#1C1C1C] text-white font-bold dark:bg-white dark:text-black" 
                      : "text-[#5C5852] hover:bg-[#E5E2DE] hover:text-[#1C1C1C] dark:text-[#8C8882] dark:hover:bg-[#22201D] dark:hover:text-white"
                  }`}
                  title={menu.label}
                >
                  <IconComp size={14} className="shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">{menu.label}</span>}
                  {isActive && !isSidebarCollapsed && (
                    <div className="absolute right-2 top-3.5 w-1.5 h-1.5 rounded-full bg-white dark:bg-black"></div>
                  )}
                </button>
              );
            })}
          </div>

          {!isSidebarCollapsed && (
            <div className="p-3 border-t border-[#E5E2DE] text-center text-[10px] text-[#8C8882] font-mono uppercase tracking-widest dark:border-[#3E3A35]">
              <div>© 2026 Aether. Build</div>
              <div>Applet running standalone</div>
            </div>
          )}
        </nav>

        {/* Central Display View Workspace */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#FDFCFB] dark:bg-[#121211]">
          
          {/* Main workspace matching selected Navigation tabs */}
          {currentTab === "home" && (
            <HomeView 
              projects={projects}
              onSelectProject={(id) => {
                setSelectedProjectId(id);
                setCurrentTab("overview");
              }}
              onCreateProject={handleCreateProject}
              settings={settings}
              isCreating={isCreating}
              searchProgress={searchProgress}
            />
          )}

          {currentTab === "overview" && selectedProject && (
            <div className="space-y-8 animate-fade-in text-left">
              {/* Overall status bands */}
              <div className="bg-white border border-[#E5E2DE] p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 dark:bg-[#191816] dark:border-[#3E3A35]">
                <div className="space-y-2">
                  <div className="text-[10px] font-mono font-bold uppercase text-[#8C8882] tracking-widest">
                    {cn ? "当前加载研究项目" : "Active Target Project"}
                  </div>
                  <h2 className="text-3xl font-serif italic font-bold text-[#1C1C1C] dark:text-white">
                    {selectedProject.name}
                  </h2>
                  <p className="text-xs text-[#5C5852] dark:text-[#8C8882]">
                    {cn ? "由多引擎全网采集器完成，包含真实的痛点聚类阻碍事实。" : "Dossier compiled by analyzing direct users friction files."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setCurrentTab("export")}
                    className="bg-black hover:bg-black/95 text-white border border-black px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition cursor-pointer dark:bg-white dark:text-black dark:border-white"
                  >
                    <Download size={12} />
                    {cn ? "输出决策报告" : "Export Report"}
                  </button>
                </div>
              </div>

              {/* Lower quadrant panels summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Visual Recommendation Box */}
                <div className="bg-black text-white border border-black p-8 flex flex-col justify-between dark:bg-[#22201D] dark:border-[#3E3A35]">
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono font-bold text-[#8C8882] tracking-widest block uppercase">
                      {cn ? "总研判结论" : "Verdict"}
                    </span>
                    <h3 className="text-xl font-serif italic font-medium leading-snug">
                      {selectedProject.evaluation.overallRecommendation}
                    </h3>
                  </div>
                  <div className="pt-4 border-t border-white/20 mt-6 text-[11px] text-gray-350 leading-relaxed font-sans italic">
                    {cn ? "建议优先根据下面建议的独特切入差异化推出 Landing Page 验证行动计划。" : "Highly advised to first launch micro landing MVP checks to audit actual conversion."}
                  </div>
                </div>

                {/* Left quadrant summary: Key Opps */}
                <div className="bg-[#FFFFFF] border border-[#E5E2DE] p-8 space-y-4 dark:bg-[#191816] dark:border-[#3E3A35]">
                  <h4 className="font-mono font-bold text-[10px] text-[#1C1C1C] bg-[#F9F8F6] uppercase tracking-widest px-2.5 py-1 w-fit border border-[#E5E2DE] dark:bg-[#22201D] dark:text-white dark:border-[#3E3A35]">
                    ✨ {cn ? "最大机会点" : "Main Opportunities"}
                  </h4>
                  <div className="text-xs text-[#5C5852] dark:text-[#8C8882] leading-relaxed whitespace-pre-line pr-2 pl-0.5 font-sans">
                    {selectedProject.evaluation.keyOpportunities}
                  </div>
                </div>

                {/* Right quadrant summary: Risks */}
                <div className="bg-[#FFFFFF] border border-[#E5E2DE] p-8 space-y-4 dark:bg-[#191816] dark:border-[#3E3A35]">
                  <h4 className="font-mono font-bold text-[10px] text-[#1C1C1C] bg-[#F9F8F6] uppercase tracking-widest px-2.5 py-1 w-fit border border-[#E5E2DE] dark:bg-[#22201D] dark:text-white dark:border-[#3E3A35]">
                    ⚠️ {cn ? "最大隐患点" : "Main Risks"}
                  </h4>
                  <div className="text-xs text-[#5C5852] dark:text-[#8C8882] leading-relaxed whitespace-pre-line pr-2 pl-0.5 font-sans">
                    {selectedProject.evaluation.keyRisks}
                  </div>
                </div>
              </div>

              {/* Quick statistics row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
                <div 
                  onClick={() => setCurrentTab("competitors")}
                  className="bg-white border border-[#E5E2DE] hover:border-black cursor-pointer p-6 transition-all flex items-center justify-between dark:bg-[#191816] dark:border-[#3E3A35] dark:hover:border-white"
                >
                  <div className="space-y-1">
                    <div className="text-[9px] text-[#8C8882] font-mono font-bold uppercase tracking-widest">{cn ? "已拦截竞品人" : "Scanned Competitors"}</div>
                    <div className="text-2xl font-serif italic font-bold text-[#1C1C1C] dark:text-white">{selectedProject.competitors.length} 个</div>
                  </div>
                  <ChevronRight size={14} className="text-[#8C8882]" />
                </div>

                <div 
                  onClick={() => setCurrentTab("voices")}
                  className="bg-white border border-[#E5E2DE] hover:border-black cursor-pointer p-6 transition-all flex items-center justify-between dark:bg-[#191816] dark:border-[#3E3A35] dark:hover:border-white"
                >
                  <div className="space-y-1">
                    <div className="text-[9px] text-[#8C8882] font-mono font-bold uppercase tracking-widest">{cn ? "评论证据点" : "Dissatisfaction reviews"}</div>
                    <div className="text-2xl font-serif italic font-bold text-[#1C1C1C] dark:text-white">{selectedProject.userVoices.length} 条</div>
                  </div>
                  <ChevronRight size={14} className="text-[#8C8882]" />
                </div>

                <div 
                  onClick={() => setCurrentTab("evaluation")}
                  className="bg-white border border-[#E5E2DE] hover:border-black cursor-pointer p-6 transition-all flex items-center justify-between dark:bg-[#191816] dark:border-[#3E3A35] dark:hover:border-white"
                >
                  <div className="space-y-1">
                    <div className="text-[9px] text-[#8C8882] font-mono font-bold uppercase tracking-widest">{cn ? "总置信指数" : "Confidence Index"}</div>
                    <div className="text-2xl font-serif italic font-bold text-[#1C1C1C] dark:text-white">{selectedProject.evaluation.confidenceScore} %</div>
                  </div>
                  <ChevronRight size={14} className="text-[#8C8882]" />
                </div>

                <div 
                  onClick={() => setCurrentTab("validation")}
                  className="bg-white border border-[#E5E2DE] hover:border-black cursor-pointer p-6 transition-all flex items-center justify-between dark:bg-[#191816] dark:border-[#3E3A35] dark:hover:border-white"
                >
                  <div className="space-y-1">
                    <div className="text-[9px] text-[#8C8882] font-mono font-bold uppercase tracking-widest">{cn ? "验证验证步骤" : "Actionable Checklist"}</div>
                    <div className="text-2xl font-serif italic font-bold text-[#1C1C1C] dark:text-white">{selectedProject.validationPlan.length} 阶</div>
                  </div>
                  <ChevronRight size={14} className="text-[#8C8882]" />
                </div>
              </div>
            </div>
          )}

          {currentTab === "modeling" && selectedProject && (
            <div className="space-y-6 animate-fade-in text-left">
              <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-2">
                  <Layers className="text-indigo-600" size={18} />
                  <h2 className="text-base font-bold text-gray-900 font-mono">
                    {cn ? "标准化后的产品设想大纲" : "Deconstructed Standardized Idea Model"}
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3.5">
                    <div>
                      <span className="font-mono font-bold text-gray-400 uppercase text-[9px] block mb-0.5">{cn ? "设想初始表述 (Statement)" : "Original Statement"}</span>
                      <p className="text-xs text-gray-850 bg-slate-50 p-3 rounded-lg border border-gray-150 leading-relaxed font-sans">{selectedProject.ideaModel.statement}</p>
                    </div>

                    <div>
                      <span className="font-mono font-bold text-gray-400 uppercase text-[9px] block mb-0.5">{cn ? "目标用户群 (Target User)" : "Target Cohort"}</span>
                      <p className="text-xs text-gray-800 font-sans font-medium">{selectedProject.ideaModel.targetUser}</p>
                    </div>

                    <div>
                      <span className="font-mono font-bold text-gray-400 uppercase text-[9px] block mb-0.5">{cn ? "拟解决核心任务 (Core JTBD Job)" : "Primary JTBD Job"}</span>
                      <p className="text-xs text-gray-800 font-sans font-medium">{selectedProject.ideaModel.coreJob}</p>
                    </div>

                    <div>
                      <span className="font-mono font-bold text-gray-400 uppercase text-[9px] block mb-0.5">{cn ? "代表性使用场景" : "Primary Spot Sequence"}</span>
                      <p className="text-xs text-gray-800 font-sans font-medium">{selectedProject.ideaModel.useScenario}</p>
                    </div>
                  </div>

                  <div className="space-y-3.5 pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-gray-105 pt-4 md:pt-0">
                    <div>
                      <span className="font-mono font-bold text-gray-400 uppercase text-[9px] block mb-0.5">{cn ? "现有的痛苦替代做法 (Existing Alternatives)" : "Existing Alternative Setups"}</span>
                      <p className="text-xs text-gray-800 font-sans font-medium">{selectedProject.ideaModel.existingAlternatives}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-mono font-bold text-gray-400 uppercase text-[9px] block mb-0.5">{cn ? "交付形态 (Product Form)" : "Product Delivery Mode"}</span>
                        <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-mono font-bold w-fit text-[10px]">{selectedProject.ideaModel.productForm}</p>
                      </div>

                      <div>
                        <span className="font-mono font-bold text-gray-400 uppercase text-[9px] block mb-0.5">{cn ? "预估可接受价格区间" : "Target pricing range"}</span>
                        <p className="text-xs text-gray-800 font-mono font-bold">{selectedProject.ideaModel.targetBudget}</p>
                      </div>
                    </div>

                    <div>
                      <span className="font-mono font-bold text-gray-400 uppercase text-[9px] block mb-0.5">{cn ? "本次调研核心目标" : "Key research mandate"}</span>
                      <p className="text-xs text-gray-800 font-sans font-medium">{selectedProject.ideaModel.researchGoal}</p>
                    </div>

                    {/* Keywords mapping and categories */}
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-[10px] text-gray-400 font-mono font-bold block mb-1">{cn ? "核心建议搜索引擎关键词" : "Telemetry Generated Search Keyword packet"}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProject.ideaModel.suggestedKeywords.map((kw, i) => (
                            <span key={i} className="bg-slate-100 text-gray-700 text-[10px] font-mono px-2 py-1 rounded">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentTab === "platforms" && selectedProject && (
            <PlatformConfigView 
              project={selectedProject}
              settings={settings}
              onUpdateProject={handleUpdateProject}
            />
          )}

          {currentTab === "tasks" && selectedProject && (
            <div className="bg-white rounded-xl border border-gray-250 p-6 text-left shadow-sm space-y-6 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-2">
                <div className="flex items-center gap-2">
                  <Play className="text-indigo-600" size={16} />
                  <h2 className="text-base font-bold text-gray-900 font-mono">
                    {cn ? "并行采集任务多队列监控" : "Parallel Crawler Queue Tracker"}
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] text-gray-400 font-mono">CRAWLER STATUS: IDLE</span>
                </div>
              </div>

              {/* Tasks lists */}
              <div className="space-y-3.5">
                {selectedProject.searchTasks.map((task, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-gray-200 bg-white shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-950 font-mono">{task.platform}</span>
                        <span className="text-[9px] bg-slate-100 text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 font-mono">
                          {task.query}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed font-sans">{task.logs}</p>
                    </div>

                    <div className="shrink-0 flex items-center gap-4 text-xs font-mono text-gray-500">
                      <span>{task.duration} ms</span>
                      <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1 text-[10px] uppercase">
                        ✓ SUCCESS
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* simulated logs terminal block */}
              <div className="bg-slate-900 rounded-lg p-5 text-gray-200 font-mono text-xs space-y-2 border border-gray-800">
                <div className="text-[10px] text-gray-400 uppercase flex items-center gap-2 border-b border-slate-800 pb-2 mb-2">
                  <span>LOG CONSOLE TELEMETRY TERMINAL</span>
                </div>
                <p>&gt; [SYSTEM] Initializing parallel crawl on SQLite persistent map snapshots...</p>
                <p className="text-indigo-400">&gt; [INFO] Dynamic keywords parsed from statement successfully.</p>
                <p className="text-emerald-400">&gt; [SUCCESS] All queries executed without proxy-backoffs timeouts. Synced 4 indexes.</p>
              </div>
            </div>
          )}

          {currentTab === "competitors" && selectedProject && (
            <CompetitorView 
              project={selectedProject}
              settings={settings}
              onUpdateProject={handleUpdateProject}
            />
          )}

          {currentTab === "voices" && selectedProject && (
            <UserVoiceView 
              project={selectedProject}
              settings={settings}
              onUpdateProject={handleUpdateProject}
              onSelectVoice={(id) => {
                setActiveVoiceId(id);
                setIsRightDrawerCollapsed(false); // slide open the contextual right sheet!
              }}
            />
          )}

          {currentTab === "evaluation" && selectedProject && (
            <EvaluationView 
              project={selectedProject}
              settings={settings}
              onUpdateProject={handleUpdateProject}
              onReevaluate={handleReevaluate}
              isLoading={isLoading}
            />
          )}

          {currentTab === "strategy" && selectedProject && (
            <StrategyView 
              project={selectedProject}
              settings={settings}
            />
          )}

          {currentTab === "validation" && selectedProject && (
            <ValidationView 
              project={selectedProject}
              settings={settings}
            />
          )}

          {currentTab === "export" && selectedProject && (
            <div className="bg-white rounded-xl border border-gray-250 p-6 text-left shadow-sm space-y-6 animate-fade-in font-sans">
              <div className="space-y-2">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Download className="text-indigo-600" size={18} />
                  <h2 className="text-base font-bold text-gray-900 font-mono uppercase">
                    {cn ? "输出项目核心研判定论报告" : "Export Research Intel Dossier"}
                  </h2>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed font-sans">
                  {cn 
                    ? "将该项目的建模、原始采集文献、9维置信分数、以及下一步的广告访谈行动指南，统一编译打包输出。您可以选择复制 Markdown 原文直接贴入工作协作盘。"
                    : "Compiles the active telemetry indexes and strategic action milestones to formatted Markdown copy sheets."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left MD code viewer preview */}
                <div className="md:col-span-2 space-y-2">
                  <div className="bg-slate-900 text-gray-200 rounded-lg p-5 font-mono text-xs h-[400px] overflow-y-auto border border-gray-800 leading-relaxed">
                    <pre className="whitespace-pre-wrap">{compiledMarkdownFile}</pre>
                  </div>
                </div>

                {/* Print button commands */}
                <div className="space-y-4">
                  <div className="p-5 border border-indigo-100 bg-indigo-50/20 rounded-xl space-y-3">
                    <h4 className="font-bold text-indigo-950 text-sm">{cn ? "一键数据导出" : "Instant Export Actions"}</h4>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(compiledMarkdownFile);
                        alert(cn ? "Markdown文本已成功复制到系统剪贴板！" : "Markdown text copied to system clipboard.");
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition hover:shadow cursor-pointer"
                    >
                      <ClipboardCopy size={13} />
                      {cn ? "复制 Markdown 报告原文" : "Copy Markdown Corpus"}
                    </button>

                    <button
                      onClick={() => {
                        const blob = new Blob([compiledMarkdownFile], { type: "text/markdown;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${selectedProject.id}-research-dossier.md`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="w-full bg-white hover:bg-slate-50 border border-gray-250 text-gray-700 font-semibold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Download size={13} />
                      {cn ? "导出保存为 .md 文件" : "Save as .md file"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentTab === "settings" && (
            <SettingView 
              settings={settings}
              onUpdateSettings={setSettings}
            />
          )}
        </main>

        {/* Global collapsible context guidance panel on the right */}
        <aside className={`border-l border-gray-200 bg-white transition-all duration-300 flex flex-col justify-between shrink-0 text-left ${
          isRightDrawerCollapsed ? "w-0 overflow-hidden border-l-0" : "w-80"
        }`}>
          <div className="p-5 space-y-5 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-150">
              <span className="text-xs font-bold font-mono text-gray-400 uppercase tracking-wide">
                ℹ️ {cn ? "右侧背景助手" : "Contextual Help Info"}
              </span>
              <button 
                onClick={() => setIsRightDrawerCollapsed(true)}
                className="hover:text-red-500 font-bold p-1 rounded font-mono text-gray-400 cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* active content help information */}
            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-gray-900 border-b border-gray-50 pb-1 flex items-center gap-1">
                  <HelpCircle size={13} className="text-gray-400" />
                  {activeHelp.title}
                </h4>
                <p className="text-gray-600 font-sans leading-relaxed pt-2">
                  {activeHelp.tip}
                </p>
              </div>

              {activeHelp.warnings && (
                <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-[10px] leading-relaxed font-sans font-medium">
                  {activeHelp.warnings}
                </div>
              )}
            </div>

            {/* If looking at User Voice comments block, show detailed preview in drawer! */}
            {currentTab === "voices" && activeVoiceId && (() => {
              const activeVoice = selectedProject.userVoices.find(v => v.id === activeVoiceId);
              if (!activeVoice) return null;
              return (
                <div className="pt-4 border-t border-gray-150 space-y-3.5 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-mono text-[9px] text-gray-400 uppercase block">{cn ? "原始言论证据快照" : "Voice Detail Snapshot"}</span>
                    <h5 className="font-bold text-gray-905">{activeVoice.title}</h5>
                  </div>
                  <p className="text-gray-600 bg-slate-50 p-3 rounded-lg border border-gray-200 leading-relaxed font-sans">
                    "{activeVoice.content}"
                  </p>
                  <div className="text-[10px] text-gray-400 font-mono">
                    <div>User: @{activeVoice.userName}</div>
                    <div>Source: {activeVoice.platform}</div>
                    <div>Date: {activeVoice.timestamp}</div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="p-4 bg-slate-55 bg-slate-50 border-t border-gray-100 text-center text-[10px] text-gray-400 font-mono">
            {cn ? "本面板随流程栏目自适应激活" : "Context cards adapts dynamically"}
          </div>
        </aside>

        {/* Floating Toggle handle to slide right assist panel open */}
        {isRightDrawerCollapsed && (
          <button
            onClick={() => setIsRightDrawerCollapsed(false)}
            className="fixed right-4 bottom-4 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition duration-200 flex items-center justify-center cursor-pointer hover:scale-105 z-40"
            title="Open context helper"
          >
            <HelpCircle size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
