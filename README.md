# Aether - 产品想法调研与决策系统

**全网产品想法情报与决策系统** — 帮助创业者和产品经理在投入开发前，通过多平台数据采集和分析，科学判断产品想法的市场价值和切入策略。

## 技术架构

- **桌面壳**: Tauri v2
- **前端**: React + TypeScript + Vite + Tailwind CSS
- **后端**: Rust (Tokio async runtime)
- **数据库**: SQLite (bundled, WAL mode, FTS5)
- **并行调度**: Tokio + Semaphore-based rate limiting

## 核心功能

1. **想法建模**: 将模糊想法标准化为可研究对象
2. **多平台采集**: Google、Reddit、G2、App Store 等 8 类数据源
3. **竞品识别**: 结构化竞品卡片 + 分类树
4. **用户声音挖掘**: 情绪判断、主题聚类、差评分析
5. **信号抽取**: 10 种信号类型（需求/痛点/替代/竞品/满意/不满/改进/付费/趋势/风险）
6. **九维评估**: 需求强度、痛点强度、市场拥挤度、差异化空间等
7. **策略生成**: 5 种切入策略（蓝海验证/差评切入/细分人群/体验重构/暂缓进入）
8. **验证计划**: 访谈、落地页、投放测试等行动计划

## 开发运行

### 前置条件

- Rust 1.70+
- Node.js 18+
- Tauri CLI: `cargo install tauri-cli`

### 启动开发模式

```bash
npm install
npm run tauri dev
```

### 构建生产版本

```bash
npm run tauri build
```

## 项目结构

```
src/                    # React 前端
  components/           # UI 组件
  types.ts              # TypeScript 类型定义
  mockData.ts           # 默认配置
src-tauri/              # Rust 后端
  src/
    main.rs             # Tauri 入口
    lib.rs              # 库根
    models/mod.rs       # 数据模型
    db/mod.rs           # SQLite 数据库层
    config/mod.rs       # 配置系统
    adapters/           # 平台适配器 (Google, Reddit, G2, App Store)
    scheduler/mod.rs    # 并行调度器
    analysis/mod.rs     # 分析引擎 (信号抽取/主题聚类/评估/策略)
    commands/mod.rs     # Tauri 命令
  migrations/           # 数据库迁移
  Cargo.toml
  tauri.conf.json
```

## 数据源覆盖

| 类型 | 代表平台 | 状态 |
|------|----------|------|
| 搜索引擎 | Google Search | 已实现 |
| 社区论坛 | Reddit | 已实现 |
| 软件点评 | G2 / Capterra | 已实现 |
| 应用商店 | App Store (iTunes API) | 已实现 |
| 产品目录 | Product Hunt | 可启用 |
| 社交媒体 | X / Twitter | 可启用 |
| 替代品目录 | AlternativeTo | 可启用 |

## 三权配置体系

- **系统默认**: 程序内置，开箱即用
- **用户全局**: 在「设置中心」修改，持久化到 SQLite
- **项目级覆盖**: 在「平台配置」针对单个项目独立调整

## License

Proprietary. All rights reserved.
