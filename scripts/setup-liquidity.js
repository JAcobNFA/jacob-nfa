const hre = require("hardhat");

const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

const JACOB_TOKEN = "0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b";

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

const FACTORY_ABI = [
  "function createPair(address tokenA, address tokenB) external returns (address pair)",
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

const ROUTER_ABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
  "function factory() external view returns (address)"
];

const PAIR_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function totalSupply() external view returns (uint256)"
];

const JACOB_TOKEN_ABI = [
  "function setWhitelist(address account, bool status) external",
  "function whitelisted(address account) external view returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Setting up liquidity with account:", deployer.address);

  const LIQUIDITY_JACOB_AMOUNT = hre.ethers.parseEther("250000");

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("BNB Balance:", hre.ethers.formatEther(balance), "BNB");

  const jacobToken = new hre.ethers.Contract(JACOB_TOKEN, JACOB_TOKEN_ABI, deployer);
  const jacobBalance = await jacobToken.balanceOf(deployer.address);
  console.log("JACOB Balance:", hre.ethers.formatEther(jacobBalance), "JACOB");

  if (jacobBalance < LIQUIDITY_JACOB_AMOUNT) {
    console.error("Insufficient JACOB tokens for liquidity. Need 250,000 JACOB.");
    process.exit(1);
  }

  const factory = new hre.ethers.Contract(PANCAKE_FACTORY, FACTORY_ABI, deployer);
  const router = new hre.ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, deployer);

  console.log("\n--- Step 1: Check/Create PancakeSwap Pair ---");
  let pairAddress = await factory.getPair(JACOB_TOKEN, WBNB);

  if (pairAddress === "0x0000000000000000000000000000000000000000") {
    console.log("Creating JACOB/WBNB pair...");
    const createTx = await factory.createPair(JACOB_TOKEN, WBNB);
    await createTx.wait();
    pairAddress = await factory.getPair(JACOB_TOKEN, WBNB);
    console.log("Pair created at:", pairAddress);
  } else {
    console.log("Pair already exists at:", pairAddress);
  }

  console.log("\n--- Step 2: Whitelist PancakeSwap Pair & Router ---");
  const isPairWhitelisted = await jacobToken.whitelisted(pairAddress);
  if (!isPairWhitelisted) {
    const whitelistTx = await jacobToken.setWhitelist(pairAddress, true);
    await whitelistTx.wait();
    console.log("PancakeSwap pair whitelisted");
  } else {
    console.log("Pair already whitelisted");
  }

  const isRouterWhitelisted = await jacobToken.whitelisted(PANCAKE_ROUTER);
  if (!isRouterWhitelisted) {
    const whitelistTx2 = await jacobToken.setWhitelist(PANCAKE_ROUTER, true);
    await whitelistTx2.wait();
    console.log("PancakeSwap router whitelisted");
  } else {
    console.log("Router already whitelisted");
  }

  console.log("\n--- Step 3: Approve Router to Spend JACOB ---");
  const approveTx = await jacobToken.approve(PANCAKE_ROUTER, LIQUIDITY_JACOB_AMOUNT);
  await approveTx.wait();
  console.log("Router approved for", hre.ethers.formatEther(LIQUIDITY_JACOB_AMOUNT), "JACOB");

  console.log("\n--- Step 4: Add Liquidity (JACOB + BNB) ---");
  const bnbAmount = hre.ethers.parseEther(process.env.LIQUIDITY_BNB_AMOUNT || "0.05");
  console.log("Adding liquidity:", hre.ethers.formatEther(LIQUIDITY_JACOB_AMOUNT), "JACOB +", hre.ethers.formatEther(bnbAmount), "BNB");

  const deadline = Math.floor(Date.now() / 1000) + 600;

  const slippageBps = BigInt(process.env.SLIPPAGE_BPS || "200");
  const amountTokenMin = LIQUIDITY_JACOB_AMOUNT - (LIQUIDITY_JACOB_AMOUNT * slippageBps / 10000n);
  const amountETHMin = bnbAmount - (bnbAmount * slippageBps / 10000n);

  console.log("Slippage tolerance:", Number(slippageBps) / 100, "%");

  const addLiqTx = await router.addLiquidityETH(
    JACOB_TOKEN,
    LIQUIDITY_JACOB_AMOUNT,
    amountTokenMin,
    amountETHMin,
    deployer.address,
    deadline,
    { value: bnbAmount }
  );
  const receipt = await addLiqTx.wait();
  console.log("Liquidity added! Tx hash:", receipt.hash);

  console.log("\n--- Step 5: BURN LP TOKENS (Permanent Liquidity Lock) ---");
  const pair = new hre.ethers.Contract(pairAddress, PAIR_ABI, deployer);
  const lpBalance = await pair.balanceOf(deployer.address);
  const lpTotalSupply = await pair.totalSupply();
  console.log("LP tokens received:", hre.ethers.formatEther(lpBalance));
  console.log("LP total supply:", hre.ethers.formatEther(lpTotalSupply));

  if (lpBalance > 0n) {
    console.log("Burning ALL LP tokens to dead address:", DEAD_ADDRESS);
    const burnTx = await pair.transfer(DEAD_ADDRESS, lpBalance);
    const burnReceipt = await burnTx.wait();
    console.log("LP TOKENS BURNED! Tx hash:", burnReceipt.hash);

    const remainingLp = await pair.balanceOf(deployer.address);
    const deadLp = await pair.balanceOf(DEAD_ADDRESS);
    console.log("Deployer LP balance:", hre.ethers.formatEther(remainingLp));
    console.log("Dead address LP balance:", hre.ethers.formatEther(deadLp));
    console.log("LIQUIDITY IS PERMANENTLY LOCKED - Cannot be removed");
  }

  const initialPrice = Number(hre.ethers.formatEther(bnbAmount)) / Number(hre.ethers.formatEther(LIQUIDITY_JACOB_AMOUNT));
  console.log("\n========================================");
  console.log("LIQUIDITY SETUP COMPLETE - LP BURNED");
  console.log("========================================");
  console.log("JACOB Token:", JACOB_TOKEN);
  console.log("PancakeSwap Pair:", pairAddress);
  console.log("Liquidity:", hre.ethers.formatEther(LIQUIDITY_JACOB_AMOUNT), "JACOB +", hre.ethers.formatEther(bnbAmount), "BNB");
  console.log("Initial Price: 1 JACOB =", initialPrice.toFixed(10), "BNB");
  console.log("LP Tokens: BURNED to", DEAD_ADDRESS);
  console.log("Liquidity: PERMANENTLY LOCKED (cannot be rugged)");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
