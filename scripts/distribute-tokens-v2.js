const hre = require("hardhat");

const TOKEN_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function setWhitelist(address account, bool status) external",
  "function setWhitelistBatch(address[] calldata accounts, bool status) external"
];

async function main() {
  const JACOB_V2 = process.env.JACOB_V2_ADDRESS;
  if (!JACOB_V2) {
    console.error("Set JACOB_V2_ADDRESS environment variable");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Distributing V2 tokens with account:", deployer.address);

  const jacobToken = new hre.ethers.Contract(JACOB_V2, TOKEN_ABI, deployer);
  const balance = await jacobToken.balanceOf(deployer.address);
  console.log("Deployer JACOB V2 balance:", hre.ethers.formatEther(balance));

  const WALLETS = {
    team:       process.env.TEAM_WALLET       || "0xFe6b50eAdeC141a1c0C2aDA767483D9b61e40f12",
    creation:   process.env.CREATION_WALLET   || "0xe90d963aF0Dc7A69cA92eb536E5403cb6cc1a83A",
    ecosystem:  process.env.ECOSYSTEM_WALLET  || "0xf1d55c24d22a4F961d276AB35c28422d61cB3B72",
    operations: process.env.OPERATIONS_WALLET || "0x57EEB022305563241032Bba4efC08F2c82613010",
    community:  process.env.COMMUNITY_WALLET  || "0x2a64115B9F771D89c31B90A4fBaE3107dd5B4461"
  };

  console.log("\n========================================");
  console.log("V2 TOKENOMICS (1,000,000 JACOB total)");
  console.log("========================================");
  console.log("Agent Operations:     25% (250,000) - unlocked");
  console.log("Agent Creation:       20% (200,000) - vested: 3mo cliff, 12mo vest");
  console.log("Ecosystem Dev:        15% (150,000) - vested: 3mo cliff, 18mo vest");
  console.log("Liquidity Pool:     12.5% (125,000) - added via setup-liquidity-v2.js (+ 1 BNB)");
  console.log("Team:                 10% (100,000) - vested: 12mo cliff, 24mo vest");
  console.log("Community & Airdrop:  10% (100,000) - unlocked");
  console.log("Strategic Reserve:   7.5%  (75,000) - remains in deployer wallet");
  console.log("LP/MC Ratio: 25%");
  console.log("========================================\n");

  console.log("--- Step 1: Whitelist allocation wallets ---");
  const walletAddresses = Object.values(WALLETS);
  const tx0 = await jacobToken.setWhitelistBatch(walletAddresses, true);
  await tx0.wait();
  console.log("All allocation wallets whitelisted");

  const distributions = [
    { name: "Operations (unlocked)",  wallet: WALLETS.operations, amount: "250000" },
    { name: "Community & Airdrop",    wallet: WALLETS.community,  amount: "100000" },
  ];

  console.log("\n--- Step 2: Distribute unlocked tokens ---");
  for (const dist of distributions) {
    const amount = hre.ethers.parseEther(dist.amount);
    const tx = await jacobToken.transfer(dist.wallet, amount);
    await tx.wait();
    console.log(`Sent ${dist.amount} JACOB to ${dist.name}: ${dist.wallet}`);
  }

  const vestedDistributions = [
    { name: "Team (vested)",             wallet: WALLETS.team,      amount: "100000" },
    { name: "Agent Creation (vested)",   wallet: WALLETS.creation,  amount: "200000" },
    { name: "Ecosystem Dev (vested)",    wallet: WALLETS.ecosystem, amount: "150000" },
  ];

  console.log("\n--- Step 3: Distribute vested tokens ---");
  console.log("NOTE: Deploy a new TokenVesting contract for V2 tokens,");
  console.log("or send directly to vesting wallets if using external vesting.");
  for (const dist of vestedDistributions) {
    const amount = hre.ethers.parseEther(dist.amount);
    const tx = await jacobToken.transfer(dist.wallet, amount);
    await tx.wait();
    console.log(`Sent ${dist.amount} JACOB to ${dist.name}: ${dist.wallet}`);
  }

  const finalBalance = await jacobToken.balanceOf(deployer.address);
  const expectedRemaining = hre.ethers.parseEther("200000");
  const isCorrect = finalBalance === expectedRemaining;

  console.log("\n========================================");
  console.log("DISTRIBUTION COMPLETE");
  console.log("========================================");
  console.log("Deployer remaining balance:", hre.ethers.formatEther(finalBalance), "JACOB");
  console.log("Expected remaining: 200,000 JACOB (125K for LP + 75K strategic reserve)");
  if (!isCorrect) {
    console.log("WARNING: Remaining balance does not match expected 200,000!");
    console.log("Check distributions above for errors before proceeding.");
  } else {
    console.log("Balance matches expected amount.");
  }
  console.log("");
  console.log("NEXT STEP:");
  console.log("Run: npx hardhat run scripts/setup-liquidity-v2.js --network bsc");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
