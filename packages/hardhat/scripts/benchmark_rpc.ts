// packages/hardhat/scripts/benchmark_rpc.ts
// Script to benchmark HTTP and WebSocket RPC connections
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
import { performance } from "perf_hooks";
// import { WebSocket } from "ws";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Configuration
interface RPCEndpoint {
  name: string;
  httpUrl: string;
  wsUrl: string;
}

// Add your RPC endpoints to test here
const RPC_ENDPOINTS: RPCEndpoint[] = [
  {
    name: "Base Mainnet",
    httpUrl: "https://special-wild-dawn.base-mainnet.quiknode.pro/5d7df5424b44cab6a0dd7cf999f6aede0968c91f/",
    wsUrl: "wss://special-wild-dawn.base-mainnet.quiknode.pro/5d7df5424b44cab6a0dd7cf999f6aede0968c91f/",
  },
  // Add more endpoints as needed
];

// Test parameters
const NUM_REQUESTS = 10; // Number of requests to make for each test
// const BLOCK_RANGE = 10; // Number of blocks to fetch for block tests
const BATCH_SIZE = 5; // Number of concurrent requests for batch tests

// Utility to measure execution time
async function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, time: end - start };
}

// HTTP RPC Tests
async function runHttpTests(endpoint: RPCEndpoint) {
  console.log(`\n=== Running HTTP tests for ${endpoint.name} ===`);

  try {
    // Create HTTP provider
    const provider = new ethers.JsonRpcProvider(endpoint.httpUrl);

    // Test 1: Get latest block number
    console.log("\nTest 1: Get latest block number");
    let totalTime = 0;
    let latestBlockNumber = 0;

    for (let i = 0; i < NUM_REQUESTS; i++) {
      const { result, time } = await measureExecutionTime(async () => {
        return await provider.getBlockNumber();
      });

      totalTime += time;
      latestBlockNumber = result;
      console.log(`Request ${i + 1}: Block #${result} - ${time.toFixed(2)}ms`);
    }

    console.log(`Average time: ${(totalTime / NUM_REQUESTS).toFixed(2)}ms`);

    // Test 2: Get block details
    console.log("\nTest 2: Get block details");
    totalTime = 0;

    for (let i = 0; i < NUM_REQUESTS; i++) {
      const blockNumber = latestBlockNumber - i;

      const { time } = await measureExecutionTime(async () => {
        return await provider.getBlock(blockNumber);
      });

      totalTime += time;
      console.log(`Request ${i + 1}: Block #${blockNumber} - ${time.toFixed(2)}ms`);
    }

    console.log(`Average time: ${(totalTime / NUM_REQUESTS).toFixed(2)}ms`);

    // Test 3: Get gas price
    console.log("\nTest 3: Get gas price");
    totalTime = 0;

    for (let i = 0; i < NUM_REQUESTS; i++) {
      const { result, time } = await measureExecutionTime(async () => {
        return await provider.getFeeData();
      });

      totalTime += time;
      console.log(
        `Request ${i + 1}: Gas price ${ethers.formatUnits(result.gasPrice || 0, "gwei")} gwei - ${time.toFixed(2)}ms`,
      );
    }

    console.log(`Average time: ${(totalTime / NUM_REQUESTS).toFixed(2)}ms`);

    // Test 4: Batch get multiple blocks
    console.log("\nTest 4: Batch get multiple blocks");

    const { time } = await measureExecutionTime(async () => {
      const promises = [];

      for (let i = 0; i < BATCH_SIZE; i++) {
        const blockNumber = latestBlockNumber - i;
        promises.push(provider.getBlock(blockNumber));
      }

      return await Promise.all(promises);
    });

    console.log(`Batch request for ${BATCH_SIZE} blocks: ${time.toFixed(2)}ms`);
    console.log(`Average time per block: ${(time / BATCH_SIZE).toFixed(2)}ms`);

    return {
      endpoint: endpoint.name,
      protocol: "HTTP",
      success: true,
    };
  } catch (error) {
    console.error(`Error running HTTP tests for ${endpoint.name}:`, error);
    return {
      endpoint: endpoint.name,
      protocol: "HTTP",
      success: false,
      error: String(error),
    };
  }
}

// WebSocket RPC Tests
async function runWsTests(endpoint: RPCEndpoint) {
  console.log(`\n=== Running WebSocket tests for ${endpoint.name} ===`);

  try {
    // Create WebSocket provider
    const provider = new ethers.WebSocketProvider(endpoint.wsUrl);

    // Test 1: Get latest block number
    console.log("\nTest 1: Get latest block number");
    let totalTime = 0;
    let latestBlockNumber = 0;

    for (let i = 0; i < NUM_REQUESTS; i++) {
      const { result, time } = await measureExecutionTime(async () => {
        return await provider.getBlockNumber();
      });

      totalTime += time;
      latestBlockNumber = result;
      console.log(`Request ${i + 1}: Block #${result} - ${time.toFixed(2)}ms`);
    }

    console.log(`Average time: ${(totalTime / NUM_REQUESTS).toFixed(2)}ms`);

    // Test 2: Get block details
    console.log("\nTest 2: Get block details");
    totalTime = 0;

    for (let i = 0; i < NUM_REQUESTS; i++) {
      const blockNumber = latestBlockNumber - i;

      const { time } = await measureExecutionTime(async () => {
        return await provider.getBlock(blockNumber);
      });

      totalTime += time;
      console.log(`Request ${i + 1}: Block #${blockNumber} - ${time.toFixed(2)}ms`);
    }

    console.log(`Average time: ${(totalTime / NUM_REQUESTS).toFixed(2)}ms`);

    // Test 3: Get gas price
    console.log("\nTest 3: Get gas price");
    totalTime = 0;

    for (let i = 0; i < NUM_REQUESTS; i++) {
      const { result, time } = await measureExecutionTime(async () => {
        return await provider.getFeeData();
      });

      totalTime += time;
      console.log(
        `Request ${i + 1}: Gas price ${ethers.formatUnits(result.gasPrice || 0, "gwei")} gwei - ${time.toFixed(2)}ms`,
      );
    }

    console.log(`Average time: ${(totalTime / NUM_REQUESTS).toFixed(2)}ms`);

    // Test 4: Batch get multiple blocks
    console.log("\nTest 4: Batch get multiple blocks");

    const { time } = await measureExecutionTime(async () => {
      const promises = [];

      for (let i = 0; i < BATCH_SIZE; i++) {
        const blockNumber = latestBlockNumber - i;
        promises.push(provider.getBlock(blockNumber));
      }

      return await Promise.all(promises);
    });

    console.log(`Batch request for ${BATCH_SIZE} blocks: ${time.toFixed(2)}ms`);
    console.log(`Average time per block: ${(time / BATCH_SIZE).toFixed(2)}ms`);

    // Test 5: Subscribe to new blocks (WebSocket specific)
    console.log("\nTest 5: Subscribe to new blocks (WebSocket specific)");

    let blockCount = 0;
    const maxBlocks = 3;

    const { time: subscriptionTime } = await measureExecutionTime(async () => {
      return new Promise<void>(resolve => {
        const startTime = performance.now();

        provider.on("block", blockNumber => {
          const currentTime = performance.now();
          const elapsed = currentTime - startTime;

          blockCount++;
          console.log(`New block received: #${blockNumber} - ${elapsed.toFixed(2)}ms since start`);

          if (blockCount >= maxBlocks) {
            provider.removeAllListeners("block");
            resolve();
          }
        });

        // Set a timeout in case we don't receive enough blocks
        setTimeout(() => {
          if (blockCount < maxBlocks) {
            console.log(`Only received ${blockCount} blocks within timeout period`);
            provider.removeAllListeners("block");
            resolve();
          }
        }, 60000); // 1 minute timeout
      });
    });

    if (blockCount > 0) {
      console.log(`Received ${blockCount} blocks in ${subscriptionTime.toFixed(2)}ms`);
      console.log(`Average time per block: ${(subscriptionTime / blockCount).toFixed(2)}ms`);
    } else {
      console.log("No blocks received during the test period");
    }

    // Close the WebSocket connection
    await provider.destroy();

    return {
      endpoint: endpoint.name,
      protocol: "WebSocket",
      success: true,
    };
  } catch (error) {
    console.error(`Error running WebSocket tests for ${endpoint.name}:`, error);
    return {
      endpoint: endpoint.name,
      protocol: "WebSocket",
      success: false,
      error: String(error),
    };
  }
}

// Run all tests
async function runAllTests() {
  console.log("=== RPC Benchmark Tool ===");
  console.log(`Testing ${RPC_ENDPOINTS.length} endpoints with ${NUM_REQUESTS} requests each\n`);

  const results = [];

  for (const endpoint of RPC_ENDPOINTS) {
    console.log(`\n==================================================`);
    console.log(`Testing endpoint: ${endpoint.name}`);
    console.log(`HTTP URL: ${endpoint.httpUrl}`);
    console.log(`WS URL: ${endpoint.wsUrl}`);
    console.log(`==================================================`);

    // Run HTTP tests
    const httpResult = await runHttpTests(endpoint);
    results.push(httpResult);

    // Run WebSocket tests
    const wsResult = await runWsTests(endpoint);
    results.push(wsResult);
  }

  // Print summary
  console.log("\n\n=== Benchmark Summary ===");
  console.log("Endpoint\t\tProtocol\tStatus");
  console.log("--------------------------------------------------");

  for (const result of results) {
    const status = result.success ? "✅ Success" : "❌ Failed";
    console.log(`${result.endpoint}\t\t${result.protocol}\t\t${status}`);
  }
}

// Run the benchmark
runAllTests().catch(error => {
  console.error("Benchmark failed:", error);
  process.exit(1);
});
