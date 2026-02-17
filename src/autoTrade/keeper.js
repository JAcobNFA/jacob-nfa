const { ethers } = require('ethers');
const store = require('./store');

const AGENT_VAULT_ADDRESS = '0x120192695152B8788277e46af1412002697B9F25';
const BAP578_NFA_ADDRESS = '0xfd8EeD47b61435f43B004fC65C5b76951652a8CE';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const JACOB_TOKEN = '0xeF3d1BcB6A8C9e9d294dFc2e3F20986bD6230775';

const VAULT_ABI = [
  'function swapBNBForTokens(uint256 agentId, address tokenOut, uint256 amountOutMin) external payable',
  'function swapAgentBNBForTokens(uint256 agentId, address tokenOut, uint256 amountBNB, uint256 amountOutMin) external',
  'function swapTokensForBNB(uint256 agentId, address tokenIn, uint256 amountIn, uint256 amountOutMin) external',
  'function swapTokensForTokens(uint256 agentId, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin) external',
  'function depositBNBForAgent(uint256 agentId) external payable',
  'function reimburseGas(uint256 agentId, uint256 gasAmount) external',
  'function balances(uint256 agentId, address token) external view returns (uint256)',
  'function bnbBalances(uint256 agentId) external view returns (uint256)'
];

const NFA_ABI = [
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function getAgentTier(uint256 tokenId) external view returns (uint8)',
  'function agentFunds(uint256 tokenId) external view returns (uint256)'
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

const STRATEGY_PROFILES = {
  conservative: {
    signalThreshold: 0.8,
    maxPositionPct: 20,
    trailingStopPct: 5,
    minConfidence: 'high',
    preferredAction: 'hold',
    description: 'Low risk. Only trades on strong signals with high liquidity. Prefers established tokens (>$1M liquidity). Smaller positions.'
  },
  balanced: {
    signalThreshold: 0.6,
    maxPositionPct: 40,
    trailingStopPct: 10,
    minConfidence: 'medium',
    preferredAction: 'balanced',
    description: 'Moderate risk. Trades established and mid-cap tokens. Standard positions. Requires >$100K liquidity.'
  },
  aggressive: {
    signalThreshold: 0.4,
    maxPositionPct: 70,
    trailingStopPct: 15,
    minConfidence: 'low',
    preferredAction: 'trade',
    description: 'Higher risk. Will trade newer and lower-cap tokens for higher returns. Accepts >$50K liquidity. Larger positions.'
  }
};

const MIN_LIQUIDITY_USD = {
  conservative: 1000000,
  balanced: 100000,
  aggressive: 50000
};

let provider = null;
let signer = null;
let vaultContract = null;
let nfaContract = null;
let keeperInterval = null;
let isRunning = false;

function initialize() {
  try {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
      console.log('[AutoTrade] DEPLOYER_PRIVATE_KEY not set — keeper disabled');
      return false;
    }

    provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    signer = new ethers.Wallet(privateKey, provider);
    vaultContract = new ethers.Contract(AGENT_VAULT_ADDRESS, VAULT_ABI, signer);
    nfaContract = new ethers.Contract(BAP578_NFA_ADDRESS, NFA_ABI, provider);

    console.log('[AutoTrade] Keeper initialized. Executor:', signer.address);
    return true;
  } catch (e) {
    console.error('[AutoTrade] Init failed:', e.message);
    return false;
  }
}

function isBlacklisted(tokenAddress) {
  const addr = tokenAddress.toLowerCase();
  return addr === JACOB_TOKEN.toLowerCase() || addr === WBNB.toLowerCase();
}

async function discoverTokens(strategy) {
  const discovered = [];
  const minLiq = MIN_LIQUIDITY_USD[strategy] || 100000;

  try {
    const searchQueries = ['WBNB', 'BSC', 'pancakeswap'];
    const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];

    const [trendingRes, searchRes] = await Promise.all([
      fetch('https://api.dexscreener.com/token-boosts/top/v1').then(r => r.json()).catch(() => []),
      fetch(`https://api.dexscreener.com/latest/dex/search?q=${query}`).then(r => r.json()).catch(() => ({ pairs: [] }))
    ]);

    const seenAddresses = new Set();

    if (Array.isArray(trendingRes)) {
      for (const boost of trendingRes) {
        if (boost.chainId === 'bsc' && boost.tokenAddress && !isBlacklisted(boost.tokenAddress)) {
          if (!seenAddresses.has(boost.tokenAddress.toLowerCase())) {
            seenAddresses.add(boost.tokenAddress.toLowerCase());
            discovered.push({
              address: boost.tokenAddress,
              symbol: boost.symbol || '???',
              name: boost.name || boost.symbol || 'Unknown',
              source: 'trending'
            });
          }
        }
      }
    }

    if (searchRes && searchRes.pairs) {
      for (const pair of searchRes.pairs) {
        if (pair.chainId !== 'bsc') continue;
        if (pair.dexId !== 'pancakeswap') continue;
        const liq = pair.liquidity?.usd || 0;
        if (liq < minLiq) continue;
        const vol = pair.volume?.h24 || 0;
        if (vol < 10000) continue;

        const baseAddr = pair.baseToken?.address;
        if (!baseAddr || isBlacklisted(baseAddr)) continue;
        if (seenAddresses.has(baseAddr.toLowerCase())) continue;
        seenAddresses.add(baseAddr.toLowerCase());

        discovered.push({
          address: baseAddr,
          symbol: pair.baseToken.symbol,
          name: pair.baseToken.name,
          price: parseFloat(pair.priceUsd) || 0,
          change1h: pair.priceChange?.h1 || 0,
          change24h: pair.priceChange?.h24 || 0,
          volume24h: vol,
          liquidity: liq,
          pairAddress: pair.pairAddress,
          source: 'search'
        });
      }
    }

    if (discovered.length < 5) {
      const fallbackAddresses = [
        '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
        '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
        '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE',
        '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD',
        '0xBf5140A22578168FD562DCcF235E5D43A02ce9B1',
        '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402',
        '0xbA2aE424d960c26247Dd6c32edC70B295c744C43',
        '0x570A5D26f7765Ecb712C0924E4De545B89fD43dF',
        '0x3EE2200Efb3400faBB9AacF31297cBdD1d435D47',
      ].filter(a => !seenAddresses.has(a.toLowerCase()));

      if (fallbackAddresses.length > 0) {
        const batch = fallbackAddresses.slice(0, 5).join(',');
        try {
          const fbRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${batch}`);
          const fbData = await fbRes.json();
          if (fbData && fbData.pairs) {
            for (const pair of fbData.pairs) {
              if (pair.chainId !== 'bsc') continue;
              const baseAddr = pair.baseToken?.address;
              if (!baseAddr || isBlacklisted(baseAddr)) continue;
              if (seenAddresses.has(baseAddr.toLowerCase())) continue;
              const liq = pair.liquidity?.usd || 0;
              if (liq < minLiq) continue;
              seenAddresses.add(baseAddr.toLowerCase());
              discovered.push({
                address: baseAddr,
                symbol: pair.baseToken.symbol,
                name: pair.baseToken.name,
                price: parseFloat(pair.priceUsd) || 0,
                change1h: pair.priceChange?.h1 || 0,
                change24h: pair.priceChange?.h24 || 0,
                volume24h: pair.volume?.h24 || 0,
                liquidity: liq,
                pairAddress: pair.pairAddress,
                source: 'fallback'
              });
            }
          }
        } catch (e) {}
      }
    }

    if (discovered.length > 0 && discovered.some(t => !t.price)) {
      const needPrices = discovered.filter(t => !t.price).slice(0, 10);
      if (needPrices.length > 0) {
        try {
          const addrs = needPrices.map(t => t.address).join(',');
          const priceRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addrs}`);
          const priceData = await priceRes.json();
          if (priceData && priceData.pairs) {
            for (const pair of priceData.pairs) {
              if (pair.chainId !== 'bsc' || pair.dexId !== 'pancakeswap') continue;
              const baseAddr = pair.baseToken?.address?.toLowerCase();
              const token = discovered.find(t => t.address.toLowerCase() === baseAddr && !t.price);
              if (token) {
                const liq = pair.liquidity?.usd || 0;
                if (liq < minLiq) continue;
                token.price = parseFloat(pair.priceUsd) || 0;
                token.change1h = pair.priceChange?.h1 || 0;
                token.change24h = pair.priceChange?.h24 || 0;
                token.volume24h = pair.volume?.h24 || 0;
                token.liquidity = liq;
                token.pairAddress = pair.pairAddress;
              }
            }
          }
        } catch (e) {}
      }
    }

    return discovered.filter(t => t.price && t.price > 0);
  } catch (e) {
    console.error('[AutoTrade] Token discovery failed:', e.message);
    return [];
  }
}

async function fetchJacobData() {
  try {
    const res = await fetch('https://api.dexscreener.com/latest/dex/pairs/bsc/0x1EED76a091e4E02aaEb6879590eeF53F27E9c520');
    const data = await res.json();
    if (data && data.pair) {
      const p = data.pair;
      return {
        price: parseFloat(p.priceUsd) || 0,
        priceNative: parseFloat(p.priceNative) || 0,
        change24h: p.priceChange?.h24 || 0,
        change1h: p.priceChange?.h1 || 0,
        volume24h: p.volume?.h24 || 0,
        liquidity: p.liquidity?.usd || 0
      };
    }
  } catch (e) {}
  return null;
}

async function getAgentPositions(agentId) {
  const positions = {};
  const tracked = store.getTrackedTokens(agentId);

  const checks = Object.entries(tracked).map(async ([addr, info]) => {
    try {
      const bal = await vaultContract.balances(agentId, addr);
      const decimals = info.decimals || 18;
      const parsed = parseFloat(ethers.formatUnits(bal, decimals));
      if (parsed > 0.000001) {
        positions[info.symbol || addr.slice(0, 8)] = {
          balance: parsed,
          address: addr,
          decimals,
          name: info.name || info.symbol || 'Unknown',
          symbol: info.symbol || '???'
        };
      } else if (parsed <= 0) {
        store.removePosition(agentId, addr);
      }
    } catch (e) {}
  });
  await Promise.all(checks);
  return positions;
}

async function resolveTokenDecimals(tokenAddress) {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const decimals = await contract.decimals();
    return Number(decimals);
  } catch (e) {
    return 18;
  }
}

async function generateTradeSignal(openai, agentConfig, discoveredTokens, vaultBalance, positions) {
  if (!openai) return null;

  const tokenLines = discoveredTokens.slice(0, 20).map(t => {
    let line = `- ${t.symbol} (${t.name}): $${t.price}`;
    if (t.change1h !== undefined) line += `, 1h: ${t.change1h}%`;
    if (t.change24h !== undefined) line += `, 24h: ${t.change24h}%`;
    if (t.volume24h) line += `, vol: $${Number(t.volume24h).toLocaleString()}`;
    if (t.liquidity) line += `, liq: $${Number(t.liquidity).toLocaleString()}`;
    line += ` [${t.address}]`;
    return line;
  }).join('\n');

  const positionSummary = Object.keys(positions).length > 0
    ? Object.entries(positions).map(([sym, pos]) => `${sym}: ${pos.balance.toFixed(6)} [${pos.address}]`).join('\n')
    : 'No open positions';

  const prompt = `You are an autonomous BSC trading engine. You can trade ANY token on BNB Smart Chain via PancakeSwap.

LIVE MARKET OPPORTUNITIES (BSC tokens with PancakeSwap liquidity):
${tokenLines}

CURRENT HOLDINGS:
${positionSummary}
Vault BNB: ${vaultBalance} BNB

CONFIG:
- Strategy: ${agentConfig.strategy}
- Max Trade Size: ${agentConfig.maxTradeBNB} BNB
- Stop Loss: ${agentConfig.stopLossPct}%
- Take Profit: ${agentConfig.takeProfitPct}%
- Daily Cap Remaining: ${Math.max(0, agentConfig.dailyCapBNB - (agentConfig.dailySpent || 0))} BNB

RULES:
- NEVER trade JACOB (0xeF3d1BcB6A8C9e9d294dFc2e3F20986bD6230775) — it is the platform token and OFF-LIMITS
- You can pick ANY token from the list above, or any BSC token you know has PancakeSwap liquidity
- If buying, provide the exact contract address of the token
- If selling, you MUST sell a token you currently hold
- amountBNB must not exceed max trade size or daily cap remaining
- If no good opportunities exist, output "hold"
- For ${agentConfig.strategy} strategy: ${STRATEGY_PROFILES[agentConfig.strategy]?.description || 'balanced approach'}

Respond with ONLY valid JSON:
{
  "action": "buy|sell|hold",
  "token": "SYMBOL",
  "tokenAddress": "0x...",
  "tokenName": "Full Name",
  "confidence": "high|medium|low",
  "amountBNB": 0.0,
  "reasoning": "brief explanation",
  "riskScore": 1-10
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AI_INTEGRATIONS_OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const signal = JSON.parse(jsonMatch[0]);
      if (signal.tokenAddress && isBlacklisted(signal.tokenAddress)) {
        return { action: 'hold', reasoning: 'Selected token is blacklisted — skipped', confidence: 'high', riskScore: 0 };
      }
      if (signal.token && signal.token.toUpperCase() === 'JACOB') {
        return { action: 'hold', reasoning: 'JACOB is off-limits — skipped', confidence: 'high', riskScore: 0 };
      }
      return signal;
    }
  } catch (e) {
    console.error('[AutoTrade] Signal generation failed:', e.message);
  }
  return null;
}

function validateSignal(signal, config, positions) {
  if (!signal || signal.action === 'hold') {
    return { valid: false, reason: signal?.reasoning || 'Signal is hold or null' };
  }

  if (signal.action === 'buy' && !signal.tokenAddress) {
    return { valid: false, reason: 'No token address provided for buy' };
  }

  if (signal.action === 'sell') {
    const held = Object.values(positions).find(p =>
      p.address.toLowerCase() === (signal.tokenAddress || '').toLowerCase() ||
      p.symbol.toUpperCase() === (signal.token || '').toUpperCase()
    );
    if (!held) {
      return { valid: false, reason: `Not holding ${signal.token || signal.tokenAddress} — cannot sell` };
    }
    signal.tokenAddress = held.address;
    signal.token = held.symbol;
  }

  if (signal.tokenAddress && isBlacklisted(signal.tokenAddress)) {
    return { valid: false, reason: 'Token is blacklisted (JACOB or WBNB)' };
  }

  if (signal.token && signal.token.toUpperCase() === 'JACOB') {
    return { valid: false, reason: 'JACOB token is off-limits for autopilot' };
  }

  const stratProfile = STRATEGY_PROFILES[config.strategy] || STRATEGY_PROFILES.balanced;
  const confidenceMap = { high: 1.0, medium: 0.7, low: 0.4 };
  const signalStrength = confidenceMap[signal.confidence] || 0;

  if (signalStrength < stratProfile.signalThreshold) {
    return { valid: false, reason: `Signal confidence ${signal.confidence} below ${config.strategy} threshold` };
  }

  const now = Date.now();
  const cooldown = config.cooldownMins || 2;
  if (config.lastTradeAt && (now - config.lastTradeAt) < cooldown * 60000) {
    const minsLeft = Math.ceil((cooldown * 60000 - (now - config.lastTradeAt)) / 60000);
    return { valid: false, reason: `Cooldown active (${minsLeft}m remaining)` };
  }

  const dailyRemaining = Math.max(0, (config.dailyCapBNB || 0.2) - (config.dailySpent || 0));
  if (dailyRemaining <= 0) {
    return { valid: false, reason: 'Daily cap reached' };
  }

  const tradeAmount = Math.min(signal.amountBNB || 0, config.maxTradeBNB || 0.05, dailyRemaining);
  if (tradeAmount <= 0) {
    return { valid: false, reason: 'Trade amount is zero' };
  }

  if (signal.riskScore && signal.riskScore > 8 && config.strategy !== 'aggressive') {
    return { valid: false, reason: `Risk score ${signal.riskScore}/10 too high for ${config.strategy} strategy` };
  }

  return { valid: true, tradeAmount, reason: 'All checks passed' };
}

const MAX_GAS_REIMBURSEMENT = ethers.parseEther('0.005');

async function reimburseGasFromAgent(agentId, receipt) {
  try {
    const gasUsed = receipt.gasUsed ? BigInt(receipt.gasUsed) : null;
    const gasPrice = receipt.effectiveGasPrice ? BigInt(receipt.effectiveGasPrice) : (receipt.gasPrice ? BigInt(receipt.gasPrice) : null);
    if (!gasUsed || !gasPrice) {
      console.log(`[AutoTrade] Gas reimbursement skipped for agent #${agentId}: missing gas data in receipt`);
      return;
    }

    let gasCost = gasUsed * gasPrice;
    if (gasCost > MAX_GAS_REIMBURSEMENT) {
      console.log(`[AutoTrade] Gas cost ${ethers.formatEther(gasCost)} BNB exceeds cap, capping at ${ethers.formatEther(MAX_GAS_REIMBURSEMENT)} BNB`);
      gasCost = MAX_GAS_REIMBURSEMENT;
    }

    const agentBnb = await vaultContract.bnbBalances(agentId).catch(() => 0n);

    if (agentBnb >= gasCost) {
      const reimburseTx = await vaultContract.reimburseGas(agentId, gasCost, { gasLimit: 80000 });
      await reimburseTx.wait();
      console.log(`[AutoTrade] Gas reimbursed from agent #${agentId}: ${ethers.formatEther(gasCost)} BNB`);
    } else {
      console.log(`[AutoTrade] Agent #${agentId} vault BNB too low to reimburse gas (${ethers.formatEther(gasCost)} BNB needed)`);
    }
  } catch (e) {
    console.log(`[AutoTrade] Gas reimbursement skipped for agent #${agentId}: ${e.message}`);
  }
}

async function executeTradeForAgent(agentId, signal, config, tradeAmount) {
  if (!vaultContract || !signer) {
    return { success: false, error: 'Keeper not initialized' };
  }

  try {
    const tokenAddress = signal.tokenAddress;
    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      return { success: false, error: `Invalid token address: ${tokenAddress}` };
    }

    if (isBlacklisted(tokenAddress)) {
      return { success: false, error: 'Token is blacklisted' };
    }

    const decimals = await resolveTokenDecimals(tokenAddress);

    if (signal.action === 'buy') {
      const [vaultBnb, nfaFunds] = await Promise.all([
        vaultContract.bnbBalances(agentId).catch(() => 0n),
        nfaContract.agentFunds(agentId).catch(() => 0n)
      ]);
      const totalBnb = parseFloat(ethers.formatEther(vaultBnb + nfaFunds));

      if (totalBnb < tradeAmount) {
        return { success: false, error: `Insufficient vault BNB: ${totalBnb.toFixed(4)} < ${tradeAmount}. Deposit BNB to agent vault first.` };
      }

      const amountIn = ethers.parseEther(tradeAmount.toString());
      let receipt;

      if (vaultBnb >= amountIn) {
        try {
          const tx = await vaultContract.swapAgentBNBForTokens(agentId, tokenAddress, amountIn, 0, { gasLimit: 300000 });
          receipt = await tx.wait();
        } catch (e) {
          if (e.message && e.message.includes('data="0x"')) {
            const tx = await vaultContract.swapBNBForTokens(agentId, tokenAddress, 0, { value: amountIn, gasLimit: 300000 });
            receipt = await tx.wait();
          } else {
            throw e;
          }
        }
      } else {
        const tx = await vaultContract.swapBNBForTokens(agentId, tokenAddress, 0, { value: amountIn, gasLimit: 300000 });
        receipt = await tx.wait();
      }

      store.trackPosition(agentId, tokenAddress, signal.token || '???', signal.tokenName || signal.token || 'Unknown', decimals);

      await reimburseGasFromAgent(agentId, receipt);

      return {
        success: true,
        txHash: receipt.hash,
        action: 'buy',
        token: signal.token,
        tokenAddress,
        tokenName: signal.tokenName || signal.token,
        amountBNB: tradeAmount,
        gasUsed: receipt.gasUsed.toString()
      };
    } else if (signal.action === 'sell') {
      const tokenBalance = await vaultContract.balances(agentId, tokenAddress);
      const tokenBalanceParsed = parseFloat(ethers.formatUnits(tokenBalance, decimals));

      if (tokenBalanceParsed <= 0) {
        return { success: false, error: `No ${signal.token} in vault to sell` };
      }

      const sellPct = Math.min((tradeAmount / (config.maxTradeBNB || 0.05)) * 100, 50);
      const sellAmount = (tokenBalanceParsed * sellPct) / 100;
      const amountIn = ethers.parseUnits(
        sellAmount.toFixed(Math.min(decimals, 18)),
        decimals
      );

      const tx = await vaultContract.swapTokensForBNB(agentId, tokenAddress, amountIn, 0, { gasLimit: 300000 });
      const receipt = await tx.wait();

      const remainingBal = await vaultContract.balances(agentId, tokenAddress).catch(() => 0n);
      const remainingParsed = parseFloat(ethers.formatUnits(remainingBal, decimals));
      if (remainingParsed <= 0.000001) {
        store.removePosition(agentId, tokenAddress);
      }

      await reimburseGasFromAgent(agentId, receipt);

      return {
        success: true,
        txHash: receipt.hash,
        action: 'sell',
        token: signal.token,
        tokenAddress,
        tokenName: signal.tokenName || signal.token,
        amountTokens: sellAmount,
        gasUsed: receipt.gasUsed.toString()
      };
    }

    return { success: false, error: 'Unknown action: ' + signal.action };
  } catch (e) {
    return { success: false, error: e.message || 'Transaction failed' };
  }
}

async function runKeeperCycle(openai) {
  if (isRunning) return;
  isRunning = true;

  try {
    store.resetDailyCaps();
    const agents = store.getEnabledAgents();

    if (agents.length === 0) {
      isRunning = false;
      return;
    }

    console.log(`[AutoTrade] Keeper tick — ${agents.length} enabled agent(s)`);

    const [jacobData, discoveredTokens] = await Promise.all([
      fetchJacobData(),
      discoverTokens(agents[0]?.strategy || 'balanced')
    ]);

    console.log(`[AutoTrade] Discovered ${discoveredTokens.length} tradeable tokens on BSC`);

    for (const agent of agents) {
      try {
        let vaultBNB = 0;
        try {
          const [vaultBnb, nfaFunds] = await Promise.all([
            vaultContract.bnbBalances(agent.agentId).catch(() => 0n),
            nfaContract.agentFunds(agent.agentId).catch(() => 0n)
          ]);
          vaultBNB = parseFloat(ethers.formatEther(vaultBnb + nfaFunds));
        } catch (e) {}

        const positions = await getAgentPositions(agent.agentId);

        const signal = await generateTradeSignal(openai, agent, discoveredTokens, vaultBNB, positions);
        const validation = validateSignal(signal, agent, positions);

        if (!validation.valid) {
          console.log(`[AutoTrade] Agent #${agent.agentId} skip: ${validation.reason}`);
          store.appendLog({
            agentId: agent.agentId,
            timestamp: Date.now(),
            type: 'skip',
            signal: signal,
            reason: validation.reason,
            discoveredCount: discoveredTokens.length
          });
          continue;
        }

        const result = await executeTradeForAgent(agent.agentId, signal, agent, validation.tradeAmount);

        store.recordTrade(agent.agentId, {
          type: result.success ? 'trade' : 'failed',
          action: signal.action,
          token: signal.token,
          tokenAddress: signal.tokenAddress,
          tokenName: signal.tokenName,
          amountBNB: validation.tradeAmount,
          signal: signal,
          result: result,
          marketSnapshot: {
            jacobPrice: jacobData?.price || 0,
            discoveredTokens: discoveredTokens.length
          }
        });

        if (result.success) {
          console.log(`[AutoTrade] Agent #${agent.agentId} ${signal.action} ${signal.token} (${signal.tokenAddress?.slice(0, 10)}...) ${validation.tradeAmount} BNB | tx: ${result.txHash}`);
        } else {
          console.log(`[AutoTrade] Agent #${agent.agentId} trade failed: ${result.error}`);
        }
      } catch (e) {
        console.error(`[AutoTrade] Error processing agent #${agent.agentId}:`, e.message);
        store.appendLog({
          agentId: agent.agentId,
          timestamp: Date.now(),
          type: 'error',
          error: e.message
        });
      }
    }
  } catch (e) {
    console.error('[AutoTrade] Keeper cycle error:', e.message);
  }

  isRunning = false;
}

function startKeeper(openai, intervalMs = 120000) {
  if (!initialize()) {
    console.log('[AutoTrade] Keeper not started — initialization failed');
    return false;
  }

  keeperInterval = setInterval(() => runKeeperCycle(openai), intervalMs);
  console.log(`[AutoTrade] Keeper started (interval: ${intervalMs / 1000}s)`);

  setTimeout(() => runKeeperCycle(openai), 5000);
  return true;
}

function stopKeeper() {
  if (keeperInterval) {
    clearInterval(keeperInterval);
    keeperInterval = null;
    console.log('[AutoTrade] Keeper stopped');
  }
}

module.exports = {
  initialize,
  startKeeper,
  stopKeeper,
  runKeeperCycle,
  fetchJacobData,
  discoverTokens,
  generateTradeSignal,
  validateSignal,
  executeTradeForAgent,
  getAgentPositions,
  resolveTokenDecimals,
  STRATEGY_PROFILES
};
