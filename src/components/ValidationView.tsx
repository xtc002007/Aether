import React, { useState } from "react";
import { ResearchProject, AppSettings } from "../types";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
  CheckSquare, HelpCircle, FileText, Globe, MessageSquare,
  Target, Rocket, ListTodo, ClipboardCopy, CheckCircle, Flame,
  Download
} from "lucide-react";

interface ValidationViewProps {
  project: ResearchProject;
  settings: AppSettings;
}

export default function ValidationView({
  project,
  settings
}: ValidationViewProps) {
  const [completedItems, setCompletedItems] = useState<{ [key: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const cn = settings.language === "zh";

  const toggleItem = (category: string) => {
    setCompletedItems(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const buildMarkdownChecklist = (): string => {
    let md = `# ${cn ? "验证行动清单" : "Validation Action Checklist"}\n\n`;
    md += `**${cn ? "项目" : "Project"}**: ${project.name}\n`;
    md += `**${cn ? "生成时间" : "Generated"}: ${new Date().toISOString().split("T")[0]}\n\n`;
    md += `---\n\n`;
    for (const plan of project.validationPlan) {
      const doneMarker = completedItems[plan.category] ? "[x]" : "[ ]";
      md += `## ${doneMarker} ${plan.category} (${plan.duration})\n\n`;
      md += `- **${cn ? "目标" : "Target"}**: ${plan.target}\n`;
      md += `- **${cn ? "行动" : "Action"}**: ${plan.action}\n`;
      md += `- **${cn ? "预期验证" : "Expected"}**: ${plan.expectedAssertion}\n`;
      md += `\n**${cn ? "详细执行指南" : "Execution Details"}**:\n\n${plan.details}\n\n---\n\n`;
    }
    return md;
  };

  const handleExportChecklist = async () => {
    const md = buildMarkdownChecklist();
    try {
      const path = await save({
        defaultPath: `${project.id}-validation-checklist.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (path) { await writeTextFile(path, md); }
    } catch (_) {
      // Fallback: browser download
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${project.id}-validation-checklist.md`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in p-1 text-left">
      <div className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-700">
            <Rocket size={18} />
            <h2 className="text-lg font-bold text-gray-900 font-mono">
              {cn ? "验证阶段行动清单 (Action Plan)" : "Actionable Validation Playbook"}
            </h2>
          </div>
          <button
            onClick={handleExportChecklist}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download size={12} />
            {cn ? "导出为 Markdown 清单" : "Export as Markdown"}
          </button>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed font-sans">
          {cn
            ? "大宗开发前的验证行动不应当是写一万字的市场调研PPT。研究操作系统为您量身设计了一套 3-10 天的低成本假设验证行动书。点击左侧核对框，标记您的验证进度。"
            : "Instead of writing abstract strategy slides, execute this simple 10-day testing cycle. Track task completion with the checkboxes below."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {project.validationPlan.map((plan, idx) => {
          const isDone = !!completedItems[plan.category];
          const isInterview = plan.category.includes("Interview") || plan.category.includes("访谈");
          const isLanding = plan.category.includes("Landing") || plan.category.includes("落地页");

          return (
            <div 
              key={idx}
              className={`p-6 rounded-xl border transition duration-200 bg-white shadow-sm flex flex-col md:flex-row gap-6 relative ${
                isDone ? "border-emerald-200 bg-emerald-50/10 opacity-75" : "border-gray-250"
              }`}
            >
              {/* Completed checkbox trigger */}
              <button 
                onClick={() => toggleItem(plan.category)}
                className={`absolute right-4 top-4 p-1.5 rounded-lg border transition duration-150 cursor-pointer ${
                  isDone 
                    ? "bg-emerald-500 text-white border-emerald-500" 
                    : "border-gray-250 hover:bg-slate-50 text-gray-400"
                }`}
              >
                <CheckCircle size={16} />
              </button>

              {/* Action Category Badge & Timeline */}
              <div className="md:w-1/4 space-y-3 shrink-0">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold text-indigo-500 uppercase">
                    {plan.duration}
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm font-sans flex items-center gap-1.5">
                    {isInterview && <MessageSquare size={14} className="text-gray-400" />}
                    {isLanding && <Globe size={14} className="text-gray-400" />}
                    {!isInterview && !isLanding && <Target size={14} className="text-gray-400" />}
                    {plan.category}
                  </h3>
                </div>

                <div className="space-y-1.5 text-xs text-gray-500 font-medium">
                  <div>
                    <span className="font-mono font-bold text-gray-400 uppercase text-[9px] block">{cn ? "针对假设" : "Hypothesis"}</span>
                    <span className="text-gray-700">{plan.target}</span>
                  </div>
                  <div>
                    <span className="font-mono font-bold text-gray-400 uppercase text-[9px] block">{cn ? "执行行动" : "Action Item"}</span>
                    <span className="text-gray-700">{plan.action}</span>
                  </div>
                </div>
              </div>

              {/* Specific Generated Content Assets */}
              <div className="flex-1 bg-slate-50 border border-gray-150 rounded-xl p-5 relative overflow-hidden text-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                  <span className="font-mono font-bold text-slate-500 flex items-center gap-1.5">
                    <Flame size={12} className="text-amber-500" />
                    {cn ? "可直接复制使用的文案资产 (Click to copy)" : "Production Ready Text Asset"}
                  </span>
                  <button
                    onClick={() => handleCopyText(plan.details, plan.category)}
                    className="text-indigo-600 hover:text-indigo-800 font-mono font-semibold flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded border border-gray-200 shadow-xs"
                  >
                    <ClipboardCopy size={11} />
                    {copiedId === plan.category ? (cn ? "已复制" : "Copied!") : (cn ? "复制原文" : "Copy")}
                  </button>
                </div>

                {isInterview ? (
                  /* Formatted interview questions card */
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
                    <p className="font-semibold text-gray-800 font-sans">{cn ? "请围绕以下对话大纲询问，绝对不要直接问『你想不想要这个APP』！" : "Rely strictly on problem diagnosing questions:"}</p>
                    <div className="space-y-2 font-sans text-gray-700 pl-2">
                      {plan.details.split("\n").map((line, lIdx) => (
                        <p key={lIdx} className="leading-relaxed">
                          {line.trim()}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : isLanding ? (
                  /* Formatted landing blueprint card */
                  <div className="space-y-3.5 max-h-[220px] overflow-y-auto font-sans">
                    {plan.details.split("\n").map((line, lIdx) => {
                      if (line.includes("- ") || line.includes("1. ")) {
                        return <p key={lIdx} className="text-gray-700 pl-4 leading-relaxed">{line.trim()}</p>;
                      }
                      if (line.includes("：") || line.includes(":")) {
                        const parts = line.split(/[：:]/);
                        return (
                          <div key={lIdx} className="space-y-1">
                            <span className="font-bold text-gray-900 text-xs font-mono">{parts[0]}</span>
                            <p className="text-gray-700 pl-2">{parts.slice(1).join(":")}</p>
                          </div>
                        );
                      }
                      return <p key={lIdx} className="text-gray-800 font-medium">{line}</p>;
                    })}
                  </div>
                ) : (
                  /* Standard ad campaign template */
                  <div className="space-y-3 max-h-[220px] overflow-y-auto font-sans">
                    {plan.details.split("\n").map((line, lIdx) => (
                      <p key={lIdx} className="text-gray-700 leading-relaxed font-sans">{line}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
