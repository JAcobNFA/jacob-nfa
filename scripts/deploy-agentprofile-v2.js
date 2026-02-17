const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying new AgentProfile with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB");

  const BAP578_PROXY = "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE";

  console.log("\n--- Deploying AgentProfile (targeting current BAP578 proxy) ---");
  console.log("BAP578 Proxy:", BAP578_PROXY);

  const AgentProfile = await hre.ethers.getContractFactory("AgentProfile");
  const agentProfile = await AgentProfile.deploy(BAP578_PROXY);
  await agentProfile.waitForDeployment();
  const profileAddr = await agentProfile.getAddress();

  console.log("\n========================================");
  console.log("AgentProfile deployed to:", profileAddr);
  console.log("BAP578 reference:", BAP578_PROXY);
  console.log("========================================");
  console.log("\nVerify on BscScan:");
  console.log("https://bscscan.com/address/" + profileAddr);

  const fs = require("fs");
  fs.writeFileSync("agentprofile-address.txt", profileAddr);
  console.log("\nAddress saved to agentprofile-address.txt");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
