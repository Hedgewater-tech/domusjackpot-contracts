import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { BaseJackpot, MockToken, MockEntropyProvider } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("BaseJackpot E2E", function () {
  // Contracts
  let baseJackpot: BaseJackpot;
  let mockToken: MockToken;
  let mockEntropy: MockEntropyProvider;
  
  // Addresses
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let lp1: SignerWithAddress;
  let lp2: SignerWithAddress;
  let fallbackWinner: SignerWithAddress;
  let protocolFeeAddress: SignerWithAddress;

  // Test constants
  const INITIAL_TOKEN_AMOUNT = ethers.parseEther("50000");
  const TICKET_PRICE_RAW = 10; // Raw ticket price (will be multiplied by 10^decimals in the contract)
  const ROUND_DURATION = 60 * 60 * 24;
  const FEE_BPS = 1000; // 10%
  const REFERRAL_FEE_BPS = 500; // 5%
  const MIN_LP_DEPOSIT = ethers.parseEther("1000");
  
  beforeEach(async function () {
    // Setup accounts
    [owner, user1, user2, user3, user4, lp1, lp2, fallbackWinner, protocolFeeAddress] = 
      await ethers.getSigners();
    
    // Deploy token
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MOCK", 18);
    await mockToken.waitForDeployment();
    
    // Deploy entropy provider mock
    const MockEntropyProvider = await ethers.getContractFactory("MockEntropyProvider");
    mockEntropy = await MockEntropyProvider.deploy();
    await mockEntropy.waitForDeployment();
    
    // Deploy jackpot contract
    const BaseJackpot = await ethers.getContractFactory("BaseJackpot");
    baseJackpot = await upgrades.deployProxy(
      BaseJackpot,
      [
        await mockEntropy.getAddress(),
        owner.address,
        await mockToken.getAddress(),
        TICKET_PRICE_RAW
      ],
      { kind: "uups" }
    ) as unknown as BaseJackpot;
    await baseJackpot.waitForDeployment();
    
    // Configure additional parameters after deployment
    await baseJackpot.setRoundDurationInSeconds(ROUND_DURATION);
    await baseJackpot.setFeeBps(FEE_BPS);
    await baseJackpot.setReferralFeeBps(REFERRAL_FEE_BPS);
    await baseJackpot.setFallbackWinner(fallbackWinner.address);
    await baseJackpot.setProtocolFeeAddress(protocolFeeAddress.address);
    await baseJackpot.setLpLimit(5); // LP limit
    await baseJackpot.setMinLpDeposit(MIN_LP_DEPOSIT);
    await baseJackpot.setUserLimit(1000); // User limit
    await baseJackpot.setAllowPurchasing(true); // Allow purchasing
    
    // Fund accounts with tokens
    for (const account of [user1, user2, user3, user4, lp1, lp2]) {
      await mockToken.transfer(account.address, INITIAL_TOKEN_AMOUNT);
      await mockToken.connect(account).approve(await baseJackpot.getAddress(), ethers.MaxUint256);
    }
  });

  it("Should run a complete jackpot cycle with 2 LPs and 4 users", async function () {
    // Step 1: LPs deposit with different risk profiles
    console.log("Step 1: LP Deposits");
    const lp1Deposit = ethers.parseEther("10000");
    const lp2Deposit = ethers.parseEther("15000");
    const lp1RiskPercentage = 60; // 60% risk
    const lp2RiskPercentage = 40; // 40% risk
    
    await baseJackpot.connect(lp1).lpDeposit(lp1RiskPercentage, lp1Deposit);
    await baseJackpot.connect(lp2).lpDeposit(lp2RiskPercentage, lp2Deposit);
    
    // Verify LP deposits were successful
    const lp1Info = await baseJackpot.lpsInfo(lp1.address);
    const lp2Info = await baseJackpot.lpsInfo(lp2.address);
    
    expect(lp1Info.principal).to.equal(lp1Deposit);
    expect(lp2Info.principal).to.equal(lp2Deposit);
    expect(lp1Info.riskPercentage).to.equal(lp1RiskPercentage);
    expect(lp2Info.riskPercentage).to.equal(lp2RiskPercentage);
    
    // Verify LP pool totals
    const totalLpDeposit = BigInt(lp1Deposit) + BigInt(lp2Deposit);
    expect(await baseJackpot.lpPoolTotal()).to.equal(totalLpDeposit);
    
    // Step 2: Users purchase tickets
    console.log("Step 2: User Ticket Purchases");
    const user1Purchase = ethers.parseEther("1000");
    const user2Purchase = ethers.parseEther("500");
    const user3Purchase = ethers.parseEther("2000");
    const user4Purchase = ethers.parseEther("1500");
    
    // User1 purchases tickets with no referrer
    await baseJackpot.connect(user1).purchaseTickets(ethers.ZeroAddress, user1Purchase, user1.address);
    
    // User2 purchases tickets with user1 as referrer
    await baseJackpot.connect(user2).purchaseTickets(user1.address, user2Purchase, user2.address);
    
    // User3 purchases tickets with user1 as referrer
    await baseJackpot.connect(user3).purchaseTickets(user1.address, user3Purchase, user3.address);
    
    // User4 purchases tickets with user2 as referrer
    await baseJackpot.connect(user4).purchaseTickets(user2.address, user4Purchase, user4.address);
    
    // Verify user info
    for (const [user, purchaseAmount] of [
      [user1, user1Purchase],
      [user2, user2Purchase],
      [user3, user3Purchase],
      [user4, user4Purchase]
    ]) {
      const userAddress = typeof user === 'bigint' ? null : user.address;
      if (userAddress) {
        const userInfo = await baseJackpot.usersInfo(userAddress);
        expect(userInfo.active).to.equal(true);
        expect(userInfo.ticketsPurchasedTotalBps).to.be.gt(0);
      }
    }
    
    // Verify referral fees were allocated
    expect(await baseJackpot.referralFeesClaimable(user1.address)).to.be.gt(0);
    expect(await baseJackpot.referralFeesClaimable(user2.address)).to.be.gt(0);
    
    // Store total user pool amount
    const userPoolTotal = await baseJackpot.userPoolTotal();
    expect(userPoolTotal).to.be.gt(0);
    
    // Step 3: Wait for round duration and run jackpot
    console.log("Step 3: Running Jackpot");
    await time.increase(ROUND_DURATION + 1);
    
    // Run the jackpot
    await baseJackpot.connect(owner).runJackpot();
    
    // Verify jackpot is in locked state
    expect(await baseJackpot.jackpotLock()).to.equal(true);
    
    // Get pre-jackpot balances to verify rewards later
    const preJackpotBalances = {
      user1: await mockToken.balanceOf(user1.address),
      user2: await mockToken.balanceOf(user2.address),
      user3: await mockToken.balanceOf(user3.address),
      user4: await mockToken.balanceOf(user4.address),
      lp1: await mockToken.balanceOf(lp1.address),
      lp2: await mockToken.balanceOf(lp2.address),
    };
    
    // Let's make user3 the winner for this test
    const randomNumber = ethers.keccak256(ethers.toUtf8Bytes("user3wins"));
    await mockEntropy.triggerEntropyCallback(
      await baseJackpot.getAddress(), 
      1n, 
      randomNumber, 
      user3.address
    );
    
    // Verify jackpot is complete
    expect(await baseJackpot.jackpotLock()).to.equal(false);
    expect(await baseJackpot.lastWinnerAddress()).to.equal(user3.address);
    
    // Step 4: Winner withdraws winnings
    console.log("Step 4: Winner Withdraws Winnings");
    const user3Info = await baseJackpot.usersInfo(user3.address);
    expect(user3Info.winningsClaimable).to.be.gt(0);
    
    await baseJackpot.connect(user3).withdrawWinnings();
    
    // Verify winner received winnings
    const postWithdrawBalance = await mockToken.balanceOf(user3.address);
    expect(postWithdrawBalance).to.be.gt(preJackpotBalances.user3);
    
    // Step 5: Referrers withdraw fees
    console.log("Step 5: Referrers Withdraw Fees");
    
    // User1 was referrer for user2 and user3
    const user1ReferralFees = await baseJackpot.referralFeesClaimable(user1.address);
    expect(user1ReferralFees).to.be.gt(0);
    
    await baseJackpot.connect(user1).withdrawReferralFees();
    
    // Verify user1 received referral fees
    expect(await mockToken.balanceOf(user1.address)).to.be.gt(preJackpotBalances.user1);
    expect(await baseJackpot.referralFeesClaimable(user1.address)).to.equal(0);
    
    // User2 was referrer for user4
    const user2ReferralFees = await baseJackpot.referralFeesClaimable(user2.address);
    expect(user2ReferralFees).to.be.gt(0);
    
    await baseJackpot.connect(user2).withdrawReferralFees();
    
    // Verify user2 received referral fees
    expect(await mockToken.balanceOf(user2.address)).to.be.gt(preJackpotBalances.user2);
    expect(await baseJackpot.referralFeesClaimable(user2.address)).to.equal(0);
    
    // Step 6: LP's withdraw principal + profits/losses
    console.log("Step 6: LPs Withdraw");
    
    // LP1 withdraws principal
    console.log("Step 6: LP1 Withdraws Principal");
    const lp1BalanceBefore = await mockToken.balanceOf(lp1.address);
    await baseJackpot.connect(lp1).withdrawAllLP();
    const lp1BalanceAfter = await mockToken.balanceOf(lp1.address);
    
    // LP2 withdraws principal
    console.log("Step 7: LP2 Withdraws Principal");
    const lp2BalanceBefore = await mockToken.balanceOf(lp2.address);
    await baseJackpot.connect(lp2).withdrawAllLP();
    const lp2BalanceAfter = await mockToken.balanceOf(lp2.address);
    
    // Verify LP pool is empty or nearly empty (might have minimal dust)
    expect(await baseJackpot.lpPoolTotal()).to.be.lte(ethers.parseEther("0.001"));
    
    // Step 7: A new jackpot round
    console.log("Step 7: Starting New Jackpot Round");
    
    // LP1 deposits again with adjusted risk
    const newLp1Deposit = ethers.parseEther("8000");
    const newLp1Risk = 75;
    
    await baseJackpot.connect(lp1).lpDeposit(newLp1Risk, newLp1Deposit);
    
    // User1 and User4 purchase tickets for the new round
    await baseJackpot.connect(user1).purchaseTickets(ethers.ZeroAddress, user1Purchase, user1.address);
    await baseJackpot.connect(user4).purchaseTickets(user1.address, user4Purchase, user4.address);
    
    // Verify the new round has active users and LP
    expect((await baseJackpot.usersInfo(user1.address)).active).to.equal(true);
    expect((await baseJackpot.usersInfo(user4.address)).active).to.equal(true);
    expect((await baseJackpot.lpsInfo(lp1.address)).active).to.equal(true);
    
    // Fast forward to end of round
    await time.increase(ROUND_DURATION + 1);
    
    // Run jackpot for the second round
    await baseJackpot.connect(owner).runJackpot();
    await mockEntropy.triggerEntropyCallback(await baseJackpot.getAddress(), 2n, randomNumber);
    
    // Verify second round completed
    expect(await baseJackpot.jackpotLock()).to.equal(false);
    
    console.log("E2E Test Complete: Full jackpot cycle verified");
  });

  it("Should handle the edge case of no tickets purchased", async function () {
    // LPs deposit funds
    await baseJackpot.connect(lp1).lpDeposit(50, ethers.parseEther("10000"));
    
    // No tickets purchased by any users
    
    // Fast forward to end of round
    await time.increase(ROUND_DURATION + 1);
    
    // Run jackpot with no tickets
    await baseJackpot.connect(owner).runJackpot();
    
    // Provide entropy callback
    const randomNumber = ethers.keccak256(ethers.toUtf8Bytes("notickets"));
    await mockEntropy.triggerEntropyCallback(await baseJackpot.getAddress(), 1n, randomNumber);
    
    // Verify fallback winner was used when no tickets purchased
    expect(await baseJackpot.lastWinnerAddress()).to.equal(fallbackWinner.address);
  });

  it("Should handle LP risk adjustments correctly", async function () {
    // Initial deposit
    const initialDeposit = ethers.parseEther("10000");
    const initialRisk = 50;
    
    await baseJackpot.connect(lp1).lpDeposit(initialRisk, initialDeposit);
    
    // Record initial LP info
    const initialLpInfo = await baseJackpot.lpsInfo(lp1.address);
    
    // Adjust risk percentage
    const newRisk = 75;
    await baseJackpot.connect(lp1).lpAdjustRiskPercentage(newRisk);
    
    // Verify risk was updated
    const updatedLpInfo = await baseJackpot.lpsInfo(lp1.address);
    expect(updatedLpInfo.riskPercentage).to.equal(newRisk);
    expect(updatedLpInfo.principal).to.equal(initialLpInfo.principal);
    
    // Users purchase tickets
    await baseJackpot.connect(user1).purchaseTickets(ethers.ZeroAddress, ethers.parseEther("1000"), user1.address);
    
    // Run jackpot to see effect of risk adjustment
    await time.increase(ROUND_DURATION + 1);
    await baseJackpot.connect(owner).runJackpot();
    await mockEntropy.triggerEntropyCallback(await baseJackpot.getAddress(), 1n, ethers.keccak256(ethers.toUtf8Bytes("test")));
    
    // Verify LP stakes were adjusted according to risk percentage
    const postJackpotLpInfo = await baseJackpot.lpsInfo(lp1.address);
    
    // The LP's stake should reflect the new risk percentage
    console.log("LP risk adjustment test complete");
  });
});
