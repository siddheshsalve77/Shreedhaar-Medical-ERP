import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import POS from './components/POS';
import SalesHistory from './components/SalesHistory';
import { ViewState } from './types';
import { Menu, X } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { isAuthenticated, notifications, removeNotification } = useApp();
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'DASHBOARD': return <Dashboard />;
      case 'INVENTORY': return <Inventory />;
      case 'POS': return <POS />;
      case 'SALES_HISTORY': return <SalesHistory />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden relative">
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden bg-teal-800 text-white p-4 flex items-center justify-between shadow-md">
            <span className="font-bold text-lg">Shreedhar Medical</span>
            <button onClick={() => setIsSidebarOpen(true)}>
                <Menu />
            </button>
        </div>

        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>

        {/* Global Notifications - Fixed Top Right */}
        <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 w-80 pointer-events-none">
            {notifications.map(n => (
            <div 
                key={n.id} 
                className={`pointer-events-auto flex items-start justify-between p-4 rounded-lg shadow-2xl border-l-4 transform transition-all duration-300 animate-in slide-in-from-right fade-in ${
                n.type === 'alert' || n.type === 'warning' 
                    ? 'bg-white border-red-500 text-gray-800' 
                    : 'bg-white border-teal-500 text-gray-800'
                }`}
            >
                <div className="flex-1 pr-2 text-sm font-medium">{n.message}</div>
                <button 
                onClick={() => removeNotification(n.id)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                <X size={18} />
                </button>
            </div>
            ))}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
};

export default App;
