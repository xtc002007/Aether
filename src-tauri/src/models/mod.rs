use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdeaModel {
    pub statement: String,
    pub target_user: String,
    pub core_job: String,
    pub use_scenario: String,
    pub existing_alternatives: String,
    pub product_form: String,
    pub target_budget: String,
    pub research_goal: String,
    pub key_constraints: String,
    pub suggested_keywords: Vec<String>,
    pub categories: Vec<String>,
    pub excluded_keywords: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchTask {
    pub platform: String,
    pub query: String,
    pub status: SearchTaskStatus,
    pub count: i32,
    pub duration_ms: i64,
    pub logs: String,
    pub retry_count: i32,
    pub started_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SearchTaskStatus {
    Pending,
    Running,
    Success,
    /// The adapter ran without error but returned zero results.
    Empty,
    Failed,
    Cancelled,
}

impl SearchTaskStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            SearchTaskStatus::Pending => "pending",
            SearchTaskStatus::Running => "running",
            SearchTaskStatus::Success => "success",
            SearchTaskStatus::Empty => "empty",
            SearchTaskStatus::Failed => "failed",
            SearchTaskStatus::Cancelled => "cancelled",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Competitor {
    pub id: String,
    pub name: String,
    pub url: String,
    pub positioning: String,
    pub target_user: String,
    pub core_features: String,
    pub pricing: String,
    pub platforms: Vec<String>,
    pub ratings: f64,
    pub reviews_count: i64,
    pub pros: String,
    pub cons: String,
    pub opportunity: String,
    pub category_group: String,
    pub last_updated: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserVoice {
    pub id: String,
    pub user_name: String,
    pub platform: String,
    pub title: String,
    pub content: String,
    pub sentiment: Sentiment,
    pub topics: Vec<String>,
    pub quote: String,
    pub strength: EvidenceStrength,
    pub source_url: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Sentiment {
    Positive,
    Negative,
    Neutral,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceStrength {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Signal {
    pub id: String,
    pub project_id: String,
    pub signal_type: SignalType,
    pub content: String,
    pub source_platform: String,
    pub source_url: String,
    pub source_timestamp: String,
    pub topic_tags: Vec<String>,
    pub sentiment: Sentiment,
    pub evidence_strength: EvidenceStrength,
    pub confidence_score: f64,
    pub cross_platform_count: i32,
    pub representative_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SignalType {
    DemandSignal,
    PainPointSignal,
    AlternativeSignal,
    CompetitorSignal,
    SatisfactionSignal,
    DissatisfactionSignal,
    ImprovementSignal,
    PaymentSignal,
    TrendSignal,
    RiskSignal,
}

impl SignalType {
    pub fn label_cn(&self) -> &'static str {
        match self {
            SignalType::DemandSignal => "需求信号",
            SignalType::PainPointSignal => "痛点信号",
            SignalType::AlternativeSignal => "替代信号",
            SignalType::CompetitorSignal => "竞品信号",
            SignalType::SatisfactionSignal => "满意信号",
            SignalType::DissatisfactionSignal => "不满信号",
            SignalType::ImprovementSignal => "改进信号",
            SignalType::PaymentSignal => "付费信号",
            SignalType::TrendSignal => "趋势信号",
            SignalType::RiskSignal => "风险信号",
        }
    }

    pub fn label_en(&self) -> &'static str {
        match self {
            SignalType::DemandSignal => "Demand Signal",
            SignalType::PainPointSignal => "Pain Point Signal",
            SignalType::AlternativeSignal => "Alternative Signal",
            SignalType::CompetitorSignal => "Competitor Signal",
            SignalType::SatisfactionSignal => "Satisfaction Signal",
            SignalType::DissatisfactionSignal => "Dissatisfaction Signal",
            SignalType::ImprovementSignal => "Improvement Signal",
            SignalType::PaymentSignal => "Payment Signal",
            SignalType::TrendSignal => "Trend Signal",
            SignalType::RiskSignal => "Risk Signal",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DimensionScore {
    pub name: String,
    pub score: i32,
    pub reason: String,
    pub description: String,
    pub evidence_count: i32,
    pub cross_platform_consistency: f64,
    pub sample_sources: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Evaluation {
    pub overall_recommendation: String,
    pub confidence_score: i32,
    pub dimensions: Vec<DimensionScore>,
    pub key_opportunities: String,
    pub key_risks: String,
    pub uncertainty_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Strategy {
    pub market_scenario: String,
    pub suggested_path: String,
    pub positioning_statement: String,
    pub must_have_features: Vec<String>,
    pub avoid_features: Vec<String>,
    pub offensive_tactics: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationAction {
    pub category: String,
    pub target: String,
    pub action: String,
    pub expected_assertion: String,
    pub duration: String,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResearchProject {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub status: ProjectStatus,
    pub idea_model: IdeaModel,
    pub search_tasks: Vec<SearchTask>,
    pub competitors: Vec<Competitor>,
    pub user_voices: Vec<UserVoice>,
    pub signals: Vec<Signal>,
    pub evaluation: Evaluation,
    pub strategy: Strategy,
    pub validation_plan: Vec<ValidationAction>,
    pub platform_weights: PlatformWeights,
    pub enabled_platforms: Vec<String>,
    pub research_mode: ResearchMode,
    pub region: String,
    pub language: String,
    pub topic_clusters: Vec<TopicCluster>,
    /// Community-native vocabulary extracted from first-round search results
    #[serde(default)]
    pub vocab_set: Option<VocabSet>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProjectStatus {
    New,
    Modeling,
    Searching,
    Completed,
}

impl ProjectStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectStatus::New => "new",
            ProjectStatus::Modeling => "modeling",
            ProjectStatus::Searching => "searching",
            ProjectStatus::Completed => "completed",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformWeights {
    pub reddit: f64,
    pub google: f64,
    pub bing: f64,
    pub g2: f64,
    pub store: f64,
    pub x_twitter: f64,
    pub product_hunt: f64,
    pub alternative_to: f64,
    pub ecommerce: f64,
    pub quora: f64,
    pub tiktok: f64,
    pub trustpilot: f64,
    pub chrome_web_store: f64,
    pub google_play: f64,
    pub google_trends: f64,
    pub youtube: f64,
    pub linkedin: f64,
    pub zhihu: f64,
    pub tieba: f64,
    pub douban: f64,
}

impl Default for PlatformWeights {
    fn default() -> Self {
        Self {
            reddit: 1.0,
            google: 1.0,
            bing: 0.9,
            g2: 1.0,
            store: 1.0,
            x_twitter: 0.8,
            product_hunt: 0.7,
            alternative_to: 0.7,
            ecommerce: 0.5,
            quora: 0.8,
            tiktok: 0.6,
            trustpilot: 0.8,
            chrome_web_store: 0.5,
            google_play: 0.9,
            google_trends: 0.6,
            youtube: 0.6,
            linkedin: 0.6,
            zhihu: 0.7,
            tieba: 0.6,
            douban: 0.6,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ResearchMode {
    Quick,
    Deep,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub language: String,
    pub theme: String,
    pub global_max_concurrent: i32,
    pub default_crawl_depth: ResearchMode,
    pub auto_backup: bool,
    pub auto_update_enabled: bool,
    pub save_html: bool,
    pub sqlite_path: String,
    pub log_level: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            language: "zh".to_string(),
            theme: "light".to_string(),
            global_max_concurrent: 8,
            default_crawl_depth: ResearchMode::Quick,
            auto_backup: true,
            auto_update_enabled: true,
            save_html: false,
            sqlite_path: "./data/aether.db".to_string(),
            log_level: "info".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformConfig {
    pub name: String,
    pub enabled: bool,
    pub priority: i32,
    pub platform_type: PlatformType,
    pub base_urls: Vec<String>,
    pub query_templates: Vec<QueryTemplate>,
    pub rate_limit_rps: f64,
    pub timeout_ms: i64,
    pub max_pages: i32,
    pub max_results: i32,
    pub max_concurrency: i32,
    pub retry_count: i32,
    pub backoff_strategy: String,
    pub default_region: String,
    pub default_language: String,
    pub participate_quick: bool,
    pub participate_deep: bool,
    pub parse_fields: ParseFields,
    pub signal_weights: SignalWeights,
}

impl PlatformConfig {
    /// The language queries should be generated in for this platform.
    /// This is independent of the user's UI/output language.
    pub fn search_language(&self) -> &str {
        &self.default_language
    }

    /// Whether this platform's primary language is Chinese.
    pub fn is_chinese_platform(&self) -> bool {
        self.default_language == "zh"
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PlatformType {
    SearchEngine,
    SocialForum,
    ReviewSite,
    AppStore,
    ProductDirectory,
    SocialMedia,
    ECommerce,
    ContentSite,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryTemplate {
    pub name: String,
    pub template: String,
    pub enabled: bool,
    pub query_type: QueryType,
    pub applicable_product_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum QueryType {
    Category,
    Task,
    Compare,
    Brand,
    Intent,
    Problem,
    Pricing,
    /// Pain-expression query: "how do I [manual task]", "is there a way to [job]"
    PainExpression,
    /// Substitute-behavior query: "I manually [substitute behavior]", "using [tool] to [task]"
    SubstituteBehavior,
    /// Second-round refinement query using community-native vocabulary
    VocabRefinement,
    /// Functional triangulation: context-based competitor discovery
    FunctionalTriangulation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseFields {
    pub title: bool,
    pub summary: bool,
    pub comments: bool,
    pub rating: bool,
    pub date: bool,
    pub author: bool,
    pub raw_html: bool,
}

impl Default for ParseFields {
    fn default() -> Self {
        Self {
            title: true,
            summary: true,
            comments: true,
            rating: true,
            date: true,
            author: true,
            raw_html: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignalWeights {
    pub demand_signal: f64,
    pub dissatisfaction_signal: f64,
    pub review_credibility: f64,
    pub freshness: f64,
}

impl Default for SignalWeights {
    fn default() -> Self {
        Self {
            demand_signal: 1.0,
            dissatisfaction_signal: 1.0,
            review_credibility: 1.0,
            freshness: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicCluster {
    pub name: String,
    pub count: i32,
    pub negative_count: i32,
    pub positive_count: i32,
    pub neutral_count: i32,
    pub platforms: Vec<String>,
    pub sample_quotes: Vec<String>,
    pub friction_percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SerializedProject {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub status: String,
    pub data_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportContent {
    pub markdown: String,
    pub html: String,
    pub json: String,
}

// ── LLM response types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdeaModelExtension {
    pub target_user: String,
    pub core_job: String,
    pub use_scenario: String,
    pub existing_alternatives: Vec<String>,
    pub product_form: String,
    pub categories: Vec<CategoryCandidate>,
    pub suggested_keywords: Vec<String>,
    pub platform_priority: Vec<PlatformPriority>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryCandidate {
    pub name: String,
    pub level: i32, // 1=primary, 2=secondary, 3=tertiary
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformPriority {
    pub platform: String,
    pub priority: i32,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryPlan {
    pub query_type: String,
    pub queries: Vec<String>,
    pub target_platforms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmStrategyOutput {
    pub market_scenario: String,
    pub suggested_path: String,
    pub positioning_statement: String,
    pub must_have_features: Vec<String>,
    pub avoid_features: Vec<String>,
    pub offensive_tactics: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmValidationOutput {
    pub plans: Vec<ValidationAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmSignalsOutput {
    pub signals: Vec<ExtractedSignal>,
}

// ── Snapshot / Version Management ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub id: String,
    pub project_id: String,
    pub version_number: i32,
    pub snapshot_type: SnapshotType,
    pub label: String,
    pub description: String,
    pub project_json: String,
    pub checkpoint_stage: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SnapshotType {
    Manual,
    Auto,
    Checkpoint,
}

impl SnapshotType {
    pub fn label_en(&self) -> &'static str {
        match self {
            SnapshotType::Manual => "Manual",
            SnapshotType::Auto => "Auto",
            SnapshotType::Checkpoint => "Checkpoint",
        }
    }

    pub fn label_cn(&self) -> &'static str {
        match self {
            SnapshotType::Manual => "手动",
            SnapshotType::Auto => "自动",
            SnapshotType::Checkpoint => "检查点",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedSignal {
    pub signal_type: String,
    pub content: String,
    pub sentiment: String,
    pub evidence_strength: String,
    pub confidence_score: f64,
    pub topic_tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStats {
    pub total_projects: i64,
    pub total_competitors: i64,
    pub total_raw_documents: i64,
    pub recent_7d_projects: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRecord {
    pub id: String,
    pub project_id: String,
    pub format: String,
    pub generated_at: String,
}

// ── Vocabulary Discovery types ──

/// Community-native vocabulary extracted from first-round search results.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VocabSet {
    /// User pain expressions in natural language: "how to find competitors before building"
    pub pain_expressions: Vec<String>,
    /// Manual substitute behavior descriptions: "manually checking Reddit for product ideas"
    pub substitute_behaviors: Vec<String>,
    /// High-frequency community-native terms from results: "market validation", "prior art"
    pub community_native_terms: Vec<String>,
    /// Vocabulary surrounding competitor mentions
    pub competitor_context_terms: Vec<String>,
}

/// Platform vocabulary transform configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformVocabConfig {
    pub platform: String,
    pub sub_communities: Vec<SubCommunityVocab>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubCommunityVocab {
    pub name: String,
    pub preferred_terms: Vec<String>,
    pub avoid_terms: Vec<String>,
    pub frame: String,
}
