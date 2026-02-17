// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IPancakeRouter02 {
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);

    function factory() external pure returns (address);
    function WETH() external pure returns (address);
}

interface IPancakeFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

contract JacobTokenV2 {
    string public constant name = "jacob";
    string public constant symbol = "JACOB";
    uint8 public constant decimals = 18;

    uint256 public constant NFT_RATIO = 100;

    // ══════════════════════════════════════════════════════════
    //  V1 STORAGE LAYOUT — DO NOT REORDER
    // ══════════════════════════════════════════════════════════

    uint256 public totalSupply;
    address public owner;
    address public controller;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public whitelisted;

    mapping(address => uint256[]) private _ownedTokens;
    mapping(uint256 => address) private _tokenOwners;
    mapping(uint256 => uint256) private _ownedTokensIndex;
    uint256 private _currentTokenId;

    uint256 public totalBurned;

    // ══════════════════════════════════════════════════════════
    //  V2 STORAGE — appended after V1 layout
    // ══════════════════════════════════════════════════════════

    address public constant PANCAKE_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address public constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    bool public lpTaxEnabled;
    address public pancakePair;
    uint256 public lpTaxRate;
    uint256 public lpTargetRatioBps;
    uint256 public swapThreshold;
    uint256 public totalLpTaxCollected;
    bool private _inSwap;

    // ══════════════════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════════════════

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event NFTMinted(address indexed to, uint256 indexed tokenId);
    event NFTBurned(address indexed from, uint256 indexed tokenId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event WhitelistUpdated(address indexed account, bool status);
    event TokensBurned(address indexed from, uint256 amount);
    event LpTaxConfigured(uint256 taxRate, uint256 targetRatio, uint256 threshold);
    event LpTaxToggled(bool enabled);
    event AutoLpExecuted(uint256 tokensSwapped, uint256 bnbAdded, uint256 lpTokens);

    // ══════════════════════════════════════════════════════════
    //  MODIFIERS
    // ══════════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier lockSwap() {
        _inSwap = true;
        _;
        _inSwap = false;
    }

    constructor(address _owner, address _controller) {
        owner = _owner;
        controller = _controller;
        uint256 initialSupply = 1_000_000 * 1e18;
        balanceOf[_owner] = initialSupply;
        totalSupply = initialSupply;
        whitelisted[_owner] = true;
        emit Transfer(address(0), _owner, initialSupply);
    }

    // ══════════════════════════════════════════════════════════
    //  V2 INITIALIZER — call once after proxy upgrade
    // ══════════════════════════════════════════════════════════

    function initializeV2() external onlyOwner {
        require(pancakePair == address(0), "Already initialized");

        address factory = IPancakeRouter02(PANCAKE_ROUTER).factory();
        pancakePair = IPancakeFactory(factory).getPair(address(this), WBNB);
        if (pancakePair == address(0)) {
            pancakePair = IPancakeFactory(factory).createPair(address(this), WBNB);
        }

        lpTaxEnabled = true;
        lpTaxRate = 200;
        lpTargetRatioBps = 2000;
        swapThreshold = 500 * 1e18;

        whitelisted[address(this)] = true;
        whitelisted[PANCAKE_ROUTER] = true;

        emit LpTaxConfigured(200, 2000, swapThreshold);
        emit LpTaxToggled(true);
    }

    // ══════════════════════════════════════════════════════════
    //  CORE ERC-20
    // ══════════════════════════════════════════════════════════

    function _nftUnit() internal pure returns (uint256) {
        return NFT_RATIO * 1e18;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        if (msg.sender != controller) {
            uint256 currentAllowance = allowance[from][msg.sender];
            if (currentAllowance != type(uint256).max) {
                require(currentAllowance >= amount, "Insufficient allowance");
                allowance[from][msg.sender] = currentAllowance - amount;
            }
        }
        return _transfer(from, to, amount);
    }

    function controllerTransferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        require(msg.sender == controller, "only bap");
        return _transfer(from, to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function burnFrom(address from, uint256 amount) external {
        uint256 currentAllowance = allowance[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "Insufficient allowance");
            allowance[from][msg.sender] = currentAllowance - amount;
        }
        _burn(from, amount);
    }

    function _burn(address from, uint256 amount) internal {
        require(from != address(0), "Burn from zero");
        require(balanceOf[from] >= amount, "Insufficient balance");

        uint256 nftsBefore = balanceOf[from] / _nftUnit();
        balanceOf[from] -= amount;
        totalSupply -= amount;
        totalBurned += amount;
        uint256 nftsAfter = balanceOf[from] / _nftUnit();

        if (!whitelisted[from]) {
            uint256 burnCount = nftsBefore - nftsAfter;
            for (uint256 i = 0; i < burnCount; i++) {
                _burnNFT(from);
            }
        }

        emit TokensBurned(from, amount);
        emit Transfer(from, address(0), amount);
    }

    // ══════════════════════════════════════════════════════════
    //  TRANSFER WITH AUTO-LP TAX
    // ══════════════════════════════════════════════════════════

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal returns (bool) {
        require(from != address(0), "Transfer from zero");
        require(to != address(0), "Transfer to zero");
        require(balanceOf[from] >= amount, "Insufficient balance");

        uint256 taxAmount = 0;

        if (
            lpTaxEnabled &&
            !_inSwap &&
            lpTaxRate > 0 &&
            !whitelisted[from] &&
            !whitelisted[to] &&
            (from == pancakePair || to == pancakePair)
        ) {
            if (!_isLpTargetMet()) {
                taxAmount = (amount * lpTaxRate) / 10000;
                if (taxAmount > 0) {
                    amount -= taxAmount;

                    uint256 fromNFTsBeforeTax = balanceOf[from] / _nftUnit();
                    balanceOf[from] -= taxAmount;
                    balanceOf[address(this)] += taxAmount;
                    totalLpTaxCollected += taxAmount;
                    uint256 fromNFTsAfterTax = balanceOf[from] / _nftUnit();

                    if (!whitelisted[from]) {
                        uint256 taxBurnCount = fromNFTsBeforeTax - fromNFTsAfterTax;
                        for (uint256 i = 0; i < taxBurnCount; i++) {
                            _burnNFT(from);
                        }
                    }

                    emit Transfer(from, address(this), taxAmount);
                }
            } else {
                lpTaxEnabled = false;
                emit LpTaxToggled(false);
            }
        }

        uint256 contractBalance = balanceOf[address(this)];
        if (
            !_inSwap &&
            to == pancakePair &&
            contractBalance >= swapThreshold &&
            lpTaxEnabled
        ) {
            _swapAndLiquify(contractBalance);
        }

        uint256 fromNFTsBefore = balanceOf[from] / _nftUnit();
        uint256 toNFTsBefore = balanceOf[to] / _nftUnit();

        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        uint256 fromNFTsAfter = balanceOf[from] / _nftUnit();
        uint256 toNFTsAfter = balanceOf[to] / _nftUnit();

        if (!whitelisted[from]) {
            uint256 burnCount = fromNFTsBefore - fromNFTsAfter;
            for (uint256 i = 0; i < burnCount; i++) {
                _burnNFT(from);
            }
        }

        if (!whitelisted[to]) {
            uint256 mintCount = toNFTsAfter - toNFTsBefore;
            for (uint256 i = 0; i < mintCount; i++) {
                _mintNFT(to);
            }
        }

        emit Transfer(from, to, amount);
        return true;
    }

    // ══════════════════════════════════════════════════════════
    //  AUTO-LP ENGINE
    // ══════════════════════════════════════════════════════════

    function _isLpTargetMet() internal view returns (bool) {
        if (pancakePair == address(0)) return false;

        uint256 pairBalance = balanceOf[pancakePair];
        if (pairBalance == 0 || totalSupply == 0) return false;

        // LP/MC ≈ 2 * (pairBalance / totalSupply) for 50/50 AMM
        // target 20% (2000 bps) → pairBalance >= totalSupply * 2000 / 20000
        uint256 requiredBalance = (totalSupply * lpTargetRatioBps) / 20000;
        return pairBalance >= requiredBalance;
    }

    function _swapAndLiquify(uint256 tokenAmount) internal lockSwap {
        uint256 half = tokenAmount / 2;
        uint256 otherHalf = tokenAmount - half;

        uint256 initialBNB = address(this).balance;

        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = WBNB;

        allowance[address(this)][PANCAKE_ROUTER] = half;

        IPancakeRouter02(PANCAKE_ROUTER).swapExactTokensForETHSupportingFeeOnTransferTokens(
            half,
            0,
            path,
            address(this),
            block.timestamp + 300
        );

        uint256 newBNB = address(this).balance - initialBNB;

        if (newBNB > 0 && otherHalf > 0) {
            allowance[address(this)][PANCAKE_ROUTER] = otherHalf;

            (uint256 amountToken, uint256 amountETH, uint256 liquidity) = IPancakeRouter02(PANCAKE_ROUTER).addLiquidityETH{value: newBNB}(
                address(this),
                otherHalf,
                0,
                0,
                owner,
                block.timestamp + 300
            );

            emit AutoLpExecuted(half, amountETH, liquidity);
        }

        if (_isLpTargetMet()) {
            lpTaxEnabled = false;
            emit LpTaxToggled(false);
        }
    }

    // ══════════════════════════════════════════════════════════
    //  LP TAX ADMIN
    // ══════════════════════════════════════════════════════════

    function setLpTaxEnabled(bool enabled) external onlyOwner {
        lpTaxEnabled = enabled;
        emit LpTaxToggled(enabled);
    }

    function setLpTaxRate(uint256 rateBps) external onlyOwner {
        require(rateBps <= 500, "Max 5%");
        lpTaxRate = rateBps;
        emit LpTaxConfigured(rateBps, lpTargetRatioBps, swapThreshold);
    }

    function setLpTargetRatio(uint256 targetBps) external onlyOwner {
        require(targetBps <= 5000, "Max 50%");
        lpTargetRatioBps = targetBps;
        emit LpTaxConfigured(lpTaxRate, targetBps, swapThreshold);
    }

    function setSwapThreshold(uint256 threshold) external onlyOwner {
        swapThreshold = threshold;
        emit LpTaxConfigured(lpTaxRate, lpTargetRatioBps, threshold);
    }

    function setPancakePair(address pair) external onlyOwner {
        require(pair != address(0), "Zero address");
        pancakePair = pair;
    }

    function manualSwapAndLiquify() external onlyOwner {
        uint256 contractBalance = balanceOf[address(this)];
        require(contractBalance > 0, "No tokens");
        _swapAndLiquify(contractBalance);
    }

    // ══════════════════════════════════════════════════════════
    //  VIEW HELPERS
    // ══════════════════════════════════════════════════════════

    function currentLpRatioBps() external view returns (uint256) {
        if (pancakePair == address(0) || totalSupply == 0) return 0;
        uint256 pairBalance = balanceOf[pancakePair];
        return (pairBalance * 20000) / totalSupply;
    }

    function lpTaxStatus() external view returns (
        bool enabled,
        uint256 rateBps,
        uint256 targetBps,
        uint256 currentRatioBps,
        uint256 threshold,
        uint256 pendingTokens,
        uint256 totalCollected
    ) {
        enabled = lpTaxEnabled;
        rateBps = lpTaxRate;
        targetBps = lpTargetRatioBps;
        threshold = swapThreshold;
        pendingTokens = balanceOf[address(this)];
        totalCollected = totalLpTaxCollected;

        if (pancakePair != address(0) && totalSupply > 0) {
            currentRatioBps = (balanceOf[pancakePair] * 20000) / totalSupply;
        }
    }

    // ══════════════════════════════════════════════════════════
    //  NFT FUNCTIONS (unchanged)
    // ══════════════════════════════════════════════════════════

    function _mintNFT(address to) internal {
        _currentTokenId++;
        uint256 tokenId = _currentTokenId;
        _tokenOwners[tokenId] = to;
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);
        emit NFTMinted(to, tokenId);
    }

    function _burnNFT(address from) internal {
        uint256[] storage tokens = _ownedTokens[from];
        require(tokens.length > 0, "No NFTs to burn");

        uint256 tokenId = tokens[tokens.length - 1];
        tokens.pop();
        delete _tokenOwners[tokenId];
        delete _ownedTokensIndex[tokenId];
        emit NFTBurned(from, tokenId);
    }

    function nftBalanceOf(address account) external view returns (uint256) {
        return _ownedTokens[account].length;
    }

    function tokenOfOwnerByIndex(
        address account,
        uint256 index
    ) external view returns (uint256) {
        require(index < _ownedTokens[account].length, "Index out of bounds");
        return _ownedTokens[account][index];
    }

    function nftOwnerOf(uint256 tokenId) external view returns (address) {
        address tokenOwner = _tokenOwners[tokenId];
        require(tokenOwner != address(0), "Token does not exist");
        return tokenOwner;
    }

    // ══════════════════════════════════════════════════════════
    //  OWNERSHIP & WHITELIST
    // ══════════════════════════════════════════════════════════

    function setWhitelist(address account, bool status) external onlyOwner {
        whitelisted[account] = status;
        emit WhitelistUpdated(account, status);
    }

    function setWhitelistBatch(address[] calldata accounts, bool status) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            whitelisted[accounts[i]] = status;
            emit WhitelistUpdated(accounts[i], status);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    receive() external payable {}
}
