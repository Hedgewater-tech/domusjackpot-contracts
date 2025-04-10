import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { BaseJackpot, MockToken, MockEntropyProvider } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("BaseJackpot", function () {
  let baseJackpot: BaseJackpot;
  let mockToken: MockToken;
  let mockEntropy: MockEntropyProvider;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let lp1: SignerWithAddress;
  let lp2: SignerWithAddress;
  let fallbackWinner: SignerWithAddress;
  let protocolFeeAddress: SignerWithAddress;

  // Test parameters
  const INITIAL_TOKEN_SUPPLY = ethers.parseEther("1000000");
  const TICKET_PRICE_RAW = 10; // Raw ticket price (will be multiplied by 10^decimals in the contract)
  const ROUND_DURATION = 60 * 60 * 24; // 1 day in seconds
  const FEE_BPS = 1000; // 10% fee
  const REFERRAL_FEE_BPS = 500; // 5% referral fee
  const LP_RISK_PERCENTAGE = 50; // 50% risk percentage
  const LP_DEPOSIT_AMOUNT = ethers.parseEther("10000"); // 10,000 tokens
  const MIN_LP_DEPOSIT = ethers.parseEther("1000"); // 1,000 tokens
  const USER_TICKET_PURCHASE = ethers.parseEther("1000"); // 1,000 tokens

  async function deployBaseJackpot() {
    // Deploy MockToken
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MOCK", 18);
    await mockToken.waitForDeployment();

    // Deploy MockEntropyProvider
    const MockEntropyProvider = await ethers.getContractFactory("MockEntropyProvider");
    mockEntropy = await MockEntropyProvider.deploy();
    await mockEntropy.waitForDeployment();

    // Deploy BaseJackpot
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
    await baseJackpot.setLpLimit(5); // lpLimit
    await baseJackpot.setMinLpDeposit(MIN_LP_DEPOSIT);
    await baseJackpot.setUserLimit(1000); // userLimit
    await baseJackpot.setAllowPurchasing(true); // allowPurchasing

    // Distribute tokens to users and LPs
    await mockToken.transfer(user1.address, ethers.parseEther("50000"));
    await mockToken.transfer(user2.address, ethers.parseEther("50000"));
    await mockToken.transfer(lp1.address, ethers.parseEther("50000"));
    await mockToken.transfer(lp2.address, ethers.parseEther("50000"));

    // Approve tokens for the contract
    await mockToken.connect(user1).approve(await baseJackpot.getAddress(), ethers.MaxUint256);
    await mockToken.connect(user2).approve(await baseJackpot.getAddress(), ethers.MaxUint256);
    await mockToken.connect(lp1).approve(await baseJackpot.getAddress(), ethers.MaxUint256);
    await mockToken.connect(lp2).approve(await baseJackpot.getAddress(), ethers.MaxUint256);
  }

  beforeEach(async function () {
    [owner, user1, user2, lp1, lp2, fallbackWinner, protocolFeeAddress] = await ethers.getSigners();
    await deployBaseJackpot();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await baseJackpot.owner()).to.equal(owner.address);
    });

    it("Should set the correct initial parameters", async function () {
      expect(await baseJackpot.ticketPrice()).to.equal(ethers.parseUnits(TICKET_PRICE_RAW.toString(), 6));
      expect(await baseJackpot.roundDurationInSeconds()).to.equal(ROUND_DURATION);
      expect(await baseJackpot.feeBps()).to.equal(FEE_BPS);
      expect(await baseJackpot.referralFeeBps()).to.equal(REFERRAL_FEE_BPS);
      expect(await baseJackpot.fallbackWinner()).to.equal(fallbackWinner.address);
      expect(await baseJackpot.protocolFeeAddress()).to.equal(protocolFeeAddress.address);
      expect(await baseJackpot.minLpDeposit()).to.equal(MIN_LP_DEPOSIT);
      expect(await baseJackpot.allowPurchasing()).to.equal(true);
      expect(await baseJackpot.token()).to.equal(await mockToken.getAddress());
    });
  });

  describe("LP Operations", function () {
    it("Should allow LP to deposit with risk percentage", async function () {
      await baseJackpot.connect(lp1).lpDeposit(LP_RISK_PERCENTAGE, LP_DEPOSIT_AMOUNT);
      
      const lpInfo = await baseJackpot.lpsInfo(lp1.address);
      expect(lpInfo.principal).to.equal(LP_DEPOSIT_AMOUNT);
      expect(lpInfo.riskPercentage).to.equal(LP_RISK_PERCENTAGE);
      expect(lpInfo.active).to.equal(true);
      
      // Check the LP pool total increased
      expect(await baseJackpot.lpPoolTotal()).to.equal(LP_DEPOSIT_AMOUNT);
    });

    it("Should not allow LP deposit below minimum", async function () {
      await expect(
        baseJackpot.connect(lp1).lpDeposit(LP_RISK_PERCENTAGE, MIN_LP_DEPOSIT.sub(1))
      ).to.be.revertedWith("Deposit amount too small");
    });

    it("Should allow LP to withdraw principal", async function () {
      // First deposit
      await baseJackpot.connect(lp1).lpDeposit(LP_RISK_PERCENTAGE, LP_DEPOSIT_AMOUNT);
      
      // Then withdraw
      await baseJackpot.connect(lp1).lpWithdrawPrincipal(LP_DEPOSIT_AMOUNT);
      
      const lpInfo = await baseJackpot.lpsInfo(lp1.address);
      expect(lpInfo.principal).to.equal(0);
      expect(lpInfo.active).to.equal(false);
      
      // Check the LP pool total decreased
      expect(await baseJackpot.lpPoolTotal()).to.equal(0);
    });

    it("Should allow LP to adjust risk percentage", async function () {
      await baseJackpot.connect(lp1).lpDeposit(LP_RISK_PERCENTAGE, LP_DEPOSIT_AMOUNT);
      
      const newRiskPercentage = 75;
      await baseJackpot.connect(lp1).lpAdjustRiskPercentage(newRiskPercentage);
      
      const lpInfo = await baseJackpot.lpsInfo(lp1.address);
      expect(lpInfo.riskPercentage).to.equal(newRiskPercentage);
    });
  });

  describe("User Ticket Purchase", function () {
    beforeEach(async function () {
      // Setup an LP for the jackpot
      await baseJackpot.connect(lp1).lpDeposit(LP_RISK_PERCENTAGE, LP_DEPOSIT_AMOUNT);
    });

    it("Should allow users to purchase tickets", async function () {
      await baseJackpot.connect(user1).purchaseTickets(ethers.ZeroAddress, USER_TICKET_PURCHASE, user1.address);
      
      const userInfo = await baseJackpot.usersInfo(user1.address);
      expect(userInfo.active).to.equal(true);
      expect(userInfo.ticketsPurchasedTotalBps).to.be.gt(0);
      
      // Check user pool increased
      expect(await baseJackpot.userPoolTotal()).to.be.gt(0);
    });

    it("Should handle referrals correctly", async function () {
      await baseJackpot.connect(user1).purchaseTickets(user2.address, USER_TICKET_PURCHASE, user1.address);
      
      // Check referral fee allocated
      expect(await baseJackpot.referralFeesClaimable(user2.address)).to.be.gt(0);
    });

    it("Should not allow purchases when disabled", async function () {
      // Disable purchasing
      await baseJackpot.connect(owner).setAllowPurchasing(false);
      
      await expect(
        baseJackpot.connect(user1).purchaseTickets(ethers.ZeroAddress, USER_TICKET_PURCHASE, user1.address)
      ).to.be.revertedWith("Purchasing tickets not allowed");
    });
  });

  describe("Jackpot Execution", function () {
    beforeEach(async function () {
      // Setup LP and user purchases
      await baseJackpot.connect(lp1).lpDeposit(LP_RISK_PERCENTAGE, LP_DEPOSIT_AMOUNT);
      await baseJackpot.connect(user1).purchaseTickets(ethers.ZeroAddress, USER_TICKET_PURCHASE, user1.address);
      await baseJackpot.connect(user2).purchaseTickets(ethers.ZeroAddress, USER_TICKET_PURCHASE, user2.address);
      
      // Advance time past round duration
      await time.increase(ROUND_DURATION + 1);
    });

    it("Should allow jackpot to be run", async function () {
      // Request the jackpot
      await baseJackpot.connect(owner).runJackpot();
      
      // The jackpot is now in locked state waiting for entropy
      expect(await baseJackpot.jackpotLock()).to.equal(true);
      
      // Mock the entropy callback
      const randomNumber = ethers.keccak256(ethers.toUtf8Bytes("random"));
      await mockEntropy.triggerEntropyCallback(await baseJackpot.getAddress(), 1, randomNumber);
      
      // Jackpot should be complete
      expect(await baseJackpot.entropyCallbackLock()).to.equal(false);
      expect(await baseJackpot.jackpotLock()).to.equal(false);
      
      // Verify a winner was selected (or fallback if no tickets)
      expect(await baseJackpot.lastWinnerAddress()).to.not.equal(ethers.ZeroAddress);
      
      // Check the jackpot end time was updated
      expect(await baseJackpot.lastJackpotEndTime()).to.be.gt(0);
    });

    it("Should reset user tickets after jackpot", async function () {
      // Run the jackpot
      await baseJackpot.connect(owner).runJackpot();
      
      // Mock the entropy callback
      const randomNumber = ethers.keccak256(ethers.toUtf8Bytes("random"));
      await mockEntropy.triggerEntropyCallback(await baseJackpot.getAddress(), 1, randomNumber);
      
      // Check user tickets were reset
      const userInfo1 = await baseJackpot.usersInfo(user1.address);
      const userInfo2 = await baseJackpot.usersInfo(user2.address);
      
      expect(userInfo1.ticketsPurchasedTotalBps).to.equal(0);
      expect(userInfo2.ticketsPurchasedTotalBps).to.equal(0);
      expect(userInfo1.active).to.equal(false);
      expect(userInfo2.active).to.equal(false);
    });

    it("Should not allow running jackpot twice", async function () {
      // Run the jackpot first time
      await baseJackpot.connect(owner).runJackpot();
      
      // Try to run again before callback
      await expect(
        baseJackpot.connect(owner).runJackpot()
      ).to.be.revertedWith("Jackpot is locked");
    });
  });

  describe("Winner Withdrawals", function () {
    beforeEach(async function () {
      // Setup LP and user purchases
      await baseJackpot.connect(lp1).lpDeposit(LP_RISK_PERCENTAGE, LP_DEPOSIT_AMOUNT);
      await baseJackpot.connect(user1).purchaseTickets(ethers.ZeroAddress, USER_TICKET_PURCHASE, user1.address);
      
      // Advance time and run jackpot
      await time.increase(ROUND_DURATION + 1);
      await baseJackpot.connect(owner).runJackpot();
      
      // Force user1 to be the winner (via the mock)
      const randomNumber = ethers.keccak256(ethers.toUtf8Bytes("user1wins"));
      await mockEntropy.triggerEntropyCallback(await baseJackpot.getAddress(), 1, randomNumber, user1.address);
    });

    it("Should allow winners to withdraw winnings", async function () {
      // Check winner has claimable winnings
      const userInfo = await baseJackpot.usersInfo(user1.address);
      expect(userInfo.winningsClaimable).to.be.gt(0);
      
      // Get balance before withdrawal
      const balanceBefore = await mockToken.balanceOf(user1.address);
      
      // Withdraw winnings
      await baseJackpot.connect(user1).withdrawWinnings();
      
      // Check balance increased
      const balanceAfter = await mockToken.balanceOf(user1.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
      
      // Check winnings reset
      const userInfoAfter = await baseJackpot.usersInfo(user1.address);
      expect(userInfoAfter.winningsClaimable).to.equal(0);
    });

    it("Should not allow withdrawals if no winnings", async function () {
      // user2 has no winnings
      await expect(
        baseJackpot.connect(user2).withdrawWinnings()
      ).to.be.revertedWith("No winnings to withdraw");
    });
  });

  describe("Referral Fee Withdrawals", function () {
    beforeEach(async function () {
      // Setup LP
      await baseJackpot.connect(lp1).lpDeposit(LP_RISK_PERCENTAGE, LP_DEPOSIT_AMOUNT);
      
      // user1 buys tickets with user2 as referrer
      await baseJackpot.connect(user1).purchaseTickets(user2.address, USER_TICKET_PURCHASE, user1.address);
    });

    it("Should allow referrers to withdraw fees", async function () {
      // Check referral fees
      const referralFees = await baseJackpot.referralFeesClaimable(user2.address);
      expect(referralFees).to.be.gt(0);
      
      // Get balance before withdrawal
      const balanceBefore = await mockToken.balanceOf(user2.address);
      
      // Withdraw referral fees
      await baseJackpot.connect(user2).withdrawReferralFees();
      
      // Check balance increased
      const balanceAfter = await mockToken.balanceOf(user2.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
      
      // Check referral fees reset
      expect(await baseJackpot.referralFeesClaimable(user2.address)).to.equal(0);
    });
  });

  describe("Owner Controls", function () {
    it("Should allow owner to set ticket price", async function () {
      const newPrice = 20;
      await baseJackpot.connect(owner).setTicketPrice(newPrice);
      expect(await baseJackpot.ticketPrice()).to.equal(ethers.parseUnits(newPrice.toString(), 6));
    });

    it("Should allow owner to set round duration", async function () {
      const newDuration = 60 * 60 * 48; // 2 days
      await baseJackpot.connect(owner).setRoundDurationInSeconds(newDuration);
      expect(await baseJackpot.roundDurationInSeconds()).to.equal(newDuration);
    });

    it("Should allow owner to set fee parameters", async function () {
      const newFeeBps = 1500; // 15%
      const newReferralFeeBps = 750; // 7.5%
      
      await baseJackpot.connect(owner).setFeeBps(newFeeBps);
      await baseJackpot.connect(owner).setReferralFeeBps(newReferralFeeBps);
      
      expect(await baseJackpot.feeBps()).to.equal(newFeeBps);
      expect(await baseJackpot.referralFeeBps()).to.equal(newReferralFeeBps);
    });

    it("Should enforce referral fee <= total fee", async function () {
      const feeBps = 1000; // 10%
      
      // Try to set referral fee higher than total fee
      await expect(
        baseJackpot.connect(owner).setReferralFeeBps(feeBps + 100)
      ).to.be.revertedWith("Referral bps should not exceed fee bps");
    });
  });
});
