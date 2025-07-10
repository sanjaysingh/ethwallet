// ERC20 Token ABI
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function transfer(address to, uint amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
];

// Vue App Setup
const { createApp, ref, watch, onMounted, computed } = Vue;

createApp({
    setup() {
        // State Variables
        const currentTab = ref('Configuration');
        const tabs = ['Configuration', 'Accounts', 'Transfer'];
        const selectedNetwork = ref('base');
        const rpcEndpoint = ref('https://mainnet.base.org');
        const seedPhrase = ref('');
        const seedVisible = ref(false);
        
        // Available networks with their RPC endpoints
        const availableNetworks = ref([
            {
                id: 'ethereum',
                name: 'Ethereum Mainnet',
                rpcUrl: 'https://eth.drpc.org'
            },
            {
                id: 'sepolia',
                name: 'Sepolia Testnet',
                rpcUrl: 'https://1rpc.io/sepolia'
            },
            {
                id: 'base',
                name: 'Base',
                rpcUrl: 'https://mainnet.base.org'
            },
            {
                id: 'optimism',
                name: 'Optimism',
                rpcUrl: 'https://mainnet.optimism.io'
            },
            {
                id: 'polygon',
                name: 'Polygon',
                rpcUrl: 'https://polygon-rpc.com'
            },
            {
                id: 'arbitrum',
                name: 'Arbitrum One',
                rpcUrl: 'https://arb1.arbitrum.io/rpc'
            },
            {
                id: 'custom',
                name: 'Custom',
                rpcUrl: ''
            }
        ]);
        
        const walletStatus = ref('');
        const error = ref('');
        const accounts = ref([]);
        const selectedFromAddress = ref('');
        const tokenType = ref('native');
        const chainInfo = ref(null);
        const tokenAddress = ref('');
        const toAddress = ref('');
        const amount = ref('');
        const txStatus = ref('');
        const txStatusType = ref(''); // 'success', 'error', or ''
        const estimatedGas = ref('');
        const tokenInfo = ref(null);
        
        // Timeout for auto-clearing error messages
        let txStatusTimeout = null;

        // Bootstrap styling state
        const currentTheme = ref('dark');
        const isLoading = ref(false);
        const alerts = ref([]);
        const showWalletManagement = ref(true);
        const showLoadedWalletDetails = ref(false);
        const networkStatusText = ref('');
        const networkStatusClass = ref('form-text text-muted d-block mt-2');
        const isPrivateKeyVisible = ref(false);
        const currentPrivateKey = ref('');
        const originalSeedInput = ref(''); // Store the original input (seed phrase or private key)

        // Global variables
        let provider = null;
        const wallets = ref([]);
        const walletPrivateKeys = [];
        const isWalletInitialized = ref(false);
        let allowedRpcEndpoint = null;

        // Lifecycle
        onMounted(() => {
            // Initialize theme
            document.documentElement.setAttribute('data-bs-theme', currentTheme.value);
            updateWalletStateUI();
            networkStatusText.value = `Selected Network: ${getNetworkName()} (Default)`;
            networkStatusClass.value = 'form-text text-primary d-block mt-2';
            
            // Listen for Receive tab being shown to generate QR codes
            const receiveTabTrigger = document.getElementById('receive-tab');
            if (receiveTabTrigger) {
                receiveTabTrigger.addEventListener('shown.bs.tab', event => {
                    if (isWalletInitialized.value) {
                        generateAllQRCodes();
                    }
                });
            }
        });

        // Watch for changes in transaction details to estimate gas
        watch([selectedFromAddress, toAddress, amount, tokenType, tokenAddress], () => {
            if (isWalletInitialized.value && selectedFromAddress.value && toAddress.value && amount.value) {
                estimateGas();
            } else {
                estimatedGas.value = '';
            }
        });

        // Utility Functions
        const getNetworkName = () => {
            const network = availableNetworks.value.find(n => n.id === selectedNetwork.value);
            return network ? network.name : 'Unknown';
        };

        // Computed property for masked private key display
        const currentPrivateKeyDisplay = computed(() => {
            if (!originalSeedInput.value || originalSeedInput.value.length < 10) return '***';
            if (isPrivateKeyVisible.value) {
                return originalSeedInput.value;
            }
            return `${originalSeedInput.value.substring(0, 6)}...${originalSeedInput.value.substring(originalSeedInput.value.length - 6)}`;
        });

        // Utility function to format addresses in short format
        const formatAddressShort = (address) => {
            if (!address || address.length < 10) return address;
            return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        };

        // Alert system
        let currentAlertTimeout = null;
        
        const showAlert = (message, type = 'info') => {
            const id = Date.now();
            const newAlert = { message, type, id };
            
            // Clear any existing timeout
            if (currentAlertTimeout) {
                clearTimeout(currentAlertTimeout);
            }
            
            // Immediately replace any existing alert
            alerts.value = [newAlert];
            
            // Set new timeout for this alert
            currentAlertTimeout = setTimeout(() => {
                dismissAlert(id);
                currentAlertTimeout = null;
            }, 4000);
        };

        const dismissAlert = (id) => {
            if (id) {
                alerts.value = alerts.value.filter(alert => alert.id !== id);
            } else {
                alerts.value = [];
            }
        };

        // Theme toggle
        const toggleTheme = () => {
            currentTheme.value = currentTheme.value === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-bs-theme', currentTheme.value);
        };

        const updateWalletStateUI = () => {
            showWalletManagement.value = !isWalletInitialized.value;
            showLoadedWalletDetails.value = isWalletInitialized.value;
        };

        const detectChainInfo = async () => {
            // For known networks, use predefined information
            if (selectedNetwork.value !== 'custom') {
                const networkConfig = {
                    'ethereum': { name: 'Ethereum Mainnet', chainId: 1, nativeSymbol: 'ETH' },
                    'sepolia': { name: 'Sepolia Testnet', chainId: 11155111, nativeSymbol: 'ETH' },
                    'base': { name: 'Base', chainId: 8453, nativeSymbol: 'ETH' },
                    'optimism': { name: 'Optimism', chainId: 10, nativeSymbol: 'ETH' },
                    'polygon': { name: 'Polygon', chainId: 137, nativeSymbol: 'MATIC' },
                    'arbitrum': { name: 'Arbitrum One', chainId: 42161, nativeSymbol: 'ETH' }
                };
                
                chainInfo.value = networkConfig[selectedNetwork.value] || { name: 'Unknown Chain', chainId: 0, nativeSymbol: 'ETH' };
                return;
            }
            
            // Only detect network for custom RPC endpoints
            if (!provider) {
                chainInfo.value = { name: 'Unknown Chain', chainId: 0, nativeSymbol: 'ETH' };
                return;
            }
            
            try {
                const network = await provider.getNetwork();
                const chainId = Number(network.chainId);

                const chainToSymbol = {
                    1: 'ETH',      // Ethereum Mainnet
                    11155111: 'ETH', // Sepolia Testnet
                    137: 'MATIC',  // Polygon
                    56: 'BNB',     // BSC
                    43114: 'AVAX', // Avalanche
                    42161: 'ETH',  // Arbitrum
                    10: 'ETH',     // Optimism
                    8453: 'ETH',   // Base
                    324: 'ETH',    // zkSync Era
                    59144: 'ETH',  // Linea
                    100: 'XDAI',   // Gnosis Chain
                    42220: 'CELO', // Celo
                };

                chainInfo.value = {
                    name: network.name || 'Custom Network',
                    chainId: chainId,
                    nativeSymbol: chainToSymbol[chainId] || 'ETH'
                };
            } catch (err) {
                console.log('Network detection failed for custom RPC:', err.message);
                chainInfo.value = { name: 'Custom Network (Detection Failed)', chainId: 0, nativeSymbol: 'ETH' };
            }
        };

        const showError = (message) => {
            error.value = message;
            setTimeout(() => {
                error.value = '';
            }, 5000);
        };

        const toggleSeedVisibility = () => {
            seedVisible.value = !seedVisible.value;
        };

        const toggleCurrentPrivateKeyVisibility = () => {
            isPrivateKeyVisible.value = !isPrivateKeyVisible.value;
        };

        const copyPrivateKey = async (event) => {
            if (!originalSeedInput.value) {
                showAlert('No seed phrase or private key to copy', 'warning');
                return;
            }
            try {
                await navigator.clipboard.writeText(originalSeedInput.value);
                
                // Show check mark animation on the button
                const button = event.target.closest('button');
                if (button) {
                    const icon = button.querySelector('i');
                    if (icon) {
                        // Store original classes
                        const originalClasses = icon.className;
                        const originalButtonClasses = button.className;
                        
                        // Change to check mark and success styling
                        icon.className = 'bi bi-check-lg';
                        button.className = button.className.replace('btn-outline-secondary', 'btn-success');
                        
                        // Restore original styling after 2 seconds
                        setTimeout(() => {
                            icon.className = originalClasses;
                            button.className = originalButtonClasses;
                        }, 2000);
                    }
                }
            } catch (err) {
                showAlert('Failed to copy to clipboard', 'warning');
            }
        };

        const clearSession = () => {
            wallets.value.length = 0;
            walletPrivateKeys.length = 0;
            accounts.value.length = 0;
            isWalletInitialized.value = false;
            selectedFromAddress.value = '';
            tokenInfo.value = null;
            txStatus.value = '';
            txStatusType.value = '';
            if (txStatusTimeout) {
                clearTimeout(txStatusTimeout);
                txStatusTimeout = null;
            }
            estimatedGas.value = '';
            error.value = '';
            walletStatus.value = '';
            seedPhrase.value = '';
            currentPrivateKey.value = '';
            originalSeedInput.value = '';
            isPrivateKeyVisible.value = false;
            updateWalletStateUI();
            showAlert('Wallet session cleared.', 'info');
        };

        const initializeWallet = async () => {
            try {
                if (!rpcEndpoint.value || !seedPhrase.value) {
                    throw new Error('Please provide both RPC endpoint and seed phrase');
                }

                isLoading.value = true;
                allowedRpcEndpoint = rpcEndpoint.value;
                
                // Create provider with network info for known networks to avoid detection
                if (selectedNetwork.value !== 'custom') {
                    try {
                        let networkInfo;
                        switch (selectedNetwork.value) {
                            case 'ethereum':
                                networkInfo = ethers.Network.from('mainnet');
                                break;
                            case 'sepolia':
                                networkInfo = ethers.Network.from('sepolia');
                                break;
                            case 'base':
                                networkInfo = ethers.Network.from({ name: 'base', chainId: 8453 });
                                break;
                            case 'optimism':
                                networkInfo = ethers.Network.from({ name: 'optimism', chainId: 10 });
                                break;
                            case 'polygon':
                                networkInfo = ethers.Network.from({ name: 'matic', chainId: 137 });
                                break;
                            case 'arbitrum':
                                networkInfo = ethers.Network.from({ name: 'arbitrum', chainId: 42161 });
                                break;
                            default:
                                networkInfo = null;
                        }
                        
                        if (networkInfo) {
                            provider = new ethers.JsonRpcProvider(rpcEndpoint.value, networkInfo, { staticNetwork: networkInfo });
                        } else {
                            provider = new ethers.JsonRpcProvider(rpcEndpoint.value);
                        }
                    } catch (err) {
                        console.log('Failed to create provider with network info, using default:', err.message);
                        provider = new ethers.JsonRpcProvider(rpcEndpoint.value);
                    }
                } else {
                    provider = new ethers.JsonRpcProvider(rpcEndpoint.value);
                }
                
                wallets.value.length = 0;
                walletPrivateKeys.length = 0;
                accounts.value.length = 0;
                isWalletInitialized.value = false;
                
                selectedFromAddress.value = '';
                tokenInfo.value = null;
                txStatus.value = '';
                txStatusType.value = '';
                if (txStatusTimeout) {
                    clearTimeout(txStatusTimeout);
                    txStatusTimeout = null;
                }
                estimatedGas.value = '';
                error.value = '';
                walletStatus.value = 'Initializing wallet...';

                // Store the original input (seed phrase or private key)
                originalSeedInput.value = seedPhrase.value;
                
                if (seedPhrase.value.includes(' ')) {
                    // Seed phrase
                    for (let i = 0; i < 5; i++) {
                        const path = `m/44'/60'/0'/0/${i}`;
                        const derivedWallet = ethers.HDNodeWallet.fromMnemonic(
                            ethers.Mnemonic.fromPhrase(seedPhrase.value),
                            path
                        );
                        // Store the base wallet without provider connection
                        wallets.value.push(derivedWallet);
                        walletPrivateKeys.push(derivedWallet.privateKey);
                    }
                } else {
                    // Private key - create base wallet without provider connection
                    const wallet = new ethers.Wallet(seedPhrase.value);
                    wallets.value.push(wallet);
                    walletPrivateKeys.push(wallet.privateKey);
                }

                await detectChainInfo();
                await refreshAccounts();
                
                isWalletInitialized.value = true;
                updateWalletStateUI();
                walletStatus.value = '';
                showAlert('Wallet initialized successfully!', 'success');
                
            } catch (err) {
                showError('Failed to initialize wallet: ' + err.message);
                showAlert('Failed to initialize wallet: ' + err.message, 'danger');
                walletStatus.value = '';
            } finally {
                isLoading.value = false;
            }
        };

        const refreshAccounts = async () => {
            accounts.value = [];
            for (let i = 0; i < wallets.value.length; i++) {
                const wallet = wallets.value[i];
                try {
                    const balance = await provider.getBalance(wallet.address);
                    accounts.value.push({
                        address: wallet.address,
                        balance: ethers.formatEther(balance),
                        index: i
                    });
                } catch (err) {
                    console.error(`Failed to get balance for ${wallet.address}:`, err);
                    accounts.value.push({
                        address: wallet.address,
                        balance: '0.0',
                        index: i
                    });
                }
            }
            
            // Auto-select the first address if none is selected
            if (accounts.value.length > 0 && !selectedFromAddress.value) {
                selectedFromAddress.value = accounts.value[0].address;
            }
        };

        const updateTokenBalance = async () => {
            if (!selectedFromAddress.value) {
                tokenInfo.value = null;
                return;
            }

            if (tokenType.value === 'native') {
                tokenInfo.value = null;
                return;
            }

            if (!tokenAddress.value) {
                tokenInfo.value = null;
                return;
            }

            try {
                const contract = new ethers.Contract(tokenAddress.value, ERC20_ABI, provider);
                const [balance, decimals, symbol, name] = await Promise.all([
                    contract.balanceOf(selectedFromAddress.value),
                    contract.decimals(),
                    contract.symbol(),
                    contract.name()
                ]);

                tokenInfo.value = {
                    balance: ethers.formatUnits(balance, decimals),
                    decimals: decimals,
                    symbol: symbol,
                    name: name,
                    address: tokenAddress.value
                };
            } catch (err) {
                console.error('Failed to get token info:', err);
                tokenInfo.value = null;
            }
        };

        const estimateGas = async () => {
            if (!selectedFromAddress.value || !toAddress.value || !amount.value || !provider) {
                estimatedGas.value = '';
                return;
            }

            try {
                let gasEstimate;
                
                if (tokenType.value === 'native') {
                    // Native token transfer
                    const txRequest = {
                        from: selectedFromAddress.value,
                        to: toAddress.value,
                        value: ethers.parseEther(amount.value.toString())
                    };
                    gasEstimate = await provider.estimateGas(txRequest);
                } else {
                    // ERC20 token transfer
                    if (!tokenAddress.value) {
                        estimatedGas.value = '';
                        return;
                    }
                    
                    const contract = new ethers.Contract(tokenAddress.value, ERC20_ABI, provider);
                    const decimals = await contract.decimals();
                    
                    const transferData = contract.interface.encodeFunctionData('transfer', [
                        toAddress.value,
                        ethers.parseUnits(amount.value.toString(), decimals)
                    ]);
                    
                    gasEstimate = await provider.estimateGas({
                        from: selectedFromAddress.value,
                        to: tokenAddress.value,
                        data: transferData
                    });
                }

                // Add 20% buffer for safety
                const gasWithBuffer = gasEstimate * 120n / 100n;
                
                // Get current gas price
                const gasPrice = await provider.getFeeData();
                const gasCost = gasWithBuffer * gasPrice.gasPrice;
                
                estimatedGas.value = {
                    gasLimit: gasWithBuffer.toString(),
                    gasPrice: ethers.formatUnits(gasPrice.gasPrice, 'gwei'),
                    ethCost: ethers.formatEther(gasCost)
                };
            } catch (err) {
                console.error('Gas estimation failed:', err);
                estimatedGas.value = '';
            }
        };

        const sendTransaction = async () => {
            try {
                // Clear any existing timeout
                if (txStatusTimeout) {
                    clearTimeout(txStatusTimeout);
                    txStatusTimeout = null;
                }
                
                if (!selectedFromAddress.value || !toAddress.value || !amount.value) {
                    throw new Error('Please fill in all required fields');
                }

                if (!provider) {
                    throw new Error('Provider not initialized. Please check your network connection.');
                }

                isLoading.value = true;
                txStatus.value = 'Preparing transaction...';
                txStatusType.value = 'success';

                const walletIndex = accounts.value.find(acc => acc.address === selectedFromAddress.value)?.index;
                if (walletIndex === undefined) {
                    throw new Error('Selected address not found in wallets');
                }

                // Get the private key and create a fresh wallet instance with the provider
                const privateKey = walletPrivateKeys[walletIndex];
                if (!privateKey) {
                    throw new Error('Private key not found for selected wallet');
                }
                
                // Create a fresh wallet instance with the provider
                const connectedWallet = new ethers.Wallet(privateKey, provider);

                // Use pre-calculated gas estimate if available, otherwise calculate it
                if (!estimatedGas.value) {
                    txStatus.value = 'Estimating gas...';
                    await estimateGas();
                    
                    if (!estimatedGas.value) {
                        throw new Error('Failed to estimate gas. Please check if you have sufficient funds and valid transaction details.');
                    }
                }

                let tx;
                if (tokenType.value === 'native') {
                    const txRequest = {
                        to: toAddress.value,
                        value: ethers.parseEther(amount.value.toString()),
                        gasLimit: BigInt(estimatedGas.value.gasLimit)
                    };

                    tx = await connectedWallet.sendTransaction(txRequest);
                } else {
                    if (!tokenAddress.value) throw new Error('Please provide token address');
                    const contract = new ethers.Contract(tokenAddress.value, ERC20_ABI, connectedWallet);
                    const decimals = await contract.decimals();

                    const transferTx = await contract.transfer.populateTransaction(
                        toAddress.value,
                        ethers.parseUnits(amount.value.toString(), decimals)
                    );

                    transferTx.gasLimit = BigInt(estimatedGas.value.gasLimit);
                    tx = await connectedWallet.sendTransaction(transferTx);
                }

                txStatus.value = `Transaction sent! Hash: ${tx.hash}`;
                txStatusType.value = 'success';
                await tx.wait();
                txStatus.value += ' (Confirmed)';
                await refreshAccounts();

            } catch (err) {
                txStatus.value = 'Transaction failed: ' + err.message;
                txStatusType.value = 'error';
                
                // Auto-clear error messages after 10 seconds
                txStatusTimeout = setTimeout(() => {
                    txStatus.value = '';
                    txStatusType.value = '';
                    txStatusTimeout = null;
                }, 10000);
            } finally {
                isLoading.value = false;
            }
        };

        const generatePrivateKeyWallet = async () => {
            try {
                const wallet = ethers.Wallet.createRandom();
                seedPhrase.value = wallet.privateKey;
                
                await initializeWallet();
            } catch (err) {
                showError('Failed to generate wallet: ' + err.message);
                showAlert('Failed to generate wallet: ' + err.message, 'danger');
            }
        };

        const generateSeedPhraseWallet = async () => {
            try {
                const wallet = ethers.Wallet.createRandom();
                seedPhrase.value = wallet.mnemonic.phrase;
                
                await initializeWallet();
            } catch (err) {
                showError('Failed to generate wallet: ' + err.message);
                showAlert('Failed to generate wallet: ' + err.message, 'danger');
            }
        };

        const copyAddress = async (address, event) => {
            try {
                await navigator.clipboard.writeText(address);
                
                // Show check mark animation on the button
                const button = event.target.closest('button');
                if (button) {
                    const icon = button.querySelector('i');
                    if (icon) {
                        // Store original classes
                        const originalClasses = icon.className;
                        const originalButtonClasses = button.className;
                        
                        // Change to check mark and success styling
                        icon.className = 'bi bi-check-lg';
                        button.className = button.className.replace('btn-outline-secondary', 'btn-success');
                        
                        // Restore original styling after 2 seconds
                        setTimeout(() => {
                            icon.className = originalClasses;
                            button.className = originalButtonClasses;
                        }, 2000);
                    }
                }
            } catch (err) {
                showError('Failed to copy address to clipboard');
                showAlert('Failed to copy address to clipboard', 'warning');
            }
        };

        const getQRCodeUrl = (address) => {
            const base64Address = btoa(address);
            return `https://qrcode.sanjaysingh.net/?text=${base64Address}`;
        };

        const generateQRCode = (address, elementRef) => {
            if (!elementRef || !address) return;
            
            // Clear any existing QR code
            elementRef.innerHTML = '';
            
            try {
                // Ensure QRCode library is available
                if (typeof QRCode === 'undefined') {
                    console.error("QRCode library not loaded");
                    elementRef.textContent = 'Error: QR Code library not loaded.';
                    return;
                }
                
                new QRCode(elementRef, {
                    text: address,
                    width: 256,
                    height: 256,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            } catch (e) {
                console.error("Error generating QR code:", e);
                elementRef.textContent = 'Error generating QR code.';
            }
        };

        const generateAllQRCodes = () => {
            // Use nextTick to ensure DOM is updated
            Vue.nextTick(() => {
                accounts.value.forEach(account => {
                    const qrElement = document.querySelector(`[data-qr-address="${account.address}"]`);
                    if (qrElement) {
                        generateQRCode(account.address, qrElement);
                    }
                });
            });
        };

        const updateRpcEndpoint = async () => {
            const network = availableNetworks.value.find(n => n.id === selectedNetwork.value);
            if (network && network.id !== 'custom') {
                rpcEndpoint.value = network.rpcUrl;
            }
            
            networkStatusText.value = `Selected Network: ${getNetworkName()}`;
            networkStatusClass.value = 'form-text text-primary d-block mt-2';
            
            if (provider && wallets.value.length > 0 && seedPhrase.value) {
                try {
                    await initializeWallet();
                } catch (err) {
                    showError('Failed to switch network: ' + err.message);
                    showAlert('Failed to switch network: ' + err.message, 'danger');
                }
            }
        };

        // Return all reactive properties and methods
        return {
            // Theme and UI state
            currentTheme,
            isLoading,
            alerts,
            showWalletManagement,
            showLoadedWalletDetails,
            networkStatusText,
            networkStatusClass,
            
            // Private key state
            isPrivateKeyVisible,
            currentPrivateKey,
            originalSeedInput,
            currentPrivateKeyDisplay,
            
            // Original state
            currentTab,
            tabs,
            selectedNetwork,
            availableNetworks,
            rpcEndpoint,
            seedPhrase,
            seedVisible,
            walletStatus,
            error,
            accounts,
            selectedFromAddress,
            tokenType,
            tokenAddress,
            toAddress,
            amount,
            txStatus,
            txStatusType,
            estimatedGas,
            chainInfo,
            tokenInfo,
            isWalletInitialized,
            
            // Methods
            toggleTheme,
            showAlert,
            dismissAlert,
            toggleSeedVisibility,
            toggleCurrentPrivateKeyVisibility,
            copyPrivateKey,
            clearSession,
            initializeWallet,
            updateTokenBalance,
            estimateGas,
            sendTransaction,
            generatePrivateKeyWallet,
            generateSeedPhraseWallet,
            copyAddress,
            getQRCodeUrl,
            generateQRCode,
            generateAllQRCodes,
            updateRpcEndpoint,
            formatAddressShort
        };
    }
}).mount('#app');