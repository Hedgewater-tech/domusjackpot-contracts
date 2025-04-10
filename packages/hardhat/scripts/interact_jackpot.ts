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
const CONTRACT_ADDRESS = "0x3EA4857E2402D9671a7289233024f00728Fa8314";
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

    case "getTicketPrice":
      const price = await jackpot.ticketPrice();
      console.log(`Ticket Price: ${ethers.formatUnits(price, 18)}`);
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

    default:
      console.log("Available functions:");
      console.log("buyTicket <value> <referrer>");
      console.log("depositLP <riskPercentage> <amount>");
      console.log("getTicketPrice");
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
