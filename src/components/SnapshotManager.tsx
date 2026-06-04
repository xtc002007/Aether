import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProjectSnapshot, AppSettings, ResearchProject } from "../types";
import { X, History, RotateCcw, Trash2, Plus, Clock, Star, Bookmark, Loader2 } from "lucide-react";

interface SnapshotManagerProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onRestoreComplete: (restoredProject: ResearchProject) => void;
}

export default function SnapshotManager({
  projectId,
  projectName,
  isOpen,
  onClose,
  settings,
  onRestoreComplete,
}: SnapshotManagerProps) {
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const cn = settings.language === "zh";

  const loadSnapshots = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await invoke<ProjectSnapshot[]>("list_snapshots", { projectId });
      setSnapshots(list);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
      setShowCreate(false);
      setConfirmRestore(null);
      setConfirmDelete(null);
    }
  }, [isOpen, projectId]);

  const handleCreateSnapshot = async () => {
    try {
      await invoke("create_snapshot", {
        projectId,
        label: label.trim() || (cn ? "手动快照" : "Manual snapshot"),
        description: description.trim(),
      });
      setShowCreate(false);
      setLabel("");
      setDescription("");
      await loadSnapshots();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleRestore = async (snapshotId: string) => {
    setIsRestoring(true);
    try {
      const restored = await invoke<ResearchProject>("restore_snapshot", { snapshotId });
      onRestoreComplete(restored);
    } catch (err) {
      setError(String(err));
      setIsRestoring(false);
    }
  };

  const handleDelete = async (snapshotId: string) => {
    try {
      await invoke("delete_snapshot", { snapshotId });
      setConfirmDelete(null);
      await loadSnapshots();
    } catch (err) {
      setError(String(err));
    }
  };

  const typeBadge = (type: string) => {
    switch (type) {
      case "manual":
        return { cls: "bg-blue-50 text-blue-700 border-blue-200", icon: Star, label: cn ? "手动" : "MANUAL" };
      case "auto":
        return { cls: "bg-gray-50 text-gray-600 border-gray-200", icon: Clock, label: cn ? "自动" : "AUTO" };
      case "checkpoint":
        return { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Bookmark, label: cn ? "检查点" : "CHECKPOINT" };
      default:
        return { cls: "bg-gray-50 text-gray-600 border-gray-200", icon: Clock, label: type.toUpperCase() };
    }
  };

  const stageLabel = (stage: string | null) => {
    if (!stage) return null;
    const map: Record<string, string> = {
      platform_queries_done: cn ? "平台查询完成" : "Platform queries done",
      voices_competitors_extracted: cn ? "用户声音与竞品已提取" : "Voices & competitors extracted",
      signals_extracted: cn ? "信号已提取" : "Signals extracted",
      evaluation_computed: cn ? "评估已计算" : "Evaluation computed",
      strategy_generated: cn ? "策略已生成" : "Strategy generated",
      complete: cn ? "分析完成" : "Complete",
    };
    return map[stage] || stage;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl border border-[#E5E2DE] shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col mx-4 dark:bg-[#191816] dark:border-[#3E3A35]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E5E2DE] shrink-0 dark:border-[#3E3A35]">
          <div className="flex items-center gap-2">
            <History size={16} className="text-indigo-600" />
            <h2 className="text-sm font-bold font-mono text-gray-900 dark:text-white">
              {cn ? "版本历史" : "Version History"}
            </h2>
            <span className="text-[10px] text-[#8C8882] font-mono ml-1">
              {projectName}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer dark:hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-b border-[#E5E2DE] shrink-0 flex items-center justify-between dark:border-[#3E3A35]">
          <span className="text-[10px] text-[#8C8882] font-mono">
            {snapshots.length} {cn ? "个版本" : "versions"}
          </span>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold py-1.5 px-3 rounded-lg transition cursor-pointer"
          >
            <Plus size={12} />
            {cn ? "创建快照" : "Create Snapshot"}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="px-5 py-4 border-b border-[#E5E2DE] bg-[#F9F8F6] space-y-3 shrink-0 dark:bg-[#22201D] dark:border-[#3E3A35]">
            <input
              type="text"
              placeholder={cn ? "标签（可选）" : "Label (optional)"}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-white border border-[#E5E2DE] rounded-lg px-3 py-2 text-xs font-sans focus:outline-none focus:border-indigo-400 dark:bg-[#191816] dark:text-white dark:border-[#3E3A35]"
            />
            <input
              type="text"
              placeholder={cn ? "描述（可选）" : "Description (optional)"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-[#E5E2DE] rounded-lg px-3 py-2 text-xs font-sans focus:outline-none focus:border-indigo-400 dark:bg-[#191816] dark:text-white dark:border-[#3E3A35]"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowCreate(false); setLabel(""); setDescription(""); }}
                className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg cursor-pointer dark:text-gray-400"
              >
                {cn ? "取消" : "Cancel"}
              </button>
              <button
                onClick={handleCreateSnapshot}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
              >
                {cn ? "保存快照" : "Save Snapshot"}
              </button>
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="space-y-3 text-center">
                <Loader2 size={24} className="animate-spin text-indigo-600 mx-auto" />
                <p className="text-xs text-[#8C8882] font-mono">
                  {cn ? "加载中..." : "Loading..."}
                </p>
              </div>
            </div>
          )}

          {error && !isLoading && (
            <div className="p-5 text-center space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-xs dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {error}
              </div>
              <button
                onClick={loadSnapshots}
                className="text-indigo-600 hover:text-indigo-700 text-[11px] font-semibold cursor-pointer"
              >
                {cn ? "重试" : "Retry"}
              </button>
            </div>
          )}

          {!isLoading && !error && snapshots.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-5 text-center space-y-3">
              <History size={32} className="text-[#D4D0CB]" />
              <p className="text-xs text-[#8C8882] font-mono font-bold">
                {cn ? "暂无快照" : "No snapshots yet"}
              </p>
              <p className="text-[10px] text-[#8C8882] max-w-[280px]">
                {cn
                  ? "快照会在创建项目、分析完成和数据编辑时自动生成。也可以手动创建快照。"
                  : "Snapshots are created automatically on project creation, analysis completion, and data edits. You can also create manual snapshots."}
              </p>
            </div>
          )}

          {!isLoading && !error && snapshots.length > 0 && (
            <div className="divide-y divide-[#E5E2DE] dark:divide-[#3E3A35]">
              {snapshots.map((snap) => {
                const badge = typeBadge(snap.snapshotType);
                const BadgeIcon = badge.icon;
                const stage = stageLabel(snap.checkpointStage);
                const isLatest = snap.versionNumber === snapshots[0]?.versionNumber;

                return (
                  <div key={snap.id} className="px-5 py-3.5 hover:bg-[#F9F8F6] transition dark:hover:bg-[#22201D]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold font-mono text-gray-900 dark:text-white">
                            v{snap.versionNumber}
                          </span>
                          {isLatest && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 rounded font-mono font-bold dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                              {cn ? "最新" : "LATEST"}
                            </span>
                          )}
                          <span className={`text-[9px] border px-1.5 rounded font-mono font-bold flex items-center gap-1 ${badge.cls}`}>
                            <BadgeIcon size={10} />
                            {badge.label}
                          </span>
                          {stage && (
                            <span className="text-[9px] text-[#8C8882] font-mono">
                              {stage}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-800 font-sans font-medium truncate dark:text-gray-200">
                          {snap.label}
                        </p>
                        {snap.description && (
                          <p className="text-[10px] text-[#8C8882] truncate">
                            {snap.description}
                          </p>
                        )}
                        <p className="text-[9px] text-[#B5B0A8] font-mono">
                          {snap.createdAt}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {confirmRestore === snap.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-amber-600 font-bold">
                              {cn ? "确认恢复？" : "Restore?"}
                            </span>
                            <button
                              onClick={() => handleRestore(snap.id)}
                              disabled={isRestoring}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-bold px-2 py-1 rounded cursor-pointer disabled:opacity-50"
                            >
                              {cn ? "是" : "Yes"}
                            </button>
                            <button
                              onClick={() => setConfirmRestore(null)}
                              className="text-gray-400 hover:text-gray-600 text-[9px] font-bold px-1 py-1 cursor-pointer dark:hover:text-white"
                            >
                              {cn ? "否" : "No"}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRestore(snap.id)}
                            disabled={isRestoring}
                            className="text-[10px] text-indigo-600 hover:text-indigo-700 font-semibold px-2 py-1 rounded hover:bg-indigo-50 transition cursor-pointer disabled:opacity-50 dark:hover:bg-indigo-900/20"
                            title={cn ? "恢复此版本" : "Restore this version"}
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}

                        {confirmDelete === snap.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(snap.id)}
                              className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold px-2 py-1 rounded cursor-pointer"
                            >
                              {cn ? "删除" : "Del"}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-gray-400 hover:text-gray-600 text-[9px] font-bold px-1 py-1 cursor-pointer dark:hover:text-white"
                            >
                              {cn ? "否" : "No"}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(snap.id)}
                            disabled={isRestoring}
                            className="text-[10px] text-red-400 hover:text-red-600 font-semibold px-2 py-1 rounded hover:bg-red-50 transition cursor-pointer disabled:opacity-50 dark:hover:bg-red-900/20"
                            title={cn ? "删除此快照" : "Delete this snapshot"}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#E5E2DE] text-center text-[10px] text-[#8C8882] font-mono shrink-0 dark:border-[#3E3A35]">
          {cn ? "快照存储完整项目状态，恢复会替换当前数据" : "Snapshots store full project state. Restoring replaces current data."}
        </div>
      </div>
    </div>
  );
}
