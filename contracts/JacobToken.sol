// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

contract JacobToken {
    string public constant name = "jacob";
    string public constant symbol = "JACOB";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    address public owner;
    address public controller;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public whitelisted;

    mapping(address => uint256[]) private _ownedTokens;
    mapping(uint256 => address) private _tokenOwners;
    mapping(uint256 => uint256) private _ownedTokensIndex;
    uint256 private _currentTokenId;

    uint256 public totalBurned;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event NFTMinted(address indexed to, uint256 indexed tokenId);
    event NFTBurned(address indexed from, uint256 indexed tokenId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event WhitelistUpdated(address indexed account, bool status);
    event TokensBurned(address indexed from, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _owner, address _controller) {
        owner = _owner;
        controller = _controller;
        uint256 initialSupply = 1_000_000 * _unit();
        balanceOf[_owner] = initialSupply;
        totalSupply = initialSupply;
        whitelisted[_owner] = true;
        emit Transfer(address(0), _owner, initialSupply);
    }

    function _unit() internal pure returns (uint256) {
        return 1e18;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        if (msg.sender != controller) {
            uint256 currentAllowance = allowance[from][msg.sender];
            if (currentAllowance != type(uint256).max) {
                require(currentAllowance >= amount, "Insufficient allowance");
                allowance[from][msg.sender] = currentAllowance - amount;
            }
        }
        return _transfer(from, to, amount);
    }

    function controllerTransferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        require(msg.sender == controller, "only bap");
        return _transfer(from, to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function burnFrom(address from, uint256 amount) external {
        uint256 currentAllowance = allowance[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "Insufficient allowance");
            allowance[from][msg.sender] = currentAllowance - amount;
        }
        _burn(from, amount);
    }

    function _burn(address from, uint256 amount) internal {
        require(from != address(0), "Burn from zero");
        require(balanceOf[from] >= amount, "Insufficient balance");

        uint256 nftsBefore = balanceOf[from] / _unit();
        balanceOf[from] -= amount;
        totalSupply -= amount;
        totalBurned += amount;
        uint256 nftsAfter = balanceOf[from] / _unit();

        if (!whitelisted[from]) {
            uint256 burnCount = nftsBefore - nftsAfter;
            for (uint256 i = 0; i < burnCount; i++) {
                _burnNFT(from);
            }
        }

        emit TokensBurned(from, amount);
        emit Transfer(from, address(0), amount);
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal returns (bool) {
        require(from != address(0), "Transfer from zero");
        require(to != address(0), "Transfer to zero");
        require(balanceOf[from] >= amount, "Insufficient balance");

        uint256 fromNFTsBefore = balanceOf[from] / _unit();
        uint256 toNFTsBefore = balanceOf[to] / _unit();

        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        uint256 fromNFTsAfter = balanceOf[from] / _unit();
        uint256 toNFTsAfter = balanceOf[to] / _unit();

        if (!whitelisted[from]) {
            uint256 burnCount = fromNFTsBefore - fromNFTsAfter;
            for (uint256 i = 0; i < burnCount; i++) {
                _burnNFT(from);
            }
        }

        if (!whitelisted[to]) {
            uint256 mintCount = toNFTsAfter - toNFTsBefore;
            for (uint256 i = 0; i < mintCount; i++) {
                _mintNFT(to);
            }
        }

        emit Transfer(from, to, amount);
        return true;
    }

    function _mintNFT(address to) internal {
        _currentTokenId++;
        uint256 tokenId = _currentTokenId;
        _tokenOwners[tokenId] = to;
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);
        emit NFTMinted(to, tokenId);
    }

    function _burnNFT(address from) internal {
        uint256[] storage tokens = _ownedTokens[from];
        require(tokens.length > 0, "No NFTs to burn");

        uint256 tokenId = tokens[tokens.length - 1];
        tokens.pop();
        delete _tokenOwners[tokenId];
        delete _ownedTokensIndex[tokenId];
        emit NFTBurned(from, tokenId);
    }

    function nftBalanceOf(address account) external view returns (uint256) {
        return _ownedTokens[account].length;
    }

    function tokenOfOwnerByIndex(
        address account,
        uint256 index
    ) external view returns (uint256) {
        require(index < _ownedTokens[account].length, "Index out of bounds");
        return _ownedTokens[account][index];
    }

    function nftOwnerOf(uint256 tokenId) external view returns (address) {
        address tokenOwner = _tokenOwners[tokenId];
        require(tokenOwner != address(0), "Token does not exist");
        return tokenOwner;
    }

    function setWhitelist(address account, bool status) external onlyOwner {
        whitelisted[account] = status;
        emit WhitelistUpdated(account, status);
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
