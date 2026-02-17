const hre = require("hardhat");

async function main() {
  const MINTER_V4 = process.env.AGENT_MINTER_V4_ADDRESS;
  if (!MINTER_V4) {
    console.error("Set AGENT_MINTER_V4_ADDRESS environment variable");
    process.exit(1);
  }

  const JACOB_TOKEN = "0x9d2a35f82cf36777A73a721f7cb22e5F86acc318";
  const BAP578_PROXY = "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE";
  const LP_PAIR = "0x1EED76a091e4E02aaEb6879590eeF53F27E9c520";
  const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

  console.log("Verifying AgentMinterV4:", MINTER_V4);

  await hre.run("verify:verify", {
    address: MINTER_V4,
    constructorArguments: [JACOB_TOKEN, BAP578_PROXY, LP_PAIR, WBNB],
  });

  console.log(`AgentMinterV4 verified: https://bscscan.com/address/${MINTER_V4}#code`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
