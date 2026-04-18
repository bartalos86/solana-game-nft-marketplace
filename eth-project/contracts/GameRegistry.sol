// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Game registry: platform-authority-only register/update/remove of game metadata.
 * Mirrors the Solana game_registry program (one game per authority).
 */
contract GameRegistry is Ownable {
    // -------------------------------------------------------------------------
    // Constants (match Solana game_registry)
    // -------------------------------------------------------------------------

    /// Maximum fee percent in basis points (2000 = 20%).
    uint16 public constant FEE_PERCENT_MAX = 2000;

    uint256 public constant GAME_NAME_MAX_LEN = 64;
    uint256 public constant DESCRIPTION_MAX_LEN = 700;
    uint256 public constant IMAGE_URI_MAX_LEN = 500;
    uint256 public constant URI_MAX_LEN = 500;
    uint256 public constant CATEGORY_MAX_LEN = 64;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    struct Game {
        address authority;
        string name;
        string description;
        string imageUri;
        string uri;
        string category;
        address feeRecipient;
        uint16 feePercentBps;
        bool exists;
    }

    /// authority => Game
    mapping(address => Game) public games;

    /// Input for registerGame / updateGame (reduces stack depth).
    struct GameInput {
        address authority;
        string name;
        string description;
        string imageUri;
        string uri;
        string category;
        address feeRecipient;
        uint16 feePercentBps;
    }

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error Unauthorized();
    error FeePercentTooHigh();
    error NameTooLong();
    error DescriptionTooLong();
    error ImageUriTooLong();
    error UriTooLong();
    error CategoryTooLong();
    error GameNotFound();
    error GameAlreadyRegistered();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event GameRegistered(address indexed authority, string name);
    event GameUpdated(address indexed authority, string name);
    event GameRemoved(address indexed authority);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _platformAuthority) Ownable(_platformAuthority) {}

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyPlatformAuthority() {
        _checkOwner();
        _;
    }

    /// Backward-compatiblity for tests
    function platformAuthority() external view returns (address) {
        return owner();
    }

    // -------------------------------------------------------------------------
    // External (platform authority only)
    // -------------------------------------------------------------------------

    /**
     * Register a game. One game per authority.
     */
    function registerGame(GameInput calldata input) public onlyPlatformAuthority {
        if (games[input.authority].exists) revert GameAlreadyRegistered();
        _validateLengths(input.name, input.description, input.imageUri, input.uri, input.category);
        if (input.feePercentBps > FEE_PERCENT_MAX) revert FeePercentTooHigh();

        Game storage g = games[input.authority];
        g.authority = input.authority;
        g.name = input.name;
        g.description = input.description;
        g.imageUri = input.imageUri;
        g.uri = input.uri;
        g.category = input.category;
        g.feeRecipient = input.feeRecipient == address(0) ? input.authority : input.feeRecipient;
        g.feePercentBps = input.feePercentBps;
        g.exists = true;

        emit GameRegistered(input.authority, input.name);
    }

    /**
     * Update game metadata. All string fields are set to the values passed (pass
     * empty string to clear). For feeRecipient, pass address(0) to keep current.
     * For feePercentBps, pass a value > FEE_PERCENT_MAX (e.g. 0xFFFF) to keep current.
     */
    function updateGame(GameInput calldata input) public onlyPlatformAuthority {
        Game storage game = games[input.authority];
        if (!game.exists) revert GameNotFound();
        _validateLengths(input.name, input.description, input.imageUri, input.uri, input.category);

        game.name = input.name;
        game.description = input.description;
        game.imageUri = input.imageUri;
        game.uri = input.uri;
        game.category = input.category;
        if (input.feeRecipient != address(0)) {
            game.feeRecipient = input.feeRecipient;
        }
        if (input.feePercentBps <= FEE_PERCENT_MAX) {
            game.feePercentBps = input.feePercentBps;
        }

        emit GameUpdated(input.authority, game.name);
    }

    function _validateLengths(
        string calldata name,
        string calldata description,
        string calldata imageUri,
        string calldata uri,
        string calldata category
    ) private pure {
        if (bytes(name).length > GAME_NAME_MAX_LEN) revert NameTooLong();
        if (bytes(description).length > DESCRIPTION_MAX_LEN) revert DescriptionTooLong();
        if (bytes(imageUri).length > IMAGE_URI_MAX_LEN) revert ImageUriTooLong();
        if (bytes(uri).length > URI_MAX_LEN) revert UriTooLong();
        if (bytes(category).length > CATEGORY_MAX_LEN) revert CategoryTooLong();
    }

    /**
     * Remove a game (clears storage, same idea as Solana close).
     */
    function removeGame(address authority) public onlyPlatformAuthority {
        if (!games[authority].exists) revert GameNotFound();
        delete games[authority];
        emit GameRemoved(authority);
    }

    // -------------------------------------------------------------------------
    // View
    // -------------------------------------------------------------------------

    function getGame(address authority) external view returns (Game memory) {
        return games[authority];
    }

    function isGameRegistered(address authority) external view returns (bool) {
        return games[authority].exists;
    }

    function getGameRoyaltyConfig(address authority)
        external
        view
        returns (bool exists, address feeRecipient, uint16 feePercentBps)
    {
        Game storage game = games[authority];
        return (game.exists, game.feeRecipient, game.feePercentBps);
    }
}
