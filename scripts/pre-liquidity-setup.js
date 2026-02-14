const hre = require("hardhat");

const JACOB_TOKEN = "0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b";
const BAP578_PROXY = "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("================================================================");
  console.log("  PRE-LIQUIDITY SETUP");
  console.log("  Deployer:", deployer.address);
  console.log("================================================================\n");

  const jacobToken = new hre.ethers.Contract(JACOB_TOKEN, [
    "function setWhitelist(address, bool) external",
    "function whitelisted(address) view returns (bool)",
    "function owner() view returns (address)",
  ], deployer);

  const bap578 = new hre.ethers.Contract(BAP578_PROXY, [
    "function setBaseImageURI(string) external",
    "function baseImageURI() view returns (string)",
    "function owner() view returns (address)",
  ], deployer);

  console.log("=== STEP 1: Whitelist PancakeSwap Router on JacobToken ===\n");

  const alreadyWL = await jacobToken.whitelisted(PANCAKE_ROUTER);
  if (alreadyWL) {
    console.log("  PancakeSwap Router is already whitelisted. Skipping.\n");
  } else {
    console.log("  Whitelisting PancakeSwap Router V2...");
    const tx1 = await jacobToken.setWhitelist(PANCAKE_ROUTER, true);
    console.log("  TX:", tx1.hash);
    await tx1.wait();

    console.log("  ✅ PancakeSwap Router whitelisted successfully!\n");
  }

  console.log("=== STEP 2: Set baseImageURI on BAP578NFA ===\n");

  const domain = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "";
  const baseImageURI = `https://${domain}/images/`;

  console.log(`  Setting baseImageURI to: ${baseImageURI}`);
  const currentURI = await bap578.baseImageURI();
  if (currentURI === baseImageURI) {
    console.log("  BaseImageURI already set correctly. Skipping.\n");
  } else {
    const tx2 = await bap578.setBaseImageURI(baseImageURI);
    console.log("  TX:", tx2.hash);
    await tx2.wait();

    console.log("  ✅ baseImageURI set successfully!\n");
  }

  console.log("================================================================");
  console.log("  PRE-LIQUIDITY SETUP COMPLETE");
  console.log("  ✅ PancakeSwap Router whitelisted");
  console.log("  ✅ NFT image URI configured");
  console.log("  Next: Run verify.js then setup-liquidity.js");
  console.log("================================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
