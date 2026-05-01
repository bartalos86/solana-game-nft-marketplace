// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract NFTMarketplace is ReentrancyGuard, ERC1155Holder {

    struct Listing {
        address seller;
        address nft;
        uint256 tokenId;
        uint256 quantity;
        uint256 price;
        uint256 expiry;
    }

    uint256 public constant MARKETPLACE_FEE_PERCENT = 250; // 2.5% (basis points)
    address public immutable feeRecipient;
    uint256 public listingCounter;

    mapping(uint256 => Listing) public listings;

    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed nft,
        uint256 tokenId,
        uint256 quantity,
        uint256 price
    );

    event Purchased(
        uint256 indexed listingId,
        address indexed buyer
    );

    event Cancelled(uint256 indexed listingId);

    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
    }

    /// List an ERC-1155 token for sale; tokens are held in escrow by this contract until sold or cancelled.
    function listNFT(
        address nftAddress,
        uint256 tokenId,
        uint256 quantity,
        uint256 price,
        uint256 expiry
    ) external nonReentrant {
        require(price > 0, "Price must be > 0");
        require(quantity > 0, "Quantity must be > 0");
        // slither-disable-next-line timestamp
        require(expiry > block.timestamp, "Invalid expiry");
        require(
            IERC165(nftAddress).supportsInterface(type(IERC1155).interfaceId),
            "Not ERC1155"
        );

        IERC1155 nft = IERC1155(nftAddress);
        require(
            nft.balanceOf(msg.sender, tokenId) >= quantity,
            "Insufficient balance"
        );

        uint256 listingId = listingCounter;
        listingCounter++;

        listings[listingId] = Listing({
            seller: msg.sender,
            nft: nftAddress,
            tokenId: tokenId,
            quantity: quantity,
            price: price,
            expiry: expiry
        });

        emit Listed(
            listingId,
            msg.sender,
            nftAddress,
            tokenId,
            quantity,
            price
        );

        nft.safeTransferFrom(msg.sender, address(this), tokenId, quantity, "");
    }

    /// Purchase a listing; distributes ETH to royalty receiver, marketplace, and seller, then transfers the token.
    function buyNFT(uint256 listingId)
        external
        payable
        nonReentrant
    {
        Listing memory listing = listings[listingId];

        require(listing.price > 0, "Invalid listing");
        // slither-disable-next-line timestamp
        require(block.timestamp <= listing.expiry, "Expired");
        require(msg.value == listing.price, "Incorrect ETH sent");

        delete listings[listingId]; // Prevent reentrancy

        uint256 remainingAmount = msg.value;

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

        uint256 marketplaceFee =
            (msg.value * MARKETPLACE_FEE_PERCENT) / 10000;

        payable(feeRecipient).transfer(marketplaceFee);
        remainingAmount -= marketplaceFee;

        //Pay sellet
        payable(listing.seller).transfer(remainingAmount);


        //Transfer to buyer
        IERC1155(listing.nft).safeTransferFrom(
            address(this),
            msg.sender,
            listing.tokenId,
            listing.quantity,
            ""
        );

        emit Purchased(listingId, msg.sender);
    }

    /// Cancel a listing and return the escrowed tokens to the seller.
    function cancelListing(uint256 listingId)
        external
        nonReentrant
    {
        Listing memory listing = listings[listingId];

        require(listing.seller == msg.sender, "Not seller");

        delete listings[listingId];

        IERC1155(listing.nft).safeTransferFrom(
            address(this),
            msg.sender,
            listing.tokenId,
            listing.quantity,
            ""
        );

        emit Cancelled(listingId);
    }
}
