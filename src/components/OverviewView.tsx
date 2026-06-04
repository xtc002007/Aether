import React from "react";
import { ResearchProject, AppSettings } from "../types";
import {
  Download, ChevronRight, Layout, Building2, MessageSquare,
  Sliders, CheckSquare, RefreshCw, Radio, Search, Sparkles
} from "lucide-react";

interface OverviewViewProps {
  project: ResearchProject;
  settings: AppSettings;
  onNavigate: (tab: string) => void;
  onExport: () => void;
  onReSearch?: () => void;
  isReSearching?: boolean;
  reSearchProgress?: number;
  reSearchStage?: string;
  reSearchMessage?: string;
}

export default function OverviewView({ project, settings, onNavigate, onExport, onReSearch, isReSearching, reSearchProgress, reSearchStage, reSearchMessage }: OverviewViewProps) {
  const cn = settings.language === "zh";

  const successTasks = project.searchTasks.filter(t => t.status === "success").length;
  const totalTasks = project.searchTasks.length;

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Top Summary Bar */}
      <div className="bg-white border border-[#E5E2DE] p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 dark:bg-[#191816] dark:border-[#3E3A35]">
        <div className="space-y-2">
          <div className="text-[10px] font-mono font-bold uppercase text-[#8C8882] tracking-widest">
            {cn ? "当前研究项目" : "Active Research Project"}
          </div>
          <h2 className="text-3xl font-serif italic font-bold text-[#1C1C1C] dark:text-white">
            {project.name}
          </h2>
          <div className="flex items-center gap-4 text-xs text-[#5C5852] dark:text-[#8C8882]">
            <span>
              {cn ? "最后更新" : "Last updated"}: {project.updatedAt}
            </span>
            {totalTasks > 0 && (
              <span className={successTasks === totalTasks ? "text-emerald-600" : "text-amber-600"}>
                {cn ? `搜索: ${successTasks}/${totalTasks} 完成` : `Search: ${successTasks}/${totalTasks} done`}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => onNavigate("evaluation")}
            className="bg-[#1C1C1C] hover:bg-black text-white px-4 py-2.5 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 transition cursor-pointer dark:bg-white dark:text-black">
            <RefreshCw size={12} />
            {cn ? "重新评估" : "Re-evaluate"}
          </button>
          <button onClick={onExport}
            className="bg-white hover:bg-[#F9F8F6] border border-[#E5E2DE] px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 transition cursor-pointer dark:bg-[#22201D] dark:text-white dark:border-[#3E3A35]">
            <Download size={12} />
            {cn ? "导出报告" : "Export Report"}
          </button>
        </div>
      </div>

      {/* Re-search Progress Bar */}
      {isReSearching && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 space-y-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <RefreshCw size={18} className="animate-spin text-indigo-600" />
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-bold text-indigo-900 font-serif italic">
                {cn ? "正在重新全网采集与分析..." : "Re-scanning platforms & re-analyzing..."}
              </h3>
              <p className="text-xs text-indigo-600 font-mono">
                {reSearchStage || (cn ? "准备中..." : "Preparing...")}
              </p>
            </div>
            <span className="text-2xl font-bold text-indigo-700 font-mono">{reSearchProgress || 0}%</span>
          </div>
          <div className="w-full bg-indigo-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${reSearchProgress || 0}%` }}
            />
          </div>
          {reSearchMessage && (
            <p className="text-[10px] text-indigo-500 font-mono">{reSearchMessage}</p>
          )}
        </div>
      )}

      {/* Three Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Verdict Card */}
        <div className="bg-black text-white border border-black p-8 flex flex-col justify-between dark:bg-[#22201D] dark:border-[#3E3A35]">
          <div className="space-y-3">
            <span className="text-[10px] font-mono font-bold text-[#8C8882] tracking-widest block uppercase">
              {cn ? "总研判结论" : "Verdict"}
            </span>
            <h3 className="text-xl font-serif italic font-medium leading-snug">
              {project.evaluation.overallRecommendation || (cn ? "待分析" : "Pending analysis")}
            </h3>
            <div className="flex items-center gap-2 pt-2">
              <div className="text-2xl font-bold">{project.evaluation.confidenceScore}%</div>
              <div className="text-[10px] text-gray-400">{cn ? "置信度" : "confidence"}</div>
            </div>
          </div>
          <div className="pt-4 border-t border-white/20 mt-6 text-[11px] leading-relaxed font-sans italic text-gray-350">
            {project.evaluation.uncertaintyNote}
          </div>
        </div>

        {/* Key Opportunities */}
        <div className="bg-white border border-[#E5E2DE] p-8 space-y-4 dark:bg-[#191816] dark:border-[#3E3A35]">
          <h4 className="font-mono font-bold text-[10px] text-[#1C1C1C] bg-[#F9F8F6] uppercase tracking-widest px-2.5 py-1 w-fit border border-[#E5E2DE] dark:bg-[#22201D] dark:text-white dark:border-[#3E3A35]">
            {cn ? "最大机会点" : "Key Opportunities"}
          </h4>
          <div className="text-xs text-[#5C5852] dark:text-[#8C8882] leading-relaxed whitespace-pre-line font-sans">
            {project.evaluation.keyOpportunities || (cn ? "暂无数据" : "No data yet")}
          </div>
        </div>

        {/* Key Risks */}
        <div className="bg-white border border-[#E5E2DE] p-8 space-y-4 dark:bg-[#191816] dark:border-[#3E3A35]">
          <h4 className="font-mono font-bold text-[10px] text-[#1C1C1C] bg-[#F9F8F6] uppercase tracking-widest px-2.5 py-1 w-fit border border-[#E5E2DE] dark:bg-[#22201D] dark:text-white dark:border-[#3E3A35]">
            {cn ? "最大隐患点" : "Key Risks"}
          </h4>
          <div className="text-xs text-[#5C5852] dark:text-[#8C8882] leading-relaxed whitespace-pre-line font-sans">
            {project.evaluation.keyRisks || (cn ? "暂无数据" : "No data yet")}
          </div>
        </div>
      </div>

      {/* Middle: Research Object + Progress + Conclusions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Research Object Card */}
        <div className="bg-white border border-[#E5E2DE] p-6 space-y-3 dark:bg-[#191816] dark:border-[#3E3A35]">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E5E2DE]">
            <Layout size={14} className="text-[#8C8882]" />
            <span className="text-[10px] font-bold font-mono uppercase text-[#8C8882] tracking-widest">
              {cn ? "研究对象卡" : "Research Object"}
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[#8C8882] text-[10px] font-mono">{cn ? "想法原文" : "Idea"}：</span>
              <p className="text-[#1C1C1C] dark:text-white mt-0.5">{project.ideaModel.statement}</p>
            </div>
            <div>
              <span className="text-[#8C8882] text-[10px] font-mono">{cn ? "目标用户" : "Target Users"}：</span>
              <p className="text-[#1C1C1C] dark:text-white mt-0.5">{project.ideaModel.targetUser || (cn ? "待定" : "TBD")}</p>
            </div>
            <div>
              <span className="text-[#8C8882] text-[10px] font-mono">{cn ? "核心任务" : "Core JTBD"}：</span>
              <p className="text-[#1C1C1C] dark:text-white mt-0.5">{project.ideaModel.coreJob || (cn ? "待定" : "TBD")}</p>
            </div>
            <div>
              <span className="text-[#8C8882] text-[10px] font-mono">{cn ? "产品形态" : "Product Form"}：</span>
              <span className="ml-1 bg-[#F9F8F6] border border-[#E5E2DE] px-1.5 py-0.5 text-[10px] font-mono dark:bg-[#22201D] dark:border-[#3E3A35]">{project.ideaModel.productForm}</span>
            </div>
          </div>
        </div>

        {/* Progress Card */}
        <div className="bg-white border border-[#E5E2DE] p-6 space-y-3 dark:bg-[#191816] dark:border-[#3E3A35]">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E5E2DE]">
            <Radio size={14} className="text-[#8C8882]" />
            <span className="text-[10px] font-bold font-mono uppercase text-[#8C8882] tracking-widest">
              {cn ? "研究进度卡" : "Research Progress"}
            </span>
          </div>
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-[#8C8882]">{cn ? "已启用平台" : "Platforms enabled"}</span>
              <span className="font-bold">{project.enabledPlatforms.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8C8882]">{cn ? "已完成查询" : "Queries done"}</span>
              <span className="font-bold">{successTasks}/{totalTasks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8C8882]">{cn ? "已识别竞品" : "Competitors found"}</span>
              <span className="font-bold">{project.competitors.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8C8882]">{cn ? "已抓取反馈" : "Voices captured"}</span>
              <span className="font-bold">{project.userVoices.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8C8882]">{cn ? "已抽取信号" : "Signals extracted"}</span>
              <span className="font-bold">{project.signals.length}</span>
            </div>
          </div>
        </div>

        {/* Core Conclusions Card */}
        <div className="bg-white border border-[#E5E2DE] p-6 space-y-3 dark:bg-[#191816] dark:border-[#3E3A35]">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E5E2DE]">
            <Building2 size={14} className="text-[#8C8882]" />
            <span className="text-[10px] font-bold font-mono uppercase text-[#8C8882] tracking-widest">
              {cn ? "核心结论卡" : "Key Findings"}
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-emerald-600 font-bold text-[10px] font-mono">{cn ? "最大机会" : "Top Opportunity"}:</span>
              <p className="dark:text-white mt-0.5 leading-relaxed line-clamp-2">
                {project.evaluation.keyOpportunities || "-"}
              </p>
            </div>
            <div>
              <span className="text-rose-600 font-bold text-[10px] font-mono">{cn ? "最大风险" : "Top Risk"}:</span>
              <p className="dark:text-white mt-0.5 leading-relaxed line-clamp-2">
                {project.evaluation.keyRisks || "-"}
              </p>
            </div>
            {project.topicClusters && project.topicClusters.length > 0 && (
              <div>
                <span className="text-amber-600 font-bold text-[10px] font-mono">{cn ? "最高频不满主题" : "Top Frustration"}:</span>
                <p className="dark:text-white mt-0.5">
                  #{project.topicClusters[0]?.name} ({project.topicClusters[0]?.negativeCount} {cn ? "条抱怨" : "complaints"})
                </p>
              </div>
            )}
            <div>
              <span className="text-indigo-600 font-bold text-[10px] font-mono">{cn ? "建议切入方向" : "Suggested Path"}:</span>
              <p className="dark:text-white mt-0.5 leading-relaxed line-clamp-2">
                {project.strategy.suggestedPath || "-"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Next Actions */}
      <div className="bg-white border border-[#E5E2DE] p-6 space-y-4 dark:bg-[#191816] dark:border-[#3E3A35]">
        <div className="flex items-center gap-2 pb-3 border-b border-[#E5E2DE]">
          <Sparkles size={14} className="text-[#8C8882]" />
          <span className="text-[10px] font-bold font-mono uppercase text-[#8C8882] tracking-widest">
            {cn ? "下一步动作区" : "Next Actions"}
          </span>
        </div>

        {/* Iterative Re-search Guide */}
        {onReSearch && (
          <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Search size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <h4 className="text-sm font-bold text-amber-900 font-serif italic">
                  {cn ? "精化研究 — 基于当前发现重新搜索" : "Refine Research — Re-search with updated constraints"}
                </h4>
                <p className="text-xs text-amber-700 leading-relaxed">
                  {cn
                    ? "您已在想法建模页排除了部分关键词、调整了类别或目标用户。点击下方按钮，系统将带上您修正后的排除条件、用户信息与地区语言设置，重新采集各平台数据并刷新 9 维评估与策略建议。"
                    : "You've excluded keywords, adjusted categories, or refined target users in Idea Modeling. Click below to re-run the full pipeline with your updated constraints — re-collecting platform data and refreshing the 9-dimension evaluation and strategy."}
                </p>
                {project.ideaModel.excludedKeywords.length > 0 && (
                  <div className="text-[10px] text-amber-600 font-mono pt-1">
                    {cn ? "当前排除关键词" : "Currently excluded keywords"}: {project.ideaModel.excludedKeywords.join(", ")}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={onReSearch}
                disabled={isReSearching}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2.5 text-xs font-bold rounded-lg flex items-center gap-2 transition cursor-pointer"
              >
                {isReSearching ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Search size={12} />
                )}
                {cn ? "修正后重新全网搜索" : "Re-scan with Corrections"}
              </button>
              <button
                onClick={() => onNavigate("modeling")}
                className="bg-white hover:bg-slate-50 border border-amber-300 text-amber-800 px-4 py-2.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer"
              >
                {cn ? "先查看当前建模约束" : "Review current constraints"}
                <ChevronRight size={10} />
              </button>
            </div>
          </div>
        )}

        {/* Quick-jump grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {[
            { label: cn ? "竞品池" : "Competitors", value: project.competitors.length, tab: "competitors", icon: Building2 },
            { label: cn ? "用户声音" : "User Voices", value: project.userVoices.length, tab: "voices", icon: MessageSquare },
            { label: cn ? "九维评估" : "Assessment", value: `${project.evaluation.confidenceScore}%`, tab: "evaluation", icon: Sliders },
            { label: cn ? "验证计划" : "Validation", value: project.validationPlan.length, tab: "validation", icon: CheckSquare },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <button
                key={i}
                onClick={() => onNavigate(stat.tab)}
                className="bg-[#F9F8F6] border border-[#E5E2DE] hover:border-black cursor-pointer p-5 transition-all flex items-center justify-between text-left dark:bg-[#22201D] dark:border-[#3E3A35] dark:hover:border-white"
              >
                <div className="space-y-2">
                  <Icon size={14} className="text-[#8C8882]" />
                  <div className="text-[9px] text-[#8C8882] font-mono font-bold uppercase tracking-widest">{stat.label}</div>
                  <div className="text-2xl font-serif italic font-bold text-[#1C1C1C] dark:text-white">{stat.value}</div>
                </div>
                <ChevronRight size={14} className="text-[#8C8882]" />
              </button>
            );
          })}
        </div>

        {/* Additional hint text */}
        <p className="text-[10px] text-[#8C8882] font-sans leading-relaxed pt-1">
          {cn
            ? "提示：研究不是一次性动作。看到初步结果后，可回到「想法建模」页排除误判类别/关键词，再回来点击「修正后重新搜索」进行迭代精化。"
            : "Tip: Research is iterative. Go back to Idea Modeling to exclude miscategorized items, then re-scan here with refined constraints."}
        </p>
      </div>
    </div>
  );
}
