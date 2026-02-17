# Jacob - BAP-578 Non-Fungible Agent Platform

## Overview
Jacob is a Non-Fungible Agent (NFA) platform on the BNB Smart Chain (BSC) that allows AI agents to exist as tradeable NFTs. It features a burn-to-mint mechanism, on-chain action execution, per-agent treasury management, agent profiles, tier-based upgrades, referral rewards, revenue sharing, and trading competitions. The platform's goal is to establish a decentralized ecosystem for AI agents to perform on-chain actions and participate in a digital economy.

## User Preferences
I want iterative development and detailed explanations. Ask before making major changes. Do not make changes to files related to deployment scripts unless explicitly requested.

## System Architecture

### UI/UX Decisions
The frontend uses a futuristic dark theme with glassmorphism, neon glows, and particle effects for a visually engaging experience. It includes a dashboard, dedicated feature pages, and an AI bot interface.

### Technical Implementations
The platform is built on 10 Solidity smart contracts on the BNB Smart Chain. Key components include:
- **BAP578NFA**: An ERC-721 enumerable NFA contract with UUPS upgradeability and a 5-tier system (Bronze, Silver, Gold, Diamond, Black).
- **JacobToken**: An optimized DN404/ERC-404 hybrid utility token.
- **AgentMinter (V4)**: Dynamic LP-oracle-based burn-to-mint system. Reads JACOB/BNB reserves from PancakeSwap LP pair to calculate JACOB burn cost in real-time. Tier costs defined in BNB terms; as token price rises (higher MC), fewer JACOB tokens need to be burned, keeping minting affordable. Safety bounds (min/max JACOB per tier) prevent manipulation. Contract: `contracts/AgentMinterV4.sol`. Deploy script: `scripts/deploy-minter-v4.js`. Set `AGENT_MINTER_V4_ADDRESS` env var after deployment.
- **AgentVault V2** (`0x120192695152B8788277e46af1412002697B9F25`): Per-agent treasury with PancakeSwap DEX, self-funded agent trades via `swapAgentBNBForTokens`, gas reimbursement via `reimburseGas`, and tier-based swap limits.
- **AgentController**: A lightweight contract for on-chain action execution.
- **Feature Contracts**:
    - **AgentProfile**: Enables on-chain agent naming, bios, and avatars with unique enforcement.
    - **AgentUpgrade**: Facilitates tier upgrades by burning JACOB tokens.
    - **ReferralRewards**: Implements a tier-scaled JACOB referral system.
    - **RevenueSharing**: Manages epoch-based BNB revenue distribution based on agent tier.
    - **CompetitionManager**: Supports agent trading battles with entry fees and prize pools.
- **AI Trading Bot**: An OpenAI-powered engine provides market analysis, trading advice, and risk assessment via a chat interface, with AI capabilities tiered based on agent level. Available on both web (jacob.html) and Telegram.
- **Telegram Bot**: Jacob AI accessible via Telegram (`src/telegram/bot.js`). Features: wallet linking (/wallet), agent detection (/agents), agent selection (/agent), live market data (/price), vault balance (/vault), tier capabilities (/tier), autopilot status (/status), and full AI chat with tier-gated responses. Uses TELEGRAM_BOT_TOKEN secret. Starts automatically with the server via polling.
- **Telegram Bot V2 Upgrades**: Interactive onboarding wizard with inline keyboard buttons (no typing needed), persistent reply keyboard menu with 9 quick-action buttons, callback query router for all inline buttons, referral system with deep links (t.me/AgentJacobot?start=ref_CODE) and share button, portfolio snapshot aggregating all agents + vault totals with USD conversion, price alerts (above/below thresholds, 60s checker), deep link buttons to web app (mint/trade/autopilot/chart), group chat safety (sensitive commands redirect to DM, AI only responds to mentions in groups), cached market data for performance.
- **Secure Wallet Verification**: Cryptographic signature verification for wallet ownership proof. Server generates nonces via /api/tg-wallet-nonce with 5-minute expiry and single-use enforcement. Users sign challenge message; server verifies via ethers.verifyMessage(). All linking paths require verification—no bypass vectors. Mini App (tg-wallet.html) provides 3-step flow: enter address → sign message → paste signature.
- **Custodial Wallet Generation**: One-tap wallet generation for Telegram users (`src/telegram/walletStore.js`). Private keys encrypted with AES-256-GCM using SESSION_SECRET, stored in `data/tg-wallets.json`. Users can export private keys anytime via /privatekey command or Export button. Wallets persist across bot restarts. Onboarding offers both "Generate New Wallet" (instant) and "Link Existing Wallet" (signature verification) options.
- **Instant Buy JACOB**: Telegram bot users can buy JACOB tokens directly inside the bot. Custodial wallet users get one-tap swap execution via PancakeSwap V2 Router (swapExactETHForTokensSupportingFeeOnTransferTokens). Preset amounts (0.01-1 BNB) + custom amount input (0.001-5 BNB). 12% slippage tolerance for tax tokens. Confirmation step before execution. Shows TX hash with BscScan link, updated balances. Linked wallet users get direct PancakeSwap deep link. /buy command and keyboard button.
- **Autonomous Execution Layer**: Server-side keeper service that enables AI-driven autonomous trading for Diamond/Black tier agents. Uses DEPLOYER_PRIVATE_KEY to execute trades via AgentVault's owner authority. Features: AI signal generation via OpenAI, 3 strategy profiles (conservative/balanced/aggressive), safety controls (max trade size, daily caps, cooldowns, stop-loss/take-profit, slippage limits), on-chain tier verification for opt-in, persistent JSON configs, comprehensive trade logging, and simulation mode. Files: `src/autoTrade/store.js` (config persistence), `src/autoTrade/keeper.js` (execution engine). Keeper runs every 120s. API: `/api/auto-trade/enable|disable|status|simulate|logs|strategies`.
- **Agent Self-Funding & Gas Reimbursement**: Agents use their own vault BNB for trades via `swapAgentBNBForTokens` (with fallback to `swapBNBForTokens` for old vault). After each trade, keeper calls `reimburseGas` to deduct actual gas cost from the agent's vault BNB and reimburse the deployer. Gas reimbursement is capped at 0.005 BNB per trade for safety. Deploy script: `scripts/deploy-vault-v2.js`. After deploying, update `AGENT_VAULT_ADDRESS` in keeper.js, bot.js, server.js.
- **Revenue Streams**: Fees are generated from agent minting, a 1% fee on AgentVault DEX swaps, and 5% of competition prize pools, with distribution to owner and agent holders.
- **Tokenomics**: JACOB token supply is allocated across operations, creation treasury, ecosystem, LP, team, community & airdrop, and strategic reserve, with a significant portion locked.
- **NFT Metadata**: NFT images are hosted and served via a `baseImageURI` for dynamic display.

### Feature Specifications
- **Burn-to-Mint Agent Creation**: Users burn JACOB tokens to mint tiered agent NFTs, with varying burn costs by tier.
- **Tier-based Benefits**: Agents receive scaled benefits, including swap limits and shares in revenue distribution.
- **On-chain Profiles**: Agents can have unique, on-chain names, bios, and avatars.
- **Tier-Gated AI System**: A 5-level AI capability system (Bronze to Black) with server-side on-chain tier verification and agent ownership validation. Tier is verified via BSC RPC (not trusted from client). Ownership is checked to prevent users from borrowing another user's high-tier agent ID.
- **Security Hardening**: Rate limiting on all OpenAI/expensive endpoints (15/min chat, 5/min analysis), server-side scan tracking (prevents localStorage bypass), path traversal protection on ABI endpoint (whitelist), wallet list endpoint sanitized, debug log sanitized and capped, request body size limited to 50KB.
- **Coach's Game Plan**: Data-driven personalized advice summary in the wallet analyzer, generating actionable recommendations based on win rate, hold time patterns, position sizing, gas efficiency, profit factor, streaks, and portfolio review. Color-coded cards (warn/tip/good/info) with detailed explanations.
- **LP Health Monitor**: Real-time liquidity pool health tracking via DexScreener API. Displays MC, LP, and LP/MC ratio in ticker bar with color-coded health status (Healthy >=20%, Moderate >=10%, Low >=5%, Critical <5%). Full widget with gauge bar, stats grid, and advisory message. Auto-refreshes every 60s.
- **Multi-Currency Wallet Analyzer**: Wallet analyzer correctly tracks and displays the actual quote currency per token trade (BNB vs USD). Stablecoin trades (USDT/BUSD/BSC-USD) display as "USD" instead of incorrectly labeling as "BNB".
- **Revenue Sharing System**: Tracks and distributes revenue generated by the platform to eligible agent holders, with an epoch-based claiming mechanism.
- **Autonomous Trading UI**: Dedicated `/autotrade.html` page consolidating all autonomous trading features. Includes wallet connection, agent selection (Diamond+ only), vault BNB balance display with deposit instructions, balance gating (blocks enable toggle until vault has >= 0.001 BNB), control panel with strategy selector and risk parameters, live status with trade counts/volume/daily spend, activity log with BscScan TX links, and simulation mode. Jacob.html links to autotrade page instead of embedding controls. Navigation updated across all pages (Auto Trade replaces Test link).
- **JacobTokenV2 Auto-LP**: Upgraded token contract with 2% transfer tax on PancakeSwap buys/sells that auto-adds liquidity. Tax self-disables when LP/MC ratio reaches 20%. Admin controls for rate, threshold, and manual swap. Storage-compatible with V1.
- **Global NFA Registry Integration**: Agents are registered on the ERC-8004 IdentityRegistry for broader ecosystem compatibility.
- **BAP-578 Dual Registry Auto-Registration**: Every minted agent is automatically registered on BOTH global registries simultaneously:
    - **PlatformRegistry** (`0x15b15DF2fFFF6653C21C11b93fB8A7718CE854Ce`): Permissionless, no fee. Uses `createAgent(owner, nfaContract, metadataURI)`.
    - **NFA Register** (`0xd7Deb29ddBB13607375Ce50405A574AC2f7d978d`): 0.01 BNB fee per registration. Uses `createAgent(address,address,string,(string,string,string,string,string,bytes32))` with struct config (traits, name, description, animation, avatar, reserved). Logic address: `0x1017CD09a86D92b4CBe74CD765eD4B78Ea82a356`.
    - Both registrations run independently — one failure doesn't block the other. DEPLOYER_PRIVATE_KEY funds the 0.01 BNB NFA Register fee. Metadata pinned to IPFS via Pinata with base64 fallback. API endpoint `/api/register-global` handles both registries. Telegram mint flow shows both registry IDs on success.

## External Dependencies

- **BNB Smart Chain (BSC)**: Primary blockchain network.
- **PancakeSwap DEX**: Integrated into AgentVault for DEX functionalities (Router: `0x10ED43C718714eb63d5aA57B78B54704E256024E`, Factory: `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73`).
- **OpenAI**: Powers the AI trading bot (gpt-5-mini model).
- **DexScreener API**: Provides live market data for JACOB token.
- **Etherscan V2 API**: Powers wallet performance analyzer with BSC token transfers, internal transactions, and normal transactions. Requires paid Etherscan plan for BSC (chain ID 56) access. Uses `BSCSCAN_API_KEY` secret. Endpoints: `tokentx`, `txlistinternal`, `txlist`.
- **BAP-578 Registries**:
    - **ERC-8004 Trustless Agents (IdentityRegistry)**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
    - **NFA Register (Primary)**: `0xd7deb29ddbb13607375ce50405a574ac2f7d978d`
    - **Official BAP578 PlatformRegistry**: `0x15b15DF2fFFF6653C21C11b93fB8A7718CE854Ce`