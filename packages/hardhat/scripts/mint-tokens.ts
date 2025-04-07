import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { HTEST__factory } from "../typechain-types";

async function main(hre: HardhatRuntimeEnvironment) {
  // Get the deployer account
  const { deployer } = await hre.getNamedAccounts();
  const deployerSigner = await ethers.getSigner(deployer);
  console.log("Using deployer account:", deployer);

  // Get the HTEST contract
  const htestToken = HTEST__factory.connect("0x20679F4196f17a56711AD8b04776393e8F2499Ad", deployerSigner);
  
  try {
    // Check if the executing account is the owner
    const isOwner = await htestToken.owner();
    console.log("Contract owner:", isOwner);
    console.log("Executing account:", deployer);
    
    if (isOwner.toLowerCase() !== deployer.toLowerCase()) {
      throw new Error("The executing account is not the contract owner");
    }

    // Address to mint tokens to
    const toAddress = "0xD85A647b27B2Cc988caEd8556c373D1B7e9567C3";

    // Amount to mint (e.g., 1000 tokens with 18 decimals)
    const amount = ethers.parseEther("1000");

    console.log("Minting tokens...");
    const tx = await htestToken.mint(toAddress, amount);
    console.log("Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Failed to get transaction receipt");
    }
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log(`Successfully minted ${ethers.formatEther(amount)} HTEST tokens to ${toAddress}`);
  } catch (error: any) {
    console.error("Detailed error:", {
      message: error.message,
      code: error.code,
      data: error.data,
      reason: error.reason
    });
    throw error;
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  const hre = require("hardhat");
  main(hre)
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
