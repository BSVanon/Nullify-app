// Import React from CDN URLs in the browser
import React from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18/client';

// Simple test component
function App() {
  return React.createElement('div', { 
    style: { 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f0f0f0'
    }
  },
    React.createElement('h1', { 
      style: { color: '#FF007A' } 
    }, 'NukeNote'),
    React.createElement('p', null, 'React is working! ES6 modules work!'),
    React.createElement('div', { 
      style: { 
        marginTop: '20px', 
        padding: '10px', 
        border: '2px solid #39C4D6', 
        borderRadius: '5px',
        backgroundColor: 'white'
      }
    },
      React.createElement('h2', null, 'Status: Ready'),
      React.createElement('p', null, 'BRC-7 Wallet Integration Test'),
      React.createElement('button', {
        style: {
          backgroundColor: '#FF007A',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '5px',
          cursor: 'pointer',
          marginTop: '10px'
        }
      }, 'Test Wallet')
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
