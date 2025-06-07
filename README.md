# 🔐 Ethereum Wallet (Testing Only)

A lightweight, browser-based Ethereum wallet designed for testing and development purposes. This single-file application provides a simple interface for wallet management and transaction testing across multiple EVM-compatible chains.

## ⚠️ **Important Security Notice**

**This wallet is intended for TESTING PURPOSES ONLY.** Do not use it with real funds or on production networks. Always use test networks and test tokens when experimenting with this application.

## ✨ Features

- **Multi-Chain Support** - Works with Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, and other EVM chains
- **Wallet Management** - Generate new wallets or import existing ones using private keys or seed phrases
- **Native Token Transfers** - Send ETH, MATIC, BNB, and other native tokens
- **ERC20 Token Support** - Transfer any ERC20 token with automatic balance detection
- **Gas Estimation** - Real-time gas cost calculation with safety buffer
- **Multiple Accounts** - Manage multiple accounts from a single seed phrase
- **Clean UI** - Modern, responsive interface built with Vue.js and Tailwind CSS

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ethwallet
   ```

2. **Open the application**
   - Simply open `index.html` in your web browser
   - No build process or installation required

3. **Configure your wallet**
   - Set an RPC endpoint (e.g., `https://mainnet.base.org` for Base)
   - Generate a new wallet or import an existing private key
   - Initialize the wallet to load your accounts

## 📋 Usage

### Configuration Tab
- **RPC Endpoint**: Set the blockchain network endpoint
- **Seed/Private Key**: Import your wallet credentials
- **Generate New**: Create a fresh wallet for testing

### Accounts Tab
- View all account addresses and their balances
- Automatically detects the native token symbol for each chain

### Transfer Tab
- Select sending address from your accounts
- Choose between native tokens (ETH, MATIC, etc.) or ERC20 tokens
- Enter recipient address and amount
- View estimated gas costs before sending

## 🔧 Dependencies

All dependencies are included in the `libs/` directory:
- **Ethers.js v6.13.5** - Ethereum library for wallet operations
- **Vue.js v3.5.13** - Frontend framework
- **Tailwind CSS v2.2.19** - Styling framework

## 🌐 Supported Networks

The application automatically detects and displays the correct native token symbol for:
- Ethereum (ETH)
- Polygon (MATIC)
- Binance Smart Chain (BNB)
- Avalanche (AVAX)
- Arbitrum (ETH)
- Optimism (ETH)
- Base (ETH)
- zkSync Era (ETH)
- Linea (ETH)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**⚠️ Reminder: This is a testing tool only. Never use it with real funds or on production networks.**
