const hre = require("hardhat");

const JACOB_TOKEN = "0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b";

const WALLETS_TO_WHITELIST = [
  { name: "Team",                    address: "0xFe6b50eAdeC141a1c0C2aDA767483D9b61e40f12" },
  { name: "Agent Creation Treasury", address: "0xe90d963aF0Dc7A69cA92eb536E5403cb6cc1a83A" },
  { name: "Ecosystem Development",   address: "0xf1d55c24d22a4F961d276AB35c28422d61cB3B72" },
  { name: "Agent Operations Fund",   address: "0x57EEB022305563241032Bba4efC08F2c82613010" },
  { name: "Community & Airdrop",     address: "0x2a64115B9F771D89c31B90A4fBaE3107dd5B4461" },
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Whitelisting allocation wallets on JacobToken...");
  console.log("Deployer:", deployer.address, "\n");

  const jacobToken = new hre.ethers.Contract(JACOB_TOKEN, [
    "function setWhitelist(address, bool) external",
    "function whitelisted(address) view returns (bool)",
  ], deployer);

  for (const wallet of WALLETS_TO_WHITELIST) {
    const already = await jacobToken.whitelisted(wallet.address);
    if (already) {
      console.log(`  ${wallet.name}: already whitelisted ✓`);
      continue;
    }

    console.log(`  Whitelisting ${wallet.name} (${wallet.address})...`);
    const tx = await jacobToken.setWhitelist(wallet.address, true);
    await tx.wait();
    console.log(`    TX: ${tx.hash} ✓`);
  }

  console.log("\n✅ All allocation wallets whitelisted!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
