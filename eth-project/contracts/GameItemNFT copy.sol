// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.20;

// import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
// import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";

// /**
//  * GameItemNFT — ERC-721 contract for game items.
//  *
//  * - ERC721URIStorage: each token stores its own IPFS/Arweave metadata URI
//  * - ERC721Royalty (ERC-2981): on-sale royalties, read by your Marketplace.sol
//  * - Ownable: only the game authority (owner) can mint
//  */
// contract GameItemNFT is ERC721URIStorage, ERC721Royalty, Ownable {
//     uint256 private _nextTokenId;

//     // gameId stored per-token so the marketplace/SDK can filter
//     mapping(uint256 => string) public tokenGameId;

//     event ItemMinted(
//         uint256 indexed tokenId,
//         address indexed to,
//         string tokenURI,
//         string gameId
//     );

//     /**
//      * @param name_          Collection name  (e.g. "My Game Items")
//      * @param symbol_        Collection symbol (e.g. "MGIT")
//      * @param gameAuthority  Address that will own the contract and can mint
//      * @param royaltyBps     Royalty in basis points, e.g. 550 = 5.5%
//      */
//     constructor(
//         string memory name_,
//         string memory symbol_,
//         address gameAuthority,
//         uint96 royaltyBps
//     ) ERC721(name_, symbol_) Ownable(gameAuthority) {
//         // Default royalty: royaltyBps out of 10_000 paid to gameAuthority
//         _setDefaultRoyalty(gameAuthority, royaltyBps);
//     }

//     /**
//      * Mint a single game-item NFT.
//      * Only callable by the game authority (owner).
//      *
//      * @param to        Recipient (player wallet)
//      * @param uri       Arweave / IPFS metadata URL (your manifestUrl)
//      * @param gameId    Arbitrary game identifier stored on-chain
//      */
//     function mintItem(
//         address to,
//         string calldata uri,
//         string calldata gameId
//     ) external onlyOwner returns (uint256) {
//         uint256 tokenId = _nextTokenId++;
//         _safeMint(to, tokenId);
//         _setTokenURI(tokenId, uri);
//         tokenGameId[tokenId] = gameId;

//         emit ItemMinted(tokenId, to, uri, gameId);
//         return tokenId;
//     }

//     // ------------------------------------------------------------------
//     // Overrides required because both ERC721URIStorage and ERC721Royalty
//     // override the same base functions
//     // ------------------------------------------------------------------

//     function tokenURI(uint256 tokenId)
//         public view override(ERC721, ERC721URIStorage)
//         returns (string memory)
//     {
//         return super.tokenURI(tokenId);
//     }

//     function supportsInterface(bytes4 interfaceId)
//         public view override(ERC721URIStorage, ERC721Royalty)
//         returns (bool)
//     {
//         return super.supportsInterface(interfaceId);
//     }

//     function _update(address to, uint256 tokenId, address auth)
//         internal override(ERC721)
//         returns (address)
//     {
//         return super._update(to, tokenId, auth);
//     }
// }