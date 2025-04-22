import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploys the DomusJackpot contract using the deployer account
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployDomusJackpot: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, ethers, upgrades, deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Starting DomusJackpot deployment...");

  // Get configuration from environment variables
  // 0x549Ebba8036Ab746611B4fFA1423eb0A4Df61440   Entropy hyperliquid mainnet
  // 0xfA25E653b44586dBbe27eE9d252192F0e4956683   Entropy arbitrum sepolia

  const entropyAddress = "0xfA25E653b44586dBbe27eE9d252192F0e4956683"; //process.env.ENTROPY_ADDRESS;
  const initialOwnerAddress = process.env.INITIAL_OWNER_ADDRESS || deployer;

  // 0x02c6a2fA58cC01A18B8D9E00eA48d65E4dF26c70  FeUSD hyperliquid mainnet
  // 0x20679F4196f17a56711AD8b04776393e8F2499Ad   USDC arbitrum sepolia
  const tokenAddress = "0x02c6a2fA58cC01A18B8D9E00eA48d65E4dF26c70"; //process.env.TOKEN_ADDRESS;
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
  await deploy("DomusJackpot", {
    from: deployer,
    args: [], // No constructor arguments
    log: true,
  });

  // Deploy the proxy contract
  console.log("Deploying ERC1967Proxy...");

  const DomusJackpotFactory = await ethers.getContractFactory("DomusJackpot", {
    signer: await ethers.getSigner(deployer),
  });

  console.log("Deploying DomusJackpot...");

  const proxy = await upgrades.deployProxy(
    DomusJackpotFactory,
    [entropyAddress, initialOwnerAddress, tokenAddress, ticketPrice],
    {
      kind: "uups",
      initializer: "initialize",
      timeout: 120000,
    },
  );

  // await proxy.deploymentTransaction()
  const proxyAddress = await proxy.getAddress();
  console.log(`DomusJackpot proxy deployed to: ${proxyAddress}`);

  // Get the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`DomusJackpot implementation deployed at: ${implementationAddress}`);

  console.log("Deployment completed successfully!");

  // Log verification instructions
  // console.log("\nVerify implementation contract with:");
  // console.log(`npx hardhat verify --network ${hre.network.name} ${implementationAddress}`);
  // console.log("\nVerify proxy contract with:");
  // console.log(`npx hardhat verify --network ${hre.network.name} ${proxyAddress}`);
};

export default deployDomusJackpot;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags BaseJackpot
deployDomusJackpot.tags = ["DomusJackpot"];
