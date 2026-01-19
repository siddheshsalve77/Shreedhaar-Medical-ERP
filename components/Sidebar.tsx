import React from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, ShoppingCart, Package, LogOut, History } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, isOpen, setIsOpen }) => {
  const { logout } = useApp();

  const menuItems = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'POS', label: 'Billing (POS)', icon: ShoppingCart },
    { id: 'INVENTORY', label: 'Inventory', icon: Package },
    { id: 'SALES_HISTORY', label: 'Sales History', icon: History },
  ];

  const handleNav = (view: string) => {
    setView(view as ViewState);
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:flex-shrink-0 w-64 bg-teal-900 text-white transition-transform duration-300 ease-in-out z-30 flex flex-col shadow-xl`}>
        <div className="p-6 border-b border-teal-800">
          <h2 className="text-2xl font-bold tracking-wide">Shreedhar<br/><span className="text-teal-300 text-lg">Medical</span></h2>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  currentView === item.id 
                    ? 'bg-teal-700 text-white shadow-md' 
                    : 'text-teal-100 hover:bg-teal-800'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-teal-800 bg-teal-950">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-900/30 text-red-200 rounded-lg hover:bg-red-900 hover:text-white transition-colors border border-red-900/50"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
