window.closeHamburgerMenu = function() {
  var hamburger = document.getElementById('hamburger');
  var navLinks = document.getElementById('nav-links');
  if (hamburger) hamburger.classList.remove('active');
  if (navLinks) navLinks.classList.remove('open');
};

window.isMobileDevice = function() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (window.innerWidth <= 768);
};

window.showMobileWalletFallback = function() {
  var existing = document.getElementById('mobile-wallet-fallback');
  if (existing) {
    existing.classList.add('active');
    return;
  }

  var overlay = document.createElement('div');
  overlay.id = 'mobile-wallet-fallback';
  overlay.className = 'mobile-wallet-fallback active';

  var currentUrl = encodeURIComponent(window.location.href);
  var dappUrl = window.location.host + window.location.pathname;

  overlay.innerHTML = '<div class="fallback-card">' +
    '<h3>Connect Wallet</h3>' +
    '<p>Open this page in your wallet\'s built-in browser to connect:</p>' +
    '<div class="wallet-links">' +
    '<a href="https://metamask.app.link/dapp/' + dappUrl + '" class="wallet-link metamask">Open in MetaMask</a>' +
    '<a href="https://link.trustwallet.com/open_url?coin_id=56&url=' + currentUrl + '" class="wallet-link trust">Open in Trust Wallet</a>' +
    '</div>' +
    '<p style="font-size:0.8rem;opacity:0.7;margin-top:12px;">Or scan the QR code from a desktop browser using your wallet app.</p>' +
    '<button class="close-fallback" onclick="document.getElementById(\'mobile-wallet-fallback\').classList.remove(\'active\')">Cancel</button>' +
    '</div>';

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });

  document.body.appendChild(overlay);
};

window.connectWalletWithFallback = function() {
  window.closeHamburgerMenu();

  if (typeof window.ethereum !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wallet-connect-injected'));
    return;
  }

  window.showMobileWalletFallback();
};

window.translateConnectButton = function() {
  var lang = localStorage.getItem('jacob_lang') || 'en';
  var btns = document.querySelectorAll('.connect-wallet-btn, #connect-btn');
  btns.forEach(function(btn) {
    if (!btn.classList.contains('connected')) {
      btn.textContent = (lang === 'zh') ? '\u8FDE\u63A5\u94B1\u5305' : 'Connect Wallet';
    }
  });
};

window.addEventListener('wallet-connect-injected', async function() {
  if (typeof window.ethereum === 'undefined') return;
  try {
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    var accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts && accounts.length > 0) {
      var addr = accounts[0];

      var chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0x38') {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x38' }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x38',
                chainName: 'BNB Smart Chain',
                nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                rpcUrls: ['https://bsc-dataseed.binance.org/'],
                blockExplorerUrls: ['https://bscscan.com/']
              }],
            });
          }
        }
      }

      window.dispatchEvent(new CustomEvent('wallet-connected', {
        detail: {
          provider: window.ethereum,
          address: addr,
          chainId: 56
        }
      }));
      localStorage.setItem('jacob_wallet_connected', 'true');
    }
  } catch (e) {
    console.error('Wallet connect failed:', e);
    alert('Failed to connect wallet: ' + (e.message || 'Unknown error'));
  }
});

document.addEventListener('DOMContentLoaded', function() {
  window.translateConnectButton();
});
