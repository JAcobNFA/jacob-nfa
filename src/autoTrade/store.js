const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CONFIG_PATH = path.join(DATA_DIR, 'auto-trade-configs.json');
const LOG_PATH = path.join(DATA_DIR, 'auto-trade-log.json');
const POSITIONS_PATH = path.join(DATA_DIR, 'auto-trade-positions.json');

const DEFAULT_CONFIG = {
  enabled: false,
  ownerAddress: '',
  tier: 0,
  strategy: 'balanced',
  tokenAllowlist: [],
  maxTradeBNB: 0.05,
  dailyCapBNB: 0.2,
  slippageBps: 500,
  cooldownMins: 2,
  stopLossPct: 10,
  takeProfitPct: 20,
  lastTradeAt: 0,
  dailySpent: 0,
  dailyResetAt: 0,
  totalTrades: 0,
  totalVolumeBNB: 0
};

function loadConfigs() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveConfigs(configs) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(configs, null, 2));
}

function getConfig(agentId) {
  const configs = loadConfigs();
  return configs[agentId] || null;
}

function setConfig(agentId, updates) {
  const configs = loadConfigs();
  const existing = configs[agentId] || { ...DEFAULT_CONFIG };
  configs[agentId] = { ...existing, ...updates };
  saveConfigs(configs);
  return configs[agentId];
}

function removeConfig(agentId) {
  const configs = loadConfigs();
  delete configs[agentId];
  saveConfigs(configs);
}

function getEnabledAgents() {
  const configs = loadConfigs();
  const enabled = [];
  for (const [agentId, config] of Object.entries(configs)) {
    if (config.enabled) {
      enabled.push({ agentId: parseInt(agentId), ...config });
    }
  }
  return enabled;
}

function resetDailyCaps() {
  const configs = loadConfigs();
  const now = Date.now();
  let changed = false;
  for (const [agentId, config] of Object.entries(configs)) {
    if (now - (config.dailyResetAt || 0) > 86400000) {
      config.dailySpent = 0;
      config.dailyResetAt = now;
      changed = true;
    }
  }
  if (changed) saveConfigs(configs);
}

function recordTrade(agentId, tradeData) {
  const configs = loadConfigs();
  if (configs[agentId]) {
    configs[agentId].lastTradeAt = Date.now();
    configs[agentId].dailySpent = (configs[agentId].dailySpent || 0) + (tradeData.amountBNB || 0);
    configs[agentId].totalTrades = (configs[agentId].totalTrades || 0) + 1;
    configs[agentId].totalVolumeBNB = (configs[agentId].totalVolumeBNB || 0) + (tradeData.amountBNB || 0);
    saveConfigs(configs);
  }

  appendLog({
    agentId,
    timestamp: Date.now(),
    ...tradeData
  });
}

function appendLog(entry) {
  let logs = [];
  try {
    if (fs.existsSync(LOG_PATH)) {
      logs = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
    }
  } catch (e) {}

  logs.push(entry);
  if (logs.length > 1000) logs = logs.slice(-500);
  fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2));
}

function getLogs(agentId, limit = 50) {
  let logs = [];
  try {
    if (fs.existsSync(LOG_PATH)) {
      logs = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
    }
  } catch (e) {}

  if (agentId !== undefined && agentId !== null) {
    logs = logs.filter(l => l.agentId == agentId);
  }
  return logs.slice(-limit);
}

function loadPositions() {
  try {
    if (fs.existsSync(POSITIONS_PATH)) {
      return JSON.parse(fs.readFileSync(POSITIONS_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function savePositions(positions) {
  fs.writeFileSync(POSITIONS_PATH, JSON.stringify(positions, null, 2));
}

function trackPosition(agentId, tokenAddress, symbol, name, decimals) {
  const positions = loadPositions();
  if (!positions[agentId]) positions[agentId] = {};
  positions[agentId][tokenAddress.toLowerCase()] = {
    symbol,
    name,
    decimals,
    trackedAt: Date.now()
  };
  savePositions(positions);
}

function removePosition(agentId, tokenAddress) {
  const positions = loadPositions();
  if (positions[agentId]) {
    delete positions[agentId][tokenAddress.toLowerCase()];
    savePositions(positions);
  }
}

function getTrackedTokens(agentId) {
  const positions = loadPositions();
  return positions[agentId] || {};
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfigs,
  getConfig,
  setConfig,
  removeConfig,
  getEnabledAgents,
  resetDailyCaps,
  recordTrade,
  appendLog,
  getLogs,
  trackPosition,
  removePosition,
  getTrackedTokens
};
