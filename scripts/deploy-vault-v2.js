const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying AgentVault V2 with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const BAP578_PROXY = "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE";
  const FEE_COLLECTOR = deployer.address;
  const PROTOCOL_TREASURY = deployer.address;
  const REVENUE_SHARING = process.env.REVENUE_SHARING_ADDRESS || "0x0000000000000000000000000000000000000000";

  console.log("\n--- Deploying AgentVault V2 (with gas reimbursement + agent self-funding) ---");
  console.log("BAP578 NFA:", BAP578_PROXY);
  console.log("Fee Collector:", FEE_COLLECTOR);
  console.log("Protocol Treasury:", PROTOCOL_TREASURY);

  const AgentVault = await hre.ethers.getContractFactory("AgentVault");
  const vault = await AgentVault.deploy(BAP578_PROXY, FEE_COLLECTOR, PROTOCOL_TREASURY);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("\nAgentVault V2 deployed to:", vaultAddress);

  if (REVENUE_SHARING !== "0x0000000000000000000000000000000000000000") {
    const tx = await vault.setRevenueSharing(REVENUE_SHARING);
    await tx.wait();
    console.log("Revenue sharing set to:", REVENUE_SHARING);
  }

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("New AgentVault V2 address:", vaultAddress);
  console.log("\nNEXT STEPS:");
  console.log("1. Update AGENT_VAULT_ADDRESS in src/autoTrade/keeper.js to:", vaultAddress);
  console.log("2. Update AGENT_VAULT in src/telegram/bot.js to:", vaultAddress);
  console.log("3. Update vault address in server.js");
  console.log("4. Update scripts/validate-deployment.js AGENT_VAULT to:", vaultAddress);
  console.log("5. Set AGENT_VAULT_V2_ADDRESS env var to:", vaultAddress);
  console.log("\nNOTE: This is a NEW contract. The old vault (0xc9Bb89E036BD17F8E5016C89D0B6104F8912ac8A) remains untouched.");
  console.log("No other contracts (JACOB token, NFA, Minter) are affected.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
