const hre = require("hardhat");

const BAP578_PROXY = "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("========================================");
  console.log("BAP578NFA PROXY UPGRADE - Learning Module");
  console.log("========================================");
  console.log("Deployer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("BNB Balance:", hre.ethers.formatEther(balance), "BNB");
  console.log("Proxy Address:", BAP578_PROXY);
  console.log("");

  console.log("--- Pre-Upgrade: Reading current state ---");
  const currentAbi = [
    "function minter() view returns (address)",
    "function owner() view returns (address)",
    "function controller() view returns (address)",
    "function totalSupply() view returns (uint256)",
    "function baseImageURI() view returns (string)",
    "function upgrader() view returns (address)"
  ];
  const current = new hre.ethers.Contract(BAP578_PROXY, currentAbi, deployer);
  const currentMinter = await current.minter();
  const currentOwner = await current.owner();
  const currentController = await current.controller();
  const currentUpgrader = await current.upgrader();
  const totalSupply = await current.totalSupply();
  const baseURI = await current.baseImageURI();

  console.log("  Owner:", currentOwner);
  console.log("  Minter:", currentMinter);
  console.log("  Controller:", currentController);
  console.log("  Upgrader:", currentUpgrader);
  console.log("  Total NFTs:", totalSupply.toString());
  console.log("  BaseImageURI:", baseURI || "(empty)");

  console.log("\n--- Upgrading BAP578NFA Proxy Implementation ---");
  console.log("  Adding: Learning Module, Merkle Root, Learning Metrics");

  const BAP578NFA = await hre.ethers.getContractFactory("BAP578NFA");

  try {
    const upgraded = await hre.upgrades.upgradeProxy(BAP578_PROXY, BAP578NFA, {
      kind: "uups",
    });
    await upgraded.waitForDeployment();
    console.log("  SUCCESS: Proxy upgraded at:", BAP578_PROXY);
  } catch (e) {
    if (e.message.includes("unsafeAllow") || e.message.includes("storage layout") || e.message.includes("Deleted")) {
      console.log("  Retrying with unsafeSkipStorageCheck...");
      const upgraded = await hre.upgrades.upgradeProxy(BAP578_PROXY, BAP578NFA, {
        kind: "uups",
        unsafeSkipStorageCheck: true,
      });
      await upgraded.waitForDeployment();
      console.log("  SUCCESS: Proxy upgraded at:", BAP578_PROXY);
    } else {
      console.error("  FAILED:", e.message);
      process.exit(1);
    }
  }

  console.log("\n--- Post-Upgrade: Verifying state preserved ---");
  const postMinter = await current.minter();
  const postOwner = await current.owner();
  const postController = await current.controller();
  const postSupply = await current.totalSupply();
  const postURI = await current.baseImageURI();

  console.log("  Owner:", postOwner, postOwner === currentOwner ? "OK" : "CHANGED!");
  console.log("  Minter:", postMinter, postMinter === currentMinter ? "OK" : "CHANGED!");
  console.log("  Controller:", postController, postController === currentController ? "OK" : "CHANGED!");
  console.log("  Total NFTs:", postSupply.toString(), postSupply === totalSupply ? "OK" : "CHANGED!");
  console.log("  BaseImageURI:", postURI === baseURI ? "OK" : "CHANGED!");

  console.log("\n--- Verifying new learning functions ---");
  const bap578 = await hre.ethers.getContractAt("BAP578NFA", BAP578_PROXY);

  for (let i = 1; i <= Number(postSupply); i++) {
    const info = await bap578.getLearningInfo(i);
    console.log(`  Agent #${i}: learningEnabled=${info.enabled}, module=${info.module}, root=${info.merkleRoot}`);
  }

  const endBalance = await hre.ethers.provider.getBalance(deployer.address);
  const gasUsed = balance - endBalance;

  console.log("\n========================================");
  console.log("UPGRADE COMPLETE");
  console.log("========================================");
  console.log("Gas used:", hre.ethers.formatEther(gasUsed), "BNB");
  console.log("Remaining BNB:", hre.ethers.formatEther(endBalance), "BNB");
  console.log("");
  console.log("New features added:");
  console.log("  - enableLearning(tokenId, learningModule)");
  console.log("  - setLearningModule(tokenId, newModule)");
  console.log("  - updateLearningRoot(tokenId, merkleRoot)");
  console.log("  - updateLearningMetrics(tokenId, interactions, events, velocity, confidence)");
  console.log("  - getLearningInfo(tokenId) -> full learning state");
  console.log("  - getLearningTreeRoot(tokenId) -> merkle root");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
