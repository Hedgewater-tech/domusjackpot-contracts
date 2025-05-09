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


## 🎰 DomusJackpot Smart Contract

The DomusJackpot contract is a sophisticated jackpot system with liquidity provider (LP) functionality that allows users to participate in regular jackpot rounds.

### Operational Flow

#### 1. Contract Initialization

- The contract is initialized with key parameters:
  - Owner address
  - Entropy provider address (for randomness)
  - Token address (ERC20 token used for tickets)
  - Ticket price

#### 2. Round Preparation

- LPs deposit tokens with a specified risk percentage
  - LPs provide liquidity to the jackpot pool
  - Risk percentage determines their exposure to potential losses
- Users purchase tickets using the specified ERC20 token
  - Users can purchase tickets with or without referrals
  - Referrals receive a percentage of the ticket price as a fee

#### 3. Jackpot Execution

- The jackpot can be executed once per round (default: 24 hours)
- Execution requirements:
  - Current time must be ≥ lastJackpotEndTime + roundDurationInSeconds
  - The jackpotLock must be false (no jackpot currently running)
  - Sufficient ETH must be provided to cover the entropy fee
- Execution process:
  1. The jackpotLock is set to true to prevent concurrent executions
  2. A random number is requested from the entropy provider
  3. When the random number is received, a winner is selected
  4. Prizes are distributed to the winner
  5. Fees are allocated to the protocol and referrers
  6. The jackpot is reset for the next round

#### 4. Prize Distribution

- The winner receives a portion of the jackpot pool
- LP providers receive returns based on their risk percentage
- Protocol fees are collected
- Referral fees are distributed to referrers

## 🎰 DomusJackpot Smart Contract

The DomusJackpot contract is an innovative jackpot system with Liquidity Provider (LP) functionality that creates an engaging and sustainable prize mechanism for users.

### Key Features

- **Decentralized Randomness**: Uses Entropy protocol for verifiable and secure random number generation
- **Liquidity Provider System**: Allows LPs to participate with configurable risk percentages
- **Ticket Purchase Mechanism**: Users can buy tickets to participate in jackpot rounds
- **Referral System**: Incentivizes user acquisition through referral rewards
- **Automated Jackpot Execution**: Scheduled jackpot rounds with configurable duration
- **Fee Distribution**: Transparent fee structure with allocation to LPs, referrers, and protocol
- **Upgradeable Design**: Implements UUPS proxy pattern for future upgrades
- **Configurable Parameters**: Admin controls for ticket price, round duration, fee percentages, etc.
- **Safety Mechanisms**: Includes locks, limits, and emergency functions

### Contract Structure

The DomusJackpot contract manages two main participant types:

1. **Users**: Purchase tickets to participate in jackpot rounds
   ```solidity
   struct User {
       uint256 ticketsPurchasedTotalBps; // Tickets purchased for current round (basis points)
       uint256 winningsClaimable;        // Amount of tokens user can withdraw
       bool active;                      // Whether user is participating in current round
   }
   ```

2. **Liquidity Providers (LPs)**: Deposit tokens and set risk percentages
   ```solidity
   struct LP {
       uint256 principal;      // Amount deposited by LP
       uint256 stake;          // Amount staked in current jackpot round
       uint256 riskPercentage; // From 0 to 100
       bool active;            // Whether LP has principal in contract
   }
   ```

### Jackpot Operation Flow

#### 1. Initialization and Setup

- Contract is deployed with initial parameters (ticket price, round duration, fee percentages)
- Token address is set for the jackpot system (ERC20 token used for tickets and rewards)
- Owner configures limits for LPs and users

#### 2. LP Participation

- LPs deposit tokens using `lpDeposit(riskPercentage, value)`
- LPs set their risk percentage (1-100%) determining exposure to jackpot outcomes
- LP deposits are tracked in the `lpsInfo` mapping and `activeLpAddresses` array
- LPs can adjust risk percentage with `lpAdjustRiskPercentage(riskPercentage)`
- LPs can withdraw their principal with `withdrawAllLP()` when not staked

#### 3. User Ticket Purchases

- Users purchase tickets with `purchaseTickets(referrer, value, recipient)`
- Ticket purchases are tracked in `usersInfo` mapping and `activeUserAddresses` array
- Fees are calculated and distributed:
  - Referral fees go to referrers
  - LP fees accumulate for distribution to LPs
  - Remaining amount goes to user pool

#### 4. Jackpot Execution

1. **Initiation**: Anyone can trigger jackpot after round duration with `runJackpot(userRandomNumber)`
2. **Random Number Generation**: Contract requests randomness from Entropy protocol
3. **Entropy Callback**: When randomness is received, `entropyCallback()` processes the jackpot:
   - `stakeLps()`: Moves LP funds from principal to stake based on risk percentage
   - `distributeLpFeesToLps()`: Distributes accumulated fees to LPs
   - `determineWinnerAndAdjustStakes()`: Selects winner and allocates prizes

#### 5. Winner Determination Logic

The contract has three possible outcomes:

1. **User Pool ≥ LP Pool**: 
   - Winner gets entire user pool
   - LPs get their stake back

2. **User Pool < LP Pool and User Wins**:
   - Winner gets entire LP pool
   - LPs get user pool distributed proportionally to their stakes

3. **User Pool < LP Pool and LP Wins**:
   - LPs get both user pool and LP pool
   - No user winner

#### 6. Post-Jackpot Actions

- Winner can claim rewards with `withdrawWinnings()`
- Referrers can claim fees with `withdrawReferralFees()`
- New round begins automatically with:
  - User tickets reset
  - New LP stakes calculated based on risk percentages
  - Pool totals reset

### Administrative Controls

- **Ticket Price**: Configurable with `setTicketPrice()`
- **Round Duration**: Adjustable with `setRoundDurationInSeconds()`
- **Fee Structure**: Configurable with `setFeeBps()` and `setReferralFeeBps()`
- **LP Pool Cap**: Set with `setLpPoolCap()`
- **Protocol Fee**: Managed with `setProtocolFeeAddress()` and `setProtocolFeeThreshold()`
- **Emergency Controls**: Include `forceReleaseJackpotLock()` for recovery

### Automation

The jackpot system can be automated using:
- GitHub Actions workflow for scheduled execution
- Configurable parameters for different networks
- Script-based interaction for jackpot execution and information retrieval

### Security Features

- Entropy protocol for verifiable randomness
- Jackpot and entropy callback locks to prevent duplicate execution
- Withdrawal pattern to prevent reentrancy attacks
- Principal/stake separation for LP risk management
- Fallback winner mechanism

### Events

The contract emits events for all major actions:
- `UserTicketPurchase`: When tickets are purchased
- `JackpotRunRequested`: When jackpot execution is initiated
- `JackpotRun`: When jackpot completes with winner information
- `EntropyResult`: When random number is received
- `LpDeposit`, `LpRebalance`, `LpRiskPercentageAdjustment`: For LP actions
- Various withdrawal events for tracking fund movements

#### 5. Automation

- The jackpot execution is automated through a GitHub Actions workflow
- The workflow can be triggered:
  - Automatically on a daily schedule
  - Manually through the GitHub UI with configurable parameters
- The automation ensures timely execution of jackpot rounds without manual intervention

### Key Functions

#### For Users

- `purchaseTickets`: Buy tickets for the current jackpot round
- `getTicketPrice`: Get the current ticket price
- `getUserInfo`: Get information about a user's tickets and winnings

#### For Liquidity Providers

- `lpDeposit`: Deposit tokens as a liquidity provider with a specified risk percentage
- `lpWithdraw`: Withdraw LP tokens and accrued fees
- `getLPInfo`: Get information about an LP's deposits and earnings

#### For Jackpot Operations

- `runJackpot`: Execute the jackpot process and select a winner
- `getJackpotInfo`: Get comprehensive information about the current jackpot state
- `getJackpotStatus`: Check if the jackpot is currently running and when the next round is available

### Automation Tools

The project includes scripts and GitHub Actions workflows for automated jackpot operations:

- `interact_jackpot.ts`: Script for interacting with the DomusJackpot contract
  - Commands for purchasing tickets, depositing LP, and running the jackpot
  - Functions for retrieving jackpot information and status
- `cron-job.yml`: GitHub Actions workflow for automated jackpot execution
  - Scheduled daily execution
  - Manual triggering with configurable parameters
  - Network selection for different environments

### Security Considerations

- The contract uses a trusted entropy source for randomness
- Timelock mechanisms prevent premature jackpot executions
- The jackpotLock prevents concurrent executions
- Fee calculations ensure fair distribution of prizes and incentives
