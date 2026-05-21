import React, { useState } from "react";
import { ResearchProject, UserVoice, AppSettings } from "../types";
import { 
  Users, MessageSquare, ThumbsUp, ThumbsDown, Filter, Calendar, 
  ExternalLink, Plus, CheckCircle, Search, HelpCircle 
} from "lucide-react";

interface UserVoiceViewProps {
  project: ResearchProject;
  settings: AppSettings;
  onUpdateProject: (updated: ResearchProject) => void;
  onSelectVoice: (voiceId: string) => void;
}

export default function UserVoiceView({
  project,
  settings,
  onUpdateProject,
  onSelectVoice
}: UserVoiceViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"cluster" | "stream">("cluster");
  
  // Filtering states
  const [platformFilter, setPlatformFilter] = useState("All");
  const [sentimentFilter, setSentimentFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Adding feedback states
  const [isAddingVoice, setIsAddingVoice] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newPlatform, setNewPlatform] = useState("Reddit");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newSentiment, setNewSentiment] = useState<"positive" | "negative" | "neutral">("negative");
  const [newTopic, setNewTopic] = useState("");

  const cn = settings.language === "zh";

  // Distinct topics聚类 counting
  const topicsCountMap: { [key: string]: number } = {};
  project.userVoices.forEach(v => {
    v.topics.forEach(t => {
      topicsCountMap[t] = (topicsCountMap[t] || 0) + 1;
    });
  });

  const uniqueTopics = Object.keys(topicsCountMap).map(name => ({
    name,
    count: topicsCountMap[name]
  })).sort((a,b) => b.count - a.count);

  // Filtering list
  const filteredVoices = project.userVoices.filter(v => {
    if (platformFilter !== "All" && v.platform !== platformFilter) return false;
    if (sentimentFilter !== "All" && v.sentiment !== sentimentFilter) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchText = (v.content + v.title + v.userName + v.quote).toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  const handleAddVoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent) return;

    const newVoice: UserVoice = {
      id: "voice-" + Date.now(),
      userName: newUserName || "anonymous_user",
      platform: newPlatform,
      title: newTitle || (cn ? "用户补充的反馈主题" : "User-input comment subject"),
      content: newContent,
      sentiment: newSentiment,
      topics: newTopic ? [newTopic] : [cn ? "自定义补充" : "User-added"],
      quote: newContent.slice(0, 40) + "...",
      strength: "medium",
      sourceUrl: "https://example.com/source",
      timestamp: new Date().toISOString().split('T')[0]
    };

    onUpdateProject({
      ...project,
      userVoices: [newVoice, ...project.userVoices]
    });

    setIsAddingVoice(false);
    setNewUserName("");
    setNewTitle("");
    setNewContent("");
    setNewTopic("");
  };

  const handleDeleteVoice = (voiceId: string) => {
    const updated = project.userVoices.filter(v => v.id !== voiceId);
    onUpdateProject({
      ...project,
      userVoices: updated
    });
  };

  return (
    <div className="space-y-6 animate-fade-in p-1">
      {/* Tab select headers */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-gray-150">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveSubTab("cluster")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold font-mono tracking-tight transition duration-150 ${
              activeSubTab === "cluster" 
                ? "bg-indigo-600 text-white shadow-sm" 
                : "text-gray-600 hover:bg-slate-50"
            }`}
          >
            📊 {cn ? "用户反馈主题聚类" : "Sentiment Topic Clusters"}
          </button>
          <button
            onClick={() => setActiveSubTab("stream")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold font-mono tracking-tight transition duration-150 ${
              activeSubTab === "stream" 
                ? "bg-indigo-600 text-white shadow-sm" 
                : "text-gray-600 hover:bg-slate-50"
            }`}
          >
            📋 {cn ? "原始反响证据流" : "Feedback Evidence Stream"}
          </button>
        </div>

        <button
          onClick={() => setIsAddingVoice(!isAddingVoice)}
          className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
        >
          <Plus size={14} />
          {cn ? "录入用户原声反馈" : "Log User Voice Ticket"}
        </button>
      </div>

      {isAddingVoice && (
        <form onSubmit={handleAddVoiceSubmit} className="bg-white rounded-xl border border-gray-250 p-6 shadow-sm text-left grid grid-cols-1 md:grid-cols-2 gap-4">
          <h3 className="col-span-full font-bold text-gray-900 pb-2 border-b border-gray-100">
            {cn ? "录入一条收集到的全网用户原声" : "Log Raw User Feedback Ticket"}
          </h3>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 font-mono uppercase">{cn ? "发言用户名" : "User Handle"}</label>
            <input
              type="text"
              className="w-full text-xs rounded border border-gray-250 p-2"
              placeholder="e.g., hackerNewsUser_00"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 font-mono uppercase">{cn ? "收集来源平台" : "Source Platform"}</label>
            <select
              className="w-full text-xs rounded border border-gray-250 p-2 bg-white"
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
            >
              <option value="Reddit">Reddit Forum</option>
              <option value="G2 / Capterra">G2 / software site</option>
              <option value="App Store">Apple App Store</option>
              <option value="X (Twitter)">X / Twitter</option>
              <option value="Others">Others</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 font-mono uppercase">{cn ? "情绪定性" : "Sentiment Classifier"}</label>
            <select
              className="w-full text-xs rounded border border-gray-250 p-2 bg-white"
              value={newSentiment}
              onChange={(e) => setNewSentiment(e.target.value as any)}
            >
              <option value="negative">😡 {cn ? "负面 (Negative)" : "Negative / Dissatisfied"}</option>
              <option value="positive">😊 {cn ? "正面 (Positive)" : "Positive / Satified"}</option>
              <option value="neutral">😐 {cn ? "中性 (Neutral)" : "Neutral"}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 font-mono uppercase">{cn ? "主题分类词 (单一标签)" : "Topic Category Ticket"}</label>
            <input
              type="text"
              className="w-full text-xs rounded border border-gray-250 p-2"
              placeholder="e.g. 价格偏高, 移动端卡顿"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
            />
          </div>
          <div className="col-span-full space-y-1">
            <label className="text-[10px] font-bold text-gray-500 font-mono uppercase">{cn ? "反馈贴内容标题" : "Subject heading"}</label>
            <input
              type="text"
              className="w-full text-xs rounded border border-gray-250 p-2 font-semibold"
              placeholder="e.g. SonarQube is slow and hard to deploy"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <div className="col-span-full space-y-1">
            <label className="text-[10px] font-bold text-gray-500 font-mono uppercase">{cn ? "发言人正文内容 *" : "Detailed Comment Body *"}</label>
            <textarea
              rows={3}
              className="w-full text-xs rounded border border-gray-250 p-2"
              placeholder={cn ? "请复制粘贴他的真实留言。内容越真实，后续策略越具体..." : "Paste raw user comment here..."}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              required
            />
          </div>
          <div className="col-span-full flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingVoice(false)}
              className="px-4 py-2 text-xs border border-gray-200 text-gray-500 rounded hover:bg-gray-50 cursor-pointer"
            >
              {cn ? "取消" : "Cancel"}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 cursor-pointer"
            >
              {cn ? "提交" : "Submit Ticket"}
            </button>
          </div>
        </form>
      )}

      {activeSubTab === "cluster" ? (
        /* Semantics Theme Clustering Grid */
        <div className="space-y-6 text-left">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {uniqueTopics.length === 0 ? (
              <div className="col-span-full py-8 text-center text-gray-400">
                {cn ? "未找到相关的分析主题。" : "No clusters available."}
              </div>
            ) : (
              uniqueTopics.map((topic, idx) => {
                const associatedCount = project.userVoices.filter(v => v.topics.includes(topic.name)).length;
                const withNeg = project.userVoices.filter(v => v.topics.includes(topic.name) && v.sentiment === "negative").length;
                return (
                  <div
                    key={idx}
                    className="p-5 rounded-xl border border-gray-200 hover:border-gray-300 bg-white shadow-sm flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="bg-slate-100 text-gray-800 font-mono text-[10px] font-semibold px-2 py-0.5 rounded">
                          # {topic.name}
                        </span>
                        <span className="text-xs text-gray-500 font-mono font-bold">
                          {associatedCount} {cn ? "条相关文献" : "instances"}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm">
                        {cn ? `关于【${topic.name}】的用户摩擦` : `User friction on ${topic.name}`}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {cn 
                          ? `在此主题下，多达 ${withNeg} 个负面极端反馈指出竞品设计漏洞，形成切入挡板。`
                          : `Under this semantic node, ${withNeg} dissatisfied users express blockades.`}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-gray-100 mt-4 flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        {cn ? `不满意度: ${Math.round((withNeg / associatedCount) * 100)}%` : `Friction: ${Math.round((withNeg / associatedCount) * 100)}%`}
                      </div>
                      <button
                        onClick={() => {
                          setSearchQuery(topic.name);
                          setActiveSubTab("stream");
                        }}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold font-mono tracking-tight cursor-pointer"
                      >
                        {cn ? "钻取对应原文 »" : "Dive inside origins »"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Explanation Drawer */}
          <div className="bg-slate-50 border border-gray-200 rounded-xl p-5 flex items-start gap-3">
            <HelpCircle className="text-slate-500 shrink-0 mt-0.5" size={16} />
            <div className="space-y-1 text-xs">
              <h5 className="font-bold text-gray-900">{cn ? "什么是反馈主题聚类？" : "What are cluster maps?"}</h5>
              <p className="text-gray-600 leading-relaxed">
                {cn 
                  ? "全网采集引擎抓回上千条冗杂的社交媒体和评价帖子后，过滤掉纯粹的吹捧通配符，将负面摩擦沉淀聚合成高可信主题。比如『价格敏感』或『部署困难』。每个板块的『摩擦百分比』越高，证明用户的痛苦值累计越快，是开发力量训练器、PR审查器极其高效的突破口。"
                  : "Topic aggregation maps filter out vanity stars of G2 software summaries, targeting only granular functional frictions. High frustration level percentages indicate prime opportunities to construct high demand minimal features."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Stream Segment */
        <div className="space-y-4 text-left">
          {/* Filters Bar */}
          <div className="bg-slate-50/50 rounded-xl p-4 border border-gray-200/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                <Filter size={12} />
                {cn ? "过滤：" : "Filters:"}
              </div>

              {/* Platform options */}
              <select
                className="text-xs border border-gray-200 rounded p-1.5 bg-white font-mono"
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
              >
                <option value="All">{cn ? "全部来源" : "All Sites"}</option>
                <option value="Reddit">Reddit</option>
                <option value="G2 / Capterra">G2 Reviews</option>
                <option value="App Store">App Store</option>
                <option value="X (Twitter)">X / Twitter</option>
              </select>

              {/* Sentiment options */}
              <select
                className="text-xs border border-gray-200 rounded p-1.5 bg-white font-mono"
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
              >
                <option value="All">{cn ? "全部态度" : "All Opinions"}</option>
                <option value="negative">😡 {cn ? "仅看痛点差评" : "Only Negatives"}</option>
                <option value="positive">😊 {cn ? "仅看正面表扬" : "Only Positives"}</option>
                <option value="neutral">😐 {cn ? "中性信息" : "Neutrals"}</option>
              </select>
            </div>

            {/* Keyword search filter */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2 text-gray-400" size={12} />
              <input
                type="text"
                placeholder={cn ? "搜索原始字词..." : "Keyword filter..."}
                className="w-full text-xs rounded border border-gray-200 pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Original complaints streams lists */}
          <div className="space-y-4">
            {filteredVoices.length === 0 ? (
              <div className="py-12 bg-white rounded-xl border border-gray-200 text-center text-gray-400 text-sm">
                {cn ? "未找到匹配过滤条件的留言评论数据。" : "No matching comment streams available."}
              </div>
            ) : (
              filteredVoices.map((voice) => {
                const isNeg = voice.sentiment === "negative";
                return (
                  <div
                    key={voice.id}
                    onClick={() => onSelectVoice(voice.id)}
                    className={`p-5 rounded-xl border bg-white relative transition shadow-sm hover:shadow hover:border-gray-300 flex flex-col justify-between ${
                      isNeg ? "border-rose-100 hover:border-rose-200" : "border-gray-200"
                    }`}
                  >
                    {/* Rose visual cue to prioritize pain points */}
                    {isNeg && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 rounded-l-xl"></div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-tight ${
                            isNeg ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}>
                            {voice.sentiment === "negative" ? "Pain Point" : "Satisfied"}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            @{voice.userName} · {voice.platform}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono">
                          <Calendar size={10} />
                          {voice.timestamp}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVoice(voice.id);
                            }}
                            className="text-gray-400 hover:text-red-600 p-0.5"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      <h4 className="font-bold text-gray-900 text-sm">
                        {voice.title}
                      </h4>

                      <p className="text-xs text-gray-700 font-sans leading-relaxed">
                        {voice.content}
                      </p>

                      <div className="flex flex-wrap gap-1">
                        {voice.topics.map((t, i) => (
                          <span key={i} className="bg-slate-100 text-slate-700 text-[9px] font-mono px-1.5 py-0.5 rounded">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 mt-3 flex items-center justify-between">
                      <span className="text-[10px] italic text-gray-500 font-sans truncate pr-4">
                        {cn ? "“" : '"'}{voice.quote}{cn ? "”" : '"'}
                      </span>
                      {voice.sourceUrl !== "#" && (
                        <a
                          href={voice.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[10px] text-indigo-600 hover:text-indigo-800 font-mono font-bold flex items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={8} />
                          {cn ? "检索原文" : "Audit Link"}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
