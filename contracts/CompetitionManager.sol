// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IBAP578Comp {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getAgentTier(uint256 tokenId) external view returns (uint8);
}

contract CompetitionManager {
    IBAP578Comp public immutable bap578;
    address public owner;
    address public revenueSharing;

    enum CompStatus { REGISTRATION, ACTIVE, ENDED, FINALIZED }

    struct Competition {
        string name;
        uint256 entryFee;
        uint256 prizePool;
        uint256 startTime;
        uint256 endTime;
        uint256 maxParticipants;
        CompStatus status;
        uint256[] participants;
        uint256 winnerId;
        address winnerAddress;
    }

    uint256 public competitionCount;
    mapping(uint256 => Competition) public competitions;
    mapping(uint256 => mapping(uint256 => bool)) public isRegistered;
    mapping(uint256 => mapping(uint256 => int256)) public agentScore;

    uint256 public totalPrizesPaid;
    uint256 public platformFeePercent = 5;

    event CompetitionCreated(uint256 indexed compId, string name, uint256 entryFee, uint256 startTime, uint256 endTime);
    event AgentRegistered(uint256 indexed compId, uint256 indexed tokenId, address indexed owner);
    event CompetitionStarted(uint256 indexed compId);
    event ScoreUpdated(uint256 indexed compId, uint256 indexed tokenId, int256 score);
    event CompetitionFinalized(uint256 indexed compId, uint256 winnerId, address winner, uint256 prize);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _bap578, address _revenueSharing) {
        bap578 = IBAP578Comp(_bap578);
        owner = msg.sender;
        revenueSharing = _revenueSharing;
    }

    function createCompetition(
        string calldata name,
        uint256 entryFee,
        uint256 startTime,
        uint256 endTime,
        uint256 maxParticipants
    ) external onlyOwner returns (uint256) {
        require(startTime > block.timestamp, "Start must be future");
        require(endTime > startTime, "End must be after start");
        require(maxParticipants > 0, "Need participants");

        uint256 compId = competitionCount++;

        Competition storage comp = competitions[compId];
        comp.name = name;
        comp.entryFee = entryFee;
        comp.startTime = startTime;
        comp.endTime = endTime;
        comp.maxParticipants = maxParticipants;
        comp.status = CompStatus.REGISTRATION;

        emit CompetitionCreated(compId, name, entryFee, startTime, endTime);
        return compId;
    }

    function registerAgent(uint256 compId, uint256 tokenId) external payable {
        Competition storage comp = competitions[compId];
        require(comp.status == CompStatus.REGISTRATION, "Not in registration");
        require(bap578.ownerOf(tokenId) == msg.sender, "Not agent owner");
        require(!isRegistered[compId][tokenId], "Already registered");
        require(comp.participants.length < comp.maxParticipants, "Full");
        require(msg.value >= comp.entryFee, "Insufficient entry fee");

        isRegistered[compId][tokenId] = true;
        comp.participants.push(tokenId);
        comp.prizePool += msg.value;

        emit AgentRegistered(compId, tokenId, msg.sender);
    }

    function startCompetition(uint256 compId) external onlyOwner {
        Competition storage comp = competitions[compId];
        require(comp.status == CompStatus.REGISTRATION, "Not in registration");
        require(comp.participants.length >= 2, "Need at least 2");
        comp.status = CompStatus.ACTIVE;
        comp.startTime = block.timestamp;
        emit CompetitionStarted(compId);
    }

    function updateScore(uint256 compId, uint256 tokenId, int256 score) external onlyOwner {
        Competition storage comp = competitions[compId];
        require(comp.status == CompStatus.ACTIVE, "Not active");
        require(isRegistered[compId][tokenId], "Not registered");
        agentScore[compId][tokenId] = score;
        emit ScoreUpdated(compId, tokenId, score);
    }

    function updateScoresBatch(uint256 compId, uint256[] calldata tokenIds, int256[] calldata scores) external onlyOwner {
        require(tokenIds.length == scores.length, "Length mismatch");
        Competition storage comp = competitions[compId];
        require(comp.status == CompStatus.ACTIVE, "Not active");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(isRegistered[compId][tokenIds[i]], "Not registered");
            agentScore[compId][tokenIds[i]] = scores[i];
            emit ScoreUpdated(compId, tokenIds[i], scores[i]);
        }
    }

    function finalizeCompetition(uint256 compId, uint256 winnerId) external onlyOwner {
        Competition storage comp = competitions[compId];
        require(comp.status == CompStatus.ACTIVE, "Not active");
        require(isRegistered[compId][winnerId], "Winner not registered");

        comp.status = CompStatus.FINALIZED;
        comp.winnerId = winnerId;
        comp.winnerAddress = bap578.ownerOf(winnerId);
        comp.endTime = block.timestamp;

        uint256 platformFee = (comp.prizePool * platformFeePercent) / 100;
        uint256 winnerPrize = comp.prizePool - platformFee;

        if (platformFee > 0) {
            uint256 ownerShare = (platformFee * 60) / 100;
            uint256 revenueShare = platformFee - ownerShare;

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

        (bool sent, ) = payable(comp.winnerAddress).call{value: winnerPrize}("");
        require(sent, "Prize transfer failed");

        totalPrizesPaid += winnerPrize;

        emit CompetitionFinalized(compId, winnerId, comp.winnerAddress, winnerPrize);
    }

    function getParticipants(uint256 compId) external view returns (uint256[] memory) {
        return competitions[compId].participants;
    }

    function getParticipantCount(uint256 compId) external view returns (uint256) {
        return competitions[compId].participants.length;
    }

    function getLeaderboard(uint256 compId) external view returns (uint256[] memory tokenIds, int256[] memory scores) {
        uint256[] memory parts = competitions[compId].participants;
        int256[] memory s = new int256[](parts.length);
        for (uint256 i = 0; i < parts.length; i++) {
            s[i] = agentScore[compId][parts[i]];
        }
        return (parts, s);
    }

    function setPlatformFee(uint256 _fee) external onlyOwner {
        require(_fee <= 20, "Max 20%");
        platformFeePercent = _fee;
    }

    function setRevenueSharing(address _revenueSharing) external onlyOwner {
        revenueSharing = _revenueSharing;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
