import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the USDC ERC20 token contract using the deployer account
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployL1Read: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("L1Read", {
    from: deployer,
    // No constructor arguments needed as they are hardcoded in the contract
    args: [],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const l1ReadContract = await hre.ethers.getContract<Contract>("L1Read", deployer);
  console.log("📝 address:", await l1ReadContract.address());
};

export default deployL1Read;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags USDC
deployL1Read.tags = ["L1Read"];
