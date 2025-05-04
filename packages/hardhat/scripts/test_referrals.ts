// packages/hardhat/scripts/test_referrals.ts
// Script to test referral functionality in the DomusJackpot contract
import { ethers } from "ethers";
import DomusJackpotABI from "../artifacts/contracts/DomusJackpot.sol/DomusJackpot.json";
import { CONTRACT_ADDRESS, PRIVATE_KEY, RPC_URL, USDC_ADDRESS, TEST_USERS, TEST_USER_PRIVATE_KEYS } from "./constants";

async function main() {
  if (!PRIVATE_KEY) {
    throw new Error("Private key not found in .env file");
  }

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not specified. Set DOMUS_JACKPOT_ADDRESS in .env file");
  }

  if (!USDC_ADDRESS) {
    throw new Error("USDC address not specified. Set USDC_ADDRESS in .env file");
  }

  // Set up provider and signer
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log(`Using wallet address: ${signer.address}`);

  // Connect to contract
  const jackpot = new ethers.Contract(CONTRACT_ADDRESS, DomusJackpotABI.abi, signer);
  console.log(`Connected to DomusJackpot contract at: ${CONTRACT_ADDRESS}`);

  // Get function and args from CLI
  const functionName = process.argv[2];
  const args = process.argv.slice(3);

  // Create token contract instance
  const tokenContract = new ethers.Contract(
    USDC_ADDRESS,
    [
      "function approve(address spender, uint256 amount) public returns (bool)",
      "function balanceOf(address account) public view returns (uint256)",
      "function allowance(address owner, address spender) public view returns (uint256)",
      "function decimals() public view returns (uint8)",
    ],
    signer,
  );

  // Get token decimals
  let tokenDecimals = 18; // Default to 6 for USDC
  try {
    tokenDecimals = await tokenContract.decimals();
    console.log(`Token decimals: ${tokenDecimals}`);
  } catch (error) {
    console.log("Could not get token decimals, using default value of 6", error);
  }

  switch (functionName) {
    case "buyTicketsWithReferral":
      if (args.length < 3) {
        console.log("Usage: buyTicketsWithReferral <userIndex> <amount> <referrerAddress>");
        console.log("Example: buyTicketsWithReferral 0 100 0x4cacfA4B61105852580BA184b6466FD9952654ce");
        console.log("Available users:");
        for (let i = 0; i < TEST_USERS.length; i++) {
          console.log(`${i}: ${TEST_USERS[i]}`);
        }
        break;
      }

      const [userIndexStr, amount, referrerAddress] = args;
      const userIndex = parseInt(userIndexStr);

      if (isNaN(userIndex) || userIndex < 0 || userIndex >= TEST_USERS.length) {
        console.log(`Invalid user index. Please use a number between 0 and ${TEST_USERS.length - 1}`);
        break;
      }

      const userAddress = TEST_USERS[userIndex];
      const userPrivateKey = TEST_USER_PRIVATE_KEYS[userIndex];
      console.log(`Using user ${userIndex}: ${userAddress}`);

      // Create user wallet and contracts
      const userWallet = new ethers.Wallet(userPrivateKey, provider);
      const userJackpot = new ethers.Contract(CONTRACT_ADDRESS, DomusJackpotABI.abi, userWallet);
      const userTokenContract = new ethers.Contract(
        USDC_ADDRESS,
        [
          "function approve(address spender, uint256 amount) external returns (bool)",
          "function allowance(address owner, address spender) external view returns (uint256)",
          "function balanceOf(address account) external view returns (uint256)",
          "function decimals() external view returns (uint8)",
        ],
        userWallet,
      );

      // Check if referrer is valid
      if (referrerAddress === userAddress) {
        console.log("Error: User cannot refer themselves");
        break;
      }

      // Check if purchasing is allowed
      const isPurchasingAllowed = await userJackpot.allowPurchasing();
      if (!isPurchasingAllowed) {
        console.log("Ticket purchasing is currently not allowed");
        break;
      }

      // Check if jackpot is running
      const isJackpotRunning = await userJackpot.jackpotLock();
      if (isJackpotRunning) {
        console.log("Cannot buy tickets while jackpot is running");
        break;
      }

      // Get token decimals
      tokenDecimals = 18; // Default
      try {
        tokenDecimals = await userTokenContract.decimals();
        console.log(`Token decimals: ${tokenDecimals}`);
      } catch (error) {
        console.log("Could not get token decimals, using default value of 18", error);
      }

      // Get user's token balance
      const userBalance = await userTokenContract.balanceOf(userAddress);
      console.log(`User token balance: ${ethers.formatUnits(userBalance, tokenDecimals)}`);

      const purchaseAmount = ethers.parseUnits(amount, tokenDecimals);

      if (userBalance < purchaseAmount) {
        console.log(`Insufficient token balance. User needs at least ${amount} tokens`);
        break;
      }

      // Check current allowance
      const currentAllowance = await userTokenContract.allowance(userAddress, CONTRACT_ADDRESS);
      console.log(`Current allowance for jackpot contract: ${ethers.formatUnits(currentAllowance, tokenDecimals)}`);

      // Approve jackpot contract to spend tokens if needed
      if (currentAllowance < purchaseAmount) {
        console.log(`Approving ${amount} tokens for jackpot contract...`);
        const approveTx = await userTokenContract.approve(CONTRACT_ADDRESS, purchaseAmount);
        await approveTx.wait();
        console.log(`Approval transaction successful: ${approveTx.hash}`);
      } else {
        console.log("Sufficient allowance already exists, skipping approval step");
      }

      // Buy tickets with referral
      console.log(`Buying tickets with ${amount} tokens using referrer ${referrerAddress}...`);
      try {
        const buyTx = await userJackpot.purchaseTickets(referrerAddress, purchaseAmount, userAddress);
        const receipt = await buyTx.wait();
        console.log(`Successfully purchased tickets with referral: ${buyTx.hash}`);

        // Try to find the UserTicketPurchase event
        const userTicketPurchaseEvent = userJackpot.interface.getEvent("UserTicketPurchase");
        if (userTicketPurchaseEvent) {
          const topicHash = userTicketPurchaseEvent.topicHash;
          const events = receipt.logs.filter((log: any) => log.topics[0] === topicHash);

          if (events.length > 0) {
            const event = userJackpot.interface.parseLog(events[0]);
            if (event && event.args) {
              console.log(`Ticket purchase event:`);
              console.log(`- Recipient: ${event.args.recipient}`);
              console.log(`- Tickets Purchased: ${event.args.ticketsPurchasedTotalBps}`);
              console.log(`- Referrer: ${event.args.referrer}`);
              console.log(`- Buyer: ${event.args.buyer}`);
            }
          }
        }
      } catch (error: any) {
        console.error("Failed to purchase tickets:", error.message || String(error));
      }
      break;

    case "getReferralFeesInfo":
      if (args.length < 1) {
        console.log("Usage: getReferralFeesInfo <address>");
        break;
      }

      const referrerAddr = args[0];

      try {
        // Get referral fees claimable
        const referralFees = await jackpot.referralFeesClaimable(referrerAddr);
        console.log(`Referral fees claimable for ${referrerAddr}: ${ethers.formatUnits(referralFees, tokenDecimals)}`);

        // Get total referral fees
        const totalReferralFees = await jackpot.referralFeesTotal();
        console.log(`Total referral fees allocated: ${ethers.formatUnits(totalReferralFees, tokenDecimals)}`);

        // Get referral fee basis points
        const referralFeeBps = await jackpot.referralFeeBps();
        console.log(`Referral fee percentage: ${referralFeeBps / 100}%`);

        // Get total fee basis points
        const feeBps = await jackpot.feeBps();
        console.log(`Total fee percentage: ${feeBps / 100}%`);
      } catch (error: any) {
        console.error("Failed to get referral fees info:", error.message || String(error));
      }
      break;

    case "withdrawReferralFees":
      try {
        // Check if there are any referral fees to withdraw
        const referralFeesClaimable = await jackpot.referralFeesClaimable(signer.address);
        console.log(`Referral fees claimable: ${ethers.formatUnits(referralFeesClaimable, tokenDecimals)}`);

        if (referralFeesClaimable <= 0) {
          console.log("No referral fees to withdraw");
          break;
        }

        // Withdraw referral fees
        console.log("Withdrawing referral fees...");
        const tx = await jackpot.withdrawReferralFees();
        const receipt = await tx.wait();
        console.log(`Successfully withdrew referral fees: ${tx.hash}`);

        // Try to find the UserReferralFeeWithdrawal event
        const withdrawalEvent = jackpot.interface.getEvent("UserReferralFeeWithdrawal");
        if (withdrawalEvent) {
          const topicHash = withdrawalEvent.topicHash;
          const events = receipt.logs.filter((log: any) => log.topics[0] === topicHash);

          if (events.length > 0) {
            const event = jackpot.interface.parseLog(events[0]);
            if (event && event.args) {
              console.log(`Withdrawal event:`);
              console.log(`- User: ${event.args.user}`);
              console.log(`- Amount: ${ethers.formatUnits(event.args.amount, tokenDecimals)}`);
            }
          }
        }

        // Check balance after withdrawal
        const balanceAfter = await tokenContract.balanceOf(signer.address);
        console.log(`Token balance after withdrawal: ${ethers.formatUnits(balanceAfter, tokenDecimals)}`);
      } catch (error: any) {
        console.error("Failed to withdraw referral fees:", error.message || String(error));
      }
      break;

    case "testReferralFlow":
      if (args.length < 1) {
        console.log("Usage: testReferralFlow <ticketAmount>");
        break;
      }

      const ticketAmount = args[0];
      console.log(`Testing complete referral flow with ${ticketAmount} tokens per user...`);

      // Check if purchasing is allowed
      const purchasingAllowed = await jackpot.allowPurchasing();
      if (!purchasingAllowed) {
        console.log("Ticket purchasing is currently not allowed");
        break;
      }

      // Check if jackpot is running
      const jackpotRunning = await jackpot.jackpotLock();
      if (jackpotRunning) {
        console.log("Cannot buy tickets while jackpot is running");
        break;
      }

      try {
        // Step 1: Buy tickets for each test user with the next user as referrer
        console.log("\n=== Step 1: Purchase Tickets with Referrals ===");

        for (let i = 0; i < TEST_USERS.length; i++) {
          const userAddress = TEST_USERS[i];
          const userPrivateKey = TEST_USER_PRIVATE_KEYS[i];

          // Choose the next user as referrer (circular)
          const referrerIndex = (i + 1) % TEST_USERS.length;
          const referrerAddress = TEST_USERS[referrerIndex];

          console.log(`\nUser ${i + 1} (${userAddress}) buying tickets with referrer ${referrerAddress}...`);

          // Create user wallet and contracts
          const userWallet = new ethers.Wallet(userPrivateKey, provider);
          const userJackpot = new ethers.Contract(CONTRACT_ADDRESS, DomusJackpotABI.abi, userWallet);
          const userTokenContract = new ethers.Contract(
            USDC_ADDRESS,
            [
              "function approve(address spender, uint256 amount) external returns (bool)",
              "function allowance(address owner, address spender) external view returns (uint256)",
              "function balanceOf(address account) external view returns (uint256)",
            ],
            userWallet,
          );

          // Get user's token balance
          const userTokenBalance = await userTokenContract.balanceOf(userAddress);
          console.log(`Token balance: ${ethers.formatUnits(userTokenBalance, tokenDecimals)}`);

          if (userTokenBalance < ethers.parseUnits(ticketAmount, tokenDecimals)) {
            console.log(`Insufficient token balance. Skipping user.`);
            continue;
          }

          // Check current allowance
          const userAllowance = await userTokenContract.allowance(userAddress, CONTRACT_ADDRESS);
          console.log(`Current allowance: ${ethers.formatUnits(userAllowance, tokenDecimals)}`);

          // Approve jackpot contract to spend tokens if needed
          if (userAllowance < ethers.parseUnits(ticketAmount, tokenDecimals)) {
            console.log(`Approving ${ticketAmount} tokens for jackpot contract...`);
            const approveTx = await userTokenContract.approve(
              CONTRACT_ADDRESS,
              ethers.parseUnits(ticketAmount, tokenDecimals),
            );
            await approveTx.wait();
            console.log(`Approval successful`);
          } else {
            console.log("Sufficient allowance already exists");
          }

          // Buy tickets
          console.log(`Buying tickets with ${ticketAmount} tokens...`);
          const buyTx = await userJackpot.purchaseTickets(
            referrerAddress,
            ethers.parseUnits(ticketAmount, tokenDecimals),
            userAddress,
          );
          await buyTx.wait();
          console.log(`Successfully purchased tickets`);
        }

        // Step 2: Check referral fees for each user
        console.log("\n=== Step 2: Check Referral Fees ===");

        for (let i = 0; i < TEST_USERS.length; i++) {
          const userAddress = TEST_USERS[i];
          const referralFees = await jackpot.referralFeesClaimable(userAddress);
          console.log(
            `User ${i + 1} (${userAddress}) referral fees: ${ethers.formatUnits(referralFees, tokenDecimals)}`,
          );
        }

        // Step 3: Withdraw referral fees for each user
        console.log("\n=== Step 3: Withdraw Referral Fees ===");

        for (let i = 0; i < TEST_USERS.length; i++) {
          const userAddress = TEST_USERS[i];
          const userPrivateKey = TEST_USER_PRIVATE_KEYS[i];
          const referralFees = await jackpot.referralFeesClaimable(userAddress);

          if (referralFees <= 0) {
            console.log(`User ${i + 1} (${userAddress}) has no referral fees to withdraw`);
            continue;
          }

          console.log(
            `User ${i + 1} (${userAddress}) withdrawing ${ethers.formatUnits(referralFees, tokenDecimals)} tokens...`,
          );

          // Create user wallet and contract
          const userWallet = new ethers.Wallet(userPrivateKey, provider);
          const userJackpot = new ethers.Contract(CONTRACT_ADDRESS, DomusJackpotABI.abi, userWallet);

          // Withdraw referral fees
          const withdrawTx = await userJackpot.withdrawReferralFees();
          await withdrawTx.wait();
          console.log(`Successfully withdrew referral fees`);

          // Verify referral fees are now zero
          const feesAfter = await jackpot.referralFeesClaimable(userAddress);
          console.log(`Referral fees after withdrawal: ${ethers.formatUnits(feesAfter, tokenDecimals)}`);
        }

        console.log("\nReferral flow test completed successfully!");
      } catch (error: any) {
        console.error("Referral flow test failed:", error.message || String(error));
      }
      break;

    case "getReferralStats":
      try {
        // Get referral fee settings
        const [referralFeeBps, feeBps, totalReferralFees] = await Promise.all([
          jackpot.referralFeeBps(),
          jackpot.feeBps(),
          jackpot.referralFeesTotal(),
        ]);

        console.log("=== Referral System Statistics ===");
        console.log(`Referral Fee: ${referralFeeBps / 100}% (${referralFeeBps} basis points)`);
        console.log(`Total Fee: ${feeBps / 100}% (${feeBps} basis points)`);
        console.log(`Total Referral Fees Allocated: ${ethers.formatUnits(totalReferralFees, tokenDecimals)}`);

        // Check referral fees for all test users
        console.log("\n=== Test Users Referral Fees ===");

        for (let i = 0; i < TEST_USERS.length; i++) {
          const userAddress = TEST_USERS[i];
          const referralFees = await jackpot.referralFeesClaimable(userAddress);
          console.log(`User ${i + 1} (${userAddress}): ${ethers.formatUnits(referralFees, tokenDecimals)}`);
        }
      } catch (error: any) {
        console.error("Failed to get referral statistics:", error.message || String(error));
      }
      break;

    default:
      console.log("Unknown command. Available commands:");
      console.log("buyTicketsWithReferral <userIndex> <amount> <referrerAddress> - Purchase tickets with a referrer");
      console.log("getReferralFeesInfo <address> - Get referral fees information for an address");
      console.log("withdrawReferralFees - Withdraw your referral fees");
      console.log("testReferralFlow <ticketAmount> - Test the complete referral flow with multiple users");
      console.log("getReferralStats - Get statistics about the referral system");
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * # 
 * To buy tickets with a referrer
npx ts-node scripts/test_referrals.ts buyTicketsWithReferral 0 100 0x4cacfA4B61105852580BA184b6466FD9952654ce

# To check referral fees for an address
npx ts-node scripts/test_referrals.ts getReferralFeesInfo 0x4cacfA4B61105852580BA184b6466FD9952654ce

# To withdraw your referral fees
npx ts-node scripts/test_referrals.ts withdrawReferralFees

# To test the complete referral flow with multiple users
npx ts-node scripts/test_referrals.ts testReferralFlow 100

# To get statistics about the referral system
npx ts-node scripts/test_referrals.ts getReferralStats
 */
