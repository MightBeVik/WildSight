import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Landing from './components/Landing';
import Upload from './components/Upload';
import Video from './components/Video';
import Results from './components/Results';
import Dashboard from './components/Dashboard';
import Gallery from './components/Gallery';
import { api } from './services/api';

function App() {
  const [activePage, setActivePage] = useState('home');
  const [results, setResults] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [apiStatus, setApiStatus] = useState('checking');
  const [theme, setTheme] = useState(() => localStorage.getItem('wildsight-theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wildsight-theme', theme);
  }, [theme]);

  // Check API connection on mount
  useEffect(() => {
    const checkApi = async () => {
      try {
        await api.healthCheck();
        setApiStatus('online');
      } catch {
        setApiStatus('offline');
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 30000);
    return () => clearInterval(interval);
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const handleProcessed = useCallback((result) => {
    setResults(prev => [...prev, result]);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <Landing setActivePage={setActivePage} apiStatus={apiStatus} />;
      case 'images':
        return <Upload onProcessed={handleProcessed} addToast={addToast} />;
      case 'video':
        return <Video addToast={addToast} />;
      case 'results':
        return <Results results={results} />;
      case 'dashboard':
        return <Dashboard results={results} apiStatus={apiStatus} />;
      case 'gallery':
        return <Gallery results={results} setActivePage={setActivePage} />;
      default:
        return <Landing setActivePage={setActivePage} apiStatus={apiStatus} />;
    }
  };

  return (
    <>
      <Navbar
        activePage={activePage}
        setActivePage={setActivePage}
        apiStatus={apiStatus}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <main>{renderPage()}</main>

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div className={`toast ${toast.type}`} key={toast.id}>
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export default App;
