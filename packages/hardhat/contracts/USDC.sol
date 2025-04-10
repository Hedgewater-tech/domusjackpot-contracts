// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract USDC is ERC20, Ownable {
    constructor() ERC20("USDC", "USDC") Ownable(msg.sender) {
        // Constructor initializes the token with name and symbol
        // send 100K USDC to owner
        _mint(msg.sender, 1000000000000000000000000000);
    }

    /**
     * @dev Mint new tokens. Only callable by owner.
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint (in wei)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Returns the number of decimals used for token - always 18
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
