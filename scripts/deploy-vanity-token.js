const { ethers } = require("ethers");
const fs = require("fs");

async function main() {
  const result = JSON.parse(fs.readFileSync("vanity-result.json"));
  
  const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  
  console.log("Deployer:", wallet.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "BNB");
  console.log("Target address:", result.address);
  console.log("");
  
  const existing = await provider.getCode(result.address);
  if (existing.length > 2) {
    console.log("Contract already deployed at this address!");
    return;
  }
  
  const FACTORY = result.factory;
  const salt = result.salt.slice(2);
  const initCode = result.initCode.slice(2);
  const data = "0x" + salt + initCode;
  
  console.log("Deploying via CREATE2 factory...");
  
  const gasPrice = (await provider.getFeeData()).gasPrice;
  const gasEstimate = await provider.estimateGas({
    to: FACTORY,
    data: data,
    from: wallet.address,
  });
  console.log("Gas estimate:", gasEstimate.toString());
  console.log("Estimated cost:", ethers.formatEther(gasEstimate * gasPrice), "BNB");
  
  const tx = await wallet.sendTransaction({
    to: FACTORY,
    data: data,
    gasLimit: gasEstimate * 13n / 10n,
    gasPrice: gasPrice,
  });
  
  console.log("TX:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("Cost:", ethers.formatEther(receipt.gasUsed * receipt.gasPrice), "BNB");
  
  const code = await provider.getCode(result.address);
  console.log("\nContract deployed:", code.length > 2 ? "YES" : "NO");
  console.log("Address:", result.address);
  
  const token = new ethers.Contract(result.address, [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function owner() view returns (address)",
  ], provider);
  
  console.log("\n--- Verification ---");
  console.log("Name:", await token.name());
  console.log("Symbol:", await token.symbol());
  console.log("Total Supply:", ethers.formatEther(await token.totalSupply()), "JACOB");
  console.log("Deployer Balance:", ethers.formatEther(await token.balanceOf(wallet.address)), "JACOB");
  console.log("Owner:", await token.owner());
}

main().catch(console.error);
