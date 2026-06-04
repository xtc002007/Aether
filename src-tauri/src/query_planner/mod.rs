//! Query Planner — generates search queries and platform assignments
//! based on the user's product idea and research configuration.
//!
//! Supports four-layer keyword discovery:
//!   1. Descriptive vocabulary (existing: category, task, brand, compare)
//!   2. Pain-expression queries (new: user pain language)
//!   3. Substitute-behavior queries (new: manual workaround descriptions)
//!   4. Community-vocabulary transforms (new: platform-native phrasing)

use crate::models::*;
use crate::llm::LlmProvider;

/// A complete query plan: which platforms to search, with which queries.
#[derive(Debug, Clone)]
pub struct PlatformQueryPlan {
    pub platform: String,
    pub queries: Vec<QueryWithType>,
}

#[derive(Debug, Clone)]
pub struct QueryWithType {
    pub query_type: String,
    pub query_text: String,
}

/// Generate queries using LLM when available, falling back to template expansion.
/// `language` is the user's UI/output language — used only for context when calling the LLM.
/// Query language is determined by each platform's `default_language`, NOT the user's language.
pub async fn generate_query_plans(
    idea_model: &IdeaModel,
    platform_configs: &[PlatformConfig],
    language: &str,
    _region: &str,
) -> Vec<PlatformQueryPlan> {
    // Try LLM first
    if let Ok(llm) = crate::llm::deepseek::DeepSeekProvider::from_env() {
        if let Ok(plans) = try_llm_query_plans(&llm, idea_model, platform_configs, language).await {
            return plans;
        }
    }

    // Fallback: template-based expansion (uses platform.default_language, not user language)
    fallback_query_plans(idea_model, platform_configs)
}

async fn try_llm_query_plans(
    llm: &crate::llm::deepseek::DeepSeekProvider,
    idea_model: &IdeaModel,
    platform_configs: &[PlatformConfig],
    user_language: &str,
) -> Result<Vec<PlatformQueryPlan>, String> {
    let sys = crate::llm::json_system_prompt(
        r#"{"queries": [{"query_type": "category|task|compare|brand|intent|problem|pricing|pain_expression|substitute_behavior|functional_triangulation", "query_text": "the query", "platforms": ["Google Search", "Reddit"]}]}"#
    );
    let keywords_hint = if !idea_model.suggested_keywords.is_empty() {
        format!("\nSuggested search keywords: {}", idea_model.suggested_keywords.join(", "))
    } else { String::new() };
    let categories_hint = if !idea_model.categories.is_empty() {
        format!("\nProduct categories to focus on: {}", idea_model.categories.join(", "))
    } else { String::new() };
    let pain_hint = if !idea_model.existing_alternatives.is_empty() {
        format!("\nCurrent alternatives (what users do manually today): {}", idea_model.existing_alternatives)
    } else { String::new() };

    // Build per-platform language requirements
    let platform_lang_info: Vec<String> = platform_configs.iter()
        .filter(|p| p.enabled)
        .map(|p| format!("  - {}: generate queries in {} (default_language={})",
            p.name, crate::llm::language_name(p.search_language()), p.search_language()))
        .collect();

    let prompt = format!(
        "Product: {}\nTarget Users: {}\nCore Job: {}\nUse Scenario: {}\nProduct Form: {}{}{}{}\n\n\
        The user's idea is expressed in {user_lang}.\n\n\
        CRITICAL — Platform Language Requirements:\n\
        Each platform has a primary language. Generate queries in THAT platform's language \
        to maximize search results:\n{platform_langs}\n\n\
        Generate 12-25 search queries across these types:\n\
        - category: product category searches\n\
        - task: how-to / job-to-be-done searches\n\
        - compare: competitor comparison searches\n\
        - brand: specific product/brand searches\n\
        - intent: high-intent purchase searches\n\
        - problem: pain point / complaint searches\n\
        - pricing: cost-related searches\n\
        - pain_expression: search like a frustrated user — \"how do I [manual job]\", \
          \"is there a way to [job] without [pain]\", \"best way to [job] before [consequence]\"\n\
        - substitute_behavior: search for people doing the task manually — \
          \"I manually [substitute behavior]\", \"using ChatGPT/Excel to [job]\", \
          \"anyone else [manual process] to [goal]\"\n\
        - functional_triangulation (for products without clear category names): \
          \"alternatives to [manual method]\", \"[pain description] + solution/tool\", \
          \"[adjacent category A] vs [adjacent category B]\"\n\n\
        IMPORTANT: Translate the core concepts from {user_lang} into each platform's required language. \
        For pain_expression queries, think about what a frustrated user would \
        ACTUALLY type into that specific platform — use raw community language, NOT product-marketing terms.",
        idea_model.statement, idea_model.target_user,
        idea_model.core_job, idea_model.use_scenario, idea_model.product_form,
        keywords_hint, categories_hint, pain_hint,
        user_lang = crate::llm::language_name(user_language),
        platform_langs = platform_lang_info.join("\n"),
    );

    let response: serde_json::Value = llm.structured(&sys, &prompt).await?;
    let mut plans: Vec<PlatformQueryPlan> = Vec::new();

    if let Some(queries) = response["queries"].as_array() {
        for q in queries {
            let query_text = q["query_text"].as_str().unwrap_or("").to_string();
            let query_type = q["query_type"].as_str().unwrap_or("category").to_string();
            let platforms: Vec<String> = q["platforms"].as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();

            if query_text.is_empty() { continue; }

            for pf in &platforms {
                // Apply platform vocabulary transforms
                let transformed_text = apply_platform_vocab_transforms(&query_text, pf, &query_type);
                let entry = plans.iter_mut().find(|p| p.platform == *pf);
                if let Some(plan) = entry {
                    plan.queries.push(QueryWithType {
                        query_type: query_type.clone(),
                        query_text: transformed_text,
                    });
                } else {
                    plans.push(PlatformQueryPlan {
                        platform: pf.clone(),
                        queries: vec![QueryWithType {
                            query_type: query_type.clone(),
                            query_text: transformed_text,
                        }],
                    });
                }
            }
        }
    }

    Ok(plans)
}

/// Apply platform-specific vocabulary transforms to a query.
/// Converts generic queries into community-native phrasing for each platform.
pub fn apply_platform_vocab_transforms(query: &str, platform: &str, _query_type: &str) -> String {
    let vocab_rules = get_platform_vocab_rules(platform);
    if vocab_rules.is_empty() {
        return query.to_string();
    }

    let mut result = query.to_string();
    let lower = query.to_lowercase();

    for rule in &vocab_rules {
        // Check if query contains avoid_terms — if so, try to rephrase
        for avoid in &rule.avoid_terms {
            if lower.contains(&avoid.to_lowercase()) {
                // Try to replace with a preferred term
                if let Some(preferred) = rule.preferred_terms.first() {
                    result = result.replace(avoid, preferred);
                }
            }
        }

        // Apply frame transformation
        match rule.frame.as_str() {
            "question_seeking_advice" => {
                if !result.contains('?') && !result.starts_with("how ")
                    && !result.starts_with("anyone ") && !result.starts_with("is there") {
                    if result.to_lowercase().contains("alternative") {
                        result = format!("what's the best alternative to {}", result);
                    }
                }
            }
            "experience_sharing" => {
                // r/entrepreneur: frame as personal experience sharing
                if !result.starts_with("my ") && !result.starts_with("i ") && !result.starts_with("we ") {
                    result = format!("my experience with {}", result);
                }
            }
            "technical_discussion" => {
                // r/SaaS: focus on metrics, growth, technical specifics
                if result.contains(" tool ") { result = result.replace(" tool ", " SaaS "); }
            }
            "casual_advice" => {
                // r/sideproject: keep it casual, strip corporate tone
                result = result.replace("enterprise-grade", "simple")
                    .replace("scalable", "bootstrapped");
            }
            "technical_recommendation" => {
                // r/webdev: frame as tool/stack recommendation request
                if !result.contains("recommend") && !result.contains("best") {
                    result = format!("recommendations for {}", result);
                }
            }
            "professional_discussion" => {
                // r/ProductManagement: elevate to strategic framing
                if result.contains(" tool ") { result = result.replace(" tool ", " solution "); }
            }
            "product_comparison" => {
                // Product Hunt: frame as alternative/comparison search
                if !result.to_lowercase().contains("alternative") && !result.to_lowercase().contains("like") {
                    result = format!("alternative to {}", result);
                }
            }
            "intellectual_discussion" => {
                // HN: prefer technical framing
                if result.contains(" tool ") || result.contains(" app ") {
                    result = result.replace(" tool ", " solution ")
                        .replace(" app ", " application ");
                }
            }
            "builder_sharing" => {
                // IndieHackers: "building in public" style
                if !result.starts_with("building ") && !result.starts_with("launching ") {
                    result = format!("building {}", result);
                }
            }
            "comparison_shopping" => {
                // G2/Capterra: frame as feature/pricing comparison
                if !result.contains("comparison") && !result.contains("vs ") {
                    result = format!("{} comparison", result);
                }
            }
            "app_discovery" => {
                // App Store: frame as app-finding intent
                if !result.contains(" app") && !result.ends_with(" app") {
                    result = format!("{} app", result);
                }
            }
            _ => {}
        }
    }

    result
}

/// Vocabulary rules for each platform. Mirrors resources/default-config/platform-vocab.yaml.
struct VocabRule {
    #[allow(dead_code)]
    name: String,
    preferred_terms: Vec<String>,
    avoid_terms: Vec<String>,
    frame: String,
}

fn get_platform_vocab_rules(platform: &str) -> Vec<VocabRule> {
    match platform {
        "Reddit" => vec![
            VocabRule {
                name: "r/startups".into(),
                preferred_terms: vec!["market validation".into(), "competitive landscape".into(), "PMF".into(), "go-to-market".into(), "customer discovery".into()],
                avoid_terms: vec!["tool".into(), "software".into(), "app".into()],
                frame: "question_seeking_advice".into(),
            },
            VocabRule {
                name: "r/entrepreneur".into(),
                preferred_terms: vec!["business idea research".into(), "competitor analysis".into(), "market research".into(), "customer pain points".into()],
                avoid_terms: vec!["SaaS".into(), "platform".into()],
                frame: "experience_sharing".into(),
            },
            VocabRule {
                name: "r/SaaS".into(),
                preferred_terms: vec!["SaaS idea validation".into(), "B2B market research".into(), "competitor landscape SaaS".into(), "product-market fit".into()],
                avoid_terms: vec![],
                frame: "technical_discussion".into(),
            },
            VocabRule {
                name: "r/sideproject".into(),
                preferred_terms: vec!["idea validation".into(), "find competitors".into(), "before building".into(), "market demand check".into()],
                avoid_terms: vec!["enterprise".into(), "corporate".into()],
                frame: "casual_advice".into(),
            },
            VocabRule {
                name: "r/webdev".into(),
                preferred_terms: vec!["tool recommendations".into(), "best way to build".into(), "existing solutions for".into()],
                avoid_terms: vec!["marketing".into(), "business model".into()],
                frame: "technical_recommendation".into(),
            },
            VocabRule {
                name: "r/ProductManagement".into(),
                preferred_terms: vec!["competitive analysis".into(), "market intelligence".into(), "product discovery".into(), "opportunity assessment".into()],
                avoid_terms: vec![],
                frame: "professional_discussion".into(),
            },
        ],
        "Product Hunt" => vec![
            VocabRule {
                name: "default".into(),
                preferred_terms: vec!["alternative to".into(), "like X but for Y".into(), "for [specific user]".into(), "launching soon".into()],
                avoid_terms: vec![],
                frame: "product_comparison".into(),
            },
        ],
        "Hacker News" => vec![
            VocabRule {
                name: "default".into(),
                preferred_terms: vec!["prior art".into(), "existing solutions".into(), "market size estimation".into(), "technical feasibility".into(), "show HN".into()],
                avoid_terms: vec!["unicorn".into(), "disruptive".into()],
                frame: "intellectual_discussion".into(),
            },
        ],
        "IndieHackers" => vec![
            VocabRule {
                name: "default".into(),
                preferred_terms: vec!["idea validation".into(), "find competitors before building".into(), "research phase".into(), "build in public".into(), "market first approach".into()],
                avoid_terms: vec!["enterprise".into(), "scale".into()],
                frame: "builder_sharing".into(),
            },
        ],
        "G2 / Capterra" => vec![
            VocabRule {
                name: "default".into(),
                preferred_terms: vec!["feature comparison".into(), "pricing comparison".into(), "user reviews".into(), "best [category] software".into()],
                avoid_terms: vec![],
                frame: "comparison_shopping".into(),
            },
        ],
        "App Store" => vec![
            VocabRule {
                name: "default".into(),
                preferred_terms: vec!["best [category] app".into(), "app for [job]".into(), "alternative to".into()],
                avoid_terms: vec![],
                frame: "app_discovery".into(),
            },
        ],
        _ => Vec::new(),
    }
}

/// Check if a string contains Chinese characters.
fn contains_chinese(s: &str) -> bool {
    s.chars().any(|c| c >= '\u{4E00}' && c <= '\u{9FFF}')
}

/// Fallback: expand query templates using the idea model's keywords.
/// Query language is determined by each platform's `default_language`, NOT the user's UI language.
fn fallback_query_plans(
    idea_model: &IdeaModel,
    platform_configs: &[PlatformConfig],
) -> Vec<PlatformQueryPlan> {
    let mut plans = Vec::new();
    let statement = &idea_model.statement;

    // Use suggested keywords for template expansion (first 5 keywords, excluding excluded ones)
    let keyword_items: Vec<&String> = idea_model.suggested_keywords.iter()
        .filter(|kw| !idea_model.excluded_keywords.contains(kw))
        .take(5)
        .collect();
    // Use product form as fallback category label
    let category_label = if !idea_model.categories.is_empty() {
        &idea_model.categories[0]
    } else {
        &idea_model.product_form
    };

    // Determine category confidence (low = need pain/substitute queries more)
    let has_low_category_confidence = idea_model.categories.is_empty()
        || idea_model.product_form.is_empty();

    for pf_config in platform_configs {
        if !pf_config.enabled { continue; }

        let mut queries = Vec::new();
        let platform_lang = pf_config.search_language();
        let is_chinese_platform = pf_config.is_chinese_platform();

        // Collect standard template queries
        for qt in &pf_config.query_templates {
            if !qt.enabled { continue; }
            let text = qt.template
                .replace("{core_keyword}", statement)
                .replace("{problem}", statement)
                .replace("{category}", category_label)
                .replace("{year}", "2026")
                .replace("{competitor_name}", "alternative")
                .replace("{subreddit}", "startups");
            let text_for_compare = text.clone();
            queries.push(QueryWithType {
                query_type: format!("{:?}", qt.query_type).to_lowercase(),
                query_text: text,
            });
            // Generate additional queries from adopted keywords
            for kw in &keyword_items {
                if qt.template.contains("{core_keyword}") || qt.template.contains("{problem}") {
                    let kw_text = qt.template
                        .replace("{core_keyword}", kw)
                        .replace("{problem}", kw)
                        .replace("{category}", category_label)
                        .replace("{year}", "2026")
                        .replace("{competitor_name}", "alternative")
                        .replace("{subreddit}", "startups");
                    if kw_text != text_for_compare {
                        queries.push(QueryWithType {
                            query_type: format!("{:?}", qt.query_type).to_lowercase(),
                            query_text: kw_text,
                        });
                    }
                }
            }
            // For Chinese platforms, also generate Chinese query variants
            // when the template itself is not already in Chinese
            let has_chinese_content = contains_chinese(statement)
                || contains_chinese(category_label);
            if is_chinese_platform && has_chinese_content && !contains_chinese(&text_for_compare) {
                let zh_text = qt.template
                    .replace("{core_keyword}", &format!("{} 推荐", statement))
                    .replace("{problem}", &format!("{} 问题 解决方案", statement))
                    .replace("{category}", category_label)
                    .replace("{year}", "2026")
                    .replace("{competitor_name}", "替代品")
                    .replace("{subreddit}", "startups");
                if zh_text != text_for_compare {
                    queries.push(QueryWithType {
                        query_type: format!("{:?}", qt.query_type).to_lowercase(),
                        query_text: zh_text,
                    });
                }
            }
        }

        // ── Pain Expression queries (Layer 2) ──
        let is_question_platform = matches!(
            pf_config.platform_type,
            crate::models::PlatformType::SearchEngine
                | crate::models::PlatformType::SocialForum
                | crate::models::PlatformType::SocialMedia
        );
        if is_question_platform {
            let pain_queries = generate_pain_expression_queries(
                statement, &idea_model.core_job, &idea_model.use_scenario,
                &idea_model.existing_alternatives, platform_lang,
            );
            for pq in pain_queries {
                let transformed = apply_platform_vocab_transforms(&pq, &pf_config.name, "pain_expression");
                queries.push(QueryWithType {
                    query_type: "pain_expression".to_string(),
                    query_text: transformed,
                });
            }
        }

        // ── Substitute Behavior queries (Layer 3) ──
        let is_community_platform = matches!(
            pf_config.platform_type,
            crate::models::PlatformType::SocialForum
                | crate::models::PlatformType::SocialMedia
        );
        if is_community_platform {
            let sub_queries = generate_substitute_behavior_queries(
                statement, &idea_model.core_job, &idea_model.existing_alternatives, platform_lang,
            );
            for sq in sub_queries {
                let transformed = apply_platform_vocab_transforms(&sq, &pf_config.name, "substitute_behavior");
                queries.push(QueryWithType {
                    query_type: "substitute_behavior".to_string(),
                    query_text: transformed,
                });
            }
        }

        // ── Functional Triangulation queries (Layer 5 / R7) ──
        if has_low_category_confidence && pf_config.name == "Google Search" {
            let tri_queries = generate_triangulation_queries(
                statement, &idea_model.core_job, &idea_model.existing_alternatives, platform_lang,
            );
            for tq in tri_queries {
                queries.push(QueryWithType {
                    query_type: "functional_triangulation".to_string(),
                    query_text: tq,
                });
            }
        }

        if !queries.is_empty() {
            plans.push(PlatformQueryPlan { platform: pf_config.name.clone(), queries });
        }
    }

    plans
}

/// Generate pain-expression queries: what a frustrated user would actually type.
/// `platform_language` is the platform's primary language ("en" or "zh"), not the user's UI language.
fn generate_pain_expression_queries(
    statement: &str,
    core_job: &str,
    use_scenario: &str,
    existing_alternatives: &str,
    platform_language: &str,
) -> Vec<String> {
    let mut queries = Vec::new();

    let job_text = if core_job.is_empty() { statement } else { core_job };
    let is_chinese_platform = platform_language == "zh";

    if is_chinese_platform {
        // Chinese pain-expression queries
        queries.push(format!("怎么{}，有没有这样的工具", job_text));
        queries.push(format!("{} 有什么好办法", job_text));
        queries.push(format!("如何验证{}的想法是否可行", statement));
        if !existing_alternatives.is_empty() && existing_alternatives != "待分析" {
            queries.push(format!("不用{}怎么{}", existing_alternatives, job_text));
        }
        queries.push(format!("{} 太麻烦 有没有工具", job_text));
    } else {
        // English pain-expression queries (default for en platforms)
        let scenario_hint = if !use_scenario.is_empty() {
            format!(" in {}", use_scenario)
        } else { String::new() };

        queries.push(format!("how do I {}{}", job_text, scenario_hint));
        queries.push(format!("is there a way to {}", job_text));
        queries.push(format!("best way to {} before building", job_text));
        if !existing_alternatives.is_empty() && existing_alternatives != "待分析" {
            queries.push(format!("tool to {} without {}", job_text, existing_alternatives));
        }
        queries.push(format!("how to know if {} already exists", statement));
    }

    queries
}

/// Generate substitute-behavior queries: search for people doing the task manually.
/// `platform_language` is the platform's primary language, not the user's UI language.
fn generate_substitute_behavior_queries(
    statement: &str,
    core_job: &str,
    existing_alternatives: &str,
    platform_language: &str,
) -> Vec<String> {
    let mut queries = Vec::new();

    let job_text = if core_job.is_empty() { statement } else { core_job };
    let alt_text = if existing_alternatives.is_empty() || existing_alternatives == "待分析" {
        "manually".to_string()
    } else {
        existing_alternatives.to_string()
    };
    let is_chinese_platform = platform_language == "zh";

    if is_chinese_platform {
        queries.push(format!("有没有人手工{}的", job_text));
        queries.push(format!("用{}来{} 太麻烦了", alt_text, job_text));
        queries.push(format!("还在{} 有没有更好的办法", job_text));
        queries.push(format!("{} 浪费时间 工具推荐", job_text));
    } else {
        queries.push(format!("I manually {} for", job_text));
        queries.push(format!("using ChatGPT to {}", job_text));
        queries.push(format!("using {} to {}", alt_text, job_text));
        queries.push(format!("anyone else {} to research their idea", job_text));
        queries.push(format!("spending hours {} {}", job_text, statement));
        queries.push(format!("frustrated trying to {}", job_text));
    }

    queries
}

/// Generate functional triangulation queries for products without clear category names.
/// These search for competitors by context (what they do), not by name (what they're called).
/// `platform_language` is the platform's primary language, not the user's UI language.
fn generate_triangulation_queries(
    statement: &str,
    core_job: &str,
    existing_alternatives: &str,
    platform_language: &str,
) -> Vec<String> {
    let mut queries = Vec::new();

    let alt_text = if existing_alternatives.is_empty() || existing_alternatives == "待分析" {
        "manual research".to_string()
    } else {
        existing_alternatives.to_string()
    };
    let is_chinese_platform = platform_language == "zh";

    if is_chinese_platform {
        queries.push(format!("{} 有什么替代方案", alt_text));
        queries.push(format!("{} 竞品分析工具推荐", statement));
        queries.push(format!("{} 类似的工具有哪些", core_job));
    } else {
        queries.push(format!("alternatives to {}", alt_text));
        queries.push(format!("{} solution tool", statement));
        queries.push(format!("{} software alternative", core_job));
        queries.push(format!("research competitive analysis tool for {}", statement));
        queries.push(format!("market research vs competitive intelligence tools"));
    }

    queries
}

/// Generate refinement queries using community vocabulary extracted from first-round results.
/// Called during the second round of deep search.
pub fn generate_refinement_queries(
    vocab_set: &VocabSet,
    original_statement: &str,
    platforms: &[String],
) -> Vec<PlatformQueryPlan> {
    let mut plans = Vec::new();

    for pf_name in platforms {
        let mut queries = Vec::new();

        // Use pain expressions discovered from the community
        for pe in &vocab_set.pain_expressions {
            queries.push(QueryWithType {
                query_type: "vocab_refinement".to_string(),
                query_text: pe.clone(),
            });
        }

        // Use community native terms combined with original intent
        for term in vocab_set.community_native_terms.iter().take(10) {
            queries.push(QueryWithType {
                query_type: "vocab_refinement".to_string(),
                query_text: format!("{} {}", term, original_statement),
            });
        }

        // Use competitor context terms for deeper competitor discovery
        for ct in vocab_set.competitor_context_terms.iter().take(8) {
            queries.push(QueryWithType {
                query_type: "vocab_refinement".to_string(),
                query_text: format!("{} alternative", ct),
            });
        }

        if !queries.is_empty() {
            // Deduplicate by query text
            let mut seen = std::collections::HashSet::new();
            queries.retain(|q| seen.insert(q.query_text.clone()));
            plans.push(PlatformQueryPlan { platform: pf_name.clone(), queries });
        }
    }

    plans
}
