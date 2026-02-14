// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TokenVesting {
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 released;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 vestingDuration;
        bool revoked;
    }

    address public owner;
    IERC20 public token;

    mapping(address => VestingSchedule) public vestingSchedules;
    address[] public beneficiaries;
    uint256 public totalAllocated;

    event VestingCreated(address indexed beneficiary, uint256 totalAmount, uint256 cliffDuration, uint256 vestingDuration);
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event VestingRevoked(address indexed beneficiary, uint256 unreleased);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _token) {
        require(_token != address(0), "Token is zero address");
        owner = msg.sender;
        token = IERC20(_token);
    }

    function createVesting(
        address beneficiary,
        uint256 totalAmount,
        uint256 cliffDuration,
        uint256 vestingDuration
    ) external onlyOwner {
        require(beneficiary != address(0), "Beneficiary is zero");
        require(totalAmount > 0, "Amount is zero");
        require(vestingDuration > 0, "Vesting duration is zero");
        require(vestingSchedules[beneficiary].totalAmount == 0, "Vesting already exists");
        require(token.balanceOf(address(this)) >= totalAllocated + totalAmount, "Insufficient token balance");

        totalAllocated += totalAmount;

        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: totalAmount,
            released: 0,
            startTime: block.timestamp,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            revoked: false
        });

        beneficiaries.push(beneficiary);

        emit VestingCreated(beneficiary, totalAmount, cliffDuration, vestingDuration);
    }

    function release() external {
        _release(msg.sender);
    }

    function releaseFor(address beneficiary) external onlyOwner {
        _release(beneficiary);
    }

    function _release(address beneficiary) internal {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        require(schedule.totalAmount > 0, "No vesting schedule");
        require(!schedule.revoked, "Vesting revoked");

        uint256 releasable = _releasableAmount(schedule);
        require(releasable > 0, "No tokens to release");

        schedule.released += releasable;
        require(token.transfer(beneficiary, releasable), "Transfer failed");

        emit TokensReleased(beneficiary, releasable);
    }

    function _releasableAmount(VestingSchedule memory schedule) internal view returns (uint256) {
        return _vestedAmount(schedule) - schedule.released;
    }

    function _vestedAmount(VestingSchedule memory schedule) internal view returns (uint256) {
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return 0;
        }

        uint256 timeAfterCliff = block.timestamp - schedule.startTime - schedule.cliffDuration;

        if (timeAfterCliff >= schedule.vestingDuration) {
            return schedule.totalAmount;
        }

        return (schedule.totalAmount * timeAfterCliff) / schedule.vestingDuration;
    }

    function revoke(address beneficiary) external onlyOwner {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        require(schedule.totalAmount > 0, "No vesting schedule");
        require(!schedule.revoked, "Already revoked");

        uint256 releasable = _releasableAmount(schedule);
        if (releasable > 0) {
            schedule.released += releasable;
            require(token.transfer(beneficiary, releasable), "Transfer failed");
            emit TokensReleased(beneficiary, releasable);
        }

        uint256 unreleased = schedule.totalAmount - schedule.released;
        schedule.revoked = true;

        if (unreleased > 0) {
            require(token.transfer(owner, unreleased), "Transfer failed");
        }

        emit VestingRevoked(beneficiary, unreleased);
    }

    function getVestingInfo(address beneficiary) external view returns (
        uint256 totalAmount,
        uint256 released,
        uint256 releasable,
        uint256 startTime,
        uint256 cliffEnd,
        uint256 vestingEnd,
        bool revoked
    ) {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        return (
            schedule.totalAmount,
            schedule.released,
            schedule.totalAmount > 0 && !schedule.revoked ? _releasableAmount(schedule) : 0,
            schedule.startTime,
            schedule.startTime + schedule.cliffDuration,
            schedule.startTime + schedule.cliffDuration + schedule.vestingDuration,
            schedule.revoked
        );
    }

    function getBeneficiaryCount() external view returns (uint256) {
        return beneficiaries.length;
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
}
