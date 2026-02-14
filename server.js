const express = require("express");
const path = require("path");
const fs = require("fs");
const OpenAI = require("openai");

const app = express();
const PORT = 5000;

app.use(express.json());

app.use((req, res, next) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  next();
});

app.use(express.static(path.join(__dirname, "public")));

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are Jacob AI. You know about the Jacob token (JACOB) on BNB Smart Chain — a deflationary token where users burn it to mint AI agent NFTs in 5 tiers (Bronze/Silver/Gold/Diamond/Black). Agents have vaults, revenue sharing, upgrades, referrals, and competitions.

Keep replies short. A greeting gets one sentence back. A question gets a few sentences. Only give long detailed answers if someone says "explain in detail" or "break it down". Never use headers or bullet points unless the user asks for a list.`;

app.get("/api/abi/:contractName", (req, res) => {
  const { contractName } = req.params;
  const artifactPath = path.join(
    __dirname,
    "artifacts",
    "contracts",
    `${contractName}.sol`,
    `${contractName}.json`
  );

  if (!fs.existsSync(artifactPath)) {
    return res.status(404).json({ error: `ABI not found for ${contractName}. Run 'npx hardhat compile' first.` });
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  res.json({
    contractName: artifact.contractName,
    abi: artifact.abi,
    bytecode: artifact.bytecode,
  });
});

app.get("/api/contracts", (req, res) => {
  const contracts = [
    { name: "AgentController", file: "contracts/AgentController.sol", description: "Lightweight on-chain action handler", deployOrder: 1 },
    { name: "BAP578NFA", file: "contracts/BAP578NFA.sol", description: "ERC-721 Enumerable + BAP-578 NFA Core (UUPS Upgradeable)", deployOrder: 2 },
    { name: "JacobToken", file: "contracts/JacobToken.sol", description: "DN404/ERC-404 Hybrid with deflationary burn()", deployOrder: 3 },
    { name: "AgentVault", file: "contracts/AgentVault.sol", description: "Per-agent treasury with tier-based PancakeSwap V2 integration", deployOrder: 4 },
    { name: "AgentMinter", file: "contracts/AgentMinter.sol", description: "Burn-to-mint agent creation with 5-tier system", deployOrder: 5 },
    { name: "AgentProfile", file: "contracts/AgentProfile.sol", description: "On-chain agent naming and identity", deployOrder: 6 },
    { name: "AgentUpgrade", file: "contracts/AgentUpgrade.sol", description: "Burn JACOB to upgrade agent tier", deployOrder: 7 },
    { name: "ReferralRewards", file: "contracts/ReferralRewards.sol", description: "Referral tracking and reward distribution", deployOrder: 8 },
    { name: "RevenueSharing", file: "contracts/RevenueSharing.sol", description: "Epoch-based BNB revenue distribution to agent holders", deployOrder: 9 },
    { name: "CompetitionManager", file: "contracts/CompetitionManager.sol", description: "Agent trading battles with prize pools", deployOrder: 10 },
  ];

  const contractsWithAbi = contracts.map((c) => {
    const artifactPath = path.join(__dirname, "artifacts", "contracts", `${c.name}.sol`, `${c.name}.json`);
    return { ...c, compiled: fs.existsSync(artifactPath) };
  });

  res.json(contractsWithAbi);
});

app.post("/api/bot/chat", async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const userContext = context
      ? `\n\nUser context: Agent tier: ${context.tierName}, Risk tolerance: ${context.riskLevel}, Agent ID: ${context.agentId}`
      : "";

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message + userContext }
      ],
      max_completion_tokens: 4096,
    });

    const reply = response.choices[0]?.message?.content || "No response generated";
    res.json({ response: reply });
  } catch (error) {
    console.error("Bot error:", error.message);
    res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
  }
});

const TIER_IMAGES = {
  1: "nft-bronze.png",
  2: "nft-silver.png",
  3: "nft-gold.png",
  4: "nft-diamond.png",
  5: "nft-black.png",
};

const TIER_NAMES = {
  1: "Bronze",
  2: "Silver",
  3: "Gold",
  4: "Diamond",
  5: "Black",
};

const TIER_BURN_COSTS = {
  1: 10,
  2: 50,
  3: 250,
  4: 1000,
  5: 10000,
};

app.get("/api/metadata/:tokenId", (req, res) => {
  const tokenId = parseInt(req.params.tokenId);
  if (isNaN(tokenId) || tokenId < 1) {
    return res.status(400).json({ error: "Invalid token ID" });
  }

  const tier = parseInt(req.query.tier) || 1;
  const burned = parseInt(req.query.burned) || TIER_BURN_COSTS[tier] || 10;
  const tierName = TIER_NAMES[tier] || "Bronze";
  const imageFile = TIER_IMAGES[tier] || "nft-bronze.png";

  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.json({
    name: `Jacob Agent #${tokenId}`,
    description: `BAP-578 Non-Fungible Agent - ${tierName} Tier. Burn ${burned} JACOB to mint this AI agent NFT on BNB Smart Chain.`,
    image: `${baseUrl}/images/${imageFile}`,
    external_url: baseUrl,
    attributes: [
      { trait_type: "Tier", value: tierName },
      { trait_type: "Burned JACOB", value: burned },
      { trait_type: "Max Swap (BNB)", value: tier === 1 ? 0.1 : tier === 2 ? 0.5 : tier === 3 ? 2 : tier === 4 ? 10 : "Unlimited" },
      { trait_type: "Revenue Shares", value: tier === 1 ? 1 : tier === 2 ? 2 : tier === 3 ? 5 : tier === 4 ? 12 : 25 },
    ],
  });
});

const WALLETS_FILE = path.join(__dirname, "data", "registered-wallets.json");

function loadWallets() {
  try {
    if (fs.existsSync(WALLETS_FILE)) {
      return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
    }
  } catch (e) {}
  return [];
}

function saveWallets(wallets) {
  const dir = path.dirname(WALLETS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2));
}

app.post("/api/register-interest", (req, res) => {
  const { wallet } = req.body;
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({ error: "Invalid BNB wallet address" });
  }
  const wallets = loadWallets();
  if (wallets.some(w => w.wallet.toLowerCase() === wallet.toLowerCase())) {
    return res.json({ success: true, message: "Already registered", count: wallets.length });
  }
  wallets.push({ wallet, registeredAt: new Date().toISOString() });
  saveWallets(wallets);
  res.json({ success: true, message: "Registered", count: wallets.length });
});

app.get("/api/register-count", (req, res) => {
  const wallets = loadWallets();
  res.json({ count: wallets.length });
});

app.get("/api/registered-wallets", (req, res) => {
  const wallets = loadWallets();
  res.json({ count: wallets.length, wallets });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Jacob BAP-578 Platform running on http://0.0.0.0:${PORT}`);
});
