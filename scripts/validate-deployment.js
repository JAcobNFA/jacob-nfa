const hre = require("hardhat");

const CONTRACTS = {
  AGENT_CONTROLLER: "0x1017CD09a86D92b4CBe74CD765eD4B78Ea82a356",
  BAP578_PROXY: "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE",
  JACOB_TOKEN: "0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b",
  AGENT_VAULT: "0x2e44067C9752c3F7AF31856a43CBB8B6315457b9",
  DEPLOYER: "0xA5d096Dcd19e14D36B8F52b4A6a0abB8b362cdBC"
};

const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(msg) { console.log(`  ✅ PASS: ${msg}`); passed++; }
function fail(msg) { console.log(`  ❌ FAIL: ${msg}`); failed++; }
function warn(msg) { console.log(`  ⚠️  WARN: ${msg}`); warnings++; }

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("========================================");
  console.log("PRE-LAUNCH DEPLOYMENT VALIDATION");
  console.log("========================================");
  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);
  console.log("");

  console.log("--- 1. Contract Deployment Check ---");
  for (const [name, addr] of Object.entries(CONTRACTS)) {
    const code = await hre.ethers.provider.getCode(addr);
    if (code !== "0x") {
      pass(`${name} deployed at ${addr}`);
    } else {
      fail(`${name} NOT deployed at ${addr}`);
    }
  }

  console.log("\n--- 2. JacobToken Checks ---");
  const jacobToken = await hre.ethers.getContractAt("JacobToken", CONTRACTS.JACOB_TOKEN);

  const totalSupply = await jacobToken.totalSupply();
  console.log(`  Total Supply: ${hre.ethers.formatEther(totalSupply)} JACOB`);

  const deployerBalance = await jacobToken.balanceOf(deployer.address);
  console.log(`  Deployer Balance: ${hre.ethers.formatEther(deployerBalance)} JACOB`);

  const tokenOwner = await jacobToken.owner();
  if (tokenOwner === deployer.address) {
    pass("JacobToken owner is deployer");
  } else {
    fail(`JacobToken owner is ${tokenOwner}, expected ${deployer.address}`);
  }

  const deployerWhitelisted = await jacobToken.whitelisted(deployer.address);
  if (deployerWhitelisted) {
    pass("Deployer is whitelisted on JacobToken");
  } else {
    fail("Deployer is NOT whitelisted on JacobToken");
  }

  console.log("\n--- 3. BAP578NFA Checks ---");
  const bap578 = await hre.ethers.getContractAt("BAP578NFA", CONTRACTS.BAP578_PROXY);

  const nfaOwner = await bap578.owner();
  if (nfaOwner === deployer.address) {
    pass("BAP578NFA owner is deployer");
  } else {
    fail(`BAP578NFA owner is ${nfaOwner}, expected ${deployer.address}`);
  }

  const minter = await bap578.minter();
  if (minter !== "0x0000000000000000000000000000000000000000") {
    pass(`BAP578NFA minter set to ${minter}`);

    const minterWhitelisted = await jacobToken.whitelisted(minter);
    if (minterWhitelisted) {
      pass("AgentMinter is whitelisted on JacobToken");
    } else {
      fail("AgentMinter is NOT whitelisted on JacobToken (burnFrom will trigger unwanted NFT burns)");
    }
  } else {
    fail("BAP578NFA minter NOT set (no one can mint agents)");
  }

  const controller = await bap578.controller();
  if (controller !== "0x0000000000000000000000000000000000000000") {
    pass(`BAP578NFA controller set to ${controller}`);
  } else {
    warn("BAP578NFA controller not set");
  }

  const upgrader = await bap578.upgrader();
  if (upgrader !== "0x0000000000000000000000000000000000000000") {
    pass(`BAP578NFA upgrader set to ${upgrader}`);
  } else {
    warn("BAP578NFA upgrader not set (deploy feature contracts first)");
  }

  const pausedStatus = await bap578.pausedStatus();
  if (pausedStatus === 0n) {
    pass("BAP578NFA is NOT paused");
  } else {
    fail("BAP578NFA is PAUSED - minting blocked!");
  }

  console.log("\n--- 4. AgentMinter Checks ---");
  if (minter !== "0x0000000000000000000000000000000000000000") {
    const agentMinter = await hre.ethers.getContractAt("AgentMinter", minter);

    const minterOwner = await agentMinter.owner();
    if (minterOwner === deployer.address) {
      pass("AgentMinter owner is deployer");
    } else {
      fail(`AgentMinter owner is ${minterOwner}`);
    }

    const minterPaused = await agentMinter.paused();
    if (!minterPaused) {
      pass("AgentMinter is NOT paused");
    } else {
      fail("AgentMinter is PAUSED");
    }

    for (let tier = 1; tier <= 5; tier++) {
      const cost = await agentMinter.getTierCost(tier);
      const fee = await agentMinter.getMintFee(tier);
      const name = await agentMinter.getTierName(tier);
      console.log(`  Tier ${tier} (${name}): Burn ${hre.ethers.formatEther(cost)} JACOB, Fee ${hre.ethers.formatEther(fee)} BNB`);
    }

    const revShare = await agentMinter.revenueSharing();
    if (revShare !== "0x0000000000000000000000000000000000000000") {
      pass(`AgentMinter revenueSharing set to ${revShare}`);
    } else {
      warn("AgentMinter revenueSharing not set (40% share goes to owner as fallback)");
    }
  }

  console.log("\n--- 5. AgentVault Checks ---");
  const vault = await hre.ethers.getContractAt("AgentVault", CONTRACTS.AGENT_VAULT);

  const vaultOwner = await vault.owner();
  if (vaultOwner === deployer.address) {
    pass("AgentVault owner is deployer");
  } else {
    fail(`AgentVault owner is ${vaultOwner}`);
  }

  const vaultBap = await vault.bap578();
  if (vaultBap === CONTRACTS.BAP578_PROXY) {
    pass("AgentVault BAP578 address correct");
  } else {
    fail(`AgentVault BAP578 is ${vaultBap}, expected ${CONTRACTS.BAP578_PROXY}`);
  }

  const vaultPaused = await vault.paused();
  if (!vaultPaused) {
    pass("AgentVault is NOT paused");
  } else {
    fail("AgentVault is PAUSED");
  }

  const swapFee = await vault.swapFeePercent();
  console.log(`  Swap Fee: ${swapFee}%`);

  for (let tier = 1; tier <= 5; tier++) {
    const limit = await vault.tierSwapLimit(tier);
    const enabled = await vault.tierSwapEnabled(tier);
    const limitStr = limit === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") ? "Unlimited" : `${hre.ethers.formatEther(limit)} BNB`;
    console.log(`  Tier ${tier}: Limit ${limitStr}, Enabled: ${enabled}`);
  }

  console.log("\n--- 6. PancakeSwap Liquidity Check ---");
  const factoryAbi = ["function getPair(address, address) view returns (address)"];
  const factory = new hre.ethers.Contract(PANCAKE_FACTORY, factoryAbi, deployer);

  const pairAddress = await factory.getPair(CONTRACTS.JACOB_TOKEN, WBNB);
  if (pairAddress !== "0x0000000000000000000000000000000000000000") {
    pass(`PancakeSwap pair exists at ${pairAddress}`);

    const pairWhitelisted = await jacobToken.whitelisted(pairAddress);
    if (pairWhitelisted) {
      pass("PancakeSwap pair is whitelisted on JacobToken");
    } else {
      fail("PancakeSwap pair NOT whitelisted (transfers to/from pair will trigger NFT mints/burns - will fail)");
    }

    const routerWhitelisted = await jacobToken.whitelisted(PANCAKE_ROUTER);
    if (routerWhitelisted) {
      pass("PancakeSwap router is whitelisted on JacobToken");
    } else {
      fail("PancakeSwap router NOT whitelisted (swaps will trigger NFT mints/burns - will fail)");
    }

    const pairAbi = ["function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)"];
    const pair = new hre.ethers.Contract(pairAddress, pairAbi, deployer);
    const lpTotal = await pair.totalSupply();
    console.log(`  LP Total Supply: ${hre.ethers.formatEther(lpTotal)}`);

    const deadAddr = "0x000000000000000000000000000000000000dEaD";
    const deadLp = await pair.balanceOf(deadAddr);
    if (deadLp > 0n) {
      pass(`LP tokens burned to dead address: ${hre.ethers.formatEther(deadLp)}`);
    } else {
      warn("No LP tokens burned yet (run setup-liquidity.js)");
    }
  } else {
    warn("PancakeSwap pair does not exist yet (run setup-liquidity.js)");
  }

  console.log("\n--- 7. Token Balance Check ---");
  const bnbBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`  Deployer BNB: ${hre.ethers.formatEther(bnbBalance)} BNB`);
  console.log(`  Deployer JACOB: ${hre.ethers.formatEther(deployerBalance)} JACOB`);
  const totalBurned = await jacobToken.totalBurned();
  console.log(`  Total JACOB Burned: ${hre.ethers.formatEther(totalBurned)} JACOB`);
  console.log(`  Circulating Supply: ${hre.ethers.formatEther(totalSupply)} JACOB`);

  console.log("\n========================================");
  console.log("VALIDATION RESULTS");
  console.log("========================================");
  console.log(`  ✅ Passed:   ${passed}`);
  console.log(`  ❌ Failed:   ${failed}`);
  console.log(`  ⚠️  Warnings: ${warnings}`);
  console.log("========================================");

  if (failed > 0) {
    console.log("\n🚨 LAUNCH BLOCKED: Fix all FAIL items before adding liquidity!");
    process.exit(1);
  } else if (warnings > 0) {
    console.log("\n⚠️  LAUNCH POSSIBLE but review all warnings first.");
  } else {
    console.log("\n🟢 ALL CHECKS PASSED - Ready for launch!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
