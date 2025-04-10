// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockToken
 * @dev Simple ERC20 token for testing the BaseJackpot contract
 */
contract MockToken is ERC20, ERC20Burnable, Ownable {
    uint8 private _decimals;

    /**
     * @dev Constructor that gives msg.sender all of existing tokens
     * @param name The name of the token
     * @param symbol The symbol of the token
     * @param decimalsValue The number of decimals for the token
     */
    constructor(
        string memory name, 
        string memory symbol, 
        uint8 decimalsValue
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = decimalsValue;
        _mint(msg.sender, 1000000 * 10**decimalsValue); // Mint 1 million tokens
    }

    /**
     * @dev Override the decimals function to return custom decimal value
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mint new tokens to a target address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
