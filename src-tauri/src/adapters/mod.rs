pub mod types;
pub mod traits;
pub mod search_provider;

pub mod google;
pub mod bing;
pub mod reddit;
pub mod quora;
pub mod g2;
pub mod app_store;
pub mod google_play;
pub mod chrome_web_store;
pub mod product_hunt;
pub mod x_twitter;
pub mod alternativeto;
pub mod ecommerce;
pub mod youtube;
pub mod linkedin;
pub mod tiktok;
pub mod zhihu;
pub mod tieba;
pub mod douban;
pub mod trustpilot;
pub mod google_trends;

pub use traits::PlatformAdapter;
pub use types::SearchResult;

use types::SearchProvider;

/// Check whether a search API key is configured.
pub fn is_search_api_configured() -> bool {
    std::env::var("SERP_API_KEY").is_ok() || std::env::var("SERPER_API_KEY").is_ok()
}

/// Platforms that CANNOT work without a search API key.
pub fn platforms_needing_api_key() -> Vec<&'static str> {
    vec![
        "Google Search", "Bing", "G2 / Capterra", "Product Hunt",
        "X / Twitter", "AlternativeTo", "Quora", "TikTok", "Trustpilot",
        "Chrome Web Store", "Google Trends", "YouTube", "LinkedIn",
        "Zhihu", "Tieba", "Google Play", "Douban",
    ]
}

/// Get the platform adapter for a given platform name.
pub fn get_adapter(name: &str) -> Option<Box<dyn PlatformAdapter>> {
    let provider = SearchProvider::from_env();
    log::info!("Search provider: {:?}", provider);

    match name {
        "Google Search" => Some(Box::new(google::GoogleAdapter::new(provider))),
        "Bing" => Some(Box::new(bing::BingAdapter::new(provider))),
        "Reddit" => Some(Box::new(reddit::RedditAdapter)),
        "Quora" => Some(Box::new(quora::QuoraAdapter::new(provider))),
        "G2 / Capterra" => Some(Box::new(g2::G2Adapter::new(provider))),
        "Capterra" => Some(Box::new(g2::G2Adapter::new(provider))),
        "App Store" => Some(Box::new(app_store::AppStoreAdapter)),
        "Google Play" => Some(Box::new(google_play::GooglePlayAdapter::new(provider))),
        "Chrome Web Store" => Some(Box::new(chrome_web_store::ChromeWebStoreAdapter::new(provider))),
        "Product Hunt" => Some(Box::new(product_hunt::ProductHuntAdapter::new(provider))),
        "X / Twitter" => Some(Box::new(x_twitter::XTwitterAdapter::new(provider))),
        "AlternativeTo" => Some(Box::new(alternativeto::AlternativeToAdapter::new(provider))),
        "YouTube" => Some(Box::new(youtube::YouTubeAdapter::new(provider))),
        "LinkedIn" => Some(Box::new(linkedin::LinkedInAdapter::new(provider))),
        "TikTok" => Some(Box::new(tiktok::TikTokAdapter::new(provider))),
        "Zhihu" => Some(Box::new(zhihu::ZhihuAdapter::new(provider))),
        "Tieba" => Some(Box::new(tieba::TiebaAdapter::new(provider))),
        "Douban" => Some(Box::new(douban::DoubanAdapter::new(provider))),
        "Trustpilot" => Some(Box::new(trustpilot::TrustpilotAdapter::new(provider))),
        "Google Trends" => Some(Box::new(google_trends::GoogleTrendsAdapter::new(provider))),
        "Amazon" => Some(Box::new(ecommerce::ECommerceAdapter::new("amazon.com", provider))),
        "Etsy" => Some(Box::new(ecommerce::ECommerceAdapter::new("etsy.com", provider))),
        "Taobao" => Some(Box::new(ecommerce::ECommerceAdapter::new("taobao.com", provider))),
        "JD.com" | "Jingdong" => Some(Box::new(ecommerce::ECommerceAdapter::new("jd.com", provider))),
        _ => None,
    }
}

/// Get all available adapter names.
pub fn available_adapters() -> Vec<&'static str> {
    vec![
        "Google Search", "Bing", "Reddit", "Quora", "G2 / Capterra",
        "App Store", "Google Play", "Chrome Web Store", "Product Hunt",
        "X / Twitter", "AlternativeTo", "Trustpilot",
        "YouTube", "TikTok", "LinkedIn", "Zhihu", "Tieba", "Douban",
        "Google Trends", "Amazon", "Etsy", "Taobao", "JD.com",
    ]
}
