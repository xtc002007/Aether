import React, { useState } from "react";
import { ResearchProject, AppSettings } from "../types";
import { 
  SlidersHorizontal, CheckSquare, Settings, Globe, Radio, 
  HelpCircle, Sliders, LayoutGrid, RotateCcw, PenTool 
} from "lucide-react";

interface PlatformConfigViewProps {
  project: ResearchProject;
  settings: AppSettings;
  onUpdateProject: (updated: ResearchProject) => void;
}

export default function PlatformConfigView({
  project,
  settings,
  onUpdateProject
}: PlatformConfigViewProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "query" | "weights">("overview");
  const [newTemplateText, setNewTemplateText] = useState("{name} alternatives poor feedback");
  
  const cn = settings.language === "zh";

  // Available crawler channels list
  const initialPlatformsList = [
    { id: "Reddit", type: "social", desc: cn ? "扫描社群论坛、真实讨论、寻找高频牢骚与冷酷自救替代" : "Scout subreddit boards, active self-memos threads and pain complains" },
    { id: "Google Search", type: "search", desc: cn ? "爬取通用 SEO 趋势和头部垄断商，解析广告覆盖" : "SEO directories index analysis and giant monopolist mappings" },
    { id: "G2 / Capterra", type: "review", desc: cn ? "对标 SaaS 软件评分站点，扫描高意图商业付费与不满意细目" : "Audit SaaS software portals negative specifications and buy decisions" },
    { id: "App Store", type: "store", desc: cn ? "监测移动客户端星级缺陷分布，提取低带宽加载失败信号" : "Map mobile ratings drop vectors and cellular load errors" },
  ];

  const handleTogglePlatform = (platformName: string) => {
    const isEnabled = project.enabledPlatforms.includes(platformName);
    const nextList = isEnabled
      ? project.enabledPlatforms.filter(name => name !== platformName)
      : [...project.enabledPlatforms, platformName];

    onUpdateProject({
      ...project,
      enabledPlatforms: nextList
    });
  };

  const handleAdjustWeight = (platformKey: "reddit" | "google" | "g2" | "store", val: number) => {
    onUpdateProject({
      ...project,
      platformWeights: {
        ...project.platformWeights,
        [platformKey]: val
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in p-1 text-left">
      {/* Tab selectors */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-150">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold font-mono transition duration-150 ${
            activeTab === "overview" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-slate-50"
          }`}
        >
          🌐 {cn ? "平台概览与启断" : "Platforms Overview"}
        </button>
        <button
          onClick={() => setActiveTab("query")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold font-mono transition duration-150 ${
            activeTab === "query" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-slate-50"
          }`}
        >
          🧩 {cn ? "查询策略与模板" : "Query Rules & Templates"}
        </button>
        <button
          onClick={() => setActiveTab("weights")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold font-mono transition duration-150 ${
            activeTab === "weights" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-slate-50"
          }`}
        >
          ⚖️ {cn ? "项目级权重偏差配置" : "Project Override Weights"}
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {initialPlatformsList.map((plat) => {
            const isEnabled = project.enabledPlatforms.includes(plat.id);
            return (
              <div
                key={plat.id}
                className={`p-5 rounded-xl border bg-white shadow-sm flex flex-col justify-between transition duration-150 ${
                  isEnabled ? "border-indigo-600 ring-1 ring-indigo-50/20" : "border-gray-200"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900 font-mono tracking-wide">
                      {plat.id}
                    </span>
                    <button
                      onClick={() => handleTogglePlatform(plat.id)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-md cursor-pointer transition ${
                        isEnabled ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {isEnabled ? (cn ? "已启用 (ON)" : "ON") : (cn ? "未开启 (OFF)" : "OFF")}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed font-sans pr-4">
                    {plat.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-50 mt-4 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                  <span>{cn ? "默认并发限速: 4 个线程" : "Default concurrency limit: 4 threads"}</span>
                  <span>{cn ? "超时退避: 15s" : "Backoff scale: 15s"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "query" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <PenTool size={16} className="text-gray-500" />
              {cn ? "查询检索词生成样板 (Query Formulation Templates)" : "Query Formulation Rules Map"}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {cn 
                ? "系统智能扫描想法建模后，会自动组合这些底层样板发起并联请求。您可以自定义样板结构词以定制搜索范围。"
                : "The system formulates raw search API params by joining these templates dynamically based on idea keywords."}
            </p>

            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-slate-50 border border-gray-200/60 rounded-lg flex items-center justify-between gap-4">
                <div className="text-xs font-mono font-bold text-indigo-700">G2/Capterra Review Template</div>
                <input
                  type="text"
                  className="bg-white px-3 py-1.5 rounded border border-gray-250 font-mono text-xs w-2/3"
                  value={newTemplateText}
                  onChange={(e) => setNewTemplateText(e.target.value)}
                />
              </div>

              <div className="p-3.5 bg-slate-50 border border-gray-200/60 rounded-lg flex items-center justify-between gap-4">
                <div className="text-xs font-mono font-bold text-indigo-700">Reddit Search Template</div>
                <div className="font-mono text-xs text-gray-600">r/{"{industry}"} {"{problem}"} competitor pain points</div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-gray-200/60 rounded-lg flex items-center justify-between gap-4">
                <div className="text-xs font-mono font-bold text-indigo-700">App Store Search Template</div>
                <div className="font-mono text-xs text-gray-600">iOS tracker rating crash OR sync issues</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "weights" && (
        <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Sliders size={16} className="text-gray-500" />
              {cn ? "项目特定渠道数据比重偏差 (Platform Signal Sliders)" : "Platform Signals Weights Map"}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed font-sans">
              {cn 
                ? "滑动调节各大平台在计算 9 维商业价值时的信用分配权重。例如，针对消费者APP建议拉大 App Store 权重度，针对 B2B SaaS 建议拉大 G2 不满点权重度。"
                : "Slider adjust factors of each social channels inside Overall Score calculation, for example SaaS teams prioritize G2 scores while consumer developers prefer App Store feedback weights."}
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2 p-3.5 border border-gray-150 rounded-lg bg-slate-50/10">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold">Reddit (Social Feedback Support Weight)</span>
                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{project.platformWeights.reddit} x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={project.platformWeights.reddit}
                onChange={(e) => handleAdjustWeight("reddit", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div className="space-y-2 p-3.5 border border-gray-150 rounded-lg bg-slate-50/10">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold">Google (Search SEO Indexes Support Weight)</span>
                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{project.platformWeights.google} x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={project.platformWeights.google}
                onChange={(e) => handleAdjustWeight("google", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div className="space-y-2 p-3.5 border border-gray-150 rounded-lg bg-slate-50/10">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold">G2 Reviews (SaaS Complaints gravity weight)</span>
                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{project.platformWeights.g2} x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={project.platformWeights.g2}
                onChange={(e) => handleAdjustWeight("g2", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div className="space-y-2 p-3.5 border border-gray-150 rounded-lg bg-slate-50/10">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold">App Store (Mobile app stars gravity weight)</span>
                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{project.platformWeights.store} x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={project.platformWeights.store}
                onChange={(e) => handleAdjustWeight("store", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
