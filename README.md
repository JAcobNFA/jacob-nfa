# Jacob - BAP-578 Non-Fungible Agent Platform

<div align="center">

**Burn-to-Mint AI Agent NFTs on BNB Smart Chain**

[![Solidity](https://img.shields.io/badge/Solidity-%5E0.8.22-363636?logo=solidity)](https://soliditylang.org/)
[![BNB Chain](https://img.shields.io/badge/BNB%20Smart%20Chain-Mainnet-F0B90B?logo=binance)](https://www.bnbchain.org/)
[![BAP-578](https://img.shields.io/badge/BAP--578-Verified-00C853)](https://bnbagents.army)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Trustless%20Identity-2196F3)](https://eips.ethereum.org/EIPS/eip-8004)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## Overview

Jacob is a Non-Fungible Agent (NFA) platform on BNB Smart Chain. Users must buy JACOB tokens and burn them to mint AI agent NFTs across 5 tiers (Bronze to Black). Each agent has its own on-chain treasury, revenue sharing, and trading capabilities via PancakeSwap V2. Every agent is automatically registered on the official BAP-578 registry and verified through ERC-8004 Trustless Identity.

**No token, no agent.** The more you burn, the more powerful your agent becomes.

## Architecture

```
                    ┌──────────────────┐
                    │   JacobToken     │
                    │   (ERC-20/DN404) │
                    └────────┬─────────┘
                             │ burn
                    ┌────────▼─────────┐
                    │   AgentMinter    │──── Official BAP-578 Registry
                    │  (Burn-to-Mint)  │
                    └────────┬─────────┘
                             │ mint
              ┌──────────────▼──────────────┐
              │        BAP578NFA            │
              │  (ERC-721 + UUPS Proxy)     │
              └──────┬──────────────┬───────┘
                     │              │
          ┌──────────▼───┐    ┌─────▼──────────┐
          │ AgentVault   │    │AgentController │
          │ (Treasury +  │    │(Action Handler)│
          │  PancakeSwap)│    └────────────────┘
          └──────────────┘
              │
    ┌─────────┼─────────┬──────────────┬───────────────┐
    │         │         │              │               │
┌───▼───┐ ┌──▼───┐ ┌───▼────┐ ┌──────▼──────┐ ┌──────▼──────┐
│Profile│ │Upgrade│ │Referral│ │  Revenue    │ │ Competition │
│       │ │       │ │Rewards │ │  Sharing    │ │  Manager    │
└───────┘ └───────┘ └────────┘ └─────────────┘ └─────────────┘
```

## Smart Contracts (10 Total)

### Core Contracts

| Contract | Description | Solidity |
|----------|-------------|----------|
| **BAP578NFA** | ERC-721 Enumerable + UUPS upgradeable proxy with 5-tier system | ^0.8.22 |
| **JacobToken** | DN404/ERC-404 hybrid token with auto NFT mint/burn + deflationary burn() | ^0.8.22 |
| **AgentController** | Lightweight on-chain action handler | ^0.8.14 |
| **AgentVault** | Per-agent treasury with PancakeSwap V2 DEX integration | ^0.8.22 |
| **AgentMinter** | Burn-to-mint agent creation with auto BAP-578 registry registration | ^0.8.22 |

### Feature Contracts

| Contract | Description | Solidity |
|----------|-------------|----------|
| **AgentProfile** | On-chain naming (1-32 chars, unique), bios, avatars | ^0.8.22 |
| **AgentUpgrade** | Burn additional JACOB to upgrade tier (pay only the difference) | ^0.8.22 |
| **ReferralRewards** | Tier-scaled JACOB rewards per referral | ^0.8.22 |
| **RevenueSharing** | Epoch-based BNB distribution weighted by agent tier | ^0.8.22 |
| **CompetitionManager** | Trading battles with BNB entry fees and prize pools | ^0.8.22 |

## Tier System

| Tier | Burn Cost | Max Agents | Vault Swap Limit | Revenue Shares | BNB Mint Fee |
|------|-----------|------------|------------------|----------------|--------------|
| Bronze | 10 JACOB | 100,000 | 0.1 BNB | 1 | 0.005 BNB |
| Silver | 50 JACOB | 20,000 | 0.5 BNB | 2 | 0.02 BNB |
| Gold | 250 JACOB | 4,000 | 2 BNB | 5 | 0.1 BNB |
| Diamond | 1,000 JACOB | 1,000 | 10 BNB | 12 | 0.5 BNB |
| Black | 10,000 JACOB | 100 | Unlimited | 25 | 2 BNB |

Black tier = 1% of total supply. Maximum 100 Black agents can ever exist.

## Tokenomics

| Allocation | Amount | Percentage |
|------------|--------|------------|
| Agent Liquidity Pool | 250,000 JACOB | 25% |
| Agent Creation Treasury | 200,000 JACOB | 20% |
| Agent Operations Fund | 200,000 JACOB | 20% |
| Ecosystem Development | 150,000 JACOB | 15% |
| Team (12mo cliff, 24mo vest) | 100,000 JACOB | 10% |
| Community & Early Adopters | 90,000 JACOB | 9% |
| Airdrop | 10,000 JACOB | 1% |

**70% of supply is locked** (45% vested + 25% LP burned permanently).

## Revenue Model

Revenue is split **60% to platform owner / 40% to agent holders** from three sources:

- **Agent Minting** — BNB fee on every mint (0.005 - 2 BNB per tier)
- **Vault Swaps** — 1% fee on every DEX swap through AgentVault
- **Competitions** — 5% of prize pools from trading battles

Agent holders claim their share through epoch-based revenue distribution, weighted by tier.

## Deployed Contracts (BSC Mainnet)

| Contract | Address |
|----------|---------|
| BAP578NFA (Proxy) | `0xfd8EeD47b61435f43B004fC65C5b76951652a8CE` |
| JacobToken | `0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b` |
| AgentController | `0x1017CD09a86D92b4CBe74CD765eD4B78Ea82a356` |
| AgentVault | `0x2e44067C9752c3F7AF31856a43CBB8B6315457b9` |
| Deployer | `0xA5d096Dcd19e14D36B8F52b4A6a0abB8b362cdBC` |

## Registry Registrations

| Registry | Agent ID | Standard |
|----------|----------|----------|
| Official BAP-578 PlatformRegistry | #141 | `0x985eae300107a838c1aB154371188e0De5a87316` |
| ERC-8004 Trustless Identity | #2894 | `eip155:56:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| NFA Register | #2168 | `0xd7deb29ddbb13607375ce50405a574ac2f7d978d` |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- BNB for gas fees (BSC Mainnet)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/jacob-nfa.git
cd jacob-nfa
npm install
```

### Configuration

Create a `.env` file:

```env
DEPLOYER_PRIVATE_KEY=your_private_key_here
BSCSCAN_API_KEY=your_bscscan_api_key
SESSION_SECRET=your_session_secret
```

### Compile Contracts

```bash
npx hardhat compile
```

### Deploy

```bash
# Deploy core contracts (BAP578NFA, JacobToken, AgentController, AgentVault, AgentMinter)
npx hardhat run scripts/deploy.js --network bsc

# Deploy feature contracts (AgentProfile, AgentUpgrade, ReferralRewards, RevenueSharing, CompetitionManager)
npx hardhat run scripts/deploy-features.js --network bsc

# Setup liquidity on PancakeSwap (burns LP tokens permanently)
npx hardhat run scripts/setup-liquidity.js --network bsc

# Distribute tokens to allocation wallets
npx hardhat run scripts/distribute-tokens.js --network bsc

# Deploy token vesting contracts
npx hardhat run scripts/deploy-vesting.js --network bsc
```

### Post-Deployment Setup

After deploying the AgentMinter, enable automatic BAP-578 registry registration:

```javascript
// Set official BAP-578 registry address
await agentMinter.setOfficialBAP578("0x15b15DF2fFFF6653C21C11b93fB8A7718CE854Ce");

// Set agent logic contract
await agentMinter.setAgentLogicAddress(agentControllerAddress);

// Set metadata URI base
await agentMinter.setBaseMetadataURI("https://your-domain.com/api/metadata/");

// Enable auto-registration
await agentMinter.setOfficialRegistrationEnabled(true);

// Set NFT image base URI on BAP578NFA
await bap578nfa.setBaseImageURI("https://your-domain.com/images/");
```

### Run Web Dashboard

```bash
node server.js
```

The dashboard runs on port 5000 with:
- `/` — Main dashboard with contract details and deployment info
- `/features.html` — Live burn tracker, leaderboard, agent features
- `/bot.html` — AI-powered trading strategy engine
- `/test.html` — Interactive contract testing with Web3 wallet

### Verify Contracts

```bash
npx hardhat run scripts/verify.js --network bsc
```

## Key Configuration

| Parameter | Value |
|-----------|-------|
| Network | BNB Smart Chain (Chain ID 56) |
| RPC | `https://bsc-dataseed.binance.org/` |
| PancakeSwap Router V2 | `0x10ED43C718714eb63d5aA57B78B54704E256024E` |
| PancakeSwap Factory V2 | `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` |
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |

## Project Structure

```
jacob-nfa/
├── contracts/
│   ├── BAP578NFA.sol          # Core NFT contract (ERC-721 + UUPS)
│   ├── JacobToken.sol         # DN404/ERC-404 hybrid token
│   ├── AgentController.sol    # On-chain action handler
│   ├── AgentVault.sol         # Per-agent treasury + PancakeSwap
│   ├── AgentMinter.sol        # Burn-to-mint + BAP-578 registration
│   ├── AgentProfile.sol       # On-chain agent profiles
│   ├── AgentUpgrade.sol       # Tier upgrade system
│   ├── ReferralRewards.sol    # Referral reward distribution
│   ├── RevenueSharing.sol     # Epoch-based BNB revenue sharing
│   ├── CompetitionManager.sol # Trading competition manager
│   └── TokenVesting.sol       # Token vesting with cliff + linear
├── scripts/
│   ├── deploy.js              # Deploy core contracts
│   ├── deploy-features.js     # Deploy feature contracts
│   ├── deploy-vesting.js      # Deploy vesting contracts
│   ├── setup-liquidity.js     # PancakeSwap liquidity setup
│   ├── distribute-tokens.js   # Token distribution
│   ├── register-jacob.js      # BAP-578 registry registration
│   └── verify.js              # BscScan verification
├── public/
│   ├── index.html             # Main dashboard
│   ├── features.html          # Features & live data
│   ├── bot.html               # AI trading bot
│   ├── test.html              # Contract interaction testing
│   ├── style.css              # Main styles
│   ├── features.css           # Features page styles
│   ├── bot.css                # Bot page styles
│   ├── test.css               # Test page styles
│   ├── features.js            # BSC chain data reader
│   └── images/                # NFT tier artwork
├── server.js                  # Express server + AI bot API
├── hardhat.config.js          # Hardhat configuration
└── package.json
```

## Security

- UUPS upgradeable proxy pattern for BAP578NFA
- Reentrancy guards on all vault swap functions
- Owner-only access control on admin functions
- Two-step ownership transfer on AgentVault
- Circuit breaker pause mechanism
- Tier-based swap limits enforced on-chain
- 1% swap fee collected on ALL swap types (BNB-to-token, token-to-token, token-to-BNB)
- Token fee withdrawal with 60/40 revenue split

## License

This project is licensed under the MIT License.
