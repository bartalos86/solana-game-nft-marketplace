// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract GameItemNFT is
    ERC721URIStorage,
    ERC721Royalty,
    Ownable,
    EIP712
{
    using ECDSA for bytes32;

    uint256 private _nextTokenId;
    address public authority;

    // Prevent replay attacks
    mapping(bytes32 => bool) public usedDigests;

    // EIP-712 typehash
    bytes32 private constant MINT_TYPEHASH =
        keccak256(
            "Mint(address to,string uri,uint256 nonce)"
        );

    event ItemMinted(
        uint256 indexed tokenId,
        address indexed to,
        string uri
    );

    constructor(
        string memory name_,
        string memory symbol_,
        address gameAuthority,
        uint96 royaltyBps
    )
        ERC721(name_, symbol_)
        Ownable(gameAuthority)
        EIP712(name_, "1")
    {
        _setDefaultRoyalty(gameAuthority, royaltyBps);
        authority = gameAuthority;
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
        address to,
        string calldata uri,
        uint256 nonce,
        bytes calldata signature
    ) external returns (uint256) {

        bytes32 structHash = keccak256(
            abi.encode(
                MINT_TYPEHASH,
                to,
                keccak256(bytes(uri)),
                nonce
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);

        require(!usedDigests[digest], "Signature already used");

        address signer = ECDSA.recover(digest, signature);
        require(signer == owner(), "Invalid signature");

        usedDigests[digest] = true;

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit ItemMinted(tokenId, to, uri);

        return tokenId;
    }

    // Required overrides

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC721Royalty)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }
}