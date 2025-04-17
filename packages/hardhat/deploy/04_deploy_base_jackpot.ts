import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploys the BaseJackpot contract using the deployer account
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployBaseJackpot: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, ethers, upgrades, deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Starting BaseJackpot deployment...");

  // Get configuration from environment variables
  const entropyAddress = "0x549Ebba8036Ab746611B4fFA1423eb0A4Df61440"; //process.env.ENTROPY_ADDRESS;
  const initialOwnerAddress = process.env.INITIAL_OWNER_ADDRESS || deployer;

  // 0x02c6a2fA58cC01A18B8D9E00eA48d65E4dF26c70  FeUSD hyperliquid mainnet
  const tokenAddress = "0x20679F4196f17a56711AD8b04776393e8F2499Ad"; //process.env.TOKEN_ADDRESS;
  const ticketPrice = process.env.TICKET_PRICE || "1"; // Default to 1 if not specified

  if (!entropyAddress || !tokenAddress) {
    throw new Error("Missing required environment variables for deployment: ENTROPY_ADDRESS or TOKEN_ADDRESS");
  }

  console.log(`Using Entropy address: ${entropyAddress}`);
  console.log(`Using Initial Owner address: ${initialOwnerAddress}`);
  console.log(`Using Token address: ${tokenAddress}`);
  console.log(`Using Ticket Price: ${ticketPrice}`);

  // Deploy the implementation contract
  // this is done to generate deployment log for verification purpose
  await deploy("BaseJackpot", {
    from: deployer,
    args: [], // No constructor arguments
    log: true,
  });

  // Deploy the proxy contract
  console.log("Deploying ERC1967Proxy...");

  const BaseJackpotFactory = await ethers.getContractFactory("BaseJackpot", {
    signer: await ethers.getSigner(deployer),
  });

  console.log("Deploying BaseJackpot...");

  const proxy = await upgrades.deployProxy(
    BaseJackpotFactory,
    [entropyAddress, initialOwnerAddress, tokenAddress, ticketPrice],
    {
      kind: "uups",
      initializer: "initialize",
    },
  );

  // await proxy.deploymentTransaction()
  const proxyAddress = await proxy.getAddress();
  console.log(`BaseJackpot proxy deployed to: ${proxyAddress}`);

  // Get the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`BaseJackpot implementation deployed at: ${implementationAddress}`);

  console.log("Deployment completed successfully!");

  // Log verification instructions
  // console.log("\nVerify implementation contract with:");
  // console.log(`npx hardhat verify --network ${hre.network.name} ${implementationAddress}`);
  // console.log("\nVerify proxy contract with:");
  // console.log(`npx hardhat verify --network ${hre.network.name} ${proxyAddress}`);
};

export default deployBaseJackpot;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags BaseJackpot
deployBaseJackpot.tags = ["BaseJackpot"];
