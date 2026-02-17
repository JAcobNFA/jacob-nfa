// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IJacobToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
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

interface IPancakePair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

contract AgentMinterV4 {
    IJacobToken public immutable jacobToken;
    address public immutable lpPair;
    address public immutable wbnb;

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    address public bap578;
    address public owner;
    address public revenueSharing;
    bool public paused;

    address public officialBAP578;
    address public agentLogicAddress;
    string public baseMetadataURI;
    bool public officialRegistrationEnabled;

    uint8 public constant TIER_BRONZE = 1;
    uint8 public constant TIER_SILVER = 2;
    uint8 public constant TIER_GOLD = 3;
    uint8 public constant TIER_DIAMOND = 4;
    uint8 public constant TIER_BLACK = 5;

    mapping(uint8 => uint256) public tierBnbCost;
    mapping(uint8 => uint256) public mintFee;
    mapping(uint8 => uint256) public tierMinJacob;
    mapping(uint8 => uint256) public tierMaxJacob;

    uint256 public totalMinted;
    uint256 public totalTokensBurned;
    uint256 public totalMintFeesCollected;
    mapping(uint8 => uint256) public tierMintCount;

    mapping(uint256 => uint256) public localToOfficialId;
    mapping(uint256 => uint256) public officialToLocalId;
    uint256 public totalOfficiallyRegistered;

    bool private jacobIsToken0;

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

    constructor(
        address _jacobToken,
        address _bap578,
        address _lpPair,
        address _wbnb
    ) {
        jacobToken = IJacobToken(_jacobToken);
        bap578 = _bap578;
        lpPair = _lpPair;
        wbnb = _wbnb;
        owner = msg.sender;

        address token0 = IPancakePair(_lpPair).token0();
        address token1 = IPancakePair(_lpPair).token1();
        require(
            (token0 == _jacobToken && token1 == _wbnb) ||
            (token1 == _jacobToken && token0 == _wbnb),
            "LP pair must be JACOB/WBNB"
        );
        jacobIsToken0 = token0 == _jacobToken;

        tierBnbCost[TIER_BRONZE]  = 0.004 ether;
        tierBnbCost[TIER_SILVER]  = 0.02 ether;
        tierBnbCost[TIER_GOLD]    = 0.08 ether;
        tierBnbCost[TIER_DIAMOND] = 0.4 ether;
        tierBnbCost[TIER_BLACK]   = 1.5 ether;

        mintFee[TIER_BRONZE]  = 0.005 ether;
        mintFee[TIER_SILVER]  = 0.02 ether;
        mintFee[TIER_GOLD]    = 0.1 ether;
        mintFee[TIER_DIAMOND] = 0.5 ether;
        mintFee[TIER_BLACK]   = 2 ether;

        tierMinJacob[TIER_BRONZE]  = 1 * 1e18;
        tierMinJacob[TIER_SILVER]  = 5 * 1e18;
        tierMinJacob[TIER_GOLD]    = 20 * 1e18;
        tierMinJacob[TIER_DIAMOND] = 50 * 1e18;
        tierMinJacob[TIER_BLACK]   = 200 * 1e18;

        tierMaxJacob[TIER_BRONZE]  = 500 * 1e18;
        tierMaxJacob[TIER_SILVER]  = 2_500 * 1e18;
        tierMaxJacob[TIER_GOLD]    = 10_000 * 1e18;
        tierMaxJacob[TIER_DIAMOND] = 50_000 * 1e18;
        tierMaxJacob[TIER_BLACK]   = 200_000 * 1e18;
    }

    function getDynamicCost(uint8 tier) public view returns (uint256) {
        uint256 bnbCost = tierBnbCost[tier];
        require(bnbCost > 0, "Invalid tier");

        (uint112 reserve0, uint112 reserve1, ) = IPancakePair(lpPair).getReserves();

        uint256 jacobReserve;
        uint256 bnbReserve;

        if (jacobIsToken0) {
            jacobReserve = uint256(reserve0);
            bnbReserve = uint256(reserve1);
        } else {
            jacobReserve = uint256(reserve1);
            bnbReserve = uint256(reserve0);
        }

        require(bnbReserve > 0.001 ether, "Insufficient liquidity");

        uint256 jacobAmount = (bnbCost * jacobReserve) / bnbReserve;

        uint256 minCost = tierMinJacob[tier];
        uint256 maxCost = tierMaxJacob[tier];

        if (jacobAmount < minCost) jacobAmount = minCost;
        if (jacobAmount > maxCost) jacobAmount = maxCost;

        return jacobAmount;
    }

    function mintAgent(uint8 tier) external payable whenNotPaused returns (uint256) {
        uint256 cost = getDynamicCost(tier);
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

        require(jacobToken.transferFrom(msg.sender, DEAD_ADDRESS, cost), "JACOB transfer failed");

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

    function getAllTierCosts() external view returns (
        uint256[5] memory jacobCosts,
        uint256[5] memory bnbCosts,
        uint256[5] memory bnbFees
    ) {
        for (uint8 i = 1; i <= 5; i++) {
            jacobCosts[i - 1] = getDynamicCost(i);
            bnbCosts[i - 1] = tierBnbCost[i];
            bnbFees[i - 1] = mintFee[i];
        }
    }

    function getCurrentPrice() external view returns (uint256 jacobPerBnb) {
        (uint112 reserve0, uint112 reserve1, ) = IPancakePair(lpPair).getReserves();

        if (jacobIsToken0) {
            jacobPerBnb = (uint256(reserve0) * 1e18) / uint256(reserve1);
        } else {
            jacobPerBnb = (uint256(reserve1) * 1e18) / uint256(reserve0);
        }
    }

    function setTierBnbCost(uint8 tier, uint256 bnbCost) external onlyOwner {
        require(tier >= 1 && tier <= 5, "Invalid tier");
        tierBnbCost[tier] = bnbCost;
    }

    function setTierMinJacob(uint8 tier, uint256 minAmount) external onlyOwner {
        require(tier >= 1 && tier <= 5, "Invalid tier");
        tierMinJacob[tier] = minAmount;
    }

    function setTierMaxJacob(uint8 tier, uint256 maxAmount) external onlyOwner {
        require(tier >= 1 && tier <= 5, "Invalid tier");
        tierMaxJacob[tier] = maxAmount;
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

    function getTierName(uint8 tier) public pure returns (string memory) {
        if (tier == TIER_BRONZE) return "Bronze";
        if (tier == TIER_SILVER) return "Silver";
        if (tier == TIER_GOLD) return "Gold";
        if (tier == TIER_DIAMOND) return "Diamond";
        if (tier == TIER_BLACK) return "Black";
        return "Unknown";
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
