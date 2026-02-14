const CONTRACTS = {
    jacobToken: '0x94F837c740Bd0EFc15331F578c255f6d3dd7ac0b',
    bap578: '0xfd8EeD47b61435f43B004fC65C5b76951652a8CE',
    agentMinter: '0x3Ea9ef96EFDAa4A172ce08f1F06F54A04cA2892D',
    agentVault: '0xc9Bb89E036BD17F8E5016C89D0B6104F8912ac8A'
};

const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const BSC_CHAIN_ID = '0x38';
const TOTAL_SUPPLY = 1000000;

const TIER_NAMES = { 0: 'None', 1: 'Bronze', 2: 'Silver', 3: 'Gold', 4: 'Diamond', 5: 'Black' };
const TIER_CLASSES = { 1: 'bronze', 2: 'silver', 3: 'gold', 4: 'diamond', 5: 'black' };
const TIER_COSTS = { 1: 10, 2: 50, 3: 250, 4: 1000, 5: 10000 };
const TIER_FEES = { 1: '0.0015', 2: '0.0015', 3: '0.0015', 4: '0.0015', 5: '0.0015' };

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
    'event AgentCreated(address indexed creator, uint256 indexed tokenId, uint8 tier, uint256 burnedAmount)'
];

const NFA_ABI = [
    'function totalSupply() view returns (uint256)',
    'function tokenByIndex(uint256) view returns (uint256)',
    'function ownerOf(uint256) view returns (address)',
    'function getAgentTier(uint256) view returns (uint8)',
    'function agentBurnedAmount(uint256) view returns (uint256)',
    'function tierCount(uint8) view returns (uint256)',
    'event AgentMinted(uint256 indexed tokenId, address indexed to, uint8 tier, uint256 burnedAmount)'
];

let provider;
let signer;
let walletConnected = false;
let userAddress = null;
let selectedTier = null;

async function initProvider() {
    provider = new ethers.providers.JsonRpcProvider(BSC_RPC);
}

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask or a Web3 wallet to connect.');
        return false;
    }
    try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });

        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== BSC_CHAIN_ID) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: BSC_CHAIN_ID }],
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await window.ethereum.request({
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
                    return false;
                }
            }
        }

        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = web3Provider.getSigner();
        userAddress = await signer.getAddress();
        walletConnected = true;

        const btn = document.getElementById('connect-wallet-btn');
        btn.textContent = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
        btn.classList.add('connected');

        enableButtons();
        await updateWalletInfo();

        window.ethereum.on('accountsChanged', () => location.reload());
        window.ethereum.on('chainChanged', () => location.reload());

        return true;
    } catch (e) {
        console.error('Wallet connection failed:', e);
        alert('Failed to connect wallet: ' + (e.message || 'Unknown error'));
        return false;
    }
}

function enableButtons() {
    document.querySelectorAll('.action-btn:disabled').forEach(btn => {
        if (btn.textContent.includes('Connect Wallet')) {
            btn.disabled = false;
            btn.textContent = btn.dataset.action || 'Submit';
        }
    });
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

    document.querySelectorAll('.mint-tier-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`.mint-tier-card[data-tier="${tier}"]`).classList.add('selected');

    const panel = document.getElementById('mint-action-panel');
    panel.style.display = 'block';
    document.getElementById('selected-tier-name').textContent = TIER_NAMES[tier];
    document.getElementById('mint-burn-amount').textContent = TIER_COSTS[tier].toLocaleString() + ' JACOB';
    document.getElementById('mint-fee-amount').textContent = TIER_FEES[tier] + ' BNB';

    document.getElementById('approve-btn').disabled = !walletConnected;
    document.getElementById('mint-btn').disabled = true;
    document.getElementById('mint-status').textContent = '';

    if (walletConnected) {
        updateWalletInfo();
        checkAllowance();
    } else {
        document.getElementById('mint-your-balance').textContent = 'Connect wallet';
    }

    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
            document.getElementById('mint-btn').disabled = false;
        } else {
            document.getElementById('step-approve').classList.remove('done');
            document.getElementById('approve-btn').textContent = 'Approve';
            document.getElementById('approve-btn').disabled = false;
            document.getElementById('mint-btn').disabled = true;
        }
    } catch (e) {
        console.error('Allowance check failed:', e);
    }
}

async function approveJacob() {
    if (!walletConnected || !selectedTier) {
        alert('Please connect your wallet first.');
        return;
    }

    const btn = document.getElementById('approve-btn');
    const statusEl = document.getElementById('mint-status');
    btn.disabled = true;
    btn.textContent = 'Approving...';
    statusEl.textContent = 'Waiting for approval transaction...';
    statusEl.className = 'mint-status pending';

    try {
        const token = new ethers.Contract(CONTRACTS.jacobToken, TOKEN_ABI, signer);
        const amount = ethers.utils.parseEther(TIER_COSTS[selectedTier].toString());
        const tx = await token.approve(CONTRACTS.agentMinter, amount);
        statusEl.textContent = 'Approval submitted. Waiting for confirmation...';
        await tx.wait();

        statusEl.textContent = 'Approved! You can now mint your agent.';
        statusEl.className = 'mint-status success';
        document.getElementById('step-approve').classList.add('done');
        btn.textContent = 'Approved';
        document.getElementById('mint-btn').disabled = false;
    } catch (e) {
        console.error('Approval failed:', e);
        statusEl.textContent = 'Approval failed: ' + (e.reason || e.message || 'Transaction rejected');
        statusEl.className = 'mint-status error';
        btn.disabled = false;
        btn.textContent = 'Approve';
    }
}

async function mintAgent() {
    if (!walletConnected || !selectedTier) {
        alert('Please connect your wallet and select a tier first.');
        return;
    }

    const btn = document.getElementById('mint-btn');
    const statusEl = document.getElementById('mint-status');
    btn.disabled = true;
    btn.textContent = 'Minting...';
    statusEl.textContent = 'Sending mint transaction...';
    statusEl.className = 'mint-status pending';

    try {
        const minter = new ethers.Contract(CONTRACTS.agentMinter, MINTER_ABI, signer);
        const fee = ethers.utils.parseEther(TIER_FEES[selectedTier]);

        const tx = await minter.mintAgent(selectedTier, {
            value: fee,
            gasLimit: 2000000
        });

        statusEl.textContent = 'Mint transaction submitted! Waiting for confirmation...';

        const receipt = await tx.wait();

        const event = receipt.events?.find(e => e.event === 'AgentCreated');
        let tokenId = '?';
        if (event) {
            tokenId = event.args.tokenId.toString();
        }

        statusEl.innerHTML = 'Agent #' + tokenId + ' minted successfully! <a href="https://bscscan.com/tx/' + tx.hash + '" target="_blank" style="color: var(--accent);">View on BscScan</a>';
        statusEl.className = 'mint-status success';
        btn.textContent = 'Minted!';

        await updateWalletInfo();
        loadBurnData();
        loadLeaderboard();
    } catch (e) {
        console.error('Mint failed:', e);
        let errMsg = e.reason || e.message || 'Transaction failed';
        if (errMsg.includes('Insufficient JACOB')) errMsg = 'Not enough JACOB tokens. You need ' + TIER_COSTS[selectedTier] + ' JACOB.';
        if (errMsg.includes('Insufficient BNB')) errMsg = 'Not enough BNB for the mint fee (' + TIER_FEES[selectedTier] + ' BNB).';
        if (errMsg.includes('user rejected')) errMsg = 'Transaction was rejected in your wallet.';

        statusEl.textContent = 'Mint failed: ' + errMsg;
        statusEl.className = 'mint-status error';
        btn.disabled = false;
        btn.textContent = 'Mint';
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

        body.innerHTML = agents.map((agent, i) => `
            <div class="lb-row" data-tier="${agent.tier}">
                <span class="lb-col lb-rank">#${i + 1}</span>
                <span class="lb-col lb-id">Agent #${agent.tokenId}</span>
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

function setupUpgradeCalculator() {
    const tokenIdInput = document.getElementById('upgrade-token-id');
    const tierSelect = document.getElementById('upgrade-target-tier');
    const costDisplay = document.getElementById('upgrade-cost-value');

    function updateCost() {
        const targetTier = parseInt(tierSelect.value);
        const currentTier = 1;
        if (targetTier > currentTier) {
            const cost = TIER_COSTS[targetTier] - TIER_COSTS[currentTier];
            costDisplay.textContent = formatNumber(cost) + ' JACOB';
        } else {
            costDisplay.textContent = '--';
        }
    }

    tierSelect.addEventListener('change', updateCost);
    tokenIdInput.addEventListener('input', updateCost);
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
        this.color = ['#f0b90b', '#00f0ff', '#a855f7', '#64ffda'][Math.floor(Math.random() * 4)];
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

document.addEventListener('DOMContentLoaded', async () => {
    await initProvider();
    loadBurnData();
    loadLeaderboard();
    setupUpgradeCalculator();

    setInterval(loadBurnData, 30000);
});
