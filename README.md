# 🏗 Scaffold-ETH 2

<h4 align="center">
  <a href="https://docs.scaffoldeth.io">Documentation</a> |
  <a href="https://scaffoldeth.io">Website</a>
</h4>

🧪 An open-source, up-to-date toolkit for building decentralized applications (dapps) on the Ethereum blockchain. It's designed to make it easier for developers to create and deploy smart contracts and build user interfaces that interact with those contracts.

⚙️ Built using NextJS, RainbowKit, Hardhat, Wagmi, Viem, and Typescript.

- ✅ **Contract Hot Reload**: Your frontend auto-adapts to your smart contract as you edit it.
- 🪝 **[Custom hooks](https://docs.scaffoldeth.io/hooks/)**: Collection of React hooks wrapper around [wagmi](https://wagmi.sh/) to simplify interactions with smart contracts with typescript autocompletion.
- 🧱 [**Components**](https://docs.scaffoldeth.io/components/): Collection of common web3 components to quickly build your frontend.
- 🔥 **Burner Wallet & Local Faucet**: Quickly test your application with a burner wallet and local faucet.
- 🔐 **Integration with Wallet Providers**: Connect to different wallet providers and interact with the Ethereum network.

![Debug Contracts tab](https://github.com/scaffold-eth/scaffold-eth-2/assets/55535804/b237af0c-5027-4849-a5c1-2e31495cccb1)

## Requirements

Before you begin, you need to install the following tools:

- [Node (>= v20.18.3)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

## Quickstart

To get started with Scaffold-ETH 2, follow the steps below:

1. Install dependencies if it was skipped in CLI:

```
cd my-dapp-example
yarn install
```

2. Run a local network in the first terminal:

```
yarn chain
```

This command starts a local Ethereum network using Hardhat. The network runs on your local machine and can be used for testing and development. You can customize the network configuration in `packages/hardhat/hardhat.config.ts`.

3. On a second terminal, deploy the test contract:

```
yarn deploy
```

This command deploys a test smart contract to the local network. The contract is located in `packages/hardhat/contracts` and can be modified to suit your needs. The `yarn deploy` command uses the deploy script located in `packages/hardhat/deploy` to deploy the contract to the network. You can also customize the deploy script.

4. On a third terminal, start your NextJS app:

```
yarn start
```

Visit your app on: `http://localhost:3000`. You can interact with your smart contract using the `Debug Contracts` page. You can tweak the app config in `packages/nextjs/scaffold.config.ts`.

Run smart contract test with `yarn hardhat:test`

- Edit your smart contracts in `packages/hardhat/contracts`
- Edit your frontend homepage at `packages/nextjs/app/page.tsx`. For guidance on [routing](https://nextjs.org/docs/app/building-your-application/routing/defining-routes) and configuring [pages/layouts](https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts) checkout the Next.js documentation.
- Edit your deployment scripts in `packages/hardhat/deploy`


## Documentation

Visit our [docs](https://docs.scaffoldeth.io) to learn how to start building with Scaffold-ETH 2.

To know more about its features, check out our [website](https://scaffoldeth.io).

## Contributing to Scaffold-ETH 2

We welcome contributions to Scaffold-ETH 2!

Please see [CONTRIBUTING.MD](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/CONTRIBUTING.md) for more information and guidelines for contributing to Scaffold-ETH 2.

## 🚀 TokenPresale Smart Contract

The TokenPresale contract is a flexible and secure solution for conducting token presales with tiered whitelisting and configurable parameters.

### Features

- **Multiple Presale Management**: Create and manage multiple presales with different tokens and parameters
- **Time-Based Controls**: Configure start and end times for presales
- **Tiered Whitelisting**: Two-tier whitelisting system with configurable periods
  - Tier 1: Priority access during the initial phase
  - Tier 2: Secondary access after Tier 1 period ends
  - Public: Open to everyone after the whitelisting periods
- **Deposit Limits**: Set minimum and maximum deposit amounts per user
- **Total Raise Goal**: Cap the total amount of ETH that can be raised
- **Project Valuation**: Track the project's valuation in USD
- **Token Allocation**: Specify the total number of tokens allocated for the presale
- **Token Distribution**: Users can withdraw tokens after the presale ends
- **Fund Management**: Owner can withdraw funds after the presale ends
- **Safety Features**: 
  - Reentrancy protection
  - Owner-only administrative functions
  - ERC20 token recovery for accidental transfers

### Contract Structure

```solidity
struct Presale {
    uint256 presaleId;
    address tokenAddress;
    string tokenSymbol;        // Symbol of the token being sold
    uint256 tokenPrice;        // Price in ETH per token (in wei)
    uint256 valuation;         // Project valuation in USD (scaled by 1e18)
    uint256 totalAllocation;   // Total token allocation for the presale
    uint256 startTime;
    uint256 endTime;
    uint256 minDepositAmount;  // Minimum ETH deposit per user
    uint256 maxDepositAmount;  // Maximum ETH deposit per user
    uint256 totalRaiseGoal;    // Total ETH to raise
    uint256 totalRaised;       // Total ETH raised so far
    uint256 tier1WhitelistEndTime; // When tier 1 whitelist period ends
    uint256 tier2WhitelistEndTime; // When tier 2 whitelist period ends
    bool isActive;             // Whether the presale is active
}
```

### Key Functions

#### For Administrators

- `createPresale`: Create a new presale with configurable parameters
- `addToTier1Whitelist`: Add users to the tier 1 whitelist with specified allocation
- `addToTier2Whitelist`: Add users to the tier 2 whitelist with specified allocation
- `setPresaleStatus`: Enable or disable a presale
- `withdrawFunds`: Withdraw raised ETH after the presale ends
- `recoverERC20`: Recover ERC20 tokens sent to the contract by mistake

#### For Users

- `deposit`: Participate in a presale by depositing ETH
- `withdrawTokens`: Withdraw tokens after the presale ends
- `getUserWhitelistStatus`: Check whitelist status and allocation
- `calculateTokenAmount`: Calculate tokens to receive for a given ETH amount

### Events

- `PresaleCreated`: Emitted when a new presale is created
- `Deposit`: Emitted when a user deposits ETH
- `WhitelistUpdated`: Emitted when a user is added to a whitelist
- `PresaleUpdated`: Emitted when a presale's status is updated
- `TokensWithdrawn`: Emitted when a user withdraws tokens
- `FundsWithdrawn`: Emitted when the owner withdraws funds

### Deployment

The TokenPresale contract can be deployed using the provided deployment script:

```bash
yarn hardhat:deploy
```

This will deploy the TokenPresale contract and set up a test presale with the HTEST token if specified.

### Testing

A comprehensive test suite is available to verify the functionality of the TokenPresale contract:

```bash
yarn hardhat:test test/TokenPresale.ts
```

The tests cover all aspects of the contract, including:
- Deployment and setup
- Whitelisting functionality
- Deposit mechanisms and restrictions
- Token withdrawal processes
- Fund withdrawal for the owner
- Admin functions for managing the presale

### Security Considerations

- The contract uses OpenZeppelin's ReentrancyGuard to prevent reentrancy attacks
- Administrative functions are protected with the Ownable modifier
- Time-based validations ensure operations occur in the correct sequence
- Deposit limits protect against excessive contributions
- Whitelist validations ensure only authorized users can participate during restricted periods

### Compiler Settings

The contract requires the IR-based code generation due to its complexity:

```javascript
// In hardhat.config.ts
solidity: {
  compilers: [
    {
      version: "0.8.20",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        viaIR: true, // Required for this contract
      },
    },
  ],
}