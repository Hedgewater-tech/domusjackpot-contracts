import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Configuration
// rpc : https://rpc.hyperliquid.xyz/evm
// arb-sepolia: https://sepolia-rollup.arbitrum.io/rpc
export const RPC_URL = "https://rpc.hyperliquid.xyz/evm";
// latest deployed contract : 0x0882AAb223456cA1649d3eC89e9d1D82678F178F
// prev mainnet contract : 0x7d4d84152aAcEAE2c5347A13d652e83528caa586
// arb sepolia testnet : 0x657952eaA63c7Ca1Ab0555B482D6cD65020a5908

export const CONTRACT_ADDRESS = "0x0882AAb223456cA1649d3eC89e9d1D82678F178F";

// hype evm mainnet : 0x02c6a2fA58cC01A18B8D9E00eA48d65E4dF26c70
// arb sepolia testnet : 0x20679F4196f17a56711AD8b04776393e8F2499Ad
export const USDC_ADDRESS = "0x02c6a2fA58cC01A18B8D9E00eA48d65E4dF26c70";
// Use the private key from .env or fallback to the hardcoded one for testing
export const PRIVATE_KEY = process.env.PRIVATE_KEY;

// address:private_key
export const TEST_USERS = [
  "0xaB6010C3F2F8BBd51416285c39ce819B54acC225",
  "0x730C39D9E410cbE70730b47D75f71ddabfb810F8",
  "0x7d6BD04B12cEB77C736DE98715dBcb7f813C2638",
  "0x2Cf7AA867956Ef0F158896bB88f153e92bD0E17a",
  "0x0A7c7E31D92acd682f3c67E391f15F21ca11C825",
];

export const TEST_USER_PRIVATE_KEYS = [
  "65ab44cb548f90c08dc8a1cbb41538b9d7586ac188a533764789b421346b93f9",
  "fc7174d4f5bf8e286dd5687bdc016e040ea989a5e7be3934074bf7d268f462e4",
  "df48344a542dbad9515d3f78332fcb863ffbb6d4fc120759c38da964a2747ce2",
  "4a9ac44214459794213aab39c9a5ea6f8021efd812edd802fe5ab29d93daf4c1",
  "c855c797046685c98a73f79842045bd317a94746950e347785f5c6c756af93a0",
];
