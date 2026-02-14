const hre = require("hardhat");

const JACOB_TOKEN = "0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b";

const VESTING_ALLOCATIONS = {
  team: {
    name: "Team",
    tokens: "100000",
    cliffMonths: 12,
    vestingMonths: 24,
  },
  agentCreation: {
    name: "Agent Creation Treasury",
    tokens: "200000",
    cliffMonths: 3,
    vestingMonths: 12,
  },
  ecosystem: {
    name: "Ecosystem Development",
    tokens: "150000",
    cliffMonths: 3,
    vestingMonths: 18,
  },
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying TokenVesting with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("BNB Balance:", hre.ethers.formatEther(balance), "BNB\n");

  console.log("--- Step 1: Deploy TokenVesting Contract ---");
  const TokenVesting = await hre.ethers.getContractFactory("TokenVesting");
  const vesting = await TokenVesting.deploy(JACOB_TOKEN);
  await vesting.waitForDeployment();
  const vestingAddress = await vesting.getAddress();
  console.log("TokenVesting deployed at:", vestingAddress);

  console.log("\n--- Step 2: Transfer JACOB tokens to vesting contract ---");
  const tokenABI = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
  ];
  const jacobToken = new hre.ethers.Contract(JACOB_TOKEN, tokenABI, deployer);

  let totalVestingTokens = 0n;
  for (const [key, alloc] of Object.entries(VESTING_ALLOCATIONS)) {
    totalVestingTokens += hre.ethers.parseEther(alloc.tokens);
  }
  console.log("Total tokens to vest:", hre.ethers.formatEther(totalVestingTokens), "JACOB");

  const deployerBalance = await jacobToken.balanceOf(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(deployerBalance), "JACOB");

  if (deployerBalance < totalVestingTokens) {
    console.error("Insufficient JACOB tokens for vesting!");
    process.exit(1);
  }

  const transferTx = await jacobToken.transfer(vestingAddress, totalVestingTokens);
  await transferTx.wait();
  console.log("Transferred", hre.ethers.formatEther(totalVestingTokens), "JACOB to vesting contract");

  console.log("\n--- Step 3: Create Vesting Schedules ---");

  const MONTH = 30 * 24 * 60 * 60;

  for (const [key, alloc] of Object.entries(VESTING_ALLOCATIONS)) {
    const walletEnvVar = `VESTING_WALLET_${key.toUpperCase()}`;
    const beneficiary = process.env[walletEnvVar] || deployer.address;

    const amount = hre.ethers.parseEther(alloc.tokens);
    const cliffDuration = alloc.cliffMonths * MONTH;
    const vestingDuration = alloc.vestingMonths * MONTH;

    console.log(`\n  ${alloc.name}:`);
    console.log(`    Beneficiary: ${beneficiary}`);
    console.log(`    Amount: ${alloc.tokens} JACOB`);
    console.log(`    Cliff: ${alloc.cliffMonths} months`);
    console.log(`    Vesting: ${alloc.vestingMonths} months (linear after cliff)`);

    const createTx = await vesting.createVesting(
      beneficiary,
      amount,
      cliffDuration,
      vestingDuration
    );
    await createTx.wait();
    console.log(`    Created!`);
  }

  console.log("\n--- Step 4: Verify Vesting Schedules ---");
  const count = await vesting.getBeneficiaryCount();
  console.log("Total beneficiaries:", count.toString());

  for (const [key, alloc] of Object.entries(VESTING_ALLOCATIONS)) {
    const walletEnvVar = `VESTING_WALLET_${key.toUpperCase()}`;
    const beneficiary = process.env[walletEnvVar] || deployer.address;
    const info = await vesting.getVestingInfo(beneficiary);
    console.log(`\n  ${alloc.name} (${beneficiary}):`);
    console.log(`    Total: ${hre.ethers.formatEther(info[0])} JACOB`);
    console.log(`    Released: ${hre.ethers.formatEther(info[1])} JACOB`);
    console.log(`    Releasable now: ${hre.ethers.formatEther(info[2])} JACOB`);
    console.log(`    Cliff ends: ${new Date(Number(info[4]) * 1000).toISOString()}`);
    console.log(`    Fully vested: ${new Date(Number(info[5]) * 1000).toISOString()}`);
  }

  const vestingBalance = await jacobToken.balanceOf(vestingAddress);
  const deployerRemaining = await jacobToken.balanceOf(deployer.address);

  console.log("\n========================================");
  console.log("TOKEN VESTING DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("Vesting Contract:", vestingAddress);
  console.log("Token:", JACOB_TOKEN);
  console.log("Tokens locked in vesting:", hre.ethers.formatEther(vestingBalance), "JACOB");
  console.log("Deployer remaining:", hre.ethers.formatEther(deployerRemaining), "JACOB");
  console.log("");
  console.log("Vesting Schedules:");
  for (const [key, alloc] of Object.entries(VESTING_ALLOCATIONS)) {
    console.log(`  ${alloc.name}: ${alloc.tokens} JACOB (${alloc.cliffMonths}mo cliff + ${alloc.vestingMonths}mo vest)`);
  }
  console.log("");
  console.log("Remaining deployer tokens:");
  console.log("  250,000 JACOB - Liquidity Pool (to be paired with BNB)");
  console.log("  200,000 JACOB - Agent Operations Fund (unlocked for vault funding)");
  console.log("  100,000 JACOB - Community & Early Adopters (unlocked for rewards)");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
