// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const style = document.createElement('style');
style.textContent = `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; } input, select, textarea, button { font-family: inherit; }`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
