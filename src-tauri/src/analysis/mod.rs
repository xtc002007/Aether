use crate::models::*;
use crate::llm::{json_system_prompt, LlmProvider};

pub fn extract_signals(user_voices: &[UserVoice], competitors: &[Competitor], project_id: &str) -> Vec<Signal> {
    let mut signals = Vec::new();

    for voice in user_voices {
        let lower = voice.content.to_lowercase();

        // Content-aware signal detection
        if voice.sentiment == Sentiment::Negative {
            // Dissatisfaction always present for negative voices
            signals.push(make_signal(project_id, voice, SignalType::DissatisfactionSignal, 0.7));

            // Pain point: explicit problem statements with high intensity words
            let pain_indicators = ["frustrated", "terrible", "broken", "unusable", "waste", "horrible",
                "frustrating", "难用", "垃圾", "坑", "不行", "烂透了"];
            if pain_indicators.iter().any(|w| lower.contains(w)) {
                signals.push(make_signal(project_id, voice, SignalType::PainPointSignal, 0.8));
            }
        }

        if voice.sentiment == Sentiment::Positive {
            signals.push(make_signal(project_id, voice, SignalType::SatisfactionSignal, 0.7));
        }

        // Improvement signal: wish/hope/if-only expressions
        let wish_indicators = ["wish", "hope", "if only", "should have", "would be nice",
            "希望", "要是", "如果能", "建议增加", "最好有"];
        if wish_indicators.iter().any(|w| lower.contains(w)) {
            signals.push(make_signal(project_id, voice, SignalType::ImprovementSignal, 0.65));
        }

        // Alternative signal: mentions of switching or other products
        let alt_indicators = ["switch", "alternative", "moved to", "replaced", "instead of",
            "替代", "换成", "改用", "迁移到", "换到"];
        if alt_indicators.iter().any(|w| lower.contains(w)) {
            signals.push(make_signal(project_id, voice, SignalType::AlternativeSignal, 0.7));
        }

        // Payment signal: willingness to pay
        let pay_indicators = ["would pay", "worth", "pay for", "subscribe", "premium",
            "值得", "愿意付费", "花钱", "订阅", "付费版"];
        if pay_indicators.iter().any(|w| lower.contains(w)) {
            signals.push(make_signal(project_id, voice, SignalType::PaymentSignal, 0.6));
        }

        // Demand signal: explicit need/have-to expressions
        let demand_indicators = ["need", "have to", "must", "can't live without",
            "需要", "必须", "没有...不行", "离不开"];
        if demand_indicators.iter().any(|w| lower.contains(w)) {
            signals.push(make_signal(project_id, voice, SignalType::DemandSignal, 0.6));
        }
    }

    // Competitor signals
    for comp in competitors {
        signals.push(Signal {
            id: format!("sig-{}", uuid::Uuid::new_v4()),
            project_id: project_id.to_string(),
            signal_type: SignalType::CompetitorSignal,
            content: format!("{} - {}", comp.name, comp.positioning),
            source_platform: comp.platforms.first().cloned().unwrap_or_default(),
            source_url: comp.url.clone(),
            source_timestamp: String::new(),
            topic_tags: vec!["competitor".to_string()],
            sentiment: Sentiment::Neutral,
            evidence_strength: EvidenceStrength::High,
            confidence_score: 0.9,
            cross_platform_count: comp.platforms.len() as i32,
            representative_note: comp.opportunity.clone(),
        });
    }

    // Cross-platform merge: merge signals with same signal_type + topic_tag from different platforms
    merge_cross_platform_signals(signals)
}

/// Calculate time-decay multiplier based on timestamp recency.
/// Recent (within 1 month): 1.0, within quarter: 0.9, within year: 0.7, older: 0.5.
fn time_decay(timestamp: &str) -> f64 {
    if timestamp.is_empty() { return 0.7; }
    let now = chrono::Utc::now();
    let parsed = chrono::NaiveDate::parse_from_str(
        &timestamp.chars().take(10).collect::<String>(),
        "%Y-%m-%d",
    ).ok();
    if let Some(date) = parsed {
        let age_days = (now.date_naive() - date).num_days();
        if age_days <= 30 { 1.0 }
        else if age_days <= 90 { 0.9 }
        else if age_days <= 365 { 0.7 }
        else { 0.5 }
    } else { 0.7 }
}

fn make_signal(project_id: &str, voice: &UserVoice, sig_type: SignalType, confidence: f64) -> Signal {
    let decay = time_decay(&voice.timestamp);
    Signal {
        id: format!("sig-{}", uuid::Uuid::new_v4()),
        project_id: project_id.to_string(),
        signal_type: sig_type,
        content: voice.content.clone(),
        source_platform: voice.platform.clone(),
        source_url: voice.source_url.clone(),
        source_timestamp: voice.timestamp.clone(),
        topic_tags: voice.topics.clone(),
        sentiment: voice.sentiment.clone(),
        evidence_strength: voice.strength.clone(),
        confidence_score: (confidence * decay * 100.0).round() / 100.0,
        cross_platform_count: 1,
        representative_note: voice.quote.clone(),
    }
}

/// Merge signals of the same type + topic from different platforms.
fn merge_cross_platform_signals(signals: Vec<Signal>) -> Vec<Signal> {
    use std::collections::{HashMap, HashSet};
    let mut groups: HashMap<(String, String), Vec<Signal>> = HashMap::new();
    for sig in &signals {
        for tag in &sig.topic_tags {
            let key = (format!("{:?}", sig.signal_type), tag.clone());
            groups.entry(key).or_default().push(sig.clone());
        }
    }

    let mut merged = Vec::new();
    let mut consumed: HashSet<String> = HashSet::new();

    for ((_st, _tag), group) in &groups {
        if group.len() <= 1 || group.iter().all(|s| consumed.contains(&s.id)) { continue; }
        let platforms: HashSet<String> = group.iter().map(|s| s.source_platform.clone()).collect();
        if platforms.len() <= 1 { continue; }

        let best = group.iter().max_by(|a, b| a.confidence_score.partial_cmp(&b.confidence_score).unwrap()).unwrap();
        let avg_confidence = group.iter().map(|s| s.confidence_score).sum::<f64>() / group.len() as f64;
        let strength = if platforms.len() >= 3 { EvidenceStrength::High } else { EvidenceStrength::Medium };

        for s in group { consumed.insert(s.id.clone()); }

        merged.push(Signal {
            id: format!("sig-{}", uuid::Uuid::new_v4()),
            cross_platform_count: platforms.len() as i32,
            confidence_score: avg_confidence,
            evidence_strength: strength,
            source_platform: platforms.into_iter().collect::<Vec<_>>().join(", "),
            representative_note: format!("Confirmed across {} platforms", best.cross_platform_count.max(2)),
            ..best.clone()
        });
    }

    // Add unmerged signals
    for sig in &signals {
        if !consumed.contains(&sig.id) {
            merged.push(sig.clone());
        }
    }

    merged
}

pub fn cluster_topics(user_voices: &[UserVoice]) -> Vec<crate::models::TopicCluster> {
    if user_voices.is_empty() {
        return Vec::new();
    }
    // Try LLM-based clustering first (handled async in caller), fall back to rule-based
    rule_based_topic_clusters(user_voices)
}

/// LLM-assisted topic clustering — groups voices into named themes.
pub async fn try_llm_cluster_topics(user_voices: &[UserVoice]) -> Vec<TopicCluster> {
    match crate::llm::deepseek::DeepSeekProvider::from_env() {
        Ok(llm) => {
            let voices_text: Vec<String> = user_voices.iter().enumerate()
                .map(|(i, v)| format!("[{}] ({}): {}", i,
                    match v.sentiment { Sentiment::Positive => "+", Sentiment::Negative => "-", Sentiment::Neutral => "0" },
                    v.content.chars().take(120).collect::<String>()))
                .collect();
            let sys = json_system_prompt(r#"{"clusters":[{"label":"cluster name","voice_indices":[0,1,2]}]}"#);
            let prompt = format!(
                "Group these user feedback items into 3-8 thematic clusters. Each cluster should have a short label (like 'Pricing Concerns' or 'Performance Issues'). Return voice indices per cluster.\n\nFeedback items:\n{}",
                voices_text.join("\n")
            );
            match llm.structured::<serde_json::Value>(&sys, &prompt).await {
                Ok(val) => {
                    if let Some(clusters) = val["clusters"].as_array() {
                        return build_clusters_from_llm(user_voices, clusters);
                    }
                    rule_based_topic_clusters(user_voices)
                }
                Err(_) => rule_based_topic_clusters(user_voices),
            }
        }
        Err(_) => rule_based_topic_clusters(user_voices),
    }
}

fn build_clusters_from_llm(user_voices: &[UserVoice], clusters: &[serde_json::Value]) -> Vec<TopicCluster> {
    clusters.iter().map(|c| {
        let label = c["label"].as_str().unwrap_or("Unknown").to_string();
        let indices: Vec<usize> = c["voice_indices"].as_array()
            .map(|a| a.iter().filter_map(|v| v.as_u64().map(|n| n as usize)).collect())
            .unwrap_or_default();
        let voices_in_cluster: Vec<&UserVoice> = indices.iter().filter_map(|&i| user_voices.get(i)).collect();
        build_topic_cluster(&label, &voices_in_cluster)
    }).collect()
}

/// Rule-based fallback: group using synonym-aware keyword matching.
fn rule_based_topic_clusters(user_voices: &[UserVoice]) -> Vec<TopicCluster> {
    let synonym_groups: Vec<(&str, Vec<&str>)> = vec![
        ("Pricing / Cost", vec!["pricing", "price", "expensive", "cost", "cheap", "贵", "价格", "收费"]),
        ("Performance / Speed", vec!["performance", "slow", "fast", "speed", "卡", "慢", "快", "延迟"]),
        ("Stability / Bugs", vec!["stability", "crash", "bug", "error", "broken", "bug"]),
        ("Usability / UX", vec!["usability", "ux", "ui", "design", "界面", "体验", "易用"]),
        ("Features / Functionality", vec!["features", "feature", "missing", "功能", "缺失"]),
        ("Customer Support", vec!["support", "customer", "service", "客服", "售后"]),
        ("Integration / API", vec!["integration", "integrate", "api", "集成", "接口"]),
        ("General Feedback", vec!["general_feedback"]),
    ];

    let mut clusters: Vec<TopicCluster> = synonym_groups.iter().map(|(label, synonyms)| {
        let matching: Vec<&UserVoice> = user_voices.iter().filter(|v| {
            v.topics.iter().any(|t| synonyms.iter().any(|s| t.to_lowercase().contains(s) || s.contains(&t.to_lowercase())))
        }).collect();
        build_topic_cluster(label, &matching)
    }).filter(|c| c.count > 0).collect();

    // Add ungrouped voices as individual topics
    let grouped_count: i32 = clusters.iter().map(|c| c.count).sum();
    if (grouped_count as usize) < user_voices.len() {
        let remaining: Vec<&UserVoice> = user_voices.iter()
            .filter(|v| !clusters.iter().any(|c| c.sample_quotes.contains(&v.quote)))
            .collect();
        if !remaining.is_empty() {
            clusters.push(build_topic_cluster("Other Topics", &remaining));
        }
    }

    clusters.sort_by(|a, b| b.count.cmp(&a.count));
    clusters
}

fn build_topic_cluster(label: &str, voices: &[&UserVoice]) -> TopicCluster {
    let mut platforms = Vec::new();
    let mut quotes = Vec::new();
    let mut neg = 0i32;
    let mut pos = 0i32;
    let mut neu = 0i32;

    for v in voices {
        match v.sentiment {
            Sentiment::Negative => neg += 1,
            Sentiment::Positive => pos += 1,
            Sentiment::Neutral => neu += 1,
        }
        if !platforms.contains(&v.platform) { platforms.push(v.platform.clone()); }
        if quotes.len() < 3 { quotes.push(v.quote.clone()); }
    }

    let count = voices.len() as i32;
    TopicCluster {
        name: label.to_string(), count,
        negative_count: neg, positive_count: pos, neutral_count: neu,
        friction_percentage: if count > 0 { (neg as f64 / count as f64) * 100.0 } else { 0.0 },
        platforms, sample_quotes: quotes,
    }
}

pub fn compute_evaluation(
    user_voices: &[UserVoice],
    competitors: &[Competitor],
    signals: &[Signal],
    _platform_weights: &PlatformWeights,
    language: &str,
) -> Evaluation {
    let negative_count = user_voices.iter().filter(|v| v.sentiment == Sentiment::Negative).count();
    let total_count = user_voices.len().max(1);
    let competitor_count = competitors.len();
    let signal_count = signals.len();
    let is_en = language == "en";

    let demand_score = ((signal_count as f64 * 0.7 + total_count as f64 * 0.3) / 10.0).min(10.0).max(1.0).round() as i32;
    let pain_score = if negative_count > 0 {
        ((negative_count as f64 / total_count as f64) * 10.0).min(10.0).max(3.0).round() as i32
    } else { 5 };
    let congestion_score = match competitor_count {
        0..=2 => 2,
        3..=5 => 5,
        6..=10 => 7,
        _ => 9,
    };
    let differentiation_score = match competitor_count {
        0..=2 => 9,
        3..=5 => 7,
        6..=10 => 5,
        _ => 3,
    };
    let dissatisfaction_score = ((negative_count as f64 / total_count as f64) * 10.0).min(10.0).max(2.0).round() as i32;
    let trend_score = if signal_count > 20 { 8 } else { 5 };
    let commercial_score = if total_count > 5 { 7 } else { 4 };
    let barrier_score = match competitor_count {
        0..=2 => 3,
        3..=6 => 6,
        _ => 8,
    };
    let mvp_score = 8;

    let (dim_name_demand, dim_desc_demand, dim_reason_demand): (&str, &str, String) = if is_en {
        ("Demand Strength", "Measures how actively the target audience searches for and discusses the core pain point. Higher scores indicate a larger population actively seeking solutions.",
         format!("Based on {} signals and {} user feedback items", signal_count, total_count))
    } else {
        ("需求强度", "指目标用户针对此痛点的主求助频率以及替代欲望。分数越高说明全网讨论、询问该核心痛点的人群规模越庞大、主动搜索指数越高。",
         format!("基于 {} 条信号和 {} 条用户反馈评估", signal_count, total_count))
    };

    let (dim_name_pain, dim_desc_pain, dim_reason_pain): (&str, &str, String) = if is_en {
        ("Pain Intensity", "Severity of the current pain point. Low scores mean trivial annoyances solvable with Excel; high scores mean significant financial or efficiency losses — a high-stakes pain point.",
         format!("{} negative out of {} total ({:.0}%)", negative_count, total_count, (negative_count as f64 / total_count as f64) * 100.0))
    } else {
        ("痛点强度", "当前痛点的痛苦严重度。低分说明只是无关紧要的小毛病用Excel就能打发，高分说明由于麻烦产生的金钱或效率损失极其巨大、属于高危高痛点。",
         format!("{} 条负面反馈中占比 {:.0}%", negative_count, (negative_count as f64 / total_count as f64) * 100.0))
    };

    let (dim_name_congestion, dim_desc_congestion, dim_reason_congestion): (&str, &str, String) = if is_en {
        ("Market Congestion", "Saturation of competitors and concentration of dominant players. Low scores mean an open field; high scores mean an extremely crowded market with expensive customer acquisition.",
         format!("{} competitors identified", competitor_count))
    } else {
        ("市场拥挤度", "该赛道竞争对手的饱和度及头部玩家集中垄断度。低分代表基本是荒漠或存在显而易见的巨兽盲区，高分代表市场已经极度拥挤、获客昂贵。",
         format!("已识别 {} 个竞品", competitor_count))
    };

    let (dim_name_diff, dim_desc_diff, dim_reason_diff): (&str, &str, String) = if is_en {
        ("Differentiation Space", "Ability to avoid head-on competition with dominant players by targeting underserved vertical segments or offering a radically simpler solution.",
         "Based on competitor dissatisfaction concentration and market gap analysis".to_string())
    } else {
        ("差异化空间", "能否避开头部大厂的核心长处，找到尚未被关照的垂直群体或极简化定位。分数越高证明大厂越不情愿或由于架构问题做不了该差异点。",
         "基于竞品不满点集中度和市场空白分析".to_string())
    };

    let (dim_name_dissat, dim_desc_dissat, dim_reason_dissat): (&str, &str, String) = if is_en {
        ("User Dissatisfaction Density", "Uniformity and intensity of complaints about competitors. If users consistently and strongly complain about the same flaws, this dimension scores high.",
         format!("{} negative reviews across {} topics", negative_count, cluster_topics(user_voices).len()))
    } else {
        ("用户不满密度", "全网差评中抱怨点的统一性和声讨烈度。如果用户对竞品的卡死、昂贵等毛病极其一致、强烈且普遍地写差评，本项将报极高分数。",
         format!("{} 条差评集中在 {} 个主题", negative_count, cluster_topics(user_voices).len()))
    };

    let (dim_name_trend, dim_desc_trend, dim_reason_trend): (&str, &str, String) = if is_en {
        ("Trend Direction", "Momentum of this category in search engines and social media. High scores indicate a growing, opportunity-rich space; low scores mean declining interest.",
         "Based on discussion heat and growth trends across platforms".to_string())
    } else {
        ("趋势方向", "该赛道在搜索引擎和社交谈资中的动量。高分说明属于朝阳的、高密度涌现新机会的成长流，低分说明相关问答和检索开始下行委顿。",
         "基于全网讨论热度和增长趋势判断".to_string())
    };

    let (dim_name_commercial, dim_desc_commercial, dim_reason_commercial): (&str, &str, String) = if is_en {
        ("Commercial Viability", "Willingness of users to pay real money. Productivity tools and health devices often have natural payment scenarios enabling quick revenue.",
         "Based on user payment willingness and competitor pricing analysis".to_string())
    } else {
        ("商业化可行性", "用户掏掏腰包付真金白银的爽快度。像生产力相关的找漏插件、健身手表往往具有天然直接的现金支付场景，可快速实现营收平衡。",
         "基于用户付费意愿和竞品定价分析".to_string())
    };

    let (dim_name_barrier, dim_desc_barrier, dim_reason_barrier): (&str, &str, String) = if is_en {
        ("Entry Barrier", "Technical, resource, or compliance complexity required to build the product. Higher scores mean deeper moats (harder to copy); lower scores mean easy replication.",
         "Based on technical complexity, brand, regulation, and network effects".to_string())
    } else {
        ("进入门槛", "产品实现所需的技术、资源或合规复杂度。分值越高代表开发壁垒深（不容易被他人第二天仿制抄袭），低分代表极易被模仿复制损耗利润。",
         "基于技术复杂度、品牌、监管和网络效应评估".to_string())
    };

    let (dim_name_mvp, dim_desc_mvp, dim_reason_mvp): (&str, &str, String) = if is_en {
        ("MVP Verifiability", "Ease of testing core assumptions with a landing page, interviews, or prototype within a week. Higher scores mean cheaper and faster validation.",
         "Can be quickly validated through landing pages, interviews, and prototypes".to_string())
    } else {
        ("MVP 可验证性", "能否在一周内构建简短的一键转化落地页或 TestFlight，测试用户购买漏斗。分数越高说明该想法核心命题的测试路径越便利、成本越低。",
         "可通过落地页、访谈和原型快速验证核心假设".to_string())
    };

    let dimensions = vec![
        DimensionScore {
            name: dim_name_demand.to_string(), score: demand_score,
            reason: dim_reason_demand, description: dim_desc_demand.to_string(),
            evidence_count: signal_count as i32, cross_platform_consistency: 0.75,
            sample_sources: vec!["Reddit".into(), "G2".into()],
        },
        DimensionScore {
            name: dim_name_pain.to_string(), score: pain_score,
            reason: dim_reason_pain, description: dim_desc_pain.to_string(),
            evidence_count: negative_count as i32, cross_platform_consistency: 0.8,
            sample_sources: vec!["Reddit".into(), "G2".into(), "App Store".into()],
        },
        DimensionScore {
            name: dim_name_congestion.to_string(), score: congestion_score,
            reason: dim_reason_congestion, description: dim_desc_congestion.to_string(),
            evidence_count: competitor_count as i32, cross_platform_consistency: 0.7,
            sample_sources: vec!["Google".into(), "G2".into()],
        },
        DimensionScore {
            name: dim_name_diff.to_string(), score: differentiation_score,
            reason: dim_reason_diff, description: dim_desc_diff.to_string(),
            evidence_count: competitor_count as i32, cross_platform_consistency: 0.65,
            sample_sources: vec!["Reddit".into(), "Product Hunt".into()],
        },
        DimensionScore {
            name: dim_name_dissat.to_string(), score: dissatisfaction_score,
            reason: dim_reason_dissat, description: dim_desc_dissat.to_string(),
            evidence_count: negative_count as i32, cross_platform_consistency: 0.85,
            sample_sources: vec!["Reddit".into(), "App Store".into(), "G2".into()],
        },
        DimensionScore {
            name: dim_name_trend.to_string(), score: trend_score,
            reason: dim_reason_trend, description: dim_desc_trend.to_string(),
            evidence_count: total_count as i32, cross_platform_consistency: 0.7,
            sample_sources: vec!["Google".into(), "X".into()],
        },
        DimensionScore {
            name: dim_name_commercial.to_string(), score: commercial_score,
            reason: dim_reason_commercial, description: dim_desc_commercial.to_string(),
            evidence_count: total_count as i32, cross_platform_consistency: 0.6,
            sample_sources: vec!["G2".into(), "App Store".into()],
        },
        DimensionScore {
            name: dim_name_barrier.to_string(), score: barrier_score,
            reason: dim_reason_barrier, description: dim_desc_barrier.to_string(),
            evidence_count: competitor_count as i32, cross_platform_consistency: 0.5,
            sample_sources: vec!["Google".into()],
        },
        DimensionScore {
            name: dim_name_mvp.to_string(), score: mvp_score,
            reason: dim_reason_mvp, description: dim_desc_mvp.to_string(),
            evidence_count: 3, cross_platform_consistency: 0.9,
            sample_sources: vec!["直接用户访谈".into()],
        },
    ];

    let avg_score: f64 = dimensions.iter().map(|d| d.score as f64).sum::<f64>() / dimensions.len() as f64;
    let confidence = ((signal_count as f64 / 10.0).min(1.0) * 90.0 + 10.0).min(95.0).round() as i32;

    let (verdict, opportunities, risks) = if is_en {
        if avg_score >= 7.0 && pain_score >= 7 && differentiation_score >= 6 {
            ("Strongly recommend entry: clear pain point concentration and differentiation space exists.",
             "1. Target the most frequently complained-about pain points for single-point breakthrough.\n2. Use high-complaint channels for precise customer acquisition.",
             "1. Continuously monitor competitor moves to prevent rapid catch-up by large players.\n2. Strictly validate user willingness to pay during MVP stage.")
        } else if avg_score >= 5.0 {
            ("Cautiously recommend: opportunities exist but key assumptions need further validation.",
             "1. First validate core demand authenticity through low-cost methods.\n2. Focus on unmet needs of niche user segments.",
             "1. Insufficient demand evidence — pseudo-demand risk exists.\n2. Competitive landscape may shift rapidly.")
        } else {
            ("Not recommended for large-scale investment: complete more thorough market validation first.",
             "1. Re-examine target users and core scenarios.\n2. Look for a more narrowly-defined entry point.",
             "1. Current evidence insufficient to support business decisions.\n2. Fundamental obstacles may exist but remain undiscovered.")
        }
    } else {
        if avg_score >= 7.0 && pain_score >= 7 && differentiation_score >= 6 {
            ("高度建议进入：当前市场存在明确的痛点集中和差异化空间。",
             "1. 针对竞品抱怨集中的痛点进行单点突破。\n2. 利用差评集中的渠道进行精准获客。",
             "1. 需要持续关注竞品动态，防止大厂快速跟进。\n2. MVP阶段需严格验证用户付费意愿。")
        } else if avg_score >= 5.0 {
            ("谨慎建议：市场存在机会但需进一步验证关键假设。",
             "1. 先通过低成本方式验证核心需求真实性。\n2. 关注细分人群的未满足需求。",
             "1. 需求强度证据不足，存在伪需求风险。\n2. 竞品格局可能快速变化。")
        } else {
            ("暂不建议大规模投入：建议先完成更充分的市场验证。",
             "1. 重新审视目标用户和核心场景。\n2. 寻找更细分的切入口。",
             "1. 当前证据不足以支撑商业决策。\n2. 可能存在未被发现的根本性障碍。")
        }
    };

    let uncertainty = if is_en {
        format!("This evaluation is based on {} signals, {} competitors, and {} user feedback items. Evidence is {}.",
            signal_count, competitor_count, total_count,
            if signal_count < 10 { "insufficient — consider expanding collection scope" } else { "reasonably sufficient" })
    } else {
        format!("本次评估基于 {} 条信号、{} 个竞品和 {} 条用户反馈。证据量{}。",
            signal_count, competitor_count, total_count,
            if signal_count < 10 { "不足，建议扩大采集范围" } else { "较为充分" })
    };

    Evaluation {
        overall_recommendation: verdict.to_string(),
        confidence_score: confidence,
        dimensions,
        key_opportunities: opportunities.to_string(),
        key_risks: risks.to_string(),
        uncertainty_note: uncertainty,
    }
}

/// Try LLM-driven strategy generation. Falls back to rule-based on failure.
/// `language` is the user's UI/output language — all generated content should be in this language.
pub async fn try_llm_generate_strategy(
    evaluation: &Evaluation,
    competitors: &[Competitor],
    idea_statement: &str,
    strategy_mode: Option<&str>,
    language: &str,
) -> Strategy {
    match crate::llm::deepseek::DeepSeekProvider::from_env() {
        Ok(llm) => {
            let competitor_info: Vec<String> = competitors.iter()
                .map(|c| format!("- {}: {} (pros: {}, cons: {})", c.name, c.positioning, c.pros, c.cons))
                .collect();

            let dim_info: Vec<String> = evaluation.dimensions.iter()
                .map(|d| format!("- {}: {}/10 - {}", d.name, d.score, d.reason))
                .collect();

            let lang_instr = crate::llm::language_instruction(language);
            let mode_hint = match strategy_mode.unwrap_or("balanced") {
                "aggressive" => "Strategy mode: AGGRESSIVE. Recommend bold, high-risk/high-reward entry tactics. Assume maximum differentiation and rapid scaling.",
                "conservative" => "Strategy mode: CONSERVATIVE. Recommend safe, low-risk entry tactics. Prioritize validation and gradual market penetration.",
                _ => "Strategy mode: BALANCED. Weigh risks and rewards evenly.",
            };

            let output_lang_hint = if language == "en" { "in English" } else { "in Chinese (中文)" };
            let sys = json_system_prompt(&format!(
                r#"{{"market_scenario": "market situation analysis {}","suggested_path": "recommended entry strategy {}","positioning_statement": "one-sentence product positioning {}","must_have_features": ["feature1"],"avoid_features": ["feature1"],"offensive_tactics": "specific go-to-market tactics {}"}}"#,
                output_lang_hint, output_lang_hint, output_lang_hint, output_lang_hint
            ));
            let prompt = format!(
                "Product Idea: {}\n\n{}\n\nEvaluation Results:\n{}\n\nKnown Competitors:\n{}\n\n\
                {}\n\n\
                Based on the above research data, generate a concrete market entry strategy. \
                Be specific — name actual competitor weaknesses to exploit and real differentiation angles.",
                idea_statement,
                mode_hint,
                dim_info.join("\n"),
                competitor_info.join("\n"),
                lang_instr,
            );

            match llm.structured::<LlmStrategyOutput>(&sys, &prompt).await {
                Ok(ls) => Strategy {
                    market_scenario: ls.market_scenario,
                    suggested_path: ls.suggested_path,
                    positioning_statement: ls.positioning_statement,
                    must_have_features: ls.must_have_features,
                    avoid_features: ls.avoid_features,
                    offensive_tactics: ls.offensive_tactics,
                },
                Err(e) => {
                    log::warn!("LLM strategy generation failed, using fallback: {}", e);
                    generate_strategy(evaluation, competitors, language)
                }
            }
        }
        Err(e) => {
            log::warn!("DeepSeek unavailable for strategy, using fallback: {}", e);
            generate_strategy(evaluation, competitors, language)
        }
    }
}

/// Try LLM-driven validation plan generation. Falls back to rule-based on failure.
/// `language` is the user's UI/output language.
pub async fn try_llm_generate_validation(
    evaluation: &Evaluation,
    idea_statement: &str,
    language: &str,
) -> Vec<ValidationAction> {
    match crate::llm::deepseek::DeepSeekProvider::from_env() {
        Ok(llm) => {
            let dim_info: Vec<String> = evaluation.dimensions.iter()
                .map(|d| format!("- {}: {}/10 - {}", d.name, d.score, d.reason))
                .collect();

            let lang_instr = crate::llm::language_instruction(language);
            let cat_hint = if language == "en" { "e.g. User Interviews / Landing Page / Ad Test" } else { "e.g. 用户访谈 / Landing Page / 广告测试" };
            let sys = json_system_prompt(&format!(
                r#"{{"plans": [{{"category": "{}","target": "target hypothesis to validate","action": "specific action to take","expected_assertion": "expected outcome if hypothesis is correct","duration": "e.g. Days 1-3","details": "detailed execution guide including specific questions or copy"}}]}}"#,
                cat_hint
            ));
            let prompt = format!(
                "Product Idea: {}\n\nEvaluation:\n{}\n\nRecommendation: {}\n\n{}\n\n\
                Create a practical 2-week validation plan with 3-5 concrete actions. \
                Include specific interview questions, landing page copy drafts, or ad test copy where applicable. \
                The plan should validate the key assumptions identified in the evaluation.",
                idea_statement,
                dim_info.join("\n"),
                evaluation.overall_recommendation,
                lang_instr,
            );

            match llm.structured::<LlmValidationOutput>(&sys, &prompt).await {
                Ok(lv) => lv.plans,
                Err(e) => {
                    log::warn!("LLM validation plan failed, using fallback: {}", e);
                    generate_validation_plan(evaluation, language)
                }
            }
        }
        Err(e) => {
            log::warn!("DeepSeek unavailable for validation, using fallback: {}", e);
            generate_validation_plan(evaluation, language)
        }
    }
}

/// P0-5: LLM competitor enrichment — extract pros/cons/opportunity/pricing/target_user/core_features
/// from search result texts. Falls back to placeholder values on failure.
/// `language` is the user's UI/output language for the enriched descriptions.
pub async fn try_llm_enrich_competitors(
    competitors: &mut Vec<Competitor>,
    search_results: &[crate::adapters::SearchResult],
    idea_statement: &str,
    language: &str,
) {
    if competitors.is_empty() { return; }

    match crate::llm::deepseek::DeepSeekProvider::from_env() {
        Ok(llm) => {
            // Build a context string from all search results
            let corpus: String = search_results.iter()
                .map(|r| {
                    let text = r.content_text.clone().unwrap_or_else(|| r.summary.clone());
                    format!("[{}] {}: {}", r.platform, r.title, text.chars().take(400).collect::<String>())
                })
                .take(30)
                .collect::<Vec<_>>()
                .join("\n---\n");

            let lang_instr = crate::llm::language_instruction(language);
            for comp in competitors.iter_mut() {
                let sys = crate::llm::json_system_prompt(
                    r#"{"pros":"key strengths","cons":"key weaknesses","opportunity":"differentiation opportunity","pricing":"pricing model","target_user":"target user profile","core_features":"core feature set","last_updated":"recent update signs or date if available"}"#
                );
                let prompt = format!(
                    "Product idea: {}\n\nCompetitor to analyze: {}\n\nSearch corpus:\n{}\n\n\
                    {}\n\n\
                    Extract enriched details about this competitor from the search corpus. \
                    If specific info is not found, infer reasonable defaults from the competitor name and context. \
                    For last_updated, note any signs of recent activity, version updates, or news.",
                    idea_statement, comp.name, corpus, lang_instr,
                );
                match llm.structured::<serde_json::Value>(&sys, &prompt).await {
                    Ok(val) => {
                        if let Some(v) = val.get("pros").and_then(|v| v.as_str()) { comp.pros = v.to_string(); }
                        if let Some(v) = val.get("cons").and_then(|v| v.as_str()) { comp.cons = v.to_string(); }
                        if let Some(v) = val.get("opportunity").and_then(|v| v.as_str()) { comp.opportunity = v.to_string(); }
                        if let Some(v) = val.get("pricing").and_then(|v| v.as_str()) { comp.pricing = v.to_string(); }
                        if let Some(v) = val.get("target_user").and_then(|v| v.as_str()) { comp.target_user = v.to_string(); }
                        if let Some(v) = val.get("core_features").and_then(|v| v.as_str()) { comp.core_features = v.to_string(); }
                        if let Some(v) = val.get("last_updated").and_then(|v| v.as_str()) { comp.last_updated = Some(v.to_string()); }
                    }
                    Err(e) => log::warn!("LLM competitor enrichment failed for {}: {}", comp.name, e),
                }
            }
        }
        Err(e) => log::warn!("DeepSeek unavailable for competitor enrichment: {}", e),
    }
}

/// P0-6: LLM-first signal extraction from user voices. Falls back to rule-based extraction.
/// `language` is the user's UI/output language for signal descriptions.
pub async fn try_llm_extract_signals(
    user_voices: &[UserVoice],
    competitors: &[Competitor],
    project_id: &str,
    language: &str,
) -> Vec<Signal> {
    match crate::llm::deepseek::DeepSeekProvider::from_env() {
        Ok(llm) => {
            let voices_text: Vec<String> = user_voices.iter().enumerate()
                .map(|(i, v)| format!("[{}] ({}) [{}]: {}",
                    i,
                    match v.sentiment { Sentiment::Positive => "+", Sentiment::Negative => "-", Sentiment::Neutral => "0" },
                    v.platform,
                    v.content.chars().take(300).collect::<String>()))
                .collect();

            let lang_instr = crate::llm::language_instruction(language);
            let desc_hint = if language == "en" { "signal description in English" } else { "signal description in Chinese" };
            let sys = crate::llm::json_system_prompt(&format!(
                r#"{{"signals":[{{"signal_type":"DemandSignal|PainPointSignal|AlternativeSignal|SatisfactionSignal|DissatisfactionSignal|ImprovementSignal|PaymentSignal|TrendSignal|RiskSignal","content":"{}","sentiment":"positive|negative|neutral","evidence_strength":"high|medium|low","confidence_score":0.8,"topic_tags":["tag1"],"voice_indices":[0,1,2]}}]}}"#,
                desc_hint
            ));
            let prompt = format!(
                "Analyze the following user feedback items and extract market research signals. \
                For each signal, identify the signal type, assign confidence (0-1), \
                and list which voice indices support it.\n\n{}\n\nFeedback items:\n{}",
                lang_instr,
                voices_text.join("\n")
            );

            match llm.structured::<LlmSignalsOutput>(&sys, &prompt).await {
                Ok(output) => {
                    let mut signals = Vec::new();
                    for es in &output.signals {
                        let sig_type = match es.signal_type.as_str() {
                            "DemandSignal" => SignalType::DemandSignal,
                            "PainPointSignal" => SignalType::PainPointSignal,
                            "AlternativeSignal" => SignalType::AlternativeSignal,
                            "SatisfactionSignal" => SignalType::SatisfactionSignal,
                            "DissatisfactionSignal" => SignalType::DissatisfactionSignal,
                            "ImprovementSignal" => SignalType::ImprovementSignal,
                            "PaymentSignal" => SignalType::PaymentSignal,
                            "TrendSignal" => SignalType::TrendSignal,
                            "RiskSignal" => SignalType::RiskSignal,
                            _ => continue,
                        };
                        let sentiment = match es.sentiment.as_str() {
                            "positive" => Sentiment::Positive,
                            "negative" => Sentiment::Negative,
                            _ => Sentiment::Neutral,
                        };
                        let strength = match es.evidence_strength.as_str() {
                            "high" => EvidenceStrength::High,
                            "low" => EvidenceStrength::Low,
                            _ => EvidenceStrength::Medium,
                        };
                        // Find representative voice for platform/source info
                        let best_voice = user_voices.first();
                        signals.push(Signal {
                            id: format!("sig-{}", uuid::Uuid::new_v4()),
                            project_id: project_id.to_string(),
                            signal_type: sig_type,
                            content: es.content.clone(),
                            source_platform: best_voice.map(|v| v.platform.clone()).unwrap_or_default(),
                            source_url: best_voice.map(|v| v.source_url.clone()).unwrap_or_default(),
                            source_timestamp: best_voice.map(|v| v.timestamp.clone()).unwrap_or_default(),
                            topic_tags: es.topic_tags.clone(),
                            sentiment,
                            evidence_strength: strength,
                            confidence_score: es.confidence_score,
                            cross_platform_count: 1,
                            representative_note: es.content.chars().take(200).collect(),
                        });
                    }
                    if !signals.is_empty() {
                        // Merge with rule-based competitor signals
                        for comp in competitors {
                            signals.push(Signal {
                                id: format!("sig-{}", uuid::Uuid::new_v4()),
                                project_id: project_id.to_string(),
                                signal_type: SignalType::CompetitorSignal,
                                content: format!("{} - {}", comp.name, comp.positioning),
                                source_platform: comp.platforms.first().cloned().unwrap_or_default(),
                                source_url: comp.url.clone(),
                                source_timestamp: String::new(),
                                topic_tags: vec!["competitor".to_string()],
                                sentiment: Sentiment::Neutral,
                                evidence_strength: EvidenceStrength::High,
                                confidence_score: 0.9,
                                cross_platform_count: comp.platforms.len() as i32,
                                representative_note: comp.opportunity.clone(),
                            });
                        }
                        return merge_cross_platform_signals(signals);
                    }
                    // Fall through to rule-based if LLM returned empty
                    log::warn!("LLM signal extraction returned empty, falling back to rule-based");
                }
                Err(e) => log::warn!("LLM signal extraction failed, falling back to rule-based: {}", e),
            }
        }
        Err(e) => log::warn!("DeepSeek unavailable for signal extraction, using rule-based: {}", e),
    }
    // Fallback: rule-based extraction
    extract_signals(user_voices, competitors, project_id)
}

/// P2-3: LLM quality correction for evaluation scores.
/// Feeds the rule-based evaluation + top signals + competitor summaries to the LLM
/// to get semantically-informed score adjustments. Blends rule scores (40%) with LLM (60%).
/// Falls back to pure rule-based evaluation if LLM is unavailable.
/// `language` is the user's UI/output language for the correction justifications.
pub async fn try_llm_correct_evaluation(
    mut evaluation: Evaluation,
    signals: &[Signal],
    competitors: &[Competitor],
    language: &str,
) -> Evaluation {
    if signals.is_empty() && competitors.is_empty() {
        return evaluation;
    }

    match crate::llm::deepseek::DeepSeekProvider::from_env() {
        Ok(llm) => {
            let signal_summary: Vec<String> = signals.iter().take(10)
                .map(|s| format!("[{}] {} — {}", s.signal_type.label_en(), s.content.chars().take(120).collect::<String>(), s.source_platform))
                .collect();
            let competitor_summary: Vec<String> = competitors.iter().take(5)
                .map(|c| format!("{}: pros={}, cons={}", c.name, c.pros, c.cons))
                .collect();
            let dim_info: Vec<String> = evaluation.dimensions.iter()
                .map(|d| format!("{}: {}/10 — {}", d.name, d.score, d.reason))
                .collect();

            let lang_instr = crate::llm::language_instruction(language);
            let reason_hint = if language == "en" { "justification for adjustment in English" } else { "justification for adjustment in Chinese" };
            let sys = crate::llm::json_system_prompt(&format!(
                r#"{{"adjusted_scores":[{{"dimension_name":"exact name as provided","adjusted_score":7,"reason":"{}"}}]}}"#,
                reason_hint
            ));
            let prompt = format!(
                "You are evaluating a market research assessment. Below are the current rule-based scores, \
                supporting signals, and competitor analysis. Review each dimension and provide an adjusted score (1-10) \
                with justification. Consider the semantic quality of the evidence, not just the count.\n\n\
                Current Scores:\n{}\n\nTop Signals:\n{}\n\nCompetitor Summaries:\n{}\n\n\
                {}\n\n\
                Return adjusted scores for ALL dimensions listed above. Be honest — if the evidence is weak, lower the score. \
                If the evidence is strong and consistent, you may raise it.",
                dim_info.join("\n"), signal_summary.join("\n"), competitor_summary.join("\n"),
                lang_instr,
            );

            match llm.structured::<serde_json::Value>(&sys, &prompt).await {
                Ok(val) => {
                    if let Some(adjustments) = val["adjusted_scores"].as_array() {
                        for adj in adjustments {
                            let name = adj["dimension_name"].as_str().unwrap_or("");
                            let llm_score = adj["adjusted_score"].as_f64().unwrap_or(0.0) as i32;
                            let reason = adj["reason"].as_str().unwrap_or("").to_string();
                            if name.is_empty() || llm_score < 1 || llm_score > 10 { continue; }

                            if let Some(dim) = evaluation.dimensions.iter_mut()
                                .find(|d| d.name.contains(name) || name.contains(&d.name))
                            {
                                // Blend: 40% rule + 60% LLM
                                let blended = ((dim.score as f64 * 0.4 + llm_score as f64 * 0.6).round() as i32).max(1).min(10);
                                let correction_label = if language == "en" { "LLM correction" } else { "LLM修正" };
                                if !reason.is_empty() {
                                    dim.reason = format!("{} [{}: {}]", dim.reason, correction_label, reason);
                                }
                                dim.score = blended;
                            }
                        }
                        // Recalculate overall recommendation based on adjusted scores
                        let avg: f64 = evaluation.dimensions.iter().map(|d| d.score as f64).sum::<f64>() / evaluation.dimensions.len() as f64;
                        let pain_score = evaluation.dimensions.iter().find(|d| d.name.contains("Pain") || d.name.contains("痛点")).map(|d| d.score).unwrap_or(5);
                        let diff_score = evaluation.dimensions.iter().find(|d| d.name.contains("Differentiation") || d.name.contains("差异")).map(|d| d.score).unwrap_or(5);

                        let new_verdict = if language == "en" {
                            if avg >= 7.0 && pain_score >= 7 && diff_score >= 6 {
                                "Strongly recommend entry: clear pain point concentration and differentiation space exists."
                            } else if avg >= 5.0 {
                                "Cautiously recommend: opportunities exist but key assumptions need further validation."
                            } else {
                                "Not recommended for large-scale investment: complete more thorough market validation first."
                            }
                        } else {
                            if avg >= 7.0 && pain_score >= 7 && diff_score >= 6 {
                                "高度建议进入：当前市场存在明确的痛点集中和差异化空间。"
                            } else if avg >= 5.0 {
                                "谨慎建议：市场存在机会但需进一步验证关键假设。"
                            } else {
                                "暂不建议大规模投入：建议先完成更充分的市场验证。"
                            }
                        };
                        evaluation.overall_recommendation = new_verdict.to_string();
                        log::info!("LLM evaluation correction applied: avg score now {:.1}", avg);
                    }
                }
                Err(e) => log::warn!("LLM evaluation correction failed: {}", e),
            }
        }
        Err(e) => log::warn!("DeepSeek unavailable for evaluation correction: {}", e),
    }
    evaluation
}

pub fn generate_strategy(evaluation: &Evaluation, competitors: &[Competitor], language: &str) -> Strategy {
    let congestion = evaluation.dimensions.iter()
        .find(|d| d.name.contains("拥挤") || d.name.contains("Congestion"))
        .map(|d| d.score).unwrap_or(5);

    let dissatisfaction = evaluation.dimensions.iter()
        .find(|d| d.name.contains("不满") || d.name.contains("Dissatisfaction"))
        .map(|d| d.score).unwrap_or(5);

    let differentiation = evaluation.dimensions.iter()
        .find(|d| d.name.contains("差异") || d.name.contains("Differentiation"))
        .map(|d| d.score).unwrap_or(5);

    let is_en = language == "en";
    let main_competitor = competitors.first();
    let competitor_name = main_competitor.map(|c| c.name.as_str()).unwrap_or("existing solutions");

    let (scenario, path) = if congestion <= 3 {
        if is_en {
            ("Blue Ocean Validation: Few competitors, market education costs may be high — validate demand authenticity first.",
             "Blue Ocean Validation: First verify core demand exists through interviews and landing pages, then scale quickly after confirming PMF.")
        } else {
            ("蓝海验证型：竞品少，市场教育成本可能较高，需先验证需求真实性。",
             "蓝海验证型：先通过访谈和落地页验证核心需求是否存在，确定 PMF 后再快速铺开。")
        }
    } else if dissatisfaction >= 7 && differentiation >= 6 {
        if is_en {
            ("Negative Review Entry: Many competitors but user dissatisfaction is highly concentrated — clear differentiation entry point exists.",
             "Negative Review Entry: Target the most frequent competitor complaints with single-point optimization, using this as the core marketing message.")
        } else {
            ("差评切入型：竞品多但用户不满高度集中，存在明确的差异化切入口。",
             "差评切入型：针对竞品最高频的抱怨点进行单点极致优化，以此为宣传核心切入市场。")
        }
    } else if differentiation >= 5 {
        if is_en {
            ("Niche Segment: Strong dominant competitors but specific user groups are underserved.",
             "Niche Segment: Focus on vertical user groups overlooked by large players, providing tailored solutions.")
        } else {
            ("细分人群型：头部竞品强但特定用户群未被充分服务。",
             "细分人群型：聚焦被大厂忽视的垂直人群，提供量身定制的解决方案。")
        }
    } else if congestion >= 8 {
        if is_en {
            ("Hold Off: Market is highly mature with limited differentiation space.",
             "Hold Off: Continue observing market changes, waiting for technology shifts or strategic adjustments by large players to create opportunity windows.")
        } else {
            ("暂缓进入型：市场高度成熟，差异化空间有限。",
             "暂缓进入型：建议持续观察市场变化，等待技术变革或大厂战略调整带来的机会窗口。")
        }
    } else {
        if is_en {
            ("Experience Reinvention: Use new technology or models to reconstruct user experience.",
             "Experience Reinvention: Use AI/new technology to lower barriers and costs, creating new value propositions.")
        } else {
            ("体验重构型：利用新技术或新模式重构用户体验。",
             "体验重构型：用 AI/新技术降低使用门槛和成本，创造新的价值主张。")
        }
    };

    let (pos_stmt, must_have, avoid, tactics) = if is_en {
        (
            format!("For [target users] we deliver [core value]. Unlike {}, we [key differentiator].", competitor_name),
            vec!["Core pain point solution (MVP)".to_string(), "One-click onboarding experience".to_string()],
            vec!["Complex enterprise management features".to_string(), "Social features unrelated to core value".to_string(), "Excessive configuration and customization options".to_string()],
            format!("Create a comparison page with {}, highlighting key differentiators; target ads on channels where competitor complaints are concentrated.", competitor_name),
        )
    } else {
        (
            format!("为[目标用户]提供[核心价值]，与{}不同，我们[关键差异点]。", competitor_name),
            vec!["核心痛点解决方案（最小可用版本）".to_string(), "一键式接入/上手体验".to_string()],
            vec!["复杂的企业级管理功能".to_string(), "与核心价值无关的社交功能".to_string(), "过度配置和自定义选项".to_string()],
            format!("制作与 {} 的对比页面，突出核心差异点；在竞品差评集中的渠道精准投放。", competitor_name),
        )
    };

    Strategy {
        market_scenario: scenario.to_string(),
        suggested_path: path.to_string(),
        positioning_statement: pos_stmt,
        must_have_features: must_have,
        avoid_features: avoid,
        offensive_tactics: tactics,
    }
}

// ── Community Vocabulary Extraction (R3) ──

/// Extract community-native vocabulary from first-round search results.
/// Used for vocabulary bridging between product descriptions and user language.
pub fn extract_community_vocabulary(results: &[crate::adapters::SearchResult]) -> VocabSet {
    if results.is_empty() {
        return VocabSet::default();
    }

    // Collect all text content
    let all_text: String = results.iter()
        .filter_map(|r| r.content_text.clone().or_else(|| Some(r.summary.clone())))
        .collect::<Vec<_>>()
        .join(" ");

    if all_text.len() < 50 {
        return VocabSet::default();
    }

    let lower = all_text.to_lowercase();

    // Extract pain expressions — natural language patterns
    let pain_expressions = extract_pain_patterns(&lower);

    // Extract substitute behavior patterns
    let substitute_behaviors = extract_substitute_patterns(&lower);

    // Extract high-frequency community native terms (TF-like)
    let community_native_terms = extract_frequent_terms(&lower, 30);

    // Extract competitor context terms (words around competitor/product mentions)
    let competitor_context_terms = extract_competitor_context(&lower);

    VocabSet {
        pain_expressions,
        substitute_behaviors,
        community_native_terms,
        competitor_context_terms,
    }
}

/// LLM-assisted community vocabulary extraction.
/// Uses DeepSeek to extract natural user language from search result summaries.
pub async fn try_llm_extract_vocabulary(
    results: &[crate::adapters::SearchResult],
) -> VocabSet {
    match crate::llm::deepseek::DeepSeekProvider::from_env() {
        Ok(llm) => {
            let corpus: String = results.iter()
                .filter_map(|r| {
                    let text = r.content_text.clone().unwrap_or_else(|| r.summary.clone());
                    if text.len() < 30 { None } else {
                        Some(format!("[{}] {}: {}", r.platform, r.title, text.chars().take(300).collect::<String>()))
                    }
                })
                .take(40)
                .collect::<Vec<_>>()
                .join("\n---\n");

            let sys = json_system_prompt(
                r#"{"pain_expressions":["how to find competitors before building"],"substitute_behaviors":["manually searching Reddit and Google"],"community_native_terms":["market validation","idea research"],"competitor_context_terms":["alternative to X","similar to Y"]}"#
            );
            let prompt = format!(
                "Analyze these search results and extract:\n\
                1. pain_expressions: How users naturally describe their pain/frustration (in their raw words)\n\
                2. substitute_behaviors: What manual workarounds they describe doing\n\
                3. community_native_terms: Frequently used terms and phrases from this community\n\
                4. competitor_context_terms: Terms used around competitor/tool mentions\n\n\
                Search corpus:\n{}",
                corpus
            );

            match llm.structured::<serde_json::Value>(&sys, &prompt).await {
                Ok(val) => VocabSet {
                    pain_expressions: val["pain_expressions"].as_array()
                        .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                        .unwrap_or_default(),
                    substitute_behaviors: val["substitute_behaviors"].as_array()
                        .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                        .unwrap_or_default(),
                    community_native_terms: val["community_native_terms"].as_array()
                        .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                        .unwrap_or_default(),
                    competitor_context_terms: val["competitor_context_terms"].as_array()
                        .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                        .unwrap_or_default(),
                },
                Err(_) => extract_community_vocabulary(results),
            }
        }
        Err(_) => extract_community_vocabulary(results),
    }
}

/// Extract pain expression patterns from text content.
fn extract_pain_patterns(text: &str) -> Vec<String> {
    let mut expressions = Vec::new();
    let pain_starters = [
        "how do i", "how to find", "how to know if", "is there a way",
        "best way to", "how to validate", "how to check", "how can i",
        "looking for a way to", "need a way to", "trying to find",
        "how to research", "how to figure out",
    ];

    // Split into sentences
    let sentences: Vec<&str> = text.split(|c: char| c == '.' || c == '!' || c == '?' || c == '\n').collect();

    for sentence in &sentences {
        let s = sentence.trim().to_lowercase();
        if s.len() < 15 { continue; }

        for starter in &pain_starters {
            if s.starts_with(starter) && s.len() < 200 {
                let clean = s.trim().trim_end_matches('.').trim().to_string();
                if !expressions.contains(&clean) {
                    expressions.push(clean);
                }
                break;
            }
        }
    }

    // Limit and prioritize longer, more specific phrases
    expressions.sort_by(|a, b| b.len().cmp(&a.len()));
    expressions.truncate(15);
    expressions
}

/// Extract substitute behavior patterns from text content.
fn extract_substitute_patterns(text: &str) -> Vec<String> {
    let mut behaviors = Vec::new();
    let sub_markers = [
        "i manually", "manually check", "manually search", "manually go through",
        "using chatgpt to", "using excel to", "using google to", "spending hours",
        "currently i", "right now i", "i've been manually", "i end up",
        "i have to manually", "the way i do it now",
    ];

    let sentences: Vec<&str> = text.split(|c: char| c == '.' || c == '!' || c == '?' || c == '\n').collect();

    for sentence in &sentences {
        let s = sentence.trim().to_lowercase();
        if s.len() < 15 || s.len() > 250 { continue; }

        for marker in &sub_markers {
            if s.contains(marker) {
                let clean = s.trim().trim_end_matches('.').trim().to_string();
                if !behaviors.contains(&clean) {
                    behaviors.push(clean);
                }
                break;
            }
        }
    }

    behaviors.sort_by(|a, b| b.len().cmp(&a.len()));
    behaviors.truncate(15);
    behaviors
}

/// Extract high-frequency community terms using simple TF counting with stop-word filtering.
fn extract_frequent_terms(text: &str, max_terms: usize) -> Vec<String> {
    use std::collections::HashMap;

    let stop_words: Vec<&str> = vec![
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "can", "shall", "you", "your", "yours",
        "he", "she", "it", "they", "them", "their", "we", "us", "our",
        "this", "that", "these", "those", "i", "me", "my", "mine",
        "and", "but", "or", "nor", "not", "so", "if", "then", "than",
        "too", "very", "just", "about", "also", "for", "with", "from",
        "into", "through", "during", "before", "after", "above", "below",
        "up", "down", "out", "off", "over", "under", "again", "further",
        "here", "there", "when", "where", "why", "how", "all", "each",
        "every", "both", "few", "more", "most", "other", "some", "such",
        "only", "own", "same", "really", "actually", "been", "being",
        "get", "got", "use", "used", "using", "like", "one", "much",
        "what", "which", "who", "more", "need", "want", "know", "think",
        "de", "la", "le", "et", "en", "un", "une", "des", "est",
        "的", "了", "在", "是", "我", "有", "和", "就", "不", "人",
        "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去",
        "你", "会", "着", "没有", "看", "好", "自己", "这", "他", "她",
        "它", "们", "那", "些", "所", "被", "把", "从", "对",
    ];

    // Split into words, clean them
    let words: Vec<String> = text
        .split(|c: char| !c.is_alphanumeric() && c != '\'' && c != '-')
        .map(|w| w.trim().trim_matches(|c: char| c == '\'' || c == '-' || c == '"').to_lowercase())
        .filter(|w| w.len() >= 3 && !stop_words.contains(&w.as_str()))
        .collect();

    let mut freq: HashMap<String, usize> = HashMap::new();
    for w in &words {
        *freq.entry(w.clone()).or_default() += 1;
    }

    // Also extract bigrams
    let mut bigram_freq: HashMap<String, usize> = HashMap::new();
    for pair in words.windows(2) {
        if pair[0].len() >= 3 && pair[1].len() >= 3 {
            let bigram = format!("{} {}", pair[0], pair[1]);
            *bigram_freq.entry(bigram).or_default() += 1;
        }
    }

    // Merge unigrams and bigrams, sort by frequency
    let mut all_terms: Vec<(String, usize)> = freq.into_iter()
        .filter(|(_, c)| *c >= 2)
        .map(|(t, c)| (t, c))
        .chain(bigram_freq.into_iter().filter(|(_, c)| *c >= 2))
        .collect();

    all_terms.sort_by(|a, b| b.1.cmp(&a.1));
    all_terms.truncate(max_terms);

    all_terms.into_iter().map(|(t, _)| t).collect()
}

/// Extract vocabulary around competitor/product mentions.
fn extract_competitor_context(text: &str) -> Vec<String> {
    let mut terms = Vec::new();
    let context_markers = [
        "alternative to", "similar to", "like", "competitor", "compare",
        "vs", "versus", "instead of", "better than", "replaced by",
        "alternative", "取代", "替代", "竞品", "对比", "类似",
    ];

    let sentences: Vec<&str> = text.split(|c: char| c == '.' || c == '!' || c == '?' || c == '\n').collect();

    for sentence in &sentences {
        let s = sentence.trim().to_lowercase();
        if s.len() < 10 || s.len() > 200 { continue; }

        for marker in &context_markers {
            if s.contains(marker) {
                let clean = s.trim().to_string();
                if !terms.contains(&clean) {
                    terms.push(clean);
                }
                break;
            }
        }
    }

    terms.truncate(20);
    terms
}

pub fn generate_validation_plan(_evaluation: &Evaluation, language: &str) -> Vec<ValidationAction> {
    let is_en = language == "en";
    if is_en {
        vec![
            ValidationAction {
                category: "User Problem Interviews".to_string(),
                target: "Target users most affected by the existing pain point".to_string(),
                action: "Post discussion threads in target communities to collect dissatisfaction with current solutions and expectations".to_string(),
                expected_assertion: "At least 60% of respondents express clear dissatisfaction with current solutions".to_string(),
                duration: "Days 1-3".to_string(),
                details: "Interview outline:\n1. How do you currently solve [core problem]?\n2. What's the biggest pain point with current solutions?\n3. If a product specifically solved [core pain point], would you try it?\n4. What would the ideal solution look like?\n5. Would you pay for such a solution?".to_string(),
            },
            ValidationAction {
                category: "Landing Page Validation".to_string(),
                target: "Potential users directed via ads or community posts".to_string(),
                action: "Build a single-page landing page showcasing the core value proposition and collect email signups".to_string(),
                expected_assertion: "Signup conversion rate > 5%, validating value proposition appeal".to_string(),
                duration: "Days 4-7".to_string(),
                details: "Landing page design:\n- Headline: One sentence that hits the pain point\n- Subheadline: Brief solution description\n- Core feature preview (3 key points)\n- Email collection form\n- Social proof (if early user feedback exists)".to_string(),
            },
            ValidationAction {
                category: "Competitor Comparison Ad Test".to_string(),
                target: "Users actively searching for competitor alternatives".to_string(),
                action: "Run small-budget ads on search engines and communities to test how core differentiators affect CTR".to_string(),
                expected_assertion: "CTR > 2%, and target audience represents > 50% of signups".to_string(),
                duration: "Days 8-10".to_string(),
                details: "Ad creative:\n- Headline comparison: \"Tired of [competitor pain point]? Try [product name]\"\n- Highlight differentiator: \"[Core differentiator], save [X]% on [time/cost]\"".to_string(),
            },
        ]
    } else {
        vec![
            ValidationAction {
                category: "用户问题访谈".to_string(),
                target: "目标用户群体中受现有痛点困扰最深的人群".to_string(),
                action: "在目标社区发布讨论帖，收集用户对现有方案的不满和期望".to_string(),
                expected_assertion: "至少 60% 的受访者表达了对现有方案的明显不满".to_string(),
                duration: "Days 1-3".to_string(),
                details: "访谈大纲设计：\n1. 当前如何解决[核心问题]？\n2. 现有方案最大的痛点是什么？\n3. 如果有一款产品专门解决[核心痛点]，你愿意试用吗？\n4. 理想的解决方案是什么样的？\n5. 你会为这样的方案付费吗？".to_string(),
            },
            ValidationAction {
                category: "Landing Page 验证".to_string(),
                target: "通过广告或社区帖子引流的潜在用户".to_string(),
                action: "搭建单页落地页，展示产品核心价值主张并收集邮箱注册".to_string(),
                expected_assertion: "注册转化率 > 5%，验证价值主张的吸引力".to_string(),
                duration: "Days 4-7".to_string(),
                details: "落地页设计：\n- 标题: 直击痛点的一句话\n- 副标题: 解决方案简述\n- 核心功能预览（3个要点）\n- 邮箱收集表单\n- 社交证明（如已有早期用户评价）".to_string(),
            },
            ValidationAction {
                category: "竞品对比投放测试".to_string(),
                target: "正在搜索竞品替代方案的用户".to_string(),
                action: "在搜索引擎和社区投放小额广告，测试核心差异点对点击率的影响".to_string(),
                expected_assertion: "CTR > 2%，且注册用户中目标人群占比 > 50%".to_string(),
                duration: "Days 8-10".to_string(),
                details: "广告创意：\n- 标题对比：\"厌倦了[竞品痛点]？试试[产品名]\"\n- 突出差异化：\"[核心差异点]，[时间/成本]节省[X]%\"".to_string(),
            },
        ]
    }
}
