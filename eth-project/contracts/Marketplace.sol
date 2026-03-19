// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract NFTMarketplace is ReentrancyGuard {

    struct Listing {
        address seller;
        address nft;
        uint256 tokenId;
        uint256 price;
        uint256 expiry;
    }

    uint256 public marketplaceFeePercent = 250; // 2.5% (basis points)
    address public feeRecipient;
    uint256 public listingCounter;

    mapping(uint256 => Listing) public listings;

    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed nft,
        uint256 tokenId,
        uint256 price
    );

    event Purchased(
        uint256 indexed listingId,
        address indexed buyer
    );

    event Cancelled(uint256 indexed listingId);

    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
    }

    // --------------------------------------------------
    // LIST NFT
    // --------------------------------------------------

    function listNFT(
        address _nft,
        uint256 _tokenId,
        uint256 _price,
        uint256 _expiry
    ) external {

        require(_price > 0, "Price must be > 0");
        require(_expiry > block.timestamp, "Invalid expiry");

        IERC721 nft = IERC721(_nft);

        require(
            nft.ownerOf(_tokenId) == msg.sender,
            "Not owner"
        );

        // Transfer NFT to escrow (this contract)
        nft.transferFrom(msg.sender, address(this), _tokenId);

        listings[listingCounter] = Listing({
            seller: msg.sender,
            nft: _nft,
            tokenId: _tokenId,
            price: _price,
            expiry: _expiry
        });

        emit Listed(
            listingCounter,
            msg.sender,
            _nft,
            _tokenId,
            _price
        );

        listingCounter++;
    }

    // --------------------------------------------------
    // BUY NFT
    // --------------------------------------------------

    function buyNFT(uint256 _listingId)
        external
        payable
        nonReentrant
    {
        Listing memory listing = listings[_listingId];

        require(listing.price > 0, "Invalid listing");
        require(block.timestamp <= listing.expiry, "Expired");
        require(msg.value == listing.price, "Incorrect ETH sent");

        delete listings[_listingId]; // Prevent reentrancy

        uint256 remainingAmount = msg.value;

        // --------------------------
        // ROYALTY SUPPORT (ERC-2981)
        // --------------------------

        if (
            IERC165(listing.nft).supportsInterface(
                type(IERC2981).interfaceId
            )
        ) {
            (address royaltyReceiver, uint256 royaltyAmount) =
                IERC2981(listing.nft).royaltyInfo(
                    listing.tokenId,
                    msg.value
                );

            if (royaltyAmount > 0) {
                payable(royaltyReceiver).transfer(royaltyAmount);
                remainingAmount -= royaltyAmount;
            }
        }

        // --------------------------
        // MARKETPLACE FEE
        // --------------------------

        uint256 marketplaceFee =
            (msg.value * marketplaceFeePercent) / 10000;

        payable(feeRecipient).transfer(marketplaceFee);
        remainingAmount -= marketplaceFee;

        // --------------------------
        // PAY SELLER
        // --------------------------

        payable(listing.seller).transfer(remainingAmount);

        // --------------------------
        // TRANSFER NFT TO BUYER
        // --------------------------

        IERC721(listing.nft).transferFrom(
            address(this),
            msg.sender,
            listing.tokenId
        );

        emit Purchased(_listingId, msg.sender);
    }

    // --------------------------------------------------
    // CANCEL LISTING
    // --------------------------------------------------

    function cancelListing(uint256 _listingId)
        external
        nonReentrant
    {
        Listing memory listing = listings[_listingId];

        require(listing.seller == msg.sender, "Not seller");

        delete listings[_listingId];

        IERC721(listing.nft).transferFrom(
            address(this),
            msg.sender,
            listing.tokenId
        );

        emit Cancelled(_listingId);
    }
}