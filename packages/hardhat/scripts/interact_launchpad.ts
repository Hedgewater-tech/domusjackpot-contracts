// packages/hardhat/scripts/interact_launchpad.ts
// Script to interact with the TokenLaunchpad contract
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
import TokenLaunchpadABI from "../artifacts/contracts/TokenLaunchpad.sol/TokenLaunchpad.json";
import LaunchpadTokenABI from "../artifacts/contracts/TokenLaunchpad.sol/LaunchpadToken.json";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Configuration - Update these values with your deployed contract
const NETWORK = process.env.NETWORK || "base";
const RPC_URL = NETWORK === "base" ? "https://mainnet.base.org" : "https://sepolia.base.org";
const LAUNCHPAD_ADDRESS = process.env.LAUNCHPAD_ADDRESS || "0x7d4d84152aAcEAE2c5347A13d652e83528caa586"; // Replace with your deployed contract address

// Use the private key from .env
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  throw new Error("Private key not found in .env file");
}

// Test users for simulation
const TEST_USERS = [
  "0xaB6010C3F2F8BBd51416285c39ce819B54acC225",
  "0x730C39D9E410cbE70730b47D75f71ddabfb810F8",
  "0x7d6BD04B12cEB77C736DE98715dBcb7f813C2638",
  "0x2Cf7AA867956Ef0F158896bB88f153e92bD0E17a",
  "0x0A7c7E31D92acd682f3c67E391f15F21ca11C825",
];

// const TEST_USER_PRIVATE_KEYS = [
//   "65ab44cb548f90c08dc8a1cbb41538b9d7586ac188a533764789b421346b93f9",
//   "fc7174d4f5bf8e286dd5687bdc016e040ea989a5e7be3934074bf7d268f462e4",
//   "df48344a542dbad9515d3f78332fcb863ffbb6d4fc120759c38da964a2747ce2",
//   "4a9ac44214459794213aab39c9a5ea6f8021efd812edd802fe5ab29d93daf4c1",
//   "c855c797046685c98a73f79842045bd317a94746950e347785f5c6c756af93a0",
// ];

async function main() {
  console.log("Starting interaction with TokenLaunchpad contract...");

  if (!PRIVATE_KEY) {
    throw new Error("Private key not found");
  }
  // Set up provider and signer
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`Connected to network: ${NETWORK}`);
  console.log(`Using launchpad contract at: ${LAUNCHPAD_ADDRESS}`);
  console.log(`Wallet address: ${signer.address}`);

  // Connect to the TokenLaunchpad contract
  const launchpad = new ethers.Contract(LAUNCHPAD_ADDRESS, TokenLaunchpadABI.abi, signer);

  // Get function and args from CLI
  const functionName = process.argv[2];
  const args = process.argv.slice(3);

  switch (functionName) {
    case "createToken": {
      // Expected args: name, symbol, totalSupply, price, allocatedForSale
      if (args.length < 5) {
        console.log("Usage: createToken <name> <symbol> <totalSupply> <price> <allocatedForSale>");
        break;
      }

      const [name, symbol, totalSupply, price, allocatedForSale] = args;

      console.log(`Creating token with the following parameters:`);
      console.log(`- Name: ${name}`);
      console.log(`- Symbol: ${symbol}`);
      console.log(`- Total Supply: ${totalSupply} tokens`);
      console.log(`- Price: ${ethers.formatEther(price)} ETH per token`);
      // console.log(`- Allocated for sale: ${allocatedForSale / 100}%`);

      try {
        // Convert values to appropriate formats
        const totalSupplyWei = ethers.parseEther(totalSupply);
        const priceWei = ethers.parseEther(price);

        console.log("args ", { name, symbol, totalSupplyWei, priceWei, allocatedForSale });

        // Create the token
        const tx = await launchpad.createToken(name, symbol, totalSupplyWei, priceWei, allocatedForSale);

        console.log(`Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Token created successfully in block ${receipt.blockNumber}`);

        // Get the token address from the event
        const tokenCreatedEvent = launchpad.interface.getEvent("TokenCreated");
        if (tokenCreatedEvent) {
          const topicHash = tokenCreatedEvent.topicHash;
          console.log("event length ", receipt.logs.length);
          const tokenCreatedEvents = receipt.logs.filter((log: any) => log.topics[0] === topicHash);

          if (tokenCreatedEvents.length > 0) {
            const event = launchpad.interface.parseLog(tokenCreatedEvents[0]);
            if (event && event.args) {
              console.log(`Token address: ${event.args.tokenAddress}`);
              console.log(`Token creator: ${event.args.creator}`);
            }
          }
        }
      } catch (error: any) {
        console.error("Failed to create token:", error.message || String(error));
      }
      break;
    }

    case "purchaseTokens": {
      // Expected args: tokenAddress, amount
      if (args.length < 2) {
        console.log("Usage: purchaseTokens <tokenAddress> <amount>");
        break;
      }

      const [tokenAddress, amount] = args;

      try {
        // Get token info
        const tokenInfo = await launchpad.tokens(tokenAddress);
        console.log(`Token info for ${tokenAddress}:`);
        console.log(`- Creator: ${tokenInfo.creator}`);
        console.log(`- Price: ${ethers.formatEther(tokenInfo.price)} ETH per token`);
        console.log(`- Available supply: ${ethers.formatEther(tokenInfo.availableSupply)} tokens`);
        console.log(`- Active: ${tokenInfo.isActive}`);

        if (!tokenInfo.isActive) {
          console.log("Token is not active for sale.");
          break;
        }

        // Calculate cost
        const amountWei = ethers.parseEther(amount);
        const totalCost = (tokenInfo.price * amountWei) / ethers.parseEther("1");
        console.log(`Purchasing ${amount} tokens at ${ethers.formatEther(tokenInfo.price)} ETH each`);
        console.log(`Total cost: ${ethers.formatEther(totalCost)} ETH`);

        // Purchase tokens
        const tx = await launchpad.purchaseTokens(tokenAddress, amountWei, { value: totalCost });
        console.log(`Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Tokens purchased successfully in block ${receipt.blockNumber}`);

        // Get purchase event
        const purchaseEvent = launchpad.interface.getEvent("TokenPurchased");
        if (purchaseEvent) {
          const topicHash = purchaseEvent.topicHash;
          const purchaseEvents = receipt.logs.filter((log: any) => log.topics[0] === topicHash);

          if (purchaseEvents.length > 0) {
            const event = launchpad.interface.parseLog(purchaseEvents[0]);
            if (event && event.args) {
              console.log(`Buyer: ${event.args.buyer}`);
              console.log(`Amount: ${ethers.formatEther(event.args.amount)} tokens`);
              console.log(`Cost: ${ethers.formatEther(event.args.cost)} ETH`);
            }
          }
        }
      } catch (error: any) {
        console.error("Failed to purchase tokens:", error.message || String(error));
      }
      break;
    }

    case "getTokenInfo": {
      // Expected args: tokenAddress
      if (args.length < 1) {
        console.log("Usage: getTokenInfo <tokenAddress>");
        break;
      }

      const [tokenAddress] = args;

      try {
        // Get token info from launchpad
        const tokenInfo = await launchpad.tokens(tokenAddress);
        console.log(`Token info for ${tokenAddress}:`);
        console.log(`- Creator: ${tokenInfo.creator}`);
        console.log(`- Price: ${ethers.formatEther(tokenInfo.price)} ETH per token`);
        console.log(`- Available supply: ${ethers.formatEther(tokenInfo.availableSupply)} tokens`);
        console.log(`- Active: ${tokenInfo.isActive}`);

        // Connect to the token contract to get more info
        const token = new ethers.Contract(tokenAddress, LaunchpadTokenABI.abi, provider);
        const [name, symbol, totalSupply, balance] = await Promise.all([
          token.name(),
          token.symbol(),
          token.totalSupply(),
          token.balanceOf(signer.address),
        ]);

        console.log(`\nToken contract info:`);
        console.log(`- Name: ${name}`);
        console.log(`- Symbol: ${symbol}`);
        console.log(`- Total supply: ${ethers.formatEther(totalSupply)} tokens`);
        console.log(`- Your balance: ${ethers.formatEther(balance)} tokens`);
      } catch (error: any) {
        console.error("Failed to get token info:", error.message || String(error));
      }
      break;
    }

    case "updateTokenPrice": {
      // Expected args: tokenAddress, newPrice
      if (args.length < 2) {
        console.log("Usage: updateTokenPrice <tokenAddress> <newPrice>");
        break;
      }

      const [tokenAddress, newPrice] = args;

      try {
        const tokenInfo = await launchpad.tokens(tokenAddress);

        if (tokenInfo.creator !== signer.address) {
          console.log("Only the token creator can update the price.");
          break;
        }

        const newPriceWei = ethers.parseEther(newPrice);
        console.log(`Updating token price from ${ethers.formatEther(tokenInfo.price)} ETH to ${newPrice} ETH`);

        const tx = await launchpad.updateTokenPrice(tokenAddress, newPriceWei);
        console.log(`Transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log(`Token price updated successfully`);
      } catch (error: any) {
        console.error("Failed to update token price:", error.message || String(error));
      }
      break;
    }

    case "setTokenActive": {
      // Expected args: tokenAddress, isActive
      if (args.length < 2) {
        console.log("Usage: setTokenActive <tokenAddress> <isActive>");
        break;
      }

      const [tokenAddress, isActiveStr] = args;
      const isActive = isActiveStr.toLowerCase() === "true";

      try {
        const tokenInfo = await launchpad.tokens(tokenAddress);

        if (tokenInfo.creator !== signer.address) {
          console.log("Only the token creator can update the token status.");
          break;
        }

        console.log(`Setting token active status to: ${isActive}`);

        const tx = await launchpad.setTokenActive(tokenAddress, isActive);
        console.log(`Transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log(`Token active status updated successfully`);
      } catch (error: any) {
        console.error("Failed to update token active status:", error.message || String(error));
      }
      break;
    }

    case "getTokenCount": {
      try {
        const count = await launchpad.getTokenCount();
        console.log(`Total tokens created: ${count}`);
      } catch (error: any) {
        console.error("Failed to get token count:", error.message || String(error));
      }
      break;
    }

    case "approveTokens": {
      // Expected args: tokenAddress, spender, amount
      if (args.length < 3) {
        console.log("Usage: approveTokens <tokenAddress> <spender> <amount>");
        break;
      }

      const [tokenAddress, spender, amount] = args;

      try {
        const token = new ethers.Contract(tokenAddress, LaunchpadTokenABI.abi, signer);
        const amountWei = ethers.parseEther(amount);

        console.log(`Approving ${amount} tokens for ${spender}`);

        const tx = await token.approve(spender, amountWei);
        console.log(`Transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log(`Token approval successful`);
      } catch (error: any) {
        console.error("Failed to approve tokens:", error.message || String(error));
      }
      break;
    }

    case "simulateTokenLaunch": {
      // Expected args: name, symbol, totalSupply, price, allocatedForSale
      if (args.length < 5) {
        console.log("Usage: simulateTokenLaunch <name> <symbol> <totalSupply> <price> <allocatedForSale>");
        break;
      }

      const [name, symbol, totalSupply, price, allocatedForSale] = args;

      try {
        console.log("=== Starting Token Launch Simulation ===");
        console.log(`Creating token: ${name} (${symbol})`);

        // 1. Create the token
        const totalSupplyWei = ethers.parseEther(totalSupply);
        const priceWei = ethers.parseEther(price);

        const createTx = await launchpad.createToken(name, symbol, totalSupplyWei, priceWei, allocatedForSale);

        console.log(`Transaction sent: ${createTx.hash}`);
        const createReceipt = await createTx.wait();
        console.log(`Token created successfully in block ${createReceipt.blockNumber}`);

        // Get the token address from the event
        const tokenCreatedEvent = launchpad.interface.getEvent("TokenCreated");
        let tokenAddress = "";

        if (tokenCreatedEvent) {
          const topicHash = tokenCreatedEvent.topicHash;
          const tokenCreatedEvents = createReceipt.logs.filter((log: any) => log.topics[0] === topicHash);

          if (tokenCreatedEvents.length > 0) {
            const event = launchpad.interface.parseLog(tokenCreatedEvents[0]);
            if (event && event.args) {
              tokenAddress = event.args.tokenAddress;
              console.log(`Token address: ${tokenAddress}`);
            }
          }
        }

        if (!tokenAddress) {
          console.log("Failed to get token address from events");
          return;
        }

        // 2. Get token info
        const tokenInfo = await launchpad.tokens(tokenAddress);
        console.log(`\nToken info:`);
        console.log(`- Creator: ${tokenInfo.creator}`);
        console.log(`- Price: ${ethers.formatEther(tokenInfo.price)} ETH per token`);
        console.log(`- Available supply: ${ethers.formatEther(tokenInfo.availableSupply)} tokens`);

        // 3. Connect to the token contract
        const token = new ethers.Contract(tokenAddress, LaunchpadTokenABI.abi, signer);

        // 4. Approve the launchpad to spend tokens
        const approveTx = await token.approve(LAUNCHPAD_ADDRESS, tokenInfo.availableSupply);
        console.log(`\nApproving launchpad to spend tokens: ${approveTx.hash}`);
        await approveTx.wait();
        console.log(`Approval successful`);

        // 5. Simulate purchases by test users
        console.log("\n=== Simulating purchases by test users ===");

        for (let i = 0; i < TEST_USERS.length; i++) {
          const userAddress = TEST_USERS[i];
          // const userPrivateKey = TEST_USER_PRIVATE_KEYS[i];
          // const userSigner = new ethers.Wallet(userPrivateKey, provider);
          // const userLaunchpad = launchpad.connect(userSigner);

          // Calculate a random amount to purchase (between 1 and 10 tokens)
          const purchaseAmount = (Math.random() * 9 + 1).toFixed(2);
          const purchaseAmountWei = ethers.parseEther(purchaseAmount);

          // Calculate cost
          const totalCost = (tokenInfo.price * purchaseAmountWei) / ethers.parseEther("1");

          console.log(`\nUser ${i + 1} (${userAddress}) is purchasing ${purchaseAmount} tokens`);
          console.log(`Cost: ${ethers.formatEther(totalCost)} ETH`);

          // try {
          //   const purchaseTx = await userLaunchpad.purchaseTokens(tokenAddress, purchaseAmountWei, {
          //     value: totalCost,
          //   });

          //   console.log(`Transaction sent: ${purchaseTx.hash}`);
          //   await purchaseTx.wait();
          //   console.log(`Purchase successful`);

          //   // Check user's token balance
          //   const userBalance = await token.balanceOf(userAddress);
          //   console.log(`User's token balance: ${ethers.formatEther(userBalance)} ${symbol}`);
          // } catch (error: any) {
          //   console.error(`User ${i + 1} purchase failed:`, error.message || String(error));
          // }
        }

        // 6. Final token and ETH balances
        console.log("\n=== Final Balances ===");

        // Creator's token balance
        const creatorBalance = await token.balanceOf(signer.address);
        console.log(`Creator's token balance: ${ethers.formatEther(creatorBalance)} ${symbol}`);

        // Creator's ETH balance
        const creatorEthBalance = await provider.getBalance(signer.address);
        console.log(`Creator's ETH balance: ${ethers.formatEther(creatorEthBalance)} ETH`);

        // Remaining tokens for sale
        const remainingTokens = await launchpad.tokens(tokenAddress).then(info => info.availableSupply);
        console.log(`Remaining tokens for sale: ${ethers.formatEther(remainingTokens)} ${symbol}`);

        console.log("\n=== Token Launch Simulation Complete ===");
      } catch (error: any) {
        console.error("Simulation failed:", error.message || String(error));
      }
      break;
    }

    default:
      console.log(`
Available commands:
  createToken <name> <symbol> <totalSupply> <price> <allocatedForSale>
  purchaseTokens <tokenAddress> <amount>
  getTokenInfo <tokenAddress>
  updateTokenPrice <tokenAddress> <newPrice>
  setTokenActive <tokenAddress> <isActive>
  getTokenCount
  approveTokens <tokenAddress> <spender> <amount>
  simulateTokenLaunch <name> <symbol> <totalSupply> <price> <allocatedForSale>
      `);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
