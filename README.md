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
| **AgentVault V2** | Per-agent treasury with PancakeSwap V2 DEX, self-funded trades, gas reimbursement | ^0.8.22 |
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
| Agent Operations Fund | 250,000 JACOB | 25% |
| Agent Creation Treasury | 200,000 JACOB | 20% |
| Ecosystem Development | 150,000 JACOB | 15% |
| Agent Liquidity Pool | 125,000 JACOB | 12.5% |
| Team (12mo cliff, 24mo vest) | 100,000 JACOB | 10% |
| Community & Airdrop | 100,000 JACOB | 10% |
| Strategic Reserve | 75,000 JACOB | 7.5% |

**LP/MC Ratio:** 25% (125,000 JACOB + 1 BNB on PancakeSwap V2, LP burned permanently).
**57.5% of supply is locked** (45% vested + 12.5% LP burned permanently).

## Revenue Model

Revenue is split **60% to platform operations & marketing / 40% to agent holders** from three sources:

- **Agent Minting** — BNB fee on every mint (0.005 - 2 BNB per tier)
- **Vault Swaps** — 1% fee on every DEX swap through AgentVault
- **Competitions** — 5% of prize pools from trading battles

Agent holders claim their share through epoch-based revenue distribution, weighted by tier.

## Deployed Contracts (BSC Mainnet)

| Contract | Address |
|----------|---------|
| BAP578NFA (Proxy) | `0xfd8EeD47b61435f43B004fC65C5b76951652a8CE` |
| JacobTokenV2 | `0x9d2a35f82cf36777A73a721f7cb22e5F86acc318` |
| AgentController | `0x1017CD09a86D92b4CBe74CD765eD4B78Ea82a356` |
| AgentVault V2 | `0x120192695152B8788277e46af1412002697B9F25` |
| AgentMinter V3 | `0xb053397547587fE5B999881e9b5C040889dD47C6` |
| PancakeSwap V2 Pair | `0x1EED76a091e4E02aaEb6879590eeF53F27E9c520` |
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
│   ├── deploy-vault-v2.js     # Deploy AgentVault V2 (self-funding + gas reimbursement)
│   ├── deploy-minter-v4.js    # Deploy AgentMinter V4 (LP-oracle pricing)
│   ├── deploy-vesting.js      # Deploy vesting contracts
│   ├── setup-liquidity.js     # PancakeSwap liquidity setup
│   ├── distribute-tokens.js   # Token distribution
│   ├── register-jacob.js      # BAP-578 registry registration
│   └── verify.js              # BscScan verification
├── public/
│   ├── index.html             # Main dashboard
│   ├── features.html          # Features & live data
│   ├── jacob.html             # AI trading bot (chat interface)
│   ├── autotrade.html         # Autonomous trading UI
│   ├── command.html           # Command center (mint, deposit, etc.)
│   ├── guide.html             # How-to guide for users
│   ├── test.html              # Contract interaction testing
│   ├── tg-wallet.html         # Telegram wallet linking Mini App
│   ├── style.css              # Main styles
│   ├── command.js             # Command center logic
│   └── images/                # NFT tier artwork
├── src/
│   ├── autoTrade/
│   │   ├── keeper.js          # Autopilot execution engine (120s cycle)
│   │   └── store.js           # Config persistence & position tracking
│   └── telegram/
│       ├── bot.js             # Telegram bot with wallet, AI, autopilot
│       └── walletStore.js     # Custodial wallet manager (AES-256-GCM)
├── server.js                  # Express server + AI bot API
├── hardhat.config.js          # Hardhat configuration
└── package.json
```

## Agent Autopilot (Autonomous Trading)

Diamond and Black tier agents can enable fully autonomous AI-driven trading:

- **Dynamic Token Discovery** — AI scans trending BSC tokens every 2 minutes via DexScreener. Can trade ANY token on BSC (JACOB is permanently excluded).
- **3 Strategy Profiles** — Conservative ($1M+ liquidity), Balanced ($100K+), Aggressive ($50K+).
- **Self-Funded Trades** — Agents use their own vault BNB for every trade. No external funding needed.
- **Gas Reimbursement** — Gas costs are automatically deducted from the agent's vault BNB after each trade, reimbursing the executor. Capped at 0.005 BNB per trade for safety.
- **Position Tracking** — All purchased tokens are tracked with metadata (symbol, name, decimals, address) for sell decisions.
- **Safety Controls** — Max trade size, daily caps, cooldowns, stop-loss/take-profit, slippage limits.
- **Simulation Mode** — Test without real trades.

### Key Files

| File | Purpose |
|------|---------|
| `src/autoTrade/keeper.js` | Execution engine (runs every 120s) |
| `src/autoTrade/store.js` | Config persistence & position tracking |
| `contracts/AgentVault.sol` | On-chain vault with self-funding & gas reimbursement |
| `scripts/deploy-vault-v2.js` | Deploy script for AgentVault V2 |
| `public/autotrade.html` | Autopilot web UI |

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/auto-trade/enable` | Enable autopilot for an agent |
| `/api/auto-trade/disable` | Disable autopilot |
| `/api/auto-trade/status` | Get autopilot status |
| `/api/auto-trade/simulate` | Run simulation |
| `/api/auto-trade/logs` | View trade logs |
| `/api/auto-trade/strategies` | List available strategies |

## Security

- UUPS upgradeable proxy pattern for BAP578NFA
- Reentrancy guards on all vault swap functions
- Owner-only access control on admin functions
- Two-step ownership transfer on AgentVault
- Circuit breaker pause mechanism
- Tier-based swap limits enforced on-chain
- 1% swap fee collected on ALL swap types (BNB-to-token, token-to-token, token-to-BNB)
- Token fee withdrawal with 60/40 revenue split
- Gas reimbursement capped at 0.005 BNB per trade
- JACOB token triple-excluded from autopilot trading (AI prompt, validator, executor)

## License

This project is licensed under the MIT License.
