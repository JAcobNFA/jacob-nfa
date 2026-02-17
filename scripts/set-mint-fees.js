const ethers = require('ethers');

const MINTER_ADDRESS = '0xb053397547587fE5B999881e9b5C040889dD47C6';
const MINTER_ABI = [
  'function setMintFee(uint8 tier, uint256 fee) external',
  'function mintFee(uint8 tier) view returns (uint256)',
  'function owner() view returns (address)'
];

const NEW_FEE = ethers.parseEther('0.001');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const minter = new ethers.Contract(MINTER_ADDRESS, MINTER_ABI, wallet);

  const owner = await minter.owner();
  console.log('Contract owner:', owner);
  console.log('Your address:', wallet.address);
  
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error('ERROR: Your wallet is not the contract owner!');
    process.exit(1);
  }

  const tierNames = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Black'];
  
  for (let tier = 1; tier <= 5; tier++) {
    const currentFee = await minter.mintFee(tier);
    console.log(`\n${tierNames[tier-1]} (tier ${tier}):`);
    console.log(`  Current fee: ${ethers.formatEther(currentFee)} BNB`);
    console.log(`  New fee: ${ethers.formatEther(NEW_FEE)} BNB`);
    
    if (currentFee === NEW_FEE) {
      console.log('  Already set, skipping.');
      continue;
    }
    
    const tx = await minter.setMintFee(tier, NEW_FEE);
    console.log(`  TX sent: ${tx.hash}`);
    await tx.wait();
    console.log('  Confirmed!');
  }

  console.log('\nAll mint fees updated to 0.001 BNB!');
  
  console.log('\nVerifying...');
  for (let tier = 1; tier <= 5; tier++) {
    const fee = await minter.mintFee(tier);
    console.log(`  ${tierNames[tier-1]}: ${ethers.formatEther(fee)} BNB`);
  }
}

main().catch(console.error);
