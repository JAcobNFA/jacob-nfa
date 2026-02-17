// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IBAP578Tier {
    function getAgentTier(uint256 tokenId) external view returns (uint8);
}

interface IPancakeRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract AgentVault {
    address public constant PANCAKE_ROUTER =
        0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address public constant WBNB =
        0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    address public feeCollector;
    address public protocolTreasury;
    address public revenueSharing;
    uint256 public swapFeePercent = 1;
    uint256 public totalFeesCollected;

    mapping(uint256 => mapping(address => uint256)) public balances;
    mapping(uint256 => uint256) public bnbBalances;
    address public bap578;
    address public owner;
    address public pendingOwner;
    bool public paused;
    mapping(address => bool) public whitelistedTokens;
    uint256 public maxSwapAmount;

    mapping(uint8 => uint256) public tierSwapLimit;
    mapping(uint8 => bool) public tierSwapEnabled;

    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    event AgentFunded(
        uint256 indexed agentId,
        address token,
        uint256 amount
    );
    event AgentWithdrawn(
        uint256 indexed agentId,
        address token,
        uint256 amount,
        address caller
    );
    event AdminWithdraw(
        uint256 indexed agentId,
        address token,
        uint256 amount,
        address recipient
    );
    event ActionExecuted(
        uint256 indexed agentId,
        address indexed caller,
        bytes actionData,
        bytes context
    );
    event ActionResult(
        uint256 indexed agentId,
        bytes actionData,
        bool success,
        bytes result
    );
    event SwapExecuted(
        uint256 indexed agentId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event GasReimbursed(uint256 indexed agentId, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not vault owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Vault is paused");
        _;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor(
        address _bap578,
        address _feeCollector,
        address _protocolTreasury
    ) {
        owner = msg.sender;
        bap578 = _bap578;
        feeCollector = _feeCollector;
        protocolTreasury = _protocolTreasury;
        _status = _NOT_ENTERED;
        maxSwapAmount = type(uint256).max;

        tierSwapEnabled[1] = true;
        tierSwapEnabled[2] = true;
        tierSwapEnabled[3] = true;
        tierSwapEnabled[4] = true;
        tierSwapEnabled[5] = true;

        tierSwapLimit[1] = 0.1 ether;
        tierSwapLimit[2] = 0.5 ether;
        tierSwapLimit[3] = 2 ether;
        tierSwapLimit[4] = 10 ether;
        tierSwapLimit[5] = type(uint256).max;
    }

    function _getTierSwapLimit(uint256 agentId) internal view returns (uint256) {
        if (bap578 == address(0)) return maxSwapAmount;
        uint8 tier = IBAP578Tier(bap578).getAgentTier(agentId);
        if (tier == 0) return 0;
        require(tierSwapEnabled[tier], "Tier swaps disabled");
        return tierSwapLimit[tier];
    }

    function setTierSwapLimit(uint8 tier, uint256 limit) external onlyOwner {
        tierSwapLimit[tier] = limit;
    }

    function setTierSwapEnabled(uint8 tier, bool enabled) external onlyOwner {
        tierSwapEnabled[tier] = enabled;
    }

    function fundAgent(
        uint256 agentId,
        address token,
        uint256 amount
    ) external whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(token != address(0), "Token address is zero");

        if (bap578 != address(0)) {
            IERC721(bap578).ownerOf(agentId);
        }

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        uint256 actualReceived = balanceAfter - balanceBefore;

        balances[agentId][token] += actualReceived;
        emit AgentFunded(agentId, token, actualReceived);
    }

    function withdrawFromAgent(
        uint256 agentId,
        address token,
        uint256 amount
    ) external whenNotPaused nonReentrant {
        require(bap578 != address(0), "BAP578 not set");
        address nftOwner = IERC721(bap578).ownerOf(agentId);
        require(msg.sender == nftOwner, "Not agent NFT owner");
        require(balances[agentId][token] >= amount, "Insufficient balance");

        balances[agentId][token] -= amount;
        IERC20(token).transfer(msg.sender, amount);
        emit AgentWithdrawn(agentId, token, amount, msg.sender);
    }

    function adminWithdraw(
        uint256 agentId,
        address token,
        uint256 amount,
        address recipient
    ) external onlyOwner nonReentrant {
        require(balances[agentId][token] >= amount, "Insufficient balance");
        balances[agentId][token] -= amount;
        IERC20(token).transfer(recipient, amount);
        emit AdminWithdraw(agentId, token, amount, recipient);
    }

    function handleAction(
        uint256 agentId,
        bytes calldata actionData,
        bytes calldata context
    ) external returns (bool success, bytes memory result) {
        emit ActionExecuted(agentId, msg.sender, actionData, context);
        emit ActionResult(agentId, actionData, true, context);
        return (true, context);
    }

    function swapTokensForTokens(
        uint256 agentId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external whenNotPaused nonReentrant {
        uint256 limit = _getTierSwapLimit(agentId);
        require(amountIn <= limit, "Exceeds tier swap limit");
        _requireAgentOwnerOrVaultOwner(agentId);
        require(balances[agentId][tokenIn] >= amountIn, "Insufficient balance");

        uint256 fee = (amountIn * swapFeePercent) / 100;
        uint256 swapAmount = amountIn - fee;

        balances[agentId][tokenIn] -= amountIn;

        if (fee > 0) {
            totalFeesCollected += fee;
            balances[0][tokenIn] += fee;
        }

        IERC20(tokenIn).approve(PANCAKE_ROUTER, swapAmount);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = IPancakeRouter(PANCAKE_ROUTER)
            .swapExactTokensForTokens(
                swapAmount,
                amountOutMin,
                path,
                address(this),
                block.timestamp + 300
            );

        balances[agentId][tokenOut] += amounts[amounts.length - 1];
        emit SwapExecuted(agentId, tokenIn, tokenOut, amountIn, amounts[amounts.length - 1]);
    }

    function depositBNBForAgent(uint256 agentId) external payable whenNotPaused {
        require(msg.value > 0, "Must send BNB");
        if (bap578 != address(0)) {
            IERC721(bap578).ownerOf(agentId);
        }
        bnbBalances[agentId] += msg.value;
        emit AgentFunded(agentId, WBNB, msg.value);
    }

    function swapBNBForTokens(
        uint256 agentId,
        address tokenOut,
        uint256 amountOutMin
    ) external payable whenNotPaused nonReentrant {
        uint256 limit = _getTierSwapLimit(agentId);
        require(msg.value <= limit, "Exceeds tier swap limit");
        _requireAgentOwnerOrVaultOwner(agentId);

        uint256 fee = (msg.value * swapFeePercent) / 100;
        uint256 swapAmount = msg.value - fee;

        if (fee > 0) {
            totalFeesCollected += fee;
            uint256 ownerShare = (fee * 60) / 100;
            uint256 revenueShare = fee - ownerShare;

            (bool oSent, ) = payable(owner).call{value: ownerShare}("");
            require(oSent, "Owner fee transfer failed");

            if (revenueShare > 0 && revenueSharing != address(0)) {
                (bool rSent, ) = payable(revenueSharing).call{value: revenueShare}("");
                require(rSent, "Revenue share transfer failed");
            } else if (revenueShare > 0) {
                (bool rSent, ) = payable(owner).call{value: revenueShare}("");
                require(rSent, "Fallback fee transfer failed");
            }
        }

        address[] memory path = new address[](2);
        path[0] = WBNB;
        path[1] = tokenOut;

        uint256[] memory amounts = IPancakeRouter(PANCAKE_ROUTER)
            .swapExactETHForTokens{value: swapAmount}(
                amountOutMin,
                path,
                address(this),
                block.timestamp + 300
            );

        balances[agentId][tokenOut] += amounts[amounts.length - 1];
        emit SwapExecuted(agentId, WBNB, tokenOut, swapAmount, amounts[amounts.length - 1]);
    }

    function swapAgentBNBForTokens(
        uint256 agentId,
        address tokenOut,
        uint256 amountBNB,
        uint256 amountOutMin
    ) external whenNotPaused nonReentrant {
        uint256 limit = _getTierSwapLimit(agentId);
        require(amountBNB <= limit, "Exceeds tier swap limit");
        _requireAgentOwnerOrVaultOwner(agentId);
        require(bnbBalances[agentId] >= amountBNB, "Insufficient agent BNB balance");

        bnbBalances[agentId] -= amountBNB;

        uint256 fee = (amountBNB * swapFeePercent) / 100;
        uint256 swapAmount = amountBNB - fee;

        if (fee > 0) {
            totalFeesCollected += fee;
            uint256 ownerShare = (fee * 60) / 100;
            uint256 revenueShare = fee - ownerShare;

            (bool oSent, ) = payable(owner).call{value: ownerShare}("");
            require(oSent, "Owner fee transfer failed");

            if (revenueShare > 0 && revenueSharing != address(0)) {
                (bool rSent, ) = payable(revenueSharing).call{value: revenueShare}("");
                require(rSent, "Revenue share transfer failed");
            } else if (revenueShare > 0) {
                (bool rSent, ) = payable(owner).call{value: revenueShare}("");
                require(rSent, "Fallback fee transfer failed");
            }
        }

        address[] memory path = new address[](2);
        path[0] = WBNB;
        path[1] = tokenOut;

        uint256[] memory amounts = IPancakeRouter(PANCAKE_ROUTER)
            .swapExactETHForTokens{value: swapAmount}(
                amountOutMin,
                path,
                address(this),
                block.timestamp + 300
            );

        balances[agentId][tokenOut] += amounts[amounts.length - 1];
        emit SwapExecuted(agentId, WBNB, tokenOut, amountBNB, amounts[amounts.length - 1]);
    }

    function swapTokensForBNB(
        uint256 agentId,
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin
    ) external whenNotPaused nonReentrant {
        uint256 limit = _getTierSwapLimit(agentId);
        require(amountIn <= limit, "Exceeds tier swap limit");
        _requireAgentOwnerOrVaultOwner(agentId);
        require(balances[agentId][tokenIn] >= amountIn, "Insufficient balance");

        uint256 fee = (amountIn * swapFeePercent) / 100;
        uint256 swapAmount = amountIn - fee;

        balances[agentId][tokenIn] -= amountIn;

        if (fee > 0) {
            totalFeesCollected += fee;
            balances[0][tokenIn] += fee;
        }

        IERC20(tokenIn).approve(PANCAKE_ROUTER, swapAmount);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = WBNB;

        uint256[] memory amounts = IPancakeRouter(PANCAKE_ROUTER)
            .swapExactTokensForETH(
                swapAmount,
                amountOutMin,
                path,
                address(this),
                block.timestamp + 300
            );

        bnbBalances[agentId] += amounts[amounts.length - 1];
        emit SwapExecuted(agentId, tokenIn, WBNB, amountIn, amounts[amounts.length - 1]);
    }

    function setMaxSwapAmount(uint256 _maxSwapAmount) external onlyOwner {
        maxSwapAmount = _maxSwapAmount;
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        feeCollector = _feeCollector;
    }

    function setProtocolTreasury(address _protocolTreasury) external onlyOwner {
        protocolTreasury = _protocolTreasury;
    }

    function setRevenueSharing(address _revenueSharing) external onlyOwner {
        revenueSharing = _revenueSharing;
    }

    function setSwapFeePercent(uint256 _fee) external onlyOwner {
        require(_fee <= 5, "Max 5%");
        swapFeePercent = _fee;
    }

    function withdrawTokenFees(address token, uint256 amount) external onlyOwner nonReentrant {
        require(balances[0][token] >= amount, "Insufficient fee balance");
        balances[0][token] -= amount;

        uint256 ownerShare = (amount * 60) / 100;
        uint256 revenueShare = amount - ownerShare;

        IERC20(token).transfer(owner, ownerShare);

        if (revenueShare > 0 && revenueSharing != address(0)) {
            IERC20(token).transfer(revenueSharing, revenueShare);
        } else if (revenueShare > 0) {
            IERC20(token).transfer(owner, revenueShare);
        }
    }

    function getTokenFeeBalance(address token) external view returns (uint256) {
        return balances[0][token];
    }

    function setWhitelistedToken(address token, bool status) external onlyOwner {
        whitelistedTokens[token] = status;
    }

    function setBap578(address _bap578) external onlyOwner {
        bap578 = _bap578;
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function _requireAgentOwnerOrVaultOwner(uint256 agentId) internal view {
        if (msg.sender == owner) return;
        require(bap578 != address(0), "BAP578 not set");
        address nftOwner = IERC721(bap578).ownerOf(agentId);
        require(msg.sender == nftOwner, "Not agent NFT owner");
    }

    function reimburseGas(uint256 agentId, uint256 gasAmount) external onlyOwner nonReentrant {
        require(bnbBalances[agentId] >= gasAmount, "Insufficient agent BNB for gas");
        bnbBalances[agentId] -= gasAmount;
        (bool sent, ) = payable(owner).call{value: gasAmount}("");
        require(sent, "Gas reimbursement transfer failed");
        emit GasReimbursed(agentId, gasAmount);
    }

    receive() external payable {}
    fallback() external payable {}
}
