const hre = require("hardhat");

const BAP578_PROXY = "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE";
const ERC1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function getImplementationAddress(proxyAddress) {
  const raw = await hre.ethers.provider.getStorage(proxyAddress, ERC1967_IMPL_SLOT);
  return "0x" + raw.slice(26);
}

async function main() {
  console.log("Starting contract verification on BscScan...\n");

  const implAddress = await getImplementationAddress(BAP578_PROXY);
  console.log("BAP578NFA proxy:", BAP578_PROXY);
  console.log("BAP578NFA implementation (auto-detected):", implAddress, "\n");

  const contracts = [
    {
      name: "AgentController",
      address: "0x1017CD09a86D92b4CBe74CD765eD4B78Ea82a356",
      constructorArgs: [],
      contract: "contracts/AgentController.sol:AgentController",
    },
    {
      name: "BAP578NFA (Implementation)",
      address: implAddress,
      constructorArgs: [],
      contract: "contracts/BAP578NFA.sol:BAP578NFA",
    },
    {
      name: "JacobToken",
      address: "0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b",
      constructorArgs: ["0xA5d096Dcd19e14D36B8F52b4A6a0abB8b362cdBC", BAP578_PROXY],
      contract: "contracts/JacobToken.sol:JacobToken",
    },
    {
      name: "AgentVault",
      address: "0xc9Bb89E036BD17F8E5016C89D0B6104F8912ac8A",
      constructorArgs: [
        BAP578_PROXY,
        "0xA5d096Dcd19e14D36B8F52b4A6a0abB8b362cdBC",
        "0xA5d096Dcd19e14D36B8F52b4A6a0abB8b362cdBC",
      ],
      contract: "contracts/AgentVault.sol:AgentVault",
    },
  ];

  for (const info of contracts) {
    console.log(`--- Verifying ${info.name} at ${info.address} ---`);
    try {
      await hre.run("verify:verify", {
        address: info.address,
        constructorArguments: info.constructorArgs,
        contract: info.contract,
      });
      console.log(`${info.name} verified successfully!\n`);
    } catch (err) {
      if (err.message.includes("Already Verified") || err.message.includes("already verified")) {
        console.log(`${info.name} is already verified.\n`);
      } else {
        console.error(`${info.name} verification failed: ${err.message}\n`);
      }
    }
  }

  console.log("========================================");
  console.log("Verification complete!");
  console.log("View contracts on BscScan:");
  console.log("AgentController: https://bscscan.com/address/0x1017CD09a86D92b4CBe74CD765eD4B78Ea82a356#code");
  console.log("BAP578NFA Proxy: https://bscscan.com/address/" + BAP578_PROXY + "#code");
  console.log("BAP578NFA Impl:  https://bscscan.com/address/" + implAddress + "#code");
  console.log("JacobToken:      https://bscscan.com/address/0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b#code");
  console.log("AgentVault:      https://bscscan.com/address/0xc9Bb89E036BD17F8E5016C89D0B6104F8912ac8A#code");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
