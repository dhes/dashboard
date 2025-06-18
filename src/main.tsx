import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // or './style.css' if using Tailwind via style.css

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
