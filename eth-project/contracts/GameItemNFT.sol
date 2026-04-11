// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./GameRegistry.sol";

contract GameItemNFT is
    ERC1155URIStorage,
    ERC2981,
    Ownable,
    EIP712
{
    using ECDSA for bytes32;
    using EnumerableSet for EnumerableSet.UintSet;
    string private constant SIGNING_DOMAIN_NAME = "GameItemNFT";

    uint256 private _nextTokenId;
    GameRegistry public immutable registry;

    // Prevent replay attacks
    mapping(bytes32 => bool) public usedDigests;
    mapping(uint256 => address) public tokenGameAuthority;
    mapping(address => EnumerableSet.UintSet) private _ownedTokenIds;

    // EIP-712 typehash
    bytes32 private constant MINT_TYPEHASH =
        keccak256(
            "Mint(address gameAuthority,address to,string uri,uint256 amount,uint256 nonce)"
        );

    error InvalidGame();

    event ItemMinted(
        uint256 indexed tokenId,
        address indexed gameAuthority,
        address indexed to,
        uint256 amount,
        string uri
    );

    constructor(address registryAddress)
        ERC1155("")
        Ownable(registryAddress)
        EIP712(SIGNING_DOMAIN_NAME, "1")
    {
        registry = GameRegistry(registryAddress);
    }

    /**
     * Mint using backend signature authorization.
     *
     * Backend signs typed data:
     *   to
     *   uri
     *   nonce
     */
    function mintWithSignature(
        address gameAuthority,
        address to,
        string calldata tokenUri,
        uint256 nonce,
        bytes calldata signature
    ) external returns (uint256) {
        return _mintWithSignature(gameAuthority, to, tokenUri, 1, nonce, signature);
    }

    function _mintWithSignature(
        address gameAuthority,
        address to,
        string calldata tokenUri,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) internal returns (uint256) {
        require(amount > 0, "Amount must be > 0");
        (bool exists, address feeRecipient, uint16 feePercentBps) =
            registry.getGameRoyaltyConfig(gameAuthority);
        if (!exists) revert InvalidGame();

        _validateAndConsumeSignature(
            gameAuthority,
            to,
            tokenUri,
            amount,
            nonce,
            signature
        );

        uint256 tokenId = _nextTokenId++;
        _setURI(tokenId, tokenUri);
        tokenGameAuthority[tokenId] = gameAuthority;
        _setTokenRoyalty(tokenId, feeRecipient, feePercentBps);
        _mint(to, tokenId, amount, "");
        emit ItemMinted(tokenId, gameAuthority, to, amount, tokenUri);

        return tokenId;
    }

    function _validateAndConsumeSignature(
        address gameAuthority,
        address to,
        string calldata tokenUri,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) internal {
        bytes32 structHash = keccak256(
            abi.encode(
                MINT_TYPEHASH,
                gameAuthority,
                to,
                keccak256(bytes(tokenUri)),
                amount,
                nonce
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        require(!usedDigests[digest], "Signature already used");

        address signer = ECDSA.recover(digest, signature);
        require(signer == gameAuthority, "Invalid signature");
        usedDigests[digest] = true;
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        super._update(from, to, ids, values);

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 tokenId = ids[i];

            if (from != address(0) && balanceOf(from, tokenId) == 0) {
                _ownedTokenIds[from].remove(tokenId);
            }

            if (to != address(0) && balanceOf(to, tokenId) > 0) {
                _ownedTokenIds[to].add(tokenId);
            }
        }
    }

    function getPlayerTokenIdsByGame(
        address player,
        address gameAuthority
    ) external view returns (uint256[] memory) {
        EnumerableSet.UintSet storage owned = _ownedTokenIds[player];
        uint256 ownedLen = owned.length();
        uint256 matched;

        for (uint256 i = 0; i < ownedLen; i++) {
            uint256 tokenId = owned.at(i);
            if (tokenGameAuthority[tokenId] == gameAuthority) {
                matched++;
            }
        }

        uint256[] memory tokenIds = new uint256[](matched);
        uint256 outIdx;
        for (uint256 i = 0; i < ownedLen; i++) {
            uint256 tokenId = owned.at(i);
            if (tokenGameAuthority[tokenId] == gameAuthority) {
                tokenIds[outIdx] = tokenId;
                outIdx++;
            }
        }

        return tokenIds;
    }

    function getPlayerTokenIdsAndBalancesByGame(
        address player,
        address gameAuthority
    )
        external
        view
        returns (uint256[] memory tokenIds, uint256[] memory balances)
    {
        EnumerableSet.UintSet storage owned = _ownedTokenIds[player];
        uint256 ownedLen = owned.length();
        uint256 matched;

        for (uint256 i = 0; i < ownedLen; i++) {
            uint256 tokenId = owned.at(i);
            if (tokenGameAuthority[tokenId] == gameAuthority) {
                matched++;
            }
        }

        tokenIds = new uint256[](matched);
        balances = new uint256[](matched);
        uint256 outIdx;
        for (uint256 i = 0; i < ownedLen; i++) {
            uint256 tokenId = owned.at(i);
            if (tokenGameAuthority[tokenId] == gameAuthority) {
                tokenIds[outIdx] = tokenId;
                balances[outIdx] = balanceOf(player, tokenId);
                outIdx++;
            }
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}