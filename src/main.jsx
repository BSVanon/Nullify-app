import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

// OLD TEST CODE BELOW - REMOVE AFTER CONFIRMING APP WORKS
/*
function TestApp() {
  const [walletStatus, setWalletStatus] = React.useState('Ready');
  const [walletData, setWalletData] = React.useState(null);
  const [walletWindow, setWalletWindow] = React.useState(null);
  const [step, setStep] = React.useState(1); // 1: Open wallet, 2: Test connection

  // Listen for wallet messages
  React.useEffect(() => {
    const handleMessage = (event) => {
      console.log('Received message:', event.data);
      
      if (event.data.type === 'CWI_RESPONSE' && event.data.cwi) {
        window.CWI = event.data.cwi;
        setWalletStatus('Connected to BRC-7 Wallet');
        setStep(3); // Move to success step
        console.log('CWI interface received from wallet');
      }
      
      if (event.data.type === 'BRC7_WALLET_READY' && event.data.cwi) {
        window.CWI = event.data.cwi;
        setWalletStatus('Connected to BRC-7 Wallet');
        setStep(3);
        console.log('CWI interface received from wallet');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const openWallet = () => {
    console.log('Opening wallet window...');
    
    try {
      const walletUrl = `${window.location.origin}/test-wallets/brc7-test-wallet/index.html`;
      const newWalletWindow = window.open(
        walletUrl, 
        'brc7-wallet', 
        'width=900,height=700,scrollbars=yes,resizable=yes'
      );
      
      if (!newWalletWindow) {
        setWalletStatus('Error: Popup blocked');
        setWalletData({ error: 'Please allow popups for this site' });
        return;
      }

      setWalletWindow(newWalletWindow);
      setWalletStatus('Wallet window opened - proceed to Step 2');
      setStep(2);
      
    } catch (error) {
      console.error('Error opening wallet:', error);
      setWalletStatus('Error opening wallet');
      setWalletData({ error: error.message });
    }
  };

  const testConnection = async () => {
    console.log('Testing wallet connection...');
    
    try {
      // First check if CWI is already available
      if (window.CWI) {
        console.log('CWI already available');
        setWalletStatus('Testing...');
        
        const version = await window.CWI.getVersion();
        const network = await window.CWI.getNetwork();
        
        setWalletData({
          version: version,
          network: network,
          status: 'Connected'
        });
        
        setWalletStatus('Connected to BRC-7 Wallet');
        setStep(3);
        return;
      }

      // Try to request CWI from wallet window
      if (walletWindow && !walletWindow.closed) {
        console.log('Requesting CWI from wallet...');
        walletWindow.postMessage({ type: 'REQUEST_CWI' }, '*');
        setWalletStatus('Testing connection...');
        setWalletData({ status: 'Waiting for wallet response...' });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          if (step === 2) {
            setWalletStatus('Connection timeout - try manual test');
            setWalletData({ error: 'No response from wallet. Try testing wallet functions directly.' });
          }
        }, 5000);
        
      } else {
        setWalletStatus('Wallet window not available');
        setWalletData({ error: 'Wallet window was closed or not opened' });
      }
      
    } catch (error) {
      console.error('Connection test error:', error);
      setWalletStatus('Error testing connection');
      setWalletData({ error: error.message });
    }
  };

  const resetTest = () => {
    setWalletStatus('Ready');
    setWalletData(null);
    setWalletWindow(null);
    setStep(1);
  };

  return React.createElement('div', { 
    style: { 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f0f0f0',
      minHeight: '100vh'
    }
  },
    React.createElement('header', {
      style: {
        background: 'linear-gradient(90deg, #FF007A 0%, #39C4D6 100%)',
        color: 'white',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px',
        textAlign: 'center'
      }
    },
      React.createElement('h1', { 
        style: { margin: '0', fontSize: '2.5em' } 
      }, 'Nullify'),
      React.createElement('p', { 
        style: { margin: '10px 0 0 0', fontSize: '1.1em' }
      }, 'Self-destructing access tokens on BSV blockchain')
    ),

    React.createElement('main', { 
      style: { maxWidth: '800px', margin: '0 auto' }
    },
      React.createElement('div', { 
        style: { 
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '10px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }
      },
        React.createElement('h2', { 
          style: { color: '#FF007A', marginTop: '0' } 
        }, 'Status: Ready'),
        React.createElement('p', null, 'React is working! ES6 modules work!'),
        
        React.createElement('div', { 
          style: { 
            backgroundColor: '#f8f9fa',
            padding: '20px',
            borderRadius: '5px',
            margin: '20px 0',
            border: '1px solid #39C4D6'
          }
        },
          React.createElement('h3', { 
            style: { marginTop: '0', color: '#333' } 
          }, 'BRC-7 Wallet Integration Test'),
          React.createElement('p', null, 
            React.createElement('strong', null, 'Status: '),
            React.createElement('span', { 
              style: { 
                color: step === 3 ? '#28a745' : 
                       walletStatus.includes('Error') ? '#dc3545' : '#6c757d'
              }
            }, walletStatus)
          ),
          
          // Step 1: Open Wallet
          step === 1 && React.createElement('div', {
            style: {
              backgroundColor: '#e7f3ff',
              padding: '15px',
              borderRadius: '5px',
              marginBottom: '15px',
              border: '1px solid #b8daff'
            }
          },
            React.createElement('h4', { style: { marginTop: '0', color: '#004085' } }, 'Step 1: Open BRC-7 Wallet'),
            React.createElement('p', { style: { margin: '5px 0', fontSize: '14px' } }, 
              'Click button to open BRC-7 wallet window'
            ),
            React.createElement('button', {
              onClick: openWallet,
              style: {
                backgroundColor: '#FF007A',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                marginTop: '10px',
                transition: 'background-color 0.3s'
              },
              onMouseOver: (e) => e.target.style.backgroundColor = '#e6006f',
              onMouseOut: (e) => e.target.style.backgroundColor = '#FF007A'
            }, 'Open BRC-7 Wallet')
          ),
          
          // Step 2: Test Connection
          step === 2 && React.createElement('div', {
            style: {
              backgroundColor: '#e7f3ff',
              padding: '15px',
              borderRadius: '5px',
              marginBottom: '15px',
              border: '1px solid #b8daff'
            }
          },
            React.createElement('h4', { style: { marginTop: '0', color: '#004085' } }, 'Step 2: Test Connection'),
            React.createElement('p', { style: { margin: '5px 0', fontSize: '14px' } }, 
              'Wallet window opened. Click to test the connection.'
            ),
            React.createElement('button', {
              onClick: testConnection,
              style: {
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                marginTop: '10px',
                marginRight: '10px',
                transition: 'background-color 0.3s'
              },
              onMouseOver: (e) => e.target.style.backgroundColor = '#218838',
              onMouseOut: (e) => e.target.style.backgroundColor = '#28a745'
            }, 'Test Connection'),
            React.createElement('button', {
              onClick: resetTest,
              style: {
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                marginTop: '10px',
                transition: 'background-color 0.3s'
              },
              onMouseOver: (e) => e.target.style.backgroundColor = '#5a6268',
              onMouseOut: (e) => e.target.style.backgroundColor = '#6c757d'
            }, 'Reset Test')
          ),
          
          // Step 3: Success
          step === 3 && React.createElement('div', {
            style: {
              backgroundColor: '#d4edda',
              padding: '15px',
              borderRadius: '5px',
              marginBottom: '15px',
              border: '1px solid #c3e6cb'
            }
          },
            React.createElement('h4', { style: { marginTop: '0', color: '#155724' } }, '✅ SUCCESS: Connected!'),
            React.createElement('p', { style: { margin: '5px 0', fontSize: '14px' } }, 
              'BRC-7 wallet integration successful!'
            ),
            React.createElement('button', {
              onClick: resetTest,
              style: {
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '14px',
                marginTop: '10px'
              }
            }, 'Test Again')
          ),
          
          walletData && React.createElement('div', { 
            style: { 
              marginTop: '15px',
              padding: '10px',
              backgroundColor: '#e9ecef',
              borderRadius: '3px',
              fontFamily: 'monospace',
              fontSize: '14px'
            }
          },
            React.createElement('pre', null, JSON.stringify(walletData, null, 2))
          )
        )
      )
    )
  );
}
*/

// Commented out old test code above - now using real App.jsx
