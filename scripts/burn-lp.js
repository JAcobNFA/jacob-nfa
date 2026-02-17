const hre = require("hardhat");

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

const PAIR_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function totalSupply() external view returns (uint256)"
];

async function main() {
  const JACOB_V2 = process.env.JACOB_V2_ADDRESS;
  if (!JACOB_V2) {
    console.error("Set JACOB_V2_ADDRESS environment variable");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Burning LP tokens with account:", deployer.address);

  const factory = new hre.ethers.Contract(PANCAKE_FACTORY, FACTORY_ABI, deployer);
  const pairAddress = await factory.getPair(JACOB_V2, WBNB);

  if (pairAddress === "0x0000000000000000000000000000000000000000") {
    console.error("No JACOB/WBNB pair found. Run setup-liquidity-v2.js first.");
    process.exit(1);
  }

  console.log("PancakeSwap Pair:", pairAddress);

  const pair = new hre.ethers.Contract(pairAddress, PAIR_ABI, deployer);
  const lpBalance = await pair.balanceOf(deployer.address);
  const totalSupply = await pair.totalSupply();

  console.log("Your LP tokens:", hre.ethers.formatEther(lpBalance));
  console.log("Total LP supply:", hre.ethers.formatEther(totalSupply));

  if (lpBalance === 0n) {
    console.log("No LP tokens to burn. Already burned or not yet added.");
    process.exit(0);
  }

  const alreadyBurned = await pair.balanceOf(DEAD_ADDRESS);
  console.log("Already burned (dead address):", hre.ethers.formatEther(alreadyBurned));

  console.log("\nBurning ALL LP tokens to dead address...");
  const tx = await pair.transfer(DEAD_ADDRESS, lpBalance);
  await tx.wait();

  const newBalance = await pair.balanceOf(deployer.address);
  const deadBalance = await pair.balanceOf(DEAD_ADDRESS);

  console.log("\n========================================");
  console.log("LP TOKENS BURNED SUCCESSFULLY");
  console.log("========================================");
  console.log("TX:", tx.hash);
  console.log("Burned:", hre.ethers.formatEther(lpBalance), "LP tokens");
  console.log("Deployer LP balance:", hre.ethers.formatEther(newBalance));
  console.log("Dead address LP balance:", hre.ethers.formatEther(deadBalance));
  console.log("Liquidity is now PERMANENTLY LOCKED");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
