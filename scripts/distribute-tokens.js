const hre = require("hardhat");

const JACOB_TOKEN = "0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b";

const TOKENOMICS = {
  agentLiquidity: {
    name: "Agent Liquidity Pool",
    percentage: 25,
    tokens: "250000",
    description: "PancakeSwap trading pair for buying JACOB to create/fund agents"
  },
  agentCreation: {
    name: "Agent Creation Treasury",
    percentage: 20,
    tokens: "200000",
    description: "Reserved for agent minting rewards and creator incentives"
  },
  agentOperations: {
    name: "Agent Operations Fund",
    percentage: 20,
    tokens: "200000",
    description: "Funds agent vaults for on-chain action execution"
  },
  ecosystem: {
    name: "Ecosystem Development",
    percentage: 15,
    tokens: "150000",
    description: "AI models, agent templates, developer tools, integrations"
  },
  team: {
    name: "Team",
    percentage: 10,
    tokens: "100000",
    description: "12-month cliff, 24-month vest for long-term alignment"
  },
  community: {
    name: "Community & Early Adopters",
    percentage: 10,
    tokens: "100000",
    description: "Rewards for agent creators, action executors, early users"
  }
};

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)"
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Token distribution from:", deployer.address);

  const jacobToken = new hre.ethers.Contract(JACOB_TOKEN, ERC20_ABI, deployer);
  const balance = await jacobToken.balanceOf(deployer.address);
  console.log("JACOB Balance:", hre.ethers.formatEther(balance), "JACOB\n");

  console.log("========================================");
  console.log("JACOB AI AGENT TOKENOMICS");
  console.log("Total Supply: 1,000,000 JACOB");
  console.log("========================================\n");

  for (const [key, allocation] of Object.entries(TOKENOMICS)) {
    console.log(`${allocation.name}`);
    console.log(`  Allocation: ${allocation.percentage}% (${allocation.tokens} JACOB)`);
    console.log(`  Purpose: ${allocation.description}`);
    console.log("");
  }

  console.log("========================================");
  console.log("DISTRIBUTION WALLETS");
  console.log("========================================");
  console.log("To distribute tokens, set these environment variables:");
  console.log("  WALLET_AGENT_CREATION   - Agent Creation Treasury wallet");
  console.log("  WALLET_AGENT_OPERATIONS - Agent Operations Fund wallet");
  console.log("  WALLET_ECOSYSTEM        - Ecosystem Development wallet");
  console.log("  WALLET_TEAM             - Team wallet (with vesting)");
  console.log("  WALLET_COMMUNITY        - Community & Early Adopters wallet");
  console.log("");
  console.log("Note: Agent Liquidity (25%) goes to PancakeSwap via setup-liquidity.js");
  console.log("========================================\n");

  const wallets = {
    agentCreation: process.env.WALLET_AGENT_CREATION,
    agentOperations: process.env.WALLET_AGENT_OPERATIONS,
    ecosystem: process.env.WALLET_ECOSYSTEM,
    team: process.env.WALLET_TEAM,
    community: process.env.WALLET_COMMUNITY
  };

  const hasWallets = Object.values(wallets).some(w => w && w.length > 0);

  if (!hasWallets) {
    console.log("No distribution wallets configured. Set environment variables and run again.");
    console.log("Tokens remain in deployer wallet for now.");
    return;
  }

  for (const [key, wallet] of Object.entries(wallets)) {
    if (!wallet) continue;

    const allocation = TOKENOMICS[key];
    if (!allocation) continue;

    const amount = hre.ethers.parseEther(allocation.tokens);
    console.log(`Sending ${allocation.tokens} JACOB to ${allocation.name} (${wallet})...`);

    const tx = await jacobToken.transfer(wallet, amount);
    await tx.wait();
    console.log(`  Done! Tx: ${tx.hash}`);
  }

  console.log("\nDistribution complete!");
  const remainingBalance = await jacobToken.balanceOf(deployer.address);
  console.log("Remaining in deployer:", hre.ethers.formatEther(remainingBalance), "JACOB");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
