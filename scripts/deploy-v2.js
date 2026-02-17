const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying V2 contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB");

  const BAP578_PROXY = "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE";
  const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  const AGENT_VAULT = "0x120192695152B8788277e46af1412002697B9F25";

  console.log("\n--- Step 1: Deploy JacobTokenV2 (100:1 NFT ratio) ---");
  console.log("Using standard deployment (no CREATE2) for easy BscScan verification");
  const JacobTokenV2 = await hre.ethers.getContractFactory("JacobTokenV2");
  const jacobV2 = await JacobTokenV2.deploy(deployer.address, BAP578_PROXY);
  await jacobV2.waitForDeployment();
  const jacobV2Address = await jacobV2.getAddress();
  console.log("JacobTokenV2 deployed to:", jacobV2Address);

  console.log("\n--- Step 2: Deploy AgentMinter V3 (pointing to V2 token) ---");
  const AgentMinter = await hre.ethers.getContractFactory("AgentMinter");
  const minterV3 = await AgentMinter.deploy(jacobV2Address, BAP578_PROXY);
  await minterV3.waitForDeployment();
  const minterV3Address = await minterV3.getAddress();
  console.log("AgentMinter V3 deployed to:", minterV3Address);

  console.log("\n--- Step 3: Set AgentMinter V3 as BAP578NFA minter ---");
  const bap578Abi = ["function setMinter(address _minter) external"];
  const bap578 = new hre.ethers.Contract(BAP578_PROXY, bap578Abi, deployer);
  let tx = await bap578.setMinter(minterV3Address);
  await tx.wait();
  console.log("BAP578NFA minter set to V3:", minterV3Address);

  console.log("\n--- Step 4: Whitelist key addresses on V2 token ---");
  const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
  const whitelistAddresses = [
    deployer.address,
    minterV3Address,
    PANCAKE_ROUTER,
    AGENT_VAULT,
    DEAD_ADDRESS
  ];
  tx = await jacobV2.setWhitelistBatch(whitelistAddresses, true);
  await tx.wait();
  console.log("Whitelisted:", whitelistAddresses.length, "addresses");
  console.log("  - Deployer:", deployer.address);
  console.log("  - AgentMinter V3:", minterV3Address);
  console.log("  - PancakeSwap Router:", PANCAKE_ROUTER);
  console.log("  - AgentVault:", AGENT_VAULT);
  console.log("  - Dead Address:", DEAD_ADDRESS, "(prevents NFT minting on burn)");

  const tokenBalance = await jacobV2.balanceOf(deployer.address);
  console.log("\nDeployer token balance:", hre.ethers.formatEther(tokenBalance), "JACOB");

  console.log("\n========================================");
  console.log("V2 DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("Network: BNB Smart Chain (Chain ID 56)");
  console.log("Deployer:", deployer.address);
  console.log("JacobTokenV2:", jacobV2Address);
  console.log("AgentMinter V3:", minterV3Address);
  console.log("BAP578NFA (unchanged):", BAP578_PROXY);
  console.log("NFT Ratio: 100 tokens = 1 NFT");
  console.log("");
  console.log("Constructor Args (for BscScan verification):");
  console.log("  JacobTokenV2: [\"" + deployer.address + "\", \"" + BAP578_PROXY + "\"]");
  console.log("  AgentMinter V3: [\"" + jacobV2Address + "\", \"" + BAP578_PROXY + "\"]");
  console.log("");
  console.log("Mint Fees (default from constructor):");
  console.log("  Bronze: 0.005 BNB, Silver: 0.02 BNB, Gold: 0.1 BNB");
  console.log("  Diamond: 0.5 BNB, Black: 2 BNB");
  console.log("  (Use setMintFee() to change after deployment)");
  console.log("");
  console.log("NEXT STEPS (run in this order):");
  console.log("1. Set JACOB_V2_ADDRESS=" + jacobV2Address);
  console.log("2. Run: npx hardhat run scripts/distribute-tokens-v2.js --network bsc");
  console.log("   (sends 800k to allocation wallets, 200k stays in deployer)");
  console.log("3. Run: npx hardhat run scripts/setup-liquidity-v2.js --network bsc");
  console.log("   (adds 125k JACOB + 1 BNB to PancakeSwap, burns LP, 75k remains as reserve)");
  console.log("4. Run: npx hardhat run scripts/verify-v2.js --network bsc");
  console.log("   (verifies contracts on BscScan)");
  console.log("========================================");

  console.log("\nSave these addresses! Updating .env recommendation:");
  console.log("JACOB_V2_ADDRESS=" + jacobV2Address);
  console.log("AGENT_MINTER_V3_ADDRESS=" + minterV3Address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
