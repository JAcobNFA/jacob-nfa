const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const BAP578_PROXY = "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE";
  const IPFS_FOLDER_URI = "ipfs://bafybeiekcwmec3a7fwgie7pt7n53zo7itbtkfyje3vlb6nzudngwkjppby/";

  console.log("Setting baseImageURI on BAP578NFA...");
  console.log("Contract:", BAP578_PROXY);
  console.log("New URI:", IPFS_FOLDER_URI);

  const abi = [
    "function setBaseImageURI(string memory _baseImageURI) external",
    "function baseImageURI() external view returns (string)"
  ];
  const bap578 = new hre.ethers.Contract(BAP578_PROXY, abi, deployer);

  const oldURI = await bap578.baseImageURI();
  console.log("Old URI:", oldURI || "(empty)");

  const tx = await bap578.setBaseImageURI(IPFS_FOLDER_URI);
  await tx.wait();
  console.log("Transaction confirmed:", tx.hash);

  const newURI = await bap578.baseImageURI();
  console.log("New URI:", newURI);

  console.log("\n========================================");
  console.log("BASE IMAGE URI SET SUCCESSFULLY");
  console.log("========================================");
  console.log("tokenURI will now return IPFS image URLs:");
  console.log("  Bronze:  ipfs://bafybeiekcwmec3a7fwgie7pt7n53zo7itbtkfyje3vlb6nzudngwkjppby/nft-bronze.png");
  console.log("  Silver:  ipfs://bafybeiekcwmec3a7fwgie7pt7n53zo7itbtkfyje3vlb6nzudngwkjppby/nft-silver.png");
  console.log("  Gold:    ipfs://bafybeiekcwmec3a7fwgie7pt7n53zo7itbtkfyje3vlb6nzudngwkjppby/nft-gold.png");
  console.log("  Diamond: ipfs://bafybeiekcwmec3a7fwgie7pt7n53zo7itbtkfyje3vlb6nzudngwkjppby/nft-diamond.png");
  console.log("  Black:   ipfs://bafybeiekcwmec3a7fwgie7pt7n53zo7itbtkfyje3vlb6nzudngwkjppby/nft-black.png");
  console.log("========================================");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
