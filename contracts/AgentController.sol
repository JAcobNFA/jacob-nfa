// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

contract AgentController {
    string public name;
    string public version;
    string public description;
    address public owner;

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

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        name = "AgentController";
        version = "1.0.0";
        description = "BAP-578 Agent Controller for on-chain action execution";
        owner = msg.sender;
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

    function updateDescription(string calldata newDescription) external onlyOwner {
        description = newDescription;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    function getAgentAddress(address agent) external pure returns (address) {
        return agent;
    }
}
