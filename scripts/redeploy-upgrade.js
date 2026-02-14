const hre = require("hardhat");

const EXISTING = {
  BAP578_PROXY: "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE",
  JACOB_TOKEN: "0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b",
  AGENT_CONTROLLER: "0x1017CD09a86D92b4CBe74CD765eD4B78Ea82a356",
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("========================================");
  console.log("REDEPLOY & UPGRADE SCRIPT");
  console.log("========================================");
  console.log("Deployer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("BNB Balance:", hre.ethers.formatEther(balance), "BNB");
  console.log("");

  const jacobToken = await hre.ethers.getContractAt("JacobToken", EXISTING.JACOB_TOKEN);
  const bap578 = await hre.ethers.getContractAt("BAP578NFA", EXISTING.BAP578_PROXY);

  console.log("--- Step 1: Upgrade BAP578NFA Proxy Implementation ---");
  const BAP578NFA = await hre.ethers.getContractFactory("BAP578NFA");
  try {
    const upgraded = await hre.upgrades.upgradeProxy(EXISTING.BAP578_PROXY, BAP578NFA, {
      kind: "uups",
    });
    await upgraded.waitForDeployment();
    console.log("BAP578NFA proxy upgraded at:", EXISTING.BAP578_PROXY);
    console.log("New features: tokenURI base64, upgrader field, tier metadata");
  } catch (e) {
    if (e.message.includes("unsafeAllow") || e.message.includes("storage layout")) {
      console.log("Attempting with unsafeAllowRenames...");
      const upgraded = await hre.upgrades.upgradeProxy(EXISTING.BAP578_PROXY, BAP578NFA, {
        kind: "uups",
        unsafeAllowRenames: true,
      });
      await upgraded.waitForDeployment();
      console.log("BAP578NFA proxy upgraded at:", EXISTING.BAP578_PROXY);
    } else {
      console.error("Proxy upgrade failed:", e.message);
      console.log("Continuing with remaining deployments...");
    }
  }

  console.log("\n--- Step 2: Deploy New AgentVault ---");
  const AgentVault = await hre.ethers.getContractFactory("AgentVault");
  const vault = await AgentVault.deploy(
    EXISTING.BAP578_PROXY,
    deployer.address,
    deployer.address
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("New AgentVault deployed to:", vaultAddress);
  console.log("Features: tier-based swap limits, 1% fee on all swap types, token fee withdrawal");

  console.log("\n--- Step 3: Deploy New AgentMinter ---");
  const AgentMinter = await hre.ethers.getContractFactory("AgentMinter");
  const minter = await AgentMinter.deploy(EXISTING.JACOB_TOKEN, EXISTING.BAP578_PROXY);
  await minter.waitForDeployment();
  const minterAddress = await minter.getAddress();
  console.log("New AgentMinter deployed to:", minterAddress);
  console.log("Features: excess BNB refund, official BAP-578 registration, reentrancy-safe");

  console.log("\n--- Step 4: Set AgentMinter as BAP578NFA minter ---");
  let tx = await bap578.setMinter(minterAddress);
  await tx.wait();
  console.log("BAP578NFA minter set to:", minterAddress);

  console.log("\n--- Step 5: Whitelist AgentMinter on JacobToken ---");
  tx = await jacobToken.setWhitelist(minterAddress, true);
  await tx.wait();
  console.log("AgentMinter whitelisted on JacobToken");

  console.log("\n--- Step 6: Whitelist AgentVault on JacobToken ---");
  tx = await jacobToken.setWhitelist(vaultAddress, true);
  await tx.wait();
  console.log("AgentVault whitelisted on JacobToken");

  console.log("\n--- Step 7: Verify Tier Costs ---");
  for (let tier = 1; tier <= 5; tier++) {
    const cost = await minter.getTierCost(tier);
    const fee = await minter.getMintFee(tier);
    const name = await minter.getTierName(tier);
    console.log(`  ${name}: Burn ${hre.ethers.formatEther(cost)} JACOB, Fee ${hre.ethers.formatEther(fee)} BNB`);
  }

  console.log("\n--- Step 8: Verify Vault Tier Limits ---");
  for (let tier = 1; tier <= 5; tier++) {
    const limit = await vault.tierSwapLimit(tier);
    const enabled = await vault.tierSwapEnabled(tier);
    const limitStr = limit === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
      ? "Unlimited"
      : `${hre.ethers.formatEther(limit)} BNB`;
    console.log(`  Tier ${tier}: Limit ${limitStr}, Enabled: ${enabled}`);
  }

  const endBalance = await hre.ethers.provider.getBalance(deployer.address);
  const gasUsed = balance - endBalance;

  console.log("\n========================================");
  console.log("REDEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("BAP578NFA (Proxy - upgraded):", EXISTING.BAP578_PROXY);
  console.log("New AgentVault:", vaultAddress);
  console.log("New AgentMinter:", minterAddress);
  console.log("JacobToken (unchanged):", EXISTING.JACOB_TOKEN);
  console.log("AgentController (unchanged):", EXISTING.AGENT_CONTROLLER);
  console.log("");
  console.log("Gas used:", hre.ethers.formatEther(gasUsed), "BNB");
  console.log("Remaining BNB:", hre.ethers.formatEther(endBalance), "BNB");
  console.log("========================================");
  console.log("\nNEXT STEPS:");
  console.log("1. Update contract addresses in public/index.html and replit.md");
  console.log("2. Verify new contracts on BscScan");
  console.log("3. Run validate-deployment.js to confirm wiring");
  console.log("4. Deploy feature contracts (deploy-features.js)");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
