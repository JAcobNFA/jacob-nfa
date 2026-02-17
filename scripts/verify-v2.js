const hre = require("hardhat");

const BAP578_PROXY = "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE";

async function main() {
  const JACOB_V2 = process.env.JACOB_V2_ADDRESS;
  const MINTER_V3 = process.env.AGENT_MINTER_V3_ADDRESS;

  if (!JACOB_V2 || !MINTER_V3) {
    console.error("Set both JACOB_V2_ADDRESS and AGENT_MINTER_V3_ADDRESS environment variables");
    console.error("These are printed at the end of deploy-v2.js output");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  const DEPLOYER = deployer.address;

  console.log("Starting V2 contract verification on BscScan...\n");
  console.log("JacobTokenV2:", JACOB_V2);
  console.log("AgentMinter V3:", MINTER_V3);
  console.log("Deployer (from private key):", DEPLOYER);
  console.log("BAP578NFA Proxy:", BAP578_PROXY);
  console.log("");

  const contracts = [
    {
      name: "JacobTokenV2",
      address: JACOB_V2,
      constructorArgs: [DEPLOYER, BAP578_PROXY],
      contract: "contracts/JacobTokenV2.sol:JacobTokenV2",
    },
    {
      name: "AgentMinter V3",
      address: MINTER_V3,
      constructorArgs: [JACOB_V2, BAP578_PROXY],
      contract: "contracts/AgentMinter.sol:AgentMinter",
    },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const info of contracts) {
    console.log(`--- Verifying ${info.name} at ${info.address} ---`);
    console.log(`Constructor args: ${JSON.stringify(info.constructorArgs)}`);
    try {
      await hre.run("verify:verify", {
        address: info.address,
        constructorArguments: info.constructorArgs,
        contract: info.contract,
      });
      console.log(`${info.name} verified successfully!\n`);
      successCount++;
    } catch (err) {
      if (err.message.includes("Already Verified") || err.message.includes("already verified")) {
        console.log(`${info.name} is already verified.\n`);
        successCount++;
      } else {
        console.error(`${info.name} verification failed: ${err.message}\n`);
        failCount++;
      }
    }
  }

  console.log("========================================");
  console.log(`Verification complete! ${successCount} succeeded, ${failCount} failed`);
  console.log("");
  console.log("View contracts on BscScan:");
  console.log(`JacobTokenV2:   https://bscscan.com/address/${JACOB_V2}#code`);
  console.log(`AgentMinter V3: https://bscscan.com/address/${MINTER_V3}#code`);
  console.log("========================================");

  if (failCount > 0) {
    console.log("\nManual verification commands (if auto-verify failed):");
    for (const info of contracts) {
      console.log(`npx hardhat verify --network bsc --contract ${info.contract} ${info.address} ${info.constructorArgs.join(" ")}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
