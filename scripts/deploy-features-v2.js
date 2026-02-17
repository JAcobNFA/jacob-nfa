const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying feature contracts with:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "BNB");

  const JACOB_TOKEN = process.env.JACOB_V2_ADDRESS || "0x9d2a35f82cf36777A73a721f7cb22e5F86acc318";
  const BAP578_PROXY = "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE";
  const AGENT_MINTER = "0xb053397547587fE5B999881e9b5C040889dD47C6";
  const AGENT_VAULT = "0x120192695152B8788277e46af1412002697B9F25";
  const GLOBAL_REGISTRY = "0xd7deb29ddbb13607375ce50405a574ac2f7d978d";

  console.log("\nUsing addresses:");
  console.log("  JACOB Token (V2):", JACOB_TOKEN);
  console.log("  BAP578 Proxy:", BAP578_PROXY);
  console.log("  AgentMinter:", AGENT_MINTER);
  console.log("  AgentVault:", AGENT_VAULT);
  console.log("  Global Registry:", GLOBAL_REGISTRY);

  console.log("\n========================================");
  console.log("STEP 1: Deploy AgentUpgrade");
  console.log("========================================");
  const AgentUpgrade = await hre.ethers.getContractFactory("AgentUpgrade");
  const agentUpgrade = await AgentUpgrade.deploy(JACOB_TOKEN, BAP578_PROXY);
  await agentUpgrade.waitForDeployment();
  const upgradeAddr = await agentUpgrade.getAddress();
  console.log("AgentUpgrade deployed to:", upgradeAddr);

  console.log("\n========================================");
  console.log("STEP 2: Deploy ReferralRewards");
  console.log("========================================");
  const ReferralRewards = await hre.ethers.getContractFactory("ReferralRewards");
  const referralRewards = await ReferralRewards.deploy(JACOB_TOKEN);
  await referralRewards.waitForDeployment();
  const referralAddr = await referralRewards.getAddress();
  console.log("ReferralRewards deployed to:", referralAddr);

  console.log("\n========================================");
  console.log("STEP 3: Deploy RevenueSharing");
  console.log("========================================");
  const RevenueSharing = await hre.ethers.getContractFactory("RevenueSharing");
  const revenueSharing = await RevenueSharing.deploy(BAP578_PROXY);
  await revenueSharing.waitForDeployment();
  const revenueAddr = await revenueSharing.getAddress();
  console.log("RevenueSharing deployed to:", revenueAddr);

  console.log("\n========================================");
  console.log("STEP 4: Whitelist AgentUpgrade on JacobToken");
  console.log("========================================");
  const jacobToken = await hre.ethers.getContractAt("JacobToken", JACOB_TOKEN);
  const whitelistTx = await jacobToken.setWhitelist(upgradeAddr, true);
  await whitelistTx.wait();
  console.log("AgentUpgrade whitelisted on JacobToken");
  console.log("TX:", whitelistTx.hash);

  console.log("\n========================================");
  console.log("STEP 5: Set AgentUpgrade as upgrader on BAP578NFA");
  console.log("========================================");
  const bap578 = await hre.ethers.getContractAt("BAP578NFA", BAP578_PROXY);
  const setUpgraderTx = await bap578.setUpgrader(upgradeAddr);
  await setUpgraderTx.wait();
  console.log("AgentUpgrade set as upgrader on BAP578NFA");
  console.log("TX:", setUpgraderTx.hash);

  console.log("\n========================================");
  console.log("STEP 6: Wire RevenueSharing to AgentMinter");
  console.log("========================================");
  const MINTER_ABI = [
    "function setRevenueSharing(address) external",
    "function owner() view returns (address)"
  ];
  const agentMinter = new hre.ethers.Contract(AGENT_MINTER, MINTER_ABI, deployer);
  const setRevMinterTx = await agentMinter.setRevenueSharing(revenueAddr);
  await setRevMinterTx.wait();
  console.log("RevenueSharing set on AgentMinter");
  console.log("TX:", setRevMinterTx.hash);

  console.log("\n========================================");
  console.log("STEP 7: Wire RevenueSharing to AgentVault");
  console.log("========================================");
  const agentVault = await hre.ethers.getContractAt("AgentVault", AGENT_VAULT);
  const setRevVaultTx = await agentVault.setRevenueSharing(revenueAddr);
  await setRevVaultTx.wait();
  console.log("RevenueSharing set on AgentVault");
  console.log("TX:", setRevVaultTx.hash);

  console.log("\n========================================");
  console.log("STEP 8: Register AgentUpgrade on Global NFA Registry");
  console.log("========================================");
  try {
    const REGISTRY_ABI = [
      "function setUpgrader(address) external",
      "function upgrader() view returns (address)",
      "function owner() view returns (address)"
    ];
    const registry = new hre.ethers.Contract(GLOBAL_REGISTRY, REGISTRY_ABI, deployer);
    const registryOwner = await registry.owner();
    console.log("Registry owner:", registryOwner);
    if (registryOwner.toLowerCase() === deployer.address.toLowerCase()) {
      const setUpgraderRegTx = await registry.setUpgrader(upgradeAddr);
      await setUpgraderRegTx.wait();
      console.log("AgentUpgrade set as upgrader on Global Registry");
      console.log("TX:", setUpgraderRegTx.hash);
    } else {
      console.log("WARNING: Deployer is not the registry owner. Cannot set upgrader on global registry.");
      console.log("Registry owner:", registryOwner);
      console.log("Deployer:", deployer.address);
      console.log("You may need to call setUpgrader(" + upgradeAddr + ") from the registry owner wallet.");
    }
  } catch (err) {
    console.log("NOTE: Global registry may not support setUpgrader function or deployer lacks permission.");
    console.log("Error:", err.message ? err.message.substring(0, 200) : err);
    console.log("AgentUpgrade address for manual registry setup:", upgradeAddr);
  }

  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("AgentUpgrade:    ", upgradeAddr);
  console.log("ReferralRewards: ", referralAddr);
  console.log("RevenueSharing:  ", revenueAddr);
  console.log("========================================");
  console.log("\nWiring Summary:");
  console.log("  [x] AgentUpgrade whitelisted on JacobToken (can burnFrom)");
  console.log("  [x] AgentUpgrade set as upgrader on BAP578NFA (can updateAgentTier)");
  console.log("  [x] RevenueSharing wired to AgentMinter (receives mint fees)");
  console.log("  [x] RevenueSharing wired to AgentVault (receives swap fees)");
  console.log("========================================");
  console.log("\nUpdate command.js CONTRACTS object with:");
  console.log(`  agentUpgrade: '${upgradeAddr}',`);
  console.log(`  referralRewards: '${referralAddr}',`);
  console.log(`  revenueSharing: '${revenueAddr}',`);
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("DEPLOYMENT FAILED:", error);
    process.exit(1);
  });
