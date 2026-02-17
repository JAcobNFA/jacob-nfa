const hre = require("hardhat");

const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

const FACTORY_ABI = [
  "function createPair(address tokenA, address tokenB) external returns (address pair)",
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

const ROUTER_ABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)"
];

const PAIR_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function totalSupply() external view returns (uint256)"
];

const TOKEN_ABI = [
  "function setWhitelist(address account, bool status) external",
  "function whitelisted(address account) external view returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

async function main() {
  const JACOB_V2 = process.env.JACOB_V2_ADDRESS;
  if (!JACOB_V2) {
    console.error("Set JACOB_V2_ADDRESS environment variable");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Setting up V2 liquidity with account:", deployer.address);

  const LIQUIDITY_JACOB_AMOUNT = hre.ethers.parseEther("125000");
  const bnbAmount = hre.ethers.parseEther(process.env.LIQUIDITY_BNB_AMOUNT || "1");

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("BNB Balance:", hre.ethers.formatEther(balance), "BNB");

  const jacobToken = new hre.ethers.Contract(JACOB_V2, TOKEN_ABI, deployer);
  const jacobBalance = await jacobToken.balanceOf(deployer.address);
  console.log("JACOB V2 Balance:", hre.ethers.formatEther(jacobBalance), "JACOB");

  if (jacobBalance < LIQUIDITY_JACOB_AMOUNT) {
    console.error("Insufficient JACOB V2 tokens. Need 125,000 JACOB.");
    process.exit(1);
  }

  const factory = new hre.ethers.Contract(PANCAKE_FACTORY, FACTORY_ABI, deployer);
  const router = new hre.ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, deployer);

  console.log("\n--- Step 1: Check/Create PancakeSwap V2 Pair ---");
  let pairAddress = await factory.getPair(JACOB_V2, WBNB);

  if (pairAddress === "0x0000000000000000000000000000000000000000") {
    console.log("Creating JACOB V2/WBNB pair...");
    const createTx = await factory.createPair(JACOB_V2, WBNB);
    const createReceipt = await createTx.wait();
    console.log("Create pair TX confirmed:", createReceipt.hash);
    await new Promise(r => setTimeout(r, 5000));
    pairAddress = await factory.getPair(JACOB_V2, WBNB);
    if (pairAddress === "0x0000000000000000000000000000000000000000") {
      console.error("FATAL: Pair creation failed. Aborting.");
      process.exit(1);
    }
    console.log("Pair created at:", pairAddress);
  } else {
    console.log("Pair already exists at:", pairAddress);
  }

  console.log("\n--- Step 2: Whitelist PancakeSwap Pair ---");
  const isPairWhitelisted = await jacobToken.whitelisted(pairAddress);
  if (!isPairWhitelisted) {
    const whitelistTx = await jacobToken.setWhitelist(pairAddress, true);
    await whitelistTx.wait();
    console.log("PancakeSwap pair whitelisted");
  } else {
    console.log("Pair already whitelisted");
  }

  console.log("\n--- Step 3: Approve Router ---");
  const approveTx = await jacobToken.approve(PANCAKE_ROUTER, LIQUIDITY_JACOB_AMOUNT);
  await approveTx.wait();
  console.log("Router approved for", hre.ethers.formatEther(LIQUIDITY_JACOB_AMOUNT), "JACOB");

  console.log("\n--- Step 4: Add Liquidity ---");
  console.log("Adding:", hre.ethers.formatEther(LIQUIDITY_JACOB_AMOUNT), "JACOB +", hre.ethers.formatEther(bnbAmount), "BNB");

  const deadline = Math.floor(Date.now() / 1000) + 600;
  const slippageBps = BigInt(process.env.SLIPPAGE_BPS || "200");
  const amountTokenMin = LIQUIDITY_JACOB_AMOUNT - (LIQUIDITY_JACOB_AMOUNT * slippageBps / 10000n);
  const amountETHMin = bnbAmount - (bnbAmount * slippageBps / 10000n);

  const addLiqTx = await router.addLiquidityETH(
    JACOB_V2,
    LIQUIDITY_JACOB_AMOUNT,
    amountTokenMin,
    amountETHMin,
    deployer.address,
    deadline,
    { value: bnbAmount }
  );
  const receipt = await addLiqTx.wait();
  console.log("Liquidity added! Tx:", receipt.hash);

  console.log("\n--- Step 5: LP Token Status ---");
  const pair = new hre.ethers.Contract(pairAddress, PAIR_ABI, deployer);
  const lpBalance = await pair.balanceOf(deployer.address);
  console.log("LP tokens received:", hre.ethers.formatEther(lpBalance));
  console.log("LP tokens kept in deployer wallet for testing (NOT burned yet)");

  const initialPrice = Number(hre.ethers.formatEther(bnbAmount)) / Number(hre.ethers.formatEther(LIQUIDITY_JACOB_AMOUNT));
  console.log("\n========================================");
  console.log("V2 LIQUIDITY SETUP COMPLETE");
  console.log("========================================");
  console.log("JacobTokenV2:", JACOB_V2);
  console.log("PancakeSwap Pair:", pairAddress);
  console.log("Liquidity:", hre.ethers.formatEther(LIQUIDITY_JACOB_AMOUNT), "JACOB +", hre.ethers.formatEther(bnbAmount), "BNB");
  console.log("Initial Price: 1 JACOB =", initialPrice.toFixed(10), "BNB");
  console.log("LP Tokens:", hre.ethers.formatEther(lpBalance), "(held in deployer - NOT burned)");
  console.log("");
  console.log("IMPORTANT: LP tokens are NOT burned yet!");
  console.log("Run tests first, then burn LP with:");
  console.log("  npx hardhat run scripts/burn-lp.js --network bsc");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
