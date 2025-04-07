// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title TokenPresale
 * @dev A contract for managing token presales with tiered whitelisting and configurable parameters
 */
contract TokenPresale is Ownable, ReentrancyGuard {
    // Presale struct to store all presale details
    struct Presale {
        uint256 presaleId;
        address tokenAddress;
        string tokenSymbol;    // Symbol of the token being sold
        uint256 tokenPrice;    // Price in ETH per token (in wei)
        uint256 valuation;     // Project valuation in USD (scaled by 1e18)
        uint256 totalAllocation; // Total token allocation for the presale
        uint256 startTime;
        uint256 endTime;
        uint256 minDepositAmount; // Minimum ETH deposit per user
        uint256 maxDepositAmount; // Maximum ETH deposit per user
        uint256 totalRaiseGoal;   // Total ETH to raise
        uint256 totalRaised;      // Total ETH raised so far
        uint256 tier1WhitelistEndTime; // When tier 1 whitelist period ends
        uint256 tier2WhitelistEndTime; // When tier 2 whitelist period ends
        bool isActive;            // Whether the presale is active
    }

    // Mapping from presale ID to Presale struct
    mapping(uint256 => Presale) public presales;
    
    // Mapping from presale ID to user address to deposited amount
    mapping(uint256 => mapping(address => uint256)) public userDeposits;
    
    // Mapping from presale ID to user address to max allowed deposit (whitelist amount)
    mapping(uint256 => mapping(address => uint256)) public tier1Whitelist;
    mapping(uint256 => mapping(address => uint256)) public tier2Whitelist;
    
    // Counter for presale IDs
    uint256 public presaleCounter;

    // Events
    event PresaleCreated(uint256 indexed presaleId, address tokenAddress, string tokenSymbol, uint256 tokenPrice);
    event Deposit(uint256 indexed presaleId, address indexed user, uint256 amount, uint256 tokensReceived);
    event WhitelistUpdated(uint256 indexed presaleId, address indexed user, uint256 amount, uint8 tier);
    event PresaleUpdated(uint256 indexed presaleId, bool isActive);
    event TokensWithdrawn(uint256 indexed presaleId, address indexed user, uint256 amount);
    event FundsWithdrawn(uint256 indexed presaleId, address indexed recipient, uint256 amount);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Create a new presale
     * @param _tokenAddress Address of the token being sold
     * @param _tokenSymbol Symbol of the token being sold
     * @param _tokenPrice Price of the token in ETH (wei)
     * @param _valuation Project valuation in USD (scaled by 1e18)
     * @param _totalAllocation Total token allocation for the presale
     * @param _startTime Start time of the presale
     * @param _endTime End time of the presale
     * @param _minDepositAmount Minimum deposit amount per user
     * @param _maxDepositAmount Maximum deposit amount per user
     * @param _totalRaiseGoal Total ETH to raise
     * @param _tier1WhitelistEndTime When tier 1 whitelist period ends
     * @param _tier2WhitelistEndTime When tier 2 whitelist period ends
     */
    function createPresale(
        address _tokenAddress,
        string memory _tokenSymbol,
        uint256 _tokenPrice,
        uint256 _valuation,
        uint256 _totalAllocation,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _minDepositAmount,
        uint256 _maxDepositAmount,
        uint256 _totalRaiseGoal,
        uint256 _tier1WhitelistEndTime,
        uint256 _tier2WhitelistEndTime
    ) external onlyOwner {
        require(_tokenAddress != address(0), "Invalid token address");
        require(bytes(_tokenSymbol).length > 0, "Invalid token symbol");
        require(_tokenPrice > 0, "Token price must be greater than 0");
        require(_valuation > 0, "Valuation must be greater than 0");
        require(_totalAllocation > 0, "Total allocation must be greater than 0");
        require(_startTime < _endTime, "Start time must be before end time");
        require(_minDepositAmount > 0, "Min deposit must be greater than 0");
        require(_maxDepositAmount >= _minDepositAmount, "Max deposit must be greater than or equal to min deposit");
        require(_totalRaiseGoal > 0, "Total raise goal must be greater than 0");
        require(_tier1WhitelistEndTime >= _startTime, "Tier 1 whitelist end time must be after start time");
        require(_tier2WhitelistEndTime >= _tier1WhitelistEndTime, "Tier 2 whitelist end time must be after tier 1 end time");
        require(_tier2WhitelistEndTime <= _endTime, "Tier 2 whitelist end time must be before end time");

        presaleCounter++;
        uint256 presaleId = presaleCounter;

        presales[presaleId] = Presale({
            presaleId: presaleId,
            tokenAddress: _tokenAddress,
            tokenSymbol: _tokenSymbol,
            tokenPrice: _tokenPrice,
            valuation: _valuation,
            totalAllocation: _totalAllocation,
            startTime: _startTime,
            endTime: _endTime,
            minDepositAmount: _minDepositAmount,
            maxDepositAmount: _maxDepositAmount,
            totalRaiseGoal: _totalRaiseGoal,
            totalRaised: 0,
            tier1WhitelistEndTime: _tier1WhitelistEndTime,
            tier2WhitelistEndTime: _tier2WhitelistEndTime,
            isActive: true
        });

        emit PresaleCreated(presaleId, _tokenAddress, _tokenSymbol, _tokenPrice);
    }

    /**
     * @dev Add users to tier 1 whitelist
     * @param _presaleId ID of the presale
     * @param _users Array of user addresses
     * @param _amounts Array of max deposit amounts for each user
     */
    function addToTier1Whitelist(
        uint256 _presaleId,
        address[] calldata _users,
        uint256[] calldata _amounts
    ) external onlyOwner {
        require(presales[_presaleId].isActive, "Presale is not active");
        require(_users.length == _amounts.length, "Arrays length mismatch");

        for (uint256 i = 0; i < _users.length; i++) {
            tier1Whitelist[_presaleId][_users[i]] = _amounts[i];
            emit WhitelistUpdated(_presaleId, _users[i], _amounts[i], 1);
        }
    }

    /**
     * @dev Add users to tier 2 whitelist
     * @param _presaleId ID of the presale
     * @param _users Array of user addresses
     * @param _amounts Array of max deposit amounts for each user
     */
    function addToTier2Whitelist(
        uint256 _presaleId,
        address[] calldata _users,
        uint256[] calldata _amounts
    ) external onlyOwner {
        require(presales[_presaleId].isActive, "Presale is not active");
        require(_users.length == _amounts.length, "Arrays length mismatch");

        for (uint256 i = 0; i < _users.length; i++) {
            tier2Whitelist[_presaleId][_users[i]] = _amounts[i];
            emit WhitelistUpdated(_presaleId, _users[i], _amounts[i], 2);
        }
    }

    /**
     * @dev Deposit ETH to participate in a presale
     * @param _presaleId ID of the presale
     */
    function deposit(uint256 _presaleId) external payable nonReentrant {
        Presale storage presale = presales[_presaleId];
        
        require(presale.isActive, "Presale is not active");
        require(block.timestamp >= presale.startTime, "Presale has not started yet");
        require(block.timestamp <= presale.endTime, "Presale has ended");
        require(msg.value >= presale.minDepositAmount, "Deposit amount is less than minimum");
        require(userDeposits[_presaleId][msg.sender] + msg.value <= presale.maxDepositAmount, "Exceeds maximum deposit amount");
        require(presale.totalRaised + msg.value <= presale.totalRaiseGoal, "Exceeds total raise goal");

        // Check whitelist status based on current time
        if (block.timestamp <= presale.tier1WhitelistEndTime) {
            // Tier 1 whitelist period
            require(tier1Whitelist[_presaleId][msg.sender] > 0, "Not in tier 1 whitelist");
            require(userDeposits[_presaleId][msg.sender] + msg.value <= tier1Whitelist[_presaleId][msg.sender], "Exceeds tier 1 whitelist amount");
        } else if (block.timestamp <= presale.tier2WhitelistEndTime) {
            // Tier 2 whitelist period
            require(tier1Whitelist[_presaleId][msg.sender] > 0 || tier2Whitelist[_presaleId][msg.sender] > 0, "Not in any whitelist");
            
            if (tier1Whitelist[_presaleId][msg.sender] > 0) {
                require(userDeposits[_presaleId][msg.sender] + msg.value <= tier1Whitelist[_presaleId][msg.sender], "Exceeds tier 1 whitelist amount");
            } else {
                require(userDeposits[_presaleId][msg.sender] + msg.value <= tier2Whitelist[_presaleId][msg.sender], "Exceeds tier 2 whitelist amount");
            }
        }
        // After tier2WhitelistEndTime, anyone can participate up to maxDepositAmount

        // Calculate tokens to receive
        uint256 tokensToReceive = (msg.value * 1e18) / presale.tokenPrice;
        
        // Update state
        userDeposits[_presaleId][msg.sender] += msg.value;
        presale.totalRaised += msg.value;
        
        emit Deposit(_presaleId, msg.sender, msg.value, tokensToReceive);
    }

    /**
     * @dev Withdraw tokens after presale ends (for users)
     * @param _presaleId ID of the presale
     */
    function withdrawTokens(uint256 _presaleId) external nonReentrant {
        Presale storage presale = presales[_presaleId];
        
        require(block.timestamp > presale.endTime, "Presale has not ended yet");
        require(userDeposits[_presaleId][msg.sender] > 0, "No deposits found");
        
        uint256 depositAmount = userDeposits[_presaleId][msg.sender];
        uint256 tokensToReceive = (depositAmount * 1e18) / presale.tokenPrice;
        
        // Reset user deposit to prevent re-entrancy
        userDeposits[_presaleId][msg.sender] = 0;
        
        // Transfer tokens to user
        IERC20 token = IERC20(presale.tokenAddress);
        require(token.transfer(msg.sender, tokensToReceive), "Token transfer failed");
        
        emit TokensWithdrawn(_presaleId, msg.sender, tokensToReceive);
    }

    /**
     * @dev Withdraw raised funds (for owner)
     * @param _presaleId ID of the presale
     * @param _recipient Address to receive the funds
     */
    function withdrawFunds(uint256 _presaleId, address payable _recipient) external onlyOwner nonReentrant {
        Presale storage presale = presales[_presaleId];
        
        require(block.timestamp > presale.endTime, "Presale has not ended yet");
        require(_recipient != address(0), "Invalid recipient address");
        
        uint256 amount = presale.totalRaised;
        presale.totalRaised = 0;
        
        // Transfer ETH to recipient
        (bool success, ) = _recipient.call{value: amount}("");
        require(success, "ETH transfer failed");
        
        emit FundsWithdrawn(_presaleId, _recipient, amount);
    }

    /**
     * @dev Set presale active status
     * @param _presaleId ID of the presale
     * @param _isActive Whether the presale is active
     */
    function setPresaleStatus(uint256 _presaleId, bool _isActive) external onlyOwner {
        require(presales[_presaleId].presaleId == _presaleId, "Presale does not exist");
        presales[_presaleId].isActive = _isActive;
        emit PresaleUpdated(_presaleId, _isActive);
    }

    /**
     * @dev Get user deposit amount
     * @param _presaleId ID of the presale
     * @param _user Address of the user
     * @return User's deposit amount
     */
    function getUserDeposit(uint256 _presaleId, address _user) external view returns (uint256) {
        return userDeposits[_presaleId][_user];
    }

    /**
     * @dev Get user whitelist status and amount
     * @param _presaleId ID of the presale
     * @param _user Address of the user
     * @return tier1Amount Tier 1 whitelist amount
     * @return tier2Amount Tier 2 whitelist amount
     */
    function getUserWhitelistStatus(uint256 _presaleId, address _user) external view returns (uint256 tier1Amount, uint256 tier2Amount) {
        return (tier1Whitelist[_presaleId][_user], tier2Whitelist[_presaleId][_user]);
    }

    /**
     * @dev Calculate tokens to receive for a given ETH amount
     * @param _presaleId ID of the presale
     * @param _ethAmount Amount of ETH
     * @return Amount of tokens to receive
     */
    function calculateTokenAmount(uint256 _presaleId, uint256 _ethAmount) external view returns (uint256) {
        Presale storage presale = presales[_presaleId];
        return (_ethAmount * 1e18) / presale.tokenPrice;
    }

    /**
     * @dev Emergency function to recover any ERC20 tokens sent to the contract by mistake
     * @param _tokenAddress Address of the token to recover
     * @param _recipient Address to receive the tokens
     */
    function recoverERC20(address _tokenAddress, address _recipient) external onlyOwner {
        IERC20 token = IERC20(_tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        require(token.transfer(_recipient, balance), "Token transfer failed");
    }
}
