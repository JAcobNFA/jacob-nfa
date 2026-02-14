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
    percentage: 9,
    tokens: "90000",
    description: "Rewards for agent creators, action executors, early users"
  },
  airdrop: {
    name: "Airdrop",
    percentage: 1,
    tokens: "10000",
    description: "Free tokens for registered interest wallets"
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

  const WALLETS = {
    team:            "0xFe6b50eAdeC141a1c0C2aDA767483D9b61e40f12",
    agentCreation:   "0xe90d963aF0Dc7A69cA92eb536E5403cb6cc1a83A",
    ecosystem:       "0xf1d55c24d22a4F961d276AB35c28422d61cB3B72",
    agentOperations: "0x57EEB022305563241032Bba4efC08F2c82613010",
    community:       "0x2a64115B9F771D89c31B90A4fBaE3107dd5B4461",
    airdrop:         "0x2a64115B9F771D89c31B90A4fBaE3107dd5B4461",
  };

  const distributions = [
    { key: "agentOperations", wallet: WALLETS.agentOperations, tokens: "200000", name: "Agent Operations Fund" },
    { key: "community",       wallet: WALLETS.community,       tokens: "90000",  name: "Community & Early Adopters" },
    { key: "airdrop",         wallet: WALLETS.airdrop,         tokens: "10000",  name: "Airdrop" },
  ];

  console.log("Note: Team, Agent Creation, and Ecosystem go to vesting contract (deploy-vesting.js)");
  console.log("Note: Agent Liquidity (250,000) goes to PancakeSwap via setup-liquidity.js");
  console.log("========================================\n");

  for (const dist of distributions) {
    console.log(`${dist.name}: ${dist.wallet}`);
  }
  console.log("");

  for (const dist of distributions) {
    const amount = hre.ethers.parseEther(dist.tokens);
    console.log(`Sending ${dist.tokens} JACOB to ${dist.name} (${dist.wallet})...`);

    const tx = await jacobToken.transfer(dist.wallet, amount);
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
