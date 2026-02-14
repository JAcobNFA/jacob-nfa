// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IJacobTokenRef {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ReferralRewards {
    IJacobTokenRef public immutable jacobToken;
    address public owner;
    bool public paused;

    uint256 public rewardPerReferral = 5 * 1e18;
    uint256 public bonusPerTierLevel = 2 * 1e18;

    struct ReferralData {
        address referrer;
        uint256 totalReferred;
        uint256 totalEarned;
        bool registered;
    }

    mapping(address => ReferralData) public referrals;
    mapping(address => address) public referredBy;
    mapping(address => address[]) public referralList;

    uint256 public totalReferrals;
    uint256 public totalRewardsPaid;

    event ReferrerRegistered(address indexed referrer);
    event ReferralRecorded(address indexed referrer, address indexed referred, uint256 reward);
    event RewardClaimed(address indexed referrer, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Referrals paused");
        _;
    }

    constructor(address _jacobToken) {
        jacobToken = IJacobTokenRef(_jacobToken);
        owner = msg.sender;
    }

    function registerAsReferrer() external whenNotPaused {
        require(!referrals[msg.sender].registered, "Already registered");
        referrals[msg.sender].registered = true;
        referrals[msg.sender].referrer = msg.sender;
        emit ReferrerRegistered(msg.sender);
    }

    function recordReferral(address referred, uint8 agentTier) external whenNotPaused {
        require(msg.sender == owner, "Only owner can record");
        require(referredBy[referred] != address(0), "No referrer set");
        require(referrals[referredBy[referred]].registered, "Referrer not registered");

        address referrer = referredBy[referred];
        uint256 reward = rewardPerReferral + (uint256(agentTier) * bonusPerTierLevel);

        if (jacobToken.balanceOf(address(this)) >= reward) {
            jacobToken.transfer(referrer, reward);
            referrals[referrer].totalEarned += reward;
            totalRewardsPaid += reward;
            emit ReferralRecorded(referrer, referred, reward);
        }

        referrals[referrer].totalReferred++;
        referralList[referrer].push(referred);
        totalReferrals++;
    }

    function setReferrer(address referrer) external whenNotPaused {
        require(referredBy[msg.sender] == address(0), "Already has referrer");
        require(referrer != msg.sender, "Cannot refer yourself");
        require(referrals[referrer].registered, "Referrer not registered");
        referredBy[msg.sender] = referrer;
    }

    function getReferralCount(address referrer) external view returns (uint256) {
        return referrals[referrer].totalReferred;
    }

    function getReferralList(address referrer) external view returns (address[] memory) {
        return referralList[referrer];
    }

    function setRewardAmounts(uint256 _perReferral, uint256 _perTier) external onlyOwner {
        rewardPerReferral = _perReferral;
        bonusPerTierLevel = _perTier;
    }

    function withdrawTokens(uint256 amount) external onlyOwner {
        jacobToken.transfer(owner, amount);
    }

    function pause() external onlyOwner { paused = true; }
    function unpause() external onlyOwner { paused = false; }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
