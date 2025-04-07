import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the HTEST ERC20 token contract using the deployer account
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployHTest: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("HTEST", {
    from: deployer,
    // No constructor arguments needed as they are hardcoded in the contract
    args: [],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const htestContract = await hre.ethers.getContract<Contract>("HTEST", deployer);
  console.log("�token Name:", await htestContract.name());
  console.log("📝 Symbol:", await htestContract.symbol());
  console.log("🔢 Decimals:", await htestContract.decimals());
  // Mint tokens to deployer
  const amount = hre.ethers.parseEther("10000000");
  console.log("Minting tokens to deployer...");
  const tx = await htestContract.mint(deployer, amount);
  await tx.wait();
  console.log(`Successfully minted ${hre.ethers.formatEther(amount)} HTEST tokens to ${deployer}`);
};

export default deployHTest;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags HTEST
deployHTest.tags = ["HTEST"];
