// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IBAP578Revenue {
    function ownerOf(uint256 tokenId) external view returns (address);
    function totalSupply() external view returns (uint256);
    function getAgentTier(uint256 tokenId) external view returns (uint8);
}

contract RevenueSharing {
    IBAP578Revenue public immutable bap578;
    address public owner;
    bool public paused;

    uint256 public totalRevenueDeposited;
    uint256 public totalRevenueClaimed;

    uint256 public currentEpoch;
    uint256 public cachedTotalShares;

    struct Epoch {
        uint256 totalRevenue;
        uint256 totalShares;
        uint256 revenuePerShare;
        uint256 startTime;
        uint256 endTime;
        bool finalized;
    }

    mapping(uint256 => Epoch) public epochs;
    mapping(uint256 => mapping(uint256 => bool)) public claimed;
    mapping(uint256 => uint256) public agentTotalClaimed;
    mapping(uint256 => bool) public registeredAgent;

    uint8 constant TIER_BRONZE = 1;
    uint8 constant TIER_SILVER = 2;
    uint8 constant TIER_GOLD = 3;
    uint8 constant TIER_DIAMOND = 4;
    uint8 constant TIER_BLACK = 5;

    event RevenueDeposited(uint256 indexed epoch, uint256 amount);
    event EpochFinalized(uint256 indexed epoch, uint256 totalRevenue, uint256 totalShares);
    event RevenueClaimed(uint256 indexed epoch, uint256 indexed tokenId, address indexed owner, uint256 amount);
    event AgentRegistered(uint256 indexed tokenId, uint8 tier, uint256 shares);
    event AgentSharesUpdated(uint256 indexed tokenId, uint256 oldShares, uint256 newShares);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _bap578) {
        bap578 = IBAP578Revenue(_bap578);
        owner = msg.sender;
        epochs[0].startTime = block.timestamp;
    }

    receive() external payable {
        epochs[currentEpoch].totalRevenue += msg.value;
        totalRevenueDeposited += msg.value;
        emit RevenueDeposited(currentEpoch, msg.value);
    }

    function depositRevenue() external payable {
        require(msg.value > 0, "Must send BNB");
        epochs[currentEpoch].totalRevenue += msg.value;
        totalRevenueDeposited += msg.value;
        emit RevenueDeposited(currentEpoch, msg.value);
    }

    function registerAgent(uint256 tokenId) external {
        require(!registeredAgent[tokenId], "Already registered");
        require(bap578.ownerOf(tokenId) != address(0), "Agent does not exist");

        uint8 tier = bap578.getAgentTier(tokenId);
        uint256 shares = _getTierShares(tier);
        registeredAgent[tokenId] = true;
        cachedTotalShares += shares;

        emit AgentRegistered(tokenId, tier, shares);
    }

    function registerAgentBatch(uint256[] calldata tokenIds) external {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            if (!registeredAgent[tokenId]) {
                try bap578.ownerOf(tokenId) returns (address agentOwner) {
                    if (agentOwner != address(0)) {
                        uint8 tier = bap578.getAgentTier(tokenId);
                        uint256 shares = _getTierShares(tier);
                        registeredAgent[tokenId] = true;
                        cachedTotalShares += shares;
                        emit AgentRegistered(tokenId, tier, shares);
                    }
                } catch {}
            }
        }
    }

    function updateAgentShares(uint256 tokenId, uint8 oldTier, uint8 newTier) external onlyOwner {
        require(registeredAgent[tokenId], "Agent not registered");
        uint256 oldShares = _getTierShares(oldTier);
        uint256 newShares = _getTierShares(newTier);
        cachedTotalShares = cachedTotalShares - oldShares + newShares;
        emit AgentSharesUpdated(tokenId, oldShares, newShares);
    }

    function finalizeEpoch() external onlyOwner {
        Epoch storage epoch = epochs[currentEpoch];
        require(!epoch.finalized, "Already finalized");
        require(epoch.totalRevenue > 0, "No revenue");
        require(cachedTotalShares > 0, "No agents");

        epoch.totalShares = cachedTotalShares;
        epoch.revenuePerShare = epoch.totalRevenue / cachedTotalShares;
        epoch.endTime = block.timestamp;
        epoch.finalized = true;

        emit EpochFinalized(currentEpoch, epoch.totalRevenue, cachedTotalShares);

        currentEpoch++;
        epochs[currentEpoch].startTime = block.timestamp;
    }

    function claimRevenue(uint256 epochId, uint256 tokenId) external {
        require(!paused, "Paused");
        require(bap578.ownerOf(tokenId) == msg.sender, "Not agent owner");
        require(epochs[epochId].finalized, "Epoch not finalized");
        require(!claimed[epochId][tokenId], "Already claimed");

        uint256 shares = _getTierShares(bap578.getAgentTier(tokenId));
        uint256 reward = shares * epochs[epochId].revenuePerShare;

        require(reward > 0, "No reward");

        claimed[epochId][tokenId] = true;
        agentTotalClaimed[tokenId] += reward;
        totalRevenueClaimed += reward;

        (bool sent, ) = payable(msg.sender).call{value: reward}("");
        require(sent, "Transfer failed");

        emit RevenueClaimed(epochId, tokenId, msg.sender, reward);
    }

    function claimMultipleEpochs(uint256[] calldata epochIds, uint256 tokenId) external {
        require(!paused, "Paused");
        require(bap578.ownerOf(tokenId) == msg.sender, "Not agent owner");

        uint256 totalReward = 0;
        uint256 shares = _getTierShares(bap578.getAgentTier(tokenId));

        for (uint256 i = 0; i < epochIds.length; i++) {
            uint256 epochId = epochIds[i];
            if (epochs[epochId].finalized && !claimed[epochId][tokenId]) {
                uint256 reward = shares * epochs[epochId].revenuePerShare;
                if (reward > 0) {
                    claimed[epochId][tokenId] = true;
                    totalReward += reward;
                }
            }
        }

        require(totalReward > 0, "Nothing to claim");
        agentTotalClaimed[tokenId] += totalReward;
        totalRevenueClaimed += totalReward;

        (bool sent, ) = payable(msg.sender).call{value: totalReward}("");
        require(sent, "Transfer failed");
    }

    function getPendingReward(uint256 epochId, uint256 tokenId) external view returns (uint256) {
        if (!epochs[epochId].finalized || claimed[epochId][tokenId]) return 0;
        uint256 shares = _getTierShares(bap578.getAgentTier(tokenId));
        return shares * epochs[epochId].revenuePerShare;
    }

    function _getTierShares(uint8 tier) internal pure returns (uint256) {
        if (tier == TIER_BRONZE) return 1;
        if (tier == TIER_SILVER) return 2;
        if (tier == TIER_GOLD) return 5;
        if (tier == TIER_DIAMOND) return 12;
        if (tier == TIER_BLACK) return 25;
        return 0;
    }

    function emergencyWithdraw(address payable recipient) external onlyOwner {
        require(recipient != address(0), "Zero address");
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds");
        (bool sent, ) = recipient.call{value: balance}("");
        require(sent, "Transfer failed");
    }

    function pause() external onlyOwner { paused = true; }
    function unpause() external onlyOwner { paused = false; }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
