import React from 'react';
import { User, Role, ViewState, Shop } from '../types';
import { db } from '../services/mockDb';

interface LayoutProps {
  user: User;
  currentShop: Shop;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onLogout: () => void;
  onSwitchShop: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, currentShop, currentView, onNavigate, onLogout, onSwitchShop, children }) => {
  const menuItems = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: '📊' },
    { id: 'POS', label: 'New Sale (POS)', icon: '🛒' },
    { id: 'CUSTOMERS', label: 'Credit Ledger', icon: '📒' },
    { id: 'INVENTORY', label: 'Inventory', icon: '📦' },
  ];

  const isSuperAdmin = user.role === Role.SUPER_ADMIN;
  const isOnline = db.usingPostgres;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10 hidden md:flex">
        {/* Brand Area */}
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            CrediFlow
          </h1>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-800 rounded">
              <div className={`w-2 h-2 rounded-full ${currentShop.color}`}></div>
              <p className="text-xs text-white font-medium truncate max-w-[100px]">{currentShop.name}</p>
            </div>
            <div className="flex items-center gap-1" title={isOnline ? "Connected to Neon DB" : "Offline (Local Storage)"}>
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-yellow-500'}`}></div>
              <span className="text-[10px] text-gray-400">{isOnline ? 'DB' : 'Local'}</span>
            </div>
          </div>
          
          {isSuperAdmin && (
            <button 
              onClick={onSwitchShop}
              className="text-[10px] text-blue-400 hover:text-blue-300 mt-2 ml-1 flex items-center gap-1"
            >
              ← Switch Shop
            </button>
          )}
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ViewState)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                currentView === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold">
              {user.username.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-xs text-slate-400 truncate">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full py-2 border border-slate-700 rounded text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-slate-900 text-white p-4 z-20 flex justify-between items-center shadow-lg">
        <div className="flex flex-col">
          <span className="font-bold text-lg">CrediFlow</span>
          <div className="flex items-center gap-2">
             <span className="text-xs text-gray-400">{currentShop.name}</span>
             <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          </div>
        </div>
        <div className="flex gap-3">
          {isSuperAdmin && <button onClick={onSwitchShop} className="text-xs bg-slate-800 px-2 py-1 rounded">Switch</button>}
          <button onClick={onLogout} className="text-xs text-red-300">Logout</button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden md:ml-0 mt-16 md:mt-0">
         {/* Mobile Nav (Bottom) */}
         <div className="md:hidden fixed bottom-0 w-full bg-white border-t flex justify-around p-2 z-20 text-xs shadow-inner">
           {menuItems.map(item => (
             <button key={item.id} onClick={() => onNavigate(item.id as ViewState)} className={`flex flex-col items-center p-2 ${currentView === item.id ? 'text-indigo-600 font-bold' : 'text-gray-500'}`}>
               <span className="text-xl">{item.icon}</span>
               <span>{item.label.split(' ')[0]}</span>
             </button>
           ))}
         </div>

         <div className="flex-1 overflow-y-auto bg-gray-100 pb-20 md:pb-0 flex flex-col">
            <div className="flex-grow">
               {children}
            </div>
            <footer className="py-6 text-center text-xs text-gray-400 border-t border-gray-200 mt-4">
               Create by : <a href="https://mushieditz.vercel.app/" target="_blank" rel="noopener noreferrer" className="font-bold text-gray-500 hover:text-indigo-600 transition-colors">Mushi Editz</a>
            </footer>
         </div>
      </main>
    </div>
  );
};

export default Layout;