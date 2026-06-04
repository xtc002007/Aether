这个产品非常适合做成一个 **Tauri + Rust + SQLite** 的本地优先桌面应用：前端负责工作台与交互，后端负责搜索编排、并行执行、规则配置、数据存储、文本处理与报告生成。按照你的要求，最佳实现路线应是：**单机自包含、无外部数据库、无 Redis、支持并行搜索、平台规则可配置、默认可用但允许高级用户修改**。

我先给结论：这类产品最优方案不是“前端直接调很多接口”，而是做成一个 **本地研究引擎**。也就是 Tauri 外壳内置一个 Rust 后端内核，统一管理任务队列、平台适配器、配置系统、SQLite 数据层和分析流水线；这样既能保证并行效率，也能保持安装和运行足够简单。

## 总体方案

建议把整个系统拆成 6 层，这样结构清晰，而且足够“完整但不过度复杂”。这也符合你一贯偏好的分层、模块化、自洽架构。

## 1. 桌面壳层

- 技术：Tauri + React/Vue/Svelte 任一前端框架，建议 React/TypeScript。

- 职责：页面渲染、状态展示、操作输入、任务可视化。

- 原则：前端尽量薄，不承担核心业务判断。[](https://www.youtube.com/watch?v=rBouxS1Plfc)

## 2. 应用服务层

- 技术：Rust commands + async services。

- 职责：项目创建、搜索任务启动、结果聚合、配置读取、报告生成。

- 这一层相当于产品“用例层”，把 UI 操作翻译成后端动作。[](https://tauritutorials.com/blog/building-a-todo-app-in-tauri-with-sqlite-and-sqlx)[](https://www.youtube.com/watch?v=rBouxS1Plfc)

## 3. 研究引擎层

- 核心：查询生成、并行调度、平台执行、去重、实体归一化、信号抽取。

- 这是整个产品的心脏，建议全部放 Rust 里，便于并发与统一控制。

## 4. 平台适配器层

- 每个平台一个 adapter。

- 统一输入输出格式，内部可有各自搜索逻辑、限流规则、选择器规则、解析规则。

- 这是支撑“搜索平台、社交平台、应用商店”等多源统一的关键。

## 5. 本地数据层

- 主库：SQLite。

- 文件：JSON/YAML 配置文件 + 导出文件 + 缓存文件。

- 不引入 Redis，不引入独立服务。

## 6. 配置与规则层

- 平台配置

- 搜索规则

- 提示词模板

- 评分规则

- 分类规则

- 用户覆盖配置

这层必须“默认可用 + 可编辑覆盖”，而不是全部硬编码。

## 推荐技术栈

在“够用即可、内部自解决、多平台桌面、支持并行”这个前提下，推荐如下：

| 层       | 技术                                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------- |
| 桌面壳     | Tauri v2                                                                                           |
| 前端      | React + TypeScript                                                                                 |
| UI      | Tailwind / shadcn 风格组件或自定义设计系统                                                                     |
| 后端语言    | Rust                                                                                               |
| 异步并行    | Tokio [](https://tauritutorials.com/blog/building-a-todo-app-in-tauri-with-sqlite-and-sqlx)        |
| 数据库     | SQLite，优先通过 sqlx 或 rusqlite 管理                                                                     |
| 配置文件    | YAML 或 JSON                                                                                        |
| 全文检索    | SQLite FTS5                                                                                        |
| 可选向量检索  | 先不做；后续如有需要可用 sqlite-vec [](https://whoisryosuke.com/blog/2025/offline-vector-database-with-tauri/) |
| HTML 解析 | scraper / reqwest / regex 等 Rust 生态                                                                |
| 报告导出    | Markdown / HTML / JSON                                                                             |

这里最重要的取舍是：**先不要引入 Elasticsearch、Redis、Postgres、消息队列、外部任务服务**，因为它们都会显著提升安装复杂度，但对你的第一版完整产品并非必要。

## 为什么 SQLite 足够

对于这个应用，SQLite 其实非常合适，因为你的主要数据是：

- 项目

- 平台配置

- 查询任务

- 搜索结果

- 原始证据

- 竞品实体

- 信号标签

- 评分结果

- 报告快照

这些都属于结构化和半结构化混合数据，本地单用户场景下 SQLite 足够稳定，而且部署简单、零配置、性能也够用。

建议这样用：

- 结构化字段进普通表。

- 原始 HTML / JSON / 文本片段进原始证据表。

- 评论与帖子文本加 FTS5 索引，支持全文搜索。

- 配置快照也可落库，保证项目级可追溯。

## 核心架构

建议整体采用：

**Tauri UI → Rust Command API → Application Services → Research Engine → Platform Adapters → SQLite / Files**

这比“前端直接请求平台”更好，因为：

- 并行更容易统一控制。[](https://tauritutorials.com/blog/building-a-todo-app-in-tauri-with-sqlite-and-sqlx)

- 限流、重试、超时都能集中处理。

- 平台规则修改也能统一生效。

- 本地缓存和增量更新更方便。

## 模块划分建议

## 1. project 模块

负责研究项目生命周期：

- 创建项目

- 更新项目

- 保存研究范围

- 项目快照

- 对比多个项目

## 2. config 模块

负责配置读取与覆盖：

- 系统默认配置

- 用户全局配置

- 项目级配置覆盖

- 平台级配置覆盖

## 3. query-planner 模块

负责把用户想法变成搜索计划。查询类型从原有的 5 种扩展为 9 种，新增 4 种词汇桥接查询类型，解决"产品描述词汇与用户搜索词汇之间存在范式断裂"的核心问题。

### 3.1 原有查询类型（描述词汇层）

- 生成类别词（Category）
- 生成任务词（Task）
- 生成品牌词（Brand）
- 生成比较词（Compare）
- 生成高意图词（Intent）
- 生成问题词（Problem）
- 生成定价词（Pricing）

适用于产品有成熟类别名的场景。

### 3.2 新增查询类型（词汇桥接层）

**痛苦表达查询（PainExpression）**：从用户感知痛苦时的原始语言出发生成查询，而非从产品描述出发。用户搜索的是他们的痛苦，不是解决方案的名称。

LLM prompt 中需要求：根据 core_job 和 use_scenario，推导用户在感知痛苦时会使用的自然语言搜索词。模板示例：
- "how do I [手工完成产品所做任务的描述]"
- "is there a way to [job description without naming the tool]"
- "how to find [what the product discovers] without [expensive/complex existing method]"
- "[problem description] tool / app"
- "best way to [job] before [consequence]"

**替代行为查询（SubstituteBehavior）**：搜索正在手工完成这件事的用户。他们就是目标用户，他们的帖子就是需求信号，他们提到的工具就是竞品。在 Reddit、Quora 等社区平台特别有效。

LLM prompt 中需要求：根据 existing_alternatives 和 core_job，推导用户不使用专业工具时手工完成任务的行为描述搜索词。模板示例：
- "I manually [手工替代行为描述]"
- "using [非专业工具] to [任务描述]"
- "spending time [手工过程] for [目标]"
- "anyone else [手工行为] to [目标]"

**词汇精化查询（VocabRefinement）**：第二轮搜索专用。使用从第一轮搜索结果中提取的社区原生词汇重新构造查询。这些词汇是用户的"原声"，搜索精准度大幅提升。此类型查询不在第一轮生成，仅在词汇提取完成后由系统自动生成。

**功能三角定位查询（FunctionalTriangulation）**：对于无明确类别名的产品，不直接搜索竞品名，而是搜索竞品被提及的语境，通过多个角度的三角定位找到"从不同侧面解决同一问题"的竞品。模板示例：
- "alternatives to [手工方法]"
- "[adjacent job] + [adjacent job] in one tool"
- "[user type] + [platform A] + [platform B] + research"
- "[pain description] + solution/tool/app/software"

### 3.3 查询类型权重自适应

系统需根据想法建模的类别置信度自动判断各层权重：
- 类别置信度高（有成熟类别名）→ 描述词汇层为主力，痛苦表达和替代行为为辅
- 类别置信度低（无成熟类别名 / 创造新分类）→ 痛苦表达和替代行为为主力，描述词汇为辅
- 权重比例影响各层查询在总查询计划中的数量占比

### 3.4 平台词汇变换

给每个平台分配查询计划时，需应用平台词汇变换规则。同一需求在不同平台社区有完全不同的表达词汇，query-planner 生成基础词汇后根据平台配置中的词汇变换规则自动变换词汇风格。

平台词汇变换规则存储在 `resources/default-config/platform-vocab.yaml` 配置文件中，支持三层覆盖（系统默认 → 用户全局 → 项目级）。

## 4. adapter 模块

每个平台一个 adapter，比如：

- Google/Bing adapter

- Reddit adapter

- G2 adapter

- Capterra adapter

- App Store adapter

- Google Play adapter

- Product Hunt adapter

- AlternativeTo adapter

## 5. scheduler 模块

负责并行执行：

- 任务队列

- 最大并发数

- 超时

- 重试

- 限流

- 取消任务

- 优先级

## 6. normalization 模块

负责统一结果格式：

- URL 归一化

- 产品名归一化

- 实体消歧

- 评论结构归一化

- 时间格式归一化

## 7. analysis 模块

负责：

- 主题聚类

- 情绪分类

- 竞品识别

- 信号抽取

- 评分计算

- 报告生成

- **社区词汇提取**（新增）：从第一轮搜索结果中提取社区原生词汇，为第二轮精准搜索提供查询基础

### 7.1 社区词汇提取（extract_community_vocabulary）

这是两轮搜索架构的核心中间步骤。从第一轮搜索结果中提取三类词汇：

1. **高频共现词**：在搜索结果标题和摘要中频繁出现、与产品核心 job 相关的词汇
2. **原生需求表达**：用户在社区中描述该需求时使用的自然语言短语（如 "validate my startup idea" 而非 "market research tool"）
3. **竞品语境词汇**：竞品被提及时周围的词汇语境（如 "I switched from X to Y because..." 中的 "switched" 和 "because"）

提取方法：
- 规则路径：基于 TF-IDF + 停用词过滤 + 共现频率统计
- LLM 路径：将第一轮结果摘要送入 LLM，要求提取"用户描述该需求时最常用的原生搜索词"

输出：`VocabSet` 结构，包含 `{pain_expressions: Vec<String>, substitute_behaviors: Vec<String>, community_native_terms: Vec<String>, competitor_context_terms: Vec<String>}`

### 7.2 两轮搜索架构

worker.rs 中的搜索流程从单轮改为两轮：

**第一轮（宽网捕词）**：
- 使用想法建模生成的四层词汇包进行搜索
- 此轮不追求精准匹配，重点是扩大覆盖面
- 搜索完成后，调用 `extract_community_vocabulary()` 提取词汇
- 将提取的词汇回传给 query-planner 生成精化查询集

**第二轮（精准搜索）**：
- 使用精化查询集（VocabRefinement 类型查询）进行搜索
- 这些查询使用的是从真实用户讨论中提取的"原声词汇"
- 搜索精准度大幅提升

**结果合并**：
- 两轮结果合并去重后进入信号提取管道
- 第二轮结果在信号提取时获得更高的 confidence_score（因为词汇更精准）

**快速模式 vs 深度模式**：
- 快速模式：仅执行第一轮搜索，不进行词汇提取和第二轮
- 深度模式：执行完整两轮搜索

## 8. storage 模块

负责：

- SQLite 连接池

- migrations

- repository 层

- FTS 查询

- 缓存策略

## 并行搜索方案

你特别强调并行搜索，这部分确实是效率核心。建议不要做“单大队列串行执行”，而应做 **平台分组并行 + 查询批次并行 + 任务级限流** 的三层并行架构。[](https://tauritutorials.com/blog/building-a-todo-app-in-tauri-with-sqlite-and-sqlx)

## 并行模型

## 第一层：平台并行

不同平台适配器同时运行：

- Reddit

- Google

- App Store

- G2

- Product Hunt

- 等等

## 第二层：平台内查询并行

每个平台内部，再并行跑多类 query：

- 类别词

- 任务词

- 比较词

- 品牌词

- 高意图词

## 第三层：分页 / 结果页并行

对于允许翻页的平台，可以并行抓取前 N 页，但必须受平台限流控制。

## 调度建议

每个任务都带以下字段：

- project_id

- platform

- query_type

- query_text

- priority

- timeout_ms

- retry_count

- rate_limit_bucket

- status

调度器基于 Tokio 管理任务池，按平台维度分别限流。这样不会因为一个平台慢就阻塞全局，也不会因为一个平台规则严格而拖垮整个研究流程。[](https://tauritutorials.com/blog/building-a-todo-app-in-tauri-with-sqlite-and-sqlx)

## 推荐策略

- 全局最大并发：例如 20 到 40。

- 单平台最大并发：例如 2 到 5。

- 单查询超时：例如 10 到 20 秒。

- 指数退避重试：最多 2 到 3 次。

- 可取消运行中项目。

- 支持“快速模式 / 深度模式”。

这两种模式很有用：

- 快速模式：只取头部结果，先给初步结论。

- 深度模式：扩大查询组合和翻页深度，做完整研究。

## 平台配置与规则配置

你提到“多平台基本配置和规则配置，系统默认可用，但允许用户修改”，这必须做成“**三层配置体系**”，否则不是太死就是太乱。

## 配置层级

## 1. 系统默认配置

程序内置，开箱即用。  
例如：

- 默认启用哪些平台

- 每个平台默认查询模板

- 默认超时与重试

- 默认分页深度

- 默认解析规则

- 默认评分权重

## 2. 用户全局配置

用户可以改：

- 启用/禁用平台

- 每个平台最大抓取页数

- 每个平台并发数

- 查询模板是否开启

- 默认地区/语言

## 3. 项目级覆盖配置

针对当前研究项目单独改：

- 本项目是否搜 Reddit

- 本项目是否偏重 App Store

- 本项目语言与地区

- 本项目竞品深度

- 本项目查询类型权重

## 配置文件建议

建议配置既入库，也保留文件快照：

- 默认配置放在应用资源目录。

- 用户配置放在 AppConfig 目录下。[](https://v2.tauri.app/plugin/sql/)

- 项目级配置保存在 SQLite，并可导出为 JSON。

## 平台配置结构示例

每个平台配置建议包括：

- `enabled`

- `priority`

- `platform_type`，如 search/social/app_store/review_site

- `base_urls`

- `query_templates`

- `rate_limit`

- `timeout_ms`

- `max_pages`

- `max_results`

- `parser_rules`

- `normalization_rules`

- `supported_query_types`

- `default_weights`

- **`vocabulary_rules`**（新增）：平台词汇变换规则，包含：
  - `preferred_terms`：该平台社区偏好的词汇列表
  - `avoid_terms`：该平台社区不常用的词汇列表
  - `query_frame`：该平台查询的典型句式框架（如 Reddit 用疑问句、Product Hunt 用比较句）
  - `subreddit_mapping`：Reddit 专用，关键词到子版块的映射

这样你后续新增平台时，只需补 adapter + config + vocabulary_rules，而不需要改整个系统。

## 平台词汇变换配置文件

新增配置文件 `resources/default-config/platform-vocab.yaml`，为每个平台定义词汇变换规则：

```yaml
# 平台词汇变换规则示例
reddit:
  r/startups:
    preferred_terms: ["market validation", "competitive landscape", "PMF", "go-to-market"]
    avoid_terms: ["tool", "software", "app", "platform"]
    query_frame: "question_seeking_advice"
  r/entrepreneur:
    preferred_terms: ["business idea research", "competitor analysis", "market research"]
    avoid_terms: ["intelligence", "orchestration", "automation"]
    query_frame: "experience_sharing"
  r/SideProject:
    preferred_terms: ["validate idea", "check if already exists", "find competitors"]
    query_frame: "show_and_ask"
product_hunt:
  preferred_terms: ["alternative to", "like X but for Y", "for [specific user]"]
  avoid_terms: ["how to", "help me", "looking for"]
  query_frame: "product_comparison"
g2_capterra:
  preferred_terms: ["review", "comparison", "pros and cons", "rating"]
  avoid_terms: ["reddit", "forum", "discussion"]
  query_frame: "evaluation_focused"
app_store:
  preferred_terms: ["app", "tool", "helper", "manager"]
  avoid_terms: ["validate", "research", "intelligence"]
  query_frame: "feature_search"
google_search:
  preferred_terms: []  # 通用搜索引擎，不限制词汇
  avoid_terms: []
  query_frame: "natural_language"
zhihu:
  preferred_terms: ["好用吗", "推荐", "对比", "体验"]
  avoid_terms: []
  query_frame: "question_answer"
```

此配置支持三层覆盖：系统默认（YAML 文件）→ 用户全局（SQLite app_settings）→ 项目级（project_platform_overrides）。

## 平台规则的实现方式

每个平台不要写成一堆散乱逻辑，而应采用：

**平台元配置 + 平台适配器代码 + 可编辑规则模板**

## 规则分三类

## 1. 搜索规则

决定怎么搜：

- query 模板

- query 组合策略

- 品牌词是否和类别词联用

- 是否翻页

## 2. 解析规则

决定怎么从结果里提取：

- 标题

- 链接

- 摘要

- 评分

- 评论文本

- 日期

- 产品名

## 3. 归一化规则

决定怎么统一：

- 产品别名

- 评分标准换算

- 日期格式

- URL 清洗

- 平台特有字段映射

## 数据库方案

建议 SQLite 使用单库 + 若干表，不拆分成多个 DB。理由是简单、稳定、易备份。

## 核心表建议

- projects

- idea_models

- platform_configs

- project_platform_overrides

- search_tasks

- search_results

- raw_documents

- entities

- competitors

- user_voices

- signals

- evaluation_scores

- reports

- app_settings

- migrations

- **vocab_extraction_results**（新增）：存储第一轮搜索后的词汇提取结果
  - project_id
  - round（1=第一轮提取）
  - pain_expressions（JSON array）
  - substitute_behaviors（JSON array）
  - community_native_terms（JSON array）
  - competitor_context_terms（JSON array）
  - extracted_at

- **search_rounds**（新增）：记录搜索轮次
  - project_id
  - round_number（1 或 2）
  - query_plan_snapshot（JSON）
  - result_count
  - started_at
  - completed_at

## 两个关键点

## 1. 原始数据必须保留

不要只存摘要。  
至少保存：

- 原始标题

- 原始摘要

- 原始文本片段

- 原始 URL

- 抓取时间

- 来源平台

这样后续规则升级后可以重新分析，而不用重新抓取。

## 2. 全文检索要早做

评论、帖子、摘要都适合建 FTS 索引。  
因为你的产品后面一定会需要：

- 搜“哪些评论提到了价格太贵”

- 搜“哪些项目里出现过 Notion 作为替代”

- 搜“最近 90 天关于某竞品的负面提及”

SQLite FTS5 足够应付这一层需求。

## 无外部依赖的实现原则

你明确不希望用户自己装数据库、Redis 等，这一点完全可以做到。最优策略是：

- 数据库文件自动创建在 AppConfig 目录。

- 启动时自动跑 migrations。

- 所有缓存也落本地文件或 SQLite。

- 并行队列使用内存 + SQLite 状态持久化，不依赖 Redis。

- 所有配置都内置默认值，首次启动即可使用。

- 安装包直接打包为标准桌面应用。

这样用户的体验就是：

1. 安装应用。

2. 打开。

3. 直接新建研究项目。

而不是先配置数据库、服务、代理、环境变量。

## 分析与 LLM 方案

你前面反复强调不能只靠 LLM 拍脑袋，这里实现上也应遵循“LLM 只做它擅长的部分”。

建议分工如下：

## 用规则/检索做的事

- 平台搜索

- URL 抽取

- 评分抓取

- 评论抓取

- 规则归类

- 竞品候选共现验证

- 统计与评分汇总

## 用 LLM 做的事

- 想法标准化

- 查询词扩展

- 类别候选生成

- 评论主题总结

- 原始文本摘要

- 策略建议生成

## 关键原则

LLM 输出必须落成结构化 JSON，再入库；不要只存一段文本结论。

## 前后端通信建议

Tauri 下推荐：

- 简单命令：用 `#[tauri::command]`

- 长任务：用事件流/状态轮询

- 实时进度：emit 事件到前端

例如一个研究项目运行时，前端应能实时看到：

- 正在跑哪些平台

- 已完成多少查询

- 哪个平台报错

- 当前发现多少竞品

- 当前累计多少评论/帖子

这对并行任务的可见性很重要。

## 文件与目录建议

建议目录大致如下：

- `src/`：前端

- `src-tauri/src/main.rs`

- `src-tauri/src/app/`：应用服务层

- `src-tauri/src/domain/`：实体与规则

- `src-tauri/src/infra/db/`

- `src-tauri/src/infra/adapters/`

- `src-tauri/src/infra/config/`

- `src-tauri/src/infra/http/`

- `src-tauri/src/infra/scheduler/`

- `src-tauri/src/analysis/`

- `src-tauri/migrations/`

- `resources/default-config/`

这种分层比把所有 Rust 代码都塞进 `main.rs` 或单一 service 文件好很多，也更适合后续扩展平台。[](https://tauritutorials.com/blog/building-a-todo-app-in-tauri-with-sqlite-and-sqlx)

## 初版平台建议

第一版不要一口气做十几个平台，建议先做“高价值最小完整集”，但功能本身仍然完整。推荐首批：

- Google/Bing：需求词、类别词、比较词入口。[](https://online.hbs.edu/blog/post/market-validation)

- Reddit：前置需求、比较、真实吐槽。

- G2/Capterra：B2B 竞品与评论。

- App Store / Google Play：消费类产品与应用评论。

- Product Hunt / AlternativeTo：产品发现与替代关系。[](https://www.nxcode.io/resources/news/how-to-run-competitive-analysis-for-startups)

这套组合已经足以支撑完整闭环。

## 建议的实现阶段

## 阶段 1：底座

- Tauri 壳

- SQLite 自动初始化

- 配置系统

- 项目管理

- 任务调度器

- 基础 UI 工作台

## 阶段 2：研究引擎

- 想法建模

- query planner

- 平台 adapter 基础版

- 并行搜索

- 原始结果入库

## 阶段 3：分析层

- 竞品归一化

- 评论/帖子主题提取

- 信号抽取

- 初版评分模型

- 结论页

## 阶段 4：策略层

- 策略建议

- 验证计划

- 报告导出

- 多项目对比

## 最终推荐方案

压缩成一句话，你这个产品最优实现方案是：

**用 Tauri 构建桌面壳，用 Rust 实现本地研究引擎，用 SQLite 做唯一持久化存储，用 Tokio 做并行搜索调度，用“默认配置 + 用户覆盖 + 项目级覆盖”的三层配置体系管理多平台规则，在不依赖外部数据库或 Redis 的前提下实现完整可用的产品研究工作台。**
