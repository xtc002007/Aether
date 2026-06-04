# Aether 核心搜索发现问题：词汇鸿沟诊断与系统性解决方案

本方案针对 Aether 最核心的设计缺陷——以关键词为核心的搜索机制在面对"核心价值难以被关键词捕获"的产品时系统性失效——进行全面诊断，并提出超越纯关键词的多层发现架构。

---

## 一、问题准确定位

### 问题的本质

用户描述产品功能后，在 Reddit、Google、App Store 等平台搜索时，关键词**无法抓到这个应用最核心的地方**。

以 Aether 自身为例：
- Aether 的核心价值 = **跨平台编排采集 + 信号结构化提炼 + 决策框架输出**
- 用户需要这类工具时，他们不会搜索"multi-platform research automation with signal extraction"
- 他们会搜索的是："how do I know if my app idea is taken"、"validate startup idea before building"、"how to research competitors for my product"
- 这些搜索词和 Aether 的产品描述之间存在**巨大的词汇鸿沟**

这个问题不是 Aether 特有的——它是整个产品类别的结构性问题：**当一个产品的核心价值在于其编排过程和决策转化，而非功能特征本身时，任何基于关键词的发现机制都会系统性失效**。

### 为什么这是"最核心的问题"

Aether 的整个价值链是：
```
用户输入想法 → 搜索采集 → 信号提炼 → 决策输出
```
如果"搜索采集"环节因词汇鸿沟而无法找到真正相关的内容，后续的信号提炼和决策输出的质量就从根本上崩溃。这个问题不是某个功能缺失，而是整个方法论的地基问题。

---

## 二、文档现有方案的诊断

### 文档提出了什么

`global-design.md §12.1（想法建模引擎）` 提出：
- 想法拆解（用户、场景、任务、替代方案、价值主张）
- **自动补全研究关键词**
- **自动生成同义词、近义词、场景词、竞品词**
- 自动识别产品类别

`global-ipml.md（query-planner 模块）` 将查询类型定义为：
- 类别词（category keywords）
- 任务词（job keywords）
- 品牌词（brand keywords）
- 比较词（comparison keywords）
- 高意图词（high-intent keywords）

### 文档方案的根本局限性

文档的方案本质上是**词汇扩展（vocabulary expansion）**，而非**词汇桥接（vocabulary bridging）**。它假设：

> "只要从产品描述出发，不断同义扩展，最终能覆盖到用户搜索时使用的词"

这个假设在以下场景下成立：产品有**既有分类名称**（如"todo app"、"time tracker"）。

这个假设在以下场景下**系统性失败**：

| 失败场景 | 具体表现 |
|---|---|
| 产品创造新分类 | 无已有词汇可扩展（Aether 自身就是典型） |
| 价值在方法而非功能 | 用户不搜索"orchestration"，搜索的是他们的痛苦 |
| 用户pain表达与工具描述的范式不同 | 用户说"我想知道值不值得做"，不说"我需要market intelligence tool" |
| 社区词汇高度本地化 | r/startups vs IndieHackers vs HackerNews 用完全不同的词描述同一问题 |
| 无竞品锚点 | 没有已知的同类工具可以做"alternative to X"定位 |

**文档三份文件中没有任何一处**涉及：
- Aether 产品自身的可发现性（用户如何找到 Aether）
- 反向词汇映射（从用户pain表达到工具搜索词）
- 行为模式搜索（搜索用户正在做的事，而非他们需要什么工具）
- 社区词汇感知（不同平台使用不同词汇描述同一需求）
- 迭代词汇发现（用搜索结果中的词汇生成下一轮更精准的查询）

---

## 三、更新的系统性解决方案

### 架构总览

在现有关键词扩展（词汇扩展层）之上，增加四个新层：

```
[现有] 词汇扩展层：类别词 / 任务词 / 品牌词 / 比较词 / 高意图词
         ↓
[新增] 痛苦表达层：用户在感知痛苦时使用的原始语言
         ↓
[新增] 行为模式层：搜索用户正在做的手工行为（即替代方案）
         ↓
[新增] 社区词汇层：各平台社区的本地化词汇挖掘
         ↓
[新增] 迭代精化层：用第一轮结果的词汇生成更精准的第二轮查询
```

---

### 解决方案 1：痛苦表达查询层（Pain-Expression Query Layer）

**现有问题：** 查询从产品描述出发，生成 "product validation tool" 这样的词汇。但用户搜索的是他们的痛苦，不是解决方案的名称。

**新机制：** 在想法建模时，除了生成产品描述词汇，还生成**用户在感知痛苦时会使用的原始搜索词**。

痛苦表达查询模板：
```
"how do I [手工完成产品所做任务的描述]"
"is there a way to [job description without naming the tool]"
"how to find [what the product discovers] without [expensive/complex existing method]"
"[problem description] tool"
"[problem] app that can [核心功能描述]"
"best way to [job] before [consequence]"
```

对于 Aether 自身，这会生成：
- "how to find competitors for my app idea before building"
- "is there a way to research product market fit automatically"
- "how to validate startup idea without spending weeks on research"
- "tool to search Reddit and App Store for product competitors"
- "how to know if my product idea already exists"

**实现位置：** `src-tauri/src/query_planner/mod.rs` 新增 `QueryType::PainExpression` 类型，LLM prompt 中要求从用户 job 推导 pain 表达的自然语言查询。

---

### 解决方案 2：替代行为搜索层（Substitute Behavior Search Layer）

**核心洞察：** 当没有专门工具时，用户会用手工方式解决问题。搜索那些**正在手工做这件事的人**，比搜索工具名称更有效。

对于 Aether，用户的替代行为是：
- "manually checking Reddit, App Store, G2 for my product idea"
- "using ChatGPT to research competitors"
- "spending hours Googling whether my idea exists"

替代行为查询模板：
```
"I manually [手工替代行为描述]"
"using [非专业工具] to [任务描述]"
"spending time [手工过程] for [目标]"
"[pain的结果]: [描述用户放弃或受阻的场景]"
"anyone else [手工行为] to [目标]"
```

**这层查询在 Reddit 特别有效**：找到正在手工做这件事的人，他们就是目标用户，他们的帖子就是需求信号，他们提到的工具就是竞品。

**实现位置：** `query_planner` 的 `SubstituteQuery` 类型，专门在 Reddit、Quora 等社区平台上发送。

---

### 解决方案 3：社区词汇感知（Community Vocabulary Awareness）

**现有问题：** 相同的需求在不同社区有完全不同的表达。生成统一的关键词在跨平台搜索时会丢失大量相关内容。

| 平台 | 同一需求的典型词汇 |
|---|---|
| r/startups | "market validation", "competitive landscape", "go-to-market" |
| r/entrepreneur | "business idea research", "competitor analysis", "market research" |
| IndieHackers | "idea validation", "find competitors before building", "research phase" |
| HackerNews | "prior art", "existing solutions", "market size estimation" |
| App Store | 不搜讨论，搜产品名、功能词 |
| G2 / Capterra | 用功能词、行业词搜评论 |

**新机制：** 在系统配置中，为每个平台维护一个**词汇变换规则表**（vocabulary transform rules）。想法建模生成基础词汇后，根据平台自动变换词汇风格。

```yaml
# 平台词汇变换规则示例（resources/default-config/platform-vocab.yaml）
reddit:
  r/startups:
    preferred_terms: ["market validation", "competitive landscape", "PMF"]
    avoid_terms: ["tool", "software", "app"]
    frame: "question_seeking_advice"
  r/entrepreneur:
    preferred_terms: ["research", "competitor analysis", "market research"]
    frame: "experience_sharing"
product_hunt:
  preferred_terms: ["alternative to", "like X but for Y", "for [specific user]"]
  frame: "product_comparison"
```

**实现位置：** `resources/default-config/` 新增平台词汇配置；`query_planner` 在分配查询到平台时应用变换规则。

---

### 解决方案 4：迭代词汇精化（Iterative Vocabulary Refinement）

**现有问题：** Aether 目前是一次性生成查询、一次性搜索。对于难以用关键词定位的产品，一次搜索结果质量低，但没有机制利用这些结果改进下一轮搜索。

**新机制：** 两轮搜索架构：

**第一轮（宽网捕词）：**
- 用原始模糊关键词搜索
- 不要求结果高度精准
- 重点从结果中**提取词汇**（而非提取信号）

**词汇提取（新增分析步骤）：**
- 从第一轮结果中提取高频共现词
- 识别与产品核心job相关的原生词汇
- 识别竞品被提及时周围的词汇语境

**第二轮（精准搜索）：**
- 使用从真实用户讨论中提取的词汇重新构造查询
- 这些词汇是用户的"原声"，搜索精准度大幅提升

这种**"先捕词，后精搜"**的两阶段架构是解决词汇鸿沟的根本性方法。

**实现位置：** 
- `analysis/mod.rs` 新增 `extract_community_vocabulary(results) -> VocabSet` 函数
- `worker.rs` 在第一轮搜索完成后调用词汇提取，生成精化查询集，再触发第二轮
- 两轮结果合并去重后进入信号提取管道

---

### 解决方案 5：功能三角定位（Functional Triangulation for Competitors）

**现有问题：** 找竞品依赖直接命名（搜索产品名）或类别词。对于无明确类别名的产品，这无法找到所有相关竞品。

**新机制：** 不直接搜索竞品名，而是搜索**竞品被提及的语境**：

```
"alternatives to [手工方法]"
"[adjacent job] + [adjacent job] in one tool"  
"[user type] + [platform A] + [platform B] + research"  ← 找到使用多平台研究的工具
"[product category A] vs [product category B]"  ← 找到跨类别比较的工具
"[pain description] + solution/tool/app/software"
```

通过多个角度的三角定位，找到那些"从不同侧面解决同一问题"的竞品，即使它们使用完全不同的词汇描述自己。

---

## 四、对文档三个核心模块的具体修订建议

### 修订 global-design.md §12.1（想法建模引擎）

**现有：**
> 自动补全研究关键词 / 自动生成同义词、近义词、场景词、竞品词

**更新为：**
> - **描述词汇层**：同义词、近义词、场景词、竞品词（保留现有）
> - **痛苦表达层**：用户感知痛苦时的原始语言查询（新增）
> - **替代行为层**：用户不使用专业工具时手工完成任务的行为描述（新增）
> - **社区词汇层**：针对每个目标平台生成平台本地化词汇变体（新增）
> - 标注：对于无成熟类别名的产品，优先使用痛苦表达层和替代行为层

### 修订 global-design.md §14.1（主流程）

**在步骤2（系统完成想法建模与关键词生成）后，增加：**
> 2a. 系统执行第一轮宽网搜索，并从结果中提取社区原生词汇  
> 2b. 系统用提取的原生词汇生成精化查询集  
> 步骤3（采集）使用精化查询集，而非仅使用原始建模词汇

### 修订 global-ipml.md §3（query-planner 模块）

**在现有5种查询类型基础上，增加：**
> - `PainExpression`：痛苦表达查询（从 job 推导用户的 pain 语言）
> - `SubstituteBehavior`：替代行为查询（搜索手工完成任务的行为描述）
> - `VocabRefinement`：迭代精化查询（第二轮，使用第一轮结果提取的词汇）

---

## 五、实现优先级与文件改动清单

### 必做（解决根本问题）

| # | 改动 | 文件 | 复杂度 |
|---|---|---|---|
| R1 | query_planner 新增 `PainExpression` 和 `SubstituteBehavior` 查询类型 | `query_planner/mod.rs` | M |
| R2 | LLM prompt 扩展：要求输出 pain 表达查询和替代行为查询 | `query_planner/mod.rs` | S |
| R3 | analysis 新增 `extract_community_vocabulary()` 函数 | `analysis/mod.rs` | M |
| R4 | worker 实现两轮搜索架构（第一轮→词汇提取→精化查询→第二轮） | `worker.rs` | L |
| R5 | 平台词汇变换配置文件（Reddit/ProductHunt/AppStore等） | `resources/default-config/platform-vocab.yaml` | M |
| R6 | query_planner 应用平台词汇变换规则 | `query_planner/mod.rs` | M |

### 建议做（大幅提升质量）

| # | 改动 | 文件 | 复杂度 |
|---|---|---|---|
| R7 | 功能三角定位查询模板（`FunctionalTriangulation` 查询类型） | `query_planner/mod.rs` | M |
| R8 | 想法建模 UI 新增"痛苦表达词汇"展示区，允许用户确认/修改 | `IdeaModelingView.tsx` | S |
| R9 | 第一轮搜索后展示"识别到的社区原生词汇"供用户校正 | `IdeaModelingView.tsx` | M |
| R10 | 文档 global-design.md §12.1 和 §14.1 更新 | `docs/global-design.md` | S |
| R11 | 文档 global-ipml.md 查询类型章节更新 | `docs/global-ipml.md` | S |

---

## 六、关键判断：现有文档方案是否足够

**结论：不够，且差距是根本性的，不是细节性的。**

| 维度 | 现有方案 | 缺口 |
|---|---|---|
| 词汇来源 | 产品描述 → 扩展 | 缺少：从用户pain反向推导 |
| 搜索模式 | 一次生成，一次搜索 | 缺少：迭代精化循环 |
| 平台适配 | 相同词汇发给所有平台 | 缺少：平台词汇变换 |
| 竞品发现 | 直接命名/类别词 | 缺少：功能三角定位 |
| 用户验证 | 仅展示生成的关键词 | 缺少：社区原生词汇回显 |

现有方案能处理 **"产品有成熟类别名"** 的场景（如"todo app"、"time tracker"），但对 Aether 这类**创造新类别、核心价值在于编排过程而非功能列表的产品**，现有关键词扩展机制会产生语义偏移——搜索到的是工具的外围而非核心，导致竞品识别不全、需求信号不准、整体研究结论失真。

---

## 七、一句话核心建议

**将 Aether 的查询生成从"描述词汇扩展"升级为"痛苦→行为→词汇→迭代"四层发现架构**，使系统能够找到那些无法用产品类别词直接命中的、处于词汇鸿沟另一端的真实用户讨论和竞品。
