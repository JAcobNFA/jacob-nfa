// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IJacobToken {
    function burnFrom(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

interface IBAP578NFA {
    function mintWithTier(
        address to,
        uint8 tier,
        uint256 burnedAmount
    ) external returns (uint256);
}

interface IOfficialBAP578 {
    function createAgent(
        address to,
        address logicAddress,
        string memory metadataURI
    ) external returns (uint256);
}

contract AgentMinter {
    IJacobToken public immutable jacobToken;
    address public bap578;
    address public owner;
    address public revenueSharing;
    bool public paused;

    address public officialBAP578;
    address public agentLogicAddress;
    string public baseMetadataURI;
    bool public officialRegistrationEnabled;

    uint256 public constant BRONZE_COST = 10 * 1e18;
    uint256 public constant SILVER_COST = 50 * 1e18;
    uint256 public constant GOLD_COST = 250 * 1e18;
    uint256 public constant DIAMOND_COST = 1_000 * 1e18;
    uint256 public constant BLACK_COST = 10_000 * 1e18;

    uint8 public constant TIER_BRONZE = 1;
    uint8 public constant TIER_SILVER = 2;
    uint8 public constant TIER_GOLD = 3;
    uint8 public constant TIER_DIAMOND = 4;
    uint8 public constant TIER_BLACK = 5;

    mapping(uint8 => uint256) public mintFee;
    uint256 public totalMinted;
    uint256 public totalTokensBurned;
    uint256 public totalMintFeesCollected;
    mapping(uint8 => uint256) public tierMintCount;

    mapping(uint256 => uint256) public localToOfficialId;
    mapping(uint256 => uint256) public officialToLocalId;
    uint256 public totalOfficiallyRegistered;

    event AgentCreated(
        address indexed creator,
        uint256 indexed tokenId,
        uint8 tier,
        uint256 burnedAmount
    );
    event AgentRegisteredOnOfficial(
        uint256 indexed localTokenId,
        uint256 indexed officialTokenId,
        address indexed creator
    );
    event OfficialRegistrationFailed(
        uint256 indexed localTokenId,
        address indexed creator
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Minting is paused");
        _;
    }

    constructor(address _jacobToken, address _bap578) {
        jacobToken = IJacobToken(_jacobToken);
        bap578 = _bap578;
        owner = msg.sender;

        mintFee[TIER_BRONZE] = 0.005 ether;
        mintFee[TIER_SILVER] = 0.02 ether;
        mintFee[TIER_GOLD] = 0.1 ether;
        mintFee[TIER_DIAMOND] = 0.5 ether;
        mintFee[TIER_BLACK] = 2 ether;
    }

    function mintAgent(uint8 tier) external payable whenNotPaused returns (uint256) {
        uint256 cost = getTierCost(tier);
        require(cost > 0, "Invalid tier");
        uint256 fee = mintFee[tier];
        require(msg.value >= fee, "Insufficient BNB mint fee");
        require(
            jacobToken.balanceOf(msg.sender) >= cost,
            "Insufficient JACOB balance"
        );

        uint256 excess = msg.value - fee;

        if (fee > 0) {
            totalMintFeesCollected += fee;
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

        jacobToken.burnFrom(msg.sender, cost);

        uint256 tokenId = IBAP578NFA(bap578).mintWithTier(msg.sender, tier, cost);

        totalMinted++;
        totalTokensBurned += cost;
        tierMintCount[tier]++;

        if (officialRegistrationEnabled && officialBAP578 != address(0)) {
            _registerOnOfficial(msg.sender, tokenId, tier, cost);
        }

        emit AgentCreated(msg.sender, tokenId, tier, cost);

        if (excess > 0) {
            (bool refundSent, ) = payable(msg.sender).call{value: excess}("");
            require(refundSent, "Refund failed");
        }

        return tokenId;
    }

    function _registerOnOfficial(
        address creator,
        uint256 localTokenId,
        uint8 tier,
        uint256 burnedAmount
    ) internal {
        string memory metadataURI = _buildMetadataURI(localTokenId, tier, burnedAmount);

        try IOfficialBAP578(officialBAP578).createAgent(
            creator,
            agentLogicAddress,
            metadataURI
        ) returns (uint256 officialId) {
            localToOfficialId[localTokenId] = officialId;
            officialToLocalId[officialId] = localTokenId;
            totalOfficiallyRegistered++;
            emit AgentRegisteredOnOfficial(localTokenId, officialId, creator);
        } catch {
            emit OfficialRegistrationFailed(localTokenId, creator);
        }
    }

    function _buildMetadataURI(
        uint256 tokenId,
        uint8 tier,
        uint256 burnedAmount
    ) internal view returns (string memory) {
        if (bytes(baseMetadataURI).length > 0) {
            return string(abi.encodePacked(
                baseMetadataURI,
                _toString(tokenId),
                "?tier=",
                _toString(uint256(tier)),
                "&burned=",
                _toString(burnedAmount / 1e18)
            ));
        }
        return "";
    }

    function registerExistingAgent(
        uint256 localTokenId,
        address agentOwner,
        uint8 tier,
        uint256 burnedAmount
    ) external onlyOwner {
        require(officialBAP578 != address(0), "Official BAP578 not set");
        require(localToOfficialId[localTokenId] == 0, "Already registered");
        require(agentOwner != address(0), "Zero address");

        string memory metadataURI = _buildMetadataURI(localTokenId, tier, burnedAmount);

        uint256 officialId = IOfficialBAP578(officialBAP578).createAgent(
            agentOwner,
            agentLogicAddress,
            metadataURI
        );

        localToOfficialId[localTokenId] = officialId;
        officialToLocalId[officialId] = localTokenId;
        totalOfficiallyRegistered++;

        emit AgentRegisteredOnOfficial(localTokenId, officialId, agentOwner);
    }

    function registerExistingAgentBatch(
        uint256[] calldata localTokenIds,
        address[] calldata agentOwners,
        uint8[] calldata tiers,
        uint256[] calldata burnedAmounts
    ) external onlyOwner {
        require(officialBAP578 != address(0), "Official BAP578 not set");
        require(
            localTokenIds.length == agentOwners.length &&
            agentOwners.length == tiers.length &&
            tiers.length == burnedAmounts.length,
            "Length mismatch"
        );

        for (uint256 i = 0; i < localTokenIds.length; i++) {
            if (localToOfficialId[localTokenIds[i]] == 0) {
                string memory metadataURI = _buildMetadataURI(
                    localTokenIds[i],
                    tiers[i],
                    burnedAmounts[i]
                );

                try IOfficialBAP578(officialBAP578).createAgent(
                    agentOwners[i],
                    agentLogicAddress,
                    metadataURI
                ) returns (uint256 officialId) {
                    localToOfficialId[localTokenIds[i]] = officialId;
                    officialToLocalId[officialId] = localTokenIds[i];
                    totalOfficiallyRegistered++;
                    emit AgentRegisteredOnOfficial(localTokenIds[i], officialId, agentOwners[i]);
                } catch {
                    emit OfficialRegistrationFailed(localTokenIds[i], agentOwners[i]);
                }
            }
        }
    }

    function setOfficialBAP578(address _officialBAP578) external onlyOwner {
        officialBAP578 = _officialBAP578;
    }

    function setAgentLogicAddress(address _logicAddress) external onlyOwner {
        agentLogicAddress = _logicAddress;
    }

    function setBaseMetadataURI(string calldata _uri) external onlyOwner {
        baseMetadataURI = _uri;
    }

    function setOfficialRegistrationEnabled(bool _enabled) external onlyOwner {
        officialRegistrationEnabled = _enabled;
    }

    function getOfficialId(uint256 localTokenId) external view returns (uint256) {
        return localToOfficialId[localTokenId];
    }

    function getTierCost(uint8 tier) public pure returns (uint256) {
        if (tier == TIER_BRONZE) return BRONZE_COST;
        if (tier == TIER_SILVER) return SILVER_COST;
        if (tier == TIER_GOLD) return GOLD_COST;
        if (tier == TIER_DIAMOND) return DIAMOND_COST;
        if (tier == TIER_BLACK) return BLACK_COST;
        return 0;
    }

    function getTierName(uint8 tier) public pure returns (string memory) {
        if (tier == TIER_BRONZE) return "Bronze";
        if (tier == TIER_SILVER) return "Silver";
        if (tier == TIER_GOLD) return "Gold";
        if (tier == TIER_DIAMOND) return "Diamond";
        if (tier == TIER_BLACK) return "Black";
        return "Unknown";
    }

    function getMaxPossibleAgents(uint8 tier) public pure returns (uint256) {
        uint256 cost = getTierCost(tier);
        if (cost == 0) return 0;
        return (1_000_000 * 1e18) / cost;
    }

    function setBap578(address _bap578) external onlyOwner {
        bap578 = _bap578;
    }

    function setRevenueSharing(address _revenueSharing) external onlyOwner {
        revenueSharing = _revenueSharing;
    }

    function setMintFee(uint8 tier, uint256 fee) external onlyOwner {
        require(tier >= 1 && tier <= 5, "Invalid tier");
        mintFee[tier] = fee;
    }

    function getMintFee(uint8 tier) external view returns (uint256) {
        return mintFee[tier];
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero");
        owner = newOwner;
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
