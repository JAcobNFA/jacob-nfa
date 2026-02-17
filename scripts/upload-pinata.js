const fs = require('fs');
const path = require('path');
const https = require('https');

const PINATA_JWT = process.env.PINATA_JWT;
if (!PINATA_JWT) {
  console.error("PINATA_JWT not set");
  process.exit(1);
}

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');
const TIERS = ['bronze', 'silver', 'gold', 'diamond', 'black'];

function uploadFileRaw(filePath, fileName) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(filePath);
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);

    const metadataField =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="pinataMetadata"\r\n\r\n` +
      JSON.stringify({ name: fileName }) + `\r\n`;

    const optionsField =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="pinataOptions"\r\n\r\n` +
      JSON.stringify({ cidVersion: 1 }) + `\r\n`;

    const fileHeader =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${path.basename(filePath)}"\r\n` +
      `Content-Type: image/png\r\n\r\n`;

    const footer = `\r\n--${boundary}--\r\n`;

    const headerBuf = Buffer.from(metadataField + optionsField + fileHeader, 'utf-8');
    const footerBuf = Buffer.from(footer, 'utf-8');
    const body = Buffer.concat([headerBuf, fileData, footerBuf]);

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

function uploadJSON(jsonData, name) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      pinataContent: jsonData,
      pinataMetadata: { name },
      pinataOptions: { cidVersion: 1 }
    });

    const options = {
      hostname: 'api.pinata.cloud',
      path: '/pinning/pinJSONToIPFS',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`JSON upload failed (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log("=== Uploading NFT Images to IPFS via Pinata ===\n");

  const imageResults = {};

  for (const tier of TIERS) {
    const fileName = `nft-${tier}.png`;
    const filePath = path.join(IMAGES_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      console.error(`Missing: ${filePath}`);
      continue;
    }

    const stats = fs.statSync(filePath);
    console.log(`Uploading ${fileName} (${(stats.size / 1024).toFixed(1)} KB)...`);

    const result = await uploadFileRaw(filePath, `jacob-nfa-${tier}`);
    imageResults[tier] = result.IpfsHash;
    console.log(`  CID: ${result.IpfsHash}`);
    console.log(`  URL: https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`);
  }

  console.log("\n--- Uploading Metadata JSON for each tier ---\n");

  const BURN_COSTS = { bronze: 10, silver: 50, gold: 250, diamond: 1000, black: 10000 };
  const TIER_NUMBERS = { bronze: 1, silver: 2, gold: 3, diamond: 4, black: 5 };
  const metadataResults = {};

  for (const tier of TIERS) {
    if (!imageResults[tier]) continue;

    const metadata = {
      name: `Jacob NFA - ${tier.charAt(0).toUpperCase() + tier.slice(1)} Agent`,
      description: `A ${tier.charAt(0).toUpperCase() + tier.slice(1)} tier Non-Fungible Agent (NFA) on the BAP-578 Jacob platform. Created by burning ${BURN_COSTS[tier]} JACOB tokens.`,
      image: `ipfs://${imageResults[tier]}`,
      external_url: "https://jacob.bap578.com",
      attributes: [
        { trait_type: "Tier", value: tier.charAt(0).toUpperCase() + tier.slice(1) },
        { trait_type: "Tier Level", value: TIER_NUMBERS[tier], display_type: "number" },
        { trait_type: "Burn Cost", value: BURN_COSTS[tier], display_type: "number" },
        { trait_type: "Protocol", value: "BAP-578" },
        { trait_type: "Token", value: "JACOB" },
        { trait_type: "Chain", value: "BNB Smart Chain" }
      ]
    };

    console.log(`Uploading ${tier} metadata...`);
    const result = await uploadJSON(metadata, `jacob-nfa-metadata-${tier}`);
    metadataResults[tier] = result.IpfsHash;
    console.log(`  CID: ${result.IpfsHash}`);
    console.log(`  URL: https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`);
  }

  console.log("\n========================================");
  console.log("IPFS UPLOAD COMPLETE");
  console.log("========================================");
  console.log("\nImage CIDs:");
  for (const tier of TIERS) {
    if (imageResults[tier]) {
      console.log(`  ${tier}: ipfs://${imageResults[tier]}`);
    }
  }
  console.log("\nMetadata CIDs:");
  for (const tier of TIERS) {
    if (metadataResults[tier]) {
      console.log(`  ${tier}: ipfs://${metadataResults[tier]}`);
    }
  }
  console.log("\nGateway URLs (for browser preview):");
  for (const tier of TIERS) {
    if (imageResults[tier]) {
      console.log(`  ${tier}: https://gateway.pinata.cloud/ipfs/${imageResults[tier]}`);
    }
  }
  console.log("========================================");
}

main().catch(err => { console.error(err); process.exit(1); });
