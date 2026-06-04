import React, { useState, useEffect } from "react";
import { ResearchProject, AppSettings, PlatformConfig as PlatformConfigType } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { SlidersHorizontal, CheckSquare, Settings, Globe, Radio, HelpCircle, Sliders, LayoutGrid, RotateCcw, PenTool, Save, Loader2 } from "lucide-react";

interface PlatformConfigViewProps {
  project: ResearchProject;
  settings: AppSettings;
  onUpdateProject: (updated: ResearchProject) => void;
}

export default function PlatformConfigView({ project, settings, onUpdateProject }: PlatformConfigViewProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "detail" | "query" | "weights" | "overrides">("overview");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("Reddit");
  const [platformConfigs, setPlatformConfigs] = useState<PlatformConfigType[]>([]);
  const [configsLoading, setConfigsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const cn = settings.language === "zh";

  // P1-7: Load real PlatformConfig data from backend
  useEffect(() => {
    async function load() {
      try {
        const configs = await invoke<PlatformConfigType[]>("get_platform_configs");
        setPlatformConfigs(configs);
      } catch (err) {
        console.error("Failed to load platform configs:", err);
      } finally {
        setConfigsLoading(false);
      }
    }
    load();
  }, []);

  // Get the actual config for the selected platform
  const selectedConfig = platformConfigs.find(c => c.name === selectedPlatform);

  const handleTogglePlatform = (platformName: string) => {
    const isEnabled = project.enabledPlatforms.includes(platformName);
    const nextList = isEnabled
      ? project.enabledPlatforms.filter(name => name !== platformName)
      : [...project.enabledPlatforms, platformName];
    onUpdateProject({ ...project, enabledPlatforms: nextList });
  };

  const handleAdjustWeight = (key: keyof typeof project.platformWeights, val: number) => {
    onUpdateProject({
      ...project,
      platformWeights: { ...project.platformWeights, [key]: val }
    });
  };

  const handleUpdateConfig = async (updated: PlatformConfigType) => {
    setSaving(true);
    try {
      await invoke("update_platform_config", { config: updated });
      setPlatformConfigs(prev => prev.map(c => c.name === updated.name ? updated : c));
    } catch (err) {
      console.error("Failed to update platform config:", err);
    } finally {
      setSaving(false);
    }
  };

  // Build display list from actual configs, falling back to hardcoded list
  const displayPlatforms = platformConfigs.length > 0 ? platformConfigs : [
    { name: "Reddit", platformType: "social_forum" as const, enabled: true },
    { name: "Google Search", platformType: "search_engine" as const, enabled: true },
    { name: "G2 / Capterra", platformType: "review_site" as const, enabled: true },
    { name: "App Store", platformType: "app_store" as const, enabled: true },
  ];

  const descMap: Record<string, { cn: string; en: string }> = {
    "Reddit": { cn: "扫描社群论坛真实讨论，寻找高频牢骚与替代方案", en: "Scout subreddit boards for real pain points and alternatives" },
    "Google Search": { cn: "爬取通用SEO趋势和头部垄断商，解析广告覆盖", en: "SEO directories index analysis and market leader mappings" },
    "Bing": { cn: "微软搜索引擎，补充Google覆盖不到的独立站点与地区结果", en: "Microsoft search engine, supplements Google coverage with unique sites and regional results" },
    "G2 / Capterra": { cn: "对标SaaS软件评分站点，扫描商业付费与不满意细目", en: "Audit SaaS portal negatives and buy decisions" },
    "App Store": { cn: "监测移动客户端星级缺陷，提取低分加载失败信号", en: "Map mobile ratings drop vectors and cellular load errors" },
    "Google Play": { cn: "Android应用商店评论与评分分析，覆盖全球安卓生态", en: "Android app store reviews & ratings, covering global Android ecosystem" },
    "Chrome Web Store": { cn: "浏览器插件商店，发现扩展类产品竞品与用户反馈", en: "Browser extension store, discover extension competitors & user feedback" },
    "Product Hunt": { cn: "新产品发现与早期用户反馈追踪", en: "New product discovery & early adopter tracking" },
    "X / Twitter": { cn: "实时讨论热度与情绪趋势分析", en: "Real-time discussion heat & sentiment trends" },
    "AlternativeTo": { cn: "替代品目录，发现用户迁移路径", en: "Alternative directory, discover user migration paths" },
    "Trustpilot": { cn: "消费者点评网站，扫描B2C产品真实评价与信任度", en: "Consumer review site, scan B2C product real reviews & trust scores" },
    "Quora": { cn: "知识问答社区，挖掘用户深层需求与替代方案讨论", en: "Q&A community, mine deep user needs & alternative discussions" },
    "TikTok": { cn: "短视频平台，追踪产品话题热度与年轻用户反馈", en: "Short video platform, track product topic trends & young user feedback" },
    "YouTube": { cn: "视频内容中的产品评测与讨论分析", en: "Video product reviews & discussion analysis" },
    "LinkedIn": { cn: "专业领域产品讨论与行业趋势分析", en: "Professional product discussions & industry trends" },
    "Zhihu": { cn: "中文社区深度问答与产品讨论", en: "Chinese Q&A community deep product discussions" },
    "Tieba": { cn: "百度贴吧，中文兴趣社区讨论与用户痛点挖掘", en: "Baidu Tieba, Chinese interest community discussions & pain point mining" },
    "Douban": { cn: "豆瓣社区，中文文化消费产品评价与讨论", en: "Douban community, Chinese cultural product reviews & discussions" },
    "Google Trends": { cn: "搜索趋势分析，识别需求上升或下降的信号", en: "Search trend analysis, identify rising or declining demand signals" },
    "Amazon": { cn: "电商产品评论，发现购买意图与差评痛点", en: "E-commerce product reviews, discover purchase intent & negative review pain points" },
    "Etsy": { cn: "手工艺与创意产品电商，分析小众品类市场", en: "Crafts & creative product e-commerce, analyze niche market categories" },
    "Taobao": { cn: "淘宝电商平台，中国消费市场需求与价格敏感度分析", en: "Taobao e-commerce, Chinese consumer market demand & price sensitivity analysis" },
    "JD.com": { cn: "京东电商平台，中国品牌消费与品质评价分析", en: "JD.com e-commerce, Chinese brand consumption & quality review analysis" },
  };

  return (
    <div className="space-y-6 animate-fade-in p-1 text-left">
      <div className="flex items-center gap-2 pb-3 border-b border-gray-150 flex-wrap">
        {[
          { id: "overview" as const, label: cn ? "平台总览" : "Overview", icon: "🌐" },
          { id: "detail" as const, label: cn ? "平台详情" : "Detail", icon: "🔧" },
          { id: "query" as const, label: cn ? "查询模板" : "Templates", icon: "🧩" },
          { id: "weights" as const, label: cn ? "项目权重" : "Weights", icon: "⚖️" },
          { id: "overrides" as const, label: cn ? "项目级覆盖" : "Per-Project", icon: "📋" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold font-mono transition duration-150 ${
              activeTab === tab.id ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-slate-50"
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
        {configsLoading && <Loader2 size={14} className="animate-spin text-gray-400 ml-2" />}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayPlatforms.map(plat => {
            const isEnabled = project.enabledPlatforms.includes(plat.name);
            const desc = descMap[plat.name] || { cn: "", en: "" };
            return (
              <div key={plat.name} className={`p-5 rounded-xl border bg-white shadow-sm flex flex-col justify-between transition ${
                isEnabled ? "border-indigo-600 ring-1 ring-indigo-50/20" : "border-gray-200"
              }`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900 font-mono tracking-wide">{plat.name}</span>
                    <button onClick={() => handleTogglePlatform(plat.name)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-md cursor-pointer transition ${
                        isEnabled ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}>
                      {isEnabled ? (cn ? "已启用" : "ON") : (cn ? "未开启" : "OFF")}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed font-sans pr-4">
                    {cn ? desc.cn : desc.en}
                  </p>
                </div>
                <div className="pt-4 border-t border-gray-50 mt-4 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                  <span>{cn ? "并发" : "Concur"}: {plat.maxConcurrency || "?"}</span>
                  <span>{cn ? "超时" : "Timeout"}: {(plat.timeoutMs || 0) / 1000}s</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "detail" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-250 p-4">
            <span className="text-xs font-bold text-gray-500 font-mono uppercase">{cn ? "选择平台：" : "Select:"}</span>
            <div className="flex gap-2 flex-wrap">
              {displayPlatforms.map(p => (
                <button key={p.name} onClick={() => setSelectedPlatform(p.name)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    selectedPlatform === p.name ? "bg-black text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}>{p.name}</button>
              ))}
            </div>
          </div>

          {/* Basic Config — uses real config data */}
          <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 font-mono uppercase">
              {cn ? `基本配置 - ${selectedPlatform}` : `Basic Config - ${selectedPlatform}`}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 font-mono uppercase block">{cn ? "平台名称" : "Name"}</label>
                <input type="text" className="w-full border border-gray-200 p-2 rounded bg-gray-50" value={selectedPlatform} readOnly />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 font-mono uppercase block">{cn ? "平台类型" : "Type"}</label>
                <input type="text" className="w-full border border-gray-200 p-2 rounded bg-gray-50 font-mono text-xs"
                  value={selectedConfig?.platform_type || ""} readOnly />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 font-mono uppercase block">{cn ? "默认地区" : "Region"}</label>
                <input type="text" className="w-full border border-gray-200 p-2 rounded font-mono text-xs"
                  value={selectedConfig?.default_region || ""}
                  onChange={(e) => {
                    if (selectedConfig) handleUpdateConfig({ ...selectedConfig, default_region: e.target.value });
                  }} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 font-mono uppercase block">{cn ? "默认语言" : "Language"}</label>
                <input type="text" className="w-full border border-gray-200 p-2 rounded font-mono text-xs"
                  value={selectedConfig?.default_language || ""}
                  onChange={(e) => {
                    if (selectedConfig) handleUpdateConfig({ ...selectedConfig, default_language: e.target.value });
                  }} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 font-mono uppercase block">{cn ? "参与快速模式" : "Quick Mode"}</label>
                <select className="w-full border border-gray-200 p-2 rounded bg-white font-mono text-xs"
                  value={selectedConfig?.participate_quick ? "yes" : "no"}
                  onChange={(e) => {
                    if (selectedConfig) handleUpdateConfig({ ...selectedConfig, participate_quick: e.target.value === "yes" });
                  }}>
                  <option value="yes">{cn ? "是" : "Yes"}</option>
                  <option value="no">{cn ? "否" : "No"}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 font-mono uppercase block">{cn ? "参与深度模式" : "Deep Mode"}</label>
                <select className="w-full border border-gray-200 p-2 rounded bg-white font-mono text-xs"
                  value={selectedConfig?.participate_deep ? "yes" : "no"}
                  onChange={(e) => {
                    if (selectedConfig) handleUpdateConfig({ ...selectedConfig, participate_deep: e.target.value === "yes" });
                  }}>
                  <option value="yes">{cn ? "是" : "Yes"}</option>
                  <option value="no">{cn ? "否" : "No"}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Scheduling & Parsing — real config values */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 font-mono uppercase">{cn ? "查询配置" : "Query Config"}</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{cn ? "最大页数" : "Max Pages"}</span>
                  <input type="number" className="w-16 border border-gray-200 rounded p-1 text-center font-mono text-xs"
                    value={selectedConfig?.max_pages || 0}
                    onChange={(e) => {
                      if (selectedConfig) handleUpdateConfig({ ...selectedConfig, max_pages: parseInt(e.target.value) || 0 });
                    }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{cn ? "最大结果" : "Max Results"}</span>
                  <input type="number" className="w-16 border border-gray-200 rounded p-1 text-center font-mono text-xs"
                    value={selectedConfig?.max_results || 0}
                    onChange={(e) => {
                      if (selectedConfig) handleUpdateConfig({ ...selectedConfig, max_results: parseInt(e.target.value) || 0 });
                    }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{cn ? "RPS限流" : "Rate Limit RPS"}</span>
                  <input type="number" step="0.1" className="w-16 border border-gray-200 rounded p-1 text-center font-mono text-xs"
                    value={selectedConfig?.rate_limit_rps || 0}
                    onChange={(e) => {
                      if (selectedConfig) handleUpdateConfig({ ...selectedConfig, rate_limit_rps: parseFloat(e.target.value) || 0 });
                    }} />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 font-mono uppercase">{cn ? "调度与解析" : "Scheduling & Parsing"}</h3>
              <div className="space-y-2 text-xs">
                {[
                  { label: cn ? "最大并发" : "Concurrency", value: selectedConfig?.max_concurrency || 0, key: "max_concurrency" },
                  { label: cn ? "超时(毫秒)" : "Timeout(ms)", value: selectedConfig?.timeout_ms || 0, key: "timeout_ms" },
                  { label: cn ? "重试次数" : "Retries", value: selectedConfig?.retry_count || 0, key: "retry_count" },
                  { label: cn ? "退避策略" : "Backoff", value: selectedConfig?.backoff_strategy || "", key: "backoff_strategy" },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-gray-600">{r.label}</span>
                    {r.key === "backoff_strategy" ? (
                      <input type="text" className="w-24 border border-gray-200 rounded p-1 text-center font-mono text-xs"
                        value={r.value}
                        onChange={(e) => {
                          if (selectedConfig) handleUpdateConfig({ ...selectedConfig, backoff_strategy: e.target.value });
                        }} />
                    ) : (
                      <input type="number" className="w-16 border border-gray-200 rounded p-1 text-center font-mono text-xs"
                        value={r.value}
                        onChange={(e) => {
                          if (selectedConfig) {
                            const val = parseInt(e.target.value) || 0;
                            if (r.key === "max_concurrency") handleUpdateConfig({ ...selectedConfig, max_concurrency: val });
                            else if (r.key === "timeout_ms") handleUpdateConfig({ ...selectedConfig, timeout_ms: val });
                            else if (r.key === "retry_count") handleUpdateConfig({ ...selectedConfig, retry_count: val });
                          }
                        }} />
                    )}
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100 space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-400 font-mono uppercase block">{cn ? "解析字段" : "Parse Fields"}</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedConfig?.parse_fields ? (
                      Object.entries(selectedConfig.parse_fields).map(([key, val]) => (
                        <span key={key} className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${val ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-gray-50 text-gray-300 border-gray-100"}`}>
                          {key} {val ? "✓" : "✗"}
                        </span>
                      ))
                    ) : (
                      <span className="text-[9px] text-gray-400">{cn ? "加载中..." : "Loading..."}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {selectedConfig && (
            <div className="flex justify-end">
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                {saving && <Loader2 size={10} className="animate-spin" />}
                {cn ? "修改后自动保存" : "Auto-saves on change"}
              </span>
            </div>
          )}
        </div>
      )}

      {activeTab === "query" && (
        <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <PenTool size={16} className="text-gray-500" />
            {cn ? "查询检索词生成样板" : "Query Formulation Templates"}
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            {cn ? "系统自动组合以下模板发起搜索。可自定义修改。" : "System auto-combines these templates for search. Customizable."}
          </p>
          <div className="space-y-3 pt-2">
            {selectedConfig?.query_templates && selectedConfig.query_templates.length > 0 ? (
              selectedConfig.query_templates.map((t, i) => (
                <div key={i} className="p-3.5 bg-slate-50 border border-gray-200/60 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-700">{t.name}</span>
                      <span className="text-[9px] font-mono text-gray-400">[{t.query_type}]</span>
                    </div>
                    <button
                      onClick={() => {
                        if (selectedConfig) {
                          const updated = { ...selectedConfig, query_templates: [...selectedConfig.query_templates] };
                          updated.query_templates[i] = { ...t, enabled: !t.enabled };
                          handleUpdateConfig(updated);
                        }
                      }}
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded cursor-pointer ${
                        t.enabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {t.enabled ? "ON" : "OFF"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-xs text-gray-600 bg-white border border-gray-150 rounded p-2">{t.template}</code>
                    <input
                      type="text"
                      className="w-32 border border-gray-200 rounded p-1.5 text-[10px] font-mono"
                      placeholder={cn ? "预览query..." : "Preview query..."}
                      value={t.template.replace("{core_keyword}", project.ideaModel.statement.split("，")[0] || project.ideaModel.statement).replace("{problem}", project.ideaModel.statement).replace("{category}", project.ideaModel.productForm).replace("{year}", "2026").replace("{competitor_name}", "alternative").replace("{subreddit}", "startups")}
                      readOnly
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 text-xs">
                {cn ? "选择一个平台查看其查询模板" : "Select a platform to view its query templates"}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "weights" && (
        <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Sliders size={16} className="text-gray-500" />
              {cn ? "项目级平台权重覆盖" : "Project Platform Weight Override"}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed font-sans">{cn ? "调整各平台在9维评估中的权重分配。" : "Adjust platform weight distribution in 9-dimension evaluation."}</p>
          </div>
          {([
            { key: "reddit" as const, label: "Reddit" },
            { key: "google" as const, label: "Google Search" },
            { key: "bing" as const, label: "Bing" },
            { key: "g2" as const, label: "G2 Reviews" },
            { key: "store" as const, label: "App Store" },
            { key: "xTwitter" as const, label: "X / Twitter" },
            { key: "productHunt" as const, label: "Product Hunt" },
            { key: "alternativeTo" as const, label: "AlternativeTo" },
            { key: "ecommerce" as const, label: cn ? "电商平台" : "E-Commerce" },
            { key: "quora" as const, label: "Quora" },
            { key: "tiktok" as const, label: "TikTok" },
            { key: "trustpilot" as const, label: "Trustpilot" },
            { key: "chromeWebStore" as const, label: "Chrome Web Store" },
            { key: "googlePlay" as const, label: "Google Play" },
            { key: "googleTrends" as const, label: "Google Trends" },
            { key: "youtube" as const, label: "YouTube" },
            { key: "linkedin" as const, label: "LinkedIn" },
            { key: "zhihu" as const, label: "Zhihu" },
            { key: "tieba" as const, label: "Tieba" },
            { key: "douban" as const, label: "Douban" },
          ] as const).map(({ key, label }) => (
            <div key={key} className="space-y-2 p-3.5 border border-gray-150 rounded-lg bg-slate-50/10">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold">{label}</span>
                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{project.platformWeights[key]}x</span>
              </div>
              <input type="range" min="0.5" max="2.0" step="0.1" value={project.platformWeights[key]}
                onChange={(e) => handleAdjustWeight(key, parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
            </div>
          ))}
        </div>
      )}

      {activeTab === "overrides" && (
        <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Sliders size={16} className="text-gray-500" />
              {cn ? "当前项目的平台覆盖配置" : "Per-Project Platform Overrides"}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed font-sans">
              {cn
                ? "针对当前研究项目单独调整平台行为。这些配置将覆盖全局默认值，只在本项目生效。"
                : "Override platform behavior for this project only. These settings take precedence over global defaults."}
            </p>
          </div>

          <div className="space-y-4">
            {displayPlatforms.map(plat => {
              const isEnabled = project.enabledPlatforms.includes(plat.name);
              return (
                <div key={plat.name} className="p-4 rounded-lg border border-gray-200 bg-slate-50/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm font-mono">{plat.name}</span>
                    <button
                      onClick={() => handleTogglePlatform(plat.name)}
                      className={`text-xs font-semibold px-3 py-1 rounded transition cursor-pointer ${
                        isEnabled ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {isEnabled ? (cn ? "启用" : "ON") : (cn ? "禁用" : "OFF")}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] text-gray-400 font-mono block">{cn ? "采集深度" : "Depth"}</label>
                      <select className="w-full border border-gray-200 rounded p-1.5 text-xs bg-white font-mono">
                        <option value="quick">{cn ? "快速 (1页)" : "Quick (1 page)"}</option>
                        <option value="deep">{cn ? "深度 (3页)" : "Deep (3 pages)"}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-mono block">{cn ? "采集评论" : "Fetch Reviews"}</label>
                      <select className="w-full border border-gray-200 rounded p-1.5 text-xs bg-white font-mono">
                        <option value="yes">{cn ? "是" : "Yes"}</option>
                        <option value="no">{cn ? "否" : "No"}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-mono block">{cn ? "本项并发数" : "Concurrency"}</label>
                      <select className="w-full border border-gray-200 rounded p-1.5 text-xs bg-white font-mono">
                        <option>1</option><option>2</option><option>3</option><option>4</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono pt-1 border-t border-gray-100">
                    {cn ? "查询组合：默认词 + 自定义追加词" : "Query combo: default + custom"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
