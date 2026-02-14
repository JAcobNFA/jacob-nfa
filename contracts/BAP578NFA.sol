// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract BAP578NFA is
    ERC721EnumerableUpgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    address public minter;
    address public controller;
    address public circuitBreaker;
    uint256 public pausedStatus;

    string public description;
    string public version;

    uint256 private _nextTokenId;

    mapping(uint256 => uint256) public agentFunds;

    bytes4 private constant _BAP578_INTERFACE_ID = 0x1a01a93a;

    enum AgentTier { NONE, BRONZE, SILVER, GOLD, DIAMOND, BLACK }

    mapping(uint256 => AgentTier) public agentTier;
    mapping(uint256 => uint256) public agentBurnedAmount;
    mapping(AgentTier => uint256) public tierCount;
    uint256 public totalAgentsBurned;

    address public upgrader;
    string public baseImageURI;

    event AgentFunded(uint256 indexed tokenId, address indexed funder, uint256 amount);
    event Paused(uint256 newPausedStatus);
    event Unpaused();
    event AgentMinted(uint256 indexed tokenId, address indexed to, AgentTier tier, uint256 burnedAmount);
    event AgentTierUpdated(uint256 indexed tokenId, AgentTier fromTier, AgentTier toTier, uint256 additionalBurned);

    modifier onlyMinter() {
        require(msg.sender == minter, "BAP578: caller is not the minter");
        _;
    }

    modifier whenNotPaused() {
        require(pausedStatus == 0, "BAP578: contract is paused");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        address _circuitBreaker
    ) public initializer {
        require(
            _circuitBreaker != address(0),
            "BAP578: Circuit Breaker address is zero"
        );

        __ERC721_init(_name, _symbol);
        __ERC721Enumerable_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        circuitBreaker = _circuitBreaker;
        description = "BAP-578 Non-Fungible Agent (NFA) Core Contract";
        version = "2.0.0";
        _nextTokenId = 1;
    }

    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
    }

    function setController(address _controller) external onlyOwner {
        controller = _controller;
    }

    function setUpgrader(address _upgrader) external onlyOwner {
        upgrader = _upgrader;
    }

    function setBaseImageURI(string memory _baseImageURI) external onlyOwner {
        baseImageURI = _baseImageURI;
    }

    function updateAgentTier(
        uint256 tokenId,
        AgentTier newTier,
        uint256 additionalBurned
    ) external {
        require(msg.sender == upgrader, "BAP578: caller is not the upgrader");
        require(_ownerOf(tokenId) != address(0), "BAP578: agent does not exist");
        require(newTier > agentTier[tokenId], "BAP578: must upgrade to higher tier");

        AgentTier oldTier = agentTier[tokenId];
        tierCount[oldTier]--;
        tierCount[newTier]++;
        agentTier[tokenId] = newTier;
        agentBurnedAmount[tokenId] += additionalBurned;
        totalAgentsBurned += additionalBurned;

        emit AgentTierUpdated(tokenId, oldTier, newTier, additionalBurned);
    }

    function mint(address to) external onlyMinter whenNotPaused returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    function mintWithTier(
        address to,
        AgentTier tier,
        uint256 burnedAmount
    ) external onlyMinter whenNotPaused returns (uint256) {
        require(tier != AgentTier.NONE, "BAP578: invalid tier");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        agentTier[tokenId] = tier;
        agentBurnedAmount[tokenId] = burnedAmount;
        tierCount[tier]++;
        totalAgentsBurned += burnedAmount;

        emit AgentMinted(tokenId, to, tier, burnedAmount);
        return tokenId;
    }

    function getAgentTier(uint256 tokenId) external view returns (uint8) {
        require(
            _ownerOf(tokenId) != address(0),
            "BAP578: agent does not exist"
        );
        return uint8(agentTier[tokenId]);
    }

    function getTierName(AgentTier tier) public pure returns (string memory) {
        if (tier == AgentTier.BRONZE) return "Bronze";
        if (tier == AgentTier.SILVER) return "Silver";
        if (tier == AgentTier.GOLD) return "Gold";
        if (tier == AgentTier.DIAMOND) return "Diamond";
        if (tier == AgentTier.BLACK) return "Black";
        return "None";
    }

    function fundAgent(uint256 tokenId) external payable {
        require(_ownerOf(tokenId) != address(0), "BAP578: agent does not exist");
        require(msg.value > 0, "BAP578: must send BNB");
        agentFunds[tokenId] += msg.value;
        emit AgentFunded(tokenId, msg.sender, msg.value);
    }

    function pause(uint256 newPausedStatus) external {
        require(
            msg.sender == circuitBreaker,
            "BAP578: caller is not the circuit breaker"
        );
        pausedStatus = newPausedStatus;
        emit Paused(newPausedStatus);
    }

    function unpause() external {
        require(
            msg.sender == circuitBreaker,
            "BAP578: caller is not the circuit breaker"
        );
        pausedStatus = 0;
        emit Unpaused();
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721EnumerableUpgradeable)
        returns (bool)
    {
        return
            interfaceId == _BAP578_INTERFACE_ID ||
            super.supportsInterface(interfaceId);
    }

    function _tierToFileName(AgentTier tier) internal pure returns (string memory) {
        if (tier == AgentTier.BRONZE) return "nft-bronze.png";
        if (tier == AgentTier.SILVER) return "nft-silver.png";
        if (tier == AgentTier.GOLD) return "nft-gold.png";
        if (tier == AgentTier.DIAMOND) return "nft-diamond.png";
        if (tier == AgentTier.BLACK) return "nft-black.png";
        return "nft-bronze.png";
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(
            _ownerOf(tokenId) != address(0),
            "BAP578: URI query for nonexistent token"
        );

        AgentTier tier = agentTier[tokenId];
        string memory tierName = getTierName(tier);
        uint256 burned = agentBurnedAmount[tokenId];
        string memory imageUrl = string(abi.encodePacked(baseImageURI, _tierToFileName(tier)));

        bytes memory json = abi.encodePacked(
            '{"name":"Jacob Agent #',
            _toString(tokenId),
            '","description":"BAP-578 Non-Fungible Agent - ',
            tierName,
            ' Tier","image":"',
            imageUrl,
            '","attributes":[{"trait_type":"Tier","value":"',
            tierName,
            '"},{"trait_type":"Burned JACOB","value":',
            _toString(burned / 1e18),
            '}]}'
        );

        return string(abi.encodePacked(
            "data:application/json;base64,",
            _base64Encode(json)
        ));
    }

    function _base64Encode(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";

        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        string memory result = new string(encodedLen);

        assembly {
            let tablePtr := add(table, 1)
            let resultPtr := add(result, 32)

            for { let i := 0 } lt(i, mload(data)) { i := add(i, 3) } {
                let input := and(mload(add(add(data, 32), i)), 0xffffff000000000000000000000000000000000000000000000000000000)

                let out := mload(add(tablePtr, and(shr(250, input), 0x3F)))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(244, input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(238, input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(232, input), 0x3F))), 0xFF))

                mstore(resultPtr, shl(224, out))
                resultPtr := add(resultPtr, 4)
            }

            switch mod(mload(data), 3)
            case 1 {
                mstore8(sub(resultPtr, 1), 0x3d)
                mstore8(sub(resultPtr, 2), 0x3d)
            }
            case 2 {
                mstore8(sub(resultPtr, 1), 0x3d)
            }
        }

        return result;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

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
