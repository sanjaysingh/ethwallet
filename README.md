# 🔐 Ethereum Wallet (Testing Only)

A modern, self-contained Ethereum wallet application built for testing and development purposes. This single-page application provides a comprehensive interface for wallet management, transactions, and QR code generation across multiple EVM-compatible networks.

## ⚠️ **Critical Security Warning**

**THIS WALLET IS FOR TESTING AND DEVELOPMENT USE.** It stores private keys in browser memory only and is not a production custody wallet. Do not use it to hold large amounts of cryptocurrency or as a long-term wallet. Prefer small amounts and clear the session when you are done.

## ✨ Key Features

### 🔐 Wallet Management
- **Generate New Wallets** - Create fresh wallets with secure seed phrases
- **Import Existing Wallets** - Support for both private keys and seed phrases
- **Multiple Account Support** - Manage multiple accounts from a single seed phrase
- **Secure Key Display** - Show/hide private keys and seed phrases with copy functionality

### 🌐 Multi-Chain Support
- **Pre-configured Networks** - Ethereum, Polygon, Arbitrum, Optimism, Base, Sepolia, and more
- **Grouped Network Picker** - Networks organized into Testnets, Mainnets, and Custom (default: Base)
- **Custom RPC Support** - Add any EVM-compatible network
- **Automatic Network Detection** - Smart detection of network parameters
- **Native Token Recognition** - Automatic detection of native tokens (ETH, POL, etc.)

### 💸 Transaction Features
- **Native Token Transfers** - Send ETH, POL, and other native tokens
- **Real-time Gas Estimation** - Accurate gas cost calculation with safety buffer
- **Transaction Status** - Live transaction status updates with a block explorer link after send

### 🔒 Self-Contained
- **No CDN Dependencies** - All libraries stored locally
- **Offline Capable** - Works without internet connection (except for blockchain operations)
- **Single File Deployment** - Easy to host and distribute

## 🚀 Quick Start

### Option 1: Direct Usage
1. Download or clone this repository
2. Open `index.html` in any modern web browser
3. Start using the wallet immediately - no installation required

### Option 2: Local Server (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd ethwallet

# Serve locally (choose one method)
python -m http.server 8000        # Python 3
python -m SimpleHTTPServer 8000   # Python 2
npx serve .                       # Node.js
```

Then visit `http://localhost:8000` in your browser.

## 📖 User Guide

### Getting Started

1. **Network Configuration**
   - Select a network from the dropdown (grouped as Testnets, Mainnets, or Custom; default is Base)
   - Or enter a custom RPC endpoint
   - The wallet will automatically detect network parameters

2. **Wallet Setup**
   - **New Wallet**: Click "Generate New Wallet" to create a fresh wallet
   - **Import Wallet**: Enter your seed phrase or private key and click "Import"
   - Your wallet will initialize and display all available accounts

### Using the Wallet

#### Wallet Tab
- View all your account addresses and balances
- Copy addresses to clipboard
- See your current private key or seed phrase (with show/hide toggle)
- Clear wallet session when done

#### Send Tab
- Select the sending address from your accounts
- Enter recipient address and amount
- Review gas costs and confirm transaction
- After sending, open the transaction on the network's block explorer (Etherscan, Basescan, etc.)

#### Receive Tab
- View QR codes for all your addresses
- Easy address copying for sharing
- Perfect for receiving payments

## 🔧 Technical Details

### Architecture
- **Frontend**: Vue.js 3.5.40 with Bootstrap 5.3.3
- **Blockchain**: Ethers.js 6.17.0 for all Ethereum interactions
- **Styling**: Bootstrap 5 with custom CSS for enhanced mobile experience
- **Icons**: Bootstrap Icons 1.11.3 for consistent iconography
- **QR Codes**: qrcode 1.5.4 (soldair/node-qrcode) for address QR generation

### Local Dependencies
All dependencies are bundled locally in the `libs/` directory:
```
libs/
├── bootstrap-5.3.3.min.css           # Bootstrap CSS framework
├── bootstrap-5.3.3.bundle.min.js     # Bootstrap JavaScript
├── bootstrap-icons-1.11.3.min.css    # Bootstrap Icons
├── ethers-6.17.0-ethers.umd.min.js   # Ethereum library
├── vue-3.5.40-vue.global.prod.min.js # Vue.js framework
├── qrcode-1.5.4.min.js               # QR code generation
└── fonts/
    ├── bootstrap-icons.woff2          # Icon fonts
    └── bootstrap-icons.woff
```

### Supported Networks
The wallet includes pre-configured support for the networks below. In the UI they are grouped as Testnets, Mainnets, and Custom. **Base** is the default network.

| Network | Native Token | Chain ID | RPC Endpoint | Group |
|---------|-------------|----------|--------------|-------|
| Sepolia Testnet | ETH | 11155111 | https://1rpc.io/sepolia | Testnet |
| Ethereum | ETH | 1 | https://eth.drpc.org | Mainnet |
| Base (default) | ETH | 8453 | https://mainnet.base.org | Mainnet |
| Optimism | ETH | 10 | https://mainnet.optimism.io | Mainnet |
| Polygon | POL | 137 | https://polygon-rpc.com | Mainnet |
| Arbitrum | ETH | 42161 | https://arb1.arbitrum.io/rpc | Mainnet |
| Robinhood Chain | ETH | 4663 | https://rpc.mainnet.chain.robinhood.com | Mainnet |
| Custom | Various | Various | User-defined | Other |

## 🛠️ Development

### Customization
- **Add Networks**: Edit the `availableNetworks` array in `app.js` (set `isTestnet` for grouping)

## 🔒 Security Considerations

### What This Wallet Does NOT Do
- ❌ Store keys permanently (browser memory only)
- ❌ Send data to external servers
- ❌ Connect to third-party analytics
- ❌ Require user registration or accounts

### What This Wallet DOES Do
- ✅ Generate cryptographically secure random wallets
- ✅ Keep all operations client-side
- ✅ Support industry-standard seed phrases (BIP39)
- ✅ Use established libraries (Ethers.js)
- ✅ Provide clear security warnings

### Best Practices
1. **Treat this as a testing tool** - Prefer small amounts; do not use it for long-term custody
2. **Clear session after use** - Use the "Clear Wallet Session" button
3. **Double-check the network** - Confirm Testnet vs Mainnet before sending
4. **Backup seed phrases** - Store seed phrases securely offline

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**⚠️ FINAL REMINDER: This is a testing and development tool with in-memory keys. It is not a production custody wallet—use carefully and clear your session when finished.**
