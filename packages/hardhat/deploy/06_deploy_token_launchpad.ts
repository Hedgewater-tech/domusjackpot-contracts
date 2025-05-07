import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the TokenLaunchpad contract
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployTokenLaunchpad: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("Deploying TokenLaunchpad with account:", deployer);

  // The fee recipient address - you can change this to any address you want to receive platform fees
  // For now, we're using the deployer address as the fee recipient
  const feeRecipient = deployer;

  await deploy("TokenLaunchpad", {
    from: deployer,
    args: [feeRecipient],
    log: true,
    autoMine: true,
  });

  // Get the deployed contract
  const tokenLaunchpad = await hre.ethers.getContract<Contract>("TokenLaunchpad", deployer);
  console.log("TokenLaunchpad deployed to:", await tokenLaunchpad.getAddress());
  console.log("Fee recipient set to:", feeRecipient);
};

export default deployTokenLaunchpad;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags TokenLaunchpad
deployTokenLaunchpad.tags = ["TokenLaunchpad"];
