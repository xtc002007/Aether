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
}

export interface SearchTask {
  platform: string;
  query: string;
  status: "success" | "pending" | "running" | "failed";
  count: number;
  duration: number; // in ms
  logs: string;
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
  categoryGroup: string; // "Direct Competitor" | "Indirect" | "Alternatives" | "Niches"
}

export interface UserVoice {
  id: string;
  userName: string;
  platform: string;
  title: string;
  content: string;
  sentiment: "positive" | "negative" | "neutral";
  topics: string[];
  quote: string;
  strength: "high" | "medium" | "low";
  sourceUrl: string;
  timestamp: string;
}

export interface DimensionScore {
  name: string;
  score: number;
  reason: string;
}

export interface Evaluation {
  overallRecommendation: string;
  confidenceScore: number;
  dimensions: DimensionScore[];
  keyOpportunities: string;
  keyRisks: string;
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

export interface ResearchProject {
  id: string;
  name: string;
  createdAt: string;
  status: "new" | "modeling" | "searching" | "completed";
  ideaModel: IdeaModel;
  searchTasks: SearchTask[];
  competitors: Competitor[];
  userVoices: UserVoice[];
  evaluation: Evaluation;
  strategy: Strategy;
  validationPlan: ValidationAction[];
  
  // Weights override settings for project adjustment
  platformWeights: {
    reddit: number;
    google: number;
    g2: number;
    store: number;
  };
  enabledPlatforms: string[];
}

export interface AppSettings {
  language: "zh" | "en";
  theme: "light" | "dark";
  globalMaxConcurrent: number;
  defaultCrawlDepth: "quick" | "deep";
  autoBackup: boolean;
  saveHtml: boolean;
  sqlitePath: string;
}
