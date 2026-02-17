const hre = require("hardhat");

const JACOB_TOKEN = "0x9d2a35f82cf36777A73a721f7cb22e5F86acc318";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const LP_PAIR = "0x1EED76a091e4E02aaEb6879590eeF53F27E9c520";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

const ROUTER_ABI = [
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external",
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)"
];

const PAIR_ABI = [
  "function getReserves() external view returns (uint112, uint112, uint32)",
  "function token0() external view returns (address)",
  "function balanceOf(address) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const jacobToken = new hre.ethers.Contract(JACOB_TOKEN, ERC20_ABI, deployer);
  const router = new hre.ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, deployer);
  const pair = new hre.ethers.Contract(LP_PAIR, PAIR_ABI, deployer);

  const jacobBalance = await jacobToken.balanceOf(deployer.address);
  const bnbBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("JACOB balance:", hre.ethers.formatEther(jacobBalance));
  console.log("BNB balance:", hre.ethers.formatEther(bnbBalance));

  const [reserve0, reserve1] = await pair.getReserves();
  const token0 = await pair.token0();
  let jacobReserve, bnbReserve;
  if (token0.toLowerCase() === JACOB_TOKEN.toLowerCase()) {
    jacobReserve = reserve0;
    bnbReserve = reserve1;
  } else {
    jacobReserve = reserve1;
    bnbReserve = reserve0;
  }
  console.log("\nCurrent LP: " + hre.ethers.formatEther(jacobReserve) + " JACOB / " + hre.ethers.formatEther(bnbReserve) + " BNB");

  const halfJacob = jacobBalance / 2n;
  const otherHalf = jacobBalance - halfJacob;
  console.log("\n=== PLAN ===");
  console.log("Step 1: Sell " + hre.ethers.formatEther(halfJacob) + " JACOB for BNB");
  console.log("Step 2: Add " + hre.ethers.formatEther(otherHalf) + " JACOB + received BNB as LP");
  console.log("Step 3: Burn ALL LP tokens (old + new) to dead address");

  console.log("\n--- Step 1: Approve router for swap ---");
  let tx = await jacobToken.approve(PANCAKE_ROUTER, jacobBalance, { gasLimit: 100000n });
  await tx.wait();
  console.log("Approved router for", hre.ethers.formatEther(jacobBalance), "JACOB");

  console.log("\n--- Step 2: Swap half JACOB for BNB ---");
  const bnbBefore = await hre.ethers.provider.getBalance(deployer.address);
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const path = [JACOB_TOKEN, WBNB];

  tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
    halfJacob,
    0,
    path,
    deployer.address,
    deadline,
    { gasLimit: 300000n }
  );
  const swapReceipt = await tx.wait();
  const bnbAfter = await hre.ethers.provider.getBalance(deployer.address);
  const gasUsed = swapReceipt.gasUsed * swapReceipt.gasPrice;
  const bnbReceived = bnbAfter - bnbBefore + gasUsed;
  console.log("Received:", hre.ethers.formatEther(bnbReceived), "BNB from swap");
  console.log("BNB balance now:", hre.ethers.formatEther(bnbAfter));

  console.log("\n--- Step 3: Add liquidity ---");
  const gasReserve = hre.ethers.parseEther("0.003");
  const bnbForLP = bnbAfter - gasReserve;
  if (bnbForLP <= 0n) {
    console.error("Not enough BNB after swap (need gas reserve). Aborting LP add.");
    process.exit(1);
  }
  console.log("Adding:", hre.ethers.formatEther(otherHalf), "JACOB +", hre.ethers.formatEther(bnbForLP), "BNB");
  console.log("(Reserving", hre.ethers.formatEther(gasReserve), "BNB for gas)");

  tx = await router.addLiquidityETH(
    JACOB_TOKEN,
    otherHalf,
    0,
    0,
    deployer.address,
    deadline,
    { value: bnbForLP, gasLimit: 400000n }
  );
  const lpReceipt = await tx.wait();
  console.log("Liquidity added! TX:", lpReceipt.hash);

  const lpBalance = await pair.balanceOf(deployer.address);
  console.log("\nLP tokens held by deployer:", hre.ethers.formatEther(lpBalance));

  console.log("\n========================================");
  console.log("SWAP-AND-LIQUIFY COMPLETE");
  console.log("========================================");

  const [newReserve0, newReserve1] = await pair.getReserves();
  let newJacobRes, newBnbRes;
  if (token0.toLowerCase() === JACOB_TOKEN.toLowerCase()) {
    newJacobRes = newReserve0;
    newBnbRes = newReserve1;
  } else {
    newJacobRes = newReserve1;
    newBnbRes = newReserve0;
  }

  const totalSupply = await jacobToken.totalSupply();
  const lpPct = (Number(newJacobRes) * 100 / Number(totalSupply)).toFixed(2);

  console.log("New LP: " + hre.ethers.formatEther(newJacobRes) + " JACOB / " + hre.ethers.formatEther(newBnbRes) + " BNB");
  console.log("LP ratio: " + lpPct + "% of supply");
  console.log("LP tokens held by deployer:", hre.ethers.formatEther(await pair.balanceOf(deployer.address)));
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
