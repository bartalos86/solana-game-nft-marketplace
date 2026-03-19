// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./GameItemNFT.sol";
import "./GameRegistry.sol";

/**
 * Combined game registry + factory for Ethereum.
 *
 * - Inherits on-chain game metadata registry from GameRegistry
 * - Deploys a dedicated GameItemNFT contract per registered game
 * - Only the platform authority (set at deployment) can create/update/remove games
 */
contract GameFactory is GameRegistry {
    /// All deployed game NFT contracts.
    GameItemNFT[] public gameContracts;

    event GameCreated(
        address indexed gameContract,
        address indexed authority,
        string name,
        string symbol
    );

    /// Platform authority is the deployer (mirrors Solana's fixed PLATFORM_AUTHORITY).
    constructor() GameRegistry(msg.sender) {}

    /**
     * Create a new game:
     * - Deploys a GameItemNFT contract
     * - Registers the game metadata in the inherited registry
     *
     * Reverts if:
     * - A game already exists for the given authority
     * - Any metadata validation in GameRegistry fails
     */
    function createGame(
        GameInput calldata input,
        string calldata symbol,
        uint96 royaltyBps
    ) external onlyPlatformAuthority returns (address) {
        // Deploy the NFT collection for this game.
        GameItemNFT game = new GameItemNFT(
            input.name,
            symbol,
            input.authority,
            royaltyBps
        );

        gameContracts.push(game);

        // Register metadata in the on-chain registry (will revert on invalid data).
        GameRegistry(address(this)).registerGame(input);

        emit GameCreated(
            address(game),
            input.authority,
            input.name,
            symbol
        );

        return address(game);
    }

    /// Number of games created through this factory.
    function gamesCount() external view returns (uint256) {
        return gameContracts.length;
    }

    /// Returns full game metadata for the given authority. Reverts if not registered.
    function getGameData(address authority) external view returns (Game memory) {
        Game memory data = getGame(authority);
        if (!data.exists) revert GameNotFound();
        return data;
    }

    /// Helper to find a game NFT contract by its authority.
    function getGameByAuthority(address authority) external view returns (GameItemNFT) {
        for (uint256 i = 0; i < gameContracts.length; i++) {
            if (gameContracts[i].authority() == authority) {
                return gameContracts[i];
            }
        }
        revert("Game not found");
    }
}