# 🔐 Ethereum Wallet (Testing Only)

A modern, self-contained Ethereum wallet application built for testing and development purposes. This single-page application provides a comprehensive interface for wallet management, transactions, and QR code generation across multiple EVM-compatible networks.

## ⚠️ **Critical Security Warning**

**THIS WALLET IS FOR TESTING PURPOSES ONLY.** Never use it with real funds or on mainnet. Always use testnets and test tokens. This application stores private keys in browser memory and should never be used for production or real cryptocurrency transactions.

## ✨ Key Features

### 🔐 Wallet Management
- **Generate New Wallets** - Create fresh wallets with secure seed phrases
- **Import Existing Wallets** - Support for both private keys and seed phrases
- **Multiple Account Support** - Manage multiple accounts from a single seed phrase
- **Secure Key Display** - Show/hide private keys and seed phrases with copy functionality

### 🌐 Multi-Chain Support
- **Pre-configured Networks** - Ethereum, Polygon,  Arbitrum, Optimism, Base, and more
- **Custom RPC Support** - Add any EVM-compatible network
- **Automatic Network Detection** - Smart detection of network parameters
- **Native Token Recognition** - Automatic detection of native tokens (ETH, MATIC, etc.)

### 💸 Transaction Features
- **Native Token Transfers** - Send ETH, MATIC, and other native tokens
- **Real-time Gas Estimation** - Accurate gas cost calculation with safety buffer
- **Transaction Status** - Live transaction status updates

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
   - Select a network from the dropdown (Ethereum, Polygon, etc.)
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

#### Receive Tab
- View QR codes for all your addresses
- Easy address copying for sharing
- Perfect for receiving payments

## 🔧 Technical Details

### Architecture
- **Frontend**: Vue.js 3.5.13 with Bootstrap 5.3.3
- **Blockchain**: Ethers.js 6.13.5 for all Ethereum interactions
- **Styling**: Bootstrap 5 with custom CSS for enhanced mobile experience
- **Icons**: Bootstrap Icons 1.11.3 for consistent iconography
- **QR Codes**: QRCode.js 1.0.0 for address QR generation

### Local Dependencies
All dependencies are bundled locally in the `libs/` directory:
```
libs/
├── bootstrap-5.3.3.min.css           # Bootstrap CSS framework
├── bootstrap-5.3.3.bundle.min.js     # Bootstrap JavaScript
├── bootstrap-icons-1.11.3.min.css    # Bootstrap Icons
├── ethers-6.13.5-ethers.umd.min.js   # Ethereum library
├── vue-3.5.13-vue.global.prod.min.js # Vue.js framework
├── qrcode-1.0.0.min.js               # QR code generation
└── fonts/
    ├── bootstrap-icons.woff2          # Icon fonts
    └── bootstrap-icons.woff
```

### Supported Networks
The wallet includes pre-configured support for:

| Network | Native Token | Chain ID | RPC Endpoint |
|---------|-------------|----------|--------------|
| Ethereum | ETH | 1 | https://eth.drpc.org |
| Polygon | MATIC | 137 | https://polygon-rpc.com |
| Arbitrum | ETH | 42161 | https://arb1.arbitrum.io/rpc |
| Optimism | ETH | 10 | https://mainnet.optimism.io |
| Base | ETH | 8453 | https://mainnet.base.org |
| Sepolia Testnet | ETH | 11155111 | https://1rpc.io/sepolia |
| Custom | Various | Various | User-defined |

## 🛠️ Development

### Customization
- **Add Networks**: Edit the `availableNetworks` array in `index.html`

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
1. **Only use on testnets** - Never use with real funds
2. **Clear session after use** - Use the "Clear Wallet Session" button
4. **Test transactions** - Start with small amounts on testnets
5. **Backup seed phrases** - Store seed phrases securely offline

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**⚠️ FINAL REMINDER: This is a testing and development tool. Never use it with real cryptocurrency or on production networks. Always use testnets and test tokens.**
