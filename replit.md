# Jacob - BAP-578 Non-Fungible Agent Platform

## Overview
Complete BAP-578 Non-Fungible Agent (NFA) platform on BNB Smart Chain (BSC) called "Jacob" with 10 interconnected smart contracts. The system enables AI agents to exist as tradeable NFTs (via burn-to-mint mechanism) with on-chain action execution, per-agent treasury management, agent profiles, tier upgrades, referral rewards, revenue sharing, and trading competitions.

## Project Architecture

### Smart Contracts (Solidity) - Core (5)
- **contracts/AgentController.sol** - Contract 3: Lightweight action handler (Solidity ^0.8.14)
- **contracts/BAP578NFA.sol** - Contract 1: ERC-721 Enumerable + BAP-578 NFA Core with UUPS upgradeable proxy, tier system (Solidity ^0.8.22)
- **contracts/JacobToken.sol** - Contract 2: DN404/ERC-404 Hybrid token with auto NFT mint/burn + deflationary burn() (Solidity ^0.8.22)
- **contracts/AgentVault.sol** - Contract 4: Per-agent treasury with PancakeSwap V2 DEX integration, tier-based swap limits (Solidity ^0.8.22)
- **contracts/AgentMinter.sol** - Contract 5: Burn-to-mint agent creation with 5-tier system (Solidity ^0.8.22)

### Smart Contracts (Solidity) - Feature Contracts (5)
- **contracts/AgentProfile.sol** - On-chain agent naming, bios, avatars with unique name enforcement (Solidity ^0.8.22)
- **contracts/AgentUpgrade.sol** - Burn additional JACOB to upgrade agent tier, pay only the difference (Solidity ^0.8.22)
- **contracts/ReferralRewards.sol** - Referral tracking with tier-scaled JACOB rewards (Solidity ^0.8.22)
- **contracts/RevenueSharing.sol** - Epoch-based BNB revenue distribution weighted by agent tier (Solidity ^0.8.22)
- **contracts/CompetitionManager.sol** - Agent trading battles with entry fees, scoring, and prize pools (Solidity ^0.8.22)

### Deployment
- **scripts/deploy.js** - Deploy core 5 contracts to BSC mainnet
- **scripts/deploy-features.js** - Deploy feature 5 contracts to BSC mainnet
- **hardhat.config.js** - Hardhat configuration for BSC mainnet and local testing

### Web Frontend
- **server.js** - Express server with AI bot API endpoint (OpenAI) on port 5000
- **public/index.html** - Dashboard showing all contract details, deployment steps, and ABIs
- **public/features.html** - Live burn tracker, agent leaderboard, profiles, upgrades, referrals, revenue sharing, competitions
- **public/bot.html** - AI-powered trading strategy engine with chat interface and quick actions
- **public/test.html** - Interactive test page with Web3 wallet connection and contract interaction
- **public/style.css** - Futuristic dark theme with glassmorphism, neon glows, particle effects
- **public/features.css** - Features page styles
- **public/bot.css** - AI bot page styles
- **public/features.js** - BSC chain data reader for burn tracker and leaderboard
- **public/test.css** - Test page specific styles

### Key Configuration
- Network: BNB Smart Chain (Chain ID 56)
- RPC: https://bsc-dataseed.binance.org/
- PancakeSwap Router V2: 0x10ED43C718714eb63d5aA57B78B54704E256024E
- PancakeSwap Factory V2: 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73
- WBNB: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c

## Deployed Contract Addresses (BSC Mainnet) - Latest
- **AgentController**: 0x1017CD09a86D92b4CBe74CD765eD4B78Ea82a356
- **BAP578NFA (Proxy)**: 0xfd8EeD47b61435f43B004fC65C5b76951652a8CE
- **JacobToken**: 0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b (vanity address ending in 7ac0b)
- **AgentVault**: 0xc9Bb89E036BD17F8E5016C89D0B6104F8912ac8A
- **AgentMinter**: 0x3Ea9ef96EFDAa4A172ce08f1F06F54A04cA2892D (v2 - uses transferFrom to dead address)
- **Deployer**: 0xA5d096Dcd19e14D36B8F52b4A6a0abB8b362cdBC

### Allocation Wallets
- **Team**: 0xFe6b50eAdeC141a1c0C2aDA767483D9b61e40f12 (100,000 JACOB - vested: 12mo cliff, 24mo vest)
- **Agent Creation Treasury**: 0xe90d963aF0Dc7A69cA92eb536E5403cb6cc1a83A (200,000 JACOB - vested: 3mo cliff, 12mo vest)
- **Ecosystem Development**: 0xf1d55c24d22a4F961d276AB35c28422d61cB3B72 (150,000 JACOB - vested: 3mo cliff, 18mo vest)
- **Agent Operations Fund**: 0x57EEB022305563241032Bba4efC08F2c82613010 (200,000 JACOB - unlocked)
- **Community & Airdrop**: 0x2a64115B9F771D89c31B90A4fBaE3107dd5B4461 (100,000 JACOB - unlocked)
- **TokenVesting**: 0xEad164FCcE242D403b9A8E5016C89D0B6104F8912ac8A (450,000 JACOB locked)
- **PancakeSwap Pair (JACOB/WBNB)**: 0x601e1b5A916EBE7e97D890F67Fa3841480bb748c (LP burned, permanently locked)
- **AgentProfile**: Not yet deployed (run scripts/deploy-features.js)
- **AgentUpgrade**: Not yet deployed
- **ReferralRewards**: Not yet deployed
- **RevenueSharing**: Not yet deployed
- **CompetitionManager**: Not yet deployed

## BAP-578 Registry Registrations

### ERC-8004 Trustless Agents (Verified Identity)
- **IdentityRegistry**: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- **Jacob Agent ID**: 2894
- **Standard**: eip155:56:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- **Registration TX**: 0x2c1827b0688b3143a506edeba69314706a8ce0c05eb739d82e3bc633f5000fc7
- **URI Update TX**: 0x3dba86bcb68ebc2135e15594c35326d597d55dd37278b01d6d4d500544da3353

### NFA Register (Primary)
- **NFA Register Contract**: 0xd7deb29ddbb13607375ce50405a574ac2f7d978d
- **Jacob Agent ID**: 2168
- **Registration TX**: 0x62451a3162bbc3ba4d39a665d237484d595fba83a12902e3963f879e5a913f98

### PlatformRegistry
- **Official BAP578 Contract**: 0x15b15DF2fFFF6653C21C11b93fB8A7718CE854Ce
- **PlatformRegistry**: 0x985eae300107a838c1aB154371188e0De5a87316
- **Jacob Agent ID**: 141
- **Platform Connection**: WEBAPI
- **Registration TX (Mint)**: 0xe05a7e48d899de0710b5af3e798c11a4a6c9ad4129771244ed75d58290703ffd
- **Registration TX (Connect)**: 0x03693243ba62714413792859948cdadecdce330511c5c0d8c413c5577aed0ab9

## Burn-to-Mint Agent System
- Users burn JACOB tokens to create tiered agent NFTs via AgentMinter contract
- Burn costs: Bronze (10), Silver (50), Gold (250), Diamond (1,000), Black (10,000)
- Black tier = 1% of supply, maximum 100 agents can ever exist
- AgentVault enforces tier-based swap limits: Bronze 0.1 BNB, Silver 0.5, Gold 2, Diamond 10, Black unlimited
- AgentMinter v2 uses transferFrom to dead address (0x...dEaD) since deployed JacobToken doesn't have burnFrom
- Tokens sent to dead address are permanently removed from circulation
- BAP578NFA stores agent tier and burned amount in on-chain metadata

## Feature System
- **Agent Profiles**: On-chain names (1-32 chars, unique), bios (256 chars), avatars for agents
- **Agent Upgrades**: Burn additional JACOB to upgrade tier (pay only the difference between tiers)
- **Referral Rewards**: Base 5 JACOB + tier-scaled bonus (2 JACOB per tier level) per referral
- **Revenue Sharing**: Epoch-based BNB distribution - Bronze=1, Silver=2, Gold=5, Diamond=12, Black=25 shares
- **Revenue Streams** (60% owner / 40% agent holders):
  - Agent Minting: BNB fee per mint (Bronze 0.005, Silver 0.02, Gold 0.1, Diamond 0.5, Black 2 BNB)
  - Vault Swaps: 1% fee on every DEX swap through AgentVault
  - Competitions: 5% of prize pools from trading battles
- **Competitions**: Trading battles with BNB entry fees, on-chain scoring, 95% prize pool to winner (5% platform fee)
- **AI Trading Bot**: OpenAI-powered strategy engine (gpt-5-mini) for market analysis, trading advice, risk assessment

## NFT Image Metadata
- Images hosted at `/images/nft-{tier}.png` (bronze, silver, gold, diamond, black)
- Contract uses `baseImageURI` (set by owner via `setBaseImageURI()`) + tier filename to build image URLs in `tokenURI()`
- Server endpoint: `GET /api/metadata/:tokenId?tier=N&burned=M` returns ERC-721 metadata JSON with image, attributes
- After deploying upgraded contract, call `setBaseImageURI("https://your-domain.com/images/")` to activate images

## Recent Changes
- 2026-02-14: Redeployed AgentMinter v2 (0x3Ea9ef96EFDAa4A172ce08f1F06F54A04cA2892D) - uses transferFrom to dead address instead of burnFrom (deployed JacobToken lacks burnFrom)
- 2026-02-14: Added Connect Wallet button and full Mint Agent NFA section to features.html with approve+mint two-step flow
- 2026-02-14: Added wallet connection with BSC auto-switch, balance display, tier selection UI
- 2026-02-14: LAUNCH COMPLETE - All tokens distributed, liquidity live on PancakeSwap
- 2026-02-14: Added PancakeSwap liquidity: 250k JACOB + 0.5 BNB, LP burned permanently (pair: 0x601e1b5A916EBE7e97D890F67Fa3841480bb748c)
- 2026-02-14: Distributed 300k unlocked JACOB: 200k Operations, 90k Community, 10k Airdrop
- 2026-02-14: Deployed TokenVesting at 0xEad164FCcE242D403b9A8E5016C89D0B6104F8912ac8A, locked 450k JACOB (Team/Creation/Ecosystem)
- 2026-02-14: Whitelisted all 5 allocation wallets + vesting contract on JacobToken
- 2026-02-14: Redeployed AgentMinter (0x94D146c2CDdD1A0fa8C931D625fbc4F1Eff4c9Ee) with excess BNB refund, reentrancy-safe design
- 2026-02-14: Redeployed AgentVault (0xc9Bb89E036BD17F8E5016C89D0B6104F8912ac8A) with tier-based swap limits, 1% fee on all swap types
- 2026-02-14: Upgraded BAP578NFA proxy with new tokenURI (base64), upgrader field, tier metadata
- 2026-02-14: Set AgentMinter as BAP578NFA minter, whitelisted both AgentMinter and AgentVault on JacobToken
- 2026-02-14: Upgraded BAP578NFA proxy on BSC mainnet - replaced buggy assembly base64 with OpenZeppelin Base64.encode (all state preserved)
- 2026-02-14: Pre-launch audit: Fixed BAP578NFA tokenURI to return proper data:application/json;base64 format (marketplace compatible)
- 2026-02-14: Pre-launch audit: AgentMinter now refunds excess BNB to minter (refund after all state changes for reentrancy safety)
- 2026-02-14: Pre-launch audit: Added emergencyWithdraw to RevenueSharing for stuck funds recovery
- 2026-02-14: Pre-launch audit: Fixed distribute-tokens.js to split community (9%, 90k) and airdrop (1%, 10k) correctly
- 2026-02-14: Created validate-deployment.js script for comprehensive pre-launch contract wiring checks
- 2026-02-14: Pushed all code to GitHub: https://github.com/JAcobNFA/jacob-nfa
- 2026-02-13: Added auto-registration on official BAP-578 registry (0x15b15DF2fFFF6653C21C11b93fB8A7718CE854Ce) during agent minting
- 2026-02-13: AgentMinter now calls official BAP578.createAgent() for every new agent, with batch backfill for existing agents
- 2026-02-13: Fixed AgentVault: 1% swap fee now collected on ALL swap types (was missing on token-to-token and token-to-BNB)
- 2026-02-13: Added withdrawTokenFees() to AgentVault for distributing accumulated token fees (60/40 split)
- 2026-02-13: Fixed AgentController: updateDescription now requires owner access
- 2026-02-11: Built 5 new feature contracts (AgentProfile, AgentUpgrade, ReferralRewards, RevenueSharing, CompetitionManager)
- 2026-02-11: Created Features page with live burn tracker, leaderboard, profiles, upgrades, referrals, revenue sharing, competitions
- 2026-02-11: Created AI Bot page with chat interface, strategy templates, quick actions
- 2026-02-11: Added OpenAI integration for AI trading strategy engine
- 2026-02-11: Created deploy-features.js for deploying all 5 feature contracts
- 2026-02-11: Redeployed JacobToken with vanity address ending in 7ac0b via CREATE2 (0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b)
- 2026-02-11: Updated liquidity script to burn LP tokens to dead address for permanent lock
- 2026-02-11: Registered Jacob on ERC-8004 IdentityRegistry (Agent ID #2894, BSC)
- 2026-02-11: Registered Jacob on NFA Register contract (Agent ID #2168, 0xd7de...)
- 2026-02-11: Registered Jacob on official BAP-578 PlatformRegistry (Agent ID #141, WEBAPI connection)
- 2026-02-11: Minted Jacob agent on official BAP578 contract at 0x15b15DF2fFFF6653C21C11b93fB8A7718CE854Ce
- All 10 contracts compile successfully with Hardhat

## Tokenomics (AI Agent-Focused)
- **Agent Liquidity Pool**: 25% (250,000 JACOB) - PancakeSwap DEX liquidity
- **Agent Creation Treasury**: 20% (200,000 JACOB) - Agent minting rewards
- **Agent Operations Fund**: 20% (200,000 JACOB) - Agent vault funding
- **Ecosystem Development**: 15% (150,000 JACOB) - AI models, tools, integrations
- **Team**: 10% (100,000 JACOB) - 12-month cliff, 24-month vest
- **Community & Early Adopters**: 9% (90,000 JACOB) - Creator/user rewards
- **Airdrop**: 1% (10,000 JACOB) - Free tokens for registered interest wallets

## Token Vesting Contract
- **contracts/TokenVesting.sol** - On-chain vesting with cliff + linear release
- **scripts/deploy-vesting.js** - Deploy vesting contract and create schedules
- Team: 100,000 JACOB - 12-month cliff, 24-month linear vest
- Agent Creation Treasury: 200,000 JACOB - 3-month cliff, 12-month linear vest
- Ecosystem Development: 150,000 JACOB - 3-month cliff, 18-month linear vest
- 70% of supply is locked (45% vested + 25% LP burned)

## Scripts
- **scripts/deploy.js** - Deploy core 5 contracts to BSC mainnet
- **scripts/deploy-features.js** - Deploy feature 5 contracts (AgentProfile, AgentUpgrade, ReferralRewards, RevenueSharing, CompetitionManager)
- **scripts/deploy-vesting.js** - Deploy TokenVesting and lock team/treasury/ecosystem tokens
- **scripts/setup-liquidity.js** - Create PancakeSwap pair, add liquidity, and burn LP tokens
- **scripts/distribute-tokens.js** - Distribute tokens to allocation wallets
- **scripts/register-jacob.js** - Register Jacob on official BAP-578 PlatformRegistry
- **scripts/verify.js** - Verify contracts on BscScan
- **scripts/check_registry.js** - Utility to inspect PlatformRegistry contract

## Deployment Instructions
1. Set DEPLOYER_PRIVATE_KEY environment variable
2. Run: `npx hardhat run scripts/deploy.js --network bsc` (core contracts)
3. Run: `npx hardhat run scripts/deploy-features.js --network bsc` (feature contracts)
4. Set LIQUIDITY_BNB_AMOUNT and run: `npx hardhat run scripts/setup-liquidity.js --network bsc`
5. Set wallet env vars and run: `npx hardhat run scripts/distribute-tokens.js --network bsc`
