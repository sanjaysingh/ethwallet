import {
    DEFAULT_NETWORK_ID,
    formatAddressShort,
    getNetworkFromSearch,
    buildUrlWithNetwork,
    getTxExplorerUrl as buildTxExplorerUrl
} from './utils.js?v=__CACHE_VERSION__';
import {
    FAUCET_TURNSTILE_SITE_KEY,
    isFaucetTurnstileAlreadyMounted,
    requestFaucetDrip,
    shouldMountFaucetTurnstileOnNetworkChange
} from './faucet.js?v=__CACHE_VERSION__';
import {
    createPasskeyWallet,
    isPasskeyCancellation,
    isPasskeySupported,
    passkeyErrorMessage,
    unlockPasskeyWallet
} from './passkey.js?v=__CACHE_VERSION__';

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
const { createApp, ref, watch, onMounted, computed, nextTick } = Vue;

createApp({
    setup() {
        // State Variables
        const currentTab = ref('Configuration');
        const tabs = ['Configuration', 'Accounts', 'Transfer'];
        const selectedNetwork = ref('base');
        const rpcEndpoint = ref('https://mainnet.base.org');
        const seedPhrase = ref('');
        const seedVisible = ref(false);
        // In-memory only; cleared automatically on page refresh
        const previousSessions = ref([]);
        const selectedPreviousSession = ref('');
        
        // Available networks with their RPC endpoints
        const availableNetworks = ref([
            {
                id: 'ethereum',
                name: 'Ethereum Mainnet',
                rpcUrl: 'https://eth.drpc.org',
                isTestnet: false
            },
            {
                id: 'sepolia',
                name: 'Sepolia Testnet',
                rpcUrl: 'https://1rpc.io/sepolia',
                isTestnet: true
            },
            {
                id: 'base',
                name: 'Base',
                rpcUrl: 'https://mainnet.base.org',
                isTestnet: false
            },
            {
                id: 'optimism',
                name: 'Optimism',
                rpcUrl: 'https://mainnet.optimism.io',
                isTestnet: false
            },
            {
                id: 'polygon',
                name: 'Polygon',
                rpcUrl: 'https://polygon-rpc.com',
                isTestnet: false
            },
            {
                id: 'arbitrum',
                name: 'Arbitrum One',
                rpcUrl: 'https://arb1.arbitrum.io/rpc',
                isTestnet: false
            },
            {
                id: 'robinhood-mainnet',
                name: 'Robinhood Chain',
                rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
                isTestnet: false
            },
            {
                id: 'custom',
                name: 'Custom',
                rpcUrl: ''
            }
        ]);

        const testnetNetworks = computed(() =>
            availableNetworks.value.filter(n => n.id !== 'custom' && n.isTestnet)
        );
        const mainnetNetworks = computed(() =>
            availableNetworks.value.filter(n => n.id !== 'custom' && !n.isTestnet)
        );
        
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
        const txExplorerUrl = ref('');
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
        const sessionPanelOpen = ref(false);
        const networkStatusText = ref('');
        const networkStatusClass = ref('network-status text-muted');
        const isPrivateKeyVisible = ref(false);
        const currentPrivateKey = ref('');
        const originalSeedInput = ref(''); // Store the original input (seed phrase or private key)
        const walletSource = ref(''); // 'mnemonic' | 'privateKey' | 'passkey'
        const passkeysSupported = ref(false);
        let pendingWalletSource = '';

        // Global variables
        let provider = null;
        const wallets = ref([]);
        const walletPrivateKeys = [];
        const isWalletInitialized = ref(false);
        let allowedRpcEndpoint = null;

        // Deep linking helper functions
        const getNetworkFromUrl = () => getNetworkFromSearch(window.location.search);

        const updateUrlWithNetwork = (networkId) => {
            const nextUrl = buildUrlWithNetwork(window.location.href, networkId, DEFAULT_NETWORK_ID);
            // Update URL without reloading the page
            window.history.replaceState({}, '', nextUrl);
        };

        // Lifecycle
        onMounted(() => {
            // Initialize theme
            document.documentElement.setAttribute('data-bs-theme', currentTheme.value);
            passkeysSupported.value = isPasskeySupported();
            updateWalletStateUI();
            
            // Check for network in URL (deep linking support)
            // Only support known networks, ignore unknown network values
            const urlNetwork = getNetworkFromUrl();
            let validNetworkFromUrl = false;
            
            if (urlNetwork) {
                // Only apply if it's a known network (excluding 'custom')
                const network = availableNetworks.value.find(n => n.id === urlNetwork && n.id !== 'custom');
                if (network) {
                    validNetworkFromUrl = true;
                    selectedNetwork.value = urlNetwork;
                    rpcEndpoint.value = network.rpcUrl;
                }
                // If unknown network in URL, silently fall back to default (base)
            }
            
            networkStatusText.value = `Selected Network: ${getNetworkName()}${validNetworkFromUrl ? '' : ' (Default)'}`;
            networkStatusClass.value = 'network-status text-primary';
            
            // Listen for Receive tab being shown to generate QR codes / faucet captcha
            const receiveTabTrigger = document.getElementById('receive-tab');
            if (receiveTabTrigger) {
                receiveTabTrigger.addEventListener('shown.bs.tab', event => {
                    if (isWalletInitialized.value) {
                        generateAllQRCodes();
                    }
                    // Mount once when Receive is shown; do not remount on later visits.
                    if (selectedNetwork.value === 'sepolia') {
                        mountFaucetTurnstile();
                    }
                });
            }

            const walletTabTrigger = document.getElementById('wallet-tab');
            if (walletTabTrigger) {
                walletTabTrigger.addEventListener('shown.bs.tab', () => {
                    if (isWalletInitialized.value) {
                        refreshBalances();
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

        watch(selectedNetwork, (networkId) => {
            if (shouldMountFaucetTurnstileOnNetworkChange(
                networkId,
                document.getElementById('receive-tab-pane'),
            )) {
                mountFaucetTurnstile();
            } else if (networkId !== 'sepolia') {
                teardownFaucetTurnstile();
                faucetStatus.value = '';
                faucetStatusOk.value = false;
                faucetExplorerUrl.value = '';
            }
        });

        // Utility Functions
        const getNetworkName = () => {
            const network = availableNetworks.value.find(n => n.id === selectedNetwork.value);
            return network ? network.name : 'Unknown';
        };

        // Same shortening used for session key display (private key or seed phrase)
        const formatSecretShort = (secret) => {
            if (!secret || secret.length < 10) return secret || '***';
            return `${secret.substring(0, 6)}...${secret.substring(secret.length - 6)}`;
        };

        // Computed property for masked private key / seed phrase display
        const currentPrivateKeyDisplay = computed(() => {
            if (!originalSeedInput.value || originalSeedInput.value.length < 10) return '***';
            if (isPrivateKeyVisible.value) {
                return originalSeedInput.value;
            }
            return formatSecretShort(originalSeedInput.value);
        });

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

        // Sepolia faucet (Receive tab)
        const faucetTurnstileEl = ref(null);
        const faucetTurnstileToken = ref('');
        const faucetTurnstileWidgetId = ref(null);
        const faucetLoading = ref(false);
        const faucetBusyAddress = ref('');
        const faucetStatus = ref('');
        const faucetStatusOk = ref(false);
        const faucetExplorerUrl = ref('');

        const teardownFaucetTurnstile = () => {
            if (faucetTurnstileWidgetId.value != null && window.turnstile) {
                try {
                    window.turnstile.remove(faucetTurnstileWidgetId.value);
                } catch {
                    // ignore
                }
            }
            faucetTurnstileWidgetId.value = null;
            faucetTurnstileToken.value = '';
            if (faucetTurnstileEl.value) {
                faucetTurnstileEl.value.innerHTML = '';
            }
        };

        const mountFaucetTurnstile = async () => {
            await nextTick();
            if (selectedNetwork.value !== 'sepolia' || !faucetTurnstileEl.value) {
                return;
            }
            if (!window.turnstile) {
                // Script still loading; retry briefly.
                setTimeout(mountFaucetTurnstile, 300);
                return;
            }
            // Keep a completed (or in-progress) captcha when switching tabs.
            if (isFaucetTurnstileAlreadyMounted(
                faucetTurnstileWidgetId.value,
                faucetTurnstileEl.value,
            )) {
                return;
            }
            teardownFaucetTurnstile();
            faucetTurnstileWidgetId.value = window.turnstile.render(faucetTurnstileEl.value, {
                sitekey: FAUCET_TURNSTILE_SITE_KEY,
                callback: (token) => {
                    faucetTurnstileToken.value = token;
                },
                'expired-callback': () => {
                    faucetTurnstileToken.value = '';
                },
                'error-callback': () => {
                    faucetTurnstileToken.value = '';
                },
                theme: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light',
            });
        };

        const resetFaucetTurnstile = () => {
            faucetTurnstileToken.value = '';
            if (faucetTurnstileWidgetId.value != null && window.turnstile) {
                window.turnstile.reset(faucetTurnstileWidgetId.value);
            } else {
                mountFaucetTurnstile();
            }
        };

        const receiveFromFaucet = async (address) => {
            faucetStatus.value = '';
            faucetStatusOk.value = false;
            faucetExplorerUrl.value = '';

            if (selectedNetwork.value !== 'sepolia') {
                showAlert('Faucet is only available on Sepolia.', 'warning');
                return;
            }
            if (!faucetTurnstileToken.value) {
                showAlert('Complete the captcha first.', 'warning');
                return;
            }

            faucetLoading.value = true;
            faucetBusyAddress.value = address;
            try {
                const result = await requestFaucetDrip({
                    address,
                    turnstileToken: faucetTurnstileToken.value,
                });
                faucetStatusOk.value = true;
                faucetStatus.value = `Sent ${result.amount} ${result.symbol}.`;
                faucetExplorerUrl.value =
                    result.explorerTxUrl || buildTxExplorerUrl(result.txHash, 'sepolia');
                showAlert(`Faucet sent ${result.amount} ${result.symbol} to this account.`, 'success');
                resetFaucetTurnstile();
                if (typeof refreshAccounts === 'function') {
                    await refreshAccounts();
                }
            } catch (err) {
                faucetStatusOk.value = false;
                const message = err?.message || 'Faucet request failed';
                faucetStatus.value = message;
                showAlert(message, 'danger');
                resetFaucetTurnstile();
            } finally {
                faucetLoading.value = false;
                faucetBusyAddress.value = '';
            }
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
            if (!isWalletInitialized.value) {
                sessionPanelOpen.value = false;
            }
        };

        const toggleSessionPanel = () => {
            sessionPanelOpen.value = !sessionPanelOpen.value;
        };

        const formatAccountBalance = (balance) => {
            const n = Number(balance);
            if (!Number.isFinite(n)) {
                return '0';
            }
            return String(Number.parseFloat(n.toFixed(5)));
        };

        const totalBalance = computed(() => {
            const sum = accounts.value.reduce((acc, account) => acc + Number(account.balance || 0), 0);
            return formatAccountBalance(sum);
        });

        const detectChainInfo = async () => {
            // For known networks, use predefined information
            if (selectedNetwork.value !== 'custom') {
                const networkConfig = {
                    'ethereum': { name: 'Ethereum Mainnet', chainId: 1, nativeSymbol: 'ETH' },
                    'sepolia': { name: 'Sepolia Testnet', chainId: 11155111, nativeSymbol: 'ETH' },
                    'base': { name: 'Base', chainId: 8453, nativeSymbol: 'ETH' },
                    'optimism': { name: 'Optimism', chainId: 10, nativeSymbol: 'ETH' },
                    'polygon': { name: 'Polygon', chainId: 137, nativeSymbol: 'POL' },
                    'arbitrum': { name: 'Arbitrum One', chainId: 42161, nativeSymbol: 'ETH' },
                    'robinhood-mainnet': { name: 'Robinhood Chain', chainId: 4663, nativeSymbol: 'ETH' }
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
                    137: 'POL',    // Polygon
                    56: 'BNB',     // BSC
                    43114: 'AVAX', // Avalanche
                    42161: 'ETH',  // Arbitrum
                    10: 'ETH',     // Optimism
                    8453: 'ETH',   // Base
                    324: 'ETH',    // zkSync Era
                    59144: 'ETH',  // Linea
                    100: 'XDAI',   // Gnosis Chain
                    42220: 'CELO', // Celo
                    4663: 'ETH',   // Robinhood Chain
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

        const copyButtonFromEvent = (event) => {
            if (!event) {
                return null;
            }
            // Must run during the click, before any await: iOS clears currentTarget
            // after clipboard.writeText resolves, and target may be a text node.
            if (event.currentTarget && typeof event.currentTarget.closest === 'function') {
                return event.currentTarget.closest('button') || event.currentTarget;
            }
            if (event.target && typeof event.target.closest === 'function') {
                return event.target.closest('button');
            }
            if (event.target && event.target.parentElement) {
                return event.target.parentElement.closest('button');
            }
            return null;
        };

        const isAppleTouchDevice = () => {
            const ua = navigator.userAgent || '';
            return /iPad|iPhone|iPod/i.test(ua)
                || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        };

        const copyTextWithExecCommand = (text) => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.setAttribute('aria-hidden', 'true');
            textarea.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0.01;font-size:16px;';
            document.body.appendChild(textarea);

            const selection = window.getSelection();
            const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            let copied = false;
            const onCopy = (event) => {
                if (!event.clipboardData) {
                    return;
                }
                event.clipboardData.setData('text/plain', text);
                event.preventDefault();
                copied = true;
            };
            document.addEventListener('copy', onCopy);
            try {
                textarea.focus();
                textarea.select();
                textarea.setSelectionRange(0, text.length);
                copied = document.execCommand('copy') || copied;
            } catch (error) {
                copied = copied || false;
            } finally {
                document.removeEventListener('copy', onCopy);
                document.body.removeChild(textarea);
                if (selection) {
                    selection.removeAllRanges();
                    if (previousRange) {
                        selection.addRange(previousRange);
                    }
                }
            }
            return copied;
        };

        const showCopySuccess = (button) => {
            if (!button || !button.classList) {
                return;
            }

            const icon = button.querySelector('i');
            const originalIconClasses = icon ? icon.className : '';
            const originalButtonClasses = button.className;

            if (icon) {
                icon.className = 'bi bi-check-lg';
            }
            button.classList.remove('btn-outline-secondary');
            button.classList.add('btn-success');

            setTimeout(() => {
                if (icon) {
                    icon.className = originalIconClasses;
                }
                button.className = originalButtonClasses;
            }, 2000);
        };

        const copyText = (text, event, failMessage) => {
            if (!text) {
                return false;
            }
            const button = copyButtonFromEvent(event);
            const succeed = () => showCopySuccess(button);
            const fail = (err) => {
                console.error('Failed to copy:', err);
                showAlert(failMessage, 'warning');
            };

            // iOS Safari rejects Clipboard API writes unless they stay inside the
            // tap gesture, so copy there must not wait for a promise.
            if (isAppleTouchDevice() || !navigator.clipboard || !window.isSecureContext) {
                if (copyTextWithExecCommand(text)) {
                    succeed();
                    return true;
                }
                if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    navigator.clipboard.writeText(text).then(succeed).catch(fail);
                    return true;
                }
                fail(new Error('Copy is not available in this browser.'));
                return false;
            }

            navigator.clipboard.writeText(text).then(succeed).catch((err) => {
                if (copyTextWithExecCommand(text)) {
                    succeed();
                    return;
                }
                fail(err);
            });
            return true;
        };

        const copyPrivateKey = (event) => {
            if (!originalSeedInput.value) {
                showAlert('No seed phrase or private key to copy', 'warning');
                return;
            }
            copyText(originalSeedInput.value, event, 'Failed to copy to clipboard');
        };

        const getTxExplorerUrl = (txHash) => buildTxExplorerUrl(txHash, selectedNetwork.value);

        const rememberPreviousSession = (secret, address) => {
            if (!secret || !address) {
                return;
            }

            const existingIndex = previousSessions.value.findIndex(
                (session) => session.secret === secret
            );

            const sessionType = pendingWalletSource || walletSource.value || (secret.includes(' ') ? 'mnemonic' : 'privateKey');

            if (existingIndex !== -1) {
                // Keep position so dropdown indices stay stable (oldest → newest)
                previousSessions.value[existingIndex] = {
                    ...previousSessions.value[existingIndex],
                    address,
                    type: sessionType
                };
            } else {
                previousSessions.value.push({
                    id: `${Date.now()}-${address}`,
                    secret,
                    address,
                    type: sessionType
                });
            }

            selectedPreviousSession.value = '';
        };

        const reconnectPreviousSession = async () => {
            const session = previousSessions.value.find(
                (entry) => entry.id === selectedPreviousSession.value
            );
            if (!session) {
                return;
            }

            pendingWalletSource = session.type || '';
            seedPhrase.value = session.secret;
            await initializeWallet();
            selectedPreviousSession.value = '';
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
            txExplorerUrl.value = '';
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
            selectedPreviousSession.value = '';
            walletSource.value = '';
            pendingWalletSource = '';
            // Keep previousSessions so the user can reconnect without retyping
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
                            case 'robinhood-mainnet':
                                networkInfo = ethers.Network.from({ name: 'robinhood', chainId: 4663 });
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
                txExplorerUrl.value = '';
                if (txStatusTimeout) {
                    clearTimeout(txStatusTimeout);
                    txStatusTimeout = null;
                }
                estimatedGas.value = '';
                error.value = '';
                walletStatus.value = 'Initializing wallet...';

                // Store the original input (seed phrase or private key)
                originalSeedInput.value = seedPhrase.value;
                walletSource.value = pendingWalletSource || (seedPhrase.value.includes(' ') ? 'mnemonic' : 'privateKey');
                
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
                rememberPreviousSession(
                    originalSeedInput.value,
                    wallets.value[0]?.address || accounts.value[0]?.address
                );
                pendingWalletSource = '';
                showAlert('Wallet initialized successfully!', 'success');
                
            } catch (err) {
                pendingWalletSource = '';
                showError('Failed to initialize wallet: ' + err.message);
                showAlert('Failed to initialize wallet: ' + err.message, 'danger');
                walletStatus.value = '';
            } finally {
                isLoading.value = false;
            }
        };

        const refreshAccounts = async () => {
            if (!provider) {
                return;
            }

            const nextAccounts = [];
            for (let i = 0; i < wallets.value.length; i++) {
                const wallet = wallets.value[i];
                try {
                    const balance = await provider.getBalance(wallet.address);
                    nextAccounts.push({
                        address: wallet.address,
                        balance: ethers.formatEther(balance),
                        index: i
                    });
                } catch (err) {
                    console.error(`Failed to get balance for ${wallet.address}:`, err);
                    nextAccounts.push({
                        address: wallet.address,
                        balance: '0.0',
                        index: i
                    });
                }
            }

            accounts.value = nextAccounts;

            // Auto-select the first address if none is selected
            if (nextAccounts.length > 0 && !selectedFromAddress.value) {
                selectedFromAddress.value = nextAccounts[0].address;
            }
        };

        const isRefreshingBalances = ref(false);

        const refreshBalances = async () => {
            if (!provider || wallets.value.length === 0 || isRefreshingBalances.value) {
                return;
            }

            isRefreshingBalances.value = true;
            try {
                await refreshAccounts();
                if (tokenType.value === 'erc20' && tokenAddress.value) {
                    await updateTokenBalance();
                }
            } catch (err) {
                showError('Failed to refresh balances: ' + err.message);
                showAlert('Failed to refresh balances: ' + err.message, 'danger');
            } finally {
                isRefreshingBalances.value = false;
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
                txExplorerUrl.value = '';

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

                txExplorerUrl.value = getTxExplorerUrl(tx.hash);
                txStatus.value = `Transaction sent! Hash: ${tx.hash}`;
                txStatusType.value = 'success';
                await tx.wait();
                txStatus.value += ' (Confirmed)';
                await refreshAccounts();

            } catch (err) {
                txStatus.value = 'Transaction failed: ' + err.message;
                txStatusType.value = 'error';
                txExplorerUrl.value = '';
                
                // Auto-clear error messages after 10 seconds
                txStatusTimeout = setTimeout(() => {
                    txStatus.value = '';
                    txStatusType.value = '';
                    txExplorerUrl.value = '';
                    txStatusTimeout = null;
                }, 10000);
            } finally {
                isLoading.value = false;
            }
        };

        const generatePrivateKeyWallet = async () => {
            try {
                pendingWalletSource = 'privateKey';
                const wallet = ethers.Wallet.createRandom();
                seedPhrase.value = wallet.privateKey;
                
                await initializeWallet();
            } catch (err) {
                pendingWalletSource = '';
                showError('Failed to generate wallet: ' + err.message);
                showAlert('Failed to generate wallet: ' + err.message, 'danger');
            }
        };

        const generateSeedPhraseWallet = async () => {
            try {
                pendingWalletSource = 'mnemonic';
                const wallet = ethers.Wallet.createRandom();
                seedPhrase.value = wallet.mnemonic.phrase;
                
                await initializeWallet();
            } catch (err) {
                pendingWalletSource = '';
                showError('Failed to generate wallet: ' + err.message);
                showAlert('Failed to generate wallet: ' + err.message, 'danger');
            }
        };

        const applyPasskeyWallet = async (passkeyResult) => {
            pendingWalletSource = 'passkey';
            seedPhrase.value = passkeyResult.privateKey;
            await initializeWallet();
        };

        const generatePasskeyWallet = async () => {
            try {
                const result = await createPasskeyWallet();
                await applyPasskeyWallet(result);
            } catch (err) {
                pendingWalletSource = '';
                const message = passkeyErrorMessage(err);
                if (isPasskeyCancellation(err)) {
                    error.value = '';
                    showAlert(message, 'info');
                    return;
                }
                showError('Failed to create passkey wallet: ' + message);
                showAlert('Failed to create passkey wallet: ' + message, 'danger');
            }
        };

        const openPasskeyWallet = async () => {
            try {
                const result = await unlockPasskeyWallet();
                await applyPasskeyWallet(result);
            } catch (err) {
                pendingWalletSource = '';
                const message = passkeyErrorMessage(err);
                if (isPasskeyCancellation(err)) {
                    error.value = '';
                    showAlert(message, 'info');
                    return;
                }
                showError('Failed to open passkey wallet: ' + message);
                showAlert('Failed to open passkey wallet: ' + message, 'danger');
            }
        };

        const previousSessionLabel = (session) => {
            if (session?.type === 'passkey' && session.address) {
                return `Passkey ${formatAddressShort(session.address)}`;
            }
            return formatSecretShort(session?.secret);
        };

        const copyAddress = (address, event) => {
            if (!copyText(address, event, 'Failed to copy address to clipboard')) {
                return;
            }
        };

        const generateQRCode = (address, elementRef) => {
            if (!elementRef || !address) return;

            // Clear any existing QR code
            elementRef.innerHTML = '';

            try {
                if (typeof QRCode === 'undefined' || typeof QRCode.toString !== 'function') {
                    console.error("QRCode library not loaded");
                    elementRef.textContent = 'Error: QR Code library not loaded.';
                    return;
                }

                QRCode.toString(address, {
                    type: 'svg',
                    width: 256,
                    margin: 1,
                    errorCorrectionLevel: 'H',
                    color: {
                        dark: '#000000',
                        light: '#ffffff'
                    }
                }, (err, svg) => {
                    if (err) {
                        console.error("Error generating QR code:", err);
                        elementRef.textContent = 'Error generating QR code.';
                        return;
                    }
                    elementRef.innerHTML = svg;
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
            
            // Update URL for deep linking support
            updateUrlWithNetwork(selectedNetwork.value);
            
            networkStatusText.value = `Selected Network: ${getNetworkName()}`;
            networkStatusClass.value = 'network-status text-primary';
            
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
            sessionPanelOpen,
            networkStatusText,
            networkStatusClass,
            totalBalance,
            
            // Private key state
            isPrivateKeyVisible,
            currentPrivateKey,
            originalSeedInput,
            currentPrivateKeyDisplay,
            walletSource,
            passkeysSupported,
            
            // Original state
            currentTab,
            tabs,
            selectedNetwork,
            availableNetworks,
            testnetNetworks,
            mainnetNetworks,
            rpcEndpoint,
            seedPhrase,
            seedVisible,
            previousSessions,
            selectedPreviousSession,
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
            txExplorerUrl,
            estimatedGas,
            chainInfo,
            tokenInfo,
            isWalletInitialized,

            // Sepolia faucet (Receive tab)
            faucetTurnstileEl,
            faucetTurnstileToken,
            faucetLoading,
            faucetBusyAddress,
            faucetStatus,
            faucetStatusOk,
            faucetExplorerUrl,
            
            // Methods
            toggleTheme,
            showAlert,
            dismissAlert,
            receiveFromFaucet,
            toggleSeedVisibility,
            toggleCurrentPrivateKeyVisibility,
            copyPrivateKey,
            clearSession,
            toggleSessionPanel,
            formatAccountBalance,
            reconnectPreviousSession,
            initializeWallet,
            refreshBalances,
            isRefreshingBalances,
            updateTokenBalance,
            estimateGas,
            sendTransaction,
            generatePrivateKeyWallet,
            generateSeedPhraseWallet,
            generatePasskeyWallet,
            openPasskeyWallet,
            previousSessionLabel,
            copyAddress,
            generateQRCode,
            generateAllQRCodes,
            updateRpcEndpoint,
            formatAddressShort,
            formatSecretShort
        };
    }
}).mount('#app');