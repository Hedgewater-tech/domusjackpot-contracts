// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IEntropy} from "../interfaces/IEntropy.sol";
import {IEntropyConsumer} from "../interfaces/IEntropyConsumer.sol";

// Mock implementation of Entropy Provider for testing
contract MockEntropyProvider {
    // Function to trigger the entropy callback manually for testing
    function triggerEntropyCallback(
        address consumer,
        uint64 sequenceNumber,
        bytes32 randomNumber
    ) external {
        IEntropyConsumer(consumer)._entropyCallback(
            sequenceNumber,
            address(this),
            randomNumber
        );
    }

    // Overloaded function to force a specific winner for testing
    function triggerEntropyCallback(
        address consumer,
        uint64 sequenceNumber,
        bytes32 randomNumber,
        address forcedWinner
    ) external {
        // This is a hack for testing to ensure a specific address wins the jackpot
        // It modifies the random number to guarantee a particular winner
        bytes32 manipulatedRandom = keccak256(abi.encodePacked(forcedWinner));
        
        IEntropyConsumer(consumer)._entropyCallback(
            sequenceNumber,
            address(this),
            manipulatedRandom
        );
    }

    // Mock implementation to satisfy the IEntropy interface requirements
    function getAddress() external view returns (address) {
        return address(this);
    }

    // Used by the consumer to verify the callback is from the entropy provider
    function getEntropyProviderAddress() external view returns (address) {
        return address(this);
    }
    
    // Mock implementation of getDefaultProvider required by BaseJackpot
    function getDefaultProvider() external view returns (address) {
        return address(this);
    }
}
