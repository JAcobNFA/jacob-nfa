const hre = require("hardhat");
const { ethers } = require("ethers");

const JACOB_TOKEN = "0x9d2a35f82cf36777A73a721f7cb22e5F86acc318";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const LP_PAIR = "0x1EED76a091e4E02aaEb6879590eeF53F27E9c520";

async function main() {
  const provider = hre.ethers.provider;
  const deployer = new hre.ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const community = new hre.ethers.Wallet(process.env.COMMUNITY_WALLET_KEY, provider);

  console.log("Deployer:", deployer.address);
  console.log("Community:", community.address);

  const jacobToken = new hre.ethers.Contract(JACOB_TOKEN, [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address, uint256) returns (bool)",
    "function approve(address, uint256) returns (bool)"
  ], community);

  const jacobAsDeployer = jacobToken.connect(deployer);

  const router = new hre.ethers.Contract(PANCAKE_ROUTER, [
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)"
  ], deployer);

  const pair = new hre.ethers.Contract(LP_PAIR, [
    "function getReserves() view returns (uint112, uint112, uint32)",
    "function token0() view returns (address)",
    "function balanceOf(address) view returns (uint256)"
  ], provider);

  const transferAmount = hre.ethers.parseEther("62000");

  // Step 1: Send gas BNB to community wallet
  const communityBnb = await provider.getBalance(community.address);
  console.log("\nCommunity BNB:", hre.ethers.formatEther(communityBnb));
  if (communityBnb < hre.ethers.parseEther("0.0005")) {
    console.log("Sending gas BNB to community wallet...");
    const tx = await deployer.sendTransaction({
      to: community.address,
      value: hre.ethers.parseEther("0.001"),
      gasLimit: 21000n
    });
    await tx.wait();
    console.log("Sent 0.001 BNB for gas");
  } else {
    console.log("Community wallet has enough BNB for gas");
  }

  // Step 2: Transfer 62,000 JACOB from community to deployer
  console.log("\nTransferring 62,000 JACOB to deployer...");
  let tx = await jacobToken.transfer(deployer.address, transferAmount, { gasLimit: 100000n });
  await tx.wait();
  console.log("Transfer complete!");

  const deployerJacob = await jacobAsDeployer.balanceOf(deployer.address);
  const deployerBnb = await provider.getBalance(deployer.address);
  console.log("\nDeployer JACOB:", hre.ethers.formatEther(deployerJacob));
  console.log("Deployer BNB:", hre.ethers.formatEther(deployerBnb));

  // Step 3: Approve router
  console.log("\nApproving router...");
  tx = await jacobAsDeployer.approve(PANCAKE_ROUTER, deployerJacob, { gasLimit: 100000n });
  await tx.wait();
  console.log("Approved");

  // Step 4: Add liquidity with all JACOB + matching BNB
  const [r0, r1] = await pair.getReserves();
  const t0 = await pair.token0();
  const isJ0 = t0.toLowerCase() === JACOB_TOKEN.toLowerCase();
  const jRes = isJ0 ? r0 : r1;
  const bRes = isJ0 ? r1 : r0;

  const bnbNeeded = (deployerJacob * bRes) / jRes;
  const gasReserve = hre.ethers.parseEther("0.003");
  const bnbAvailable = deployerBnb - gasReserve;

  let jacobToAdd, bnbToAdd;
  if (bnbNeeded <= bnbAvailable) {
    jacobToAdd = deployerJacob;
    bnbToAdd = bnbNeeded;
  } else {
    bnbToAdd = bnbAvailable;
    jacobToAdd = (bnbAvailable * jRes) / bRes;
  }

  console.log("\nAdding LP:", hre.ethers.formatEther(jacobToAdd), "JACOB +", hre.ethers.formatEther(bnbToAdd), "BNB");

  const deadline = Math.floor(Date.now() / 1000) + 600;
  tx = await router.addLiquidityETH(
    JACOB_TOKEN,
    jacobToAdd,
    0,
    0,
    deployer.address,
    deadline,
    { value: bnbToAdd, gasLimit: 400000n }
  );
  const receipt = await tx.wait();
  console.log("Liquidity added! TX:", receipt.hash);

  // Final state
  const [nr0, nr1] = await pair.getReserves();
  const njRes = isJ0 ? nr0 : nr1;
  const nbRes = isJ0 ? nr1 : nr0;
  const ts = new hre.ethers.Contract(JACOB_TOKEN, ["function totalSupply() view returns (uint256)"], provider);
  const supply = await ts.totalSupply();
  const lpBal = await pair.balanceOf(deployer.address);
  const communityJacob = await jacobToken.balanceOf(community.address);

  console.log("\n========================================");
  console.log("DONE");
  console.log("========================================");
  console.log("Pool:", hre.ethers.formatEther(njRes), "JACOB /", hre.ethers.formatEther(nbRes), "BNB");
  console.log("LP ratio:", (Number(njRes) * 100 / Number(supply)).toFixed(2) + "% of supply");
  console.log("Price: 1 BNB =", (Number(njRes) / Number(nbRes)).toFixed(2), "JACOB");
  console.log("Deployer LP tokens:", hre.ethers.formatEther(lpBal));
  console.log("Deployer JACOB left:", hre.ethers.formatEther(await jacobAsDeployer.balanceOf(deployer.address)));
  console.log("Deployer BNB left:", hre.ethers.formatEther(await provider.getBalance(deployer.address)));
  console.log("Community JACOB left:", hre.ethers.formatEther(communityJacob));
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error(error); process.exit(1); });
