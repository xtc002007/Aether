import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ResearchProject, AppSettings, SerializedProject } from "../types";
import { Layers, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

interface CompareViewProps {
  settings: AppSettings;
  onSelectProject: (id: string) => void;
}

export default function CompareView({ settings, onSelectProject }: CompareViewProps) {
  const [allProjects, setAllProjects] = useState<ResearchProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const cn = settings.language === "zh";

  useEffect(() => {
    (async () => {
      try {
        const summaries = await invoke<SerializedProject[]>("get_projects").catch(() => []);
        const fullProjects: ResearchProject[] = [];
        for (const s of summaries) {
          try {
            const raw = await invoke<ResearchProject>("get_project", { projectId: s.id });
            fullProjects.push(raw);
          } catch { /* skip */ }
        }
        setAllProjects(fullProjects);
        if (fullProjects.length >= 2) {
          setSelectedIds([fullProjects[0].id, fullProjects[1].id]);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const toggleProject = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const selectedProjects = allProjects.filter(p => selectedIds.includes(p.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin w-8 h-8 border-2 border-black border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in p-1 text-left">
      {/* Project Selector */}
      <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-4 border-b border-gray-100 mb-4">
          <Layers size={18} className="text-gray-700" />
          <h2 className="text-lg font-bold text-gray-900 font-mono">
            {cn ? "多项目横向对比 (最多选 5 个)" : "Multi-Project Comparison (Max 5)"}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {allProjects.map(p => {
            const isSelected = selectedIds.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleProject(p.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isSelected
                    ? "bg-black text-white border border-black"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {selectedProjects.length < 2 ? (
        <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
          {cn ? "请至少选择 2 个项目进行对比" : "Select at least 2 projects to compare"}
        </div>
      ) : (
        <>
          {/* Evaluation Dimensions Comparison */}
          <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm overflow-x-auto">
            <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2 font-mono uppercase">
              <TrendingUp size={16} />
              {cn ? "九维评分对比" : "9-Dimension Score Comparison"}
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-mono text-gray-400 uppercase text-[10px]">
                    {cn ? "维度" : "Dimension"}
                  </th>
                  {selectedProjects.map(p => (
                    <th key={p.id} className="py-2 px-3 font-mono text-gray-800 text-[10px] font-bold">
                      <button
                        onClick={() => onSelectProject(p.id)}
                        className="hover:underline cursor-pointer"
                      >
                        {p.name}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedProjects[0]?.evaluation.dimensions.map((dim, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-gray-700">{dim.name}</td>
                    {selectedProjects.map(p => {
                      const d = p.evaluation.dimensions[i];
                      const score = d?.score || 0;
                      const color = score >= 8 ? "text-emerald-600" : score >= 5 ? "text-amber-600" : "text-rose-600";
                      return (
                        <td key={p.id} className="py-2.5 px-3 text-center">
                          <span className={`font-bold text-sm ${color}`}>{score}</span>
                          <span className="text-gray-400">/10</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recommendation & Strategy Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-900 text-sm font-mono uppercase flex items-center gap-2">
                <ArrowRight size={16} />
                {cn ? "总体建议 & 置信度" : "Recommendation & Confidence"}
              </h3>
              {selectedProjects.map(p => (
                <div key={p.id} className="p-3 rounded-lg border border-gray-100 bg-slate-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className="font-bold text-xs text-gray-800 cursor-pointer hover:underline"
                      onClick={() => onSelectProject(p.id)}
                    >
                      {p.name}
                    </span>
                    <span className="font-mono text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">
                      {p.evaluation.confidenceScore}% {cn ? "置信" : "conf"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    {p.evaluation.overallRecommendation}
                  </p>
                  <div>
                    <span className="text-[10px] font-mono text-gray-400">{cn ? "建议路径：" : "Path: "}</span>
                    <span className="text-[10px] text-gray-700 font-semibold">{p.strategy.suggestedPath}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-900 text-sm font-mono uppercase flex items-center gap-2">
                <TrendingDown size={16} />
                {cn ? "关键风险对比" : "Key Risks Comparison"}
              </h3>
              {selectedProjects.map(p => (
                <div key={p.id} className="p-3 rounded-lg border border-rose-50 bg-rose-50/10 space-y-1">
                  <span
                    className="font-bold text-xs text-gray-800 cursor-pointer hover:underline"
                    onClick={() => onSelectProject(p.id)}
                  >
                    {p.name}
                  </span>
                  <p className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-line">
                    {p.evaluation.keyRisks}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Competitor & Voice Counts */}
          <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm overflow-x-auto">
            <h3 className="font-bold text-gray-900 text-sm mb-4 font-mono uppercase">
              {cn ? "数据覆盖概况" : "Data Coverage Overview"}
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-mono text-gray-400 uppercase text-[10px]">
                    {cn ? "指标" : "Metric"}
                  </th>
                  {selectedProjects.map(p => (
                    <th key={p.id} className="py-2 px-3 font-mono text-gray-800 text-[10px] font-bold">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: cn ? "竞品数" : "Competitors", key: "competitors", get: (p: ResearchProject) => p.competitors.length },
                  { label: cn ? "用户声音" : "User Voices", key: "voices", get: (p: ResearchProject) => p.userVoices.length },
                  { label: cn ? "搜索任务" : "Search Tasks", key: "tasks", get: (p: ResearchProject) => p.searchTasks.length },
                  { label: cn ? "验证计划" : "Validations", key: "validations", get: (p: ResearchProject) => p.validationPlan.length },
                  { label: cn ? "启用平台" : "Platforms", key: "platforms", get: (p: ResearchProject) => p.enabledPlatforms.join(", ") }
                ].map(metric => (
                  <tr key={metric.key} className="border-b border-gray-100 hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-gray-700">{metric.label}</td>
                    {selectedProjects.map(p => (
                      <td key={p.id} className="py-2.5 px-3 text-center font-mono text-gray-600">
                        {metric.get(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
