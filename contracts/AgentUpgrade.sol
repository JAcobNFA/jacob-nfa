// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IJacobTokenUpgrade {
    function burnFrom(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

interface IBAP578Upgrade {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getAgentTier(uint256 tokenId) external view returns (uint8);
    function updateAgentTier(uint256 tokenId, uint8 newTier, uint256 additionalBurned) external;
}

contract AgentUpgrade {
    IJacobTokenUpgrade public immutable jacobToken;
    IBAP578Upgrade public immutable bap578;
    address public owner;
    bool public paused;

    uint256 public constant BRONZE_COST = 10 * 1e18;
    uint256 public constant SILVER_COST = 50 * 1e18;
    uint256 public constant GOLD_COST = 250 * 1e18;
    uint256 public constant DIAMOND_COST = 1_000 * 1e18;
    uint256 public constant BLACK_COST = 10_000 * 1e18;

    mapping(uint256 => uint8) public upgradedTier;
    mapping(uint256 => uint256) public totalBurnedForAgent;

    uint256 public totalUpgrades;
    uint256 public totalTokensBurnedForUpgrades;

    event AgentUpgraded(
        uint256 indexed tokenId,
        address indexed owner,
        uint8 fromTier,
        uint8 toTier,
        uint256 additionalBurned
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Upgrades paused");
        _;
    }

    constructor(address _jacobToken, address _bap578) {
        jacobToken = IJacobTokenUpgrade(_jacobToken);
        bap578 = IBAP578Upgrade(_bap578);
        owner = msg.sender;
    }

    function upgradeAgent(uint256 tokenId, uint8 targetTier) external whenNotPaused {
        require(bap578.ownerOf(tokenId) == msg.sender, "Not agent owner");
        require(targetTier >= 1 && targetTier <= 5, "Invalid tier");

        uint8 currentTier = bap578.getAgentTier(tokenId);
        if (upgradedTier[tokenId] > currentTier) {
            currentTier = upgradedTier[tokenId];
        }
        require(targetTier > currentTier, "Must upgrade to higher tier");

        uint256 currentCost = _getTierCost(currentTier);
        uint256 targetCost = _getTierCost(targetTier);
        uint256 upgradeCost = targetCost - currentCost;

        require(
            jacobToken.balanceOf(msg.sender) >= upgradeCost,
            "Insufficient JACOB"
        );

        jacobToken.burnFrom(msg.sender, upgradeCost);

        bap578.updateAgentTier(tokenId, targetTier, upgradeCost);

        upgradedTier[tokenId] = targetTier;
        totalBurnedForAgent[tokenId] += upgradeCost;
        totalUpgrades++;
        totalTokensBurnedForUpgrades += upgradeCost;

        emit AgentUpgraded(tokenId, msg.sender, currentTier, targetTier, upgradeCost);
    }

    function getUpgradeCost(uint256 tokenId, uint8 targetTier) external view returns (uint256) {
        uint8 currentTier = bap578.getAgentTier(tokenId);
        if (upgradedTier[tokenId] > currentTier) {
            currentTier = upgradedTier[tokenId];
        }
        if (targetTier <= currentTier) return 0;

        uint256 currentCost = _getTierCost(currentTier);
        uint256 targetCost = _getTierCost(targetTier);
        return targetCost - currentCost;
    }

    function getEffectiveTier(uint256 tokenId) external view returns (uint8) {
        uint8 baseTier = bap578.getAgentTier(tokenId);
        uint8 upgraded = upgradedTier[tokenId];
        return upgraded > baseTier ? upgraded : baseTier;
    }

    function _getTierCost(uint8 tier) internal pure returns (uint256) {
        if (tier == 1) return BRONZE_COST;
        if (tier == 2) return SILVER_COST;
        if (tier == 3) return GOLD_COST;
        if (tier == 4) return DIAMOND_COST;
        if (tier == 5) return BLACK_COST;
        return 0;
    }

    function pause() external onlyOwner { paused = true; }
    function unpause() external onlyOwner { paused = false; }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
