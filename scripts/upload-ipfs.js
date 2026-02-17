const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const PINATA_API = 'https://api.pinata.cloud';
const JWT = process.env.PINATA_JWT;

if (!JWT) {
  console.error('Error: PINATA_JWT environment variable not set');
  console.error('Get your free JWT at https://pinata.cloud/keys');
  process.exit(1);
}

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');
const TIER_FILES = [
  'nft-bronze.png',
  'nft-silver.png',
  'nft-gold.png',
  'nft-diamond.png',
  'nft-black.png'
];

async function uploadFile(filePath, fileName) {
  const data = new FormData();
  data.append('file', fs.createReadStream(filePath), { filename: fileName });

  const metadata = JSON.stringify({ name: `jacob-nfa-${fileName}` });
  data.append('pinataMetadata', metadata);

  const options = JSON.stringify({ cidVersion: 1 });
  data.append('pinataOptions', options);

  const response = await axios.post(`${PINATA_API}/pinning/pinFileToIPFS`, data, {
    maxBodyLength: Infinity,
    headers: {
      'Authorization': `Bearer ${JWT}`,
      ...data.getHeaders()
    }
  });

  return response.data;
}

async function uploadDirectory() {
  const data = new FormData();

  for (const file of TIER_FILES) {
    const filePath = path.join(IMAGES_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    data.append('file', fs.createReadStream(filePath), {
      filepath: `jacob-nfa-images/${file}`
    });
  }

  const metadata = JSON.stringify({ name: 'jacob-nfa-images' });
  data.append('pinataMetadata', metadata);

  const options = JSON.stringify({ cidVersion: 1, wrapWithDirectory: false });
  data.append('pinataOptions', options);

  const response = await axios.post(`${PINATA_API}/pinning/pinFileToIPFS`, data, {
    maxBodyLength: Infinity,
    headers: {
      'Authorization': `Bearer ${JWT}`,
      ...data.getHeaders()
    }
  });

  return response.data;
}

async function main() {
  console.log('Uploading NFT images to IPFS via Pinata...\n');

  console.log('Uploading as directory...');
  const result = await uploadDirectory();

  const cid = result.IpfsHash;
  console.log(`\nDirectory CID: ${cid}`);
  console.log(`IPFS URL: ipfs://${cid}/`);
  console.log(`Gateway URL: https://gateway.pinata.cloud/ipfs/${cid}/`);

  console.log('\nImage URLs:');
  for (const file of TIER_FILES) {
    console.log(`  ${file}: ipfs://${cid}/${file}`);
    console.log(`  Gateway: https://gateway.pinata.cloud/ipfs/${cid}/${file}`);
  }

  console.log(`\n=== Use this as baseImageURI on contract ===`);
  console.log(`ipfs://${cid}/`);
  console.log(`\nOr gateway URL:`);
  console.log(`https://gateway.pinata.cloud/ipfs/${cid}/`);

  console.log('\nVerifying uploads...');
  for (const file of TIER_FILES) {
    try {
      const url = `https://gateway.pinata.cloud/ipfs/${cid}/${file}`;
      const res = await axios.head(url, { timeout: 15000 });
      console.log(`  ${file}: ${res.status === 200 ? 'OK' : 'FAILED'} (${res.headers['content-type']})`);
    } catch (e) {
      console.log(`  ${file}: Verification pending (gateway may need a moment)`);
    }
  }
}

main().catch(err => {
  console.error('Upload failed:', err.response?.data || err.message);
  process.exit(1);
});
