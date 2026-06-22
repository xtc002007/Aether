import { AppSettings, PlatformWeights } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  language: "zh",
  theme: "light",
  globalMaxConcurrent: 8,
  defaultCrawlDepth: "quick",
  autoBackup: true,
  autoUpdateEnabled: true,
  saveHtml: false,
  sqlitePath: "./data/aether.db",
  logLevel: "info",
};

export const DEFAULT_PLATFORM_WEIGHTS: PlatformWeights = {
  reddit: 1.0,
  google: 1.0,
  bing: 0.9,
  g2: 1.0,
  store: 1.0,
  xTwitter: 0.8,
  productHunt: 0.7,
  alternativeTo: 0.7,
  ecommerce: 0.5,
  quora: 0.8,
  tiktok: 0.6,
  trustpilot: 0.8,
  chromeWebStore: 0.5,
  googlePlay: 0.9,
  googleTrends: 0.6,
  youtube: 0.6,
  linkedin: 0.6,
  zhihu: 0.7,
  tieba: 0.6,
  douban: 0.6,
};
