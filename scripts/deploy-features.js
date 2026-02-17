const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying feature contracts with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB");

  const BAP578_PROXY = "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE";
  const JACOB_TOKEN = "0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b";
  const AGENT_VAULT = "0x120192695152B8788277e46af1412002697B9F25";

  console.log("\n--- Step 1: Deploy AgentProfile ---");
  const AgentProfile = await hre.ethers.getContractFactory("AgentProfile");
  const agentProfile = await AgentProfile.deploy(BAP578_PROXY);
  await agentProfile.waitForDeployment();
  const profileAddr = await agentProfile.getAddress();
  console.log("AgentProfile deployed to:", profileAddr);

  console.log("\n--- Step 2: Deploy AgentUpgrade ---");
  const AgentUpgrade = await hre.ethers.getContractFactory("AgentUpgrade");
  const agentUpgrade = await AgentUpgrade.deploy(JACOB_TOKEN, BAP578_PROXY);
  await agentUpgrade.waitForDeployment();
  const upgradeAddr = await agentUpgrade.getAddress();
  console.log("AgentUpgrade deployed to:", upgradeAddr);

  console.log("\n--- Step 3: Deploy ReferralRewards ---");
  const ReferralRewards = await hre.ethers.getContractFactory("ReferralRewards");
  const referralRewards = await ReferralRewards.deploy(JACOB_TOKEN);
  await referralRewards.waitForDeployment();
  const referralAddr = await referralRewards.getAddress();
  console.log("ReferralRewards deployed to:", referralAddr);

  console.log("\n--- Step 4: Deploy RevenueSharing ---");
  const RevenueSharing = await hre.ethers.getContractFactory("RevenueSharing");
  const revenueSharing = await RevenueSharing.deploy(BAP578_PROXY);
  await revenueSharing.waitForDeployment();
  const revenueAddr = await revenueSharing.getAddress();
  console.log("RevenueSharing deployed to:", revenueAddr);

  console.log("\n--- Step 5: Deploy CompetitionManager ---");
  const CompetitionManager = await hre.ethers.getContractFactory("CompetitionManager");
  const competitionManager = await CompetitionManager.deploy(BAP578_PROXY, revenueAddr);
  await competitionManager.waitForDeployment();
  const compAddr = await competitionManager.getAddress();
  console.log("CompetitionManager deployed to:", compAddr);

  console.log("\n--- Step 6: Whitelist AgentUpgrade on JacobToken ---");
  const jacobToken = await hre.ethers.getContractAt("JacobToken", JACOB_TOKEN);
  const whitelistTx = await jacobToken.setWhitelist(upgradeAddr, true);
  await whitelistTx.wait();
  console.log("AgentUpgrade whitelisted on JacobToken");

  console.log("\n--- Step 7: Set AgentUpgrade as upgrader on BAP578NFA ---");
  const bap578 = await hre.ethers.getContractAt("BAP578NFA", BAP578_PROXY);
  const setUpgraderTx = await bap578.setUpgrader(upgradeAddr);
  await setUpgraderTx.wait();
  console.log("AgentUpgrade set as upgrader on BAP578NFA");

  console.log("\n--- Step 8: Wire RevenueSharing to AgentMinter ---");
  const agentMinter = await hre.ethers.getContractAt("AgentMinter", await bap578.minter());
  const setRevMinterTx = await agentMinter.setRevenueSharing(revenueAddr);
  await setRevMinterTx.wait();
  console.log("RevenueSharing set on AgentMinter");

  console.log("\n--- Step 9: Wire RevenueSharing to AgentVault ---");
  const agentVault = await hre.ethers.getContractAt("AgentVault", AGENT_VAULT);
  const setRevVaultTx = await agentVault.setRevenueSharing(revenueAddr);
  await setRevVaultTx.wait();
  console.log("RevenueSharing set on AgentVault");

  console.log("\n========================================");
  console.log("FEATURE CONTRACTS DEPLOYED SUCCESSFULLY");
  console.log("========================================");
  console.log("AgentProfile:      ", profileAddr);
  console.log("AgentUpgrade:      ", upgradeAddr);
  console.log("ReferralRewards:   ", referralAddr);
  console.log("RevenueSharing:    ", revenueAddr);
  console.log("CompetitionManager:", compAddr);
  console.log("========================================");
  console.log("\nRevenue Streams (60% owner / 40% holders):");
  console.log("  - AgentMinter: BNB mint fees -> RevenueSharing");
  console.log("  - AgentVault:  1% swap fees  -> RevenueSharing");
  console.log("  - Competitions: 5% prize fee -> RevenueSharing");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
