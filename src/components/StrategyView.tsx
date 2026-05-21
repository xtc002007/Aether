import React from "react";
import { ResearchProject, AppSettings } from "../types";
import { 
  Compass, Map, ShieldCheck, ShieldAlert, Sparkles, 
  CornerDownRight, CheckSquare, Dumbbell, Star, MessageSquare 
} from "lucide-react";

interface StrategyViewProps {
  project: ResearchProject;
  settings: AppSettings;
}

export default function StrategyView({
  project,
  settings
}: StrategyViewProps) {
  const cn = settings.language === "zh";

  return (
    <div className="space-y-6 animate-fade-in p-1 text-left">
      {/* Upper strategic indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-indigo-700">
            <Compass size={18} />
            <h3 className="font-bold text-gray-900 text-sm font-mono uppercase">
              {cn ? "市场竞争格局判定" : "Market Scenario Categorizer"}
            </h3>
          </div>
          <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100/60 font-sans font-semibold text-indigo-950 text-sm">
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
          <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100/60 font-sans font-bold text-emerald-950 text-sm">
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
          <p className="text-lg md:text-xl font-sans tracking-tight font-semibold leading-relaxed text-indigo-100">
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
            {project.strategy.mustHaveFeatures.map((feat, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-700">
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
            {project.strategy.avoidFeatures.map((feat, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-700">
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
        </h4>
        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line font-sans">
          {project.strategy.offensiveTactics}
        </p>
      </div>
    </div>
  );
}
