const { ethers } = require("ethers");

const OFFICIAL_BAP578 = "0x15b15DF2fFFF6653C21C11b93fB8A7718CE854Ce";
const PLATFORM_REGISTRY = "0x985eae300107a838c1aB154371188e0De5a87316";

const JACOB_CONTRACTS = {
  BAP578NFA: "0xfd8EeD47b61435f43B004fC65C5b76951652a8CE",
  JacobToken: "0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b",
  AgentController: "0x1017CD09a86D92b4CBe74CD765eD4B78Ea82a356",
  AgentVault: "0x2e44067C9752c3F7AF31856a43CBB8B6315457b9",
};

const BAP578_ABI = [
  "function createAgent(address to, address logicAddress, string metadataURI, tuple(string persona, string experience, string voiceHash, string animationURI, string vaultURI, bytes32 vaultHash) extendedMetadata) external returns (uint256)",
  "function createAgent(address to, address logicAddress, string metadataURI) external returns (uint256)",
  "function getState(uint256 tokenId) external view returns (uint256 balance, uint8 status, address owner, address logicAddress, uint256 lastActionTimestamp)",
  "function totalSupply() external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function getAgentMetadata(uint256 tokenId) external view returns (tuple(string persona, string experience, string voiceHash, string animationURI, string vaultURI, bytes32 vaultHash) metadata, string metadataURI)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

const REGISTRY_ABI = [
  "function connectPlatform(tuple(uint256 agentId, uint8 platform, string platformIdentifier, string configURI, bytes32 configHash, string credentialVaultId) params) external returns (uint256 connectionId)",
  "function getActiveConnections(uint256 agentId) external view returns (uint256[])",
  "function getConnection(uint256 connectionId) external view returns (tuple(uint256 agentId, uint8 platform, string platformIdentifier, string configURI, bytes32 configHash, string credentialVaultId, uint8 status, uint256 connectedAt, uint256 lastActivityAt))",
  "function getAgentConnections(uint256 agentId) external view returns (uint256[])",
  "event PlatformConnected(uint256 indexed agentId, uint256 indexed connectionId, uint8 platform)",
];

const PLATFORM_TYPES = {
  DISCORD: 0,
  TELEGRAM: 1,
  TWITTER: 2,
  WEBAPI: 3,
};

async function main() {
  console.log("\n====================================");
  console.log("  JACOB - BAP-578 NFA Registration");
  console.log("====================================\n");

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: DEPLOYER_PRIVATE_KEY not set");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
  const wallet = new ethers.Wallet(privateKey, provider);
  const deployer = wallet.address;

  console.log("Deployer:", deployer);
  const balance = await provider.getBalance(deployer);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  const bap578 = new ethers.Contract(OFFICIAL_BAP578, BAP578_ABI, wallet);
  const registry = new ethers.Contract(PLATFORM_REGISTRY, REGISTRY_ABI, wallet);

  console.log("--- Step 1: Check existing agents ---");
  const agentBalance = await bap578.balanceOf(deployer);
  console.log("Your agents on official BAP578:", agentBalance.toString());

  let agentId;

  if (agentBalance > 0n) {
    for (let i = 0; i < Number(agentBalance); i++) {
      const tokenId = await bap578.tokenOfOwnerByIndex(deployer, i);
      const state = await bap578.getState(tokenId);
      console.log(`  Agent #${tokenId} - status: ${state.status}, logic: ${state.logicAddress}`);
    }
    const firstToken = await bap578.tokenOfOwnerByIndex(deployer, 0);
    agentId = firstToken;
    console.log(`\nUsing existing agent #${agentId}`);
  } else {
    console.log("\n--- Step 2: Mint Jacob agent on official BAP578 ---");

    const jacobMetadata = {
      persona: JSON.stringify({
        name: "Jacob",
        traits: ["autonomous", "intelligent", "decentralized"],
        style: "AI agent platform with DN404/ERC-404 hybrid tokenomics",
        tone: "professional and innovative",
      }),
      experience:
        "BAP-578 Non-Fungible Agent platform on BNB Smart Chain. Features 4 interconnected contracts: BAP578NFA (ERC-721), JacobToken (DN404/ERC-404), AgentController (action handler), and AgentVault (per-agent treasury with PancakeSwap V2 DEX integration).",
      voiceHash: "jacob_nfa_v1",
      animationURI: "",
      vaultURI: JSON.stringify({
        contracts: JACOB_CONTRACTS,
        network: "BSC Mainnet",
        chainId: 56,
        tokenSymbol: "JACOB",
        totalSupply: "1000000",
      }),
      vaultHash: ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(JACOB_CONTRACTS))
      ),
    };

    console.log("Creating agent with metadata...");
    console.log("  Persona:", jacobMetadata.persona.substring(0, 80) + "...");
    console.log("  Experience:", jacobMetadata.experience.substring(0, 80) + "...");
    console.log("  Vault Hash:", jacobMetadata.vaultHash);

    const metadataURI = `data:application/json,${encodeURIComponent(
      JSON.stringify({
        name: "Jacob NFA Platform",
        description:
          "BAP-578 Non-Fungible Agent platform with DN404/ERC-404 hybrid tokenomics on BNB Smart Chain",
        image: "",
        external_url: "",
        attributes: [
          { trait_type: "Token", value: "JACOB" },
          { trait_type: "Standard", value: "BAP-578 / DN404 / ERC-404" },
          { trait_type: "Network", value: "BSC Mainnet" },
          { trait_type: "Contracts", value: "4" },
        ],
      })
    )}`;

    console.log("\n  Calling createAgent...");
    console.log("  Logic Address:", JACOB_CONTRACTS.AgentController);

    const simpleCreateAgent = bap578["createAgent(address,address,string)"];
    
    console.log("  Estimating gas...");
    const gasEstimate = await simpleCreateAgent.estimateGas(
      deployer,
      JACOB_CONTRACTS.AgentController,
      metadataURI
    );
    console.log("  Estimated gas:", gasEstimate.toString());

    const tx = await simpleCreateAgent(
      deployer,
      JACOB_CONTRACTS.AgentController,
      metadataURI,
      { gasLimit: gasEstimate * 150n / 100n }
    );

    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("Confirmed in block:", receipt.blockNumber);

    const transferEvent = receipt.logs.find(
      (log) => log.topics[0] === ethers.id("Transfer(address,address,uint256)")
    );
    if (transferEvent) {
      agentId = BigInt(transferEvent.topics[3]);
    } else {
      const supply = await bap578.totalSupply();
      agentId = supply;
    }
    console.log("Minted Agent ID:", agentId.toString());
  }

  console.log("\n--- Step 3: Connect Jacob to PlatformRegistry ---");

  const existingConnections = await registry.getActiveConnections(agentId);
  if (existingConnections.length > 0) {
    console.log("Agent already has", existingConnections.length, "connections:");
    for (const connId of existingConnections) {
      const conn = await registry.getConnection(connId);
      const platformNames = ["DISCORD", "TELEGRAM", "TWITTER", "WEBAPI"];
      console.log(`  Connection #${connId}: ${platformNames[conn.platform]} - ${conn.platformIdentifier}`);
    }
    console.log("\nJacob is already registered on the BAP-578 PlatformRegistry!");
  } else {
    const configData = JSON.stringify({
      platform: "Jacob NFA",
      contracts: JACOB_CONTRACTS,
      network: "BSC Mainnet",
      chainId: 56,
      features: [
        "DN404/ERC-404 hybrid token",
        "Auto NFT mint/burn on token transfer",
        "Per-agent treasury vaults",
        "PancakeSwap V2 DEX integration",
        "On-chain action execution",
      ],
    });

    const connectParams = {
      agentId: agentId,
      platform: PLATFORM_TYPES.WEBAPI,
      platformIdentifier: `jacob-nfa-bsc-${JACOB_CONTRACTS.BAP578NFA.toLowerCase().slice(0, 10)}`,
      configURI: `data:application/json,${encodeURIComponent(configData)}`,
      configHash: ethers.keccak256(ethers.toUtf8Bytes(configData)),
      credentialVaultId: `vault-${JACOB_CONTRACTS.AgentVault.toLowerCase().slice(0, 10)}`,
    };

    console.log("Connecting with params:");
    console.log("  Agent ID:", connectParams.agentId.toString());
    console.log("  Platform: WEBAPI (3)");
    console.log("  Identifier:", connectParams.platformIdentifier);

    console.log("  Estimating gas for connectPlatform...");
    const registryGas = await registry.connectPlatform.estimateGas(connectParams);
    console.log("  Estimated gas:", registryGas.toString());

    const tx = await registry.connectPlatform(connectParams, { gasLimit: registryGas * 150n / 100n });
    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("Confirmed in block:", receipt.blockNumber);

    const connEvent = receipt.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id("PlatformConnected(uint256,uint256,uint8)")
    );
    if (connEvent) {
      const connectionId = BigInt(connEvent.topics[2]);
      console.log("Connection ID:", connectionId.toString());
    }

    console.log("\nJacob successfully registered on BAP-578 PlatformRegistry!");
  }

  console.log("\n====================================");
  console.log("  Registration Summary");
  console.log("====================================");
  console.log("Official BAP578 Contract:", OFFICIAL_BAP578);
  console.log("PlatformRegistry:", PLATFORM_REGISTRY);
  console.log("Agent ID:", agentId.toString());
  console.log("Jacob Contracts:");
  Object.entries(JACOB_CONTRACTS).forEach(([name, addr]) => {
    console.log(`  ${name}: ${addr}`);
  });
  console.log("====================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nRegistration failed:", error.message || error);
    if (error.data) console.error("Error data:", error.data);
    process.exit(1);
  });
