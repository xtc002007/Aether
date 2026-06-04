export type Sentiment = "positive" | "negative" | "neutral";
export type EvidenceStrength = "high" | "medium" | "low";
export type PlatformType = "search_engine" | "social_forum" | "review_site" | "app_store" | "product_directory" | "social_media" | "e_commerce" | "content_site";
export type QueryType = "category" | "task" | "compare" | "brand" | "intent" | "problem" | "pricing" | "pain_expression" | "substitute_behavior" | "vocab_refinement" | "functional_triangulation";
export type ResearchMode = "quick" | "deep";
export type ProjectStatus = "new" | "modeling" | "searching" | "completed";

export interface IdeaModel {
  statement: string;
  targetUser: string;
  coreJob: string;
  useScenario: string;
  existingAlternatives: string;
  productForm: string;
  targetBudget: string;
  researchGoal: string;
  keyConstraints: string;
  suggestedKeywords: string[];
  categories: string[];
  excludedKeywords: string[];
}

export interface SearchTask {
  platform: string;
  query: string;
  status: "success" | "pending" | "running" | "failed" | "cancelled" | "empty";
  count: number;
  durationMs: number;
  logs: string;
  retryCount: number;
  startedAt: string | null;
}

export interface Competitor {
  id: string;
  name: string;
  url: string;
  positioning: string;
  targetUser: string;
  coreFeatures: string;
  pricing: string;
  platforms: string[];
  ratings: number;
  reviewsCount: number;
  pros: string;
  cons: string;
  opportunity: string;
  categoryGroup: string;
  lastUpdated: string | null;
}

export interface UserVoice {
  id: string;
  userName: string;
  platform: string;
  title: string;
  content: string;
  sentiment: Sentiment;
  topics: string[];
  quote: string;
  strength: EvidenceStrength;
  sourceUrl: string;
  timestamp: string;
}

export type SignalType =
  | "demand_signal"
  | "pain_point_signal"
  | "alternative_signal"
  | "competitor_signal"
  | "satisfaction_signal"
  | "dissatisfaction_signal"
  | "improvement_signal"
  | "payment_signal"
  | "trend_signal"
  | "risk_signal";

export const SIGNAL_LABELS_CN: Record<SignalType, string> = {
  demand_signal: "需求信号",
  pain_point_signal: "痛点信号",
  alternative_signal: "替代信号",
  competitor_signal: "竞品信号",
  satisfaction_signal: "满意信号",
  dissatisfaction_signal: "不满信号",
  improvement_signal: "改进信号",
  payment_signal: "付费信号",
  trend_signal: "趋势信号",
  risk_signal: "风险信号",
};

export const SIGNAL_LABELS_EN: Record<SignalType, string> = {
  demand_signal: "Demand Signal",
  pain_point_signal: "Pain Point Signal",
  alternative_signal: "Alternative Signal",
  competitor_signal: "Competitor Signal",
  satisfaction_signal: "Satisfaction Signal",
  dissatisfaction_signal: "Dissatisfaction Signal",
  improvement_signal: "Improvement Signal",
  payment_signal: "Payment Signal",
  trend_signal: "Trend Signal",
  risk_signal: "Risk Signal",
};

export interface Signal {
  id: string;
  projectId: string;
  signalType: SignalType;
  content: string;
  sourcePlatform: string;
  sourceUrl: string;
  sourceTimestamp: string;
  topicTags: string[];
  sentiment: Sentiment;
  evidenceStrength: EvidenceStrength;
  confidenceScore: number;
  crossPlatformCount: number;
  representativeNote: string;
}

export interface DimensionScore {
  name: string;
  score: number;
  reason: string;
  description: string;
  evidenceCount: number;
  crossPlatformConsistency: number;
  sampleSources: string[];
}

export interface Evaluation {
  overallRecommendation: string;
  confidenceScore: number;
  dimensions: DimensionScore[];
  keyOpportunities: string;
  keyRisks: string;
  uncertaintyNote: string;
}

export interface Strategy {
  marketScenario: string;
  suggestedPath: string;
  positioningStatement: string;
  mustHaveFeatures: string[];
  avoidFeatures: string[];
  offensiveTactics: string;
}

export interface ValidationAction {
  category: string;
  target: string;
  action: string;
  expectedAssertion: string;
  duration: string;
  details: string;
}

export interface PlatformWeights {
  reddit: number;
  google: number;
  bing: number;
  g2: number;
  store: number;
  xTwitter: number;
  productHunt: number;
  alternativeTo: number;
  ecommerce: number;
  quora: number;
  tiktok: number;
  trustpilot: number;
  chromeWebStore: number;
  googlePlay: number;
  googleTrends: number;
  youtube: number;
  linkedin: number;
  zhihu: number;
  tieba: number;
  douban: number;
}

export interface QueryTemplate {
  name: string;
  template: string;
  enabled: boolean;
  queryType: QueryType;
  applicableProductTypes: string[];
}

export interface ParseFields {
  title: boolean;
  summary: boolean;
  comments: boolean;
  rating: boolean;
  date: boolean;
  author: boolean;
  rawHtml: boolean;
}

export interface SignalWeights {
  demandSignal: number;
  dissatisfactionSignal: number;
  reviewCredibility: number;
  freshness: number;
}

export interface PlatformConfig {
  name: string;
  enabled: boolean;
  priority: number;
  platformType: PlatformType;
  baseUrls: string[];
  queryTemplates: QueryTemplate[];
  rateLimitRps: number;
  timeoutMs: number;
  maxPages: number;
  maxResults: number;
  maxConcurrency: number;
  retryCount: number;
  backoffStrategy: string;
  defaultRegion: string;
  defaultLanguage: string;
  participateQuick: boolean;
  participateDeep: boolean;
  parseFields: ParseFields;
  signalWeights: SignalWeights;
}

export interface ResearchProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  ideaModel: IdeaModel;
  searchTasks: SearchTask[];
  competitors: Competitor[];
  userVoices: UserVoice[];
  signals: Signal[];
  evaluation: Evaluation;
  strategy: Strategy;
  validationPlan: ValidationAction[];
  platformWeights: PlatformWeights;
  enabledPlatforms: string[];
  researchMode: ResearchMode;
  region: string;
  language: string;
  topicClusters: TopicCluster[];
  vocabSet?: VocabSet;
}

export interface TopicCluster {
  name: string;
  count: number;
  negativeCount: number;
  positiveCount: number;
  neutralCount: number;
  platforms: string[];
  sampleQuotes: string[];
  frictionPercentage: number;
}

export interface AppSettings {
  language: "zh" | "en";
  theme: "light" | "dark";
  globalMaxConcurrent: number;
  defaultCrawlDepth: "quick" | "deep";
  autoBackup: boolean;
  saveHtml: boolean;
  sqlitePath: string;
  logLevel: string;
}

export interface SerializedProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  dataJson: string;
}

export interface ReportContent {
  markdown: string;
  html: string;
  json: string;
}

export interface CategoryCandidate {
  name: string;
  level: number;
  confidence: number;
}

export interface PlatformPrioritySuggestion {
  platform: string;
  priority: number;
  reason: string;
}

export interface IdeaModelExtension {
  targetUser: string;
  coreJob: string;
  useScenario: string;
  existingAlternatives: string[];
  productForm: string;
  categories: CategoryCandidate[];
  suggestedKeywords: string[];
  platformPriority: PlatformPrioritySuggestion[];
}

export interface SystemReminder {
  id: string;
  type: "warning" | "info" | "success" | "error";
  message: string;
  timestamp: string;
  dismissed: boolean;
}

export type SnapshotType = "manual" | "auto" | "checkpoint";

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  versionNumber: number;
  snapshotType: SnapshotType;
  label: string;
  description: string;
  projectJson: string;
  checkpointStage: string | null;
  createdAt: string;
}

export interface AppStats {
  totalProjects: number;
  totalCompetitors: number;
  totalRawDocuments: number;
  recent7dProjects: number;
}

export interface ExportRecord {
  id: string;
  projectId: string;
  format: string;
  generatedAt: string;
}

export interface CompetitorEvidence {
  platform: string;
  queryText: string;
  title: string;
  url: string;
  summary: string;
  capturedAt: string;
}

export interface VocabSet {
  painExpressions: string[];
  substituteBehaviors: string[];
  communityNativeTerms: string[];
  competitorContextTerms: string[];
}
