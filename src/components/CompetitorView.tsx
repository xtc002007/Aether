import React, { useState } from "react";
import { ResearchProject, Competitor, AppSettings } from "../types";
import { 
  Building2, ExternalLink, ThumbsUp, ThumbsDown, Sparkles, 
  Layers, ChevronRight, HelpCircle, Tag, Plus, Check, Trash2 
} from "lucide-react";

interface CompetitorViewProps {
  project: ResearchProject;
  settings: AppSettings;
  onUpdateProject: (updated: ResearchProject) => void;
}

export default function CompetitorView({
  project,
  settings,
  onUpdateProject
}: CompetitorViewProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>("All");
  const [selectedCompId, setSelectedCompId] = useState<string | null>(
    project.competitors[0]?.id || null
  );

  // New Competitor Form states
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newPos, setNewPos] = useState("");
  const [newGroup, setNewGroup] = useState("Direct Competitor");
  const [newPricing, setNewPricing] = useState("$9/mo");
  const [newFeatures, setNewFeatures] = useState("");
  const [newPros, setNewPros] = useState("");
  const [newCons, setNewCons] = useState("");

  const cn = settings.language === "zh";

  const groupTranslation: { [key: string]: string } = {
    "All": cn ? "全部赛道竞争源" : "All Categories",
    "Direct Competitor": cn ? "直接核心竞品" : "Direct Competitors",
    "Indirect": cn ? "间接衍生产品" : "Indirect Products",
    "Alternatives": cn ? "原始替代方案" : "Manual Alternatives",
    "Niches": cn ? "周边邻近应用" : "Neighboring Niches"
  };

  const categoriesTree = [
    { id: "All", name: groupTranslation["All"], count: project.competitors.length },
    { id: "Direct Competitor", name: groupTranslation["Direct Competitor"], count: project.competitors.filter(c => c.categoryGroup.includes("Direct") || c.categoryGroup.includes("直接")).length },
    { id: "Indirect", name: groupTranslation["Indirect"], count: project.competitors.filter(c => c.categoryGroup.includes("Indirect") || c.categoryGroup.includes("间接")).length },
    { id: "Alternatives", name: groupTranslation["Alternatives"], count: project.competitors.filter(c => c.categoryGroup.includes("Alternative") || c.categoryGroup.includes("替代")).length },
    { id: "Niches", name: groupTranslation["Niches"], count: project.competitors.filter(c => c.categoryGroup.includes("Niche") || c.categoryGroup.includes("邻近")).length },
  ];

  // Filtering Competitors
  const filteredComps = project.competitors.filter(c => {
    if (selectedGroup === "All") return true;
    if (selectedGroup === "Direct Competitor") return c.categoryGroup.includes("Direct") || c.categoryGroup.includes("直接");
    if (selectedGroup === "Indirect") return c.categoryGroup.includes("Indirect") || c.categoryGroup.includes("间接");
    if (selectedGroup === "Alternatives") return c.categoryGroup.includes("Alternative") || c.categoryGroup.includes("替代");
    if (selectedGroup === "Niches") return c.categoryGroup.includes("Niche") || c.categoryGroup.includes("邻近");
    return true;
  });

  const selectedComp = project.competitors.find(c => c.id === selectedCompId) || filteredComps[0] || null;

  const handleAddCompetitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    const newCompetitor: Competitor = {
      id: "comp-" + Date.now(),
      name: newName,
      url: newUrl || "#",
      positioning: newPos || (cn ? "用户手工补充的竞品定位说明" : "User-added competitor profile description"),
      targetUser: cn ? "待定高粘性客户群" : "TBD Cohort",
      coreFeatures: newFeatures || "Standard functionalities",
      pricing: newPricing,
      platforms: ["Web"],
      ratings: 4.0,
      reviewsCount: 1,
      pros: newPros || "N/A",
      cons: newCons || "N/A",
      opportunity: cn ? "待定差异化空间" : "TBD differentiation space",
      categoryGroup: newGroup
    };

    const updatedCompetitors = [...project.competitors, newCompetitor];
    onUpdateProject({
      ...project,
      competitors: updatedCompetitors
    });

    // Reset Form
    setIsAdding(false);
    setNewName("");
    setNewUrl("");
    setNewPos("");
    setNewPricing("$9/mo");
    setNewFeatures("");
    setNewPros("");
    setNewCons("");
    setSelectedCompId(newCompetitor.id);
  };

  const handleDeleteCompetitor = (compId: string) => {
    const updated = project.competitors.filter(c => c.id !== compId);
    onUpdateProject({
      ...project,
      competitors: updated
    });
    if (selectedCompId === compId) {
      setSelectedCompId(updated[0]?.id || null);
    }
  };

  const handleChangeGroup = (compId: string, nextGroup: string) => {
    const updated = project.competitors.map(c => {
      if (c.id === compId) {
        return { ...c, categoryGroup: nextGroup };
      }
      return c;
    });
    onUpdateProject({
      ...project,
      competitors: updated
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in p-1">
      {/* Left Column: Category Tree Navigation */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-xl border border-gray-250 p-4 shadow-sm text-left">
          <div className="text-xs font-bold text-gray-500 font-mono uppercase pb-2 border-b border-gray-100 flex items-center gap-1.5">
            <Layers size={12} />
            {cn ? "行业赛道类别树" : "Market Clusters Tree"}
          </div>
          <div className="space-y-1.5 mt-3">
            {categoriesTree.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedGroup(cat.id);
                  // Auto focus on first inside this group
                  const nexts = project.competitors.filter(c => {
                    if (cat.id === "All") return true;
                    if (cat.id === "Direct Competitor") return c.categoryGroup.includes("Direct") || c.categoryGroup.includes("直接");
                    if (cat.id === "Indirect") return c.categoryGroup.includes("Indirect") || c.categoryGroup.includes("间接");
                    if (cat.id === "Alternatives") return c.categoryGroup.includes("Alternative") || c.categoryGroup.includes("替代");
                    if (cat.id === "Niches") return c.categoryGroup.includes("Niche") || c.categoryGroup.includes("邻近");
                    return true;
                  });
                  setSelectedCompId(nexts[0]?.id || null);
                }}
                className={`w-full text-left text-xs p-2.5 rounded-lg transition duration-150 flex items-center justify-between ${
                  selectedGroup === cat.id 
                    ? "bg-indigo-600 text-white font-semibold" 
                    : "text-gray-700 hover:bg-slate-50"
                }`}
              >
                <span className="truncate">{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  selectedGroup === cat.id ? "bg-indigo-505 bg-indigo-700 text-indigo-50" : "bg-gray-100 text-gray-500"
                }`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="w-full mt-4 bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80 border border-indigo-200 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Plus size={14} />
            {cn ? "手工加入对手" : "Add Competitor Card"}
          </button>
        </div>

        {/* Categories Information Box */}
        <div className="bg-slate-50 border border-gray-200 rounded-lg p-4 text-left space-y-2 text-xs">
          <h4 className="font-bold text-gray-800 flex items-center gap-1">
            <HelpCircle size={12} className="text-gray-600" />
            {cn ? "如何校正竞品？" : "How to calibrate?"}
          </h4>
          <p className="text-gray-600 leading-relaxed">
            {cn 
              ? "人工智能根据想法建模推荐的一级分类和竞品可能会有些微偏差。您可以使用『手工加入竞品』，或者在每一项卡片详情中『移入』其他组（如把大厂从“直接”调到“衍生替代”），系统将动态刷新您的 9 维评估决策最终评分。"
              : "You can freely correct the categories mapping. Drag/shift competitor cards across folders or delete noise. The calculated overall scoring on the Evaluation screen will adapt in real-time."}
          </p>
        </div>
      </div>

      {/* Middle Column: Competitors Cards Pool */}
      <div className={`${selectedComp ? "lg:col-span-2" : "lg:col-span-3"} space-y-4 text-left`}>
        {isAdding ? (
          <div className="bg-white rounded-xl border-2 border-indigo-100 p-6 shadow-md transition">
            <h3 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-100 mb-4">
              {cn ? "手工添加竞品资产卡片" : "Add New Competitor Card"}
            </h3>
            <form onSubmit={handleAddCompetitor} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 font-mono uppercase">{cn ? "产品名称 *" : "Competitor Name *"}</label>
                  <input
                    type="text"
                    className="w-full text-xs rounded border border-gray-250 p-2 focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g., CodeGuard Inc"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 font-mono uppercase">{cn ? "官网/App链接" : "Website/App URL"}</label>
                  <input
                    type="text"
                    className="w-full text-xs rounded border border-gray-250 p-2 focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g., https://example.com"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 font-mono uppercase">{cn ? "划分群组" : "Category Group"}</label>
                  <select
                    className="w-full text-xs rounded border border-gray-250 p-2 bg-white"
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                  >
                    <option value="Direct Competitor">{cn ? "直接竞品 (Direct)" : "Direct"}</option>
                    <option value="Indirect">{cn ? "间接竞品 (Indirect)" : "Indirect"}</option>
                    <option value="Alternatives">{cn ? "替代方案 (Alternative)" : "Alternative"}</option>
                    <option value="Niches">{cn ? "周边领域 (Niche)" : "Neighboring Niche"}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 font-mono uppercase">{cn ? "预估定价描述" : "Estimated Pricing"}</label>
                  <input
                    type="text"
                    className="w-full text-xs rounded border border-gray-250 p-2 text-left"
                    placeholder="e.g., $19/mo or Free basic"
                    value={newPricing}
                    onChange={(e) => setNewPricing(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 font-mono uppercase block">{cn ? "核心功能大纲" : "Core Feature Checklist"}</label>
                <input
                  type="text"
                  className="w-full text-xs rounded border border-gray-250 p-2"
                  placeholder="e.g. GitHub Action webhook, automated markdown comment lines"
                  value={newFeatures}
                  onChange={(e) => setNewFeatures(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 font-mono uppercase block">{cn ? "一句话价值主张" : "Value Proposition / Positioning"}</label>
                <textarea
                  rows={2}
                  className="w-full text-xs rounded border border-gray-250 p-2"
                  placeholder={cn ? "一句话概括它到底提供什么服务" : "Summary of what they do"}
                  value={newPos}
                  onChange={(e) => setNewPos(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 font-mono uppercase block text-emerald-700">{cn ? "用户满意点 (Pros)" : "Satisfied (Pros)"}</label>
                  <input
                    type="text"
                    className="w-full text-xs rounded border border-emerald-250 p-2 text-emerald-950 bg-emerald-50/20"
                    placeholder="Pros text"
                    value={newPros}
                    onChange={(e) => setNewPros(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 font-mono uppercase block text-rose-700">{cn ? "用户痛点/抱怨点 (Cons)" : "Unmet (Cons)"}</label>
                  <input
                    type="text"
                    className="w-full text-xs rounded border border-rose-250 p-2 text-rose-950 bg-rose-50/20"
                    placeholder="Cons comments"
                    value={newCons}
                    onChange={(e) => setNewCons(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-xs border border-gray-200 text-gray-500 rounded hover:bg-gray-50 cursor-pointer"
                >
                  {cn ? "放弃" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 cursor-pointer"
                >
                  {cn ? "确认入库" : "Confirm Card"}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 font-mono">
            {groupTranslation[selectedGroup] || selectedGroup} ({filteredComps.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredComps.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-400 text-sm">
              {cn ? "该分类下暂无已识别的竞品数据。请录入新卡片或追加扫描任务。" : "No competitor cards in this folder yet."}
            </div>
          ) : (
            filteredComps.map((comp) => {
              const isActive = selectedComp?.id === comp.id;
              return (
                <div
                  key={comp.id}
                  onClick={() => setSelectedCompId(comp.id)}
                  className={`p-4 rounded-xl border transition duration-150 cursor-pointer relative bg-white shadow-sm flex flex-col justify-between ${
                    isActive 
                      ? "border-indigo-600 ring-1 ring-indigo-600 bg-slate-50/20" 
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
                          <Building2 size={14} className="text-gray-500" />
                          {comp.name}
                        </h3>
                        {comp.url !== "#" && (
                          <a 
                            href={comp.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] text-gray-400 hover:text-indigo-600 flex items-center gap-0.5 mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={8} />
                            {comp.url.replace("https://", "")}
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          className="text-[9px] font-mono border border-gray-200 rounded px-1 py-0.5 bg-gray-50 text-gray-600"
                          value={comp.categoryGroup}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleChangeGroup(comp.id, e.target.value);
                          }}
                        >
                          <option value="Direct Competitor">{cn ? "直接" : "Direct"}</option>
                          <option value="Indirect">{cn ? "间接" : "Indirect"}</option>
                          <option value="Alternatives">{cn ? "替代" : "Alternative"}</option>
                          <option value="Niches">{cn ? "邻近" : "Niche"}</option>
                        </select>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCompetitor(comp.id);
                          }}
                          className="text-gray-400 hover:text-rose-600 p-1 rounded transition"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed font-sans line-clamp-2">
                      {comp.positioning}
                    </p>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-gray-700 px-1.5 py-0.5 rounded text-[9px] font-mono">
                        <Tag size={8} />
                        {comp.pricing}
                      </span>
                      {comp.platforms.map((p, idx) => (
                        <span key={idx} className="bg-slate-50 text-gray-500 border border-gray-150 px-1 py-0.5 rounded text-[9px] font-mono">
                          {p}
                        </span>
                      ))}
                      {comp.ratings > 0 && (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">
                          ★ {comp.ratings} ({comp.reviewsCount} {cn ? "点评" : "reviews"})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Toggle Indicator */}
                  <div className="flex justify-end pt-3 border-t border-gray-50 mt-3">
                    <button className="text-[10px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100/50 hover:text-indigo-800 font-mono font-bold tracking-tight px-2.5 py-1 rounded flex items-center gap-1 transition">
                      {cn ? "查看引用证据链" : "Evidence Logs"}
                      <ChevronRight size={10} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Evidence Chain & Opportunities details */}
      {selectedComp && (
        <div className="lg:col-span-1 border-l border-gray-100 lg:pl-4 space-y-4 text-left">
          <div className="bg-slate-50 rounded-xl p-5 border border-gray-200/60 shadow-sm space-y-4">
            <div className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
              <Sparkles size={10} />
              {cn ? "差异化空挡分析" : "Differentiation Gaps"}
            </div>

            <div>
              <h3 className="font-bold text-gray-900 text-sm">
                {selectedComp.name}
              </h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {cn ? "行业归类定位评估证据册" : "Audited competitor telemetry dossier"}
              </p>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="space-y-1">
                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] block w-fit">
                  {cn ? "用户满意它哪里 (Pros)" : "What users like (Pros)"}
                </span>
                <p className="text-gray-700 font-sans italic pl-1 leading-relaxed">
                  "{selectedComp.pros}"
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-mono font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded text-[10px] block w-fit">
                  {cn ? "用户的抱怨/不满点 (Cons)" : "User frustrations (Cons)"}
                </span>
                <p className="text-gray-700 font-sans italic pl-1 leading-relaxed">
                  "{selectedComp.cons}"
                </p>
              </div>

              <div className="space-y-1 border-t border-gray-200/85 pt-3 mt-2">
                <span className="font-mono font-bold text-indigo-900 bg-indigo-100/50 px-1.5 py-0.5 rounded text-[10px] block w-fit">
                  💡 {cn ? "我们可以利用的突破口" : "Our entry opportunity"}
                </span>
                <p className="text-indigo-950 font-sans font-medium pl-1 leading-relaxed">
                  {selectedComp.opportunity}
                </p>
              </div>
            </div>
          </div>

          {/* Core Feature List Box */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-left space-y-3">
            <h4 className="font-mono font-bold text-xs text-gray-500 uppercase border-b border-gray-100 pb-1.5">
              {cn ? "竞品功能地图 (Features)" : "Competitor Functional Map"}
            </h4>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
              {selectedComp.coreFeatures.split(",").map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                  <Check size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span className="font-sans font-medium">{feat.trim()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
