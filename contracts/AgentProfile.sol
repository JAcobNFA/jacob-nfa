// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract AgentProfile {
    IERC721 public immutable bap578;
    address public owner;

    struct Profile {
        string name;
        string bio;
        string avatar;
        uint256 createdAt;
        uint256 updatedAt;
    }

    mapping(uint256 => Profile) public profiles;
    mapping(bytes32 => bool) public nameTaken;

    uint256 public totalProfiles;

    event ProfileCreated(uint256 indexed tokenId, string name);
    event ProfileUpdated(uint256 indexed tokenId, string name, string bio);
    event NameChanged(uint256 indexed tokenId, string oldName, string newName);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAgentOwner(uint256 tokenId) {
        require(bap578.ownerOf(tokenId) == msg.sender, "Not agent owner");
        _;
    }

    constructor(address _bap578) {
        bap578 = IERC721(_bap578);
        owner = msg.sender;
    }

    function setProfile(
        uint256 tokenId,
        string calldata name,
        string calldata bio,
        string calldata avatar
    ) external onlyAgentOwner(tokenId) {
        require(bytes(name).length > 0 && bytes(name).length <= 32, "Name: 1-32 chars");
        require(bytes(bio).length <= 256, "Bio: max 256 chars");

        bytes32 nameHash = keccak256(abi.encodePacked(_toLower(name)));

        if (bytes(profiles[tokenId].name).length > 0) {
            bytes32 oldHash = keccak256(abi.encodePacked(_toLower(profiles[tokenId].name)));
            if (oldHash != nameHash) {
                require(!nameTaken[nameHash], "Name already taken");
                nameTaken[oldHash] = false;
                nameTaken[nameHash] = true;
                emit NameChanged(tokenId, profiles[tokenId].name, name);
            }
        } else {
            require(!nameTaken[nameHash], "Name already taken");
            nameTaken[nameHash] = true;
            totalProfiles++;
            profiles[tokenId].createdAt = block.timestamp;
            emit ProfileCreated(tokenId, name);
        }

        profiles[tokenId].name = name;
        profiles[tokenId].bio = bio;
        profiles[tokenId].avatar = avatar;
        profiles[tokenId].updatedAt = block.timestamp;

        emit ProfileUpdated(tokenId, name, bio);
    }

    function getProfile(uint256 tokenId) external view returns (
        string memory name,
        string memory bio,
        string memory avatar,
        uint256 createdAt,
        uint256 updatedAt
    ) {
        Profile storage p = profiles[tokenId];
        return (p.name, p.bio, p.avatar, p.createdAt, p.updatedAt);
    }

    function isNameAvailable(string calldata name) external view returns (bool) {
        bytes32 nameHash = keccak256(abi.encodePacked(_toLower(name)));
        return !nameTaken[nameHash];
    }

    function _toLower(string memory str) internal pure returns (string memory) {
        bytes memory b = bytes(str);
        bytes memory lower = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] >= 0x41 && b[i] <= 0x5A) {
                lower[i] = bytes1(uint8(b[i]) + 32);
            } else {
                lower[i] = b[i];
            }
        }
        return string(lower);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
