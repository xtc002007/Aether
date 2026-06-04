import React, { useState, useEffect, useRef } from "react";
import { ResearchProject, AppSettings, Strategy } from "../types";
import {
  Compass, Map, ShieldCheck, ShieldAlert, Sparkles,
  CornerDownRight, CheckSquare, Dumbbell, Star, MessageSquare, Loader2
} from "lucide-react";

interface StrategyViewProps {
  project: ResearchProject;
  settings: AppSettings;
  onSwitchMode?: (mode: string) => void;
  isLoading?: boolean;
}

const STRATEGY_MODES = [
  { id: "conservative", labelCn: "保守切入", labelEn: "Conservative Entry",
    descCn: "控制风险，优先低成本验证", descEn: "Min risk, validate first" },
  { id: "aggressive", labelCn: "激进切入", labelEn: "Aggressive Entry",
    descCn: "快速占领市场，高举高打", descEn: "Move fast, capture market" },
  { id: "low_cost_first", labelCn: "低成本验证优先", labelEn: "Low-Cost Validation",
    descCn: "用最小资源验证核心假设", descEn: "Min resources to prove core hypothesis" },
  { id: "high_diff", labelCn: "高差异化优先", labelEn: "High Differentiation",
    descCn: "瞄准竞品最薄弱环节猛攻", descEn: "Attack weakest competitor points" },
];

export default function StrategyView({
  project,
  settings,
  onSwitchMode,
  isLoading
}: StrategyViewProps) {
  const cn = settings.language === "zh";
  const [activeMode, setActiveMode] = useState<string>("conservative");
  const [previousStrategy, setPreviousStrategy] = useState<Strategy | null>(null);
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const wasLoading = useRef(false);

  // Detect when re_evaluate completes: compare old vs new strategy
  useEffect(() => {
    if (wasLoading.current && !isLoading && previousStrategy) {
      const changed = new Set<string>();
      const s = project.strategy;
      const p = previousStrategy;
      if (s.marketScenario !== p.marketScenario) changed.add("marketScenario");
      if (s.suggestedPath !== p.suggestedPath) changed.add("suggestedPath");
      if (s.positioningStatement !== p.positioningStatement) changed.add("positioningStatement");
      if (JSON.stringify(s.mustHaveFeatures) !== JSON.stringify(p.mustHaveFeatures)) changed.add("mustHaveFeatures");
      if (JSON.stringify(s.avoidFeatures) !== JSON.stringify(p.avoidFeatures)) changed.add("avoidFeatures");
      if (s.offensiveTactics !== p.offensiveTactics) changed.add("offensiveTactics");
      setChangedFields(changed);
      if (changed.size > 0) {
        setTimeout(() => setChangedFields(new Set()), 4000);
      }
    }
    wasLoading.current = !!isLoading;
  }, [isLoading]);

  const handleModeSwitch = (mode: string) => {
    setActiveMode(mode);
    setPreviousStrategy({ ...project.strategy });
    setChangedFields(new Set());
    if (onSwitchMode) onSwitchMode(mode);
  };

  const diffClass = (field: string): string =>
    changedFields.has(field) ? "ring-2 ring-amber-400 bg-amber-50/30 animate-pulse" : "";

  const diffLabel = (field: string) =>
    changedFields.has(field) ? (
      <span className="text-[9px] text-amber-700 bg-amber-100 px-1 py-0.5 rounded font-mono ml-2 animate-fade-in">
        {cn ? "已更新" : "UPDATED"}
      </span>
    ) : null;

  return (
    <div className="space-y-6 animate-fade-in p-1 text-left">
      {/* Strategy Mode Switcher */}
      <div className="bg-white rounded-xl border border-gray-250 p-4 shadow-sm">
        <div className="flex items-center gap-2 pb-2 mb-3 border-b border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 font-mono uppercase tracking-widest">
            {cn ? "切入模式" : "ENTRY MODE"}
          </span>
          {isLoading && (
            <Loader2 size={12} className="animate-spin text-indigo-500" />
          )}
          {!isLoading && changedFields.size > 0 && (
            <span className="text-[9px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-mono animate-fade-in ml-auto">
              {cn ? `${changedFields.size} 项策略已更新` : `${changedFields.size} fields updated`}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {STRATEGY_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleModeSwitch(mode.id)}
              className={`p-3 rounded-lg border text-left transition duration-150 cursor-pointer ${
                activeMode === mode.id
                  ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="text-xs font-bold text-gray-800">
                {cn ? mode.labelCn : mode.labelEn}
              </div>
              <div className="text-[9px] text-gray-400 mt-0.5 leading-relaxed">
                {cn ? mode.descCn : mode.descEn}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Upper strategic indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-indigo-700">
            <Compass size={18} />
            <h3 className="font-bold text-gray-900 text-sm font-mono uppercase">
              {cn ? "市场竞争格局判定" : "Market Scenario Categorizer"}
            </h3>
          </div>
          <div className={`bg-indigo-50/50 p-4 rounded-lg border border-indigo-100/60 font-sans font-semibold text-indigo-950 text-sm transition-all duration-500 ${diffClass("marketScenario")}`}>
            {diffLabel("marketScenario")}
            {project.strategy.marketScenario}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            {cn 
              ? "系统挖掘全网公开竞品对标声音，判定该想法是否处于拥挤的红海、细分的功能真空区、还是痛点极度集中的差评爆发期。"
              : "Derived by calculating competitor counts and thematic cluster weights to find competitive safehavens."}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-indigo-700">
            <Map size={18} />
            <h3 className="font-bold text-gray-900 text-sm font-mono uppercase">
              {cn ? "推荐的最佳切入路径" : "Recommended Entering Lane"}
            </h3>
          </div>
          <div className={`bg-emerald-50/50 p-4 rounded-lg border border-emerald-100/60 font-sans font-bold text-emerald-950 text-sm transition-all duration-500 ${diffClass("suggestedPath")}`}>
            {diffLabel("suggestedPath")}
            🚀 {project.strategy.suggestedPath}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            {cn 
              ? "不建议和大厂正面拼全量功能，推荐采用『单点特化突破』、『细密人群深耕』或『买断制垂直降维』切入。"
              : "Recommends micro specialization tactics or alternative payment schemas to easily pull clients away."}
          </p>
        </div>
      </div>

      {/* Positioning Statements generator */}
      <div className="bg-gradient-to-r from-indigo-950 to-slate-900 rounded-2xl p-8 border border-gray-800 text-white shadow-lg space-y-4 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-12 translate-y-6">
          <Compass size={180} />
        </div>
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
            <Sparkles size={10} />
            {cn ? "产品核心定位标签纸" : "Value Pitch Label"}
          </div>
          <h3 className="text-base font-mono font-bold text-gray-300">
            {cn ? "一句话产品商业定位 (Value Pitch Sentence)" : "Core Positioning Statement"}
          </h3>
          <p className={`text-lg md:text-xl font-sans tracking-tight font-semibold leading-relaxed text-indigo-100 transition-all duration-500 ${diffClass("positioningStatement")}`}>
            {diffLabel("positioningStatement")}
            {project.strategy.positioningStatement}
          </p>
          <p className="text-[11px] text-gray-400 font-sans leading-relaxed pt-2">
            {cn 
              ? "提示：定位是一切行动蓝图的母亲。每次增加次要交互，请反复对照该标签检查自己是否偏离了『为特定人群干翻一个痛点』的初始主轴。"
              : "Tip: The core positioning keeps features aligned. Avoid adding unrequested modules that distract focus."}
          </p>
        </div>
      </div>

      {/* Lists of features to construct vs avoid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Must-have lists */}
        <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-1.5 text-emerald-700 border-b border-gray-100 pb-3">
            <ShieldCheck size={18} />
            <h3 className="font-bold text-gray-900 text-sm font-mono uppercase">
              {cn ? "MVP 拟定最优先研发的特性" : "First Priority (Must-Have)"}
            </h3>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed font-sans">
            {cn 
              ? "首个验证版本【绝对不可脱离】的骨架功能。专注于彻底根除那一个核心痛点，抛弃铺张性垫板。"
              : "Skeleton features to achieve. Zero fluff, fully devoted to verifying if people pay for the basic pipeline."}
          </p>
          <div className="space-y-2.5 pt-2">
            {changedFields.has("mustHaveFeatures") && (
              <span className="text-[9px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-mono animate-fade-in inline-block">
                {cn ? "已更新" : "UPDATED"}
              </span>
            )}
            {project.strategy.mustHaveFeatures.map((feat, idx) => (
              <div key={idx} className={`flex items-start gap-2.5 text-xs text-gray-700 p-1 rounded transition-all duration-300 ${changedFields.has("mustHaveFeatures") ? "bg-amber-50/50" : ""}`}>
                <CornerDownRight size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                <span className="font-sans font-medium leading-relaxed">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Prohibited lists */}
        <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-1.5 text-rose-700 border-b border-gray-100 pb-3">
            <ShieldAlert size={18} />
            <h3 className="font-bold text-gray-900 text-sm font-mono uppercase">
              {cn ? "坚决禁止/延期研发的特性" : "Defer or Prohibit (Avoid)"}
            </h3>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed font-sans">
            {cn 
              ? "【强力不建议】在验证初期浪费精力的功能，包括复杂的角色权限、甘特看板、或者社交大盘。大而全等同于失败。"
              : "Blockades to prevent scope fatigue. Avoid multi-user permissions or complex settings setups early."}
          </p>
          <div className="space-y-2.5 pt-2">
            {changedFields.has("avoidFeatures") && (
              <span className="text-[9px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-mono animate-fade-in inline-block">
                {cn ? "已更新" : "UPDATED"}
              </span>
            )}
            {project.strategy.avoidFeatures.map((feat, idx) => (
              <div key={idx} className={`flex items-start gap-2.5 text-xs text-gray-700 p-1 rounded transition-all duration-300 ${changedFields.has("avoidFeatures") ? "bg-amber-50/50" : ""}`}>
                <ShieldAlert size={12} className="text-rose-500 shrink-0 mt-0.5" />
                <span className="font-sans font-medium leading-relaxed text-gray-600 line-through decoration-rose-300">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Offensive Distribution Tactics */}
      <div className="bg-slate-50 border border-gray-200 rounded-xl p-6 shadow-sm space-y-3">
        <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
          <Compass size={16} className="text-gray-600" />
          {cn ? "对标主渠道的分发突破手段 (Tactics)" : "Outbound Marketing Breakthrough Tactics"}
          {diffLabel("offensiveTactics")}
        </h4>
        <p className={`text-xs text-gray-700 leading-relaxed whitespace-pre-line font-sans rounded p-2 transition-all duration-500 ${diffClass("offensiveTactics")}`}>
          {project.strategy.offensiveTactics}
        </p>
      </div>
    </div>
  );
}
