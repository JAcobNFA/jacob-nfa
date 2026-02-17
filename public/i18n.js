const translations = {
  zh: {
    // Nav
    nav_dashboard: "仪表盘",
    nav_command: "指挥中心",
    nav_bot: "Jacob",
    nav_test: "测试",
    nav_guide: "指南",
    nav_connect: "连接钱包",

    // Index - Header
    idx_subtitle: "BAP-578 非同质化代理平台",
    idx_chain: "部署在 BNB 智能链上",
    idx_desc: "JACOB 是一个非同质化代理 (NFA) 平台 - 您必须购买 JACOB 代币来铸造代理 NFT。没有代币，就没有代理。通过销毁代币，在 5 个等级（青铜到黑色）中创建经过验证的 AI 代理。每个代理都在 BAP-578 标准上注册，并通过 ERC-8004 可信身份验证。每个代理都能赚取被动 BNB 收益，通过链上金库交易，并参与战斗竞赛。您销毁的越多，代理就越强大。",
    idx_contracts: "合约",
    idx_supply: "供应量",
    idx_network: "网络",

    // Index - Status Bar
    idx_status_network: "网络",
    idx_status_contracts: "合约",
    idx_status_solidity: "Solidity",
    idx_status_compiled: "10 已编译",

    // Index - Registry
    idx_registry_title: "BAP-578 注册表",
    idx_erc8004_title: "ERC-8004 可信代理（验证身份）",
    idx_agent_id: "代理 ID",
    idx_standard: "标准",
    idx_identity_registry: "身份注册表",
    idx_registration_tx: "注册交易",
    idx_nfa_register: "NFA 注册 - 非同质化代理",
    idx_total_agents: "总代理数",
    idx_nfa_contract: "NFA 注册合约",
    idx_platform_registry: "BAP-578 平台注册表",
    idx_platform_conn: "平台连接",
    idx_bap578_contract: "BAP578 合约",
    idx_platform_registry_label: "平台注册表",

    // Index - Contracts Section
    idx_smart_contracts: "智能合约",
    idx_c3_title: "代理控制器",
    idx_c3_desc: "BAP-578 代理的轻量级链上动作处理器。执行动作并发出事件以进行跟踪。",
    idx_c1_title: "BAP-578 NFA 核心",
    idx_c1_desc: "ERC-721 可枚举 NFT，实现 BAP-578 非同质化代理标准。每个 NFT 代表一个拥有自己金库的可交易 AI 代理。",
    idx_c2_title: "Jacob 代币",
    idx_c2_desc: "混合 ERC-20 + ERC-721 代币，具有通缩销毁机制。销毁代币以创建代理，永久减少总供应量。",
    idx_c4_title: "代理金库 / 资金库",
    idx_c4_desc: "每代理隔离的资金库，集成 PancakeSwap DEX。交换限额由代理等级强制执行 - 更高等级的代理可以进行更大的交易。",
    idx_c5_title: "代理铸造器",
    idx_c5_desc: "销毁 JACOB 代币以铸造分级代理 NFT。牺牲的代币越多，代理等级和金库能力越高。通缩飞轮。",
    idx_file: "文件",
    idx_compiler: "编译器",
    idx_pattern: "模式",
    idx_key_functions: "关键函数",
    idx_events: "事件",
    idx_agent_tiers: "代理等级",
    idx_deploy_first: "优先部署",
    idx_standard_label: "标准",
    idx_interface_id: "接口 ID",
    idx_upgradeable: "可升级",
    idx_name_symbol: "名称 / 符号",
    idx_total_supply: "总供应量",
    idx_nft_ratio: "NFT 比例",
    idx_decimals: "小数位",
    idx_deflationary: "通缩机制",
    idx_router: "路由器",
    idx_security: "安全性",
    idx_ownership: "所有权",
    idx_tier_swap: "等级交换限额",
    idx_security_features: "安全特性",
    idx_mechanism: "机制",
    idx_tiers_label: "等级",
    idx_burn_costs: "每级销毁成本",

    // Index - Tokenomics
    idx_tokenomics_title: "AI 代理代币经济学",
    idx_tokenomics_desc: "JACOB 代币是创建、运营和交易链上 AI 代理的燃料。每一次代币交互都服务于代理生态系统。",
    idx_ops_fund: "代理运营基金",
    idx_ops_desc: "为代理金库提供资金 - 代理需要资本通过金库合约执行链上操作",
    idx_create_treasury: "代理创建金库",
    idx_create_desc: "预留用于代理铸造奖励 - 当代理表现良好时，创建者从此池中获得收益",
    idx_ecosystem: "生态系统发展",
    idx_ecosystem_desc: "构建 AI 模型、代理模板、开发工具和第三方集成",
    idx_lp_title: "代理流动性池",
    idx_lp_desc: "PancakeSwap 交易对 (125K JACOB + 1 BNB) - LP 代币永久销毁，目标 25% LP/MC 比率",
    idx_team_title: "团队",
    idx_team_desc: "12个月锁仓期，24个月线性释放以实现长期利益一致",
    idx_community_title: "社区与空投",
    idx_community_desc: "对代理创建者、动作执行者、早期平台用户的奖励和注册钱包空投",
    idx_reserve_title: "战略储备",
    idx_reserve_desc: "预留用于未来流动性扩张、交易所上市、合作和战略计划",

    // Index - Vesting
    idx_vesting_title: "代币锁仓与释放",
    idx_vesting_desc: "所有主要分配都锁定在链上锁仓合约中。LP 代币永久销毁。不可能抽地毯。",
    idx_lp_lock: "流动性池",
    idx_lp_burned: "LP 已销毁",
    idx_amount: "数量",
    idx_lp_mc: "LP/MC 比率",
    idx_status: "状态",
    idx_method: "方法",
    idx_perm_locked: "永久锁定",
    idx_team_tokens: "团队代币",
    idx_cliff: "锁仓期",
    idx_vesting: "释放",
    idx_fully_unlocked: "完全解锁",
    idx_create_treasury_lock: "代理创建金库",
    idx_eco_dev: "生态系统发展",
    idx_ops_fund_lock: "代理运营基金",
    idx_unlocked: "已解锁",
    idx_available_vault: "可用于代理金库资金",
    idx_reason: "原因",
    idx_needed_ops: "实时代理运营所需",
    idx_community_early: "社区与早期采用者",
    idx_available_airdrop: "可用于空投和奖励",
    idx_community_reason: "社区奖励、空投和用户激励",
    idx_trust_summary: "信任摘要",
    idx_vested_pct: "已锁仓（锁定期 + 线性释放）",
    idx_lp_burned_pct: "LP 已销毁（永久）",
    idx_unlocked_pct: "已解锁（运营 + 社区 + 储备）",
    idx_trust_note: "总供应量的 57.5% 被锁定在锁仓合约中或作为 LP 永久销毁。LP 配对比率为 25% LP/MC（125K JACOB + 1 BNB）。所有锁仓计划均可在链上验证。",

    // Index - Value Flow
    idx_flow_title: "代理价值流",
    idx_flow_desc: "JACOB 代币如何驱动 AI 代理生命周期 - 一个通缩飞轮",
    idx_flow1_title: "获取 JACOB",
    idx_flow1_desc: "用户在 PancakeSwap 上购买 JACOB。代币具有流动性，可在 DEX 上交易，流动性永久锁定。",
    idx_flow2_title: "销毁创建代理",
    idx_flow2_desc: "通过 AgentMinter 销毁 10-10,000 JACOB 以创建分级代理 NFT。代币被永久销毁，减少总供应量。销毁越多 = 等级越高。",
    idx_flow3_title: "注资与运营",
    idx_flow3_desc: "将代币或 BNB 存入代理金库。代理等级决定交换限额 - 黑色等级代理可无限制访问 PancakeSwap 交易。",
    idx_flow4_title: "执行操作",
    idx_flow4_desc: "代理通过控制器执行链上操作。每个操作都有完整的事件跟踪记录。代理是可交易的 ERC-721 NFT。",
    idx_flow5_title: "通缩飞轮",
    idx_flow5_desc: "每次铸造代理都会永久销毁供应量。更多代理 = 更稀缺的代币 = 剩余持有者和现有代理价值更高。生态系统随供应量缩减而增长。",

    // Index - Feature Contracts
    idx_feature_contracts: "功能合约",
    idx_profile_title: "代理档案",
    idx_profile_desc: "链上代理命名、简介和头像。独特名称强制执行确保每个代理都有唯一身份。",
    idx_upgrade_title: "代理升级",
    idx_upgrade_desc: "销毁额外 JACOB 代币将代理升级到更高等级 - 只需支付差额，不浪费已销毁代币。",
    idx_referral_title: "推荐奖励",
    idx_referral_desc: "推荐新用户铸造代理即可获得 JACOB 奖励。等级越高，推荐奖励越大。",
    idx_revenue_title: "收益共享",
    idx_revenue_desc: "基于 epoch 的 BNB 收益分配。代理等级权重：青铜 1x，白银 2x，黄金 4x，钻石 8x，黑色 16x。",
    idx_competition_title: "竞赛管理器",
    idx_competition_desc: "代理交易战斗，含入场费、链上评分和奖金池。5% 的奖金池归平台收益。",

    // Features page
    feat_title: "指挥中心",
    feat_subtitle: "实时平台数据与代理操作",
    feat_burn_tracker: "实时销毁追踪器",
    feat_burned: "已销毁 JACOB",
    feat_remaining: "剩余供应量",
    feat_pct_burned: "% 供应量已销毁",
    feat_agents_created: "已创建代理",
    feat_supply_progress: "供应销毁进度",
    feat_burned_label: "已销毁",
    feat_early_burn: "早期销毁",
    feat_quarter: "四分之一",
    feat_half: "一半供应",
    feat_scarce: "稀缺时代",
    feat_full_burn: "完全销毁",
    feat_minted: "已铸造",
    feat_max: "最大",
    feat_buy_jacob: "购买 JACOB",
    feat_get_tokens: "获取 JACOB 代币",
    feat_buy_desc: "在 PancakeSwap 上购买 JACOB 以铸造 AI 代理 NFT。直接在 DEX 上将 BNB 兑换为 JACOB。",
    feat_current_price: "当前价格",
    feat_pair: "交易对",
    feat_liquidity: "流动性",
    feat_buy_btn: "在 PancakeSwap 购买",
    feat_buy_tip: "提示：在 PancakeSwap 上交换时使用默认 Gas 设置。建议滑点为 1-3%。",
    feat_contract: "合约",
    feat_mint_title: "铸造代理 NFA",
    feat_connect_prompt: "连接您的钱包以铸造代理、交易和管理您的 NFA",
    feat_mint_desc: "销毁 JACOB 代币以创建您的 AI 代理 NFT。选择等级，批准代币消费，然后铸造。每次铸造需要少量 BNB 费用。",
    feat_bronze: "青铜代理",
    feat_silver: "白银代理",
    feat_gold: "黄金代理",
    feat_diamond: "钻石代理",
    feat_black: "黑色代理",
    feat_burn_prefix: "销毁：",
    feat_fee_prefix: "费用：",
    feat_vault_prefix: "金库限额：",
    feat_vault_unlimited: "金库限额：无限制",
    feat_mint_agent: "铸造",
    feat_approve_spend: "批准 JACOB 消费",
    feat_jacob_burn: "销毁 JACOB 数量：",
    feat_bnb_fee: "BNB 铸造费用：",
    feat_your_balance: "您的 JACOB 余额：",
    feat_leaderboard: "代理排行榜",
    feat_all_agents: "所有代理",
    feat_rank: "排名",
    feat_agent: "代理",
    feat_tier: "等级",
    feat_burned_col: "已销毁",
    feat_owner: "所有者",
    feat_lb_empty: "连接钱包或等待代理被铸造",
    feat_profiles: "代理档案",
    feat_profiles_desc: "为您的代理赋予独特身份。名称存储在链上且在所有代理中必须唯一。",
    feat_set_profile: "设置代理档案",
    feat_token_id: "代理代币 ID",
    feat_agent_name: "代理名称（1-32个字符）",
    feat_bio: "简介（最多256个字符）",
    feat_avatar_url: "头像 URL（可选）",
    feat_connect_first: "请先连接钱包",
    feat_lookup: "查询代理档案",
    feat_lookup_btn: "查询",
    feat_upgrades: "代理升级",
    feat_upgrades_desc: "销毁额外 JACOB 代币将代理升级到更高等级。您只需支付等级之间的差额。",
    feat_calc: "升级计算器",
    feat_target_tier: "目标等级",
    feat_upgrade_cost: "升级费用",
    feat_upgrade_btn: "升级代理",
    feat_referrals_title: "推荐系统",
    feat_referrals_desc: "推荐新用户铸造代理即可获得 JACOB 奖励。",
    feat_your_referral: "您的推荐码",
    feat_revenue_title: "收益共享",
    feat_revenue_desc: "代理持有者通过 epoch 赚取 BNB 收益。",
    feat_competitions_title: "交易竞赛",
    feat_competitions_desc: "让您的代理参与交易战斗。",

    // Bot page
    bot_title: "AI 机器人",
    bot_subtitle: "AI 驱动的交易策略引擎",
    bot_console: "策略控制台",
    bot_welcome: "欢迎使用 Jacob AI 交易策略引擎。我可以帮助您：",
    bot_help1: "分析 BNB/JACOB 市场状况",
    bot_help2: "为您的代理等级推荐交易策略",
    bot_help3: "计算最佳入场/出场点",
    bot_help4: "基于金库余额进行风险评估",
    bot_help5: "等级升级建议",
    bot_ask: "您想了解什么？",
    bot_config: "代理配置",
    bot_token_id: "代理代币 ID",
    bot_agent_tier: "代理等级",
    bot_risk: "风险承受度",
    bot_risk_low: "低",
    bot_risk_mod: "中等",
    bot_risk_high: "高",
    bot_risk_aggr: "激进",
    bot_placeholder: "向 Jacob AI 提问...",

    // Test page
    test_title: "测试与交互",
    test_subtitle: "智能合约交互面板",

    // Guide page
    guide_title: "使用指南",
    guide_subtitle: "Jacob NFA 平台完整指南",
    toc_title: "目录",
    toc_1: "什么是 Jacob？",
    toc_2: "工作原理",
    toc_3: "获取 JACOB 代币",
    toc_4: "铸造您的代理",
    toc_5: "代理等级说明",
    toc_6: "使用代理金库",
    toc_7: "代理档案",
    toc_8: "升级您的代理",
    toc_9: "收益共享",
    toc_10: "推荐奖励",
    toc_11: "交易竞赛",
    toc_12: "AI 交易机器人",
    toc_13: "代币经济学",
    toc_14: "BAP-578 与 ERC-8004 注册表",
    toc_15: "常见问题",

    s1_title: "什么是 Jacob？",
    s1_p1: "Jacob 是一个建立在 BNB 智能链 (BSC) 上的非同质化代理 (NFA) 平台。它让您能够创建作为可交易 NFT 存在于区块链上的 AI 代理。",
    s1_p2: "每个代理都是一个 ERC-721 NFT，拥有自己的链上金库、等级和能力。代理可以通过去中心化交易所进行交易、赚取被动 BNB 收益、参与战斗竞赛，并拥有独特的链上身份。",
    s1_highlight: "核心原则：您购买 JACOB 代币，销毁它们来创建代理。您销毁的代币越多，代理的等级和能力就越高。没有代币，就没有代理。",

    s2_title: "工作原理",
    s2_p1: "该平台通过 10 个相互关联的智能合约运作：",
    s2_li1: "<strong>JacobToken</strong> - JACOB 代币（DN404/ERC-404 混合）具有 100:1 NFT 比率。总供应量：1,000,000。",
    s2_li2: "<strong>BAP578NFA</strong> - 核心 ERC-721 NFT 合约。每个 NFT 都是一个具有等级和学习能力的 AI 代理。",
    s2_li3: "<strong>AgentMinter</strong> - 销毁 JACOB 代币以铸造分级代理 NFT。销毁铸造引擎。",
    s2_li4: "<strong>AgentVault</strong> - 每代理金库，集成 PancakeSwap DEX 进行交易。",
    s2_li5: "<strong>AgentController</strong> - 处理链上操作并发出事件以进行跟踪。",
    s2_li6: "<strong>AgentProfile</strong> - 代理的链上命名、简介和头像。",
    s2_li7: "<strong>AgentUpgrade</strong> - 通过销毁更多代币将代理升级到更高等级。",
    s2_li8: "<strong>ReferralRewards</strong> - 通过推荐新用户赚取 JACOB 奖励。",
    s2_li9: "<strong>RevenueSharing</strong> - 基于 epoch 的 BNB 收益分配，按代理等级加权。",
    s2_li10: "<strong>CompetitionManager</strong> - 代理交易战斗，含入场费和奖金池。",

    s3_title: "获取 JACOB 代币",
    s3_p1: "在创建代理之前，您需要 JACOB 代币。获取方法如下：",
    s3_li1: "<strong>设置钱包</strong> - 安装 MetaMask 或任何兼容 BSC 的钱包。添加 BNB 智能链网络（链 ID：56）。",
    s3_li2: "<strong>获取 BNB</strong> - 您需要 BNB 来支付 Gas 费用和购买 JACOB 代币。从交易所购买 BNB 并发送到您的钱包。",
    s3_li3: "<strong>购买 JACOB</strong> - 在 PancakeSwap 上将 BNB 兑换为 JACOB 代币。流动性池为 JACOB/WBNB。",
    s3_highlight: "JACOB 使用 DN404/ERC-404 混合标准，具有 100:1 NFT 比率。您每持有 100 个 JACOB 代币，会自动获得 1 个镜像 NFT。这些与您铸造的代理 NFT 是分开的。",
    s3_warn: "购买前务必验证 JACOB 代币合约地址。仅使用官方 PancakeSwap 流动性池以避免诈骗。",

    s4_title: "铸造您的代理",
    s4_p1: "拥有 JACOB 代币后，您可以销毁它们来铸造 AI 代理 NFT：",
    s4_li1: "<strong>连接钱包</strong> - 访问指挥中心页面并点击【连接钱包】。",
    s4_li2: "<strong>选择等级</strong> - 选择您想要的代理等级（青铜到黑色）。更高等级需要更多代币但拥有更多能力。",
    s4_li3: "<strong>批准代币</strong> - 批准 AgentMinter 合约使用您的 JACOB 代币。",
    s4_li4: "<strong>铸造</strong> - 点击【铸造代理】以销毁您的 JACOB 代币并创建代理 NFT。代币被永久销毁。",
    s4_li5: "<strong>查看代理</strong> - 您的新代理将以 ERC-721 NFT 的形式出现在您的钱包中，拥有独特的 ID、等级和元数据。",
    s4_warn: "销毁是永久性的！用于铸造代理的 JACOB 代币将被永远销毁。这减少了流通供应量并增加了稀缺性。",

    s5_title: "代理等级说明",
    s5_p1: "代理有 5 个等级，能力和销毁成本依次递增：",
    tier_th_tier: "等级",
    tier_th_cost: "销毁成本",
    tier_th_swap: "交换限额",
    tier_th_rev: "收益份额",
    tier_th_limit: "供应限制",
    tier_bronze_cost: "10 JACOB",
    tier_silver_cost: "50 JACOB",
    tier_gold_cost: "200 JACOB",
    tier_diamond_cost: "1,000 JACOB",
    tier_black_cost: "5,000 JACOB",
    tier_unlimited: "无限制",
    tier_unlimited2: "无限制",
    tier_unlimited3: "无限制",
    tier_unlimited4: "无限制",
    tier_black_swap: "无限制",
    tier_black_limit: "最多 100（1% 供应量）",
    s5_highlight: "黑色等级最为独特 - 只能存在 100 个黑色代理（总供应量的 1%）。它们拥有无限制的交换能力和最高的收益份额乘数。",

    s6_title: "使用代理金库",
    s6_p1: "每个代理都有自己的链上金库，称为 AgentVault。以下是您可以使用它做的事情：",
    s6_li1: "<strong>存入 BNB</strong> - 将 BNB 发送到代理金库以资助交易操作。",
    s6_li2: "<strong>在 PancakeSwap 上交易</strong> - 通过集成的 PancakeSwap DEX 执行交换。交换限额取决于代理等级。",
    s6_li3: "<strong>提取</strong> - 代理所有者可以随时从金库中提取资金。",
    s6_highlight: "通过 AgentVault 进行的所有 DEX 交换都将收取 1% 的费用。此费用贡献给平台的收益池，并与所有代理持有者共享。",

    s7_title: "代理档案",
    s7_p1: "为您的代理赋予独特的链上身份：",
    s7_li1: "<strong>名称</strong> - 为代理选择唯一名称。名称在平台上强制唯一。",
    s7_li2: "<strong>简介</strong> - 为代理撰写描述或背景故事。",
    s7_li3: "<strong>头像</strong> - 为代理的个人资料图片设置头像图片 URL。",
    s7_p2: "所有档案数据存储在链上，使其永久且可验证。",

    s8_title: "升级您的代理",
    s8_p1: "您可以通过销毁额外的 JACOB 代币将代理升级到更高等级：",
    s8_li1: "您只需支付当前等级和目标等级之间的差额。",
    s8_li2: "例如，从青铜（10 JACOB）升级到白银（50 JACOB）需要额外花费 40 JACOB。",
    s8_li3: "升级立即生效 - 代理立即获得新等级的权益。",
    s8_li4: "无法降级 - 等级只能上升。",

    s9_title: "收益共享",
    s9_p1: "平台通过 epoch 将 BNB 收益分配给代理持有者：",
    s9_li1: "<strong>收益来源</strong> - 代理铸造费、1% AgentVault 交换费和 5% 的竞赛奖金池。",
    s9_li2: "<strong>分配比例</strong> - 60% 用于平台运营和推广，40% 分配给代理持有者。",
    s9_li3: "<strong>等级加权</strong> - 更高等级的代理按比例获得更多 BNB。黑色代理（16x）每个 epoch 比青铜代理（1x）多赚 16 倍。",
    s9_li4: "<strong>领取</strong> - 您可以在每个 epoch 结束时领取 BNB 奖励。",

    s10_title: "推荐奖励",
    s10_p1: "通过推荐新用户到平台来赚取 JACOB 代币：",
    s10_li1: "与朋友分享您的推荐链接。",
    s10_li2: "当他们使用您的推荐铸造代理时，您将获得 JACOB 代币奖励。",
    s10_li3: "奖励金额根据铸造代理的等级进行调整 - 更高等级的铸造为您带来更大的奖励。",

    s11_title: "交易竞赛",
    s11_p1: "让您的代理与其他代理进行交易对决：",
    s11_li1: "<strong>参赛</strong> - 支付 JACOB 代币入场费让代理参加竞赛。",
    s11_li2: "<strong>评分</strong> - 表现在链上跟踪。代理根据竞赛期间的交易结果进行评分。",
    s11_li3: "<strong>奖品</strong> - 获胜者从奖金池中获得奖品。5% 的奖金池归平台收益。",

    s12_title: "AI 交易机器人",
    s12_p1: "AI 机器人页面提供 AI 驱动的交易策略引擎：",
    s12_li1: "<strong>市场分析</strong> - 获取 BNB/JACOB 市场状况的实时分析。",
    s12_li2: "<strong>交易策略</strong> - 获取适合代理等级的交易策略。",
    s12_li3: "<strong>入场/出场点</strong> - 根据当前状况计算最佳买入和卖出水平。",
    s12_li4: "<strong>风险评估</strong> - 根据代理金库余额和等级限额评估风险。",
    s12_li5: "<strong>升级建议</strong> - 获取关于何时升级代理等级的建议。",
    s12_p2: "在设置面板中配置代理的代币 ID、等级和风险承受度，然后与 AI 聊天获取个性化策略。",

    s13_title: "代币经济学",
    s13_p1: "JACOB 代币总供应量为 1,000,000 个代币，分配如下：",
    alloc_ops: "运营",
    alloc_create: "创建金库",
    alloc_eco: "生态系统",
    alloc_lp: "流动性池（已销毁）",
    alloc_team: "团队（已锁仓）",
    alloc_community: "社区与空投",
    alloc_reserve: "战略储备",
    s13_highlight: "总供应量的 57.5% 被锁定：45% 随时间释放 + 12.5% LP 代币永久销毁。这确保了长期稳定性并防止抛售。",

    s14_title: "BAP-578 与 ERC-8004 注册表",
    s14_p1: "Jacob 在多个链上身份注册表上注册：",
    s14_li1: "<strong>ERC-8004 身份注册表</strong> - 提供无需信任的代理身份验证。Jacob NFA 平台注册为代理 ID #4190。",
    s14_li2: "<strong>NFA 注册表</strong> - 主要的非同质化代理注册表，列出了 2,168+ 个代理。",
    s14_li3: "<strong>BAP-578 平台注册表</strong> - 将 Jacob 连接到 BAP-578 生态系统的官方平台注册表。",
    s14_p2: "所有在 Jacob 上铸造的代理都在其元数据中包含【jacob mention】，确保它们在 nfascan.net 和其他浏览器上正确关联到该项目。",

    s15_title: "常见问题",
    faq_q1: "问：Jacob 运行在哪条区块链上？",
    faq_a1: "答：BNB 智能链 (BSC)，链 ID 56。您需要 BNB 支付 Gas 费用。",
    faq_q2: "问：我可以出售我的代理 NFT 吗？",
    faq_a2: "答：是的！代理是标准的 ERC-721 NFT，可以在任何兼容 BSC 的 NFT 市场上交易。",
    faq_q3: "问：被销毁的代币会怎样？",
    faq_a3: "答：它们被永久销毁。这是一种通缩机制 - 每次铸造或升级代理时，流通供应量都会减少。",
    faq_q4: "问：我可以拥有多个代理吗？",
    faq_a4: "答：是的，您可以铸造任意数量的代理（受黑色等级供应限制）。每个代理都有自己的金库和能力。",
    faq_q5: "问：如何赚取 BNB 收益？",
    faq_a5: "答：只需持有代理 NFT。收益在每个 epoch 结束时分配。更高等级的代理按比例获得更多。",
    faq_q6: "问：AI 机器人免费使用吗？",
    faq_a6: "答：本网站上的 AI 策略机器人面向代理持有者提供。它提供针对代理等级定制的交易分析和建议。",

    guide_footer: "构建于 BNB 智能链 | BAP-578 标准 | ERC-8004 已验证",
    guide_back: "返回仪表盘",

    // Command Center - Revenue Sharing
    cmd_rev_title: "收益共享",
    cmd_rev_desc: "代理持有者从协议收入中赚取被动 BNB。注册您的代理，开始从每笔平台费用中获利。",
    cmd_rev_cta_title: "赚取被动 BNB 收入",
    cmd_rev_cta_desc: "注册您的代理，从<strong>每笔平台费用</strong>中获得份额 — 铸造、金库交换和竞赛。等级越高 = 份额越多 = BNB 越多。",
    cmd_rev_tier_bronze: "青铜：1 份额",
    cmd_rev_tier_silver: "白银：2 份额",
    cmd_rev_tier_gold: "黄金：5 份额",
    cmd_rev_tier_diamond: "钻石：12 份额",
    cmd_rev_tier_black: "黑色：25 份额",
    cmd_rev_agent_id: "代理代币 ID",
    cmd_rev_register_btn: "注册",
    cmd_rev_register_all: "注册我的所有代理",
    cmd_rev_no_agent: "还没有代理？<a href=\"#mint-section\" onclick=\"scrollToSection('.mint-section')\" style=\"color: var(--accent);\">在下方铸造一个</a>开始赚取收益。",
    cmd_rev_streams_title: "收入来源",
    cmd_rev_stream_mint: "代理铸造",
    cmd_rev_stream_mint_desc: "每次铸造收取 BNB 费用",
    cmd_rev_stream_swap: "金库交换",
    cmd_rev_stream_swap_desc: "每笔 DEX 交换收取 1% 费用",
    cmd_rev_stream_swap_detail: "每笔代理交易都会产生收益",
    cmd_rev_stream_comp: "竞赛",
    cmd_rev_stream_comp_desc: "奖金池的 5%",
    cmd_rev_stream_comp_detail: "交易战斗为收益池注资",
    rev_split_platform: "<span style=\"color: var(--accent);\">60%</span> 平台运营和推广",
    rev_split_holders: "<span style=\"color: var(--accent);\">40%</span> 代理持有者",
    cmd_rev_total_deposited: "总收益存入",
    cmd_rev_total_claimed: "已领取总额",
    cmd_rev_unclaimed: "未领取池",
    cmd_rev_total_shares: "总注册份额",
    cmd_rev_share_weights: "各等级份额权重",
    cmd_rev_active_epoch: "当前 Epoch",
    cmd_rev_register_title: "注册代理",
    cmd_rev_register_desc: "在收益池中注册您的代理以获得份额。",
    cmd_rev_agent_id2: "代理代币 ID",
    cmd_rev_your_revenue: "您的收益",
    cmd_rev_your_pending: "待领取总额",
    cmd_rev_your_claimed: "已领取总额",
    cmd_rev_your_agents: "已注册代理",

    // Command Center - Referral
    cmd_ref_title: "推荐系统",
    cmd_ref_desc: "推荐新代理创建者赚取 JACOB 奖励。更高等级的代理获得更大的推荐奖金。",
    cmd_ref_become: "成为推荐人",
    cmd_ref_become_desc: "注册成为推荐人，当您推荐的人创建代理时即可赚取奖励。",
    cmd_ref_set: "设置您的推荐人",
    cmd_ref_set_desc: "在铸造您的第一个代理之前，输入推荐您的人的钱包地址。",
    cmd_ref_rewards: "推荐奖励",

    // Command Center - Competitions
    cmd_comp_title: "交易竞赛",
    cmd_comp_desc: "让您的代理参加交易竞赛。表现最好的代理赢得奖金池。",

    // Command Center - Contracts
    cmd_contracts_title: "新合约",
    cmd_contracts_desc: "为新功能提供支持的 5 个额外智能合约",

    // Command Center - Dashboard
    cmd_dash_title: "代理仪表盘",
    cmd_dash_desc: "选择一个代理以查看其完整功能、金库状态和可用命令。",

    // Command Center - My Agents
    feat_my_agents: "我的代理",
  }
};

let currentLang = localStorage.getItem('jacob_lang') || 'en';

function applyTranslations() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    const useText = (el.tagName === 'BUTTON' || el.tagName === 'INPUT');
    if (currentLang === 'zh' && translations.zh[key]) {
      if (useText) {
        el.textContent = translations.zh[key];
      } else {
        el.innerHTML = translations.zh[key];
      }
    } else if (currentLang === 'en' && el.dataset.originalText) {
      if (useText) {
        el.textContent = el.dataset.originalText;
      } else {
        el.innerHTML = el.dataset.originalText;
      }
    }
  });
}

function storeOriginals() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    if (!el.dataset.originalText) {
      if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
        el.dataset.originalText = el.textContent;
      } else {
        el.dataset.originalText = el.innerHTML;
      }
    }
  });
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'zh' : 'en';
  localStorage.setItem('jacob_lang', currentLang);
  applyTranslations();
  updateLangButton();
  if (typeof window.translateConnectButton === 'function') {
    window.translateConnectButton();
  }
}

function updateLangButton() {
  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.textContent = currentLang === 'en' ? '中文' : 'EN';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  storeOriginals();
  updateLangButton();
  if (currentLang === 'zh') {
    applyTranslations();
  }
});
