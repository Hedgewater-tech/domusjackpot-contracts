// packages/hardhat/scripts/interact_jackpot.ts
// Script to interact with the DomusJackpot contract
import { ethers } from "ethers";
import DomusJackpotABI from "../artifacts/contracts/DomusJackpot.sol/DomusJackpot.json";
import { CONTRACT_ADDRESS, PRIVATE_KEY, RPC_URL, TEST_USER_PRIVATE_KEYS, TEST_USERS, USDC_ADDRESS } from "./constants";

async function main() {
  if (!PRIVATE_KEY) {
    throw new Error("Private key not found");
  }
  // Set up provider and signer
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  // Connect to contract with TypeScript interface
  const jackpot = new ethers.Contract(CONTRACT_ADDRESS, DomusJackpotABI.abi, signer);

  // Get function and args from CLI
  const functionName = process.argv[2];
  const args = process.argv.slice(3);

  // Create token contract instance
  const tokenContractInstance = new ethers.Contract(
    USDC_ADDRESS,
    [
      "function approve(address spender, uint256 amount) public returns (bool)",
      "function balanceOf(address account) public view returns (uint256)",
      "function allowance(address owner, address spender) public view returns (uint256)",
    ],
    signer,
  );

  switch (functionName) {
    case "buyTicket":
      const [value, referrer] = args;
      await jackpot.purchaseTickets(referrer, value, signer.address);
      console.log(`Purchased ticket with ${value} tokens`);
      break;

    case "depositLP":
      const [riskPercentage, amount] = args;

      // Check if jackpot is running
      const isJackpotRunning = await jackpot.jackpotLock();
      if (isJackpotRunning) {
        console.log("Cannot deposit LP while jackpot is running. Please try again later.");
        break;
      }

      // Use the specific USDC token address
      const usdcTokenAddress = "0x20679F4196f17a56711AD8b04776393e8F2499Ad";
      console.log(`Using USDC token address: ${usdcTokenAddress}`);

      // Create token contract instance
      const tokenContract = new ethers.Contract(
        usdcTokenAddress,
        [
          "function approve(address spender, uint256 amount) public returns (bool)",
          "function balanceOf(address account) public view returns (uint256)",
          "function allowance(address owner, address spender) public view returns (uint256)",
        ],
        signer,
      );

      // Get user's USDC balance
      const userBalance = await tokenContract.balanceOf(await signer.getAddress());
      console.log(`Your USDC balance: ${ethers.formatUnits(userBalance, 6)} USDC`);

      const depositAmount = ethers.parseUnits(amount, 6);

      if (userBalance < depositAmount) {
        console.log(`Insufficient USDC balance. You need at least ${amount} USDC.`);
        break;
      }

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(await signer.getAddress(), CONTRACT_ADDRESS);
      console.log(`Current allowance for jackpot contract: ${ethers.formatUnits(currentAllowance, 6)} USDC`);

      // Approve jackpot contract to spend tokens if needed
      if (currentAllowance < depositAmount) {
        console.log(`Approving ${amount} USDC tokens for jackpot contract at ${CONTRACT_ADDRESS}...`);
        const approveTx = await tokenContract.approve(CONTRACT_ADDRESS, depositAmount);
        await approveTx.wait();
        console.log(`Approval transaction successful: ${approveTx.hash}`);
      } else {
        console.log("Sufficient allowance already exists, skipping approval step.");
      }

      // Deposit LP
      console.log(`Depositing ${amount} USDC as LP with ${riskPercentage}% risk...`);
      try {
        const depositTx = await jackpot.lpDeposit(Number(riskPercentage), depositAmount);
        await depositTx.wait();
        console.log(`Successfully deposited ${amount} USDC as LP with ${riskPercentage}% risk`);
      } catch (error: any) {
        console.error("LP deposit failed:", error.message || String(error));

        // Provide helpful error messages based on common failure reasons
        if (error.message) {
          if (error.message.includes("LP deposit less than minimum")) {
            const minLpDeposit = await jackpot.minLpDeposit();
            console.log(`Minimum LP deposit required: ${ethers.formatUnits(minLpDeposit, 6)} USDC`);
          } else if (error.message.includes("Deposit exceeds LP pool cap")) {
            const [lpPoolTotal, lpPoolCap] = await Promise.all([jackpot.lpPoolTotal(), jackpot.lpPoolCap()]);
            const availableSpace = BigInt(lpPoolCap) - BigInt(lpPoolTotal);
            console.log(
              `LP pool cap reached. Available space: ${ethers.formatUnits(availableSpace.toString(), 6)} USDC`,
            );
          } else if (error.message.includes("Invalid risk percentage")) {
            console.log("Risk percentage must be between 1 and 100.");
          } else if (error.message.includes("Jackpot is currently running")) {
            console.log("Cannot deposit while jackpot is running. Please try again later.");
          }
        }
      }
      break;

    case "depositLPWithApproval":
      if (args.length < 2) {
        console.log("Usage: depositLPWithApproval <riskPercentage> <amount>");
        break;
      }

      const [lpRiskPercentage, lpAmount] = args;

      // Check if jackpot is running
      const isJackpotRunningForLP = await jackpot.jackpotLock();
      if (isJackpotRunningForLP) {
        console.log("Cannot deposit LP while jackpot is running. Please try again later.");
        break;
      }

      // Use the specific USDC token address
      const usdcTokenAddressForLP = "0x20679F4196f17a56711AD8b04776393e8F2499Ad";
      console.log(`Using USDC token address: ${usdcTokenAddressForLP}`);

      // Create token contract instance
      const tokenContractForLP = new ethers.Contract(
        usdcTokenAddressForLP,
        [
          "function approve(address spender, uint256 amount) public returns (bool)",
          "function balanceOf(address account) public view returns (uint256)",
          "function allowance(address owner, address spender) public view returns (uint256)",
        ],
        signer,
      );

      // Get user's USDC balance
      const userBalanceForLP = await tokenContractForLP.balanceOf(await signer.getAddress());
      console.log(`Your USDC balance: ${ethers.formatUnits(userBalanceForLP, 6)} USDC`);

      if (userBalanceForLP < ethers.parseUnits(lpAmount, 6)) {
        console.log(`Insufficient USDC balance. You need at least ${lpAmount} USDC.`);
        break;
      }

      // Check current allowance
      const currentAllowanceForLP = await tokenContractForLP.allowance(await signer.getAddress(), CONTRACT_ADDRESS);
      console.log(`Current allowance for jackpot contract: ${ethers.formatUnits(currentAllowanceForLP, 6)} USDC`);

      const depositAmountForLP = ethers.parseUnits(lpAmount, 6);

      // Approve jackpot contract to spend tokens if needed
      if (currentAllowanceForLP < depositAmountForLP) {
        console.log(`Approving ${lpAmount} USDC tokens for jackpot contract at ${CONTRACT_ADDRESS}...`);
        const approveTxForLP = await tokenContractForLP.approve(CONTRACT_ADDRESS, depositAmountForLP);
        await approveTxForLP.wait();
        console.log(`Approval transaction successful: ${approveTxForLP.hash}`);
      } else {
        console.log("Sufficient allowance already exists, skipping approval step.");
      }

      // Deposit LP
      console.log(`Depositing ${lpAmount} USDC as LP with ${lpRiskPercentage}% risk...`);
      try {
        const depositTxForLP = await jackpot.lpDeposit(Number(lpRiskPercentage), depositAmountForLP);
        await depositTxForLP.wait();
        console.log(`Successfully deposited ${lpAmount} USDC as LP with ${lpRiskPercentage}% risk`);
      } catch (error: any) {
        console.error("LP deposit failed:", error.message || String(error));

        // Provide helpful error messages based on common failure reasons
        if (error.message) {
          if (error.message.includes("LP deposit less than minimum")) {
            const minLpDepositForLP = await jackpot.minLpDeposit();
            console.log(`Minimum LP deposit required: ${ethers.formatUnits(minLpDepositForLP, 6)} USDC`);
          } else if (error.message.includes("Deposit exceeds LP pool cap")) {
            const [lpPoolTotalForLP, lpPoolCapForLP] = await Promise.all([jackpot.lpPoolTotal(), jackpot.lpPoolCap()]);
            const availableSpaceForLP = BigInt(lpPoolCapForLP) - BigInt(lpPoolTotalForLP);
            console.log(
              `LP pool cap reached. Available space: ${ethers.formatUnits(availableSpaceForLP.toString(), 6)} USDC`,
            );
          } else if (error.message.includes("Invalid risk percentage")) {
            console.log("Risk percentage must be between 1 and 100.");
          } else if (error.message.includes("Jackpot is currently running")) {
            console.log("Cannot deposit while jackpot is running. Please try again later.");
          }
        }
      }
      break;

    case "getTicketPrice":
      const price = await jackpot.ticketPrice();
      console.log(`Ticket Price: ${ethers.formatUnits(price, 18)}`);
      break;

    case "runJackpot":
      console.log("Attempting to run jackpot...");
      try {
        // Check if jackpot can be run
        const [lastJackpotEndTime, roundDuration, currentTime] = await Promise.all([
          jackpot.lastJackpotEndTime(),
          jackpot.roundDurationInSeconds(),
          provider.getBlock("latest").then(block => block?.timestamp || 0),
        ]);

        const nextJackpotTime = Number(lastJackpotEndTime) + Number(roundDuration);
        console.log(`Last jackpot time: ${new Date(Number(lastJackpotEndTime) * 1000).toLocaleString()}`);
        console.log(`Next jackpot available: ${new Date(nextJackpotTime * 1000).toLocaleString()}`);

        if (currentTime < nextJackpotTime) {
          console.log(
            `Jackpot cannot be run yet. Please wait until ${new Date(nextJackpotTime * 1000).toLocaleString()}`,
          );
          console.log(`Time remaining: ${(nextJackpotTime - currentTime) / 60} minutes`);
          break;
        }

        console.log("wallet address: ", signer.address);
        console.log("wallet balance: ", await provider.getBalance(signer.address));

        // Generate a random number for entropy
        const randomBytes = ethers.randomBytes(32);
        const userRandomNumber = ethers.hexlify(randomBytes);
        console.log(`Using random number: ${userRandomNumber}`);

        // Send transaction with ETH value for entropy fee (0.01 ETH as a safe default)
        const entropyFee = ethers.parseEther("0.025");
        console.log(`Using entropy fee: ${ethers.formatEther(entropyFee)} ETH`);

        const tx = await jackpot.runJackpot(userRandomNumber, { value: entropyFee });
        console.log(`Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Jackpot executed successfully in block ${receipt.blockNumber}`);

        // Get the winner from events
        const jackpotRunEvent = jackpot.interface.getEvent("JackpotRun");
        if (jackpotRunEvent) {
          const topicHash = jackpotRunEvent.topicHash;
          const jackpotRunEvents = receipt.logs.filter((log: any) => log.topics[0] === topicHash);

          if (jackpotRunEvents.length > 0) {
            const event = jackpot.interface.parseLog(jackpotRunEvents[0]);
            if (event && event.args) {
              console.log(`Winner: ${event.args.winnerAddress}`);
              console.log(`Prize Amount: ${ethers.formatUnits(event.args.winAmount, 18)}`);
            }
          } else {
            console.log("No winner found in events");
          }
        } else {
          console.log("Could not find JackpotRun event in contract interface");
        }
      } catch (error: any) {
        console.error("Failed to run jackpot:", error.message || String(error));
      }
      break;

    case "getPoolTotals":
      const [userPool, lpPool] = await Promise.all([jackpot.userPoolTotal(), jackpot.lpPoolTotal()]);
      console.log(`User Pool: ${ethers.formatUnits(userPool, 18)}`);
      console.log(`LP Pool: ${ethers.formatUnits(lpPool, 18)}`);
      // fetch contract usdc balance
      // Create token contract instance
      const contractBalance = await tokenContractInstance.balanceOf(CONTRACT_ADDRESS);
      console.log(`Contract USDC balance: ${ethers.formatUnits(contractBalance, 18)} USDC`);

      // Calculate total LP deposits (principal + stake)
      try {
        console.log("\n=== LP Deposits Breakdown ===");
        let totalPrincipal = ethers.parseUnits("0", 18);
        let totalStake = ethers.parseUnits("0", 18);
        let activeLpCount = 0;

        // Loop through active LP addresses
        for (let i = 0; i < 100; i++) {
          // Limit to 100 to avoid infinite loops
          try {
            const lpAddress = await jackpot.activeLpAddresses(i);
            if (lpAddress === "0x0000000000000000000000000000000000000000") {
              break; // End of list
            }

            const lpInfo = await jackpot.lpsInfo(lpAddress);
            if (lpInfo.active) {
              activeLpCount++;
              totalPrincipal += BigInt(lpInfo.principal);
              totalStake += BigInt(lpInfo.stake);
            }
          } catch (error: any) {
            console.error("Error getting LP info:", error.message || String(error));
            // Reached the end of the list or encountered an error
            break;
          }
        }

        console.log(`Active LP Count: ${activeLpCount}`);
        console.log(`Total LP Principal: ${ethers.formatUnits(totalPrincipal, 18)} USDC`);
        console.log(`Total LP Stake: ${ethers.formatUnits(totalStake, 18)} USDC`);
        console.log(
          `Total LP Deposits (Principal + Stake): ${ethers.formatUnits(totalPrincipal + totalStake, 18)} USDC`,
        );

        // Verify against contract balance
        console.log(`\nBalance Verification:`);
        console.log(`Contract USDC Balance: ${ethers.formatUnits(contractBalance, 18)} USDC`);
        console.log(
          `Total Tracked Funds (User Pool + LP Principal + LP Stake): ${ethers.formatUnits(userPool + totalPrincipal + totalStake, 18)} USDC`,
        );

        // Calculate and display any discrepancy
        const discrepancy = BigInt(contractBalance) - (BigInt(userPool) + BigInt(totalPrincipal) + BigInt(totalStake));
        console.log(`Discrepancy: ${ethers.formatUnits(discrepancy, 18)} USDC`);
      } catch (error: any) {
        console.error("Error calculating LP totals:", error.message || String(error));
      }
      break;

    case "getLastWinner":
      const winner = await jackpot.lastWinnerAddress();
      console.log(`Last Winner: ${winner}`);
      break;

    case "getJackpotInfo":
      // Get comprehensive jackpot information
      const [ticketPrice, userPoolTotal, lpPoolTotal, lastWinnerAddr, lastJackpotTime, isAllowPurchasing] =
        await Promise.all([
          jackpot.ticketPrice(),
          jackpot.userPoolTotal(),
          jackpot.lpPoolTotal(),
          jackpot.lastWinnerAddress(),
          jackpot.lastJackpotEndTime(),
          jackpot.allowPurchasing(),
        ]);

      console.log("=== Jackpot Information ===");
      console.log(`Ticket Price: ${ethers.formatUnits(ticketPrice, 18)}`);
      console.log(`User Pool Total: ${ethers.formatUnits(userPoolTotal, 18)}`);
      console.log(`LP Pool Total: ${ethers.formatUnits(lpPoolTotal, 18)}`);
      console.log(`Last Winner: ${lastWinnerAddr}`);
      console.log(`Last Jackpot Time: ${new Date(Number(lastJackpotTime) * 1000).toLocaleString()}`);
      console.log(`Purchasing Allowed: ${isAllowPurchasing ? "Yes" : "No"}`);
      break;

    case "getJackpotStatus":
      // Get jackpot status information
      const [jackpotLock, lastEndTime, roundDuration, currentBlockTime] = await Promise.all([
        jackpot.jackpotLock(),
        jackpot.lastJackpotEndTime(),
        jackpot.roundDurationInSeconds(),
        provider.getBlock("latest").then(block => block?.timestamp || 0),
      ]);

      const nextRoundTime = Number(lastEndTime) + Number(roundDuration);
      const canRunJackpot = currentBlockTime >= nextRoundTime && !jackpotLock;
      const timeRemaining = nextRoundTime - currentBlockTime;

      console.log("=== Jackpot Status ===");
      console.log(`Jackpot Currently Running: ${jackpotLock ? "Yes" : "No"}`);
      console.log(`Last Jackpot End Time: ${new Date(Number(lastEndTime) * 1000).toLocaleString()}`);
      console.log(`Next Jackpot Available: ${new Date(nextRoundTime * 1000).toLocaleString()}`);

      if (canRunJackpot) {
        console.log("Jackpot can be run now!");
      } else if (timeRemaining > 0) {
        const hours = Math.floor(timeRemaining / 3600);
        const minutes = Math.floor((timeRemaining % 3600) / 60);
        const seconds = timeRemaining % 60;
        console.log(`Time until next jackpot: ${hours}h ${minutes}m ${seconds}s`);
      } else if (jackpotLock) {
        console.log("Jackpot is currently in progress. Please wait for it to complete.");
      }
      break;

    case "getLPInfo":
      const lpAddress = args[0] || signer.address;
      const lpInfo = await jackpot.lpsInfo(lpAddress);
      console.log(`LP Info for ${lpAddress}:`);
      console.log(`- Principal: ${ethers.formatUnits(lpInfo.principal, 18)}`);
      console.log(`- Stake: ${ethers.formatUnits(lpInfo.stake, 18)}`);
      console.log(`- Risk %: ${lpInfo.riskPercentage}`);
      console.log(`- Active: ${lpInfo.active}`);
      break;

    case "checkLPPosition":
      const checkAddress = args[0] || signer.address;
      console.log(`Checking LP position for address: ${checkAddress}`);

      try {
        // Get LP info for the address
        const lpPosition = await jackpot.lpsInfo(checkAddress);

        // Get LP pool total for calculating percentage share
        const totalLpPool = await jackpot.lpPoolTotal();

        // Calculate share percentage if the pool has funds
        const sharePercentage =
          totalLpPool > 0 ? ((Number(lpPosition.stake) / Number(totalLpPool)) * 100).toFixed(4) : "0.0000";

        // Get additional contract information
        const [jackpotLockStatus, minLpDeposit] = await Promise.all([jackpot.jackpotLock(), jackpot.minLpDeposit()]);

        // Format all values for display
        const principal = ethers.formatUnits(lpPosition.principal, 6);
        const stake = ethers.formatUnits(lpPosition.stake, 6);
        const riskPercentage = lpPosition.riskPercentage;
        const isActive = lpPosition.active;

        // Display comprehensive LP position information
        console.log("\n=== LP Position Details ===");
        console.log(`Address: ${checkAddress}`);
        console.log(`Status: ${isActive ? "Active" : "Inactive"}`);
        console.log(`Principal Amount: ${principal} USDC`);
        console.log(`Current Stake: ${stake} USDC`);
        console.log(`Risk Percentage: ${riskPercentage}%`);
        console.log(`Share of LP Pool: ${sharePercentage}%`);

        // Show potential rewards based on risk percentage
        console.log("\n=== Risk/Reward Analysis ===");
        console.log(`Potential Reward Percentage: ${100 - Number(riskPercentage)}%`);
        console.log(`Capital at Risk: ${((Number(stake) * Number(riskPercentage)) / 100).toFixed(6)} USDC`);

        // Show deposit status
        console.log("\n=== Deposit Status ===");
        if (Number(lpPosition.principal) < Number(minLpDeposit)) {
          console.log(`Warning: Deposit is below minimum requirement of ${ethers.formatUnits(minLpDeposit, 6)} USDC`);
        }
        console.log(
          `Jackpot Currently Running: ${jackpotLockStatus ? "Yes (cannot modify position)" : "No (can modify position)"}`,
        );

        // Provide helpful actions
        console.log("\n=== Available Actions ===");
        if (isActive) {
          console.log("- Withdraw LP: Use 'withdrawAllLP' command");
          console.log("- Adjust Risk: Use 'lpAdjustRiskPercentage' command");
        } else {
          console.log("- Deposit LP: Use 'depositLP' command");
        }
      } catch (error: any) {
        console.error("Failed to check LP position:", error.message || String(error));
      }
      break;

    case "getUserInfo":
      const userAddress = args[0] || signer.address;
      const userInfo = await jackpot.usersInfo(userAddress);
      console.log(`User Info for ${userAddress}:`);
      console.log(`- Tickets: ${userInfo.ticketsPurchasedTotalBps}`);
      console.log(`- Winnings: ${ethers.formatUnits(userInfo.winningsClaimable, 18)}`);
      console.log(`- Active: ${userInfo.active}`);
      break;

    case "getLPPoolInfo":
      // Get detailed LP pool information
      const [poolTotal, poolCap, minDepositAmount] = await Promise.all([
        jackpot.lpPoolTotal(),
        jackpot.lpPoolCap(),
        jackpot.minLpDeposit(),
      ]);

      console.log("=== LP Pool Information ===");
      console.log(`LP Pool Total: ${ethers.formatUnits(poolTotal, 6)} USDC`);
      console.log(`LP Pool Cap: ${ethers.formatUnits(poolCap, 6)} USDC`);
      console.log(`Minimum LP Deposit: ${ethers.formatUnits(minDepositAmount, 6)} USDC`);
      console.log(`Available Space: ${ethers.formatUnits((BigInt(poolCap) - BigInt(poolTotal)).toString(), 6)} USDC`);
      break;

    case "setLPPoolCap":
      if (args.length < 1) {
        console.log("Usage: setLPPoolCap <amount>");
        break;
      }

      const capAmount = ethers.parseUnits(args[0], 6);
      console.log(`Setting LP pool cap to ${args[0]} USDC...`);

      try {
        const tx = await jackpot.setLpPoolCap(capAmount);
        await tx.wait();
        console.log(`Successfully set LP pool cap to ${args[0]} USDC`);
      } catch (error: any) {
        console.error("Failed to set LP pool cap:", error.message || String(error));
      }
      break;

    case "setTicketPrice":
      if (args.length < 1) {
        console.log("Usage: setTicketPrice <price>");
        break;
      }

      const ticketPriceAmount = ethers.parseUnits(args[0], 6);
      console.log(`Setting ticket price to ${args[0]} USDC...`);

      try {
        const tx = await jackpot.setTicketPrice(ticketPriceAmount);
        await tx.wait();
        console.log(`Successfully set ticket price to ${args[0]} USDC`);

        // Get updated LP pool information after setting ticket price
        const [newMinLpDeposit, newLpPoolCap] = await Promise.all([jackpot.minLpDeposit(), jackpot.lpPoolCap()]);

        console.log(`New minimum LP deposit: ${ethers.formatUnits(newMinLpDeposit, 6)} USDC`);
        console.log(`New LP pool cap: ${ethers.formatUnits(newLpPoolCap, 6)} USDC`);
      } catch (error: any) {
        console.error("Failed to set ticket price:", error.message || String(error));
      }
      break;

    case "setRoundDuration":
      if (args.length < 1) {
        console.log("Usage: setRoundDuration <durationInSeconds>");
        console.log("Examples: setRoundDuration 86400 (1 day)");
        console.log("          setRoundDuration 3600 (1 hour)");
        console.log("          setRoundDuration 600 (10 minutes)");
        break;
      }
      const newDuration = args[0];
      try {
        const tx = await jackpot.setRoundDurationInSeconds(newDuration);
        await tx.wait();
        console.log(
          `Successfully set round duration to ${newDuration} seconds (${Number(newDuration) / 60 / 60} hours)`,
        );

        // Get and display the current round duration
        const currentDuration = await jackpot.roundDurationInSeconds();
        console.log(`Current round duration: ${currentDuration} seconds (${Number(currentDuration) / 60 / 60} hours)`);
      } catch (error: any) {
        console.error("Failed to set round duration:", error.message || String(error));
      }
      break;

    case "getOwner":
      try {
        const owner = await jackpot.owner();
        console.log(`Contract owner: ${owner}`);
        console.log(`Current signer: ${await signer.getAddress()}`);

        if ((await signer.getAddress()).toLowerCase() === owner.toLowerCase()) {
          console.log("You are the owner of the contract");
        } else {
          console.log("You are NOT the owner of the contract");
        }
      } catch (error: any) {
        console.error("Failed to get owner:", error.message || String(error));
      }
      break;

    case "getPrivateKeyBalance":
      try {
        const privateKey = PRIVATE_KEY;
        // Create wallet from private key
        const wallet = new ethers.Wallet(privateKey, provider);
        const address = wallet.address;

        console.log(`\n=== Wallet Information ===`);
        console.log(`Address: ${address}`);

        // Get ETH balance
        const ethBalance = await provider.getBalance(address);
        console.log(`ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);

        // Get USDC balance
        const usdcContract = new ethers.Contract(
          USDC_ADDRESS,
          ["function balanceOf(address account) view returns (uint256)", "function decimals() view returns (uint8)"],
          provider,
        );

        // Get token decimals
        let tokenDecimals = 6; // Default for USDC
        try {
          tokenDecimals = await usdcContract.decimals();
        } catch (error: any) {
          console.log("Could not get token decimals, using default value of 6", error.message || String(error));
        }

        const usdcBalance = await usdcContract.balanceOf(address);
        console.log(`USDC Balance: ${ethers.formatUnits(usdcBalance, tokenDecimals)} USDC`);

        // Get referral fees if available
        try {
          const referralFees = await jackpot.referralFeesClaimable(address);
          console.log(`Referral Fees Claimable: ${ethers.formatUnits(referralFees, tokenDecimals)} USDC`);
        } catch (error: any) {
          console.log("Could not retrieve referral fees", error);
          // Ignore if referral fees function is not available
        }

        // Check if user has tickets or winnings
        try {
          const userInfo = await jackpot.usersInfo(address);
          if (userInfo) {
            console.log(`\n=== Jackpot Information ===`);
            console.log(`Tickets Purchased: ${userInfo.ticketsPurchasedTotalBps || "0"}`);
            console.log(
              `Winnings Claimable: ${ethers.formatUnits(userInfo.winningsClaimable || "0", tokenDecimals)} USDC`,
            );
            console.log(`Active: ${userInfo.active ? "Yes" : "No"}`);
          }
        } catch (error) {
          console.log("Could not retrieve user info", error);
          // Ignore if user info is not available
        }
      } catch (error: any) {
        console.error("Failed to get wallet balance:", error.message || String(error));
        console.log("Make sure you provided a valid private key");
      }
      break;

    case "initializeContract":
      if (args.length < 3) {
        console.log("Usage: initializeContract <entropyAddress> <tokenAddress> <ticketPrice>");
        break;
      }

      const [entropyAddress, tokenAddress, initTicketPrice] = args;
      const signerAddress = await signer.getAddress();

      console.log(`Initializing contract with:`);
      console.log(`- Entropy Address: ${entropyAddress}`);
      console.log(`- Owner Address: ${signerAddress}`);
      console.log(`- Token Address: ${tokenAddress}`);
      console.log(`- Ticket Price: ${initTicketPrice} USDC`);

      try {
        const tx = await jackpot.initialize(
          entropyAddress,
          signerAddress,
          tokenAddress,
          ethers.parseUnits(initTicketPrice, 6),
        );
        await tx.wait();
        console.log("Contract initialized successfully");

        // Get updated values
        const [owner, ticketPrice, minLpDeposit, lpPoolCap] = await Promise.all([
          jackpot.owner(),
          jackpot.ticketPrice(),
          jackpot.minLpDeposit(),
          jackpot.lpPoolCap(),
        ]);

        console.log(`New owner: ${owner}`);
        console.log(`New ticket price: ${ethers.formatUnits(ticketPrice, 6)} USDC`);
        console.log(`New minimum LP deposit: ${ethers.formatUnits(minLpDeposit, 6)} USDC`);
        console.log(`New LP pool cap: ${ethers.formatUnits(lpPoolCap, 6)} USDC`);
      } catch (error: any) {
        console.error("Failed to initialize contract:", error.message || String(error));
      }
      break;

    case "mintUSDC":
      if (args.length < 1) {
        console.log("Usage: mintUSDC <recipient>");
        break;
      }

      const mintAmount = ethers.parseUnits("5000000", 18);
      const ethAmount = "0.01";
      const [recipient] = args;
      const usdcAddress = "0x20679F4196f17a56711AD8b04776393e8F2499Ad";

      console.log(`Minting ${mintAmount} USDC and sending ${ethAmount} ETH to ${recipient}...`);

      // Create USDC contract instance with mint function
      const usdcContract = new ethers.Contract(
        usdcAddress,
        [
          "function mint(address to, uint256 amount) external",
          "function balanceOf(address account) external view returns (uint256)",
        ],
        signer,
      );

      try {
        // Get balances before operations
        const usdcBalanceBefore = await usdcContract.balanceOf(recipient);
        const ethBalanceBefore = await provider.getBalance(recipient);

        console.log(`USDC balance before: ${ethers.formatUnits(usdcBalanceBefore, 6)} USDC`);
        console.log(`ETH balance before: ${ethers.formatEther(ethBalanceBefore)} ETH`);

        // Send ETH transaction
        const ethTx = await signer.sendTransaction({
          to: recipient,
          value: ethers.parseEther(ethAmount.toString()),
        });
        await ethTx.wait();
        console.log(`Successfully sent ${ethAmount} ETH to ${recipient}`);

        // Mint USDC tokens
        const mintTx = await usdcContract.mint(recipient, ethers.parseUnits(mintAmount.toString(), 6));
        await mintTx.wait();
        console.log(`Successfully minted ${mintAmount} USDC to ${recipient}`);

        // Get balances after operations
        const usdcBalanceAfter = await usdcContract.balanceOf(recipient);
        const ethBalanceAfter = await provider.getBalance(recipient);

        console.log(`USDC balance after: ${ethers.formatUnits(usdcBalanceAfter, 6)} USDC`);
        console.log(`ETH balance after: ${ethers.formatEther(ethBalanceAfter)} ETH`);
      } catch (error: any) {
        console.error("Operation failed:", error.message || String(error));
        console.log("Note: This function only works if the USDC contract is a testnet version with a mint function");
        console.log("and if your account has minting privileges.");
      }
      break;

    case "fundTestUsers":
      console.log("Funding all test users with 0.01 ETH and 10,000 USDC each...");

      const ethAmountPerUser = "0.02";
      const usdcAmountPerUser = "1000";
      const testUsdcAddress = USDC_ADDRESS;

      // Create USDC contract instance with mint function
      const testUsdcContract = new ethers.Contract(
        testUsdcAddress,
        [
          "function mint(address to, uint256 amount) external",
          "function balanceOf(address account) external view returns (uint256)",
        ],
        signer,
      );

      try {
        // Process each test user
        for (let i = 0; i < TEST_USERS.length; i++) {
          const userAddress = TEST_USERS[i];
          console.log(`\nProcessing user ${i + 1}/${TEST_USERS.length}: ${userAddress}`);

          // Get balances before operations
          const usdcBalanceBefore = await testUsdcContract.balanceOf(userAddress);
          const ethBalanceBefore = await provider.getBalance(userAddress);

          console.log(`USDC balance before: ${ethers.formatUnits(usdcBalanceBefore, 18)} USDC`);
          console.log(`ETH balance before: ${ethers.formatEther(ethBalanceBefore)} ETH`);

          // Send ETH transaction
          const ethTx = await signer.sendTransaction({
            to: userAddress,
            value: ethers.parseEther(ethAmountPerUser),
          });
          await ethTx.wait();
          console.log(`Sent ${ethAmountPerUser} ETH to ${userAddress}`);

          // Mint USDC tokens
          const mintTx = await testUsdcContract.mint(userAddress, ethers.parseEther(usdcAmountPerUser));
          await mintTx.wait();
          console.log(`Minted ${usdcAmountPerUser} USDC to ${userAddress}`);

          // Get balances after operations
          const usdcBalanceAfter = await testUsdcContract.balanceOf(userAddress);
          const ethBalanceAfter = await provider.getBalance(userAddress);

          console.log(`USDC balance after: ${ethers.formatUnits(usdcBalanceAfter, 18)} USDC`);
          console.log(`ETH balance after: ${ethers.formatEther(ethBalanceAfter)} ETH`);
        }

        console.log("\nSuccessfully funded all test users!");
      } catch (error: any) {
        console.error("Operation failed:", error.message || String(error));
        console.log("Note: This function only works if the USDC contract is a testnet version with a mint function");
        console.log("and if your account has minting privileges.");
      }
      break;

    case "buyTicketsForAllUsers":
      if (args.length < 1) {
        console.log("Usage: buyTicketsForAllUsers <amount>");
        break;
      }

      const ticketAmount = args[0];
      console.log(`Buying ${ticketAmount} USDC worth of tickets for all test users...`);

      // Create USDC contract instance
      // const ticketUsdcContract = new ethers.Contract(
      //   "0x20679F4196f17a56711AD8b04776393e8F2499Ad",
      //   [
      //     "function approve(address spender, uint256 amount) external returns (bool)",
      //     "function allowance(address owner, address spender) external view returns (uint256)",
      //   ],
      //   signer,
      // );

      // Check if purchasing is allowed
      const isPurchasingAllowed = await jackpot.allowPurchasing();
      if (!isPurchasingAllowed) {
        console.log("Ticket purchasing is currently not allowed. Please enable purchasing first.");
        break;
      }

      // Check if jackpot is running
      const isJackpotRunningForTickets = await jackpot.jackpotLock();
      if (isJackpotRunningForTickets) {
        console.log("Cannot buy tickets while jackpot is running. Please try again later.");
        break;
      }

      try {
        // Buy tickets for each test user using their private key
        for (let i = 0; i < TEST_USERS.length; i++) {
          const userAddress = TEST_USERS[i];
          const userPrivateKey = TEST_USER_PRIVATE_KEYS[i];

          console.log(`\nProcessing user ${i + 1}/${TEST_USERS.length}: ${userAddress}`);

          // Create user wallet and contracts
          const userWallet = new ethers.Wallet(userPrivateKey, provider);
          const userJackpot = new ethers.Contract(CONTRACT_ADDRESS, DomusJackpotABI.abi, userWallet);
          const userUsdcContract = new ethers.Contract(
            "0x20679F4196f17a56711AD8b04776393e8F2499Ad",
            [
              "function approve(address spender, uint256 amount) external returns (bool)",
              "function allowance(address owner, address spender) external view returns (uint256)",
              "function balanceOf(address account) external view returns (uint256)",
            ],
            userWallet,
          );

          // Get user's USDC balance
          const userUsdcBalance = await userUsdcContract.balanceOf(userAddress);
          console.log(`USDC balance: ${ethers.formatUnits(userUsdcBalance, 6)} USDC`);

          if (userUsdcBalance < ethers.parseUnits(ticketAmount, 6)) {
            console.log(`Insufficient USDC balance. Skipping user.`);
            continue;
          }

          // Check current allowance
          const userAllowance = await userUsdcContract.allowance(userAddress, CONTRACT_ADDRESS);
          console.log(`Current allowance for jackpot contract: ${ethers.formatUnits(userAllowance, 6)} USDC`);

          // Approve jackpot contract to spend tokens if needed
          if (userAllowance < ethers.parseUnits(ticketAmount, 6)) {
            console.log(`Approving ${ticketAmount} USDC for jackpot contract...`);
            const approveTx = await userUsdcContract.approve(CONTRACT_ADDRESS, ethers.parseUnits(ticketAmount, 6));
            await approveTx.wait();
            console.log(`Approval transaction successful`);
          } else {
            console.log("Sufficient allowance already exists, skipping approval step.");
          }

          // Choose a referrer (use the next user in the list, or the first user if this is the last one)
          const referrerIndex = (i + 1) % TEST_USERS.length;
          const referrerAddress = TEST_USERS[referrerIndex];

          // Buy tickets
          console.log(`Buying tickets with ${ticketAmount} USDC with referrer ${referrerAddress}...`);
          const buyTx = await userJackpot.purchaseTickets(
            referrerAddress,
            ethers.parseUnits(ticketAmount, 6),
            userAddress,
          );
          await buyTx.wait();
          console.log(`Successfully purchased tickets for ${userAddress}`);
        }

        console.log("\nSuccessfully bought tickets for all eligible test users!");
      } catch (error: any) {
        console.error("Operation failed:", error.message || String(error));
      }
      break;

    case "viewJackpotParticipants":
      console.log("Retrieving jackpot participants and winner information...");

      try {
        // Get winner information
        const [lastWinner, lastJackpotTime, jackpotRunning, userPoolTotal, lpPoolTotal, ticketPrice] =
          await Promise.all([
            jackpot.lastWinnerAddress(),
            jackpot.lastJackpotEndTime(),
            jackpot.jackpotLock(),
            jackpot.userPoolTotal(),
            jackpot.lpPoolTotal(),
            jackpot.ticketPrice(),
          ]);

        console.log("\n=== Winner Information ===");
        console.log(
          `Last Winner: ${lastWinner === "0x0000000000000000000000000000000000000000" ? "None" : lastWinner}`,
        );
        console.log(`Last Jackpot Time: ${new Date(Number(lastJackpotTime) * 1000).toLocaleString()}`);
        console.log(`Jackpot Currently Running: ${jackpotRunning ? "Yes" : "No"}`);

        // Get active LP addresses
        const activeLpCount = await jackpot.activeLpAddresses.length;
        console.log(`\nActive LPs: ${activeLpCount}`);

        // Create USDC contract instance for balance checks
        const usdcContract = new ethers.Contract(
          USDC_ADDRESS,
          ["function balanceOf(address account) external view returns (uint256)"],
          provider,
        );

        // Try to get information about LPs
        try {
          console.log("\n=== Active Liquidity Providers ===");
          let lpIndex = 0;
          let foundLPs = 0;

          // Try to iterate through LPs (we'll try up to 20 addresses)
          while (foundLPs < 20) {
            try {
              const lpAddress = await jackpot.activeLpAddresses(lpIndex);
              if (lpAddress === "0x0000000000000000000000000000000000000000") {
                break;
              }

              const lpInfo = await jackpot.lpsInfo(lpAddress);
              if (lpInfo.active) {
                foundLPs++;
                console.log(`\nLP ${foundLPs}: ${lpAddress}`);
                console.log(`- Principal: ${ethers.formatUnits(lpInfo.principal, 6)} USDC`);
                console.log(`- Risk Percentage: ${lpInfo.riskPercentage}%`);

                // Get LP's USDC and ETH balances
                const lpUsdcBalance = await usdcContract.balanceOf(lpAddress);
                const lpEthBalance = await provider.getBalance(lpAddress);
                console.log(`- USDC Balance: ${ethers.formatUnits(lpUsdcBalance, 6)} USDC`);
                console.log(`- ETH Balance: ${ethers.formatEther(lpEthBalance)} ETH`);
              }

              lpIndex++;
            } catch (error: any) {
              console.log("Error getting LP information:", error.message);
              // We've reached the end of the LP list or encountered an error
              break;
            }
          }

          if (foundLPs === 0) {
            console.log("No active liquidity providers found.");
          }
        } catch (error: any) {
          console.log("Could not retrieve LP information:", error.message);
        }

        // Get information about all test users
        console.log("\n=== Test Users Information ===");

        // Try to get information for all test users
        for (let i = 0; i < TEST_USERS.length; i++) {
          const userAddress = TEST_USERS[i];
          try {
            console.log(`\nUser ${i + 1}: ${userAddress}`);

            const userStruct = await jackpot.usersInfo(userAddress);

            // Access the struct properties based on their array indices
            // Based on the contract, the User struct has these properties:
            // [0]: ticketsPurchasedTotalBps (uint256) - Total tickets purchased by the user for current jackpot
            // [1]: winningsClaimable (uint256) - Tracks the total win amount in token
            // [2]: active (bool) - Whether or not the user is participating in the current jackpot

            if (userStruct && userStruct.length >= 3) {
              // Calculate actual tickets purchased
              // In the contract: ticketsPurchasedBps = ticketCount * (10000 - feeBps)
              // To get actual tickets, we need to divide by (10000 - feeBps), but since we don't know feeBps,
              // we'll estimate it based on the contract's typical fee structure

              // Get the fee percentage from the contract (default to 10% if not available)
              let feeBps = 1000; // Default 10% fee
              try {
                feeBps = await jackpot.feeBps();
              } catch (error) {
                console.log("Could not retrieve fee percentage, using default 10%", error);
              }

              const ticketsPurchasedBps = Number(userStruct[0]);

              // Calculate actual tickets based on the formula: ticketsPurchasedBps = ticketCount * (10000 - feeBps)
              const actualTickets = Math.round(ticketsPurchasedBps / (10000 - Number(feeBps)));

              // Calculate ticket purchase amount in USDC
              const ticketPrice = await jackpot.ticketPrice();
              const ticketPurchaseAmount = actualTickets * Number(ethers.formatUnits(ticketPrice, 6));

              console.log(`- Tickets Purchased: ${actualTickets} (${ticketPurchaseAmount} USDC)`);
              console.log(`- Tickets Weight in Pool: ${(ticketsPurchasedBps / 10000).toFixed(2)} basis points`);
              console.log(`- Winnings Claimable: ${ethers.formatUnits(userStruct[1], 6)} USDC`);
              console.log(`- Active: ${userStruct[2] ? "Yes" : "No"}`);

              // Get user's USDC and ETH balances
              const userUsdcBalance = await usdcContract.balanceOf(userAddress);
              const userEthBalance = await provider.getBalance(userAddress);
              console.log(`- USDC Balance: ${ethers.formatUnits(userUsdcBalance, 6)} USDC`);
              console.log(`- ETH Balance: ${ethers.formatEther(userEthBalance)} ETH`);

              // Get referral fees claimable
              try {
                const referralFees = await jackpot.referralFeesClaimable(userAddress);
                console.log(`- Referral Fees Claimable: ${ethers.formatUnits(referralFees, 6)} USDC`);
              } catch (error: any) {
                console.log("Could not retrieve referral fees", error);
              }
            }
          } catch (error: any) {
            console.log(`Could not retrieve information for user ${userAddress}: ${error.message}`);
          }
        }

        console.log("\n=== Pool Information ===");
        console.log(`User Pool Total: ${ethers.formatUnits(userPoolTotal, 6)} USDC`);
        console.log(`LP Pool Total: ${ethers.formatUnits(lpPoolTotal, 6)} USDC`);
        console.log(`Ticket Price: ${ethers.formatUnits(ticketPrice, 6)} USDC`);
      } catch (error: any) {
        console.error("Failed to retrieve jackpot information:", error.message || String(error));
      }
      break;

    case "claimWinnings":
      if (args.length < 1) {
        console.log("Usage: claimWinnings <userNumber>");
        break;
      }

      const claimUserNumber = parseInt(args[0]);

      if (isNaN(claimUserNumber) || claimUserNumber < 1 || claimUserNumber > TEST_USERS.length) {
        console.log(`Invalid user number. Please provide a number between 1 and ${TEST_USERS.length}`);
        break;
      }

      const claimUserAddress = TEST_USERS[claimUserNumber - 1];
      console.log(`Claiming winnings for User ${claimUserNumber}: ${claimUserAddress}`);

      try {
        // First, check if the user has any winnings to claim
        const userInfo = await jackpot.usersInfo(claimUserAddress);
        const winningsClaimable = userInfo[1]; // Index 1 is winningsClaimable based on the contract

        console.log(`Winnings available to claim: ${ethers.formatUnits(winningsClaimable, 6)} USDC`);

        if (winningsClaimable <= 0) {
          console.log("No winnings available to claim for this user.");
          break;
        }

        // Check user's ETH balance
        const userEthBalance = await provider.getBalance(claimUserAddress);
        console.log(`User ETH balance: ${ethers.formatEther(userEthBalance)} ETH`);

        // Fund the user with ETH if needed for gas
        if (userEthBalance < ethers.parseEther("0.01")) {
          console.log("User needs ETH for gas. Sending 0.01 ETH...");
          const fundTx = await signer.sendTransaction({
            to: claimUserAddress,
            value: ethers.parseEther("0.01"),
          });
          await fundTx.wait();
          console.log(`Funded user with 0.01 ETH. Transaction: ${fundTx.hash}`);

          // Verify new balance
          const newBalance = await provider.getBalance(claimUserAddress);
          console.log(`New ETH balance: ${ethers.formatEther(newBalance)} ETH`);
        }

        // Create a wallet for the specific test user
        const userWallet = new ethers.Wallet(TEST_USER_PRIVATE_KEYS[claimUserNumber - 1], provider);

        // Create a contract instance connected to the user's wallet
        const userJackpot = new ethers.Contract(
          CONTRACT_ADDRESS,
          [
            "function withdrawWinnings() public",
            "function usersInfo(address) public view returns (uint256, uint256, bool)",
          ],
          userWallet,
        );

        console.log("Sending transaction to withdraw winnings...");
        const tx = await userJackpot.withdrawWinnings();
        console.log(`Transaction sent: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`Winnings claimed successfully in block ${receipt.blockNumber}`);

        // Check the user's winnings after withdrawal
        const userInfoAfter = await jackpot.usersInfo(claimUserAddress);
        const winningsAfter = userInfoAfter[1];

        console.log(`Winnings remaining after claim: ${ethers.formatUnits(winningsAfter, 6)} USDC`);
        console.log(
          `Successfully claimed ${ethers.formatUnits(winningsClaimable, 6)} USDC for User ${claimUserNumber}`,
        );

        // Check the user's USDC balance after claiming
        const usdcContract = new ethers.Contract(
          "0x20679F4196f17a56711AD8b04776393e8F2499Ad", // USDC token address
          ["function balanceOf(address) external view returns (uint256)"],
          provider,
        );

        const usdcBalance = await usdcContract.balanceOf(claimUserAddress);
        console.log(`User USDC balance after claiming: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
      } catch (error: any) {
        console.error("Failed to claim winnings:", error.message || String(error));
      }
      break;

    case "setMinLpDeposit":
      if (args.length < 1) {
        console.log("Usage: setMinLpDeposit <amount>");
        break;
      }

      const minLpDepositAmount = ethers.parseUnits(args[0], 18);
      console.log(`Setting minimum LP deposit to ${args[0]} USDC...`);

      try {
        const tx = await jackpot.setMinLpDeposit(minLpDepositAmount);
        await tx.wait();
        console.log(`Successfully set minimum LP deposit to ${args[0]} USDC`);

        // Get updated LP pool information after setting minimum LP deposit
        const [newMinLpDeposit, newLpPoolCap] = await Promise.all([jackpot.minLpDeposit(), jackpot.lpPoolCap()]);

        console.log(`Current minimum LP deposit: ${ethers.formatUnits(newMinLpDeposit, 18)} USDC`);
        console.log(`Current LP pool cap: ${ethers.formatUnits(newLpPoolCap, 18)} USDC`);
      } catch (error: any) {
        console.error("Failed to set minimum LP deposit:", error.message || String(error));
      }
      break;

    case "setAllowPurchasing":
      if (args.length < 1) {
        console.log("Usage: setAllowPurchasing <true|false>");
        break;
      }

      const allowPurchasingValue = args[0].toLowerCase() === "true";
      console.log(`Setting allowPurchasing to ${allowPurchasingValue}...`);

      try {
        const tx = await jackpot.setAllowPurchasing(allowPurchasingValue);
        await tx.wait();
        console.log(`Successfully set allowPurchasing to ${allowPurchasingValue}`);

        // Get updated purchasing status
        const currentAllowPurchasing = await jackpot.allowPurchasing();
        console.log(`Current allowPurchasing status: ${currentAllowPurchasing ? "Enabled" : "Disabled"}`);
      } catch (error: any) {
        console.error("Failed to set allowPurchasing:", error.message || String(error));
      }
      break;

    case "claimReferralBonus":
      try {
        // Always use the owner's private key (main signer)
        console.log(`Using wallet: ${signer.address}`);

        // Check referral fees claimable
        const referralFees = await jackpot.referralFeesClaimable(signer.address);
        console.log(`Referral fees claimable: ${ethers.formatUnits(referralFees, 6)} USDC`);

        if (referralFees <= 0) {
          console.log("No referral fees to claim");
          break;
        }

        // Withdraw referral fees
        console.log("Claiming referral fees...");
        const tx = await jackpot.withdrawReferralFees();
        const receipt = await tx.wait();
        console.log(`Successfully claimed referral fees: ${tx.hash}`);

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
              console.log(`- Amount: ${ethers.formatUnits(event.args.amount, 6)} USDC`);
            }
          }
        }

        // Check USDC balance after withdrawal
        const usdcContract = new ethers.Contract(
          USDC_ADDRESS,
          ["function balanceOf(address account) view returns (uint256)"],
          provider,
        );
        const usdcBalance = await usdcContract.balanceOf(signer.address);
        console.log(`USDC balance after withdrawal: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

        // Verify referral fees are now zero
        const feesAfter = await jackpot.referralFeesClaimable(signer.address);
        console.log(`Referral fees after withdrawal: ${ethers.formatUnits(feesAfter, 6)} USDC`);
      } catch (error: any) {
        console.error("Failed to claim referral fees:", error.message || String(error));
      }
      break;

    default:
      console.log("Unknown command. Available commands:");
      console.log("buyTicket <value> <referrer>");
      console.log("depositLP <riskPercentage> <amount>");
      console.log("depositLPWithApproval <riskPercentage> <amount>");
      console.log("getTicketPrice");
      console.log("runJackpot");
      console.log("getPoolTotals");
      console.log("getLastWinner");
      console.log("getJackpotInfo");
      console.log("getJackpotStatus");
      console.log("getLPInfo");
      console.log("getUserInfo");
      console.log("getLPPoolInfo");
      console.log("setLPPoolCap <amount>");
      console.log("setTicketPrice <price>");
      console.log("setMinLpDeposit <amount>");
      console.log("setAllowPurchasing <true|false>");
      console.log("getOwner");
      console.log("getPrivateKeyBalance");
      console.log("claimReferralBonus");
      console.log("initializeContract <entropyAddress> <tokenAddress> <ticketPrice>");
      console.log("mintUSDC <recipient> <amount>");
      console.log("fundTestUsers");
      console.log("buyTicketsForAllUsers <amount>");
      console.log("viewJackpotParticipants");
      console.log("claimWinnings <userNumber>");
      console.log("checkLPPosition <address>");
  }
}

main().catch((error: Error) => {
  console.error(error);
  process.exitCode = 1;
});
