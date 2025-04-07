import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the TokenPresale contract using the deployer account
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployTokenPresale: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("TokenPresale", {
    from: deployer,
    args: [], // No constructor arguments needed as they are set after deployment
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const tokenPresaleContract = await hre.ethers.getContract<Contract>("TokenPresale", deployer);
  console.log("✅ TokenPresale contract deployed at:", await tokenPresaleContract.getAddress());

  // Optional: If you want to deploy a test token and set up a presale automatically
  // Uncomment the following code:

  // Get the HTEST token contract
  const htestContract = await hre.ethers.getContract<Contract>("HTEST", deployer);
  const htestAddress = await htestContract.getAddress();

  // Current timestamp
  const currentTimestamp = Math.floor(Date.now() / 1000);

  // Example presale parameters
  const tokenSymbol = "HTEST"; // Token symbol
  const tokenPrice = hre.ethers.parseEther("0.000001"); // 0.000001 ETH per token
  const valuation = hre.ethers.parseEther("10000000"); // $10M valuation (scaled by 1e18)
  const totalAllocation = hre.ethers.parseEther("1000000"); // 1 million tokens (scaled by 1e18)
  const startTime = currentTimestamp + 300; // Starts in 5 minutes
  const endTime = startTime + 864000; // Ends in 10 days
  const minDepositAmount = hre.ethers.parseEther("0.001"); // 0.01 ETH
  const maxDepositAmount = hre.ethers.parseEther("1"); // 1 ETH
  const totalRaiseGoal = hre.ethers.parseEther("10"); // 10 ETH
  const tier1WhitelistEndTime = startTime + 10 * 60; // Tier 1 ends in 10 minutes after start
  const tier2WhitelistEndTime = startTime + 20 * 60; // Tier 2 ends in 20 minutes after start

  try {
    // Create a presale
    const tx = await tokenPresaleContract.createPresale(
      htestAddress,
      tokenSymbol,
      tokenPrice,
      valuation,
      totalAllocation,
      startTime,
      endTime,
      minDepositAmount,
      maxDepositAmount,
      totalRaiseGoal,
      tier1WhitelistEndTime,
      tier2WhitelistEndTime,
    );

    await tx.wait();
    console.log("✅ Example presale created with ID: 1");
  } catch (error) {
    console.error("Error creating presale:", error);
  }

  // Mint tokens to the TokenPresale contract for distribution
  const tokensToMint = hre.ethers.parseEther("100000"); // 100,000 tokens
  const tokenPresaleAddress = await tokenPresaleContract.getAddress();
  await htestContract.mint(tokenPresaleAddress, tokensToMint);
  console.log(`✅ Minted ${tokensToMint.toString()} tokens to TokenPresale contract`);
};

export default deployTokenPresale;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags TokenPresale
deployTokenPresale.tags = ["TokenPresale"];
