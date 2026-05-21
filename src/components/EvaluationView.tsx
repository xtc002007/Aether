import React, { useState } from "react";
import { ResearchProject, AppSettings, DimensionScore } from "../types";
import { 
  BarChart3, BrainCircuit, Activity, ShieldAlert, Zap, 
  HelpCircle, Sliders, RefreshCw, Loader2, Award, AlertTriangle 
} from "lucide-react";

interface EvaluationViewProps {
  project: ResearchProject;
  settings: AppSettings;
  onUpdateProject: (updated: ResearchProject) => void;
  onReevaluate: () => Promise<void>;
  isLoading: boolean;
}

export default function EvaluationView({
  project,
  settings,
  onUpdateProject,
  onReevaluate,
  isLoading
}: EvaluationViewProps) {
  const [selectedDimName, setSelectedDimName] = useState<string>("需求强度");
  const cn = settings.language === "zh";

  // Dimension details translation mapping
  const dimDescriptions: { [key: string]: string } = {
    "需求强度": cn 
      ? "指目标用户针对此痛点的主求助频率以及替代欲望。分数越高说明全网讨论、询问该核心痛点的人群规模越庞大、主动搜索指数越高。" 
      : "The active frequency with which targeted users seek solutions blockades on forums.",
    "痛点强度": cn 
      ? "当前痛点的痛苦严重度。低分说明只是无关紧要的小毛病用Excel就能打发，高分说明由于麻烦产生的金钱或效率损失极其巨大、属于高危高痛点。" 
      : "User suffering level. High points imply drastic loss of speed or costs, which users desperately need resolved.",
    "市场拥挤度": cn 
      ? "该赛道竞争对手的饱和度及头部玩家集中垄断度。低分代表基本是荒漠或存在显而易见的巨兽盲区，高分代表市场已经极度拥挤、获客昂贵。" 
      : "Competition congestion density. Lower points imply direct blank spaces, while higher scores indicate crowded keywords.",
    "差异化空间": cn 
      ? "能否避开头部大厂的核心长处，找到尚未被关照的垂直群体或极简化定位。分数越高证明大厂越不情愿或由于架构问题做不了该差异点。" 
      : "Available gaps. High scores indicate incumbents have system limitations preventing them from entering single-focus needs.",
    "用户不满密度": cn 
      ? "全网差评中抱怨点的统一性和声讨烈度。如果用户对竞品的卡死、昂贵等毛病极其一致、强烈且普遍地写差评，本项将报极高分数。" 
      : "Frequency and uniformity of poor stars. A high index means users are universally crying about high fees or bloated speeds.",
    "趋势方向": cn 
      ? "该赛道在搜索引擎和社交谈资中的动量。高分说明属于朝阳的、高密度涌现新机会的成长流，低分说明相关问答和检索开始下行委顿。" 
      : "Traffic search index and momentum on Google Search/social platforms.",
    "商业化可行性": cn 
      ? "用户掏掏腰包付真金白银的爽快度。像生产力相关的找漏插件、健身手表往往具有天然直接的现金支付场景，可快速实现营收平衡。" 
      : "Willingness to buy. Core B2B workflows or vertical utility tools feature straightforward transaction intents.",
    "进入门槛": cn 
      ? "产品实现所需的技术、资源或合规复杂度。分值越高代表开发壁垒深（不容易被他人第二天仿制抄袭），低分代表极易被模仿复制损耗利润。" 
      : "Development or legal entry complexity barrier. High values secure proprietary code advantage against fast copycats.",
    "MVP 可验证性": cn 
      ? "能否在一周内构建简短的一键转化落地页或 TestFlight，测试用户购买漏斗。分数越高说明该想法核心命题的测试路径越便利、成本越低。" 
      : "Easiness to launch lightweight Landing Pages or quick newsletter tests under 1-2 weeks."
  };

  // Keep chosen dimension aligned with English mapping if changed
  const getSelectedDimTranslation = (name: string) => {
    if (cn) return name;
    const map: { [key: string]: string } = {
      "需求强度": "Demand Strength",
      "痛点强度": "Pain Severity",
      "市场拥挤度": "Market Congestion",
      "差异化空间": "Differentiation Space",
      "用户不满密度": "Dissatisfaction Density",
      "趋势方向": "Trend Direction",
      "商业化可行性": "Commercial Viability",
      "进入门槛": "Entry Barriers",
      "MVP 可验证性": "MVP Verifiability"
    };
    return map[name] || name;
  };

  const selectedDim = project.evaluation.dimensions.find(
    d => d.name === selectedDimName || d.name.includes(selectedDimName.slice(0, 2))
  ) || project.evaluation.dimensions[0];

  const handleSliderChange = (dimName: string, value: number) => {
    const updatedDims = project.evaluation.dimensions.map(dim => {
      // Allow partial match for safety
      if (dim.name === dimName || dim.name.includes(dimName.slice(0, 2))) {
        return {
          ...dim,
          score: value,
          reason: cn ? `${dim.reason} (用户手动调校数值)` : `${dim.reason} (User manually adjusted value on workstation)`
        };
      }
      return dim;
    });

    onUpdateProject({
      ...project,
      evaluation: {
        ...project.evaluation,
        dimensions: updatedDims
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in p-1">
      {/* Upper overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recommendation card */}
        <div className="bg-white rounded-xl border border-gray-250 p-6 text-left shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-indigo-950">
            <Award size={100} />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase text-gray-400 block tracking-tight">
              {cn ? "总研判结论建议" : "Verdict Consensus"}
            </span>
            <div className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-2">
              {project.evaluation.overallRecommendation}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed font-sans">
              {cn 
                ? "基于大模型引擎评估，融合全网抓取到的竞品不满密集度，以及您设置的加权分配对数据做出如上推荐路线判定。"
                : "Consensus generated by parsing actual G2 negative ratings averages and user voice friction vectors."}
            </p>
          </div>
        </div>

        {/* Confidence rating */}
        <div className="bg-white rounded-xl border border-gray-250 p-6 text-left shadow-sm relative">
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase text-gray-400 block tracking-tight">
              {cn ? "模型置信度得分" : "Dossier Confidence Score"}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-sans font-bold text-indigo-600">
                {project.evaluation.confidenceScore}
              </span>
              <span className="text-sm font-sans font-medium text-gray-500">%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-2">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-300" 
                style={{ width: `${project.evaluation.confidenceScore}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 font-mono mt-1">
              {cn 
                ? `证据网络：${project.searchTasks.filter(t => t.status === "success").length}个渠道全绿成功，回收文献一致性显著。`
                : `Evidence trust: consistent matching signals recovered from active database crawlers.`}
            </p>
          </div>
        </div>

        {/* Sync panel weights */}
        <div className="bg-indigo-950 text-white rounded-xl border border-gray-800 p-6 text-left shadow-md flex flex-col justify-between">
          <div className="space-y-1">
            <h4 className="font-bold text-sm tracking-tight flex items-center gap-1.5 text-indigo-100">
              <BrainCircuit size={16} />
              {cn ? "动态证据链加权调校" : "Dynamic Calibrate Command"}
            </h4>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              {cn 
                ? "当您改变左侧维度的滑块分值、或更改平台优先级，可点击此键：命令模型重新进行切入策略生成和验证路径生成。"
                : "Altering slider evaluation ranks? Tap the recalculate action. The server prompts the model to redesign strategic funnels."}
            </p>
          </div>

          <button
            onClick={onReevaluate}
            disabled={isLoading}
            className="w-full mt-4 bg-indigo-600 hover:bg-slate-100 hover:text-indigo-950 hover:border-slate-100 text-white border border-indigo-500 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {cn ? "大模型深度校真中..." : "Re-bundling matrix data..."}
              </>
            ) : (
              <>
                <RefreshCw size={12} />
                {cn ? "重新计算并生成切入战略" : "Recalculate & Align Strategy"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main layout Matrix sliders & justification detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Silders Matrix */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-250 p-6 text-left shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Sliders size={16} className="text-gray-600" />
              {cn ? "九维核心价值度量矩阵" : "9-Dimensional Value Ranks"}
            </h3>
            <span className="text-[10px] text-gray-400 font-mono font-medium">
              {cn ? "刻度：1 (极低) 至 10 (极高)" : "Range: 1 (min) to 10 (max)"}
            </span>
          </div>

          <div className="space-y-4">
            {project.evaluation.dimensions.map((dim) => {
              const isSelected = selectedDim?.name === dim.name || dim.name.includes(selectedDimName.slice(0, 2));
              return (
                <div 
                  key={dim.name}
                  onClick={() => setSelectedDimName(dim.name)}
                  className={`p-3 rounded-lg border transition duration-150 cursor-pointer ${
                    isSelected ? "border-indigo-200 bg-slate-50/50" : "border-gray-50 hover:bg-gray-50/30"
                  }`}
                >
                  <div className="flex items-center justify-between pointer-events-none pb-1.5">
                    <span className="text-xs font-bold text-gray-800 font-mono">
                      {getSelectedDimTranslation(dim.name)}
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {dim.score} / 10
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={dim.score}
                      onChange={(e) => handleSliderChange(dim.name, parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Justification details cards */}
        {selectedDim && (
          <div className="space-y-4 text-left">
            <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                  <Activity size={10} />
                  {cn ? "维度解释及依据" : "Audit Justification"}
                </span>
                <h3 className="font-bold text-gray-900 text-base">
                  {getSelectedDimTranslation(selectedDim.name)}
                </h3>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed border-b border-gray-100 pb-3">
                {dimDescriptions[selectedDim.name] || dimDescriptions["需求强度"]}
              </p>

              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase text-gray-400 block tracking-tight">
                  {cn ? "文献事实提取说服力证据" : "Telemetry Supporting Evidence"}
                </span>
                <p className="text-xs text-gray-800 font-sans leading-relaxed italic bg-amber-50/40 p-3 rounded border border-amber-100 inline-block w-full">
                  "{selectedDim.reason}"
                </p>
              </div>
            </div>

            {/* Opportunities & Risks bullet Summary */}
            <div className="bg-slate-50 rounded-xl p-5 border border-gray-200 space-y-4">
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
                    <Zap size={10} />
                    {cn ? "调研锁定的主要机会" : "Research Identified Opportunities"}
                  </span>
                  <div className="text-gray-700 font-sans pl-1 whitespace-pre-line leading-relaxed">
                    {project.evaluation.keyOpportunities}
                  </div>
                </div>

                <div className="space-y-1 border-t border-gray-200 mt-3 pt-3">
                  <span className="font-mono font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
                    <ShieldAlert size={10} />
                    {cn ? "模型监测提示的核心阻碍" : "Telemetry Flagged Risks"}
                  </span>
                  <div className="text-gray-700 font-sans pl-1 whitespace-pre-line leading-relaxed">
                    {project.evaluation.keyRisks}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
