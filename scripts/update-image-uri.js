const hre = require("hardhat");

async function main() {
  const newURI = process.env.NEW_BASE_IMAGE_URI;
  if (!newURI) {
    console.error('Error: Set NEW_BASE_IMAGE_URI environment variable');
    console.error('Example: NEW_BASE_IMAGE_URI="https://gateway.pinata.cloud/ipfs/CID/"');
    process.exit(1);
  }

  const NFA_PROXY = '0xfd8EeD47b61435f43B004fC65C5b76951652a8CE';

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const nfa = await hre.ethers.getContractAt(
    ['function setBaseImageURI(string memory _baseImageURI) external', 'function baseImageURI() view returns (string)', 'function tokenURI(uint256) view returns (string)'],
    NFA_PROXY,
    deployer
  );

  console.log('Current baseImageURI:', await nfa.baseImageURI());
  console.log('Setting new baseImageURI:', newURI);

  const tx = await nfa.setBaseImageURI(newURI);
  console.log('TX:', tx.hash);
  await tx.wait();
  console.log('Updated successfully!');

  console.log('New baseImageURI:', await nfa.baseImageURI());

  try {
    const uri = await nfa.tokenURI(1);
    if (uri.startsWith('data:')) {
      const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());
      console.log('\nAgent #1 metadata:');
      console.log('Image:', json.image);
    }
  } catch (e) {
    console.log('No agents minted yet to verify');
  }
}

main().catch(console.error);
