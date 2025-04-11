// packages/hardhat/scripts/interact_jackpot.ts
// Script to interact with the BaseJackpot contract
import { ethers } from "ethers";
import BaseJackpotABI from "../artifacts/contracts/BaseJackpot.sol/BaseJackpot.json";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Configuration
const RPC_URL = "https://arb-sepolia.g.alchemy.com/v2/2Q9eoOjO011kr5tnMrZxonEo1Lqasted";
const CONTRACT_ADDRESS = "0x5C08d963d77E3813d5CCe69B89edAA8c88Fe601a";
// Use the private key from .env or fallback to the hardcoded one for testing
const PRIVATE_KEY = process.env.PRIVATE_KEY;

async function main() {
  if (!PRIVATE_KEY) {
    throw new Error("Private key not found");
  }
  // Set up provider and signer
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  // Connect to contract with TypeScript interface
  const jackpot = new ethers.Contract(CONTRACT_ADDRESS, BaseJackpotABI.abi, signer);

  // Get function and args from CLI
  const functionName = process.argv[2];
  const args = process.argv.slice(3);

  switch (functionName) {
    case "buyTicket":
      const [value, referrer] = args;
      await jackpot.purchaseTickets(referrer, value, signer.address);
      console.log(`Purchased ticket with ${value} tokens`);
      break;

    case "depositLP":
      const [riskPercentage, amount] = args;
      await jackpot.lpDeposit(Number(riskPercentage), amount);
      console.log(`Deposited ${amount} as LP with ${riskPercentage}% risk`);
      break;

    case "depositLPWithApproval":
      if (args.length < 2) {
        console.log("Usage: depositLPWithApproval <riskPercentage> <amount>");
        break;
      }

      const [lpRiskPercentage, lpAmount] = args;

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

      if (userBalance < ethers.parseUnits(lpAmount, 6)) {
        console.log(`Insufficient USDC balance. You need at least ${lpAmount} USDC.`);
        break;
      }

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(await signer.getAddress(), CONTRACT_ADDRESS);
      console.log(`Current allowance for jackpot contract: ${ethers.formatUnits(currentAllowance, 6)} USDC`);

      const depositAmount = ethers.parseUnits(lpAmount, 6);

      // Approve jackpot contract to spend tokens if needed
      if (currentAllowance < depositAmount) {
        console.log(`Approving ${lpAmount} USDC tokens for jackpot contract at ${CONTRACT_ADDRESS}...`);
        const approveTx = await tokenContract.approve(CONTRACT_ADDRESS, depositAmount);
        await approveTx.wait();
        console.log(`Approval transaction successful: ${approveTx.hash}`);
      } else {
        console.log("Sufficient allowance already exists, skipping approval step.");
      }

      // Deposit LP
      console.log(`Depositing ${lpAmount} USDC as LP with ${lpRiskPercentage}% risk...`);
      try {
        const depositTx = await jackpot.lpDeposit(Number(lpRiskPercentage), depositAmount);
        await depositTx.wait();
        console.log(`Successfully deposited ${lpAmount} USDC as LP with ${lpRiskPercentage}% risk`);
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

        // Generate a random number for entropy
        const randomBytes = ethers.randomBytes(32);
        const userRandomNumber = ethers.hexlify(randomBytes);
        console.log(`Using random number: ${userRandomNumber}`);

        // Send transaction with ETH value for entropy fee (0.01 ETH as a safe default)
        const entropyFee = ethers.parseEther("0.01");
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
      console.log("getOwner");
      console.log("initializeContract <entropyAddress> <tokenAddress> <ticketPrice>");
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
