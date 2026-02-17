const { ethers } = require('ethers');
try { require('dotenv').config(); } catch(e) {}

const BSC_RPC = 'https://bsc-dataseed1.binance.org';
const BAP578_NFA_PROXY = '0xfd8EeD47b61435f43B004fC65C5b76951652a8CE';
const AGENT_MINTER_V4 = '0x32E36bB340A55CD1074160853aD5c58d00fED9b8';

const NFA_ABI = [
  'function setMinter(address _minter) external',
  'function mintWithTier(address to, uint8 tier, uint256 burnedAmount) external returns (uint256)',
  'function minter() view returns (address)',
  'function owner() view returns (address)'
];

async function main() {
  const recipient = process.argv[2];
  const tier = parseInt(process.argv[3] || '5');
  
  if (!recipient || !ethers.isAddress(recipient)) {
    console.error('Usage: node scripts/admin-mint.js <wallet_address> [tier]');
    console.error('Tiers: 1=Bronze, 2=Silver, 3=Gold, 4=Diamond, 5=Black');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const nfa = new ethers.Contract(BAP578_NFA_PROXY, NFA_ABI, deployer);

  let currentMinter;
  try {
    currentMinter = await nfa.minter();
    console.log(`Current minter: ${currentMinter}`);
  } catch(e) {
    console.log('Could not read minter (proxy issue), proceeding...');
    currentMinter = AGENT_MINTER_V4;
  }
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Tier: ${tier} (${['','Bronze','Silver','Gold','Diamond','Black'][tier]})`);

  console.log('\n1/3 Setting deployer as minter...');
  const tx1 = await nfa.setMinter(deployer.address);
  await tx1.wait();
  console.log('Done.');

  console.log('2/3 Minting agent...');
  const tx2 = await nfa.mintWithTier(recipient, tier, 0);
  const receipt = await tx2.wait();
  
  const transferLog = receipt.logs.find(l => l.topics.length === 4);
  let tokenId = 'unknown';
  if (transferLog) {
    tokenId = parseInt(transferLog.topics[3], 16);
  }
  console.log(`Minted! Token ID: ${tokenId}`);
  console.log(`TX: https://bscscan.com/tx/${receipt.hash}`);

  console.log('3/3 Restoring minter to AgentMinterV4...');
  const tx3 = await nfa.setMinter(AGENT_MINTER_V4);
  await tx3.wait();
  console.log('Minter restored.');

  console.log(`\nDone! Agent #${tokenId} (${['','Bronze','Silver','Gold','Diamond','Black'][tier]}) minted to ${recipient}`);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
