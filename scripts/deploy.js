const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
  const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

  console.log("\n--- Step 1: Deploy Agent Controller ---");
  const AgentController = await hre.ethers.getContractFactory("AgentController");
  const controller = await AgentController.deploy();
  await controller.waitForDeployment();
  const controllerAddress = await controller.getAddress();
  console.log("AgentController deployed to:", controllerAddress);

  console.log("\n--- Step 2: Deploy BAP-578 NFA (UUPS Proxy) ---");
  const BAP578NFA = await hre.ethers.getContractFactory("BAP578NFA");
  const bap578 = await hre.upgrades.deployProxy(
    BAP578NFA,
    ["jacob", "JACOB", deployer.address],
    { kind: "uups" }
  );
  await bap578.waitForDeployment();
  const bap578Address = await bap578.getAddress();
  console.log("BAP578NFA proxy deployed to:", bap578Address);

  console.log("\n--- Step 3: Configure BAP-578 NFA ---");
  let tx = await bap578.setController(controllerAddress);
  await tx.wait();
  console.log("Controller set to:", controllerAddress);

  console.log("\n--- Step 4: Deploy Jacob Token ---");
  const JacobToken = await hre.ethers.getContractFactory("JacobToken");
  const jacobToken = await JacobToken.deploy(deployer.address, bap578Address);
  await jacobToken.waitForDeployment();
  const jacobTokenAddress = await jacobToken.getAddress();
  console.log("JacobToken deployed to:", jacobTokenAddress);

  console.log("\n--- Step 5: Configure Jacob Token Whitelist ---");
  tx = await jacobToken.setWhitelist(deployer.address, true);
  await tx.wait();
  console.log("Deployer whitelisted on JacobToken");

  console.log("\n--- Step 6: Deploy Agent Vault ---");
  const AgentVault = await hre.ethers.getContractFactory("AgentVault");
  const vault = await AgentVault.deploy(
    bap578Address,
    deployer.address,
    deployer.address
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("AgentVault deployed to:", vaultAddress);

  console.log("\n--- Step 7: Deploy Agent Minter ---");
  const AgentMinter = await hre.ethers.getContractFactory("AgentMinter");
  const minter = await AgentMinter.deploy(jacobTokenAddress, bap578Address);
  await minter.waitForDeployment();
  const minterAddress = await minter.getAddress();
  console.log("AgentMinter deployed to:", minterAddress);

  console.log("\n--- Step 8: Set AgentMinter as BAP578NFA minter ---");
  tx = await bap578.setMinter(minterAddress);
  await tx.wait();
  console.log("BAP578NFA minter set to AgentMinter:", minterAddress);

  console.log("\n--- Step 9: Whitelist AgentMinter on JacobToken ---");
  tx = await jacobToken.setWhitelist(minterAddress, true);
  await tx.wait();
  console.log("AgentMinter whitelisted on JacobToken (no internal NFT tracking for burns)");

  console.log("\n--- Step 10: Test handleAction ---");
  const actionData = hre.ethers.toUtf8Bytes("test_action");
  const context = hre.ethers.toUtf8Bytes("test_context");

  for (let i = 1; i <= 3; i++) {
    tx = await controller.handleAction(i, actionData, context);
    const receipt = await tx.wait();
    console.log(`handleAction call ${i} - tx hash: ${receipt.hash}`);
  }

  console.log("\n========================================");
  console.log("DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log("Network: BNB Smart Chain (Chain ID 56)");
  console.log("Deployer:", deployer.address);
  console.log("AgentController:", controllerAddress);
  console.log("BAP578NFA (Proxy):", bap578Address);
  console.log("JacobToken:", jacobTokenAddress);
  console.log("AgentVault:", vaultAddress);
  console.log("AgentMinter:", minterAddress);
  console.log("PancakeSwap Router:", PANCAKE_ROUTER);
  console.log("PancakeSwap Factory:", PANCAKE_FACTORY);
  console.log("WBNB:", WBNB);
  console.log("========================================");
  console.log("\nBURN-TO-MINT TIERS:");
  console.log("  Bronze:  10 JACOB    (max 100,000 agents)");
  console.log("  Silver:  50 JACOB    (max 20,000 agents)");
  console.log("  Gold:    250 JACOB   (max 4,000 agents)");
  console.log("  Diamond: 1,000 JACOB (max 1,000 agents)");
  console.log("  Black:   10,000 JACOB (max 100 agents)");
  console.log("========================================");
  console.log("\nVAULT TIER SWAP LIMITS:");
  console.log("  Bronze:  0.1 BNB per swap");
  console.log("  Silver:  0.5 BNB per swap");
  console.log("  Gold:    2 BNB per swap");
  console.log("  Diamond: 10 BNB per swap");
  console.log("  Black:   Unlimited");
  console.log("========================================");

  return {
    controller: controllerAddress,
    bap578: bap578Address,
    jacobToken: jacobTokenAddress,
    vault: vaultAddress,
    minter: minterAddress,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
