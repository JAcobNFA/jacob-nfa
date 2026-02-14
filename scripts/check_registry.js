const { ethers } = require("ethers");

async function main() {
  const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
  const registryAddr = "0x985eae300107a838c1aB154371188e0De5a87316";
  
  const fs = require("fs");
  const abi = JSON.parse(fs.readFileSync("/tmp/registry_abi.json", "utf8"));
  
  const registry = new ethers.Contract(registryAddr, abi, provider);
  
  // Get BAP578 reference
  const bap578Addr = await registry.bap578();
  console.log("BAP578 reference:", bap578Addr);
  
  const circuitBreaker = await registry.circuitBreaker();
  console.log("Circuit Breaker:", circuitBreaker);
  
  const vaultPM = await registry.vaultPermissionManager();
  console.log("Vault Permission Manager:", vaultPM);
  
  const maxConn = await registry.DEFAULT_MAX_CONNECTIONS();
  console.log("Default Max Connections:", maxConn.toString());
}
main().catch(console.error);
