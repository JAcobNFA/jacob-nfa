const CONTRACTS = {
    jacobToken: '0x9d2a35f82cf36777A73a721f7cb22e5F86acc318',
    bap578: '0xfd8EeD47b61435f43B004fC65C5b76951652a8CE',
    agentMinter: '0xb053397547587fE5B999881e9b5C040889dD47C6',
    agentVault: '0x120192695152B8788277e46af1412002697B9F25',
    agentProfile: '0x2916515Bd7944d52D19943aC62DC76be54687C6E',
    agentUpgrade: '0x4FB6DDb012FC36cf2f7566011E41683E99280ae1',
    referralRewards: '0xEf65F548d76675DD06E7fbb460ea9D60FaBD5d32',
    revenueSharing: '0xE3824DA052032476272e6ff106fe33aB9959FD7e',
    competitionManager: ''
};

const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const BSC_CHAIN_ID = '0x38';
const TOTAL_SUPPLY = 1000000;

var _registryIdCache = null;
async function fetchRegistryIds() {
    if (_registryIdCache) return _registryIdCache;
    try {
        var resp = await fetch('/api/registry-ids');
        _registryIdCache = await resp.json();
    } catch(e) {
        _registryIdCache = {};
    }
    return _registryIdCache;
}
async function getRegistryId(localId) {
    var map = await fetchRegistryIds();
    return map[localId] || 0;
}

const TIER_NAMES = { 0: 'None', 1: 'Bronze', 2: 'Silver', 3: 'Gold', 4: 'Diamond', 5: 'Black' };
const TIER_CLASSES = { 1: 'bronze', 2: 'silver', 3: 'gold', 4: 'diamond', 5: 'black' };
const TIER_COSTS = { 1: 10, 2: 50, 3: 250, 4: 1000, 5: 10000 };
const TIER_IMAGES = { 1: '/images/nft-bronze.png', 2: '/images/nft-silver.png', 3: '/images/nft-gold.png', 4: '/images/nft-diamond.png', 5: '/images/nft-black.png' };
const TIER_FEES = { 1: '0.001', 2: '0.001', 3: '0.001', 4: '0.001', 5: '0.001' };

const TOKEN_ABI = [
    'function totalSupply() view returns (uint256)',
    'function totalBurned() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)'
];

const MINTER_ABI = [
    'function totalMinted() view returns (uint256)',
    'function totalTokensBurned() view returns (uint256)',
    'function tierMintCount(uint8) view returns (uint256)',
    'function mintAgent(uint8 tier) payable returns (uint256)',
    'function mintFee(uint8) view returns (uint256)',
    'function localToOfficialId(uint256) view returns (uint256)',
    'event AgentCreated(address indexed creator, uint256 indexed tokenId, uint8 tier, uint256 burnedAmount)'
];

const NFA_ABI = [
    'function totalSupply() view returns (uint256)',
    'function tokenByIndex(uint256) view returns (uint256)',
    'function ownerOf(uint256) view returns (address)',
    'function getAgentTier(uint256) view returns (uint8)',
    'function agentBurnedAmount(uint256) view returns (uint256)',
    'function tierCount(uint8) view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
    'event AgentMinted(uint256 indexed tokenId, address indexed to, uint8 tier, uint256 burnedAmount)'
];

const PROFILE_ABI = [
    'function setProfile(uint256 tokenId, string name, string bio, string avatar) external',
    'function getProfile(uint256 tokenId) view returns (string name, string bio, string avatar, uint256 createdAt, uint256 updatedAt)',
    'function isNameAvailable(string name) view returns (bool)',
    'function totalProfiles() view returns (uint256)'
];

const UPGRADE_ABI = [
    'function upgradeAgent(uint256 tokenId, uint8 targetTier) external',
    'function getUpgradeCost(uint256 tokenId, uint8 targetTier) view returns (uint256)',
    'function getEffectiveTier(uint256 tokenId) view returns (uint8)'
];

const REFERRAL_ABI = [
    'function registerAsReferrer() external',
    'function setReferrer(address referrer) external',
    'function getReferralCount(address referrer) view returns (uint256)',
    'function getReferralList(address referrer) view returns (address[])'
];

const REVENUE_ABI = [
    'function claimRevenue(uint256 epochId, uint256 tokenId) external',
    'function claimMultipleEpochs(uint256[] epochIds, uint256 tokenId) external',
    'function registerAgent(uint256 tokenId) external',
    'function registerAgentBatch(uint256[] tokenIds) external',
    'function currentEpoch() view returns (uint256)',
    'function totalRevenueDeposited() view returns (uint256)',
    'function totalRevenueClaimed() view returns (uint256)',
    'function cachedTotalShares() view returns (uint256)',
    'function registeredAgent(uint256 tokenId) view returns (bool)',
    'function agentTotalClaimed(uint256 tokenId) view returns (uint256)',
    'function getPendingReward(uint256 epochId, uint256 tokenId) view returns (uint256)',
    'function epochs(uint256) view returns (uint256 totalRevenue, uint256 totalShares, uint256 revenuePerShare, uint256 startTime, uint256 endTime, bool finalized)',
    'function claimed(uint256 epochId, uint256 tokenId) view returns (bool)',
    'function paused() view returns (bool)'
];

let provider;
let signer;
let walletConnected = false;
let userAddress = null;
let selectedTier = null;
let agentNameValid = false;
let agentNameValue = '';
let lastMintedTokenId = null;
let nameCheckTimeout = null;

async function initProvider() {
    provider = new ethers.providers.JsonRpcProvider(BSC_RPC);
}

async function connectWallet() {
    if (typeof closeHamburgerMenu === 'function') closeHamburgerMenu();

    if (typeof window.ethereum !== 'undefined') {
        try {
            await connectWithInjected(window.ethereum);
            return true;
        } catch (e) {
            console.error('Wallet connection failed:', e);
            alert('Failed to connect wallet: ' + (e.message || 'Unknown error'));
            return false;
        }
    }

    if (typeof showMobileWalletFallback === 'function') {
        showMobileWalletFallback();
    } else {
        alert('Please install MetaMask or a Web3 wallet to connect.');
    }
    return false;
}

async function connectWithInjected(ethereumProvider) {
    await ethereumProvider.request({ method: 'eth_requestAccounts' });

    const chainId = await ethereumProvider.request({ method: 'eth_chainId' });
    if (chainId !== BSC_CHAIN_ID) {
        try {
            await ethereumProvider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BSC_CHAIN_ID }],
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
                await ethereumProvider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: BSC_CHAIN_ID,
                        chainName: 'BNB Smart Chain',
                        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                        rpcUrls: ['https://bsc-dataseed.binance.org/'],
                        blockExplorerUrls: ['https://bscscan.com/']
                    }],
                });
            } else {
                alert('Please switch to BNB Smart Chain in your wallet.');
                return;
            }
        }
    }

    const web3Provider = new ethers.providers.Web3Provider(ethereumProvider);
    signer = web3Provider.getSigner();
    userAddress = await signer.getAddress();
    walletConnected = true;

    localStorage.setItem('jacob_wallet_connected', 'true');

    const btn = document.getElementById('connect-wallet-btn');
    btn.textContent = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
    btn.classList.add('connected');

    hideMobileConnectUI();
    enableButtons();
    await updateWalletInfo();
    loadMyAgents();

    if (ethereumProvider.on) {
        ethereumProvider.removeAllListeners && ethereumProvider.removeAllListeners('accountsChanged');
        ethereumProvider.removeAllListeners && ethereumProvider.removeAllListeners('chainChanged');
        ethereumProvider.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                localStorage.removeItem('jacob_wallet_connected');
            }
            location.reload();
        });
        ethereumProvider.on('chainChanged', () => location.reload());
    }
}

window.addEventListener('wallet-connected', async function(e) {
    try {
        var eth = e.detail.provider;
        var addr = e.detail.address;

        if (eth) {
            var web3Provider = new ethers.providers.Web3Provider(eth, 'any');
            signer = web3Provider.getSigner();
            userAddress = addr || (await signer.getAddress());
        } else if (addr) {
            userAddress = addr;
        }
        walletConnected = true;

        localStorage.setItem('jacob_wallet_connected', 'true');

        var btn = document.getElementById('connect-wallet-btn');
        if (btn && userAddress) {
            btn.textContent = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
            btn.classList.add('connected');
        }

        hideMobileConnectUI();
        enableButtons();
        try { await updateWalletInfo(); } catch(e2) {}
        loadMyAgents();
        loadYourRevenue();
    } catch (err) {
        console.error('Wallet connection handler error:', err);
    }
});

function hideMobileConnectUI() {
    var banner = document.getElementById('mobile-connect-banner');
    var fab = document.getElementById('mobile-fab-connect');
    var mintPrompt = document.getElementById('mint-connect-prompt');
    if (banner) banner.classList.add('wallet-connected');
    if (fab) fab.classList.add('wallet-connected');
    if (mintPrompt) mintPrompt.classList.add('wallet-connected');
}

function showMobileConnectUI() {
    var banner = document.getElementById('mobile-connect-banner');
    var fab = document.getElementById('mobile-fab-connect');
    var mintPrompt = document.getElementById('mint-connect-prompt');
    if (banner) banner.classList.remove('wallet-connected');
    if (fab) fab.classList.remove('wallet-connected');
    if (mintPrompt) mintPrompt.classList.remove('wallet-connected');
}

async function tryAutoConnect() {
    if (typeof window.ethereum === 'undefined') return;
    const wasConnected = localStorage.getItem('jacob_wallet_connected');
    if (!wasConnected) return;

    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
            await connectWithInjected(window.ethereum);
        } else {
            localStorage.removeItem('jacob_wallet_connected');
        }
    } catch (e) {
        console.error('Auto-connect failed:', e);
    }
}

function enableButtons() {
    document.querySelectorAll('.action-btn.connect-prompt').forEach(function(btn) {
        btn.classList.remove('connect-prompt');
        btn.textContent = btn.dataset.action || 'Submit';
    });
    var approveBtn = document.getElementById('approve-btn');
    if (approveBtn && walletConnected && selectedTier) {
        approveBtn.disabled = false;
    }
}

async function updateWalletInfo() {
    if (!walletConnected || !userAddress) return;
    try {
        const token = new ethers.Contract(CONTRACTS.jacobToken, TOKEN_ABI, provider);
        const [jacobBal, bnbBal] = await Promise.all([
            token.balanceOf(userAddress),
            provider.getBalance(userAddress)
        ]);

        const statusEl = document.getElementById('wallet-status');
        statusEl.style.display = 'block';
        document.getElementById('wallet-address-display').textContent = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
        document.getElementById('wallet-jacob-balance').textContent = parseFloat(ethers.utils.formatEther(jacobBal)).toFixed(2) + ' JACOB';
        document.getElementById('wallet-bnb-balance').textContent = parseFloat(ethers.utils.formatEther(bnbBal)).toFixed(4) + ' BNB';

        if (selectedTier) {
            document.getElementById('mint-your-balance').textContent = parseFloat(ethers.utils.formatEther(jacobBal)).toFixed(2) + ' JACOB';
        }
    } catch (e) {
        console.error('Error updating wallet info:', e);
    }
}

function selectTier(tier) {
    selectedTier = tier;
    lastMintedTokenId = null;
    agentNameValid = false;
    agentNameValue = '';

    document.querySelectorAll('.mint-tier-card').forEach(function(card) {
        card.classList.remove('selected');
    });
    var selectedCard = document.querySelector('.mint-tier-card[data-tier="' + tier + '"]');
    if (selectedCard) selectedCard.classList.add('selected');

    var panel = document.getElementById('mint-action-panel');
    panel.style.display = 'block';
    document.getElementById('selected-tier-name').textContent = TIER_NAMES[tier];
    document.getElementById('mint-burn-amount').textContent = TIER_COSTS[tier].toLocaleString() + ' JACOB';
    document.getElementById('mint-fee-amount').textContent = TIER_FEES[tier] + ' BNB';

    var nameInput = document.getElementById('agent-name-input');
    nameInput.value = '';
    nameInput.className = 'agent-name-input';
    document.getElementById('name-availability').textContent = '';
    document.getElementById('name-availability').className = 'name-availability';

    var approveBtn = document.getElementById('approve-btn');
    var mintBtn = document.getElementById('mint-btn');
    var profileBtn = document.getElementById('profile-btn');
    approveBtn.disabled = true;
    mintBtn.disabled = true;
    profileBtn.disabled = true;

    document.getElementById('step-name').classList.remove('done');
    document.getElementById('step-approve').classList.remove('done');
    document.getElementById('step-mint').classList.remove('done');
    document.getElementById('step-profile').classList.remove('done');
    document.getElementById('mint-status').textContent = '';

    if (walletConnected) {
        updateWalletInfo();
        checkAllowance();
    } else {
        document.getElementById('mint-your-balance').textContent = 'Connect wallet';
    }

    setTimeout(function() {
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

async function checkAllowance() {
    if (!walletConnected || !selectedTier) return;
    try {
        const token = new ethers.Contract(CONTRACTS.jacobToken, TOKEN_ABI, provider);
        const allowance = await token.allowance(userAddress, CONTRACTS.agentMinter);
        const needed = ethers.utils.parseEther(TIER_COSTS[selectedTier].toString());

        if (allowance.gte(needed)) {
            document.getElementById('step-approve').classList.add('done');
            document.getElementById('approve-btn').textContent = 'Approved';
            document.getElementById('approve-btn').disabled = true;
            if (agentNameValid) {
                document.getElementById('mint-btn').disabled = false;
            }
        } else {
            document.getElementById('step-approve').classList.remove('done');
            document.getElementById('approve-btn').textContent = 'Approve';
            if (agentNameValid) {
                document.getElementById('approve-btn').disabled = false;
            }
            document.getElementById('mint-btn').disabled = true;
        }
    } catch (e) {
        console.error('Allowance check failed:', e);
    }
}

async function checkNameAvailability(name) {
    var input = document.getElementById('agent-name-input');
    var avail = document.getElementById('name-availability');

    if (!name || name.trim().length === 0) {
        agentNameValid = false;
        agentNameValue = '';
        input.className = 'agent-name-input';
        avail.textContent = '';
        avail.className = 'name-availability';
        document.getElementById('step-name').classList.remove('done');
        document.getElementById('approve-btn').disabled = true;
        return;
    }

    name = name.trim();

    if (name.length < 1 || name.length > 32) {
        agentNameValid = false;
        input.className = 'agent-name-input name-taken';
        avail.textContent = name.length > 32 ? 'Name too long (max 32 chars)' : 'Name too short (min 1 char)';
        avail.className = 'name-availability taken';
        document.getElementById('step-name').classList.remove('done');
        document.getElementById('approve-btn').disabled = true;
        return;
    }

    avail.textContent = 'Checking availability...';
    avail.className = 'name-availability checking';

    try {
        var profile = new ethers.Contract(CONTRACTS.agentProfile, PROFILE_ABI, provider);
        var available = await profile.isNameAvailable(name);

        if (document.getElementById('agent-name-input').value.trim() !== name) return;

        if (available) {
            agentNameValid = true;
            agentNameValue = name;
            input.className = 'agent-name-input name-valid';
            avail.textContent = '"' + name + '" is available';
            avail.className = 'name-availability available';
            document.getElementById('step-name').classList.add('done');

            if (walletConnected && selectedTier) {
                checkAllowance();
            }
        } else {
            agentNameValid = false;
            agentNameValue = '';
            input.className = 'agent-name-input name-taken';
            avail.textContent = '"' + name + '" is already taken';
            avail.className = 'name-availability taken';
            document.getElementById('step-name').classList.remove('done');
            document.getElementById('approve-btn').disabled = true;
        }
    } catch (e) {
        console.error('Name check failed:', e);
        avail.textContent = 'Could not verify name. Try again.';
        avail.className = 'name-availability taken';
        agentNameValid = false;
    }
}

function debugLog(action, data) {
    try {
        fetch('/api/debug-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, ...data })
        }).catch(function() {});
    } catch(e) {}
}

function getWalletProvider() {
    if (typeof window.ethereum !== 'undefined') return window.ethereum;
    return null;
}

async function ensureSigner() {
    if (signer && userAddress) {
        debugLog('ensureSigner', { result: 'reused', address: userAddress });
        return signer;
    }

    var eth = getWalletProvider();
    if (!eth) {
        throw new Error('No wallet provider found. Please reconnect your wallet.');
    }

    try {
        await eth.request({ method: 'eth_requestAccounts' }).catch(function(){});
    } catch(e) {}

    try {
        var chainId = await eth.request({ method: 'eth_chainId' });
        var chainIdNum = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
        if (chainIdNum !== 56) {
            debugLog('ensureSigner-switchingChain', { from: chainIdNum, to: 56 });
            await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_CHAIN_ID }] }).catch(function(switchErr) {
                if (switchErr.code === 4902) {
                    return eth.request({
                        method: 'wallet_addEthereumChain',
                        params: [{ chainId: BSC_CHAIN_ID, chainName: 'BNB Smart Chain', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: ['https://bsc-dataseed.binance.org/'], blockExplorerUrls: ['https://bscscan.com/'] }]
                    });
                }
            });
            await new Promise(function(r) { setTimeout(r, 1000); });
        }
    } catch(e) {
        debugLog('ensureSigner-chainSwitch-error', { error: e.message });
    }

    var web3Provider = new ethers.providers.Web3Provider(eth, 'any');
    signer = web3Provider.getSigner();
    userAddress = await signer.getAddress();
    walletConnected = true;
    debugLog('ensureSigner', { result: 'created', address: userAddress });
    return signer;
}

async function connectAndGetProvider(statusEl) {
    if (walletConnected && signer && userAddress) {
        return getWalletProvider() || true;
    }
    var eth = getWalletProvider();
    if (eth) return eth;

    if (statusEl) {
        statusEl.textContent = 'No wallet detected. Please connect your wallet first.';
        statusEl.className = 'mint-status error';
    }
    return null;
}

async function approveJacob() {
    var statusEl = document.getElementById('mint-status');
    var btn = document.getElementById('approve-btn');

    if (!selectedTier) {
        statusEl.textContent = 'Please select a tier first.';
        statusEl.className = 'mint-status error';
        return;
    }

    if (!agentNameValid || !agentNameValue) {
        statusEl.textContent = 'Please enter a valid, available agent name first.';
        statusEl.className = 'mint-status error';
        document.getElementById('agent-name-input').focus();
        return;
    }

    debugLog('approveClicked', {
        v: 8,
        selectedTier: selectedTier,
        walletConnected: walletConnected,
        hasSigner: !!signer,
        hasUserAddress: !!userAddress,
        hasEthereum: typeof window.ethereum !== 'undefined'
    });

    var eth = await connectAndGetProvider(statusEl);
    if (!eth) {
        statusEl.textContent = 'Could not connect wallet. Please connect using the button above, then try again.';
        statusEl.className = 'mint-status error';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Approving...';
    statusEl.textContent = 'Preparing approval transaction...';
    statusEl.className = 'mint-status pending';

    try {
        var activeSigner = await ensureSigner();
        debugLog('approveSignerReady', { address: userAddress });

        var token = new ethers.Contract(CONTRACTS.jacobToken, TOKEN_ABI, activeSigner);
        var amount = ethers.utils.parseEther(TIER_COSTS[selectedTier].toString());

        statusEl.textContent = 'Confirm the approval in your wallet app...';
        debugLog('approveSending', { token: CONTRACTS.jacobToken, spender: CONTRACTS.agentMinter, amount: TIER_COSTS[selectedTier] });

        var tx = await token.approve(CONTRACTS.agentMinter, amount);
        debugLog('approveTxSent', { hash: tx.hash });

        statusEl.textContent = 'Approval submitted! Waiting for confirmation on BSC...';
        await tx.wait();

        statusEl.textContent = 'Approved! You can now mint your agent.';
        statusEl.className = 'mint-status success';
        document.getElementById('step-approve').classList.add('done');
        btn.textContent = 'Approved';
        document.getElementById('mint-btn').disabled = false;
        debugLog('approveSuccess', { hash: tx.hash });
    } catch (e) {
        console.error('Approval failed:', e);
        debugLog('approveFailed', { error: e.message || String(e), code: e.code });
        var msg = e.reason || e.message || 'Transaction rejected';
        if (msg.includes('user rejected') || msg.includes('User denied')) {
            msg = 'Transaction was cancelled.';
        } else if (msg.includes('No wallet provider')) {
            msg = 'Wallet disconnected. Please reconnect and try again.';
        }
        statusEl.textContent = 'Approval failed: ' + msg;
        statusEl.className = 'mint-status error';
        btn.disabled = false;
        btn.textContent = 'Approve';
    }
}

async function mintAgent() {
    var statusEl = document.getElementById('mint-status');
    if (!selectedTier) {
        alert('Please select a tier first.');
        return;
    }
    if (!agentNameValid || !agentNameValue) {
        statusEl.textContent = 'Please enter a valid agent name before minting.';
        statusEl.className = 'mint-status error';
        document.getElementById('agent-name-input').focus();
        return;
    }
    var eth = await connectAndGetProvider(statusEl);
    if (!eth) {
        statusEl.textContent = 'Could not connect wallet. Please connect first.';
        statusEl.className = 'mint-status error';
        return;
    }

    var btn = document.getElementById('mint-btn');
    var statusEl = document.getElementById('mint-status');
    btn.disabled = true;
    btn.textContent = 'Minting...';
    statusEl.textContent = 'Sending mint transaction...';
    statusEl.className = 'mint-status pending';

    try {
        var activeSigner = await ensureSigner();
        var minter = new ethers.Contract(CONTRACTS.agentMinter, MINTER_ABI, activeSigner);
        var fee = ethers.utils.parseEther(TIER_FEES[selectedTier]);

        var tx = await minter.mintAgent(selectedTier, {
            value: fee,
            gasLimit: 2000000
        });

        statusEl.textContent = 'Mint transaction submitted! Waiting for confirmation...';

        var receipt = await tx.wait();

        var event = receipt.events && receipt.events.find(function(ev) { return ev.event === 'AgentCreated'; });
        var tokenId = '?';
        if (event) {
            tokenId = event.args.tokenId.toString();
            lastMintedTokenId = parseInt(tokenId);
        }

        var displayMintId = tokenId;
        try {
            var regId = await getRegistryId(lastMintedTokenId);
            if (regId > 0) displayMintId = regId.toString();
        } catch(e) {}

        document.getElementById('step-mint').classList.add('done');
        statusEl.innerHTML = 'Agent ID: ' + displayMintId + ' minted! Now set the on-chain profile name...';
        statusEl.className = 'mint-status success';
        btn.textContent = 'Minted!';

        document.getElementById('agent-name-input').readOnly = true;

        if (lastMintedTokenId && agentNameValid) {
            document.getElementById('profile-btn').disabled = false;
        }

        await updateWalletInfo();
        loadBurnData();
        loadLeaderboard();
    } catch (e) {
        console.error('Mint failed:', e);
        var errMsg = e.reason || e.message || 'Transaction failed';
        if (errMsg.includes('Insufficient JACOB')) errMsg = 'Not enough JACOB tokens. You need ' + TIER_COSTS[selectedTier] + ' JACOB.';
        if (errMsg.includes('Insufficient BNB')) errMsg = 'Not enough BNB for the mint fee (' + TIER_FEES[selectedTier] + ' BNB).';
        if (errMsg.includes('user rejected')) errMsg = 'Transaction was rejected in your wallet.';

        statusEl.textContent = 'Mint failed: ' + errMsg;
        statusEl.className = 'mint-status error';
        btn.disabled = false;
        btn.textContent = 'Mint';
    }
}

async function setAgentProfile() {
    var statusEl = document.getElementById('mint-status');
    var btn = document.getElementById('profile-btn');

    if (!lastMintedTokenId) {
        statusEl.textContent = 'No agent to name. Please mint an agent first.';
        statusEl.className = 'mint-status error';
        return;
    }

    if (!agentNameValid || !agentNameValue) {
        statusEl.textContent = 'Invalid agent name. Please check the name field.';
        statusEl.className = 'mint-status error';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Setting...';
    var profileDisplayId = lastMintedTokenId;
    try {
        var regId = await getRegistryId(lastMintedTokenId);
        if (regId > 0) profileDisplayId = regId;
    } catch(e) {}

    statusEl.textContent = 'Setting on-chain profile for agent ID: ' + profileDisplayId + '...';
    statusEl.className = 'mint-status pending';

    try {
        var activeSigner = await ensureSigner();
        var profileContract = new ethers.Contract(CONTRACTS.agentProfile, PROFILE_ABI, activeSigner);

        statusEl.textContent = 'Confirm the profile transaction in your wallet...';
        var tx = await profileContract.setProfile(lastMintedTokenId, agentNameValue, '', '');

        statusEl.textContent = 'Profile transaction submitted! Waiting for confirmation...';
        await tx.wait();

        document.getElementById('step-profile').classList.add('done');
        statusEl.innerHTML = 'Agent ID: ' + profileDisplayId + ' named "' + agentNameValue + '" on-chain! <a href="https://bscscan.com/tx/' + tx.hash + '" target="_blank" style="color: var(--accent);">View on BscScan</a>';
        statusEl.className = 'mint-status success';
        btn.textContent = 'Done!';

        loadMyAgents();
    } catch (e) {
        console.error('Set profile failed:', e);
        var errMsg = e.reason || e.message || 'Transaction failed';
        if (errMsg.includes('user rejected') || errMsg.includes('User denied')) {
            errMsg = 'Transaction was cancelled.';
        } else if (errMsg.includes('Name already taken')) {
            errMsg = 'This name was just taken by someone else. Please choose a different name.';
            agentNameValid = false;
            document.getElementById('agent-name-input').className = 'agent-name-input name-taken';
            document.getElementById('name-availability').textContent = 'Name taken';
            document.getElementById('name-availability').className = 'name-availability taken';
        } else if (errMsg.includes('Not agent owner')) {
            errMsg = 'You do not own this agent.';
        }
        statusEl.textContent = 'Profile failed: ' + errMsg;
        statusEl.className = 'mint-status error';
        btn.disabled = false;
        btn.textContent = 'Set Name';
    }
}

async function loadBurnData() {
    try {
        const token = new ethers.Contract(CONTRACTS.jacobToken, TOKEN_ABI, provider);
        const minter = new ethers.Contract(CONTRACTS.agentMinter, MINTER_ABI, provider);
        const nfa = new ethers.Contract(CONTRACTS.bap578, NFA_ABI, provider);

        const [totalBurned, totalMinted, totalNFAs] = await Promise.all([
            minter.totalTokensBurned().catch(() => ethers.BigNumber.from(0)),
            minter.totalMinted().catch(() => ethers.BigNumber.from(0)),
            nfa.totalSupply().catch(() => ethers.BigNumber.from(0))
        ]);

        const burnedNum = parseFloat(ethers.utils.formatEther(totalBurned));
        const remaining = TOTAL_SUPPLY - burnedNum;
        const burnPct = (burnedNum / TOTAL_SUPPLY) * 100;

        document.getElementById('total-burned').textContent = formatNumber(burnedNum);
        document.getElementById('remaining-supply').textContent = formatNumber(remaining);
        document.getElementById('burn-percentage').textContent = burnPct.toFixed(2) + '%';
        document.getElementById('total-agents').textContent = totalMinted.toString();

        const burnBar = document.getElementById('burn-bar-fill');
        burnBar.style.width = Math.min(burnPct, 100) + '%';

        const ring = document.getElementById('countdown-ring');
        const circumference = 2 * Math.PI * 90;
        ring.style.strokeDashoffset = circumference - (circumference * burnPct / 100);
        document.getElementById('ring-percent').textContent = burnPct.toFixed(1) + '%';

        document.querySelectorAll('.milestone').forEach(ms => {
            const target = parseFloat(ms.dataset.target);
            if (burnPct >= target) ms.classList.add('reached');
        });

        for (let tier = 1; tier <= 5; tier++) {
            try {
                const count = await minter.tierMintCount(tier);
                const tierName = TIER_NAMES[tier].toLowerCase();
                const el = document.getElementById(tierName + '-count');
                if (el) el.textContent = count.toString() + ' minted';
            } catch (e) {}
        }
    } catch (e) {
        console.error('Error loading burn data:', e);
    }
}

async function loadLeaderboard() {
    try {
        const nfa = new ethers.Contract(CONTRACTS.bap578, NFA_ABI, provider);
        const totalSupply = await nfa.totalSupply();
        const count = totalSupply.toNumber();

        if (count === 0) return;

        const agents = [];
        const batchSize = Math.min(count, 20);

        for (let i = 0; i < batchSize; i++) {
            try {
                const tokenId = await nfa.tokenByIndex(i);
                const [owner, tier, burned] = await Promise.all([
                    nfa.ownerOf(tokenId),
                    nfa.getAgentTier(tokenId),
                    nfa.agentBurnedAmount(tokenId)
                ]);
                agents.push({
                    tokenId: tokenId.toNumber(),
                    owner,
                    tier,
                    burned: parseFloat(ethers.utils.formatEther(burned))
                });
            } catch (e) {}
        }

        agents.sort((a, b) => b.burned - a.burned);

        const body = document.getElementById('leaderboard-body');
        if (agents.length === 0) return;

        var profileContract = new ethers.Contract(CONTRACTS.agentProfile, PROFILE_ABI, provider);
        var registryMap = await fetchRegistryIds();
        await Promise.all(agents.map(async function(agent) {
            try {
                var p = await profileContract.getProfile(agent.tokenId);
                agent.profileName = p.name || '';
            } catch(e) {
                agent.profileName = '';
            }
            agent.registryId = registryMap[agent.tokenId] || 0;
        }));

        body.innerHTML = agents.map((agent, i) => `
            <div class="lb-row" data-tier="${agent.tier}">
                <span class="lb-col lb-rank">#${i + 1}</span>
                <span class="lb-col lb-avatar"><img src="${TIER_IMAGES[agent.tier] || '/images/nft-bronze.png'}" alt="${TIER_NAMES[agent.tier] || 'Agent'}" class="lb-agent-img" onerror="this.style.display='none'"></span>
                <span class="lb-col lb-id">${agent.profileName ? '<span class="agent-profile-name">' + agent.profileName + '</span> ' : ''}ID: ${agent.registryId || agent.tokenId}</span>
                <span class="lb-col lb-tier"><span class="tier-badge ${TIER_CLASSES[agent.tier] || ''}">${TIER_NAMES[agent.tier] || 'Unknown'}</span></span>
                <span class="lb-col lb-burned">${formatNumber(agent.burned)} JACOB</span>
                <span class="lb-col lb-owner">${agent.owner.slice(0, 6)}...${agent.owner.slice(-4)}</span>
            </div>
        `).join('');

        setupFilters();
    } catch (e) {
        console.error('Error loading leaderboard:', e);
    }
}

function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            document.querySelectorAll('.lb-row').forEach(row => {
                if (filter === 'all' || row.dataset.tier === filter) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    });
}

async function lookupProfile() {
    var tokenId = document.getElementById('lookup-token-id').value;
    var resultEl = document.getElementById('lookup-result');
    if (!tokenId || parseInt(tokenId) < 1) {
        resultEl.classList.remove('hidden');
        resultEl.innerHTML = '<p style="color:#ff4444;">Please enter a valid token ID.</p>';
        return;
    }

    resultEl.classList.remove('hidden');
    resultEl.innerHTML = '<p>Loading profile for Agent #' + tokenId + '...</p>';

    try {
        var profileC = new ethers.Contract(CONTRACTS.agentProfile, PROFILE_ABI, provider);
        var profile = await profileC.getProfile(parseInt(tokenId));
        var name = profile.name || '';
        var bio = profile.bio || '';
        var avatar = profile.avatar || '';

        var nfa = new ethers.Contract(CONTRACTS.bap578, NFA_ABI, provider);
        var tier = 1;
        try { tier = parseInt(await nfa.getAgentTier(parseInt(tokenId))); } catch(e) {}
        var tierName = TIER_NAMES[tier] || 'Unknown';

        var globalId = tokenId;
        try {
            var regData = await fetchRegistryIds();
            if (regData[tokenId]) globalId = regData[tokenId];
        } catch(e) {}

        if (!name) {
            resultEl.innerHTML = '<p>Agent #' + tokenId + ' exists but has no profile set yet.</p>' +
                '<p><strong>Tier:</strong> ' + tierName + '</p>' +
                '<p><strong>Global ID:</strong> #' + globalId + '</p>';
        } else {
            resultEl.innerHTML =
                '<div class="lookup-profile-card">' +
                    (avatar ? '<img src="' + avatar + '" class="lookup-avatar" onerror="this.style.display=\'none\'">' : '') +
                    '<div class="lookup-info">' +
                        '<p style="color: #f0b90b; font-family: Orbitron, monospace; font-weight: 700;">' + name + '</p>' +
                        '<p><strong>Tier:</strong> <span class="tier-badge ' + TIER_CLASSES[tier] + '">' + tierName + '</span></p>' +
                        '<p><strong>Global ID:</strong> #' + globalId + '</p>' +
                        (bio ? '<p><strong>Bio:</strong> ' + bio + '</p>' : '') +
                    '</div>' +
                '</div>';
        }
    } catch(e) {
        console.error('Lookup error:', e);
        resultEl.innerHTML = '<p style="color:#ff4444;">Could not find agent #' + tokenId + '. It may not exist yet.</p>';
    }
}

async function setProfile() {
    var tokenId = document.getElementById('profile-token-id').value;
    var name = document.getElementById('profile-name').value.trim();
    var bio = document.getElementById('profile-bio').value.trim();
    var avatar = document.getElementById('profile-avatar').value.trim();
    var btn = document.getElementById('set-profile-btn');

    if (!tokenId || parseInt(tokenId) < 1) {
        alert('Please enter your agent token ID.');
        return;
    }
    if (!name || name.length < 1 || name.length > 32) {
        alert('Agent name must be 1-32 characters.');
        return;
    }

    btn.textContent = 'Setting Profile...';
    btn.disabled = true;

    try {
        var activeSigner = await ensureSigner();
        var profileC = new ethers.Contract(CONTRACTS.agentProfile, PROFILE_ABI, activeSigner);

        var available = await profileC.isNameAvailable(name);
        if (!available) {
            alert('The name "' + name + '" is already taken. Please choose another.');
            btn.textContent = 'Set Profile';
            btn.disabled = false;
            return;
        }

        var tx = await profileC.setProfile(parseInt(tokenId), name, bio, avatar);
        btn.textContent = 'Confirming...';
        await tx.wait();

        alert('Profile set successfully! Agent "' + name + '" is now on-chain.');
        btn.textContent = 'Set Profile';
        btn.disabled = false;
    } catch(e) {
        console.error('Set profile error:', e);
        var msg = e.reason || e.message || 'Transaction failed';
        if (msg.includes('user rejected') || msg.includes('User denied')) msg = 'Transaction cancelled.';
        alert('Profile failed: ' + msg);
        btn.textContent = 'Set Profile';
        btn.disabled = false;
    }
}

async function upgradeAgent() {
    var tokenId = document.getElementById('upgrade-token-id').value;
    var targetTier = parseInt(document.getElementById('upgrade-target-tier').value);
    var btn = document.getElementById('upgrade-btn');

    if (!tokenId || parseInt(tokenId) < 1) {
        alert('Please enter your agent token ID.');
        return;
    }

    if (!CONTRACTS.agentUpgrade) {
        alert('AgentUpgrade contract address not configured yet. The upgrade feature will be activated once the contract address is added.');
        return;
    }

    btn.textContent = 'Upgrading...';
    btn.disabled = true;

    try {
        var activeSigner = await ensureSigner();

        var nfa = new ethers.Contract(CONTRACTS.bap578, NFA_ABI, provider);
        var currentTier = parseInt(await nfa.getAgentTier(parseInt(tokenId)));

        if (targetTier <= currentTier) {
            alert('Target tier must be higher than current tier (' + TIER_NAMES[currentTier] + ').');
            btn.textContent = 'Upgrade Agent';
            btn.disabled = false;
            return;
        }

        var upgradeCost = TIER_COSTS[targetTier] - TIER_COSTS[currentTier];

        var token = new ethers.Contract(CONTRACTS.jacobToken, TOKEN_ABI, activeSigner);
        var approveAmount = ethers.utils.parseEther(upgradeCost.toString());
        var allowance = await token.allowance(userAddress, CONTRACTS.agentUpgrade);

        if (allowance.lt(approveAmount)) {
            btn.textContent = 'Approving JACOB...';
            var approveTx = await token.approve(CONTRACTS.agentUpgrade, approveAmount);
            await approveTx.wait();
        }

        btn.textContent = 'Confirm upgrade...';
        var upgradeC = new ethers.Contract(CONTRACTS.agentUpgrade, UPGRADE_ABI, activeSigner);
        var tx = await upgradeC.upgradeAgent(parseInt(tokenId), targetTier);
        btn.textContent = 'Confirming...';
        await tx.wait();

        alert('Agent #' + tokenId + ' upgraded to ' + TIER_NAMES[targetTier] + '!');
        btn.textContent = 'Upgrade Agent';
        btn.disabled = false;
        loadBurnData();
    } catch(e) {
        console.error('Upgrade error:', e);
        var msg = e.reason || e.message || 'Transaction failed';
        if (msg.includes('user rejected') || msg.includes('User denied')) msg = 'Transaction cancelled.';
        alert('Upgrade failed: ' + msg);
        btn.textContent = 'Upgrade Agent';
        btn.disabled = false;
    }
}

async function registerReferrer() {
    var btn = document.getElementById('register-referrer-btn');

    if (!CONTRACTS.referralRewards) {
        alert('ReferralRewards contract address not configured yet. The referral feature will be activated once the contract address is added.');
        return;
    }

    btn.textContent = 'Registering...';
    btn.disabled = true;

    try {
        var activeSigner = await ensureSigner();
        var refC = new ethers.Contract(CONTRACTS.referralRewards, REFERRAL_ABI, activeSigner);
        var tx = await refC.registerAsReferrer();
        btn.textContent = 'Confirming...';
        await tx.wait();

        alert('You are now registered as a referrer! Share your wallet address to earn rewards.');
        btn.textContent = 'Registered';
    } catch(e) {
        console.error('Register referrer error:', e);
        var msg = e.reason || e.message || 'Transaction failed';
        if (msg.includes('user rejected') || msg.includes('User denied')) msg = 'Transaction cancelled.';
        alert('Registration failed: ' + msg);
        btn.textContent = 'Register';
        btn.disabled = false;
    }
}

async function setReferrer() {
    var address = document.getElementById('referrer-address').value.trim();
    var btn = document.getElementById('set-referrer-btn');

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        alert('Please enter a valid wallet address for your referrer.');
        return;
    }

    if (!CONTRACTS.referralRewards) {
        alert('ReferralRewards contract address not configured yet. The referral feature will be activated once the contract address is added.');
        return;
    }

    btn.textContent = 'Setting...';
    btn.disabled = true;

    try {
        var activeSigner = await ensureSigner();
        var refC = new ethers.Contract(CONTRACTS.referralRewards, REFERRAL_ABI, activeSigner);
        var tx = await refC.setReferrer(address);
        btn.textContent = 'Confirming...';
        await tx.wait();

        alert('Referrer set successfully! Your referrer will earn rewards when you mint agents.');
        btn.textContent = 'Set Referrer';
        btn.disabled = false;
    } catch(e) {
        console.error('Set referrer error:', e);
        var msg = e.reason || e.message || 'Transaction failed';
        if (msg.includes('user rejected') || msg.includes('User denied')) msg = 'Transaction cancelled.';
        alert('Set referrer failed: ' + msg);
        btn.textContent = 'Set Referrer';
        btn.disabled = false;
    }
}

var _revenueData = null;

async function loadRevenueData() {
    try {
        var resp = await fetch('/api/revenue');
        _revenueData = await resp.json();
        renderRevenueOverview(_revenueData);
        renderEpochHistory(_revenueData);
        if (walletConnected) loadYourRevenue();
    } catch(e) {
        console.error('Load revenue data error:', e);
    }
}

function formatBnb(val) {
    var n = parseFloat(val);
    if (isNaN(n) || n === 0) return '0 BNB';
    if (n < 0.0001) return n.toExponential(2) + ' BNB';
    return n.toFixed(4).replace(/\.?0+$/, '') + ' BNB';
}

function renderRevenueOverview(data) {
    var el = function(id) { return document.getElementById(id); };
    el('rev-total-deposited').textContent = formatBnb(data.totalDeposited);
    el('rev-total-claimed').textContent = formatBnb(data.totalClaimed);
    el('rev-contract-balance').textContent = formatBnb(data.contractBalance);
    el('rev-total-shares').textContent = data.totalShares;

    el('current-epoch').textContent = data.currentEpoch;
    el('epoch-revenue').textContent = formatBnb(data.activeEpoch.totalRevenue);
    el('epoch-status').textContent = data.activeEpoch.finalized ? 'Finalized' : 'Collecting';

    if (data.activeEpoch.startTime > 0) {
        var d = new Date(data.activeEpoch.startTime * 1000);
        el('epoch-start-time').textContent = 'Started ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    }
}

function renderEpochHistory(data) {
    var tbody = document.getElementById('epoch-history-body');
    if (!data.epochHistory || data.epochHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">No finalized epochs yet. Revenue is accumulating in Epoch #' + data.currentEpoch + '.</td></tr>';
        return;
    }

    var rows = '';
    data.epochHistory.forEach(function(ep) {
        var start = ep.startTime > 0 ? new Date(ep.startTime * 1000).toLocaleDateString() : '-';
        var end = ep.endTime > 0 ? new Date(ep.endTime * 1000).toLocaleDateString() : '-';
        var duration = (ep.startTime > 0 && ep.endTime > 0) ? Math.round((ep.endTime - ep.startTime) / 86400) + 'd' : '-';
        var status = ep.finalized ? '<span class="epoch-badge finalized">Finalized</span>' : '<span class="epoch-badge active">Active</span>';
        rows += '<tr>' +
            '<td style="color:var(--neon-gold);font-weight:700;">#' + ep.epochId + '</td>' +
            '<td>' + formatBnb(ep.totalRevenue) + '</td>' +
            '<td>' + ep.totalShares + '</td>' +
            '<td style="color:var(--neon-gold);">' + formatBnb(ep.revenuePerShare) + '</td>' +
            '<td>' + start + ' - ' + end + ' (' + duration + ')</td>' +
            '<td>' + status + '</td>' +
            '</tr>';
    });
    tbody.innerHTML = rows;
}

async function loadYourRevenue() {
    if (!walletConnected || !userAddress) return;
    var panel = document.getElementById('your-revenue-panel');
    panel.style.display = 'block';
    document.getElementById('your-revenue-loading').style.display = 'block';
    document.getElementById('your-revenue-content').style.display = 'none';

    try {
        var readProvider = new ethers.providers.Web3Provider(window.ethereum);
        var nfaC = new ethers.Contract(CONTRACTS.bap578, NFA_ABI, readProvider);
        var revC = new ethers.Contract(CONTRACTS.revenueSharing, REVENUE_ABI, readProvider);

        var balance = await nfaC.balanceOf(userAddress);
        var agentCount = Number(balance);
        if (agentCount === 0) {
            document.getElementById('your-revenue-loading').style.display = 'none';
            document.getElementById('your-revenue-content').style.display = 'block';
            document.getElementById('your-total-pending').textContent = '0 BNB';
            document.getElementById('your-total-claimed').textContent = '0 BNB';
            document.getElementById('your-agent-count').textContent = '0';
            document.getElementById('your-agents-revenue').innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:12px;">You don\'t own any agents yet.</div>';
            return;
        }

        var tokenIds = [];
        for (var i = 0; i < agentCount; i++) {
            var tid = await nfaC.tokenOfOwnerByIndex(userAddress, i);
            tokenIds.push(Number(tid));
        }

        var registrationChecks = tokenIds.map(function(tid) { return revC.registeredAgent(tid); });
        var claimedChecks = tokenIds.map(function(tid) { return revC.agentTotalClaimed(tid); });
        var tierChecks = tokenIds.map(function(tid) { return nfaC.getAgentTier(tid); });

        var regResults = await Promise.all(registrationChecks);
        var claimedResults = await Promise.all(claimedChecks);
        var tierResults = await Promise.all(tierChecks);

        var totalPending = ethers.BigNumber.from(0);
        var totalClaimedUser = ethers.BigNumber.from(0);
        var registeredCount = 0;

        var pendingPromises = [];
        if (_revenueData && _revenueData.epochHistory) {
            for (var a = 0; a < tokenIds.length; a++) {
                var agentPendingPromises = [];
                for (var ep = 0; ep < _revenueData.epochHistory.length; ep++) {
                    if (_revenueData.epochHistory[ep].finalized) {
                        agentPendingPromises.push(revC.getPendingReward(_revenueData.epochHistory[ep].epochId, tokenIds[a]));
                    }
                }
                pendingPromises.push(Promise.all(agentPendingPromises));
            }
        }

        var pendingResults = await Promise.all(pendingPromises);

        var agentRows = '';
        agentRows += '<div class="your-agent-rev-row your-agent-rev-header"><span>Agent</span><span>Tier</span><span>Status</span><span>Pending</span><span>Claimed</span></div>';

        for (var j = 0; j < tokenIds.length; j++) {
            var isReg = regResults[j];
            var claimed = claimedResults[j];
            var tier = Number(tierResults[j]);
            var tierName = TIER_NAMES[tier] || 'Unknown';

            if (isReg) registeredCount++;
            totalClaimedUser = totalClaimedUser.add(claimed);

            var agentPending = ethers.BigNumber.from(0);
            if (pendingResults[j]) {
                for (var p = 0; p < pendingResults[j].length; p++) {
                    agentPending = agentPending.add(pendingResults[j][p]);
                }
            }
            totalPending = totalPending.add(agentPending);

            var regBadge = isReg
                ? '<span class="agent-reg-status registered">Registered</span>'
                : '<span class="agent-reg-status unregistered">Not Registered</span>';

            agentRows += '<div class="your-agent-rev-row">' +
                '<span style="color:var(--neon-gold);font-weight:700;">#' + tokenIds[j] + '</span>' +
                '<span class="tier-badge ' + (TIER_CLASSES[tier] || '') + '">' + tierName + '</span>' +
                '<span>' + regBadge + '</span>' +
                '<span style="color:var(--neon-gold);">' + formatBnb(ethers.utils.formatEther(agentPending)) + '</span>' +
                '<span>' + formatBnb(ethers.utils.formatEther(claimed)) + '</span>' +
                '</div>';
        }

        document.getElementById('your-total-pending').textContent = formatBnb(ethers.utils.formatEther(totalPending));
        document.getElementById('your-total-claimed').textContent = formatBnb(ethers.utils.formatEther(totalClaimedUser));
        document.getElementById('your-agent-count').textContent = registeredCount + '/' + agentCount;
        document.getElementById('your-agents-revenue').innerHTML = agentRows;

        document.getElementById('your-revenue-loading').style.display = 'none';
        document.getElementById('your-revenue-content').style.display = 'block';
    } catch(e) {
        console.error('Load your revenue error:', e);
        document.getElementById('your-revenue-loading').innerHTML = '<span style="color:#ff5050;">Error loading revenue data. Please try again.</span>';
    }
}

async function registerAgentForRevenue() {
    var tokenId = document.getElementById('register-agent-id').value;
    var btn = document.getElementById('register-agent-btn');
    var status = document.getElementById('register-status');

    if (!tokenId || parseInt(tokenId) < 1) {
        alert('Please enter your agent token ID.');
        return;
    }

    btn.textContent = 'Registering...';
    btn.disabled = true;
    status.innerHTML = '';

    try {
        var activeSigner = await ensureSigner();
        var revC = new ethers.Contract(CONTRACTS.revenueSharing, REVENUE_ABI, activeSigner);

        var isReg = await revC.registeredAgent(parseInt(tokenId));
        if (isReg) {
            status.innerHTML = '<span style="color:#00ffaa;">Agent #' + tokenId + ' is already registered!</span>';
            btn.textContent = 'Register Agent';
            btn.disabled = false;
            return;
        }

        var tx = await revC.registerAgent(parseInt(tokenId));
        btn.textContent = 'Confirming...';
        await tx.wait();
        status.innerHTML = '<span style="color:#00ffaa;">Agent #' + tokenId + ' registered for revenue sharing!</span>';
        loadRevenueData();
    } catch(e) {
        console.error('Register agent error:', e);
        var msg = e.reason || e.message || 'Transaction failed';
        if (msg.includes('user rejected') || msg.includes('User denied')) msg = 'Transaction cancelled.';
        if (msg.includes('Already registered')) msg = 'Agent is already registered.';
        if (msg.includes('does not exist')) msg = 'Agent does not exist.';
        status.innerHTML = '<span style="color:#ff5050;">' + msg + '</span>';
    }
    btn.textContent = 'Register Agent';
    btn.disabled = false;
}

async function registerAllAgents() {
    var btn = document.getElementById('register-all-btn');
    btn.textContent = 'Registering...';
    btn.disabled = true;

    try {
        var activeSigner = await ensureSigner();
        var nfaC = new ethers.Contract(CONTRACTS.bap578, NFA_ABI, activeSigner);
        var revC = new ethers.Contract(CONTRACTS.revenueSharing, REVENUE_ABI, activeSigner);

        var balance = await nfaC.balanceOf(userAddress);
        var count = Number(balance);
        if (count === 0) {
            alert('You don\'t own any agents.');
            btn.textContent = 'Register All Agents';
            btn.disabled = false;
            return;
        }

        var unregistered = [];
        for (var i = 0; i < count; i++) {
            var tid = await nfaC.tokenOfOwnerByIndex(userAddress, i);
            var isReg = await revC.registeredAgent(Number(tid));
            if (!isReg) unregistered.push(Number(tid));
        }

        if (unregistered.length === 0) {
            alert('All your agents are already registered!');
            btn.textContent = 'Register All Agents';
            btn.disabled = false;
            return;
        }

        var tx = await revC.registerAgentBatch(unregistered);
        btn.textContent = 'Confirming...';
        await tx.wait();
        alert(unregistered.length + ' agent(s) registered for revenue sharing!');
        loadRevenueData();
    } catch(e) {
        console.error('Register all agents error:', e);
        var msg = e.reason || e.message || 'Transaction failed';
        if (msg.includes('user rejected') || msg.includes('User denied')) msg = 'Transaction cancelled.';
        alert('Registration failed: ' + msg);
    }
    btn.textContent = 'Register All Agents';
    btn.disabled = false;
}

async function claimAllRevenue() {
    var btn = document.getElementById('claim-all-btn');
    btn.textContent = 'Claiming...';
    btn.disabled = true;

    try {
        if (!_revenueData || !_revenueData.epochHistory || _revenueData.epochHistory.length === 0) {
            alert('No finalized epochs to claim from yet.');
            btn.textContent = 'Claim All Pending Revenue';
            btn.disabled = false;
            return;
        }

        var activeSigner = await ensureSigner();
        var nfaC = new ethers.Contract(CONTRACTS.bap578, NFA_ABI, activeSigner);
        var revC = new ethers.Contract(CONTRACTS.revenueSharing, REVENUE_ABI, activeSigner);

        var balance = await nfaC.balanceOf(userAddress);
        var count = Number(balance);
        if (count === 0) {
            alert('You don\'t own any agents.');
            btn.textContent = 'Claim All Pending Revenue';
            btn.disabled = false;
            return;
        }

        var finalizedEpochs = _revenueData.epochHistory
            .filter(function(ep) { return ep.finalized; })
            .map(function(ep) { return ep.epochId; });

        if (finalizedEpochs.length === 0) {
            alert('No finalized epochs available to claim.');
            btn.textContent = 'Claim All Pending Revenue';
            btn.disabled = false;
            return;
        }

        var claimedCount = 0;
        for (var i = 0; i < count; i++) {
            var tid = await nfaC.tokenOfOwnerByIndex(userAddress, i);
            var tokenId = Number(tid);

            var unclaimedEpochs = [];
            for (var e = 0; e < finalizedEpochs.length; e++) {
                var pending = await revC.getPendingReward(finalizedEpochs[e], tokenId);
                if (pending.gt(0)) unclaimedEpochs.push(finalizedEpochs[e]);
            }

            if (unclaimedEpochs.length > 0) {
                btn.textContent = 'Claiming Agent #' + tokenId + '...';
                var tx = await revC.claimMultipleEpochs(unclaimedEpochs, tokenId);
                await tx.wait();
                claimedCount++;
            }
        }

        if (claimedCount > 0) {
            alert('Revenue claimed for ' + claimedCount + ' agent(s)!');
        } else {
            alert('No pending revenue to claim.');
        }
        loadRevenueData();
    } catch(e) {
        console.error('Claim all revenue error:', e);
        var msg = e.reason || e.message || 'Transaction failed';
        if (msg.includes('user rejected') || msg.includes('User denied')) msg = 'Transaction cancelled.';
        if (msg.includes('already claimed')) msg = 'Revenue already claimed.';
        if (msg.includes('Nothing to claim')) msg = 'No pending rewards to claim.';
        alert('Claim failed: ' + msg);
    }
    btn.textContent = 'Claim All Pending Revenue';
    btn.disabled = false;
}

var upgradeCurrentTier = 1;

function setupUpgradeCalculator() {
    var tokenIdInput = document.getElementById('upgrade-token-id');
    var tierSelect = document.getElementById('upgrade-target-tier');
    var costDisplay = document.getElementById('upgrade-cost-value');

    function updateCost() {
        var targetTier = parseInt(tierSelect.value);
        if (targetTier > upgradeCurrentTier) {
            var cost = TIER_COSTS[targetTier] - TIER_COSTS[upgradeCurrentTier];
            costDisplay.textContent = formatNumber(cost) + ' JACOB (from ' + TIER_NAMES[upgradeCurrentTier] + ')';
        } else {
            costDisplay.textContent = 'Already at or above this tier';
        }
    }

    async function fetchTier() {
        var tokenId = tokenIdInput.value;
        if (!tokenId || parseInt(tokenId) < 1) { upgradeCurrentTier = 1; updateCost(); return; }
        try {
            var nfa = new ethers.Contract(CONTRACTS.bap578, NFA_ABI, provider);
            upgradeCurrentTier = parseInt(await nfa.getAgentTier(parseInt(tokenId)));
        } catch(e) {
            upgradeCurrentTier = 1;
        }
        updateCost();
    }

    tierSelect.addEventListener('change', updateCost);
    tokenIdInput.addEventListener('change', fetchTier);
    tokenIdInput.addEventListener('blur', fetchTier);
    updateCost();
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let mouse = { x: -1000, y: -1000 };

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = document.body.scrollHeight;
}
resize();
window.addEventListener('resize', resize);
document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY + window.scrollY; });

class Particle {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3;
        this.opacity = Math.random() * 0.5 + 0.1;
        this.color = ['#f0b90b', '#ffd54f', '#a855f7', '#64ffda'][Math.floor(Math.random() * 4)];
    }
    update() {
        this.x += this.speedX; this.y += this.speedY;
        const dx = mouse.x - this.x; const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) { this.x -= dx * 0.02; this.y -= dy * 0.02; this.opacity = Math.min(this.opacity + 0.02, 0.8); }
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
    }
    draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.globalAlpha = this.opacity; ctx.fill(); ctx.globalAlpha = 1;
    }
}

for (let i = 0; i < 60; i++) particles.push(new Particle());

function connectP() {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x; const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = '#f0b90b'; ctx.globalAlpha = 0.05 * (1 - dist / 150); ctx.lineWidth = 0.5;
                ctx.stroke(); ctx.globalAlpha = 1;
            }
        }
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    connectP();
    requestAnimationFrame(animate);
}
animate();

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
}, { threshold: 0.1 });

document.querySelectorAll('.glass-card, .section-header, .glass-panel').forEach(el => observer.observe(el));

async function loadJacobPrice() {
    try {
        const pairAbi = ['function getReserves() view returns (uint112,uint112,uint32)'];
        const pair = new ethers.Contract('0x1EED76a091e4E02aaEb6879590eeF53F27E9c520', pairAbi, provider);
        const [r0, r1] = await pair.getReserves();
        const jacobReserve = parseFloat(ethers.utils.formatEther(r0));
        const bnbReserve = parseFloat(ethers.utils.formatEther(r1));
        const priceInBnb = bnbReserve / jacobReserve;

        const priceEl = document.getElementById('jacob-price');
        if (priceEl) priceEl.textContent = priceInBnb.toFixed(8) + ' BNB';

        const liqEl = document.getElementById('jacob-liquidity');
        if (liqEl) liqEl.textContent = bnbReserve.toFixed(4) + ' BNB';
    } catch (e) {
        console.error('Error loading price:', e);
    }
}

async function loadMyAgents() {
    var container = document.getElementById('my-agents-container');
    if (!container) return;

    if (!walletConnected || !userAddress) {
        container.innerHTML = '<div class="my-agents-empty glass-card visible"><div class="empty-icon">&#x1f916;</div><p>Connect your wallet to see your agents</p></div>';
        return;
    }

    container.innerHTML = '<div class="my-agents-loading">Loading your agents...</div>';

    try {
        var nfa = new ethers.Contract(CONTRACTS.bap578, NFA_ABI, provider);
        var totalSupply = await nfa.totalSupply();
        var total = totalSupply.toNumber();
        var myAgents = [];

        for (var i = 0; i < total; i++) {
            try {
                var tokenId = await nfa.tokenByIndex(i);
                var owner = await nfa.ownerOf(tokenId);
                if (owner.toLowerCase() === userAddress.toLowerCase()) {
                    var tier = await nfa.getAgentTier(tokenId);
                    var burned = await nfa.agentBurnedAmount(tokenId);
                    myAgents.push({
                        tokenId: tokenId.toNumber(),
                        tier: typeof tier === 'number' ? tier : tier.toNumber ? tier.toNumber() : parseInt(tier),
                        burned: parseFloat(ethers.utils.formatEther(burned))
                    });
                }
            } catch (e) {
                console.warn('Error checking agent at index', i, e);
            }
        }

        if (myAgents.length === 0) {
            container.innerHTML = '<div class="my-agents-empty glass-card visible"><div class="empty-icon">&#x1f916;</div><p>You don\'t own any agents yet. Mint one above!</p></div>';
            return;
        }

        var profileContract = new ethers.Contract(CONTRACTS.agentProfile, PROFILE_ABI, provider);
        var registryMap = await fetchRegistryIds();
        await Promise.all(myAgents.map(async function(agent) {
            try {
                var p = await profileContract.getProfile(agent.tokenId);
                agent.profileName = p.name || '';
            } catch(e) {
                agent.profileName = '';
            }
            agent.registryId = registryMap[agent.tokenId] || 0;
        }));

        container.innerHTML = myAgents.map(function(agent) {
            var tierName = TIER_NAMES[agent.tier] || 'Unknown';
            var tierClass = TIER_CLASSES[agent.tier] || '';
            var tierImg = TIER_IMAGES[agent.tier] || '/images/nft-bronze.png';
            var displayId = agent.registryId || agent.tokenId;
            var nameHtml = agent.profileName ? '<div class="agent-profile-name">' + agent.profileName + '</div>' : '';
            return '<div class="my-agent-card glass-card visible">' +
                '<img src="' + tierImg + '" alt="' + tierName + ' Agent" class="agent-card-banner" onerror="this.style.display=\'none\'">' +
                '<div class="agent-card-body">' +
                    '<div class="agent-card-id">ID: ' + displayId + '</div>' +
                    nameHtml +
                    '<div class="agent-card-tier"><span class="tier-badge ' + tierClass + '">' + tierName + '</span></div>' +
                    '<div class="agent-card-stats">' +
                        '<div class="agent-stat"><div class="agent-stat-label">Burned</div><div class="agent-stat-value">' + formatNumber(agent.burned) + ' JACOB</div></div>' +
                        '<div class="agent-stat"><div class="agent-stat-label">Tier</div><div class="agent-stat-value">' + tierName + '</div></div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');

    } catch (e) {
        console.error('Error loading my agents:', e);
        container.innerHTML = '<div class="my-agents-empty glass-card visible"><div class="empty-icon">&#x26a0;</div><p>Error loading agents. Please try again.</p></div>';
    }
}

function createEmptyEl(msg) {
    var div = document.createElement('div');
    div.className = 'my-agents-empty glass-card';
    div.innerHTML = '<div class="empty-icon">&#x1f916;</div><p>' + msg + '</p>';
    return div;
}

document.addEventListener('DOMContentLoaded', async () => {
    await initProvider();
    await tryAutoConnect();
    if (walletConnected) {
        hideMobileConnectUI();
    }
    loadBurnData();
    loadLeaderboard();
    loadMyAgents();
    loadJacobPrice();
    loadRevenueData();
    setupUpgradeCalculator();

    setInterval(loadRevenueData, 60000);

    var nameInput = document.getElementById('agent-name-input');
    if (nameInput) {
        nameInput.addEventListener('input', function() {
            var val = this.value;
            agentNameValid = false;
            agentNameValue = '';
            document.getElementById('step-name').classList.remove('done');
            document.getElementById('approve-btn').disabled = true;
            document.getElementById('mint-btn').disabled = true;
            document.getElementById('profile-btn').disabled = true;

            if (nameCheckTimeout) clearTimeout(nameCheckTimeout);
            nameCheckTimeout = setTimeout(function() {
                checkNameAvailability(val);
            }, 500);
        });
    }

    setInterval(loadBurnData, 30000);
    setInterval(loadJacobPrice, 30000);
});

var DASH_TIER_DATA = {
    1: { name: 'Bronze', swap: '0.1 BNB', shares: 1, ai: 'Basic', cost: '10', color: '#cd7f32' },
    2: { name: 'Silver', swap: '0.5 BNB', shares: 2, ai: 'Analyst', cost: '50', color: '#c0c0c0' },
    3: { name: 'Gold', swap: '2 BNB', shares: 5, ai: 'Advisor', cost: '250', color: '#ffd700' },
    4: { name: 'Diamond', swap: '10 BNB', shares: 12, ai: 'Strategist', cost: '1,000', color: '#b9f2ff' },
    5: { name: 'Black', swap: 'Unlimited', shares: 25, ai: 'Autonomous', cost: '10,000', color: '#7c3aed' }
};

var DASH_ALL_CAPS = [
    { name: 'General Chat', minTier: 1 },
    { name: 'Platform FAQ', minTier: 1 },
    { name: 'Crypto Q&A', minTier: 1 },
    { name: 'Token Analysis', minTier: 2 },
    { name: 'Price Discussion', minTier: 2 },
    { name: 'Portfolio Advice', minTier: 3 },
    { name: 'Risk Scoring', minTier: 3 },
    { name: 'Entry/Exit Points', minTier: 3 },
    { name: 'Strategy Generation', minTier: 4 },
    { name: 'DeFi Analysis', minTier: 4 },
    { name: 'Cross-Token Analysis', minTier: 4 },
    { name: 'Autonomous Mode', minTier: 5 },
    { name: 'Whale Insights', minTier: 5 },
    { name: 'Priority Intelligence', minTier: 5 }
];

async function loadAgentDashboard() {
    var tokenId = document.getElementById('dash-agent-id').value;
    if (!tokenId || parseInt(tokenId) < 1) return;

    var tier = 1;
    var agentName = 'Agent #' + tokenId;
    var globalId = tokenId;

    try {
        if (nfaContract) {
            tier = parseInt(await nfaContract.getAgentTier(tokenId));
        }
    } catch(e) { console.log('Could not read tier from contract:', e.message); }

    try {
        if (profileContract) {
            var profile = await profileContract.getProfile(tokenId);
            if (profile && profile.name && profile.name.length > 0) {
                agentName = profile.name;
            }
        }
    } catch(e) {}

    try {
        var regRes = await fetch('/api/registry-ids');
        var regData = await regRes.json();
        if (regData[tokenId]) globalId = regData[tokenId];
    } catch(e) {}

    var td = DASH_TIER_DATA[tier] || DASH_TIER_DATA[1];

    document.getElementById('dash-agent-summary').classList.remove('hidden');
    document.getElementById('das-name').textContent = agentName;
    document.getElementById('das-name').style.color = '#f0b90b';
    document.getElementById('das-tier').textContent = td.name + ' Tier';
    document.getElementById('das-tier').style.color = td.color;
    document.getElementById('das-global-id').textContent = 'Global ID: #' + globalId;

    document.getElementById('dsb-swap-limit').textContent = td.swap;
    document.getElementById('dsb-shares').textContent = td.shares;
    document.getElementById('dsb-ai-level').textContent = td.ai;
    document.getElementById('dsb-burn-cost').textContent = td.cost;

    var capList = document.getElementById('dash-cap-list');
    capList.innerHTML = DASH_ALL_CAPS.map(function(cap) {
        var unlocked = tier >= cap.minTier;
        return '<div class="dash-cap-item">' +
            '<span class="dash-cap-dot ' + (unlocked ? 'active' : 'locked') + '"></span>' +
            '<span class="' + (unlocked ? '' : 'dash-cap-locked') + '">' + cap.name +
            (unlocked ? '' : ' <small>(Tier ' + cap.minTier + '+)</small>') +
            '</span></div>';
    }).join('');

    var hintEl = document.getElementById('dash-upgrade-hint');
    if (tier < 5) {
        var nextTier = DASH_TIER_DATA[tier + 1];
        hintEl.innerHTML = '<span style="color: var(--neon-cyan);">&#11014;</span> Upgrade to <strong style="color:' + nextTier.color + '">' + nextTier.name + '</strong> to unlock more AI features';
    } else {
        hintEl.innerHTML = '<span style="color: var(--neon-green);">&#10004;</span> All capabilities unlocked';
    }
}

function goToBot() {
    var agentId = document.getElementById('dash-agent-id').value;
    window.location.href = '/jacob.html' + (agentId ? '?agentId=' + agentId : '');
}

function scrollToSection(selector) {
    var el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function registerAgentCTA() {
    var tokenId = document.getElementById('register-agent-id-cta').value;
    var btn = document.getElementById('register-agent-cta-btn');
    var status = document.getElementById('rev-cta-status');

    if (!walletConnected) {
        await connectWallet();
        if (!walletConnected) return;
    }

    if (!tokenId || parseInt(tokenId) < 1) {
        status.innerHTML = '<span style="color:#ff5050;">Please enter a valid agent token ID</span>';
        return;
    }

    btn.textContent = 'Registering...';
    btn.disabled = true;
    status.innerHTML = '';

    try {
        var activeSigner = await ensureSigner();
        var revC = new ethers.Contract(CONTRACTS.revenueSharing, REVENUE_ABI, activeSigner);

        var isReg = await revC.registeredAgent(parseInt(tokenId));
        if (isReg) {
            status.innerHTML = '<span style="color:#00ffaa;">Agent #' + tokenId + ' is already registered for revenue sharing!</span>';
            btn.textContent = 'Register';
            btn.disabled = false;
            return;
        }

        var tx = await revC.registerAgent(parseInt(tokenId));
        btn.textContent = 'Confirming...';
        await tx.wait();
        status.innerHTML = '<span style="color:#00ffaa;">Agent #' + tokenId + ' is now earning revenue! Shares are active.</span>';
        loadRevenueData();
    } catch(e) {
        console.error('CTA register error:', e);
        var msg = e.reason || e.message || 'Transaction failed';
        if (msg.includes('user rejected') || msg.includes('User denied')) msg = 'Transaction cancelled.';
        if (msg.includes('Already registered')) msg = 'This agent is already registered.';
        if (msg.includes('does not exist')) msg = 'This agent does not exist. Check the token ID.';
        status.innerHTML = '<span style="color:#ff5050;">' + msg + '</span>';
    }
    btn.textContent = 'Register';
    btn.disabled = false;
}

async function registerAllAgentsCTA() {
    var btn = document.getElementById('register-all-cta-btn');
    var status = document.getElementById('rev-cta-status');

    if (!walletConnected) {
        await connectWallet();
        if (!walletConnected) return;
    }

    btn.textContent = 'Scanning agents...';
    btn.disabled = true;
    status.innerHTML = '';

    try {
        var activeSigner = await ensureSigner();
        var nfaC = new ethers.Contract(CONTRACTS.bap578, NFA_ABI, activeSigner);
        var revC = new ethers.Contract(CONTRACTS.revenueSharing, REVENUE_ABI, activeSigner);

        var balance = await nfaC.balanceOf(userAddress);
        var count = Number(balance);
        if (count === 0) {
            status.innerHTML = '<span style="color:#ff5050;">You don\'t own any agents yet. <a href="#mint-section" style="color:var(--accent);">Mint one first</a>.</span>';
            btn.textContent = 'Register All My Agents';
            btn.disabled = false;
            return;
        }

        var unregistered = [];
        for (var i = 0; i < count; i++) {
            var tid = await nfaC.tokenOfOwnerByIndex(userAddress, i);
            var isReg = await revC.registeredAgent(Number(tid));
            if (!isReg) unregistered.push(Number(tid));
        }

        if (unregistered.length === 0) {
            status.innerHTML = '<span style="color:#00ffaa;">All ' + count + ' of your agents are already registered!</span>';
            btn.textContent = 'Register All My Agents';
            btn.disabled = false;
            return;
        }

        btn.textContent = 'Registering ' + unregistered.length + ' agent(s)...';
        var tx = await revC.registerAgentBatch(unregistered);
        btn.textContent = 'Confirming...';
        await tx.wait();
        status.innerHTML = '<span style="color:#00ffaa;">' + unregistered.length + ' agent(s) registered! They\'re now earning revenue shares.</span>';
        loadRevenueData();
    } catch(e) {
        console.error('CTA register all error:', e);
        var msg = e.reason || e.message || 'Transaction failed';
        if (msg.includes('user rejected') || msg.includes('User denied')) msg = 'Transaction cancelled.';
        status.innerHTML = '<span style="color:#ff5050;">' + msg + '</span>';
    }
    btn.textContent = 'Register All My Agents';
    btn.disabled = false;
}
