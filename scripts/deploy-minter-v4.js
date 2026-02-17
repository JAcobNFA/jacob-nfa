const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying AgentMinterV4 with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB");

  const JACOB_TOKEN = "0x9d2a35f82cf36777A73a721f7cb22e5F86acc318";
  const BAP578_PROXY = "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE";
  const LP_PAIR = "0x1EED76a091e4E02aaEb6879590eeF53F27E9c520";
  const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

  console.log("\n--- Step 1: Deploy AgentMinterV4 ---");
  const AgentMinterV4 = await hre.ethers.getContractFactory("AgentMinterV4");
  const minter = await AgentMinterV4.deploy(JACOB_TOKEN, BAP578_PROXY, LP_PAIR, WBNB);
  await minter.waitForDeployment();
  const minterAddress = await minter.getAddress();
  console.log("AgentMinterV4 deployed to:", minterAddress);

  console.log("\n--- Step 2: Verify dynamic pricing works ---");
  try {
    const costs = await minter.getAllTierCosts();
    const tierNames = ["Bronze", "Silver", "Gold", "Diamond", "Black"];
    console.log("Dynamic JACOB burn costs:");
    for (let i = 0; i < 5; i++) {
      console.log(`  ${tierNames[i]}: ${hre.ethers.formatEther(costs.jacobCosts[i])} JACOB (${hre.ethers.formatEther(costs.bnbCosts[i])} BNB equiv, ${hre.ethers.formatEther(costs.bnbFees[i])} BNB fee)`);
    }
    const price = await minter.getCurrentPrice();
    console.log(`  Current rate: ${hre.ethers.formatEther(price)} JACOB per BNB`);
  } catch (e) {
    console.log("Warning: Could not read dynamic costs:", e.message);
  }

  console.log("\n--- Step 3: Copy settings from old minter ---");
  const OLD_MINTER = "0x94D146c2CDdD1A0fa8C931D625fbc4F1Eff4c9Ee";
  const oldMinter = new hre.ethers.Contract(OLD_MINTER, [
    "function revenueSharing() view returns (address)",
    "function officialBAP578() view returns (address)",
    "function agentLogicAddress() view returns (address)",
    "function baseMetadataURI() view returns (string)",
    "function officialRegistrationEnabled() view returns (bool)",
    "function totalMinted() view returns (uint256)",
    "function totalTokensBurned() view returns (uint256)"
  ], deployer);

  try {
    const revSharing = await oldMinter.revenueSharing();
    if (revSharing !== hre.ethers.ZeroAddress) {
      const tx1 = await minter.setRevenueSharing(revSharing);
      await tx1.wait();
      console.log("  RevenueSharing set to:", revSharing);
    }

    const officialBap = await oldMinter.officialBAP578();
    if (officialBap !== hre.ethers.ZeroAddress) {
      const tx2 = await minter.setOfficialBAP578(officialBap);
      await tx2.wait();
      console.log("  OfficialBAP578 set to:", officialBap);
    }

    const logicAddr = await oldMinter.agentLogicAddress();
    if (logicAddr !== hre.ethers.ZeroAddress) {
      const tx3 = await minter.setAgentLogicAddress(logicAddr);
      await tx3.wait();
      console.log("  AgentLogicAddress set to:", logicAddr);
    }

    const baseURI = await oldMinter.baseMetadataURI();
    if (baseURI && baseURI.length > 0) {
      const tx4 = await minter.setBaseMetadataURI(baseURI);
      await tx4.wait();
      console.log("  BaseMetadataURI set to:", baseURI);
    }

    const regEnabled = await oldMinter.officialRegistrationEnabled();
    if (regEnabled) {
      const tx5 = await minter.setOfficialRegistrationEnabled(true);
      await tx5.wait();
      console.log("  Official registration enabled");
    }

    const oldMinted = await oldMinter.totalMinted();
    const oldBurned = await oldMinter.totalTokensBurned();
    console.log(`  Old minter stats: ${oldMinted} minted, ${hre.ethers.formatEther(oldBurned)} JACOB burned`);
  } catch (e) {
    console.log("Warning: Could not copy all old settings:", e.message);
  }

  console.log("\n--- Step 4: Swap minter on BAP578NFA ---");
  const bap578 = new hre.ethers.Contract(BAP578_PROXY, [
    "function setMinter(address _minter) external",
    "function minter() view returns (address)"
  ], deployer);

  const currentMinter = await bap578.minter();
  console.log("  Current minter:", currentMinter);

  const tx = await bap578.setMinter(minterAddress);
  await tx.wait();
  console.log("  New minter set to:", minterAddress);

  const verifyMinter = await bap578.minter();
  console.log("  Verified minter:", verifyMinter);

  console.log("\n--- Step 5: Whitelist new minter on JACOB token ---");
  const jacobToken = new hre.ethers.Contract(JACOB_TOKEN, [
    "function whitelist(address account) external",
    "function whitelisted(address account) view returns (bool)"
  ], deployer);

  try {
    const isWL = await jacobToken.whitelisted(minterAddress);
    if (!isWL) {
      const wlTx = await jacobToken.whitelist(minterAddress);
      await wlTx.wait();
      console.log("  AgentMinterV4 whitelisted on JACOB token");
    } else {
      console.log("  Already whitelisted");
    }
  } catch (e) {
    console.log("  Note: Whitelist not needed or function not available:", e.message);
  }

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("AgentMinterV4:", minterAddress);
  console.log("BAP578NFA minter updated to V4");
  console.log("\nTo verify on BscScan:");
  console.log(`AGENT_MINTER_V4_ADDRESS=${minterAddress} npx hardhat run scripts/verify-minter-v4.js --network bsc`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
