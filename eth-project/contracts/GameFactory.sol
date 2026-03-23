// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./GameItemNFT.sol";
import "./GameRegistry.sol";

/**
 * Combined game registry + shared collection manager for Ethereum.
 *
 * - Inherits on-chain game metadata registry from GameRegistry
 * - Deploys one shared ERC-1155 collection contract
 * - All items are minted in that single contract and categorized by game authority
 * - Only the platform authority (set at deployment) can create/update/remove games
 */
contract GameFactory is GameRegistry {
    /// Shared collection for all registered games.
    GameItemNFT public immutable gameItems;

    event GameCreated(
        address indexed gameContract,
        address indexed authority,
        string name
    );

    /// Platform authority is the deployer (mirrors Solana's fixed PLATFORM_AUTHORITY).
    constructor() GameRegistry(msg.sender) {
        gameItems = new GameItemNFT(address(this));
    }

    /**
     * Create a new game:
     * - Deploys a GameItemNFT collection contract (ERC-1155)
     * - Registers the game metadata in the inherited registry
     *
     * Reverts if:
     * - A game already exists for the given authority
     * - Any metadata validation in GameRegistry fails
     */
    function createGame(
        GameInput calldata input
    ) external onlyPlatformAuthority returns (address) {
        // Register metadata in the on-chain registry (will revert on invalid data).
        registerGame(input);

        emit GameCreated(
            address(gameItems),
            input.authority,
            input.name
        );

        return address(gameItems);
    }

    /// Returns full game metadata for the given authority. Reverts if not registered.
    function getGameData(address authority) external view returns (Game memory) {
        Game memory data = games[authority];
        if (!data.exists) revert GameNotFound();
        return data;
    }

    /// Returns the shared game NFT contract if authority is registered.
    function getGameByAuthority(address authority) external view returns (GameItemNFT) {
        if (!games[authority].exists) revert GameNotFound();
        return gameItems;
    }
}