const { keccak256 } = require("js-sha3");
const { ethers } = require("ethers");
const fs = require("fs");

const FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const DEPLOYER = "0xA5d096Dcd19e14D36B8F52b4A6a0abB8b362cdBC";
const CONTROLLER = "0x1017CD09a86D92b4CBe74CD765eD4B78Ea82a356";
const TARGET_SUFFIX = "7ac0b";

const artifact = JSON.parse(fs.readFileSync("artifacts/contracts/JacobToken.sol/JacobToken.json"));
const constructorArgs = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address", "address"], 
  [DEPLOYER, CONTROLLER]
);
const initCode = artifact.bytecode + constructorArgs.slice(2);
const initCodeHashHex = keccak256(Buffer.from(initCode.slice(2), "hex"));
const initCodeHash = "0x" + initCodeHashHex;

// Verify with ethers
const ethersHash = ethers.keccak256(initCode);
console.log("initCodeHash (js-sha3):", initCodeHash);
console.log("initCodeHash (ethers) :", ethersHash);
console.log("Match:", initCodeHash === ethersHash);

const factoryBuf = Buffer.from(FACTORY.slice(2), "hex");
const initCodeHashBuf = Buffer.from(initCodeHashHex, "hex");

// Precompute prefix: 0xff ++ factory ++ [salt placeholder] ++ initCodeHash
const prefix = Buffer.alloc(1 + 20 + 32 + 32);
prefix[0] = 0xff;
factoryBuf.copy(prefix, 1);
initCodeHashBuf.copy(prefix, 53);

// Target suffix bytes
const targetBuf = Buffer.from("07ac0b", "hex"); // padded to even length

console.log("\nMining for address ending with:", TARGET_SUFFIX);
console.log("Using js-sha3 keccak256...\n");

const startTime = Date.now();
const BATCH = 500000;

let found = false;
for (let i = 0; i < 500000000 && !found; i++) {
  // Write salt into prefix buffer
  const saltBuf = prefix.subarray(21, 53);
  saltBuf.fill(0);
  let n = i;
  let pos = 31;
  while (n > 0 && pos >= 0) {
    saltBuf[pos] = n & 0xff;
    n = Math.floor(n / 256);
    pos--;
  }
  
  const hash = Buffer.from(keccak256(prefix), "hex");
  
  // Check last 3 bytes (covers 7ac0b = 5 hex chars = 2.5 bytes)
  // Address is hash[12:32], so last bytes are hash[29], hash[30], hash[31]
  // 7ac0b => check hash[29] & 0x0f == 0x07, hash[30] == 0xac, hash[31] == 0x0b
  if (hash[31] === 0x0b && hash[30] === 0xac && (hash[29] & 0x0f) === 0x07) {
    const addr = "0x" + hash.slice(12).toString("hex");
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const saltHex = "0x" + prefix.subarray(21, 53).toString("hex");
    
    // Verify with ethers
    const verified = ethers.getCreate2Address(FACTORY, saltHex, initCodeHash);
    
    console.log("FOUND!");
    console.log("Salt decimal:", i);
    console.log("Salt hex:", saltHex);
    console.log("Address:", addr);
    console.log("Verified:", verified);
    console.log("Ends with 7ac0b:", verified.toLowerCase().endsWith("7ac0b"));
    console.log("Attempts:", i + 1);
    console.log("Time:", elapsed, "seconds");
    
    if (verified.toLowerCase().endsWith("7ac0b")) {
      fs.writeFileSync("vanity-result.json", JSON.stringify({
        salt: saltHex,
        saltDecimal: i,
        address: verified,
        initCodeHash,
        factory: FACTORY,
        deployer: DEPLOYER,
        controller: CONTROLLER,
        initCode
      }, null, 2));
      found = true;
    } else {
      console.log("FALSE POSITIVE - continuing...");
    }
  }
  
  if ((i + 1) % BATCH === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = Math.floor((i + 1) / elapsed);
    console.log(`Checked ${(i+1).toLocaleString()} salts... (${elapsed}s, ${rate.toLocaleString()}/s)`);
  }
}

if (!found) console.log("Not found in search range.");
