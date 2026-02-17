const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const crypto = require('crypto');
const walletStore = require('./walletStore');

const LOGO_PATH = path.join(__dirname, '../../public/images/jacob-token-logo.png');
const TIER_NAMES = { 1: 'Bronze', 2: 'Silver', 3: 'Gold', 4: 'Diamond', 5: 'Black' };
const TIER_EMOJI = { 1: '\u{1F7EB}', 2: '\u{1FA99}', 3: '\u{1F31F}', 4: '\u{1F48E}', 5: '\u{1F3B4}' };
const TIER_SWAP = { 1: '0.1 BNB', 2: '0.5 BNB', 3: '2 BNB', 4: '10 BNB', 5: 'Unlimited' };

const users = {};
const chatRateLimit = {};
const priceAlerts = {};
let cachedMarketData = null;
let lastMarketFetch = 0;

function getUser(chatId) {
  if (!users[chatId]) {
    const stored = walletStore.getStoredWallet(chatId);
    users[chatId] = {
      wallet: stored ? stored.address : null,
      agents: null,
      selectedId: null,
      selectedTier: null,
      selectedName: null,
      referralCode: null,
      referredBy: null,
      referralCount: 0,
      onboardingStep: null,
      joinedAt: Date.now()
    };
  }
  return users[chatId];
}

const referralMap = {};

function genReferralCode(chatId) {
  const code = crypto.createHash('md5').update(String(chatId) + 'jacob').digest('hex').substring(0, 8);
  referralMap[code] = String(chatId);
  return code;
}

function resolveReferrer(refCode) {
  if (referralMap[refCode]) return referralMap[refCode];
  for (const [id, u] of Object.entries(users)) {
    if (u.referralCode === refCode) {
      referralMap[refCode] = String(id);
      return String(id);
    }
  }
  return null;
}

function getWebUrl() {
  if (process.env.WEBAPP_URL) return process.env.WEBAPP_URL;
  if (process.env.REPLIT_DEPLOYMENT_URL) return process.env.REPLIT_DEPLOYMENT_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return `http://localhost:${process.env.PORT || 5000}`;
}

function mainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: '\u{1F4B3} Buy JACOB' }, { text: '\u{1F525} Mint Agent' }, { text: '\u{1F916} Agents' }],
      [{ text: '\u{1F3AF} Alpha Edge' }, { text: '\u{1F4BC} Portfolio' }, { text: '\u{1F4B0} Vault' }],
      [{ text: '\u{1F3C6} Tier' }, { text: '\u26A1 Autopilot' }, { text: '\u{1F517} Invite' }],
      [{ text: '\u2753 Help' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

function onboardingButtons(step) {
  if (step === 'welcome') {
    return {
      inline_keyboard: [
        [{ text: '\u{1F680} Get Started', callback_data: 'onboard_start' }],
        [{ text: '\u{1F4D6} What is Jacob?', callback_data: 'onboard_about' }]
      ]
    };
  }
  if (step === 'wallet') {
    return {
      inline_keyboard: [
        [{ text: '\u{1F4B3} Generate New Wallet', callback_data: 'generate_wallet' }],
        [{ text: '\u{1F517} Link Existing Wallet', callback_data: 'link_wallet_start' }],
        [{ text: '\u23ED Skip for Now', callback_data: 'onboard_skip_wallet' }]
      ]
    };
  }
  if (step === 'agents_found') {
    return {
      inline_keyboard: [
        [{ text: '\u2705 Select Best Agent', callback_data: 'onboard_select_best' }],
        [{ text: '\u{1F4CB} View All Agents', callback_data: 'action_agents' }]
      ]
    };
  }
  if (step === 'no_agents') {
    return {
      inline_keyboard: [
        [{ text: '\u{1F525} Mint Your First Agent', callback_data: 'action_mint' }],
        [{ text: '\u{1F4AC} Chat with Jacob AI Anyway', callback_data: 'onboard_done' }]
      ]
    };
  }
  if (step === 'done') {
    return {
      inline_keyboard: [
        [{ text: '\u{1F4B0} Vault', callback_data: 'action_vault' }, { text: '\u{1F3AF} Alpha Edge', callback_data: 'action_alpha' }],
        [{ text: '\u{1F4B3} Buy JACOB', callback_data: 'action_buy' }, { text: '\u{1F4C8} Price', callback_data: 'action_price' }],
        [{ text: '\u{1F916} My Agents', callback_data: 'action_agents' }, { text: '\u{1F3F7} Tier Info', callback_data: 'action_tier' }],
        [{ text: '\u{1F4BC} Portfolio', callback_data: 'action_portfolio' }, { text: '\u26A1 Autopilot', callback_data: 'action_status' }],
        [{ text: '\u{1F4DC} Trade History', callback_data: 'action_trades' }, { text: '\u{1F517} Invite Friends', callback_data: 'action_invite' }]
      ]
    };
  }
  return { inline_keyboard: [] };
}

function startTelegramBot({ openai, fetchMarketData, fetchAgentContext, verifyAgentTierOnChain, verifyAgentOwnership, TIER_CAPABILITIES, BASE_SYSTEM_PROMPT, fetchWalletAgents, fetchWalletTrades }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[Telegram] No TELEGRAM_BOT_TOKEN found, skipping bot startup');
    return null;
  }

  if (!process.env.REPLIT_DEPLOYMENT && process.env.REPL_SLUG) {
    console.log('[Telegram] Dev environment detected — skipping bot to avoid duplicates with published version');
    return { bot: null, handleWalletLinkAPI: () => {} };
  }

  const bot = new TelegramBot(token, { polling: false });

  const processedUpdates = new Set();
  const MAX_PROCESSED = 5000;
  function isDuplicate(updateId) {
    if (!updateId) return false;
    if (processedUpdates.has(updateId)) return true;
    processedUpdates.add(updateId);
    if (processedUpdates.size > MAX_PROCESSED) {
      const arr = [...processedUpdates];
      for (let i = 0; i < 1000; i++) processedUpdates.delete(arr[i]);
    }
    return false;
  }

  const origProcessUpdate = bot.processUpdate.bind(bot);
  bot.processUpdate = function(update) {
    const uid = update.update_id;
    if (uid && isDuplicate('upd_' + uid)) return;
    return origProcessUpdate(update);
  };

  (async () => {
    try {
      await bot.deleteWebHook({ drop_pending_updates: true });
      console.log('[Telegram] Cleared stale webhook/updates');
    } catch (e) {}
    bot.startPolling({ restart: false });
    console.log('[Telegram] Bot started with polling');
  })();

  bot.on('polling_error', (err) => {
    if (err.code === 'ETELEGRAM' && err.response && err.response.statusCode === 409) return;
    console.error('[Telegram] Polling error:', err.message);
  });

  async function getMarketCached() {
    const now = Date.now();
    if (cachedMarketData && now - lastMarketFetch < 30000) return cachedMarketData;
    try {
      cachedMarketData = await fetchMarketData();
      lastMarketFetch = now;
    } catch (e) {}
    return cachedMarketData;
  }

  async function needAgentMessage(chatId, user, featureName) {
    if (!user.wallet) {
      user.onboardingStep = 'waiting_wallet';
      return sendSafe(chatId,
        `\u{1F6AB} *${featureName}* requires a wallet and an agent.\n\n` +
        `Let's get you set up \u2014 tap below to create a wallet first!`,
        { reply_markup: onboardingButtons('wallet') }
      );
    }
    if (!user.selectedId) {
      return sendSafe(chatId,
        `\u{1F6AB} *${featureName}* requires an active agent.\n\n` +
        `Use /agents to scan and select one of your agents, or mint a new one below.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '\u{1F916} Scan My Agents', callback_data: 'action_agents' }],
              [{ text: '\u{1F525} Mint Agent', callback_data: 'action_mint' }]
            ]
          }
        }
      );
    }
    const costs = await getDynamicTierCosts();
    return sendSafe(chatId,
      `\u{1F6AB} *${featureName}* requires an active agent.\n\n` +
      `You need JACOB tokens to mint one. Current mint costs:\n\n` +
      `\u{1F7EB} *Bronze* \u2014 Burn ${Math.round(costs[1]).toLocaleString()} JACOB\n` +
      `\u{1FA99} *Silver* \u2014 Burn ${Math.round(costs[2]).toLocaleString()} JACOB\n` +
      `\u{1F31F} *Gold* \u2014 Burn ${Math.round(costs[3]).toLocaleString()} JACOB\n` +
      `\u{1F48E} *Diamond* \u2014 Burn ${Math.round(costs[4]).toLocaleString()} JACOB\n` +
      `\u{1F3B4} *Black* \u2014 Burn ${Math.round(costs[5]).toLocaleString()} JACOB\n\n` +
      `\u{1F449} *Step 1:* Buy JACOB with /buy\n` +
      `\u{1F449} *Step 2:* Mint your agent below\n` +
      `\u{1F449} *Step 3:* Select it with /agents`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '\u{1F4B3} Buy JACOB', callback_data: 'action_buy' }],
            [{ text: '\u{1F525} Mint Agent', callback_data: 'action_mint' }],
            [{ text: '\u{1F916} Scan My Agents', callback_data: 'action_agents' }]
          ]
        }
      }
    );
  }

  function sendSafe(chatId, text, opts = {}) {
    const markup = opts.reply_markup || mainMenuKeyboard();
    return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: markup, ...opts }).catch(() => {
      return bot.sendMessage(chatId, text.replace(/[*_`\[\]()~>#+\-=|{}.!]/g, ''), { reply_markup: markup });
    });
  }

  async function handlePrice(chatId) {
    const market = await getMarketCached();
    if (!market || market.price === 'Unavailable') {
      return sendSafe(chatId, 'Market data temporarily unavailable.');
    }
    const change24h = parseFloat(market.change24h);
    const changeEmoji = change24h >= 0 ? '\u{1F7E2}' : '\u{1F534}';
    const changeSign = change24h >= 0 ? '+' : '';
    let text = `*JACOB Market Data*\n\n`;
    text += `\u{1F4B2} Price: \`$${parseFloat(market.price).toFixed(6)}\`\n`;
    text += `${changeEmoji} 24h: ${changeSign}${change24h.toFixed(1)}%\n`;
    text += `\u{1F552} 1h: ${parseFloat(market.change1h) >= 0 ? '+' : ''}${parseFloat(market.change1h).toFixed(1)}%\n`;
    text += `\u{1F4CA} Volume: $${formatNum(market.volume24h)}\n`;
    text += `\u{1F3E6} MCap: $${formatNum(market.marketCap)}\n`;
    text += `\u{1F4A7} Liquidity: $${formatNum(market.liquidity)}`;

    const buttons = {
      inline_keyboard: [
        [{ text: '\u{1F514} Set Price Alert', callback_data: 'alert_setup' }, { text: '\u{1F504} Refresh', callback_data: 'action_price' }],
        [{ text: '\u{1F4C8} Open Chart', url: 'https://dexscreener.com/bsc/jacob' }]
      ]
    };
    return sendSafe(chatId, text, { reply_markup: buttons });
  }

  const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
  const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
  const JACOB_TOKEN = '0x9d2a35f82cf36777A73a721f7cb22e5F86acc318';
  const BSC_RPC_LIST = [
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc-dataseed3.binance.org',
    'https://bsc-dataseed4.binance.org'
  ];
  const BSC_RPC = BSC_RPC_LIST[0];

  const ethersLib = require('ethers');
  const sharedProvider = new ethersLib.JsonRpcProvider(BSC_RPC, 56, { staticNetwork: true });
  let providerIdx = 0;
  function getProvider() { return sharedProvider; }
  function getFreshProvider() {
    providerIdx = (providerIdx + 1) % BSC_RPC_LIST.length;
    return new ethersLib.JsonRpcProvider(BSC_RPC_LIST[providerIdx], 56, { staticNetwork: true });
  }

  const walletAgentsCache = {};
  const WALLET_AGENTS_TTL = 45000;
  async function getCachedWalletAgents(wallet) {
    const key = wallet.toLowerCase();
    const now = Date.now();
    if (walletAgentsCache[key] && now - walletAgentsCache[key].ts < WALLET_AGENTS_TTL) {
      return walletAgentsCache[key].data;
    }
    const agents = await fetchWalletAgents(wallet);
    walletAgentsCache[key] = { data: agents, ts: now };
    return agents;
  }
  function invalidateAgentCache(wallet) {
    if (wallet) delete walletAgentsCache[wallet.toLowerCase()];
  }
  const ROUTER_ABI = [
    'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
    'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
  ];
  const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
  ];

  const AGENT_MINTER = process.env.AGENT_MINTER_V4_ADDRESS || '0xb053397547587fE5B999881e9b5C040889dD47C6';
  const AGENT_PROFILE = '0x2916515Bd7944d52D19943aC62DC76be54687C6E';
  const BAP578_PLATFORM_REGISTRY = '0x15b15DF2fFFF6653C21C11b93fB8A7718CE854Ce';
  const BAP578_NFA_CONTRACT = '0x61b3F08579237DA6247DE20af1F5a4e5a95D9C52';
  const NFA_REGISTER = '0xd7Deb29ddBB13607375Ce50405A574AC2f7d978d';
  const NFA_LOGIC_ADDRESS = '0x1017CD09a86D92b4CBe74CD765eD4B78Ea82a356';
  const PLATFORM_REGISTRY_ABI = [
    'function createAgent(address owner, address nfaContract, string metadataURI) external',
    'function totalSupply() view returns (uint256)'
  ];
  const NFA_REGISTER_ABI = [
    'function createAgent(address owner, address logicContract, string metadataURI, tuple(string traits, string name, string description, string animation, string avatar, bytes32 reserved) config) external payable',
    'function MINT_FEE() view returns (uint256)'
  ];
  const PROFILE_ABI = [
    'function setProfile(uint256 tokenId, string name, string bio, string avatar) external',
    'function isNameAvailable(string name) view returns (bool)'
  ];
  const MINTER_ABI = [
    'function mintAgent(uint8 tier) payable returns (uint256)',
    'function mintFee(uint8) view returns (uint256)',
    'function paused() view returns (bool)',
    'event AgentCreated(address indexed creator, uint256 indexed tokenId, uint8 tier, uint256 burnedAmount)'
  ];
  const APPROVE_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address) view returns (uint256)'
  ];
  let TIER_COSTS = { 1: 10, 2: 50, 3: 250, 4: 1000, 5: 10000 };
  const MINT_FEE_BNB = '0.001';

  let dynamicCostsCache = null;
  let dynamicCostsCacheTime = 0;
  async function getDynamicTierCosts() {
    const now = Date.now();
    if (dynamicCostsCache && (now - dynamicCostsCacheTime) < 60000) return dynamicCostsCache;
    try {
      const MINTER_V4 = process.env.AGENT_MINTER_V4_ADDRESS;
      if (!MINTER_V4) return TIER_COSTS;
      const provider = getProvider();
      const minter = new ethersLib.Contract(MINTER_V4, [
        'function getDynamicCost(uint8 tier) view returns (uint256)',
        'function getAllTierCosts() view returns (uint256[5] jacobCosts, uint256[5] bnbCosts, uint256[5] bnbFees)'
      ], provider);
      const costs = await minter.getAllTierCosts();
      const result = {};
      for (let i = 0; i < 5; i++) {
        result[i + 1] = parseFloat(ethersLib.formatEther(costs.jacobCosts[i]));
      }
      TIER_COSTS = result;
      dynamicCostsCache = result;
      dynamicCostsCacheTime = now;
      return result;
    } catch (e) {
      console.error('Dynamic cost fetch failed:', e.message);
      return TIER_COSTS;
    }
  }

  async function handleMint(chatId) {
    const user = getUser(chatId);
    if (!user.wallet) {
      user.onboardingStep = 'waiting_wallet';
      return sendSafe(chatId, '\u{1F4B3} Set up your wallet first to mint an agent.\n\nTap below to create a wallet!', {
        reply_markup: onboardingButtons('wallet')
      });
    }

    const isCustodial = walletStore.hasGeneratedWallet(chatId);

    if (!isCustodial) {
      const costs = await getDynamicTierCosts();
      return sendSafe(chatId,
        `\u{1F525} *Mint Your Agent*\n\n` +
        `Since you're using a linked wallet, mint via the web app:\n\n` +
        `\u{1F7EB} *Bronze* \u2014 Burn ${costs[1].toLocaleString()} JACOB + 0.001 BNB\n` +
        `\u{1FA99} *Silver* \u2014 Burn ${costs[2].toLocaleString()} JACOB + 0.001 BNB\n` +
        `\u{1F31F} *Gold* \u2014 Burn ${costs[3].toLocaleString()} JACOB + 0.001 BNB\n` +
        `\u{1F48E} *Diamond* \u2014 Burn ${costs[4].toLocaleString()} JACOB + 0.001 BNB\n` +
        `\u{1F3B4} *Black* \u2014 Burn ${costs[5].toLocaleString()} JACOB + 0.001 BNB`,
        {
          reply_markup: { inline_keyboard: [
            [{ text: '\u{1F525} Mint Agent Now', callback_data: 'action_mint' }]
          ]}
        }
      );
    }

    let jacobBal = 0;
    let bnbBal = 0;
    try {
      const provider = getProvider();
      const tokenContract = new ethersLib.Contract(JACOB_TOKEN, APPROVE_ABI, provider);
      const bal = await tokenContract.balanceOf(user.wallet);
      jacobBal = parseFloat(ethersLib.formatEther(bal));
      const bnbWei = await provider.getBalance(user.wallet);
      bnbBal = parseFloat(ethersLib.formatEther(bnbWei));
    } catch (e) {
      console.error('[Telegram] mint balance check error:', e.message);
    }

    let text = `\u{1F525} *MINT YOUR AGENT*\n`;
    text += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n`;
    text += `\u{1F4B0} Your JACOB: \`${jacobBal.toFixed(2)}\`\n`;
    text += `\u{1F4B0} Your BNB: \`${bnbBal.toFixed(4)}\`\n\n`;
    text += `Select a tier to mint:\n\n`;

    const costs = await getDynamicTierCosts();
    const tiers = [
      { tier: 1, name: 'Bronze', cost: costs[1], emoji: '\u{1F7EB}' },
      { tier: 2, name: 'Silver', cost: costs[2], emoji: '\u{1FA99}' },
      { tier: 3, name: 'Gold', cost: costs[3], emoji: '\u{1F31F}' },
      { tier: 4, name: 'Diamond', cost: costs[4], emoji: '\u{1F48E}' },
      { tier: 5, name: 'Black', cost: costs[5], emoji: '\u{1F3B4}' }
    ];

    for (const t of tiers) {
      const canAfford = jacobBal >= t.cost && bnbBal >= 0.001;
      const status = canAfford ? '\u2705' : '\u274C';
      text += `${t.emoji} *${t.name}* \u2014 Burn ${t.cost.toLocaleString()} JACOB + 0.001 BNB ${status}\n`;
    }

    text += `\n_Select a tier below. You need enough JACOB tokens and 0.001 BNB for the mint fee._`;

    const buttons = tiers.map(t => {
      const canAfford = jacobBal >= t.cost && bnbBal >= 0.001;
      return [{ text: `${t.emoji} ${t.name} (${t.cost} JACOB)${canAfford ? '' : ' \u{1F512}'}`, callback_data: `mint_tier_${t.tier}` }];
    });
    buttons.push([{ text: '\u{1F4B3} Buy JACOB First', callback_data: 'action_buy' }]);

    return sendSafe(chatId, text, { reply_markup: { inline_keyboard: buttons } });
  }

  async function executeMint(chatId, tier, agentName) {
    const user = getUser(chatId);
    if (!user.wallet || !walletStore.hasGeneratedWallet(chatId)) {
      return sendSafe(chatId, '\u274C Minting is only available for bot-generated wallets.\n\nGenerate a new wallet with /wallet to mint agents.');
    }

    const tierNum = parseInt(tier);
    if (tierNum < 1 || tierNum > 5) {
      return sendSafe(chatId, '\u274C Invalid tier selected.');
    }

    const keyData = walletStore.exportPrivateKey(chatId);
    if (!keyData || !keyData.privateKey) {
      return sendSafe(chatId, '\u274C Could not access wallet. Please try again.');
    }

    const tierName = TIER_NAMES[tierNum];
    const costs = await getDynamicTierCosts();
    const jacobCost = costs[tierNum];

    const provider = getFreshProvider();
    const wallet = new ethersLib.Wallet(keyData.privateKey, provider);

    try {
      const minterContract = new ethersLib.Contract(AGENT_MINTER, MINTER_ABI, wallet);

      let isPaused = false;
      try { isPaused = await minterContract.paused(); } catch (e) {}
      if (isPaused) {
        return sendSafe(chatId, '\u26D4 *Minting is currently paused.*\n\nPlease try again later or check announcements.');
      }

      let mintFeeWei;
      try {
        mintFeeWei = await minterContract.mintFee(tierNum);
      } catch (e) {
        mintFeeWei = ethersLib.parseEther(MINT_FEE_BNB);
      }
      const mintFeeBnb = parseFloat(ethersLib.formatEther(mintFeeWei));

      const tokenContract = new ethersLib.Contract(JACOB_TOKEN, APPROVE_ABI, wallet);
      const jacobBal = await tokenContract.balanceOf(user.wallet);
      const jacobBalNum = parseFloat(ethersLib.formatEther(jacobBal));
      const bnbBal = await provider.getBalance(user.wallet);
      const bnbBalNum = parseFloat(ethersLib.formatEther(bnbBal));

      if (jacobBalNum < jacobCost) {
        return sendSafe(chatId,
          `\u274C *Insufficient JACOB balance.*\n\n` +
          `\u{1F4B0} You have: \`${jacobBalNum.toFixed(2)} JACOB\`\n` +
          `\u{1F4B3} Need: \`${jacobCost} JACOB\`\n\n` +
          `Buy more JACOB first!`,
          { reply_markup: { inline_keyboard: [[{ text: '\u{1F4B3} Buy JACOB', callback_data: 'action_buy' }]] } }
        );
      }

      const gasReserve = ethersLib.parseEther('0.003');
      if (bnbBal < mintFeeWei + gasReserve) {
        return sendSafe(chatId,
          `\u274C *Insufficient BNB for mint fee + gas.*\n\n` +
          `\u{1F4B0} You have: \`${bnbBalNum.toFixed(4)} BNB\`\n` +
          `\u{1F4B3} Need: ~${(mintFeeBnb + 0.003).toFixed(4)} BNB (${mintFeeBnb} fee + gas)\n\n` +
          `Deposit BNB to:\n\`${user.wallet}\``
        );
      }

      const totalSteps = agentName ? 3 : 2;
      sendSafe(chatId, `\u23F3 *Minting ${tierName} Agent...*${agentName ? ` ("${agentName}")` : ''}\n\n\u{1F525} Step 1/${totalSteps}: Approving ${jacobCost} JACOB tokens...\n_This may take 30-60 seconds._`);

      const approveAmount = ethersLib.parseEther(jacobCost.toString());
      const approveTx = await tokenContract.approve(AGENT_MINTER, approveAmount, { gasLimit: 100000n });
      const approveReceipt = await approveTx.wait();
      if (!approveReceipt || approveReceipt.status === 0) {
        return sendSafe(chatId, '\u274C *Approval transaction failed.*\n\nPlease try again.', {
          reply_markup: { inline_keyboard: [[{ text: '\u{1F504} Try Again', callback_data: 'action_mint' }]] }
        });
      }

      sendSafe(chatId, `\u2705 Approved! Step 2/${totalSteps}: Sending mint transaction...`);

      const mintTx = await minterContract.mintAgent(tierNum, {
        value: mintFeeWei,
        gasLimit: 2000000n
      });

      const receipt = await mintTx.wait();

      let tokenId = '?';
      const iface = new ethersLib.Interface(MINTER_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === 'AgentCreated') {
            tokenId = parsed.args.tokenId.toString();
            break;
          }
        } catch (e) {}
      }

      const newJacob = await tokenContract.balanceOf(user.wallet);
      const newJacobNum = parseFloat(ethersLib.formatEther(newJacob)).toFixed(2);
      const newBnb = await provider.getBalance(user.wallet);
      const newBnbNum = parseFloat(ethersLib.formatEther(newBnb)).toFixed(4);

      user.agents = null;
      invalidateAgentCache(user.wallet);
      user.selectedId = tokenId !== '?' ? tokenId : null;
      user.selectedTier = tierNum;
      user.pendingMintTier = null;
      user.pendingMintName = null;

      let profileStatus = '';
      if (agentName && tokenId !== '?') {
        try {
          sendSafe(chatId, `\u2705 Agent minted! Step 3/3: Setting on-chain name "${agentName}"...`);
          const profileContract = new ethersLib.Contract(AGENT_PROFILE, PROFILE_ABI, wallet);
          const profileTx = await profileContract.setProfile(parseInt(tokenId), agentName, '', '', { gasLimit: 300000n });
          await profileTx.wait();
          profileStatus = `\u{1F4DD} Name: *${agentName}* (set on-chain)\n`;
        } catch (e) {
          console.error('[Telegram] setProfile error:', e.message);
          profileStatus = `\u{1F4DD} Name: "${agentName}" _(failed to set — use /agents to retry)_\n`;
        }
      }

      let registryStatus = '';
      if (tokenId !== '?') {
        try {
          const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
          if (!deployerKey) {
            registryStatus = `\u{1F30D} Global registry: _server config pending_\n`;
          } else {
            const deployerWallet = new ethersLib.Wallet(deployerKey, provider);

            const tierNameLower = tierName.toLowerCase();
            const baseImageURI = 'ipfs://bafybeiekcwmec3a7fwgie7pt7n53zo7itbtkfyje3vlb6nzudngwkjppby/';
            const agentDisplayName = agentName ? `${agentName} (Jacob Agent #${tokenId})` : `Jacob Agent #${tokenId}`;
            const metadata = {
              name: agentDisplayName,
              description: `BAP-578 Non-Fungible Agent - ${tierName} Tier. Burn ${jacobCost} JACOB to mint this AI agent NFT on BNB Smart Chain.`,
              image: `${baseImageURI}nft-${tierNameLower}.png`,
              attributes: [
                { trait_type: 'Tier', value: tierName },
                { trait_type: 'Burned JACOB', value: jacobCost },
                { trait_type: 'Local ID', value: parseInt(tokenId) },
                { trait_type: 'Platform', value: 'Jacob NFA' }
              ]
            };

            let metadataURI = '';
            try {
              const pinataJwt = process.env.PINATA_JWT;
              if (pinataJwt) {
                const fetch = require('node-fetch');
                const pinRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pinataJwt}` },
                  body: JSON.stringify({ pinataContent: metadata, pinataMetadata: { name: `jacob-agent-${tokenId}` } })
                });
                const pinData = await pinRes.json();
                if (pinData.IpfsHash) metadataURI = `ipfs://${pinData.IpfsHash}`;
              }
            } catch (pinErr) {
              console.error('[Telegram] IPFS pin error:', pinErr.message);
            }

            if (!metadataURI) {
              const b64 = Buffer.from(JSON.stringify(metadata)).toString('base64');
              metadataURI = `data:application/json;base64,${b64}`;
            }

            let platformId = '?';
            let nfaRegId = '?';
            const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

            try {
              const platformContract = new ethersLib.Contract(BAP578_PLATFORM_REGISTRY, PLATFORM_REGISTRY_ABI, deployerWallet);
              const pTx = await platformContract.createAgent(user.wallet, BAP578_NFA_CONTRACT, metadataURI, { gasLimit: 500000n });
              const pReceipt = await pTx.wait();
              for (const log of pReceipt.logs) {
                if (log.topics[0] === transferTopic && log.topics.length >= 4) {
                  platformId = parseInt(log.topics[3], 16);
                  break;
                }
              }
              console.log(`[Telegram] Agent #${tokenId} -> PlatformRegistry ID #${platformId}`);
            } catch (pErr) {
              console.error('[Telegram] PlatformRegistry error:', pErr.message);
            }

            try {
              const nfaContract = new ethersLib.Contract(NFA_REGISTER, NFA_REGISTER_ABI, deployerWallet);
              const mintFee = await nfaContract.MINT_FEE();
              const nTx = await nfaContract.createAgent(
                user.wallet,
                NFA_LOGIC_ADDRESS,
                metadataURI,
                ['', agentDisplayName, `BAP-578 Non-Fungible Agent on BNB Smart Chain`, '', '', ethersLib.ZeroHash],
                { value: mintFee, gasLimit: 500000n }
              );
              const nReceipt = await nTx.wait();
              for (const log of nReceipt.logs) {
                if (log.topics[0] === transferTopic && log.topics.length >= 4) {
                  nfaRegId = parseInt(log.topics[3], 16);
                  break;
                }
              }
              console.log(`[Telegram] Agent #${tokenId} -> NFA Register ID #${nfaRegId}`);
            } catch (nErr) {
              console.error('[Telegram] NFA Register error:', nErr.message);
            }

            if (platformId !== '?' || nfaRegId !== '?') {
              registryStatus = `\u{1F30D} *Registered on BAP-578 Global Registries*\n`;
              if (platformId !== '?') registryStatus += `  Platform Registry: #${platformId}\n`;
              if (nfaRegId !== '?') registryStatus += `  NFA Register: #${nfaRegId}\n`;
            } else {
              registryStatus = `\u{1F30D} Global registry: _pending_ _(auto-retry later)_\n`;
            }
          }
        } catch (regErr) {
          console.error('[Telegram] Registry registration error:', regErr.message);
          registryStatus = `\u{1F30D} Global registry: _pending_ _(auto-retry later)_\n`;
        }
      }

      let text = `\u{1F389} *Agent Minted Successfully!*\n\n`;
      text += `${TIER_EMOJI[tierNum]} *${tierName} Agent #${tokenId}*\n`;
      if (profileStatus) text += profileStatus;
      if (registryStatus) text += registryStatus;
      text += `\u{1F525} Burned: ${jacobCost} JACOB\n`;
      text += `\u{1F4CB} TX: \`${receipt.hash.slice(0, 10)}...${receipt.hash.slice(-6)}\`\n\n`;
      text += `\u{1F4B0} JACOB remaining: \`${newJacobNum}\`\n`;
      text += `\u{1F4B0} BNB remaining: \`${newBnbNum}\`\n\n`;
      text += `Your agent is now active! You can use all features.`;

      return sendSafe(chatId, text, {
        reply_markup: { inline_keyboard: [
          [{ text: '\u{1F50D} View TX', url: `https://bscscan.com/tx/${receipt.hash}` }],
          [{ text: '\u{1F916} View My Agents', callback_data: 'action_agents' }],
          [{ text: '\u{1F3AF} Alpha Edge', callback_data: 'action_alpha' }, { text: '\u{1F4BC} Portfolio', callback_data: 'action_portfolio' }]
        ]}
      })
    } catch (e) {
      console.error('[Telegram] mint error:', e.message);
      let errMsg = e.reason || e.message || 'Transaction failed';
      if (errMsg.includes('Insufficient JACOB')) errMsg = 'Not enough JACOB tokens.';
      else if (errMsg.includes('Insufficient BNB')) errMsg = 'Not enough BNB for mint fee.';
      else if (errMsg.includes('paused')) errMsg = 'Minting is currently paused.';
      else if (errMsg.length > 100) errMsg = errMsg.substring(0, 100) + '...';

      return sendSafe(chatId, `\u274C *Mint Failed*\n\n${errMsg}\n\nPlease try again or contact support.`, {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F504} Try Again', callback_data: 'action_mint' }]] }
      });
    }
  }

  async function handleBuy(chatId) {
    const user = getUser(chatId);
    if (!user.wallet) {
      return sendSafe(chatId, '\u{1F4B3} *Set up your wallet first to buy JACOB.*\n\nTap below to create a wallet instantly.', {
        reply_markup: onboardingButtons('wallet')
      });
    }

    const isCustodial = walletStore.hasGeneratedWallet(chatId);
    const market = await getMarketCached();
    let priceLine = '';
    if (market && market.price !== 'Unavailable') {
      priceLine = `\u{1F4B2} Current price: \`$${parseFloat(market.price).toFixed(6)}\`\n\n`;
    }

    if (isCustodial) {
      try {
        const provider = getProvider();
        const bnbBalance = await provider.getBalance(user.wallet);
        const bnbFormatted = parseFloat(ethersLib.formatEther(bnbBalance)).toFixed(4);
        let text = `\u{1F4B3} *Buy JACOB Instantly*\n\n`;
        text += priceLine;
        text += `\u{1F4B0} Your BNB balance: \`${bnbFormatted} BNB\`\n`;
        text += `\u{1F4CB} Wallet: \`${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}\`\n\n`;
        text += `Select an amount of BNB to swap for JACOB:\n`;
        text += `_Swap executes via PancakeSwap V2 with 12% slippage tolerance._`;

        const buttons = {
          inline_keyboard: [
            [
              { text: '0.01 BNB', callback_data: 'buy_0.01' },
              { text: '0.05 BNB', callback_data: 'buy_0.05' },
              { text: '0.1 BNB', callback_data: 'buy_0.1' }
            ],
            [
              { text: '0.25 BNB', callback_data: 'buy_0.25' },
              { text: '0.5 BNB', callback_data: 'buy_0.5' },
              { text: '1 BNB', callback_data: 'buy_1' }
            ],
            [{ text: '\u270F Custom Amount', callback_data: 'buy_custom' }],
            [{ text: '\u{1F4C8} View Chart', url: 'https://dexscreener.com/bsc/jacob' }]
          ]
        };
        return sendSafe(chatId, text, { reply_markup: buttons });
      } catch (e) {
        console.error('[Telegram] Buy balance check error:', e.message);
      }
    }

    let text = `\u{1F4B3} *Buy JACOB*\n\n`;
    text += priceLine;
    text += `Your linked wallet can buy JACOB directly on PancakeSwap.\n\n`;
    text += `Tap below to open the swap page:`;

    const pancakeUrl = `https://pancakeswap.finance/swap?outputCurrency=${JACOB_TOKEN}&chain=bsc`;
    const buttons = {
      inline_keyboard: [
        [{ text: '\u{1F95E} Buy on PancakeSwap', url: pancakeUrl }],
        [{ text: '\u{1F4C8} View Chart', url: 'https://dexscreener.com/bsc/jacob' }]
      ]
    };
    return sendSafe(chatId, text, { reply_markup: buttons });
  }

  async function executeBuy(chatId, bnbAmount) {
    const user = getUser(chatId);
    if (!user.wallet || !walletStore.hasGeneratedWallet(chatId)) {
      return sendSafe(chatId, '\u274C Buy execution is only available for bot-generated wallets.');
    }

    const keyData = walletStore.exportPrivateKey(chatId);
    if (!keyData || !keyData.privateKey) {
      return sendSafe(chatId, '\u274C Could not access wallet. Please try again.');
    }

    const provider = getFreshProvider();
    const wallet = new ethersLib.Wallet(keyData.privateKey, provider);

    try {
      const balance = await provider.getBalance(user.wallet);
      const amountWei = ethersLib.parseEther(bnbAmount);

      const gasEstimate = ethersLib.parseEther('0.005');
      if (balance < amountWei + gasEstimate) {
        const available = parseFloat(ethersLib.formatEther(balance)).toFixed(4);
        return sendSafe(chatId, `\u274C *Insufficient BNB balance.*\n\n\u{1F4B0} Available: \`${available} BNB\`\n\u{1F4B3} Needed: \`${bnbAmount} BNB\` + gas\n\nDeposit BNB to:\n\`${user.wallet}\``);
      }

      sendSafe(chatId, `\u23F3 *Executing swap...*\n\n\u{1F4B3} Swapping \`${bnbAmount} BNB\` for JACOB on PancakeSwap...\n_This may take 10-30 seconds._`);

      const router = new ethersLib.Contract(PANCAKE_ROUTER, ROUTER_ABI, wallet);
      const path = [WBNB_ADDRESS, JACOB_TOKEN];

      let amountOutMin = 0n;
      try {
        const amounts = await router.getAmountsOut(amountWei, path);
        amountOutMin = (amounts[1] * 88n) / 100n;
      } catch (e) {
        console.log('[Telegram] Quote failed, using 0 amountOutMin:', e.message);
      }

      const deadline = Math.floor(Date.now() / 1000) + 300;
      const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        amountOutMin,
        path,
        user.wallet,
        deadline,
        { value: amountWei, gasLimit: 300000n }
      );

      const receipt = await tx.wait();

      const tokenContract = new ethersLib.Contract(JACOB_TOKEN, ERC20_ABI, provider);
      const jacobBalance = await tokenContract.balanceOf(user.wallet);
      const jacobFormatted = parseFloat(ethersLib.formatEther(jacobBalance)).toFixed(2);
      const newBnb = await provider.getBalance(user.wallet);
      const newBnbFormatted = parseFloat(ethersLib.formatEther(newBnb)).toFixed(4);

      let text = `\u2705 *Swap Successful!*\n\n`;
      text += `\u{1F4B3} Swapped: \`${bnbAmount} BNB\` \u2192 JACOB\n`;
      text += `\u{1F4CB} TX: \`${receipt.hash.slice(0, 10)}...${receipt.hash.slice(-6)}\`\n\n`;
      text += `\u{1F4B0} BNB remaining: \`${newBnbFormatted}\`\n`;
      text += `\u{1F3AF} JACOB balance: \`${jacobFormatted}\``;

      return sendSafe(chatId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '\u{1F50D} View TX', url: `https://bscscan.com/tx/${receipt.hash}` }],
            [{ text: '\u{1F4B3} Buy More', callback_data: 'action_buy' }, { text: '\u{1F525} Mint Agent', callback_data: 'action_mint' }]
          ]
        }
      });
    } catch (e) {
      console.error('[Telegram] Buy execution error:', e.message);
      let errMsg = '\u274C *Swap failed.*\n\n';
      if (e.message.includes('insufficient funds')) {
        errMsg += 'Not enough BNB to cover the swap + gas fees.';
      } else if (e.message.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
        errMsg += 'Price moved too much. Try again in a moment.';
      } else if (e.message.includes('TRANSFER_FROM_FAILED')) {
        errMsg += 'Token transfer failed. Liquidity may be low.';
      } else {
        errMsg += `Error: ${e.message.slice(0, 100)}`;
      }
      return sendSafe(chatId, errMsg, {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F504} Try Again', callback_data: 'action_buy' }]] }
      });
    }
  }

  async function handleAgents(chatId) {
    const user = getUser(chatId);
    if (!user.wallet) {
      user.onboardingStep = 'waiting_wallet';
      return sendSafe(chatId, '\u{1F4B3} Set up your wallet first to scan for agents.\n\nTap *Generate New Wallet* for instant setup, or link an existing one.', {
        reply_markup: onboardingButtons('wallet')
      });
    }

    sendSafe(chatId, '\u{1F50D} Scanning blockchain for your agents...');

    try {
      const agents = await getCachedWalletAgents(user.wallet);
      if (!agents || agents.length === 0) {
        return sendSafe(chatId, 'No NFA agents found for this wallet.', {
          reply_markup: onboardingButtons('no_agents')
        });
      }

      agents.sort((a, b) => b.tier - a.tier);
      user.agents = agents;

      let text = `*Your Agents (${agents.length}):*\n\n`;
      const agentButtons = [];
      const nameResults = await Promise.all(agents.map(a =>
        fetchAgentContext(a.tokenId, user.wallet).then(ctx => ctx.profileName || null).catch(() => null)
      ));
      agents.forEach((a, i) => {
        const emoji = TIER_EMOJI[a.tier] || '';
        const name = nameResults[i] ? ` "${nameResults[i]}"` : '';
        text += `${emoji} *#${a.tokenId}${name}* — ${a.tierName} | Swap: ${TIER_SWAP[a.tier] || '?'}\n`;
        const btnLabel = nameResults[i] ? `${emoji} #${a.tokenId} "${nameResults[i]}" (${a.tierName})` : `${emoji} Select Agent #${a.tokenId} (${a.tierName})`;
        agentButtons.push([{ text: btnLabel, callback_data: `select_agent_${a.tokenId}` }]);
      });

      text += `\n_Tap a button below to select your agent:_`;
      return sendSafe(chatId, text, { reply_markup: { inline_keyboard: agentButtons } });
    } catch (e) {
      console.error('[Telegram] agents error:', e.message);
      return sendSafe(chatId, 'Failed to scan blockchain. Please try again.');
    }
  }

  const AGENT_VAULT = '0x120192695152B8788277e46af1412002697B9F25';
  const BAP578_NFA = '0xfd8EeD47b61435f43B004fC65C5b76951652a8CE';
  const VAULT_ABI = [
    'function bnbBalances(uint256) view returns (uint256)',
    'function balances(uint256, address) view returns (uint256)'
  ];
  const NFA_FUND_ABI = [
    'function fundAgent(uint256 tokenId) external payable',
    'function agentFunds(uint256) view returns (uint256)'
  ];

  async function handleVault(chatId) {
    const user = getUser(chatId);
    if (!user.wallet || !user.selectedId) {
      return needAgentMessage(chatId, user, 'Vault');
    }
    try {
      const ctx = await fetchAgentContext(user.selectedId, user.wallet);
      const displayTier = (ctx.tier && ctx.tier > 1) ? ctx.tier : (user.selectedTier || ctx.tier || 1);
      const displayTierName = { 1: 'Bronze', 2: 'Silver', 3: 'Gold', 4: 'Diamond', 5: 'Black' }[displayTier] || ctx.tierName;
      const emoji = TIER_EMOJI[displayTier] || '';
      const vaultName = ctx.profileName ? ` "${ctx.profileName}"` : '';
      let text = `${emoji} *Agent #${ctx.agentId}${vaultName} Vault*\n\n`;
      text += `\u{1F3F7} Tier: ${displayTierName}\n`;
      text += `\u{1F4B0} BNB: \`${parseFloat(ctx.vaultBnb || 0).toFixed(4)}\`\n`;
      text += `\u{1FA99} JACOB: \`${parseFloat(ctx.vaultJacob || 0).toFixed(2)}\`\n`;
      const displaySwap = (displayTier > 1 && TIER_SWAP[displayTier]) ? TIER_SWAP[displayTier] : (ctx.maxSwap || TIER_SWAP[displayTier] || '?');
      text += `\u{1F504} Swap Limit: ${displaySwap}\n\n`;
      text += `\u{1F4B5} Revenue: ${ctx.revenueRegistered ? 'Registered \u2705' : 'Not Registered \u274C'}\n`;
      text += `\u23F3 Pending: ${parseFloat(ctx.pendingRevenue || 0).toFixed(4)} BNB\n`;
      text += `\u2705 Claimed: ${parseFloat(ctx.revenueClaimed || 0).toFixed(4)} BNB`;

      const isCustodial = walletStore.hasGeneratedWallet(chatId);
      const buttons = {
        inline_keyboard: [
          (!ctx.revenueRegistered) ? [
            { text: '\u{1F4B5} Register for Rev Share', callback_data: 'vault_revshare' }
          ] : [],
          isCustodial ? [
            { text: '\u{1F4E5} Deposit BNB', callback_data: 'vault_deposit' },
            { text: '\u{1F4E4} Withdraw BNB', callback_data: 'vault_withdraw' }
          ] : [],
          [{ text: '\u{1F504} Refresh', callback_data: 'action_vault' }],
          [{ text: '\u{1F916} View Agents', callback_data: 'action_agents' }]
        ].filter(row => row.length > 0)
      };
      return sendSafe(chatId, text, { reply_markup: buttons });
    } catch (e) {
      return sendSafe(chatId, 'Failed to fetch vault data. Try again.');
    }
  }

  const REVENUE_SHARING_ADDR = '0xE3824DA052032476272e6ff106fe33aB9959FD7e';
  const REVENUE_SHARING_ABI_BOT = [
    'function registerAgent(uint256 tokenId) external',
    'function registeredAgent(uint256) view returns (bool)'
  ];

  async function handleRevShareRegister(chatId) {
    const user = getUser(chatId);
    if (!user.wallet || !user.selectedId) {
      return needAgentMessage(chatId, user, 'Revenue Share');
    }

    const provider = getProvider();
    const revContract = new ethersLib.Contract(REVENUE_SHARING_ADDR, REVENUE_SHARING_ABI_BOT, provider);

    const alreadyRegistered = await revContract.registeredAgent(user.selectedId).catch(() => false);
    if (alreadyRegistered) {
      return sendSafe(chatId, `\u2705 *Agent #${user.selectedId} is already registered for revenue sharing!*\n\nYou'll automatically earn BNB from platform fees each epoch.`, {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F4B0} View Vault', callback_data: 'action_vault' }]] }
      });
    }

    if (!walletStore.hasGeneratedWallet(chatId)) {
      return sendSafe(chatId,
        `\u{1F4B5} *Register Agent #${user.selectedId} for Revenue Sharing*\n\n` +
        `Once registered, your agent earns passive BNB from platform fees (minting, vault swaps, competitions).\n\n` +
        `\u{1F517} Register via the web app:\nhttps://jacobnfa.com/command.html\n\n` +
        `Or call \`registerAgent(${user.selectedId})\` on the RevenueSharing contract:\n\`${REVENUE_SHARING_ADDR}\``,
        { reply_markup: { inline_keyboard: [[{ text: '\u{1F4B0} View Vault', callback_data: 'action_vault' }]] } }
      );
    }

    const keyData = walletStore.exportPrivateKey(chatId);
    if (!keyData || !keyData.privateKey) {
      return sendSafe(chatId, '\u274C Could not access wallet. Please try again.');
    }

    sendSafe(chatId, `\u23F3 *Registering Agent #${user.selectedId} for revenue sharing...*`);

    try {
      const writeProvider = getFreshProvider();
      const wallet = new ethersLib.Wallet(keyData.privateKey, writeProvider);
      const revSigned = new ethersLib.Contract(REVENUE_SHARING_ADDR, REVENUE_SHARING_ABI_BOT, wallet);
      const tx = await revSigned.registerAgent(user.selectedId, { gasLimit: 150000 });
      const receipt = await tx.wait();

      return sendSafe(chatId,
        `\u2705 *Revenue Share Registration Successful!*\n\n` +
        `\u{1F916} Agent: #${user.selectedId}\n` +
        `\u{1F4B5} Status: Registered for BNB revenue\n` +
        `\u{1F4CB} TX: [View on BscScan](https://bscscan.com/tx/${receipt.hash})\n\n` +
        `Your agent will now earn passive BNB from platform fees each epoch. The higher your tier, the more shares you receive.`,
        {
          reply_markup: { inline_keyboard: [
            [{ text: '\u{1F4B0} View Vault', callback_data: 'action_vault' }]
          ]}
        }
      );
    } catch (e) {
      console.error('[Telegram] Rev share register error:', e.message);
      return sendSafe(chatId, `\u274C *Registration failed:* ${e.reason || e.message || 'Unknown error'}\n\nMake sure your wallet has some BNB for gas and try again.`, {
        reply_markup: { inline_keyboard: [
          [{ text: '\u{1F504} Try Again', callback_data: 'vault_revshare' }],
          [{ text: '\u{1F4B0} View Vault', callback_data: 'action_vault' }]
        ]}
      });
    }
  }

  async function handleVaultDeposit(chatId) {
    const user = getUser(chatId);
    if (!user.wallet || !user.selectedId) {
      return needAgentMessage(chatId, user, 'Vault Deposit');
    }
    if (!walletStore.hasGeneratedWallet(chatId)) {
      return sendSafe(chatId, '\u{1F517} Deposit BNB to your agent vault via the web app:\nhttps://jacobnfa.com/autotrade.html');
    }

    const provider = getProvider();
    const bnbBal = await provider.getBalance(user.wallet);
    const bnbNum = parseFloat(ethersLib.formatEther(bnbBal));

    if (bnbNum < 0.002) {
      return sendSafe(chatId, `\u274C *Insufficient BNB balance.*\n\nYou have \`${bnbNum.toFixed(4)}\` BNB in your wallet.\nYou need at least 0.002 BNB (including gas).`);
    }

    const availBnb = Math.max(0, bnbNum - 0.001);
    let text = `\u{1F4E5} *Deposit BNB to Agent #${user.selectedId} Vault*\n\n`;
    text += `\u{1F4B0} Wallet BNB: \`${bnbNum.toFixed(4)}\`\n`;
    text += `\u{1F4B0} Available (after gas): \`${availBnb.toFixed(4)}\`\n\n`;
    text += `Select amount to deposit:`;

    const presets = [];
    if (availBnb >= 0.01) presets.push({ text: '0.01 BNB', callback_data: 'vault_dep_0.01' });
    if (availBnb >= 0.05) presets.push({ text: '0.05 BNB', callback_data: 'vault_dep_0.05' });
    if (availBnb >= 0.1) presets.push({ text: '0.1 BNB', callback_data: 'vault_dep_0.1' });
    if (availBnb >= 0.5) presets.push({ text: '0.5 BNB', callback_data: 'vault_dep_0.5' });

    const buttons = [
      presets.length > 0 ? presets.slice(0, 2) : [],
      presets.length > 2 ? presets.slice(2) : [],
      [{ text: '\u{1F4DD} Custom Amount', callback_data: 'vault_dep_custom' }],
      [{ text: '\u274C Cancel', callback_data: 'action_vault' }]
    ].filter(row => row.length > 0);

    return sendSafe(chatId, text, { reply_markup: { inline_keyboard: buttons } });
  }

  async function handleVaultWithdraw(chatId) {
    const user = getUser(chatId);
    if (!user.wallet || !user.selectedId) {
      return needAgentMessage(chatId, user, 'Vault Withdraw');
    }
    if (!walletStore.hasGeneratedWallet(chatId)) {
      return sendSafe(chatId, '\u{1F517} Withdraw BNB from your agent vault via the web app:\nhttps://jacobnfa.com');
    }

    const provider = getProvider();
    const nfaContract = new ethersLib.Contract(BAP578_NFA, NFA_FUND_ABI, provider);
    const agentBnb = await nfaContract.agentFunds(user.selectedId);
    const bnbNum = parseFloat(ethersLib.formatEther(agentBnb));

    if (bnbNum < 0.001) {
      return sendSafe(chatId, `\u274C *No BNB in vault.*\n\nAgent #${user.selectedId} vault has \`${bnbNum.toFixed(4)}\` BNB.\nDeposit BNB first.`);
    }

    let text = `\u{1F4E4} *Withdraw BNB from Agent #${user.selectedId} Vault*\n\n`;
    text += `\u{1F3E6} Vault BNB: \`${bnbNum.toFixed(4)}\`\n\n`;
    text += `\u26A0 *Note:* BNB withdrawal from the agent vault requires using the web app or BscScan directly.\n\n`;
    text += `\u{1F517} [Open Command Center](https://jacobnfa.com/command.html)`;

    const buttons = [
      [{ text: '\u{1F504} Refresh Vault', callback_data: 'action_vault' }]
    ];

    return sendSafe(chatId, text, { reply_markup: { inline_keyboard: buttons } });
  }

  async function executeVaultDeposit(chatId, amount) {
    const user = getUser(chatId);
    if (!user.wallet || !user.selectedId || !walletStore.hasGeneratedWallet(chatId)) return;

    const keyData = walletStore.exportPrivateKey(chatId);
    if (!keyData || !keyData.privateKey) {
      return sendSafe(chatId, '\u274C Could not access wallet. Please try again.');
    }

    const provider = getFreshProvider();
    const wallet = new ethersLib.Wallet(keyData.privateKey, provider);

    try {
      const bnbBal = await provider.getBalance(user.wallet);
      let depositAmount;
      if (amount === 'all') {
        const gasReserve = ethersLib.parseEther('0.001');
        depositAmount = bnbBal > gasReserve ? bnbBal - gasReserve : 0n;
      } else {
        depositAmount = ethersLib.parseEther(amount.toString());
      }

      if (depositAmount === 0n || bnbBal < depositAmount + ethersLib.parseEther('0.0005')) {
        return sendSafe(chatId, `\u274C Insufficient BNB. You have \`${ethersLib.formatEther(bnbBal)}\` BNB (need gas too).`);
      }

      const depositNum = parseFloat(ethersLib.formatEther(depositAmount));
      sendSafe(chatId, `\u23F3 *Depositing ${depositNum.toFixed(4)} BNB to Agent #${user.selectedId} vault...*`);

      const nfaContract = new ethersLib.Contract(BAP578_NFA, NFA_FUND_ABI, wallet);
      const depTx = await nfaContract.fundAgent(user.selectedId, { value: depositAmount, gasLimit: 100000 });
      const receipt = await depTx.wait();

      return sendSafe(chatId,
        `\u2705 *Deposit Successful!*\n\n` +
        `\u{1F4E5} Deposited: \`${depositNum.toFixed(4)}\` BNB\n` +
        `\u{1F916} Agent: #${user.selectedId}\n` +
        `\u{1F4CB} TX: [View on BscScan](https://bscscan.com/tx/${receipt.hash})`,
        {
          reply_markup: { inline_keyboard: [
            [{ text: '\u{1F4B0} View Vault', callback_data: 'action_vault' }]
          ]}
        }
      );
    } catch (e) {
      console.error('Vault deposit error:', e.message);
      return sendSafe(chatId, `\u274C *Deposit failed:* ${e.reason || e.message || 'Unknown error'}\n\nPlease try again.`);
    }
  }

  async function handleTier(chatId) {
    const user = getUser(chatId);
    if (!user.wallet || !user.selectedId) {
      return needAgentMessage(chatId, user, 'Tier Info');
    }
    const tier = user.selectedTier || 1;
    const cap = TIER_CAPABILITIES[tier] || TIER_CAPABILITIES[1];
    const emoji = TIER_EMOJI[tier] || '';

    let text = `${emoji} *${cap.name} Tier — AI Capabilities*\n\n`;
    text += `*Unlocked:*\n`;
    cap.aiFeatures.forEach(f => { text += `  \u2705 ${f}\n`; });
    if (cap.locked && cap.locked.length > 0) {
      text += `\n*Locked:*\n`;
      cap.locked.forEach(f => { text += `  \u{1F512} ${f}\n`; });
    }
    text += `\n\u{1F504} Swap Limit: ${cap.maxSwap}\n\u{1F4CA} Revenue Shares: ${cap.shares}`;

    const buttons = { inline_keyboard: [] };
    if (tier < 5) {
      buttons.inline_keyboard.push([{ text: '\u2B06 Upgrade Tier', callback_data: 'action_mint' }]);
    }
    return sendSafe(chatId, text, { reply_markup: buttons });
  }

  async function handleStatus(chatId) {
    const user = getUser(chatId);
    if (!user.wallet || !user.selectedId) {
      return needAgentMessage(chatId, user, 'Autopilot');
    }

    let tierNum = user.selectedTier || 1;
    try {
      tierNum = await verifyAgentTierOnChain(user.selectedId);
      user.selectedTier = tierNum;
    } catch (e) {}

    if (tierNum < 4) {
      let text = `\u26A1 *Autopilot — Agent #${user.selectedId}*\n\n`;
      text += `\u{1F512} *Locked* — Diamond+ tier required\n\n`;
      text += `Your agent is *${TIER_NAMES[tierNum]}*. Autonomous AI trading is available for Diamond and Black tier agents.\n\n`;
      text += `Upgrade your agent to unlock:`;
      return sendSafe(chatId, text, {
        reply_markup: { inline_keyboard: [
          [{ text: '\u2B06 Upgrade Tier', callback_data: 'action_mint' }],
          [{ text: '\u{1F525} Mint Diamond Agent', callback_data: 'action_mint' }]
        ]}
      });
    }

    try {
      const res = await fetch(`http://localhost:${process.env.PORT || 5000}/api/auto-trade/status?agentId=${user.selectedId}`);
      const data = await res.json();
      let text = `\u26A1 *AUTOPILOT — Agent #${user.selectedId}*\n`;
      text += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n`;

      if (data.enabled) {
        text += `\u{1F7E2} *STATUS: ACTIVE*\n\n`;
        text += `\u{1F3AF} Strategy: *${(data.strategy || 'balanced').toUpperCase()}*\n`;
        text += `\u{1F4CA} Total Trades: ${data.totalTrades || 0}\n`;
        text += `\u{1F4B0} Volume: \`${(data.totalVolumeBNB || 0).toFixed(4)}\` BNB\n`;
        text += `\u{1F4B3} Max Trade: \`${data.maxTradeBNB || 0.05}\` BNB\n`;
        text += `\u{1F4C5} Daily Cap: \`${data.dailyCapBNB || 0.2}\` BNB\n`;
        text += `\u{1F4C8} Daily Spent: \`${(data.dailySpent || 0).toFixed(4)}\` BNB\n`;
        text += `\u{1F4C9} Daily Left: \`${(data.dailyRemaining || 0).toFixed(4)}\` BNB\n`;
        text += `\u{1F6E1} Stop Loss: ${data.stopLossPct || 10}% | Take Profit: ${data.takeProfitPct || 20}%\n`;
        if (data.cooldownActive) text += `\n\u23F3 *Cooldown active* (${data.cooldownMins || 30}min between trades)`;
        if (data.lastTradeAt) text += `\n\u{1F552} Last trade: ${new Date(data.lastTradeAt).toLocaleString()}`;

        return sendSafe(chatId, text, {
          reply_markup: { inline_keyboard: [
            [{ text: '\u{1F534} Disable Autopilot', callback_data: 'autotrade_disable' }],
            [{ text: '\u{1F4DC} Trade History', callback_data: 'action_trades' }],
            [{ text: '\u{1F504} Refresh', callback_data: 'action_status' }]
          ]}
        });
      } else {
        text += `\u26AB *STATUS: OFFLINE*\n\n`;
        text += `AI-powered autonomous trading for your Diamond+ agent.\n\n`;
        text += `*How it works:*\n`;
        text += `\u2022 AI analyzes market conditions every 2 minutes\n`;
        text += `\u2022 Executes trades through your agent's vault\n`;
        text += `\u2022 Safety controls: daily caps, stop-loss, cooldowns\n\n`;
        text += `*Choose a strategy to enable:*`;

        return sendSafe(chatId, text, {
          reply_markup: { inline_keyboard: [
            [{ text: '\u{1F6E1} Conservative', callback_data: 'autotrade_enable_conservative' }],
            [{ text: '\u2696 Balanced', callback_data: 'autotrade_enable_balanced' }],
            [{ text: '\u{1F525} Aggressive', callback_data: 'autotrade_enable_aggressive' }],
            [{ text: '\u2753 Help', callback_data: 'action_help' }]
          ]}
        });
      }
    } catch (e) {
      console.error('[Telegram] autopilot status error:', e.message);
      return sendSafe(chatId, '\u274C Failed to check autopilot status. Try again.', {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F504} Retry', callback_data: 'action_status' }]] }
      });
    }
  }

  async function handleTradeHistory(chatId, page = 0) {
    const user = getUser(chatId);
    if (!user.wallet || !user.selectedId) {
      return needAgentMessage(chatId, user, 'Trade History');
    }

    try {
      const portNum = process.env.PORT || 5000;
      const [logsRes, ctxRes, marketRes, positionsRes] = await Promise.all([
        fetch(`http://localhost:${portNum}/api/auto-trade/logs?agentId=${user.selectedId}&limit=200`),
        fetchAgentContext(user.selectedId, user.wallet),
        fetch('https://api.dexscreener.com/latest/dex/pairs/bsc/0x1EED76a091e4E02aaEb6879590eeF53F27E9c520').then(r => r.json()).catch(() => null),
        fetch(`http://localhost:${portNum}/api/auto-trade/positions?agentId=${user.selectedId}`).then(r => r.json()).catch(() => ({ positions: {} }))
      ]);
      const data = await logsRes.json();
      const allLogs = (data.logs || []).reverse();

      const trades = allLogs.filter(l => l.type === 'trade' || l.type === 'failed');
      const skips = allLogs.filter(l => l.type === 'skip');

      const vaultBnb = parseFloat(ctxRes.vaultBnb || 0);
      const vaultJacob = parseFloat(ctxRes.vaultJacob || 0);
      let jacobPrice = 0;
      let bnbPrice = 0;
      if (marketRes && marketRes.pair) {
        jacobPrice = parseFloat(marketRes.pair.priceUsd) || 0;
        bnbPrice = jacobPrice / (parseFloat(marketRes.pair.priceNative) || 1);
      }
      const bnbUsd = vaultBnb * bnbPrice;
      const jacobUsd = vaultJacob * jacobPrice;
      let totalUsd = bnbUsd + jacobUsd;

      let text = `\u{1F4DC} *Trade History — Agent #${user.selectedId}*\n`;
      text += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n`;

      text += `\u{1F4BC} *CURRENT POSITIONS*\n`;
      text += `\u{1F4B0} BNB: \`${vaultBnb.toFixed(4)}\``;
      if (bnbPrice > 0) text += ` (~$${bnbUsd.toFixed(2)})`;
      text += `\n`;

      const tokenPositions = positionsRes.positions || {};
      const posTokens = Object.entries(tokenPositions);
      if (posTokens.length > 0) {
        for (const [sym, pos] of posTokens) {
          const bal = parseFloat(pos.balance || 0);
          if (bal > 0) {
            text += `\u{1FA99} ${sym}: \`${bal < 0.01 ? bal.toFixed(6) : bal.toFixed(4)}\``;
            text += `\n`;
          }
        }
      }
      if (vaultJacob > 0) {
        text += `\u{1FA99} JACOB: \`${vaultJacob.toFixed(2)}\``;
        if (jacobPrice > 0) text += ` (~$${jacobUsd.toFixed(2)})`;
        text += `\n`;
      }
      text += `\u{1F4B5} Total Value: \`$${totalUsd.toFixed(2)}\`\n\n`;

      if (trades.length === 0 && skips.length === 0) {
        text += `_No trading activity yet._\n\nOnce autopilot is active, trades and AI decisions will appear here.`;
        return sendSafe(chatId, text, {
          reply_markup: { inline_keyboard: [
            [{ text: '\u26A1 Autopilot', callback_data: 'action_status' }],
            [{ text: '\u{1F504} Refresh', callback_data: 'action_trades' }]
          ]}
        });
      }

      const PAGE_SIZE = 5;
      const totalPages = Math.max(1, Math.ceil(trades.length / PAGE_SIZE));
      page = Math.max(0, Math.min(page, totalPages - 1));
      const pageTrades = trades.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

      const successCount = trades.filter(t => t.type === 'trade').length;
      const failCount = trades.filter(t => t.type === 'failed').length;
      text += `\u{1F4CA} *TRADE LOG* — ${trades.length} trades (${successCount} \u2705 ${failCount} \u274C) | ${skips.length} skips\n\n`;

      for (const t of pageTrades) {
        const time = new Date(t.timestamp);
        const timeStr = time.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
        const isSuccess = t.type === 'trade';
        const icon = isSuccess ? (t.action === 'buy' ? '\u{1F7E2}' : '\u{1F534}') : '\u274C';
        const actionLabel = (t.action || 'unknown').toUpperCase();

        const tokenLabel = t.token || t.signal?.token || 'unknown';
        text += `${icon} *${actionLabel} ${tokenLabel}* — ${timeStr}\n`;

        if (t.amountBNB) text += `   \u{1F4B0} ${parseFloat(t.amountBNB).toFixed(4)} BNB`;
        if (t.result && t.result.amountTokens) text += ` | ${parseFloat(t.result.amountTokens).toFixed(4)} ${tokenLabel}`;
        text += `\n`;

        if (t.signal && t.signal.reasoning) {
          const reason = t.signal.reasoning.length > 80 ? t.signal.reasoning.substring(0, 77) + '...' : t.signal.reasoning;
          text += `   \u{1F4AD} _${reason}_\n`;
        }

        if (isSuccess && t.result && t.result.txHash) {
          text += `   \u{1F517} [View TX](https://bscscan.com/tx/${t.result.txHash})\n`;
        } else if (!isSuccess && t.result && t.result.error) {
          const err = t.result.error.length > 60 ? t.result.error.substring(0, 57) + '...' : t.result.error;
          text += `   \u26A0 _${err}_\n`;
        }
        text += `\n`;
      }

      if (totalPages > 1) {
        text += `_Page ${page + 1}/${totalPages}_`;
      }

      const buttons = [];
      const navRow = [];
      if (page > 0) navRow.push({ text: '\u25C0 Prev', callback_data: `trades_page_${page - 1}` });
      if (page < totalPages - 1) navRow.push({ text: 'Next \u25B6', callback_data: `trades_page_${page + 1}` });
      if (navRow.length > 0) buttons.push(navRow);
      buttons.push([{ text: '\u{1F504} Refresh', callback_data: 'action_trades' }, { text: '\u26A1 Autopilot', callback_data: 'action_status' }]);
      buttons.push([{ text: '\u{1F4B0} Vault', callback_data: 'action_vault' }]);

      return sendSafe(chatId, text, { reply_markup: { inline_keyboard: buttons }, disable_web_page_preview: true });
    } catch (e) {
      console.error('[Telegram] trade history error:', e.message);
      return sendSafe(chatId, '\u274C Failed to fetch trade history. Try again.', {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F504} Retry', callback_data: 'action_trades' }]] }
      });
    }
  }

  async function handlePortfolio(chatId) {
    const user = getUser(chatId);
    if (!user.wallet) {
      user.onboardingStep = 'waiting_wallet';
      return sendSafe(chatId, '\u{1F4B3} Set up your wallet first.\n\nTap *Generate New Wallet* for instant setup, or link an existing one.', {
        reply_markup: onboardingButtons('wallet')
      });
    }

    sendSafe(chatId, '\u{1F4BC} Building your portfolio snapshot...');

    try {
      const provider = getProvider();
      const isCustodial = walletStore.hasGeneratedWallet(chatId);
      const walletType = isCustodial ? 'Custodial' : 'Linked';
      const shortAddr = `${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}`;

      let walletBnb = 0;
      let walletJacob = 0;
      try {
        const bnbWei = await provider.getBalance(user.wallet);
        walletBnb = parseFloat(ethersLib.formatEther(bnbWei));
        const ERC20_ABI_MIN = ['function balanceOf(address) view returns (uint256)'];
        const jacobContract = new ethersLib.Contract(JACOB_TOKEN, ERC20_ABI_MIN, provider);
        const jacobBal = await jacobContract.balanceOf(user.wallet);
        walletJacob = parseFloat(ethersLib.formatEther(jacobBal));
      } catch (e) {
        console.error('[Telegram] balance fetch error:', e.message);
      }

      let text = `\u{1F4BC} *PORTFOLIO SNAPSHOT*\n`;
      text += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n`;

      text += `\u{1F4CB} *Wallet* (${walletType})\n`;
      text += `\`${shortAddr}\`\n`;
      text += `\u{1F4B0} BNB: \`${walletBnb.toFixed(4)}\`\n`;
      text += `\u{1FA99} JACOB: \`${walletJacob.toFixed(2)}\`\n\n`;

      const agents = await fetchWalletAgents(user.wallet);
      user.agents = agents;

      if (!agents || agents.length === 0) {
        text += `\u{1F916} *Agents:* None\n\n`;
        text += `_Mint your first agent to unlock features!_`;

        const market = await getMarketCached();
        if (market && market.price !== 'Unavailable') {
          const jacobUsd = walletJacob * parseFloat(market.price);
          if (jacobUsd > 0) text += `\n\n\u{1F4B2} JACOB value: ~$${jacobUsd.toFixed(2)}`;
        }

        return sendSafe(chatId, text, {
          reply_markup: { inline_keyboard: [
            [{ text: '\u{1F4B3} Buy JACOB', callback_data: 'action_buy' }],
            [{ text: '\u{1F525} Mint Agent', callback_data: 'action_mint' }],
            [{ text: '\u{1F504} Refresh', callback_data: 'action_portfolio' }]
          ]}
        });
      }

      text += `\u{1F916} *Agents (${agents.length})*\n`;

      let totalVaultBnb = 0;
      let totalVaultJacob = 0;
      let totalPending = 0;

      for (const a of agents.slice(0, 10)) {
        try {
          const ctx = await fetchAgentContext(a.tokenId, user.wallet);
          const vBnb = parseFloat(ctx.vaultBnb || 0);
          const vJacob = parseFloat(ctx.vaultJacob || 0);
          const pending = parseFloat(ctx.pendingRevenue || 0);
          totalVaultBnb += vBnb;
          totalVaultJacob += vJacob;
          totalPending += pending;
          const emoji = TIER_EMOJI[a.tier] || '';
          const agentName = ctx.profileName ? ` "${ctx.profileName}"` : '';
          text += `\n${emoji} *#${a.tokenId} ${a.tierName}*${agentName}\n`;
          text += `   Vault: \`${vBnb.toFixed(4)}\` BNB | \`${vJacob.toFixed(0)}\` JACOB\n`;
          if (pending > 0) text += `   Pending: \`${pending.toFixed(4)}\` BNB\n`;
        } catch (e) {
          text += `\n${TIER_EMOJI[a.tier] || ''} *#${a.tokenId} ${a.tierName}* — _Error fetching_\n`;
        }
      }
      if (agents.length > 10) text += `\n_...and ${agents.length - 10} more agents_`;

      text += `\n\n\u{1F4CA} *Totals*\n`;
      text += `\u{1F4B0} Wallet BNB: \`${walletBnb.toFixed(4)}\`\n`;
      text += `\u{1FA99} Wallet JACOB: \`${walletJacob.toFixed(2)}\`\n`;
      text += `\u{1F3E6} Vault BNB: \`${totalVaultBnb.toFixed(4)}\` (across ${agents.length} agents)\n`;
      text += `\u{1F3E6} Vault JACOB: \`${totalVaultJacob.toFixed(0)}\`\n`;
      if (totalPending > 0) text += `\u23F3 Pending Revenue: \`${totalPending.toFixed(4)}\` BNB\n`;

      const market = await getMarketCached();
      if (market && market.price !== 'Unavailable') {
        const totalJacobAll = walletJacob + totalVaultJacob;
        const jacobUsd = totalJacobAll * parseFloat(market.price);
        if (jacobUsd > 0) text += `\u{1F4B2} Total JACOB value: ~$${jacobUsd.toFixed(2)}`;
      }

      return sendSafe(chatId, text, {
        reply_markup: { inline_keyboard: [
          [{ text: '\u{1F504} Refresh', callback_data: 'action_portfolio' }]
        ]}
      });
    } catch (e) {
      console.error('[Telegram] portfolio error:', e.message);
      return sendSafe(chatId, 'Failed to build portfolio. Try again.');
    }
  }

  async function handleAlphaEdge(chatId, targetAddress) {
    const user = getUser(chatId);
    if (!user.wallet || !user.selectedId) {
      return needAgentMessage(chatId, user, 'Alpha Edge');
    }

    if (!targetAddress) {
      user.awaitingAlphaWallet = true;
      const buttons = {
        inline_keyboard: [
          [{ text: '\u{1F4CB} Scan My Wallet', callback_data: `alpha_scan_${user.wallet}` }],
          [{ text: '\u{1F50D} Enter Another Address', callback_data: 'alpha_enter' }]
        ]
      };
      return sendSafe(chatId, `\u{1F3AF} *Alpha Edge — Wallet Analyzer*\n\nChoose a wallet to analyze:\n\n\u{1F4CA} Trader Grade & Win Rate\n\u{1F4B0} P&L breakdown & insights\n\u{1F3C8} Coach's Game Plan (personalized tips)\n\u{1F9E0} Ask Jacob AI for deep coaching (Silver+)\n\n\u2022 Tap *Scan My Wallet* to analyze your own trades\n\u2022 Tap *Enter Another Address* to scout any BSC wallet\n\u2022 Or paste a wallet address directly`, { reply_markup: buttons });
    }

    const addressToScan = targetAddress;
    if (!/^0x[a-fA-F0-9]{40}$/.test(addressToScan)) {
      return sendSafe(chatId, '\u274C Invalid wallet address. Please send a valid BSC address (0x...).');
    }

    user.awaitingAlphaWallet = false;
    sendSafe(chatId, `\u{1F3AF} *Alpha Edge*\n\n\u{1F50D} Scanning \`${addressToScan.slice(0, 6)}...${addressToScan.slice(-4)}\` on-chain...\n_This may take 15-30 seconds._`);

    try {
      let tierNum = 1;
      try {
        tierNum = await verifyAgentTierOnChain(user.selectedId);
        if (tierNum > 1) {
          const isOwner = await verifyAgentOwnership(user.selectedId, user.wallet);
          if (!isOwner) tierNum = 1;
        }
      } catch (e) { tierNum = user.selectedTier || 1; }

      const data = await fetchWalletTrades(addressToScan);

      if (!data || data.totalTrades === 0) {
        return sendSafe(chatId, '\u{1F3AF} *Your Alpha Edge*\n\n\u{1F4AD} No trading history found for this wallet.\n\nStart trading on BNB Chain to build your track record!');
      }

      const GRADE_EMOJI = { A: '\u{1F31F}', B: '\u{1F7E2}', C: '\u{1F7E1}', D: '\u{1F7E0}', F: '\u{1F534}' };
      const gradeE = GRADE_EMOJI[data.grade] || '\u2B50';
      const pnlSign = data.totalPnlBNB >= 0 ? '+' : '';
      const pnlEmoji = data.totalPnlBNB >= 0 ? '\u{1F4B0}' : '\u{1F4C9}';
      const ins = data.insights || {};

      let msg1 = `\u{1F3AF} *YOUR ALPHA EDGE*\n`;
      msg1 += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n`;
      msg1 += `${gradeE} *Trader Grade: ${data.grade}*\n\n`;

      msg1 += `\u{1F4CA} *Performance Summary*\n`;
      msg1 += `\u2022 Total Trades: ${data.totalTrades}\n`;
      msg1 += `\u2022 Tokens Traded: ${data.totalTokensTraded}\n`;
      msg1 += `\u2022 Completed: ${data.completedRoundTrips} (${data.wins}W / ${data.losses}L)\n`;
      msg1 += `\u2022 Win Rate: ${data.winRate}%\n`;
      msg1 += `${pnlEmoji} Net P&L: ${pnlSign}${data.totalPnlBNB} BNB\n`;
      msg1 += `\u{1F4B8} Total Spent: ${(ins.totalSpent || 0).toFixed(4)} BNB\n`;
      msg1 += `\u{1F4B5} Total Received: ${(ins.totalReceived || 0).toFixed(4)} BNB\n`;
      msg1 += `\u26FD Gas Spent: ${data.totalGasBNB} BNB\n`;
      if (ins.holdingCount > 0) {
        msg1 += `\u{1F4E6} Still Holding: ${ins.holdingCount} tokens (~${(ins.unrealizedBNB || 0).toFixed(4)} BNB at risk)\n`;
      }
      if (data.firstTradeDate && data.lastTradeDate) {
        msg1 += `\u{1F4C5} Period: ${data.firstTradeDate} \u2014 ${data.lastTradeDate}\n`;
      }

      msg1 += `\n\u{1F50E} *Detailed Insights*\n`;
      if (ins.avgWinBNB > 0) msg1 += `\u2022 Avg Win: +${ins.avgWinBNB.toFixed(4)} BNB\n`;
      if (ins.avgLossBNB < 0) msg1 += `\u2022 Avg Loss: ${ins.avgLossBNB.toFixed(4)} BNB\n`;
      if (ins.avgHoldWinHrs > 0) msg1 += `\u2022 Win Hold Time: ${ins.avgHoldWinHrs}h\n`;
      if (ins.avgHoldLossHrs > 0) msg1 += `\u2022 Loss Hold Time: ${ins.avgHoldLossHrs}h\n`;
      if (ins.profitFactor > 0) msg1 += `\u2022 Profit Factor: ${ins.profitFactor}\n`;
      if (ins.avgTradeSize > 0) msg1 += `\u2022 Avg Position Size: ${ins.avgTradeSize.toFixed(4)} BNB\n`;
      if (ins.gasVsPnlRatio > 0) msg1 += `\u2022 Gas/P&L Ratio: ${ins.gasVsPnlRatio.toFixed(1)}%\n`;
      if (ins.winStreak > 0 || ins.lossStreak > 0) msg1 += `\u2022 Best Streak: ${ins.winStreak}W | Worst: ${ins.lossStreak}L\n`;

      if (ins.bestROIToken) {
        const bqc = ins.bestROIToken.quoteCurrency || 'BNB';
        msg1 += `\n\u{1F3C6} *Best Trade:* ${ins.bestROIToken.token}\n`;
        msg1 += `   +${ins.bestROI}% ROI | Spent: ${ins.bestROIToken.spent.toFixed(4)} ${bqc} | Received: ${ins.bestROIToken.received.toFixed(4)} ${bqc} | P&L: +${ins.bestROIToken.pnl.toFixed(4)} ${bqc}\n`;
      }
      if (ins.worstROIToken) {
        const wqc = ins.worstROIToken.quoteCurrency || 'BNB';
        msg1 += `\u{1F4A9} *Worst Trade:* ${ins.worstROIToken.token}\n`;
        msg1 += `   ${ins.worstROI}% ROI | Spent: ${ins.worstROIToken.spent.toFixed(4)} ${wqc} | Received: ${ins.worstROIToken.received.toFixed(4)} ${wqc} | P&L: ${ins.worstROIToken.pnl.toFixed(4)} ${wqc}\n`;
      }

      const tp = data.tradingPatterns || {};
      if (tp.mostActiveHour !== 'N/A' || tp.mostActiveDay !== 'N/A') {
        msg1 += `\n\u{1F552} *Trading Habits*\n`;
        if (tp.mostActiveHour !== 'N/A') msg1 += `\u2022 Peak Hour: ${tp.mostActiveHour}:00 UTC\n`;
        if (tp.mostActiveDay !== 'N/A') msg1 += `\u2022 Most Active Day: ${tp.mostActiveDay}\n`;
      }

      await sendSafe(chatId, msg1);

      const tokenSums = data.tokenSummaries || [];
      if (tokenSums.length > 0) {
        let msg2 = `\u{1F4CB} *Token Breakdown (${tokenSums.length} tokens)*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n`;
        for (const t of tokenSums.slice(0, 15)) {
          const qc = t.quoteCurrency || 'BNB';
          const roi = t.totalSpentBNB > 0 ? ((t.totalReceivedBNB - t.totalSpentBNB) / t.totalSpentBNB * 100) : 0;
          const roiStr = roi >= 0 ? `+${roi.toFixed(1)}%` : `${roi.toFixed(1)}%`;
          const winIcon = t.win ? '\u2705' : (t.sellCount > 0 ? '\u274C' : '\u23F3');
          const holdTag = t.stillHolding ? ' \u{1F4E6}' : '';
          msg2 += `${winIcon} *${t.token}*${holdTag}\n`;
          msg2 += `   ${t.buyCount}B/${t.sellCount}S | Spent: ${t.totalSpentBNB.toFixed(4)} ${qc} | Recv: ${t.totalReceivedBNB.toFixed(4)} ${qc}\n`;
          msg2 += `   P&L: ${t.pnlAfterGas >= 0 ? '+' : ''}${t.pnlAfterGas.toFixed(4)} ${qc} | ROI: ${roiStr} | Gas: ${t.gasBNB.toFixed(4)}\n\n`;
        }
        if (tokenSums.length > 15) {
          msg2 += `_...and ${tokenSums.length - 15} more tokens_\n`;
        }
        const tokenChunks = splitMessage(msg2);
        for (const chunk of tokenChunks) {
          await sendSafe(chatId, chunk);
        }
      }

      const recent = data.recentTrades || [];
      if (recent.length > 0) {
        let msg3 = `\u{1F4DC} *Recent Trades (last ${recent.length})*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n`;
        for (const t of recent.slice(0, 10)) {
          const typeIcon = t.type === 'buy' ? '\u{1F7E2}' : (t.type === 'sell' ? '\u{1F534}' : '\u{1F504}');
          const d = t.date ? t.date.split('T')[0] : '?';
          msg3 += `${typeIcon} *${t.type.toUpperCase()}* ${t.baseToken} — ${t.quoteAmount.toFixed(4)} ${t.quoteToken}\n`;
          msg3 += `   ${t.baseAmount.toFixed(4)} ${t.baseToken} @ ${t.pricePerToken.toFixed(8)} | ${d}\n`;
        }
        if (recent.length > 10) {
          msg3 += `\n_...${recent.length - 10} more trades_\n`;
        }
        await sendSafe(chatId, msg3);
      }

      let msg4 = '';
      if (data.adviceSummary && data.adviceSummary.length > 0) {
        const ADVICE_EMOJI = { warn: '\u26A0\uFE0F', tip: '\u{1F4A1}', good: '\u2705', info: '\u{1F4AC}' };
        msg4 += `\u{1F3C8} *Coach's Game Plan*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n`;
        for (const advice of data.adviceSummary) {
          const icon = ADVICE_EMOJI[advice.icon] || '\u{1F4AC}';
          msg4 += `${icon} *${advice.title}*\n${advice.text}\n\n`;
        }
      }

      if (data.dataWarning) {
        msg4 += `\u26A0\uFE0F _${data.dataWarning}_\n`;
      }

      const buttons = [];
      if (tierNum >= 2) {
        buttons.push([{ text: '\u{1F9E0} Ask Jacob to Coach You', callback_data: `alpha_ai_${addressToScan}` }]);
      } else {
        buttons.push([{ text: '\u{1F512} AI Coaching (Silver+)', callback_data: 'alpha_upgrade' }]);
      }
      buttons.push([{ text: '\u{1F504} Rescan', callback_data: `alpha_scan_${addressToScan}` }, { text: '\u{1F50E} Scan Another', callback_data: 'action_alpha' }]);

      if (msg4) {
        const coachChunks = splitMessage(msg4);
        for (let i = 0; i < coachChunks.length; i++) {
          if (i === coachChunks.length - 1) {
            await sendSafe(chatId, coachChunks[i], { reply_markup: { inline_keyboard: buttons } });
          } else {
            await sendSafe(chatId, coachChunks[i]);
          }
        }
      } else {
        await sendSafe(chatId, '\u{1F3AF} Analysis complete!', { reply_markup: { inline_keyboard: buttons } });
      }
    } catch (e) {
      console.error('[Telegram] Alpha Edge error:', e.message);
      return sendSafe(chatId, '\u274C Failed to analyze wallet. Please try again later.');
    }
  }

  async function handleAlphaAI(chatId, addressToScan) {
    const user = getUser(chatId);
    if (!user.wallet || !user.selectedId) {
      return needAgentMessage(chatId, user, 'AI Deep Analysis');
    }

    let tierNum = 1;
    try {
      tierNum = await verifyAgentTierOnChain(user.selectedId);
      if (tierNum > 1) {
        const isOwner = await verifyAgentOwnership(user.selectedId, user.wallet);
        if (!isOwner) tierNum = 1;
      }
    } catch (e) { tierNum = user.selectedTier || 1; }

    if (tierNum < 2) {
      return sendSafe(chatId, '\u{1F512} *AI Deep Analysis requires Silver tier or above.*\n\nUpgrade your agent to unlock personalized AI coaching.', {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F525} Upgrade Agent', callback_data: 'action_mint' }]] }
      });
    }

    sendSafe(chatId, '\u{1F9E0} *AI Coach is analyzing your trades...*\n_Generating personalized report (30-60 seconds)..._');

    try {
      const data = await fetchWalletTrades(addressToScan);
      if (!data || data.totalTrades === 0) {
        return sendSafe(chatId, '\u274C No trading data found for AI analysis.');
      }

      const tierName = TIER_CAPABILITIES[tierNum]?.name || 'Unknown';
      const top5 = (data.tokenSummaries || []).slice(0, 5);
      const bottom5 = (data.tokenSummaries || []).slice(-5).reverse();

      let dataPrompt = `WALLET PERFORMANCE DATA:\n`;
      dataPrompt += `Address: ${addressToScan}\n`;
      dataPrompt += `Grade: ${data.grade} | Win Rate: ${data.winRate}% | P&L: ${data.totalPnlBNB} BNB\n`;
      dataPrompt += `Total Trades: ${data.totalTrades} | Completed: ${data.completedRoundTrips} (${data.wins}W/${data.losses}L)\n`;
      dataPrompt += `Gas: ${data.totalGasBNB} BNB | Tokens Traded: ${data.totalTokensTraded}\n`;
      if (data.insights) {
        const ins = data.insights;
        dataPrompt += `Avg Win: ${ins.avgWinBNB} BNB | Avg Loss: ${ins.avgLossBNB} BNB\n`;
        dataPrompt += `Win Hold: ${ins.avgHoldWinHrs}h | Loss Hold: ${ins.avgHoldLossHrs}h\n`;
        dataPrompt += `Best ROI: ${ins.bestROI}% (${ins.bestROIToken?.token || 'N/A'}) | Worst: ${ins.worstROI}% (${ins.worstROIToken?.token || 'N/A'})\n`;
        dataPrompt += `Win Streak: ${ins.winStreak} | Loss Streak: ${ins.lossStreak}\n`;
        dataPrompt += `Profit Factor: ${ins.profitFactor} | Avg Trade Size: ${ins.avgTradeSize} BNB\n`;
        dataPrompt += `Unrealized: ${ins.unrealizedBNB} BNB in ${ins.holdingCount} tokens\n`;
      }
      if (top5.length > 0) {
        dataPrompt += `\nTOP PERFORMERS:\n`;
        top5.forEach(t => { dataPrompt += `${t.token}: P&L ${t.realizedPnlBNB.toFixed(4)} BNB, ${t.buyCount}B/${t.sellCount}S, Hold ${t.holdTimeHrs}h\n`; });
      }
      if (bottom5.length > 0) {
        dataPrompt += `\nWORST PERFORMERS:\n`;
        bottom5.forEach(t => { dataPrompt += `${t.token}: P&L ${t.realizedPnlBNB.toFixed(4)} BNB, ${t.buyCount}B/${t.sellCount}S, Hold ${t.holdTimeHrs}h\n`; });
      }

      const systemPrompt = `You are an elite crypto trading coach analyzing a trader's on-chain performance on BNB Smart Chain. The user has a ${tierName}-tier Jacob AI agent. Be direct, data-driven, and actionable. Use the actual token names, numbers, and percentages from their data. Format for Telegram (use *bold* for emphasis). Keep it concise but impactful — this is a Telegram message, not an essay.

Write a coaching report with these sections:
1. *Overall Assessment* — One-sentence verdict with grade justification
2. *Your Best Moves* — What they did RIGHT with specific examples
3. *Your Worst Moves* — What went WRONG, specific losing trades
4. *Hold Time Analysis* — Are they selling too early/late?
5. *Top 3 Things to Do Next* — Specific, actionable improvements
6. *Top 3 Things to STOP Doing* — Bad habits to break

Be specific. Reference actual token names, amounts, and percentages. No generic advice.`;

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: dataPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });

      const analysis = aiResponse.choices[0]?.message?.content;
      if (!analysis) {
        return sendSafe(chatId, '\u274C AI analysis returned empty. Try again.');
      }

      const fullMsg = `\u{1F9E0} *AI DEEP ANALYSIS*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n${analysis}`;

      const chunks = splitMessage(fullMsg);
      for (let i = 0; i < chunks.length; i++) {
        if (i === chunks.length - 1) {
          await sendSafe(chatId, chunks[i], {
            reply_markup: { inline_keyboard: [
              [{ text: '\u{1F504} Rescan Stats', callback_data: 'action_alpha' }],
              [{ text: '\u{1F504} Rescan', callback_data: `alpha_ai_${addressToScan}` }]
            ]}
          });
        } else {
          await sendSafe(chatId, chunks[i]);
        }
      }
    } catch (e) {
      console.error('[Telegram] Alpha AI error:', e.message);
      return sendSafe(chatId, '\u274C AI analysis failed. Please try again later.');
    }
  }

  function handleInvite(chatId) {
    const user = getUser(chatId);
    if (!user.referralCode) {
      user.referralCode = genReferralCode(chatId);
    }
    const link = `https://t.me/AgentJacobot?start=ref_${user.referralCode}`;
    let text = `*\u{1F517} Invite Friends to Jacob*\n\n`;
    text += `Share your personal invite link:\n\`${link}\`\n\n`;
    text += `\u{1F465} Your referrals: *${user.referralCount}*\n\n`;
    text += `_When friends join through your link, you both benefit from the Jacob referral system on-chain._`;

    return sendSafe(chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '\u{1F4E4} Share Link', switch_inline_query: `Join me on Jacob AI! Your Non-Fungible Agent awaits \u{1F916}\n${link}` }]
        ]
      }
    });
  }

  function handleAlerts(chatId) {
    const userAlerts = priceAlerts[chatId] || [];
    let text = `*\u{1F514} Price Alerts*\n\n`;

    if (userAlerts.length === 0) {
      text += `No active alerts.\n\n`;
      text += `Set alerts to get notified when JACOB hits your target price.`;
    } else {
      userAlerts.forEach((a, i) => {
        const dir = a.direction === 'above' ? '\u2B06' : '\u2B07';
        text += `${dir} Alert #${i + 1}: $${a.price.toFixed(6)} (${a.direction})\n`;
      });
      text += `\n_You'll be notified when price crosses your target._`;
    }

    return sendSafe(chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '\u2B06 Alert: Price Goes Above', callback_data: 'alert_above' }, { text: '\u2B07 Alert: Price Goes Below', callback_data: 'alert_below' }],
          userAlerts.length > 0 ? [{ text: '\u{1F5D1} Clear All Alerts', callback_data: 'alert_clear' }] : []
        ].filter(r => r.length > 0)
      }
    });
  }

  function handleHelp(chatId) {
    let text = `*Jacob AI Bot — Help*\n\n`;
    text += `*Quick Actions (tap below):*\n`;
    text += `\u{1F4B3} Buy JACOB — Instant token purchase\n`;
    text += `\u{1F916} Agents — Scan & select your agents\n`;
    text += `\u{1F4B0} Vault — Agent vault balance\n`;
    text += `\u{1F3AF} Alpha Edge — Wallet performance analyzer\n`;
    text += `\u{1F4BC} Portfolio — Full portfolio view\n`;
    text += `\u{1F3C6} Tier — Your AI capabilities\n`;
    text += `\u26A1 Autopilot — Trading bot status\n`;
    text += `\u{1F4DC} Trade History — Live trading log\n`;
    text += `\u{1F517} Invite — Share & earn referrals\n\n`;
    text += `*Commands:*\n`;
    text += `/buy — Buy JACOB tokens\n`;
    text += `/mint — Mint a new agent\n`;
    text += `/wallet — Manage your wallet\n`;
    text += `/alpha — Analyze your trading performance\n`;
    text += `/trades — View autopilot trade history\n`;
    text += `/privatekey — Export your private key\n`;
    text += `/menu — Show action buttons\n\n`;
    text += `*AI Chat:*\n`;
    text += `Just type any message! Your AI capabilities depend on your agent's tier.\n\n`;
    text += `\u{1F7EB} Bronze → Market chat\n`;
    text += `\u{1FA99} Silver → Technical analysis\n`;
    text += `\u{1F31F} Gold → Portfolio strategy\n`;
    text += `\u{1F48E} Diamond → Autonomous signals\n`;
    text += `\u{1F3B4} Black → Unlimited AI access`;

    return sendSafe(chatId, text);
  }

  // ══════════════════════════════════════════════════════════
  //  /start — Interactive Onboarding Wizard
  // ══════════════════════════════════════════════════════════

  bot.onText(/\/start(?:\s(.*))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param = (match[1] || '').trim();
    const user = getUser(chatId);
    const name = msg.from.first_name || 'Agent';

    if (param.startsWith('ref_') && !user.referredBy) {
      const refCode = param.substring(4);
      const referrerId = resolveReferrer(refCode);
      if (referrerId && String(referrerId) !== String(chatId)) {
        user.referredBy = refCode;
        const referrer = getUser(referrerId);
        referrer.referralCount = (referrer.referralCount || 0) + 1;
        sendSafe(referrerId, `\u{1F389} *New Referral!*\n\n${name} joined Jacob through your invite link!\nTotal referrals: *${referrer.referralCount}*`);
      }
    }

    if (!user.referralCode) user.referralCode = genReferralCode(chatId);

    const hasWallet = !!user.wallet;
    const hasCustodial = walletStore.hasGeneratedWallet(chatId);

    if (hasWallet && !param.startsWith('ref_')) {
      const shortAddr = `${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}`;
      const walletType = hasCustodial ? 'Custodial' : 'Linked';

      let wb = `\u{1F44B} *Welcome back, ${name}!*\n\n`;
      wb += `\u{1F4B3} Wallet (${walletType}): \`${shortAddr}\`\n`;

      if (user.selectedId) {
        const selTier = user.selectedTier || 1;
        const selEmoji = TIER_EMOJI[selTier] || '';
        const selName = user.selectedName ? ` "${user.selectedName}"` : '';
        wb += `\u{1F916} Active Agent: ${selEmoji} #${user.selectedId}${selName}\n`;
      }

      wb += `\n\u{1F3AE} *Quick Actions:*`;

      const returnButtons = {
        inline_keyboard: [
          [{ text: '\u{1F4BC} Portfolio', callback_data: 'action_portfolio' }, { text: '\u{1F3AF} Alpha Edge', callback_data: 'action_alpha' }],
          [{ text: '\u{1F4B3} Buy JACOB', callback_data: 'action_buy' }, { text: '\u{1F525} Mint Agent', callback_data: 'action_mint' }],
          [{ text: '\u{1F916} My Agents', callback_data: 'action_agents' }, { text: '\u{1F4B0} Vault', callback_data: 'action_vault' }],
          [{ text: '\u26A1 Autopilot', callback_data: 'action_status' }, { text: '\u{1F517} Invite', callback_data: 'action_invite' }],
          [{ text: '\u{1F4CA} Price', callback_data: 'action_price' }, { text: '\u2753 Help', callback_data: 'action_help' }]
        ]
      };

      sendSafe(chatId, wb, { reply_markup: returnButtons });
      bot.sendMessage(chatId, '\u2328\uFE0F Your quick-action menu is ready below \u2B07', {
        reply_markup: mainMenuKeyboard()
      }).catch(() => {});
      return;
    }

    const caption =
      `*Welcome to Jacob, ${name}!* \u{1F916}\n\n` +
      `The most powerful AI agent platform on BNB Smart Chain.\n\n` +
      `\u{1F525} *What Jacob Does:*\n` +
      `• AI-powered trading intelligence\n` +
      `• Non-Fungible Agents (NFAs) with unique tiers\n` +
      `• Autonomous trading for Diamond+ agents\n` +
      `• Passive BNB revenue sharing\n` +
      `• On-chain portfolios & vaults\n\n` +
      `\u{1F3AF} *YOUR ALPHA EDGE*\n` +
      `_Full on-chain wallet analysis, trader grades, win rates, P&L tracking, and personalized AI coaching — all inside Telegram. Tap_ \u{1F3AF} Alpha Edge _to see your stats!_\n\n` +
      `_Tap a button below to get started!_`;

    try {
      await bot.sendPhoto(chatId, LOGO_PATH, {
        caption,
        parse_mode: 'Markdown',
        reply_markup: onboardingButtons('welcome')
      });
    } catch (e) {
      sendSafe(chatId, caption, { reply_markup: onboardingButtons('welcome') });
    }

    bot.sendMessage(chatId, '\u2328\uFE0F Your quick-action menu is ready below \u2B07', {
      reply_markup: mainMenuKeyboard()
    }).catch(() => {});
  });

  // ══════════════════════════════════════════════════════════
  //  /menu — Show persistent keyboard
  // ══════════════════════════════════════════════════════════

  bot.onText(/\/menu$/, (msg) => {
    sendSafe(msg.chat.id, '\u{1F3AE} *Jacob Menu*\n\nTap any button below for quick actions:');
  });

  bot.onText(/\/help$/, (msg) => handleHelp(msg.chat.id));

  bot.onText(/\/alpha(?:\s(.*))?$/, async (msg, match) => {
    if (isGroupChat(msg)) return redirectToDM(msg.chat.id, 'Alpha Edge');
    const target = (match[1] || '').trim();
    handleAlphaEdge(msg.chat.id, target || null);
  });

  bot.onText(/\/privatekey$/, async (msg) => {
    if (isGroupChat(msg)) return redirectToDM(msg.chat.id, 'private key export');
    const chatId = msg.chat.id;
    const result = walletStore.exportPrivateKey(chatId);
    if (!result) {
      return sendSafe(chatId, '\u274C No generated wallet found. Use /wallet to set one up.', {
        reply_markup: onboardingButtons('wallet')
      });
    }
    return sendSafe(chatId,
      `\u26A0 *Are you sure?*\n\nYour private key will be shown in this chat. Make sure no one is looking at your screen.`,
      { reply_markup: { inline_keyboard: [
        [{ text: '\u{1F510} Yes, Show My Key', callback_data: 'export_key' }],
        [{ text: '\u274C Cancel', callback_data: 'action_help' }]
      ]}}
    );
  });

  function isGroupChat(msg) {
    return msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  }

  function redirectToDM(chatId, action) {
    return sendSafe(chatId, `\u{1F512} For security, *${action}* only works in a direct message.\n\nTap below to open a private chat:`, {
      reply_markup: { inline_keyboard: [[{ text: '\u{1F4AC} Open DM', url: 'https://t.me/AgentJacobot' }]] }
    });
  }

  async function linkWallet(chatId, address) {
    const user = getUser(chatId);
    user.wallet = address.toLowerCase();
    user.agents = null;
    user.selectedId = null;
    user.selectedTier = null;
    user.onboardingStep = null;

    sendSafe(chatId, `\u2705 *Wallet linked!*\n\n\`${address}\`\n\nScanning blockchain for your agents...`);

    try {
      const agents = await fetchWalletAgents(user.wallet);
      if (agents && agents.length > 0) {
        agents.sort((a, b) => b.tier - a.tier);
        user.agents = agents;

        let text = `\u{1F389} Found *${agents.length} agent(s)!*\n\n`;
        agents.forEach(a => {
          text += `${TIER_EMOJI[a.tier] || ''} #${a.tokenId} — ${a.tierName}\n`;
        });

        const best = agents[0];
        text += `\n\u{1F31F} Recommended: Agent #${best.tokenId} (${best.tierName}) — highest tier`;

        return sendSafe(chatId, text, { reply_markup: onboardingButtons('agents_found') });
      } else {
        return sendSafe(chatId, '\u{1F50D} No agents found for this wallet yet.', { reply_markup: onboardingButtons('no_agents') });
      }
    } catch (e) {
      return sendSafe(chatId, '\u2705 Wallet linked! Tap below to scan for your agents.', {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F916} Scan Agents', callback_data: 'action_agents' }]] }
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  //  /wallet — Link BSC Wallet
  // ══════════════════════════════════════════════════════════

  bot.onText(/\/wallet(?:\s(.*))?$/, async (msg, match) => {
    if (isGroupChat(msg)) return redirectToDM(msg.chat.id, 'wallet management');
    const chatId = msg.chat.id;
    const address = (match[1] || '').trim();
    const user = getUser(chatId);

    if (!address) {
      const hasGenerated = walletStore.hasGeneratedWallet(chatId);
      if (user.wallet) {
        const buttons = [[{ text: '\u{1F916} Scan Agents', callback_data: 'action_agents' }]];
        if (hasGenerated) {
          buttons.unshift([{ text: '\u{1F510} Export Private Key', callback_data: 'export_key_confirm' }]);
        }
        const walletType = hasGenerated ? 'Generated' : 'Linked';
        return sendSafe(chatId, `\u{1F4B3} *Your Wallet (${walletType})*\n\n\`${user.wallet}\``, {
          reply_markup: { inline_keyboard: buttons }
        });
      }
      user.onboardingStep = 'waiting_wallet';
      return sendSafe(chatId,
        `\u{1F4B3} *Set Up Your Wallet*\n\n` +
        `\u{1F4B3} *Generate New Wallet* — Instant setup, export key anytime\n` +
        `\u{1F517} *Link Existing Wallet* — Verify ownership by signing`,
        { reply_markup: onboardingButtons('wallet') }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return sendSafe(chatId, '\u274C That doesn\'t look right. A BSC address starts with `0x` followed by 40 characters.\n\nJust paste the full address from your wallet app.');
    }

    return sendSafe(chatId,
      `\u{1F512} *Wallet Verification Required*\n\n` +
      `Address: \`${address}\`\n\n` +
      `To prove you own this wallet, tap *Link Existing Wallet* below to sign a message.`,
      { reply_markup: onboardingButtons('wallet') }
    );
  });

  // ══════════════════════════════════════════════════════════
  //  Text command aliases (legacy + keyboard buttons)
  // ══════════════════════════════════════════════════════════

  bot.onText(/\/agents$/, (msg) => {
    if (isGroupChat(msg)) return redirectToDM(msg.chat.id, 'viewing agents');
    handleAgents(msg.chat.id);
  });
  bot.onText(/\/price$/, (msg) => handlePrice(msg.chat.id));
  bot.onText(/\/buy$/, (msg) => {
    if (isGroupChat(msg)) return redirectToDM(msg.chat.id, 'buying JACOB');
    handleBuy(msg.chat.id);
  });
  bot.onText(/\/mint$/, (msg) => {
    if (isGroupChat(msg)) return redirectToDM(msg.chat.id, 'minting agents');
    handleMint(msg.chat.id);
  });
  bot.onText(/\/vault$/, (msg) => {
    if (isGroupChat(msg)) return redirectToDM(msg.chat.id, 'vault info');
    handleVault(msg.chat.id);
  });
  bot.onText(/\/tier$/, (msg) => handleTier(msg.chat.id));
  bot.onText(/\/status$/, (msg) => {
    if (isGroupChat(msg)) return redirectToDM(msg.chat.id, 'autopilot status');
    handleStatus(msg.chat.id);
  });
  bot.onText(/\/trades$/, (msg) => {
    if (isGroupChat(msg)) return redirectToDM(msg.chat.id, 'trade history');
    handleTradeHistory(msg.chat.id);
  });
  bot.onText(/\/portfolio$/, (msg) => {
    if (isGroupChat(msg)) return redirectToDM(msg.chat.id, 'portfolio');
    handlePortfolio(msg.chat.id);
  });
  bot.onText(/\/ask(?:\s(.+))?$/s, async (msg, match) => {
    const chatId = msg.chat.id;
    const question = (match[1] || '').trim();
    if (!question) {
      return sendSafe(chatId, '\u2753 *Ask Jacob anything!*\n\nUsage: `/ask what is the current JACOB price?`\n\nI can discuss crypto, trading strategies, market analysis, and the Jacob platform.', { reply_to_message_id: msg.message_id });
    }
    const user = getUser(chatId);
    await handleGroupAIChat(chatId, question, user, msg.message_id);
  });

  bot.onText(/\/invite$/, (msg) => handleInvite(msg.chat.id));
  bot.onText(/\/alerts$/, (msg) => {
    if (isGroupChat(msg)) return redirectToDM(msg.chat.id, 'price alerts');
    handleAlerts(msg.chat.id);
  });

  bot.onText(/\/agent\s+(\d+)$/, async (msg, match) => {
    if (isGroupChat(msg)) return redirectToDM(msg.chat.id, 'agent selection');
    const chatId = msg.chat.id;
    const user = getUser(chatId);
    const requestedId = parseInt(match[1]);

    if (!user.agents) {
      return sendSafe(chatId, 'Scan your agents first.', {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F916} Scan Agents', callback_data: 'action_agents' }]] }
      });
    }

    const agent = user.agents.find(a => a.tokenId === requestedId);
    if (!agent) return sendSafe(chatId, `Agent #${requestedId} not found. Run /agents to refresh.`);

    user.selectedId = agent.tokenId;
    user.selectedTier = agent.tier;
    try { const ctx = await fetchAgentContext(agent.tokenId, user.wallet); user.selectedName = ctx.profileName || null; } catch(e) { user.selectedName = null; }

    const emoji = TIER_EMOJI[agent.tier] || '';
    const nameTag = user.selectedName ? ` "${user.selectedName}"` : '';
    sendSafe(chatId, `${emoji} Agent *#${agent.tokenId}${nameTag}* (${agent.tierName}) selected!\n\nYou now have ${agent.tierName}-tier AI. Just type any message to chat!`, {
      reply_markup: onboardingButtons('done')
    });
  });

  // ══════════════════════════════════════════════════════════
  //  Callback Query Router (Inline Buttons)
  // ══════════════════════════════════════════════════════════

  const recentCallbacks = new Map();
  const CALLBACK_DEDUP_MS = 1500;

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const user = getUser(chatId);

    bot.answerCallbackQuery(query.id).catch(() => {});

    const dedupKey = `${chatId}_${data}`;
    const now = Date.now();
    const lastTime = recentCallbacks.get(dedupKey);
    if (lastTime && now - lastTime < CALLBACK_DEDUP_MS) return;
    recentCallbacks.set(dedupKey, now);
    if (recentCallbacks.size > 500) {
      const cutoff = now - 10000;
      for (const [k, v] of recentCallbacks) { if (v < cutoff) recentCallbacks.delete(k); }
    }

    if (data === 'onboard_start') {
      user.onboardingStep = 'waiting_wallet';
      return sendSafe(chatId,
        `\u{1F4B3} *Step 1: Set Up Your Wallet*\n\n` +
        `\u{1F4B3} *Generate New Wallet* — We'll create a BSC wallet for you instantly. You can export your private key anytime.\n\n` +
        `\u{1F517} *Link Existing Wallet* — Already have a wallet? Verify ownership by signing a message.\n\n` +
        `_Choose an option below:_`,
        { reply_markup: onboardingButtons('wallet') }
      );
    }

    if (data === 'onboard_about') {
      return sendSafe(chatId,
        `*What is Jacob?* \u{1F916}\n\n` +
        `Jacob is a *Non-Fungible Agent (NFA)* platform on BNB Smart Chain.\n\n` +
        `*How it works:*\n` +
        `1\u20E3 Burn JACOB tokens to mint AI agent NFTs\n` +
        `2\u20E3 Each agent has a tier: Bronze \u2192 Silver \u2192 Gold \u2192 Diamond \u2192 Black\n` +
        `3\u20E3 Higher tiers unlock more powerful AI capabilities\n` +
        `4\u20E3 Agents have their own vaults for trading\n` +
        `5\u20E3 Diamond+ agents can trade autonomously\n` +
        `6\u20E3 All agent holders earn passive BNB revenue\n\n` +
        `_Ready to begin?_`,
        { reply_markup: { inline_keyboard: [[{ text: '\u{1F680} Get Started', callback_data: 'onboard_start' }]] } }
      );
    }

    if (data === 'link_wallet_start') {
      if (isGroupChat(query.message)) return redirectToDM(chatId, 'wallet linking');
      user.onboardingStep = 'waiting_wallet_address';
      return sendSafe(chatId, '\u{1F517} *Link Your Wallet*\n\nPaste your BSC wallet address below:\n\n_Example: 0x1234...abcd_');
    }

    if (data === 'generate_wallet') {
      if (isGroupChat(query.message)) return redirectToDM(chatId, 'wallet generation');
      if (walletStore.hasGeneratedWallet(chatId)) {
        const existing = walletStore.getStoredWallet(chatId);
        user.wallet = existing.address;
        return sendSafe(chatId,
          `\u{1F4B3} *You already have a wallet!*\n\n` +
          `Address: \`${existing.address}\`\n\n` +
          `Use the buttons below to manage it.`,
          { reply_markup: { inline_keyboard: [
            [{ text: '\u{1F510} Export Private Key', callback_data: 'export_key' }],
            [{ text: '\u{1F916} Scan for Agents', callback_data: 'action_agents' }]
          ]}}
        );
      }
      try {
        const { address, privateKey } = walletStore.generateWallet(chatId);
        user.wallet = address.toLowerCase();
        user.onboardingStep = null;

        await sendSafe(chatId,
          `\u2705 *Wallet Generated!*\n\n` +
          `\u{1F4B3} Address:\n\`${address}\`\n\n` +
          `\u{1F512} Your private key is encrypted and stored securely. You can export it anytime with the button below.\n\n` +
          `\u26A0 *Important:* Export and back up your private key! If you lose access to this bot, you'll need it to recover your wallet.`,
          { reply_markup: { inline_keyboard: [
            [{ text: '\u{1F510} Export Private Key Now', callback_data: 'export_key' }],
            [{ text: '\u27A1 Continue Setup', callback_data: 'post_wallet_setup' }]
          ]}}
        );
      } catch (e) {
        console.error('[Telegram] Wallet generation error:', e.message);
        return sendSafe(chatId, '\u274C Failed to generate wallet. Please try again.', {
          reply_markup: onboardingButtons('wallet')
        });
      }
      return;
    }

    if (data === 'export_key') {
      if (isGroupChat(query.message)) return redirectToDM(chatId, 'private key export');
      const result = walletStore.exportPrivateKey(chatId);
      if (!result) {
        return sendSafe(chatId, '\u274C No generated wallet found. Use /wallet to set one up.', {
          reply_markup: onboardingButtons('wallet')
        });
      }
      await sendSafe(chatId,
        `\u{1F510} *Your Private Key*\n\n` +
        `Address: \`${result.address}\`\n\n` +
        `Private Key:\n\`${result.privateKey}\`\n\n` +
        `\u26A0 *SAVE THIS SECURELY!*\n` +
        `• Never share it with anyone\n` +
        `• Store it in a password manager\n` +
        `• You can import it into MetaMask or Trust Wallet\n\n` +
        `_This message will remain in your chat history. Delete it after saving your key._`,
        { reply_markup: { inline_keyboard: [
          [{ text: '\u2705 I\'ve Saved It', callback_data: 'post_wallet_setup' }]
        ]}}
      );
      return;
    }

    if (data === 'export_key_confirm') {
      return sendSafe(chatId,
        `\u26A0 *Are you sure?*\n\nYour private key will be shown in this chat. Make sure no one is looking at your screen.`,
        { reply_markup: { inline_keyboard: [
          [{ text: '\u{1F510} Yes, Show My Key', callback_data: 'export_key' }],
          [{ text: '\u274C Cancel', callback_data: 'action_help' }]
        ]}}
      );
    }

    if (data === 'post_wallet_setup') {
      user.onboardingStep = null;
      try {
        const agents = await fetchWalletAgents(user.wallet);
        if (agents && agents.length > 0) {
          agents.sort((a, b) => b.tier - a.tier);
          user.agents = agents;
          let text = `\u{1F389} Found *${agents.length} agent(s)!*\n\n`;
          agents.forEach(a => { text += `${TIER_EMOJI[a.tier] || ''} #${a.tokenId} — ${a.tierName}\n`; });
          const best = agents[0];
          text += `\n\u{1F31F} Recommended: Agent #${best.tokenId} (${best.tierName}) — highest tier`;
          return sendSafe(chatId, text, { reply_markup: onboardingButtons('agents_found') });
        }
      } catch (e) {}
      return sendSafe(chatId,
        `\u{1F680} *You're all set!*\n\n` +
        `Your wallet is ready. Here's what you can do:\n\n` +
        `\u{1F3AF} *Alpha Edge* — Analyze your trading performance\n` +
        `\u{1F4AC} *Chat* — Talk to Jacob AI\n` +
        `\u{1F525} *Mint* — Create your first agent\n` +
        `\u{1F517} *Invite* — Bring friends & earn rewards`,
        { reply_markup: onboardingButtons('done') }
      );
    }

    if (data === 'onboard_skip_wallet') {
      user.onboardingStep = 'done';
      return sendSafe(chatId,
        `\u2705 No problem! You can set up a wallet anytime with /wallet\n\n` +
        `In the meantime, you can:\n` +
        `\u{1F3AF} Check your Alpha Edge stats\n` +
        `\u{1F4AC} Chat with Jacob AI (Bronze tier)\n` +
        `\u{1F517} Invite friends`,
        { reply_markup: onboardingButtons('done') }
      );
    }

    if (data === 'onboard_select_best') {
      if (user.agents && user.agents.length > 0) {
        const best = user.agents.sort((a, b) => b.tier - a.tier)[0];
        user.selectedId = best.tokenId;
        user.selectedTier = best.tier;
        try { const ctx = await fetchAgentContext(best.tokenId, user.wallet); user.selectedName = ctx.profileName || null; } catch(e) { user.selectedName = null; }
        user.onboardingStep = 'done';

        const emoji = TIER_EMOJI[best.tier] || '';
        return sendSafe(chatId,
          `${emoji} *Agent #${best.tokenId} (${best.tierName}) activated!*\n\n` +
          `You're all set! Here's what you can do:\n\n` +
          `\u{1F4AC} *Chat* — Just type any message for AI analysis\n` +
          `\u{1F3AF} *Alpha Edge* — Your trading performance\n` +
          `\u{1F4B0} *Vault* — Your agent's treasury\n` +
          `\u{1F4BC} *Portfolio* — Full holdings overview\n` +
          `\u{1F517} *Invite* — Grow the community\n\n` +
          `_Your ${best.tierName}-tier AI is ready. Start chatting!_`,
          { reply_markup: onboardingButtons('done') }
        );
      }
      return handleAgents(chatId);
    }

    if (data === 'onboard_done' || data === 'onboard_chat') {
      user.onboardingStep = null;
      return sendSafe(chatId, '\u{1F4AC} You\'re ready! Just type any message and Jacob AI will respond.\n\nUse the buttons below for quick actions.');
    }

    if (data === 'action_buy') return handleBuy(chatId);
    if (data === 'action_mint') return handleMint(chatId);
    if (data === 'action_price') return handlePrice(chatId);
    if (data === 'action_agents') return handleAgents(chatId);
    if (data === 'action_vault') return handleVault(chatId);
    if (data === 'vault_deposit') return handleVaultDeposit(chatId);
    if (data === 'vault_withdraw') return handleVaultWithdraw(chatId);

    if (data === 'vault_revshare') return handleRevShareRegister(chatId);

    if (data === 'vault_dep_custom') {
      const user = getUser(chatId);
      user.pendingAction = 'vault_deposit_custom';
      return sendSafe(chatId, '\u{1F4DD} *Enter BNB amount to deposit:*\n\nType a number (e.g. `0.05` or `0.2`):');
    }
    if (data === 'vault_dep_all') return executeVaultDeposit(chatId, 'all');

    if (data.startsWith('vault_dep_')) {
      const amt = data.replace('vault_dep_', '');
      return executeVaultDeposit(chatId, amt);
    }

    if (data === 'action_tier') return handleTier(chatId);
    if (data === 'action_trades') return handleTradeHistory(chatId);
    if (data.startsWith('trades_page_')) return handleTradeHistory(chatId, parseInt(data.replace('trades_page_', '')));
    if (data === 'action_status') return handleStatus(chatId);
    if (data === 'action_portfolio') return handlePortfolio(chatId);
    if (data === 'action_invite') return handleInvite(chatId);
    if (data === 'action_alpha') return handleAlphaEdge(chatId);
    if (data === 'action_alerts') return handleAlerts(chatId);
    if (data === 'action_help') return handleHelp(chatId);

    if (data === 'alpha_upgrade') {
      return sendSafe(chatId, '\u{1F512} *AI Deep Analysis requires Silver tier or above.*\n\nUpgrade your agent to unlock personalized AI coaching that analyzes every trade you\'ve made.', {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F525} Upgrade Agent', callback_data: 'action_mint' }]] }
      });
    }

    if (data.startsWith('alpha_scan_')) {
      const addr = data.replace('alpha_scan_', '');
      return handleAlphaEdge(chatId, addr);
    }

    if (data === 'alpha_enter') {
      const user = getUser(chatId);
      user.awaitingAlphaWallet = true;
      return sendSafe(chatId, '\u{1F50D} *Paste a BSC wallet address* to analyze its trading performance.\n\nExample: `0x1234...abcd`');
    }

    if (data.startsWith('alpha_ai_')) {
      const addr = data.replace('alpha_ai_', '');
      return handleAlphaAI(chatId, addr);
    }

    if (data.startsWith('autotrade_enable_')) {
      const strategy = data.replace('autotrade_enable_', '');
      const user = getUser(chatId);
      if (!user.wallet || !user.selectedId) return needAgentMessage(chatId, user, 'Autopilot');

      sendSafe(chatId, `\u23F3 Enabling ${strategy} autopilot for Agent #${user.selectedId}...`);

      try {
        const res = await fetch(`http://localhost:${process.env.PORT || 5000}/api/auto-trade/enable`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: user.selectedId,
            walletAddress: user.wallet,
            strategy: strategy,
            maxTradeBNB: strategy === 'conservative' ? 0.02 : strategy === 'aggressive' ? 0.1 : 0.05,
            dailyCapBNB: strategy === 'conservative' ? 0.1 : strategy === 'aggressive' ? 0.5 : 0.2,
            cooldownMins: strategy === 'conservative' ? 60 : strategy === 'aggressive' ? 15 : 30,
            stopLossPct: strategy === 'conservative' ? 5 : strategy === 'aggressive' ? 15 : 10,
            takeProfitPct: strategy === 'conservative' ? 10 : strategy === 'aggressive' ? 30 : 20,
            slippageBps: 500
          })
        });
        const result = await res.json();

        if (!res.ok) {
          return sendSafe(chatId, `\u274C ${result.error || 'Failed to enable autopilot.'}`, {
            reply_markup: { inline_keyboard: [[{ text: '\u{1F504} Retry', callback_data: 'action_status' }]] }
          });
        }

        let text = `\u2705 *Autopilot Enabled!*\n\n`;
        text += `\u{1F916} Agent #${user.selectedId}\n`;
        text += `\u{1F3AF} Strategy: *${strategy.toUpperCase()}*\n`;
        text += `\u{1F4B3} Max Trade: \`${result.config?.maxTradeBNB || 0.05}\` BNB\n`;
        text += `\u{1F4C5} Daily Cap: \`${result.config?.dailyCapBNB || 0.2}\` BNB\n`;
        text += `\u{1F6E1} Stop Loss: ${result.config?.stopLossPct || 10}%\n`;
        text += `\u{1F4C8} Take Profit: ${result.config?.takeProfitPct || 20}%\n\n`;
        text += `AI will analyze the market every 2 minutes and execute trades when conditions match your strategy.`;

        return sendSafe(chatId, text, {
          reply_markup: { inline_keyboard: [
            [{ text: '\u{1F534} Disable', callback_data: 'autotrade_disable' }, { text: '\u{1F504} Status', callback_data: 'action_status' }]
          ]}
        });
      } catch (e) {
        console.error('[Telegram] autotrade enable error:', e.message);
        return sendSafe(chatId, '\u274C Failed to enable autopilot. Please try again.', {
          reply_markup: { inline_keyboard: [[{ text: '\u{1F504} Retry', callback_data: 'action_status' }]] }
        });
      }
    }

    if (data === 'autotrade_disable') {
      const user = getUser(chatId);
      if (!user.wallet || !user.selectedId) return needAgentMessage(chatId, user, 'Autopilot');

      try {
        const res = await fetch(`http://localhost:${process.env.PORT || 5000}/api/auto-trade/disable`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: user.selectedId,
            walletAddress: user.wallet
          })
        });
        const result = await res.json();

        if (!res.ok) {
          return sendSafe(chatId, `\u274C ${result.error || 'Failed to disable autopilot.'}`, {
            reply_markup: { inline_keyboard: [[{ text: '\u{1F504} Retry', callback_data: 'action_status' }]] }
          });
        }

        return sendSafe(chatId, `\u{1F534} *Autopilot Disabled*\n\nAgent #${user.selectedId} autonomous trading has been stopped.\n\nYou can re-enable it anytime.`, {
          reply_markup: { inline_keyboard: [
            [{ text: '\u{1F7E2} Re-enable', callback_data: 'action_status' }]
          ]}
        });
      } catch (e) {
        console.error('[Telegram] autotrade disable error:', e.message);
        return sendSafe(chatId, '\u274C Failed to disable autopilot. Please try again.');
      }
    }

    if (data.startsWith('mint_confirm_')) {
      const tier = data.replace('mint_confirm_', '');
      const user = getUser(chatId);
      return executeMint(chatId, tier, user.pendingMintName);
    }

    if (data === 'mint_skip_name') {
      const user = getUser(chatId);
      user.pendingMintName = null;
      user.onboardingStep = null;
      const tier = user.pendingMintTier;
      const tierName = TIER_NAMES[tier] || 'Unknown';
      const dynCosts = await getDynamicTierCosts();
      const cost = dynCosts[tier] || 0;
      const emoji = TIER_EMOJI[tier] || '';
      return sendSafe(chatId,
        `${emoji} *Confirm ${tierName} Agent Mint*\n\n` +
        `\u{1F4DD} Name: _None (can set later)_\n` +
        `\u{1F525} Burn: ${cost.toLocaleString()} JACOB\n` +
        `\u{1F4B3} Fee: 0.001 BNB\n\n` +
        `_This action cannot be undone._`,
        {
          reply_markup: { inline_keyboard: [
            [{ text: `\u2705 Confirm Mint ${tierName}`, callback_data: `mint_confirm_${tier}` }],
            [{ text: '\u274C Cancel', callback_data: 'action_mint' }]
          ]}
        }
      );
    }

    if (data.startsWith('mint_tier_')) {
      const tier = parseInt(data.replace('mint_tier_', ''));
      const user = getUser(chatId);
      user.pendingMintTier = tier;
      user.pendingMintName = null;
      user.onboardingStep = 'waiting_mint_name';
      const tierName = TIER_NAMES[tier] || 'Unknown';
      const emoji = TIER_EMOJI[tier] || '';
      return sendSafe(chatId,
        `${emoji} *${tierName} Agent — Step 1: Name Your Agent*\n\n` +
        `Every agent needs a unique on-chain name (1-32 characters).\n\n` +
        `\u{1F4DD} *Type your agent's name now:*`,
        {
          reply_markup: { inline_keyboard: [
            [{ text: '\u23ED Skip Naming (set later)', callback_data: 'mint_skip_name' }],
            [{ text: '\u274C Cancel', callback_data: 'action_mint' }]
          ]}
        }
      );
    }

    if (data.startsWith('buy_confirm_')) {
      const amount = data.replace('buy_confirm_', '');
      return executeBuy(chatId, amount);
    }

    if (data.startsWith('buy_') && data !== 'buy_custom') {
      const amount = data.replace('buy_', '');
      const bnb = parseFloat(amount);
      if (isNaN(bnb) || bnb <= 0) return;
      return sendSafe(chatId,
        `\u{1F4B3} *Confirm Purchase*\n\n` +
        `Swap \`${amount} BNB\` for JACOB tokens?\n\n` +
        `\u{1F95E} Route: PancakeSwap V2\n` +
        `\u{1F6E1} Slippage: 12%\n` +
        `\u23F0 Deadline: 5 minutes\n\n` +
        `_This action cannot be undone._`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '\u2705 Confirm Swap', callback_data: `buy_confirm_${amount}` }],
              [{ text: '\u274C Cancel', callback_data: 'action_buy' }]
            ]
          }
        }
      );
    }

    if (data === 'buy_custom') {
      user.pendingAction = 'buy_custom';
      return sendSafe(chatId,
        `\u270F *Custom Buy Amount*\n\n` +
        `Enter the amount of BNB you want to swap for JACOB.\n\n` +
        `Examples: \`0.02\`, \`0.15\`, \`0.75\`\n\n` +
        `_Min: 0.001 BNB | Max: 5 BNB_`,
        { reply_markup: { inline_keyboard: [[{ text: '\u274C Cancel', callback_data: 'action_buy' }]] } }
      );
    }

    if (data.startsWith('select_agent_')) {
      const agentId = parseInt(data.replace('select_agent_', ''));
      if (!user.agents) return sendSafe(chatId, 'Scan your agents first.');
      const agent = user.agents.find(a => a.tokenId === agentId);
      if (!agent) return sendSafe(chatId, 'Agent not found. Run /agents to refresh.');

      user.selectedId = agent.tokenId;
      user.selectedTier = agent.tier;
      try { const ctx = await fetchAgentContext(agent.tokenId, user.wallet); user.selectedName = ctx.profileName || null; } catch(e) { user.selectedName = null; }

      const emoji = TIER_EMOJI[agent.tier] || '';
      const nameTag = user.selectedName ? ` "${user.selectedName}"` : '';
      return sendSafe(chatId,
        `${emoji} *Agent #${agent.tokenId}${nameTag} (${agent.tierName}) selected!*\n\n` +
        `Your AI tier: *${agent.tierName}*\n` +
        `Swap Limit: ${TIER_SWAP[agent.tier]}\n\n` +
        `_Type any message to start chatting with ${agent.tierName}-tier intelligence!_`,
        { reply_markup: onboardingButtons('done') }
      );
    }

    if (data === 'alert_setup') return handleAlerts(chatId);

    if (data === 'alert_above' || data === 'alert_below') {
      const direction = data === 'alert_above' ? 'above' : 'below';
      user.onboardingStep = `alert_${direction}`;
      return sendSafe(chatId,
        `\u{1F514} *Set Price Alert (${direction})*\n\n` +
        `Type the target price in USD.\n\n` +
        `Example: \`0.000050\`\n\n` +
        `_I'll notify you when JACOB goes ${direction} this price._`,
        { reply_markup: { inline_keyboard: [[{ text: '\u274C Cancel', callback_data: 'action_alerts' }]] } }
      );
    }

    if (data === 'alert_clear') {
      priceAlerts[chatId] = [];
      return sendSafe(chatId, '\u{1F5D1} All price alerts cleared.');
    }
  });

  // ══════════════════════════════════════════════════════════
  //  Group-safe AI Chat Handler (used by /ask and mentions)
  // ══════════════════════════════════════════════════════════

  async function handleGroupAIChat(chatId, question, user, replyToMsgId) {
    const wallet = user.wallet;
    const agentId = user.selectedId;
    const selectedTier = user.selectedTier;

    let tierNum = 1;
    if (agentId && agentId > 0) {
      try {
        tierNum = await verifyAgentTierOnChain(agentId);
        if (tierNum < 1) tierNum = 1;
        if (tierNum > 1 && wallet) {
          const isOwner = await verifyAgentOwnership(agentId, wallet);
          if (!isOwner) tierNum = 1;
        }
      } catch (e) {
        tierNum = selectedTier || 1;
      }
    }

    const tierCap = TIER_CAPABILITIES[tierNum] || TIER_CAPABILITIES[1];

    let marketContext = '';
    try {
      const market = await getMarketCached();
      if (market && market.price !== 'Unavailable') {
        marketContext = `\n\nLive JACOB market data: Price: $${market.price}, 24h change: ${market.change24h}%, 1h change: ${market.change1h}%, 24h volume: $${market.volume24h}, Liquidity: $${market.liquidity}.`;
      }
    } catch (e) {}

    let onChainContext = '';
    if (agentId && agentId > 0) {
      try {
        const agCtx = await fetchAgentContext(agentId, wallet);
        const parts = [];
        parts.push(`\n\nON-CHAIN AGENT DATA (live from BNB Smart Chain):`);
        parts.push(`Agent #${agCtx.agentId} | Tier: ${agCtx.tierName} (${agCtx.tier}/5)`);
        if (agCtx.profileName) parts.push(`Name: "${agCtx.profileName}"`);
        onChainContext = parts.join('\n');
      } catch (e) {}
    }

    const systemPrompt = BASE_SYSTEM_PROMPT +
      '\n\nYou are responding in a Telegram GROUP chat. This is critical: NEVER mention any wallet addresses, vault balances, token balances, or any private financial information in your response — multiple people can see this message. Only discuss general platform info, market data, and public knowledge. Keep responses concise, helpful, and well-formatted for mobile. Use simple markdown (bold, code blocks). Keep answers under 300 words unless the question requires detail.' +
      '\n\n' + tierCap.systemNote + marketContext + onChainContext;

    try {
      bot.sendChatAction(chatId, 'typing');

      const response = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        max_completion_tokens: 1500,
      });

      const reply = response.choices[0]?.message?.content || 'No response generated.';
      const chunks = splitMessage(reply);
      for (const chunk of chunks) {
        try {
          await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown', reply_to_message_id: replyToMsgId });
        } catch (e) {
          await bot.sendMessage(chatId, chunk, { reply_to_message_id: replyToMsgId });
        }
      }
    } catch (e) {
      console.error('[Telegram] Group chat error:', e.message);
      sendSafe(chatId, 'Sorry, I encountered an error. Please try again.', { reply_to_message_id: replyToMsgId });
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Message Handler — Keyboard Buttons + AI Chat + Alerts
  // ══════════════════════════════════════════════════════════

  const recentMessages = new Map();
  const MSG_DEDUP_MS = 1500;

  bot.on('message', async (msg) => {
    if (msg.web_app_data) {
      return;
    }

    if (!msg.text) return;
    const text = msg.text.trim();
    if (text.startsWith('/')) return;

    const chatId = msg.chat.id;

    const msgDedupKey = `${chatId}_${text}`;
    const now = Date.now();
    const lastMsgTime = recentMessages.get(msgDedupKey);
    if (lastMsgTime && now - lastMsgTime < MSG_DEDUP_MS) return;
    recentMessages.set(msgDedupKey, now);
    if (recentMessages.size > 500) {
      const cutoff = now - 10000;
      for (const [k, v] of recentMessages) { if (v < cutoff) recentMessages.delete(k); }
    }

    const user = getUser(chatId);

    if (text === '\u{1F4B3} Buy JACOB') return handleBuy(chatId);
    if (text === '\u{1F525} Mint Agent') return handleMint(chatId);
    if (text === '\u{1F4B0} Vault') return handleVault(chatId);
    if (text === '\u{1F3C6} Tier') return handleTier(chatId);
    if (text === '\u{1F916} Agents') return handleAgents(chatId);
    if (text === '\u{1F4BC} Portfolio') return handlePortfolio(chatId);
    if (text === '\u26A1 Autopilot') return handleStatus(chatId);
    if (text === '\u{1F3AF} Alpha Edge') return handleAlphaEdge(chatId);
    if (text === '\u{1F514} Alerts') return handleAlerts(chatId);
    if (text === '\u{1F517} Invite') return handleInvite(chatId);
    if (text === '\u2753 Help') return handleHelp(chatId);

    if (user.onboardingStep === 'waiting_wallet_address' && /^0x[a-fA-F0-9]{40}$/.test(text.trim())) {
      const addr = text.trim().toLowerCase();
      user.wallet = addr;
      user.onboardingStep = null;
      return sendSafe(chatId, `\u2705 *Wallet Linked!*\n\n\u{1F4B3} Address: \`${addr}\`\n\nScanning for agents...`, {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F916} Scan for Agents', callback_data: 'action_agents' }]] }
      });
    }

    if (user.awaitingAlphaWallet && /^0x[a-fA-F0-9]{40}$/.test(text.trim())) {
      user.awaitingAlphaWallet = false;
      return handleAlphaEdge(chatId, text.trim());
    }

    if (user.onboardingStep === 'waiting_mint_name') {
      const name = text.trim();
      if (name.length < 1 || name.length > 32) {
        return sendSafe(chatId, '\u274C Agent name must be 1-32 characters.\n\nPlease try again:', {
          reply_markup: { inline_keyboard: [
            [{ text: '\u23ED Skip Naming', callback_data: 'mint_skip_name' }],
            [{ text: '\u274C Cancel', callback_data: 'action_mint' }]
          ]}
        });
      }

      sendSafe(chatId, `\u{1F50D} Checking if "${name}" is available...`);

      try {
        const provider = getProvider();
        const profileContract = new ethersLib.Contract(AGENT_PROFILE, PROFILE_ABI, provider);
        const available = await profileContract.isNameAvailable(name);

        if (!available) {
          return sendSafe(chatId, `\u274C *"${name}" is already taken!*\n\nPlease choose a different name:`, {
            reply_markup: { inline_keyboard: [
              [{ text: '\u23ED Skip Naming', callback_data: 'mint_skip_name' }],
              [{ text: '\u274C Cancel', callback_data: 'action_mint' }]
            ]}
          });
        }

        user.pendingMintName = name;
        user.onboardingStep = null;
        const tier = user.pendingMintTier;
        const tierName = TIER_NAMES[tier] || 'Unknown';
        const dynCosts2 = await getDynamicTierCosts();
        const cost = dynCosts2[tier] || 0;
        const emoji = TIER_EMOJI[tier] || '';

        return sendSafe(chatId,
          `${emoji} *Confirm ${tierName} Agent Mint*\n\n` +
          `\u{1F4DD} Name: *${name}* \u2705\n` +
          `\u{1F525} Burn: ${cost.toLocaleString()} JACOB\n` +
          `\u{1F4B3} Fee: 0.001 BNB\n\n` +
          `This will:\n` +
          `1. Approve ${cost} JACOB to the Minter contract\n` +
          `2. Burn ${cost} JACOB tokens forever\n` +
          `3. Mint a ${tierName}-tier Agent NFT\n` +
          `4. Set "${name}" as the on-chain name\n\n` +
          `_This action cannot be undone._`,
          {
            reply_markup: { inline_keyboard: [
              [{ text: `\u2705 Confirm Mint "${name}"`, callback_data: `mint_confirm_${tier}` }],
              [{ text: '\u274C Cancel', callback_data: 'action_mint' }]
            ]}
          }
        );
      } catch (e) {
        console.error('[Telegram] name check error:', e.message);
        return sendSafe(chatId, '\u274C Could not check name availability. Please try again:', {
          reply_markup: { inline_keyboard: [
            [{ text: '\u23ED Skip Naming', callback_data: 'mint_skip_name' }],
            [{ text: '\u274C Cancel', callback_data: 'action_mint' }]
          ]}
        });
      }
    }

    if (user.onboardingStep === 'waiting_wallet' || /^0x[a-fA-F0-9]{40}$/.test(text)) {
      if (/^0x[a-fA-F0-9]{40}$/.test(text)) {
        return sendSafe(chatId,
          `\u{1F512} *Wallet Verification Required*\n\n` +
          `Address: \`${text}\`\n\n` +
          `To prove you own this wallet, tap the button below to sign a verification message. This keeps your account secure.`,
          { reply_markup: onboardingButtons('wallet') }
        );
      }
      return sendSafe(chatId, '\u274C That doesn\'t look like a wallet address.\n\nA BSC address starts with `0x` followed by 40 characters. Just copy-paste it from your wallet app.', {
        reply_markup: { inline_keyboard: [[{ text: '\u23ED Skip for Now', callback_data: 'onboard_skip_wallet' }]] }
      });
    }

    if (user.pendingAction === 'buy_custom') {
      const amount = parseFloat(text);
      user.pendingAction = null;
      if (isNaN(amount) || amount < 0.001 || amount > 5) {
        return sendSafe(chatId, '\u274C Invalid amount. Enter a number between `0.001` and `5` BNB.', {
          reply_markup: { inline_keyboard: [[{ text: '\u{1F504} Try Again', callback_data: 'buy_custom' }, { text: '\u274C Cancel', callback_data: 'action_buy' }]] }
        });
      }
      const amountStr = amount.toString();
      return sendSafe(chatId,
        `\u{1F4B3} *Confirm Purchase*\n\n` +
        `Swap \`${amountStr} BNB\` for JACOB tokens?\n\n` +
        `\u{1F95E} Route: PancakeSwap V2\n` +
        `\u{1F6E1} Slippage: 12%\n` +
        `\u23F0 Deadline: 5 minutes\n\n` +
        `_This action cannot be undone._`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '\u2705 Confirm Swap', callback_data: `buy_confirm_${amountStr}` }],
              [{ text: '\u274C Cancel', callback_data: 'action_buy' }]
            ]
          }
        }
      );
    }

    if (user.pendingAction === 'vault_deposit_custom') {
      const amount = parseFloat(text);
      user.pendingAction = null;
      if (isNaN(amount) || amount < 0.001 || amount > 10) {
        return sendSafe(chatId, '\u274C Invalid amount. Enter a number between `0.001` and `10` BNB.', {
          reply_markup: { inline_keyboard: [[{ text: '\u{1F504} Try Again', callback_data: 'vault_dep_custom' }, { text: '\u274C Cancel', callback_data: 'action_vault' }]] }
        });
      }
      return executeVaultDeposit(chatId, amount.toString());
    }

    if (user.onboardingStep === 'alert_above' || user.onboardingStep === 'alert_below') {
      const direction = user.onboardingStep === 'alert_above' ? 'above' : 'below';
      const price = parseFloat(text);
      if (isNaN(price) || price <= 0) {
        return sendSafe(chatId, '\u274C Invalid price. Please enter a number like `0.000050`');
      }
      if (!priceAlerts[chatId]) priceAlerts[chatId] = [];
      if (priceAlerts[chatId].length >= 5) {
        return sendSafe(chatId, '\u274C Maximum 5 alerts. Clear existing alerts first.');
      }
      priceAlerts[chatId].push({ price, direction, createdAt: Date.now() });
      user.onboardingStep = null;
      const dir = direction === 'above' ? '\u2B06' : '\u2B07';
      return sendSafe(chatId, `${dir} *Alert set!*\n\nYou'll be notified when JACOB goes ${direction} $${price.toFixed(6)}.`, {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F514} View All Alerts', callback_data: 'action_alerts' }]] }
      });
    }

    const isGroup = msg.chat.type !== 'private';

    if (isGroup) {
      if (!text.toLowerCase().includes('jacob') && !text.toLowerCase().includes('@agentjacobot')) return;
      const chatNow = Date.now();
      if (chatRateLimit[chatId] && chatNow - chatRateLimit[chatId] < 3000) return;
      chatRateLimit[chatId] = chatNow;
      return handleGroupAIChat(chatId, text, user, msg.message_id);
    }

    const chatNow = Date.now();
    if (chatRateLimit[chatId] && chatNow - chatRateLimit[chatId] < 3000) return;
    chatRateLimit[chatId] = chatNow;

    const wallet = user.wallet;
    const agentId = user.selectedId;
    const selectedTier = user.selectedTier;

    if (!wallet) {
      return sendSafe(chatId,
        `\u{1F44B} *Hey there!* I'd love to chat, but let's get you set up first.\n\n` +
        `Tap below to create a wallet in seconds — then we can talk trading, agents, and strategy!`,
        { reply_markup: onboardingButtons('wallet') }
      );
    }

    let tierNum = 1;
    if (agentId && agentId > 0) {
      try {
        tierNum = await verifyAgentTierOnChain(agentId);
        if (tierNum < 1) tierNum = 1;
        if (tierNum > 1 && wallet) {
          const isOwner = await verifyAgentOwnership(agentId, wallet);
          if (!isOwner) tierNum = 1;
        }
      } catch (e) {
        tierNum = selectedTier || 1;
      }
    }

    const tierCap = TIER_CAPABILITIES[tierNum] || TIER_CAPABILITIES[1];

    let marketContext = '';
    try {
      const market = await getMarketCached();
      if (market && market.price !== 'Unavailable') {
        marketContext = `\n\nLive JACOB market data: Price: $${market.price}, 24h change: ${market.change24h}%, 1h change: ${market.change1h}%, 24h volume: $${market.volume24h}, Liquidity: $${market.liquidity}.`;
      }
    } catch (e) {}

    let onChainContext = '';
    if (agentId && agentId > 0) {
      try {
        const agCtx = await fetchAgentContext(agentId, wallet);
        const parts = [];
        parts.push(`\n\nON-CHAIN AGENT DATA (live from BNB Smart Chain):`);
        parts.push(`Agent #${agCtx.agentId} | Tier: ${agCtx.tierName} (${agCtx.tier}/5)`);
        if (agCtx.profileName) parts.push(`Name: "${agCtx.profileName}"`);
        parts.push(`Vault BNB: ${agCtx.vaultBnb} BNB`);
        parts.push(`Vault JACOB: ${agCtx.vaultJacob} JACOB`);
        parts.push(`Swap Limit: ${agCtx.maxSwap}`);
        parts.push(`Revenue Shares: ${agCtx.revenueShares}`);
        parts.push(`Revenue Registered: ${agCtx.revenueRegistered ? 'Yes' : 'No'}`);
        if (agCtx.pendingRevenue) parts.push(`Pending Revenue: ${agCtx.pendingRevenue} BNB`);
        if (agCtx.walletJacobBalance) parts.push(`Wallet JACOB Balance: ${agCtx.walletJacobBalance}`);
        onChainContext = parts.join('\n');
      } catch (e) {}
    }

    const systemPrompt = BASE_SYSTEM_PROMPT +
      '\n\nYou are responding via Telegram. Keep responses concise and well-formatted for mobile. Use simple markdown (bold, code blocks). Avoid very long responses.' +
      '\n\n' + tierCap.systemNote + marketContext + onChainContext;

    let userContext = `\n[User Tier: ${tierCap.name}]`;
    if (!agentId) userContext += ' [No agent selected yet — responding at Bronze level. Briefly mention they can select or mint an agent with /agents for better AI capabilities, but focus on answering their question first.]';

    try {
      bot.sendChatAction(chatId, 'typing');

      const response = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text + userContext }
        ],
        max_completion_tokens: 2048,
      });

      const reply = response.choices[0]?.message?.content || 'No response generated.';
      const chunks = splitMessage(reply);
      for (const chunk of chunks) {
        try {
          await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() });
        } catch (e) {
          await bot.sendMessage(chatId, chunk, { reply_markup: mainMenuKeyboard() });
        }
      }
    } catch (e) {
      console.error('[Telegram] Chat error:', e.message);
      sendSafe(chatId, 'Sorry, I encountered an error. Please try again.');
    }
  });

  // ══════════════════════════════════════════════════════════
  //  Price Alert Checker (runs every 60s)
  // ══════════════════════════════════════════════════════════

  setInterval(async () => {
    try {
      const market = await getMarketCached();
      if (!market || market.price === 'Unavailable') return;
      const currentPrice = parseFloat(market.price);
      if (isNaN(currentPrice) || currentPrice <= 0) return;

      for (const [chatId, alerts] of Object.entries(priceAlerts)) {
        const remaining = [];
        for (const alert of alerts) {
          const triggered =
            (alert.direction === 'above' && currentPrice >= alert.price) ||
            (alert.direction === 'below' && currentPrice <= alert.price);

          if (triggered) {
            const dir = alert.direction === 'above' ? '\u2B06' : '\u2B07';
            sendSafe(chatId,
              `${dir} *PRICE ALERT TRIGGERED!*\n\n` +
              `JACOB is now $${currentPrice.toFixed(6)}\n` +
              `Your alert: ${alert.direction} $${alert.price.toFixed(6)}\n\n` +
              `_This alert has been removed._`,
              { reply_markup: { inline_keyboard: [[{ text: '\u{1F4CA} View Price', callback_data: 'action_price' }, { text: '\u{1F514} New Alert', callback_data: 'alert_setup' }]] } }
            );
          } else {
            remaining.push(alert);
          }
        }
        priceAlerts[chatId] = remaining;
      }
    } catch (e) {}
  }, 60000);

  async function handleWalletLinkAPI(chatId, address) {
    chatId = Number(chatId);
    if (!chatId || !/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
    await linkWallet(chatId, address);
    return true;
  }

  return { bot, handleWalletLinkAPI };
}

function formatNum(val) {
  const n = parseFloat(val) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function splitMessage(text, maxLen = 4000) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n\n', maxLen);
    if (splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.3) splitAt = maxLen;
    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).trimStart();
  }
  return chunks;
}

module.exports = { startTelegramBot };
