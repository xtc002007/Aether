import { ResearchProject, AppSettings } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  language: "zh",
  theme: "light",
  globalMaxConcurrent: 8,
  defaultCrawlDepth: "quick",
  autoBackup: true,
  saveHtml: false,
  sqlitePath: "/var/lib/research_agent/data.sqlite3"
};

export const MOCK_PROJECTS: ResearchProject[] = [
  {
    id: "p-ai-code-reviewer",
    name: "AI智能代码审查系统",
    createdAt: "2026-05-20 14:32",
    status: "completed",
    ideaModel: {
      statement: "基于大模型的自动化Pull Request代码审查助手，专注于找出代码逻辑漏洞、性能隐患并生成修复建议，避免误报。",
      targetUser: "独立开发者、敏捷研发团队、开源框架维护人员",
      coreJob: "在代码合并入库前，自动进行轻量化、高准确度的安全与质量审查",
      useScenario: "合并PR时，由GitHub Action自动触发，几秒内以评论形式附带建议直接写回代码行上",
      existingAlternatives: "SonarQube（过重、误报高）、人工代码评审（耗时、依赖资深人士经验）、GitHub Copilot Chat",
      productForm: "GitHub GitHub App / CI/CD 插件",
      targetBudget: "$19 - $49 / 团队 / 月",
      researchGoal: "探讨用户对当前静态分析和AI审查工具的负面态度，以此切入高精度单点漏洞捕获市场",
      keyConstraints: "需要直接接入GitHub Webhook，且对检测的准确性有着零误报红线",
      suggestedKeywords: ["AI Code Review", "Pull Request Assistant", "代码漏洞自动检测", "SonarQube 替代方案", "CI/CD 智能审查"],
      categories: ["研发效能", "AI 辅助编程", "安全检测工具"]
    },
    searchTasks: [
      {
        platform: "Reddit",
        query: "r/programming CI code review tools pain",
        status: "success",
        count: 7,
        duration: 280,
        logs: "检索结束。Reddit讨论普遍怨恨传统扫描器『写了50个警告只有1个有用』的毛病。"
      },
      {
        platform: "Google Search",
        query: "AI pull request review assistants pricing",
        status: "success",
        count: 14,
        duration: 410,
        logs: "SEO搜索引擎爬去完成。目前大厂以全家桶为主，单点轻量应用稀缺。"
      },
      {
        platform: "GitHub Community",
        query: "code check automation webhook failures",
        status: "success",
        count: 5,
        duration: 350,
        logs: "发现大部分小型项目的Webhook难以配置，经常因Token失效或者不稳定的Node后端超时中断。"
      },
      {
        platform: "Chrome Store / Plugins",
        query: "github reviews chrome extension alternatives",
        status: "success",
        count: 3,
        duration: 180,
        logs: "识别到若干竞品，平均商店评分 3.8，评价普遍指责页面卡顿且需要本地高频解密私钥。"
      }
    ],
    competitors: [
      {
        id: "comp-sonar",
        name: "SonarQube Suite",
        url: "https://www.sonarsource.com/",
        positioning: "成熟的静态代码质量防护墙。功能极端庞杂，支持数十种语言，是中大型企业的合规首选。",
        targetUser: "企业级架构部、中大研发集团、对发布审计有着强制合规需要的人群",
        coreFeatures: "代码覆盖率监控, 漏洞静态跟踪, 自动化发布审批卡点, 自定义扫描规范组",
        pricing: "$120 - $2000+ / 节点 / 年 (大客户定制模式)",
        platforms: ["Self-Hosted Docker", "Cloud Enterprise"],
        ratings: 4.4,
        reviewsCount: 2310,
        pros: "检测面极广、合规性强，是项目负责人查看度量卡片的不二之选",
        cons: "极度缓慢，几万行代码需要编译扫描十几分钟；误报率暴高，大量『琐碎警告』被研发人员当垃圾直接屏蔽；配置复杂，光安装在本地服务器就难倒一大批新手",
        opportunity: "主打『只查极高风险的3种漏洞』并且『快10倍、不需要配置服务器、10秒在PR里直接评定』的敏捷切入口",
        categoryGroup: "直接竞品"
      },
      {
        id: "comp-coderabbit",
        name: "CodeRabbit AI",
        url: "https://coderabbit.ai",
        positioning: "专门针对 Pull Request 的 AI 自动化评审应用。支持全量 LLM，以逐行提示为核心卖点。",
        targetUser: "敏捷创业小队、追求高效质量把控的GitHub开发者",
        coreFeatures: "PR大纲生成, 行内代码重构建议提审, 聊天上下文多轮对话, 安全防范提示",
        pricing: "$15 / 席位 / 月 (免费试用 14 天)",
        platforms: ["GitHub App", "GitLab App"],
        ratings: 4.6,
        reviewsCount: 154,
        pros: "AI能够极好的梳理出本次提交的代码结构摘要，对新人PR起到了初步把关保障",
        cons: "AI总是爱指点江山，发表一大堆『这里写得不够优雅』或者『可以加个注释』这类唠叨，实际上对程序安全毫无用处。用户感觉像是带了一个烦人的老唐僧，多看几次就很想取消挂载",
        opportunity: "突出『拒绝老唐僧废话唠叨』，系统只在有明显逻辑越界、空指针、并发锁死或内存溢出时才报红发出警告，彻底消除无价值的唠叨式建议",
        categoryGroup: "直接竞品"
      },
      {
        id: "comp-manual",
        name: "人工代码复审 (传统拉群会议)",
        url: "#",
        positioning: "让资深的资深研发组长人肉一行行去看代码并提出改动方案的项目传统流程。",
        targetUser: "所有软件开发团队",
        coreFeatures: "拉会人肉复盘, 思路串讲, 面向面沟通逻辑边界, 跨部门评审签字",
        pricing: "$0 软件成本 (但折算高昂的研发工时费用)",
        platforms: ["物理会议", "Slack", "腾讯会议"],
        ratings: 4.8,
        reviewsCount: 9999,
        pros: "沟通极度深切，不仅查错还能统一对系统模块的架构理解，培训新手见效快",
        cons: "极度耗费工时与精力。一到下午组长都在拉会上，编写代码的开发时间被极大挤压；审查标准往往由组长心情决定，缺乏数字可量化保障",
        opportunity: "利用 AI 将人工代码审查前面的基础低级排查率由 95% 过滤到 0，让会审时间纯粹聚焦在业务主干上",
        categoryGroup: "替代方案"
      }
    ],
    userVoices: [
      {
        id: "voice1",
        userName: "tech_leader_dan",
        platform: "Reddit",
        title: "I turned off automated AI reviewer after 3 days. Too many verbose comments.",
        content: "We installed an AI reviewer client and within a day our PRs were spammed with 40 comments about 'consistent typography in comments' or 'splitting this helper function into ten variables'. It generated zero valuable reports about true race conditions. Our developers are completely ignoring Github notifications now. Please, give me a tool that only opens its mouth if the app actually has a memory leak or crash potential!",
        sentiment: "negative",
        topics: ["AI 唠叨", "误报率度", "通知骚扰"],
        quote: "它刷了40条关于变量命名的废话，却根本找不出生死级性能漏洞。我们全都视而不见了。",
        strength: "high",
        sourceUrl: "https://reddit.com/r/developer_tools/comments/review_spam",
        timestamp: "2026-05-18"
      },
      {
        id: "voice2",
        userName: "g2_coder_alice",
        platform: "G2 Reviews",
        title: "SonarQube setup is nightmare for independent freelancers",
        content: "I work alone on vertical SaaS projects. I wanted to add some automated check gates. Choosing SonarQube meant renting another server with at least 4GB memory, learning a custom properties format, managing Java runtime issues and updating SSL certs manually. If there was a cloud service that charges $5 a month and scans my small repo without single server install, I would buy instantly.",
        sentiment: "negative",
        topics: ["安装难度", "服务器开销", "价格门槛"],
        quote: "Freelancer根本买不起和不会去维护一整台 Sonar 静态服务器，部署难度太地狱了。",
        strength: "medium",
        sourceUrl: "https://g2.com/reviews/sonarqube_onboarding",
        timestamp: "2026-05-15"
      },
      {
        id: "voice3",
        userName: "git_wizard_bob",
        platform: "X (Twitter)",
        title: "Security scan or cosmetic suggestions?",
        content: "Current AI-assisted reviews feel like they are writing highschool essays. When I ask them for code quality review, they don't test arrays bound overflow or pointer checks. They just re-format imports or write minor comments. That is pre-commit hook style, don't brand it as code review genius.",
        sentiment: "negative",
        topics: ["深度不足", "无实效性"],
        quote: "它们更像是大号格式化插件，而不是能提供安全预警、逻辑挑错的程序员助理。",
        strength: "high",
        sourceUrl: "https://twitter.com/dev_wizard/status/review",
        timestamp: "2026-05-19"
      }
    ],
    evaluation: {
      overallRecommendation: "高度建议：在『高精度逻辑找漏』和『零废话骚扰』中存在极其鲜明的差异化切入口。",
      confidenceScore: 92,
      dimensions: [
        { name: "需求强度", score: 9, reason: "研发安全排在首位，全网对PR卡闸防线的质量控制求助与日常吐槽频率极高。" },
        { name: "痛点强度", score: 9, reason: "人工会审占据着大宗高级人力时间，而现有扫描器经常产出几百条无价值杂音警告，令人身心饱受摧残。" },
        { name: "市场拥挤度", score: 7, reason: "CodeRabbit和SonarQube基本两极化霸占了大厂和通配。但特化低噪找漏洞的专精型对手极其虚无。" },
        { name: "差异化空间", score: 9, reason: "主打第一句广告词——『专抓逻辑生死漏，一句废话都不讲，10秒智能入PR』，与老大老二形成降维级区隔。" },
        { name: "用户不满密度", score: 9, reason: "对已有产品最猛烈的不满——『多管闲事乱说废话、部署庞杂把人逼疯』，在开发社区中吐槽成风。" },
        { name: "趋势方向", score: 8, reason: "AI提效已经进入深水区，开发者从狂热的『用AI聊天写模板』正式回归到『用AI挑关键排bug』的务实时代。" },
        { name: "商业化可行性", score: 8, reason: "软件项目天然伴随付费预算，只要能帮助组长少开一次两小时的 review 会审，公司就乐意持续掏钱。" },
        { name: "进入门槛", score: 5, reason: "核心扫描器需要对抽象语法树以及LLM微调具有不俗的精通性，进入门槛中等偏上，有利于构建保护屏障。" },
        { name: "MVP 可验证性", score: 8, reason: "可通过简单的PR机器人检测Demo，只挑选10个流行开源大库里有代表性的内存泄露进行靶场对比，极度容易论证。" }
      ],
      keyOpportunities: "1. 摆脱通俗静态检测的虚无报告，深凿AI捕捉空指针、未处理Promise等强破坏场景。\n2. 绕开复杂平台，主打GitHub Actions等一件流接入，首周即可跑通。",
      keyRisks: "1. 如果前期审查准确度稍微拉胯，误报一次就可能丧失用户长期的使用信用，故底层调教技术是核心本命线。"
    },
    strategy: {
      marketScenario: "差评高度集中的成熟赛道。既有竞品价格偏贵、唠叨无用功能多、让研发团队反感度显著累积。",
      suggestedPath: "单点极致专注：对标 CodeRabbit 唠叨通病，主打『精准逻辑检测与安全抓重虫』定位，降维获客。",
      positioningStatement: "【为不堪垃圾警告困扰的敏捷开发组，提供只抓生死逻辑漏洞的秒级 PR AI 审查关护。】",
      mustHaveFeatures: [
        "GitHub Action 一键自动化挂载",
        "高危内存泄露/高负荷循环安全漏洞核心扫描模块",
        "一键合并PR决策度量预测 (显示本次PR崩溃率估值)",
        "极轻量级配置，免账号部署"
      ],
      avoidFeatures: [
        "多维看板质量大盘与绩效评比分析 (大厂玩物，开发痛恨)",
        "自动帮你自动补充无关痛痒的英文注释与文档整理",
        "多层角色审批工作流"
      ],
      offensiveTactics: "制作精美单页对比，如: SonarQube (15分钟/累死你) 🆚 AI极致哨兵 (10秒/免部署/零废话)，借势夺走流量。"
    },
    validationPlan: [
      {
        category: "程序员求助帖引流访谈",
        target: "深受 Sonar 误报困扰/每周花 5 小时进行代码审查的研发组长",
        action: "在开发者聚集板块以讨论贴发问，收集其遇到过的离奇漏判并且对噪音的忍受极限",
        expectedAssertion: "有 70% 的组长愿意尝试一款能一键过滤 Sonar 重冗检测 90% 的插件",
        duration: "Days 1-3",
        details: "访谈问答设计：\n1. 上一次你的扫描器报错了 30 处，里面真正有致命隐患的包括哪些？\n2. 研发由于 Sonar 不给过而手工打注释欺骗系统，这在你们大组里普遍吗？\n3. 如果有一款插件能在 10 秒里挑出 3 个致命空指针和内存泄露，并且其他一切格式细节绝不多嘴，你每月最高为他开出多少预算？\n4. 在人工复核时，大家犯得最多的拖后腿错误通常是什么样的？\n5. 现有 AI 润色代码工具给你发过多句无意义注释，你觉得最令人怒发冲冠的是什么？"
      },
      {
        category: "漏洞靶场 MVP 落地页搭建",
        target: "让用户亲眼见识『只报高位真漏洞』的对比说服力",
        action: "写一个简单的单页 Web Dapp（靶场），放入一段有精巧逻辑溢出的代码，让用户分别看 SonarQube、CodeRabbit 和我们新系统的审查产出。",
        expectedAssertion: "落地页访客的 GitHub App 一键安装授权转化率 > 10% 证明技术差异说服度强",
        duration: "Days 4-7",
        details: "设计方案细节：\n- 标题: 拒绝 AI 产品『废话垃圾邮件』。体验只说真硬伤的 AI 代码审查器。\n- 互动演示: 贴上同一段高并发下没有加互斥锁的代码，左边顯示CodeRabbit刷了一堆『建议变量加 final』；右边赫然显示我们的扫描系统『警告：第14行未进行高并发加锁，在多线程请求下将导致多扣除余额漏洞！』一键高下立判。\n- CTA等候表单: “GitHub一键绑定免费内测 (前300家企业免除永久订阅包)”"
      },
      {
        category: "定向开发者 GitHub Action 定投测试",
        target: "锁定 CI 开发人群，进行超精准广告覆盖并获取 CPC 数据",
        action: "以 YouTube、X 或特定 CI 技术帖底部，投放 30 元小预算定向。素材卡片专注在『节省你 review 耗费的下半生』。",
        expectedAssertion: "点击率高于行业平均水平 1.5 倍（比如 CTR > 2%），说明该定位直击靶心痛处",
        duration: "Days 8-10",
        details: "广告创意案设计：\n- Ad copy: “不要再用宝贵的生命去评审那些垃圾 PR 注释了。我们设计了一个冷酷的 CI 机器卫士。只看逻辑，只讲硬伤，告别 90% 废话审查批注。GitHub 一键挂载内测试玩。”"
      }
    ],
    platformWeights: {
      reddit: 1.2,
      google: 1.0,
      g2: 1.5,
      store: 0.8
    },
    enabledPlatforms: ["Reddit", "Google Search", "G2 / Capterra"]
  },
  {
    id: "p-fitness-tracker",
    name: "垂直赛道：个人敏捷健身管家",
    createdAt: "2026-05-19 11:20",
    status: "new",
    ideaModel: {
      statement: "专为力量训练极客打造的超轻量记录卡，不支持任何复杂的社交或带货功能，秒开并带离线自动重练同步，手腕震动一圈走人。",
      targetUser: "硬核举铁健身者、健美运动狂热粉、时间管理者",
      coreJob: "在杠铃组数间，通过最少点击次数，记录真实的举铁负重并进行智能负荷折算",
      useScenario: "双手全是汗和镁粉时，在吵闹的健身房里单手迅速点击或双击智能手表表盘完成记录，无需解锁滑屏幕",
      existingAlternatives: "Keep（全是卖课广告和社交弹窗，卡顿严重）、手写小本子、iPhone 自带备忘录",
      productForm: "Apple Watch WatchApp / 轻量级手机客户端",
      targetBudget: "$12 Buyout (买断制模式)",
      researchGoal: "评估硬核拥护者是否反感当前主流健身 App 卖课强推大满贯，并测定买断制可行度",
      keyConstraints: "支持极致的单手/手表物理按钮记录，必须保证在无信号地下健身房离线顺畅存储",
      suggestedKeywords: ["力量训练纯记录 App", "Powerlifting Tracker Simple", "举铁极简记录本", "健身App无广告", "离线健身数据记录"],
      categories: ["健康与运动", "极简小工具", "硬核数据流"]
    },
    searchTasks: [
      {
        platform: "Reddit",
        query: "r/weightlifting app reviews bloat keep simple",
        status: "success",
        count: 5,
        duration: 310,
        logs: " reddit 完成。绝大多数铁粉强烈投诉现在的 App 一进去就是健身教练带货推销广告，卡顿得要命。"
      }
    ],
    competitors: [
      {
        id: "comp-keep",
        name: "Keep 大客户端",
        url: "#",
        positioning: "大众健身体育社交社区。功能极全，含海量跑步、减脂、跳操真人授课、社交打卡、商城硬件销售。",
        targetUser: "入门健身群体、大众减肥男女、社交派网民",
        coreFeatures: "视频跟练, 虚拟社区讨论打卡, 直播打榜, 健身教练大联盟商城",
        pricing: "免费基础 (高级会员 $25/季度, 大宗硬件销售)",
        platforms: ["iOS", "Android", "Watch"],
        ratings: 4.8,
        reviewsCount: 154000,
        pros: "课程极其细致繁多、新手跟着练没有门槛；软件生态完美，国内大红大紫",
        cons: "对于力量训练举铁极客根本不合适；一进去全家桶都是跑步减肥广告；想单独记一组深蹲要点好几层，经常卡死；必须连接网络，在地下常年无信号力量区形同废铁",
        opportunity: "彻底抛除所有跟力量训练无关的视频课与推销。专攻『无网举铁记录』，打开即用、没有一句推播。",
        categoryGroup: "直接竞品"
      }
    ],
    userVoices: [
      {
        id: "v-gym-1",
        userName: "bench_press_140kg",
        platform: "Reddit r/fitness",
        title: "I am literally carrying a paper notebook to gym because apps are too bloated",
        content: "I want to log my heavy squats and reps. With 'famous fitness tracker' apps, it takes 4 taps just to locate my split, another tap to unlock, and then I have to close a pop-up ad for protein powders. My sweat gets all over the screen. I am back to carrying actual pen and a notebook. I need a Watch app where I can just spin the dial to input weight and click once. I don't care about community sharing, leave me alone in the gym.",
        sentiment: "negative",
        topics: ["手写便签", "广告频发", "操作不便"],
        quote: "我带着物理本子和钢笔去健身房，因为健身 App 满屏都是带货牛皮癣广告。",
        strength: "high",
        sourceUrl: "https://reddit.com/r/fitness/notebook",
        timestamp: "2026-05-18"
      }
    ],
    evaluation: {
      overallRecommendation: "非常值得进入 (单点重构类机会)，力量举狂粉基数虽小但付费直接且粘性极其夸张。",
      confidenceScore: 84,
      dimensions: [
        { name: "需求强度", score: 8, reason: "健身极客每天都会打卡记录本，高频程度在各类场景中数一数二。" },
        { name: "痛点强度", score: 9, reason: "在吵闹喘气、全是镁粉的双手环境下使用复杂 App 是一种酷刑，而丢弃不记又影响渐进超负荷。" },
        { name: "市场拥挤度", score: 5, reason: "大众市场已被 Keep、强力教练们完全占满，但完全定位独立、冷酷举铁无课的极简 App 实属未开发土壤。" },
        { name: "差异化空间", score: 8, reason: "主推智能手表 Dial 旋钮实体点选，以及高保真单手点击，建立鲜有的无障碍操作和爽快体验。" },
        { name: "用户不满密度", score: 9, reason: "用户对主流健身客户端不断加塞卖鞋、开会员课等商业化噪音恨之入骨，负面反馈情绪浓厚。" },
        { name: "趋势方向", score: 7, reason: "硬核街头健身和传统力量举概念在国内不断平民化下沉，力量极客队伍在过去三年保持可观扩张。" },
        { name: "商业化可行性", score: 8, reason: "此类网民消费能力极高（买蛋白粉和腰带不买软的），只要好用，买断个 12 美金极其容易转化。" },
        { name: "进入门槛", score: 3, reason: "核心是手表本地快速离线数据库读写，不需要强大的公网服务器或 AI 大模型开销，入门技术极为轻便。" },
        { name: "MVP 可验证性", score: 9, reason: "做一个简单的 TestFlight 尝鲜软件，在相关的健身发烧友论坛，首轮即可抓到上百个狂热铁杆粉给出重磅意见。" }
      ],
      keyOpportunities: "大众 App 逼走硬核用户的典型错位机会。将力量举渐进式负荷分析自动图形化，极有口碑价值。",
      keyRisks: "由于是一个聚焦在力量训练的超极简卡片，在做市场泛化（如做跳舞、做跑步人群）时会遇到天然屏障，要安心专攻少部分核心信徒。"
    },
    strategy: {
      marketScenario: "巨头嫌少、用户嫌累的细分垂直真空。巨头看不上只有力量举能玩的单点，从而空出黄金避难所。",
      suggestedPath: "极端操作优化：把健身手表App操作做到和本子一样甚至比本子更快，主打『肌肉冷酷流，零干扰，无课，极速记录』。",
      positioningStatement: "【为双手 magnesium 镁粉、厌恶广告的力量硬核，提供 1 毫秒实体键入的离线纯粹健身记录卡。】",
      mustHaveFeatures: [
        "Apple Watch 实体数码旋钮 (Digital Crown) 快速负重输入",
        "力量举渐进式超负荷 (Progressive Overload) 自动折算曲线",
        "地底无网区 100% 离线，连网自动后台静默同步",
        "一键数据备份导出 xlsx (保护用户数据劳动主权)"
      ],
      avoidFeatures: [
        "教练视频跟练、直播跟跳、跑步距离记录、各种有氧音乐",
        "社交推荐广场、好友动态、互相合照、带货商城积分兑换",
        "每次启动都有 5 秒的教练卖会员开屏广告"
      ],
      offensiveTactics: "在主流硬核力量举论坛（如贴吧力量举、Reddit r/powerlifting）发小视频展示旋钮单手记录只要 2 秒的极致对比，利用巨头卡死痛点借力夺人。"
    },
    validationPlan: [
      {
        category: "健身房现场深访(或者是相关的技术贴交流)",
        target: "杠铃区常年驻扎、用笔记账或者一直吐槽 App 卡的力量举常客",
        action: "去力量杠铃区观察并搭讪，询问其记录负荷的习惯和痛点",
        expectedAssertion: "大部分人在杠铃间由于手汗或网络转圈，放弃用复杂App，情愿回归最古老本子",
        duration: "Days 1-3",
        details: "经典 5 提问:\n1. 健身房最里面没有 WiFi 和 5G 信号时，你以前的App转圈报错你退过吗？\n2. 空手全是汗，在小屏幕上打字，你最烦躁的过火阻断是什么？\n3. 如果手表顶上那个旋钮稍微滑两下，双击一秒就自动给记录了，你愿意买断费多少钱？\n4. 现在的打卡分享、健身动态、教练跟练短视频，你有哪怕0.1%的概率进去点过吗？\n5. 你记录的数据，最在乎的最终度量是什么？是一周总体负重还是好看的动画图标？"
      },
      {
        category: "Watch App 演示 UI 极短落地页",
        target: "力量铁狂，想要秒开顺理成章的记录感觉",
        action: "放出一张高对比度的戴表手腕举铁 Gif 图。演示极其帅气的旋转手表 Dial 2秒记完 140kg 深蹲并自动进入 3分钟组间休息倒计时的效果。",
        expectedAssertion: "等候内测的加入率能够高于 12% 且全网获得健身 KOL 的主动转发",
        duration: "Days 4-7",
        details: "落地标题设计:『Jia、Keep 太烦。创作者为了杠铃特意拼出这款 App。只为冷酷记录负荷。无需解锁、无求带货、秒记录、终身离线买断。』"
      }
    ],
    platformWeights: {
      reddit: 1.0,
      google: 0.8,
      g2: 0.5,
      store: 1.5
    },
    enabledPlatforms: ["Reddit", "App Store"]
  }
];
