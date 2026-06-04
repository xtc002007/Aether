import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ResearchProject, AppSettings, IdeaModel, IdeaModelExtension } from "../types";
import { Layers, Sparkles, Check, X, Plus, Target, Globe, MapPin, Loader2, RefreshCw } from "lucide-react";

interface IdeaModelingViewProps {
  project: ResearchProject;
  settings: AppSettings;
  onUpdateProject: (updated: ResearchProject) => void;
}

interface CategoryCandidate {
  name: string;
  level: number;
  confidence: number;
}

interface PlatformPriority {
  platform: string;
  priority: number;
  reason: string;
}

function generatePainExpressionExamples(model: IdeaModel): string[] {
  const job = model.coreJob || model.statement;
  const scenario = model.useScenario ? ` in ${model.useScenario}` : "";
  return [
    `how do I ${job}${scenario}`,
    `is there a way to ${job}`,
    `best way to ${job} before building`,
    `how to know if ${model.statement} already exists`,
    `tool to ${job} without manual research`,
    `how to validate ${model.statement} idea`,
  ].filter((q) => q.length < 150).slice(0, 8);
}

function generateSubstituteBehaviorExamples(model: IdeaModel): string[] {
  const job = model.coreJob || model.statement;
  const alt = model.existingAlternatives && model.existingAlternatives !== "待分析"
    ? model.existingAlternatives : "manual research";
  return [
    `I manually ${job} for`,
    `using ChatGPT to ${job}`,
    `using ${alt} to ${job}`,
    `anyone else ${job} to research their idea`,
    `spending hours ${job} ${model.statement}`,
    `frustrated trying to ${job}`,
  ].filter((q) => q.length < 150).slice(0, 8);
}

export default function IdeaModelingView({ project, settings, onUpdateProject }: IdeaModelingViewProps) {
  const cn = settings.language === "zh";

  // ── Left column state (editable fields) ──
  const [statement, setStatement] = useState(project.ideaModel.statement);
  const [targetUser, setTargetUser] = useState(project.ideaModel.targetUser);
  const [scenario, setScenario] = useState(project.ideaModel.useScenario);
  const [knownCompetitors, setKnownCompetitors] = useState("");
  const [researchGoal, setResearchGoal] = useState(project.ideaModel.researchGoal);
  const [keyConstraints, setKeyConstraints] = useState(project.ideaModel.keyConstraints);
  const [region, setRegion] = useState(project.region || "global");
  const [language, setLanguage] = useState(project.language || "zh");

  // ── Middle/Right state (LLM output) ──
  const [categories, setCategories] = useState<string[]>(project.ideaModel.categories || []);
  const [keywords, setKeywords] = useState<string[]>(project.ideaModel.suggestedKeywords || []);
  const [platformPriorities, setPlatformPriorities] = useState<PlatformPriority[]>([]);
  const [llmExt, setLlmExt] = useState<IdeaModelExtension | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ── Adopt/Exclude state ──
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
  const [excludedKeywords, setExcludedKeywords] = useState<string[]>(
    project.ideaModel.excludedKeywords || []
  );
  const [customCategory, setCustomCategory] = useState("");
  const [customKeyword, setCustomKeyword] = useState("");

  const handleReAnalyze = async () => {
    if (!statement.trim()) return;
    setIsAnalyzing(true);
    try {
      const ext = await invoke<IdeaModelExtension>("reanalyze_idea_model", {
        statement: statement.trim(),
        targetUser: targetUser.trim(),
        scenario: scenario.trim(),
      });
      setLlmExt(ext);
      setCategories((ext.categories || []).map((c: CategoryCandidate) => c.name));
      setKeywords(ext.suggestedKeywords || []);
      setPlatformPriorities(ext.platformPriority || []);

      // Persist to project
      const updated: ResearchProject = {
        ...project,
        ideaModel: {
          ...project.ideaModel,
          statement: statement.trim(),
          targetUser: targetUser.trim(),
          useScenario: scenario.trim(),
          coreJob: ext.coreJob || project.ideaModel.coreJob,
          existingAlternatives: (ext.existingAlternatives || []).join("；"),
          productForm: ext.productForm || project.ideaModel.productForm,
          researchGoal: researchGoal.trim() || project.ideaModel.researchGoal,
          keyConstraints: keyConstraints.trim(),
          categories: (ext.categories || []).map((c: CategoryCandidate) => c.name),
          suggestedKeywords: ext.suggestedKeywords || [],
        },
        region, language,
      };
      onUpdateProject(updated);
    } catch (err) {
      console.error("Re-analyze failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAdoptCategory = (name: string) => {
    setExcludedCategories(prev => prev.filter(c => c !== name));
    const updated = { ...project, ideaModel: { ...project.ideaModel, categories: [...new Set([...categories, name])] } };
    onUpdateProject(updated);
  };

  const handleExcludeCategory = (name: string) => {
    setExcludedCategories(prev => [...prev, name]);
    const newCats = categories.filter(c => c !== name);
    setCategories(newCats);
    onUpdateProject({ ...project, ideaModel: { ...project.ideaModel, categories: newCats } });
  };

  const handleAdoptKeyword = (kw: string) => {
    const newExcluded = excludedKeywords.filter(k => k !== kw);
    setExcludedKeywords(newExcluded);
    const newKws = [...new Set([...keywords, kw])];
    setKeywords(newKws);
    onUpdateProject({
      ...project,
      ideaModel: { ...project.ideaModel, suggestedKeywords: newKws, excludedKeywords: newExcluded },
    });
  };

  const handleExcludeKeyword = (kw: string) => {
    const newExcluded = [...excludedKeywords, kw];
    setExcludedKeywords(newExcluded);
    const newKws = keywords.filter(k => k !== kw);
    setKeywords(newKws);
    onUpdateProject({
      ...project,
      ideaModel: { ...project.ideaModel, suggestedKeywords: newKws, excludedKeywords: newExcluded },
    });
  };

  const handleAddCustomCategory = () => {
    if (!customCategory.trim()) return;
    setCategories(prev => [...prev, customCategory.trim()]);
    onUpdateProject({ ...project, ideaModel: { ...project.ideaModel, categories: [...categories, customCategory.trim()] } });
    setCustomCategory("");
  };

  const handleAddCustomKeyword = () => {
    if (!customKeyword.trim()) return;
    setKeywords(prev => [...prev, customKeyword.trim()]);
    onUpdateProject({ ...project, ideaModel: { ...project.ideaModel, suggestedKeywords: [...keywords, customKeyword.trim()] } });
    setCustomKeyword("");
  };

  const handleAdoptPlatformPriority = (pp: PlatformPriority) => {
    const key = pp.platform.toLowerCase().replace(/[ /]/g, "");
    const weightMap: Record<string, keyof typeof project.platformWeights> = {
      reddit: "reddit", google: "google", bing: "bing",
      g2capterra: "g2", g2: "g2", appstore: "store",
      producthunt: "productHunt", xtwitter: "xTwitter",
      alternativeto: "alternativeTo",
      quora: "quora", tiktok: "tiktok", trustpilot: "trustpilot",
      chromewebstore: "chromeWebStore", googleplay: "googlePlay",
      googletrends: "googleTrends", youtube: "youtube",
      linkedin: "linkedin", zhihu: "zhihu", tieba: "tieba", douban: "douban",
    };
    const weightKey = Object.keys(weightMap).find(k => key.includes(k));
    if (weightKey) {
      const weightField = weightMap[weightKey];
      const adjusted = { ...project.platformWeights, [weightField]: Math.min(2.0, (project.platformWeights[weightField] || 1.0) + 0.2) };
      onUpdateProject({ ...project, platformWeights: adjusted as any });
    }
  };

  // Visible = not excluded
  const visibleCategories = categories.filter(c => !excludedCategories.includes(c));
  const visibleKeywords = keywords.filter(k => !excludedKeywords.includes(k));

  return (
    <div className="space-y-6 animate-fade-in p-1 text-left">
      <div className="flex items-center justify-between pb-3 border-b border-gray-150">
        <div className="flex items-center gap-2">
          <Layers className="text-indigo-600" size={18} />
          <h2 className="text-base font-bold text-gray-900 font-mono dark:text-white">
            {cn ? "想法建模 — 三栏校正" : "Idea Modeling — 3-Column Calibration"}
          </h2>
        </div>
        <button
          onClick={handleReAnalyze}
          disabled={isAnalyzing || !statement.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
        >
          {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {cn ? "重新分析" : "Re-analyze"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFT COLUMN: Raw Input (1/4) */}
        <div className="bg-white rounded-xl border border-gray-250 p-5 shadow-sm space-y-4 dark:bg-[#191816] dark:border-[#3E3A35]">
          <h3 className="text-xs font-bold text-gray-500 font-mono uppercase border-b border-gray-100 pb-2 dark:text-gray-400 dark:border-[#3E3A35]">
            {cn ? "原始输入" : "Raw Input"}
          </h3>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 font-mono uppercase block">{cn ? "核心想法 *" : "Core Idea *"}</label>
              <textarea rows={3} className="w-full border border-gray-200 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 dark:bg-[#22201D] dark:text-gray-200 dark:border-[#3E3A35]" value={statement} onChange={(e) => setStatement(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 font-mono uppercase block">{cn ? "目标用户" : "Target User"}</label>
              <input type="text" className="w-full border border-gray-200 rounded p-2 text-xs dark:bg-[#22201D] dark:text-gray-200 dark:border-[#3E3A35]" placeholder={cn ? "例如：独立开发者" : "e.g. Freelance developers"} value={targetUser} onChange={(e) => setTargetUser(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 font-mono uppercase block">{cn ? "使用场景" : "Scenario"}</label>
              <input type="text" className="w-full border border-gray-200 rounded p-2 text-xs dark:bg-[#22201D] dark:text-gray-200 dark:border-[#3E3A35]" placeholder={cn ? "在什么情境下触发需求" : "When does the need arise?"} value={scenario} onChange={(e) => setScenario(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 font-mono uppercase block">{cn ? "已知竞品 (逗号分隔)" : "Known Competitors"}</label>
              <input type="text" className="w-full border border-gray-200 rounded p-2 text-xs dark:bg-[#22201D] dark:text-gray-200 dark:border-[#3E3A35]" placeholder="e.g. Notion, Asana" value={knownCompetitors} onChange={(e) => setKnownCompetitors(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 font-mono uppercase block">{cn ? "研究目标" : "Research Goal"}</label>
              <input type="text" className="w-full border border-gray-200 rounded p-2 text-xs dark:bg-[#22201D] dark:text-gray-200 dark:border-[#3E3A35]" value={researchGoal} onChange={(e) => setResearchGoal(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 font-mono uppercase block">{cn ? "关键约束" : "Constraints"}</label>
              <input type="text" className="w-full border border-gray-200 rounded p-2 text-xs dark:bg-[#22201D] dark:text-gray-200 dark:border-[#3E3A35]" placeholder={cn ? "预算/技术/地区/平台限制" : "Budget, tech, region, platform limits"} value={keyConstraints} onChange={(e) => setKeyConstraints(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 font-mono uppercase flex items-center gap-1">
                  <MapPin size={10} />{cn ? "地区" : "Region"}
                </label>
                <select className="w-full border border-gray-200 rounded p-2 text-xs bg-white dark:bg-[#22201D] dark:text-gray-200 dark:border-[#3E3A35]" value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option value="global">{cn ? "全球" : "Global"}</option>
                  <option value="us">United States</option>
                  <option value="cn">China</option>
                  <option value="eu">Europe</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 font-mono uppercase flex items-center gap-1">
                  <Globe size={10} />{cn ? "语言" : "Language"}
                </label>
                <select className="w-full border border-gray-200 rounded p-2 text-xs bg-white dark:bg-[#22201D] dark:text-gray-200 dark:border-[#3E3A35]" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                  <option value="multi">{cn ? "多语言" : "Multi"}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Standardized Structure (1/4) */}
        <div className="bg-white rounded-xl border border-gray-250 p-5 shadow-sm space-y-4 dark:bg-[#191816] dark:border-[#3E3A35]">
          <h3 className="text-xs font-bold text-gray-500 font-mono uppercase border-b border-gray-100 pb-2 dark:text-gray-400 dark:border-[#3E3A35]">
            <Sparkles size={12} className="inline mr-1" />{cn ? "标准化结构" : "Standardized Structure"}
          </h3>

          <div className="space-y-3">
            {[
              { label: cn ? "用户是谁" : "Who is the user", value: project.ideaModel.targetUser || (cn ? "待分析" : "TBD") },
              { label: cn ? "核心任务 (JTBD)" : "Core JTBD", value: project.ideaModel.coreJob || (cn ? "待分析" : "TBD") },
              { label: cn ? "发生场景" : "Use Scenario", value: project.ideaModel.useScenario || (cn ? "待分析" : "TBD") },
              { label: cn ? "当前替代方式" : "Existing Alternatives", value: project.ideaModel.existingAlternatives || (cn ? "待分析" : "TBD") },
              { label: cn ? "产品形态" : "Product Form", value: project.ideaModel.productForm, badge: true },
              { label: cn ? "潜在收费方式" : "Target Budget", value: project.ideaModel.targetBudget || (cn ? "待评估" : "TBD") },
            ].map((f, i) => (
              <div key={i} className="space-y-0.5">
                <span className="text-[9px] font-bold text-gray-400 font-mono uppercase block">{f.label}</span>
                {f.badge ? (
                  <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800">{f.value}</span>
                ) : (
                  <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed">{f.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Inference Candidates (2/4) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Product Categories */}
          <div className="bg-white rounded-xl border border-gray-250 p-5 shadow-sm dark:bg-[#191816] dark:border-[#3E3A35]">
            <h3 className="text-xs font-bold text-gray-500 font-mono uppercase border-b border-gray-100 pb-2 mb-3 dark:text-gray-400 dark:border-[#3E3A35]">
              <Target size={12} className="inline mr-1" />{cn ? "一级产品类别候选" : "Product Category Candidates"}
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {visibleCategories.map((cat, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full text-[11px] font-medium dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800">
                  {cat}
                  <button onClick={() => handleExcludeCategory(cat)} className="text-indigo-400 hover:text-red-500 cursor-pointer" title={cn ? "排除" : "Exclude"}><X size={12} /></button>
                </span>
              ))}
              {visibleCategories.length === 0 && (
                <span className="text-xs text-gray-400 italic">{cn ? "暂无候选，点击重新分析生成" : "No candidates yet. Click Re-analyze."}</span>
              )}
            </div>
            {excludedCategories.length > 0 && (
              <div className="mb-3 pt-2 border-t border-gray-100 dark:border-[#3E3A35]">
                <span className="text-[9px] text-gray-400 font-mono uppercase block mb-1">{cn ? "已排除 (点击恢复)" : "Excluded (click to restore)"}</span>
                <div className="flex flex-wrap gap-1.5">
                  {excludedCategories.map((cat, i) => (
                    <button key={i} onClick={() => handleAdoptCategory(cat)} className="text-[10px] bg-gray-100 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full line-through hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer dark:bg-[#3E3A35] dark:text-gray-500 dark:hover:text-indigo-400">
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-[#3E3A35]">
              <input type="text" className="flex-1 border border-gray-200 rounded p-1.5 text-[11px] dark:bg-[#22201D] dark:text-gray-200 dark:border-[#3E3A35]" placeholder={cn ? "手动新增类别..." : "Add custom category..."} value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddCustomCategory()} />
              <button onClick={handleAddCustomCategory} className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded text-[11px] font-semibold cursor-pointer flex items-center gap-1"><Plus size={12} />{cn ? "添加" : "Add"}</button>
            </div>
          </div>

          {/* Keywords */}
          <div className="bg-white rounded-xl border border-gray-250 p-5 shadow-sm dark:bg-[#191816] dark:border-[#3E3A35]">
            <h3 className="text-xs font-bold text-gray-500 font-mono uppercase border-b border-gray-100 pb-2 mb-3 dark:text-gray-400 dark:border-[#3E3A35]">
              {cn ? "搜索关键词包" : "Search Keyword Package"}
            </h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {visibleKeywords.map((kw, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-mono dark:bg-[#22201D] dark:text-gray-300 dark:border-[#3E3A35]">
                  {kw}
                  <button onClick={() => handleExcludeKeyword(kw)} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={11} /></button>
                </span>
              ))}
            </div>
            {excludedKeywords.length > 0 && (
              <div className="mb-3 pt-2 border-t border-gray-100 dark:border-[#3E3A35]">
                <span className="text-[9px] text-gray-400 font-mono uppercase block mb-1">{cn ? "已排除" : "Excluded"}</span>
                <div className="flex flex-wrap gap-1">
                  {excludedKeywords.map((kw, i) => (
                    <button key={i} onClick={() => handleAdoptKeyword(kw)} className="text-[9px] bg-gray-100 text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded line-through hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer dark:bg-[#3E3A35]">{kw}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-[#3E3A35]">
              <input type="text" className="flex-1 border border-gray-200 rounded p-1.5 text-[11px] dark:bg-[#22201D] dark:text-gray-200 dark:border-[#3E3A35]" placeholder={cn ? "手动新增关键词..." : "Add custom keyword..."} value={customKeyword} onChange={(e) => setCustomKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddCustomKeyword()} />
              <button onClick={handleAddCustomKeyword} className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded text-[11px] font-semibold cursor-pointer flex items-center gap-1"><Plus size={12} />{cn ? "添加" : "Add"}</button>
            </div>
          </div>

          {/* Pain Expression & Substitute Behavior Layer (R8) */}
          <div className="bg-white rounded-xl border border-gray-250 p-5 shadow-sm dark:bg-[#191816] dark:border-[#3E3A35]">
            <h3 className="text-xs font-bold text-orange-600 font-mono uppercase border-b border-gray-100 pb-2 mb-3 dark:text-orange-400 dark:border-[#3E3A35]">
              {cn ? "痛苦表达 & 替代行为搜索层" : "Pain Expression & Substitute Behavior Layer"}
            </h3>
            <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">
              {cn
                ? "以下查询模拟用户在实际搜索时会使用的自然语言（而非产品描述词汇），用于跨越词汇鸿沟。"
                : "These queries simulate the natural language users ACTUALLY use when searching — bridging the vocabulary gap between product descriptions and user pain language."}
            </p>

            {/* Pain Expression examples */}
            <div className="mb-3">
              <span className="text-[9px] font-bold text-orange-500 font-mono uppercase block mb-2">
                {cn ? "痛苦表达查询 (Pain Expression)" : "Pain Expression Queries"}
              </span>
              <div className="flex flex-wrap gap-1">
                {generatePainExpressionExamples(project.ideaModel).map((q, i) => (
                  <span key={i} className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded text-[10px] font-mono dark:bg-orange-900/10 dark:text-orange-400 dark:border-orange-800">
                    {q}
                  </span>
                ))}
              </div>
            </div>

            {/* Substitute Behavior examples */}
            <div>
              <span className="text-[9px] font-bold text-amber-600 font-mono uppercase block mb-2">
                {cn ? "替代行为查询 (Substitute Behavior)" : "Substitute Behavior Queries"}
              </span>
              <div className="flex flex-wrap gap-1">
                {generateSubstituteBehaviorExamples(project.ideaModel).map((q, i) => (
                  <span key={i} className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-mono dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-800">
                    {q}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Community Vocabulary Discovery (R9) — extracted from round 1 search */}
          {project.vocabSet && (project.vocabSet.painExpressions.length > 0 || project.vocabSet.communityNativeTerms.length > 0) && (
            <div className="bg-white rounded-xl border border-emerald-250 p-5 shadow-sm dark:bg-[#191816] dark:border-emerald-800">
              <h3 className="text-xs font-bold text-emerald-700 font-mono uppercase border-b border-gray-100 pb-2 mb-3 dark:text-emerald-400 dark:border-[#3E3A35]">
                {cn ? "社区原生词汇发现" : "Community Vocabulary Discovery"}
              </h3>
              <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">
                {cn
                  ? "以下词汇和表达方式来自第一轮搜索的真实用户语言，用于跨越词汇鸿沟，生成更精准的第二轮搜索。"
                  : "Terms and expressions below were extracted from real user language in Round 1 search, used to generate more precise Round 2 queries."}
              </p>

              {/* Pain Expressions */}
              {project.vocabSet.painExpressions.length > 0 && (
                <div className="mb-3">
                  <span className="text-[9px] font-bold text-emerald-600 font-mono uppercase block mb-2">
                    {cn ? "发现痛苦表达" : "Discovered Pain Expressions"} ({project.vocabSet.painExpressions.length})
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {project.vocabSet.painExpressions.map((pe, i) => (
                      <span key={i} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-mono dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800">
                        {pe}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Substitute Behaviors */}
              {project.vocabSet.substituteBehaviors.length > 0 && (
                <div className="mb-3">
                  <span className="text-[9px] font-bold text-teal-600 font-mono uppercase block mb-2">
                    {cn ? "发现替代行为" : "Discovered Substitute Behaviors"} ({project.vocabSet.substituteBehaviors.length})
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {project.vocabSet.substituteBehaviors.map((sb, i) => (
                      <span key={i} className="bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded text-[10px] font-mono dark:bg-teal-900/10 dark:text-teal-400 dark:border-teal-800">
                        {sb}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Community Native Terms */}
              {project.vocabSet.communityNativeTerms.length > 0 && (
                <div className="mb-3">
                  <span className="text-[9px] font-bold text-indigo-600 font-mono uppercase block mb-2">
                    {cn ? "社区高频词汇" : "Community Native Terms"} ({project.vocabSet.communityNativeTerms.length})
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {project.vocabSet.communityNativeTerms.slice(0, 20).map((term, i) => (
                      <span key={i} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-mono dark:bg-indigo-900/10 dark:text-indigo-400 dark:border-indigo-800">
                        {term}
                      </span>
                    ))}
                    {project.vocabSet.communityNativeTerms.length > 20 && (
                      <span className="text-[9px] text-gray-400 self-center">
                        +{project.vocabSet.communityNativeTerms.length - 20} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Competitor Context Terms */}
              {project.vocabSet.competitorContextTerms.length > 0 && (
                <div>
                  <span className="text-[9px] font-bold text-violet-600 font-mono uppercase block mb-2">
                    {cn ? "竞品上下文词汇" : "Competitor Context Terms"} ({project.vocabSet.competitorContextTerms.length})
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {project.vocabSet.competitorContextTerms.slice(0, 12).map((ct, i) => (
                      <span key={i} className="bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded text-[10px] font-mono dark:bg-violet-900/10 dark:text-violet-400 dark:border-violet-800">
                        {ct}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Round 2 indicator */}
              {project.researchMode === "deep" && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#3E3A35]">
                  <span className="text-[9px] text-emerald-500 font-bold font-mono uppercase">
                    {cn ? "第二轮精准搜索已使用以上词汇" : "Round 2 precision search used these terms"}
                  </span>
                </div>
              )}
              {project.researchMode === "quick" && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#3E3A35]">
                  <span className="text-[9px] text-amber-500 font-bold font-mono uppercase">
                    {cn ? "快速模式：词汇已提取但未进行第二轮搜索。切换至深度模式可启用。" : "Quick mode: Vocab extracted but Round 2 skipped. Switch to Deep mode to enable."}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Platform Priority Suggestions */}
          {platformPriorities.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-250 p-5 shadow-sm dark:bg-[#191816] dark:border-[#3E3A35]">
              <h3 className="text-xs font-bold text-gray-500 font-mono uppercase border-b border-gray-100 pb-2 mb-3 dark:text-gray-400 dark:border-[#3E3A35]">
                {cn ? "建议平台优先级" : "Suggested Platform Priority"}
              </h3>
              <div className="space-y-2">
                {platformPriorities.map((pp, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded border border-gray-100 bg-slate-50/50 dark:bg-[#22201D] dark:border-[#3E3A35]">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{pp.platform}</span>
                      <span className="text-[9px] text-gray-400 block">{pp.reason}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded dark:bg-indigo-900/20 dark:text-indigo-400">{cn ? "优先级" : "Prio"}: {pp.priority}</span>
                      <button onClick={() => handleAdoptPlatformPriority(pp)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold px-2 py-1 rounded cursor-pointer flex items-center gap-1">
                        <Check size={10} />{cn ? "采纳" : "Adopt"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
