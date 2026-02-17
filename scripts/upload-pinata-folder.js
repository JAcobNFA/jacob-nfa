const fs = require('fs');
const path = require('path');
const https = require('https');

const PINATA_JWT = process.env.PINATA_JWT;
if (!PINATA_JWT) {
  console.error("PINATA_JWT not set");
  process.exit(1);
}

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');
const FILES = [
  'nft-bronze.png',
  'nft-silver.png',
  'nft-gold.png',
  'nft-diamond.png',
  'nft-black.png'
];

function uploadDirectory() {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const parts = [];

    for (const fileName of FILES) {
      const filePath = path.join(IMAGES_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        reject(new Error(`Missing: ${filePath}`));
        return;
      }
      const fileData = fs.readFileSync(filePath);
      const stats = fs.statSync(filePath);
      console.log(`Adding ${fileName} (${(stats.size / 1024).toFixed(1)} KB)`);

      const header =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="jacob-nfa-images/${fileName}"\r\n` +
        `Content-Type: image/png\r\n\r\n`;

      parts.push(Buffer.from(header, 'utf-8'));
      parts.push(fileData);
      parts.push(Buffer.from('\r\n', 'utf-8'));
    }

    const metadataField =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="pinataMetadata"\r\n\r\n` +
      JSON.stringify({ name: "jacob-nfa-images" }) + `\r\n`;
    parts.push(Buffer.from(metadataField, 'utf-8'));

    const optionsField =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="pinataOptions"\r\n\r\n` +
      JSON.stringify({ cidVersion: 1, wrapWithDirectory: false }) + `\r\n`;
    parts.push(Buffer.from(optionsField, 'utf-8'));

    parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf-8'));

    const body = Buffer.concat(parts);

    const options = {
      hostname: 'api.pinata.cloud',
      path: '/pinning/pinFileToIPFS',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Upload failed (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log("=== Uploading NFT Images as IPFS Directory ===\n");

  const result = await uploadDirectory();
  const folderCID = result.IpfsHash;

  console.log("\n========================================");
  console.log("DIRECTORY UPLOAD COMPLETE");
  console.log("========================================");
  console.log("Folder CID:", folderCID);
  console.log("IPFS URI:  ipfs://" + folderCID + "/");
  console.log("");
  console.log("Image URLs:");
  for (const f of FILES) {
    console.log(`  https://gateway.pinata.cloud/ipfs/${folderCID}/${f}`);
  }
  console.log("");
  console.log("For BAP578NFA contract, call:");
  console.log(`  setBaseImageURI("ipfs://${folderCID}/")`);
  console.log("or for gateway:");
  console.log(`  setBaseImageURI("https://gateway.pinata.cloud/ipfs/${folderCID}/")`);
  console.log("========================================");
}

main().catch(err => { console.error(err); process.exit(1); });
