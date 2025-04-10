import { ethers, upgrades, network } from "hardhat";
import * as dotenv from "dotenv";
import { Contract } from "ethers";

dotenv.config();

async function main() {
  console.log(`Starting BaseJackpot deployment on ${network.name}...`);

  // Get configuration from environment variables
  const entropyAddress = process.env.ENTROPY_ADDRESS;
  const initialOwnerAddress = process.env.INITIAL_OWNER_ADDRESS;
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const ticketPrice = process.env.TICKET_PRICE || "1"; // Default to 1 if not specified

  if (!entropyAddress || !initialOwnerAddress || !tokenAddress) {
    throw new Error("Missing required environment variables for deployment");
  }

  console.log(`Using Entropy address: ${entropyAddress}`);
  console.log(`Using Initial Owner address: ${initialOwnerAddress}`);
  console.log(`Using Token address: ${tokenAddress}`);
  console.log(`Using Ticket Price: ${ticketPrice}`);

  // Get the contract factory
  const BaseJackpot = await ethers.getContractFactory("BaseJackpot");

  // Deploy using the UUPS proxy pattern
  console.log("Deploying BaseJackpot proxy...");
  const baseJackpot = await upgrades.deployProxy(
    BaseJackpot,
    [entropyAddress, initialOwnerAddress, tokenAddress, ticketPrice],
    {
      kind: "uups",
      initializer: "initialize",
    },
  );

  await baseJackpot.deployed();
  console.log(`BaseJackpot proxy deployed to: ${baseJackpot.address}`);

  // Get the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(baseJackpot.address);
  console.log(`Implementation contract address: ${implementationAddress}`);

  // Optional: Set up additional configurations
  console.log("Setting up additional configurations...");

  // Get signer
  const [deployer] = await ethers.getSigners();

  // Enable ticket purchasing
  if (process.env.ENABLE_PURCHASING === "true") {
    console.log("Enabling ticket purchasing...");
    const tx = await baseJackpot.connect(deployer).setAllowPurchasing(true);
    await tx.wait();
    console.log("✅ Ticket purchasing enabled");
  }

  // Set protocol fee address if specified
  if (process.env.PROTOCOL_FEE_ADDRESS) {
    console.log(`Setting protocol fee address to ${process.env.PROTOCOL_FEE_ADDRESS}...`);
    const tx = await baseJackpot.connect(deployer).setProtocolFeeAddress(process.env.PROTOCOL_FEE_ADDRESS);
    await tx.wait();
    console.log("✅ Protocol fee address set");
  }

  // Adjust other parameters if needed
  if (process.env.ROUND_DURATION_SECONDS) {
    console.log(`Setting round duration to ${process.env.ROUND_DURATION_SECONDS} seconds...`);
    const tx = await baseJackpot.connect(deployer).setRoundDurationInSeconds(process.env.ROUND_DURATION_SECONDS);
    await tx.wait();
    console.log("✅ Round duration set");
  }

  if (process.env.FEE_BPS) {
    console.log(`Setting fee BPS to ${process.env.FEE_BPS}...`);
    const tx = await baseJackpot.connect(deployer).setFeeBps(process.env.FEE_BPS);
    await tx.wait();
    console.log("✅ Fee BPS set");
  }

  if (process.env.REFERRAL_FEE_BPS) {
    console.log(`Setting referral fee BPS to ${process.env.REFERRAL_FEE_BPS}...`);
    const tx = await baseJackpot.connect(deployer).setReferralFeeBps(process.env.REFERRAL_FEE_BPS);
    await tx.wait();
    console.log("✅ Referral fee BPS set");
  }

  // Optional: If you want to set up a test LP
  if (
    process.env.SETUP_TEST_LP === "true" &&
    process.env.TEST_LP_ADDRESS &&
    process.env.TEST_LP_AMOUNT &&
    process.env.TEST_LP_RISK_PERCENTAGE
  ) {
    console.log("Setting up test LP...");

    // Get the token contract
    const token = new ethers.Contract(
      tokenAddress,
      ["function approve(address spender, uint256 amount) public returns (bool)"],
      deployer,
    );

    // Approve token spending for the test LP
    const lpAddress = process.env.TEST_LP_ADDRESS;
    const lpAmount = ethers.utils.parseUnits(process.env.TEST_LP_AMOUNT, await token.decimals());
    const lpRiskPercentage = process.env.TEST_LP_RISK_PERCENTAGE;

    // Transfer tokens to the LP address if needed
    // Assume the deployer has enough tokens

    // Set up approval and deposit
    console.log(`Setting up LP deposit for ${lpAddress} with ${lpAmount} tokens and ${lpRiskPercentage}% risk...`);

    // This part would typically be executed by the LP account
    // For testing purposes, you might want to use impersonated accounts with hardhat
    console.log("Note: This part is commented out as it should be executed by the LP account");
    /*
    const lpSigner = await ethers.getImpersonatedSigner(lpAddress);
    await token.connect(lpSigner).approve(baseJackpot.address, lpAmount);
    const lpDepositTx = await baseJackpot.connect(lpSigner).lpDeposit(lpRiskPercentage, lpAmount);
    await lpDepositTx.wait();
    console.log("✅ Test LP set up successfully");
    */
  }

  console.log("\nDeployment and setup completed successfully!");
  console.log("-------------------------------------");
  console.log(`Proxy Contract: ${baseJackpot.address}`);
  console.log(`Implementation Contract: ${implementationAddress}`);
  console.log("-------------------------------------");

  console.log("\nVerify contracts with:");
  console.log(`npx hardhat verify --network ${network.name} ${implementationAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
