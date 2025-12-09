
import React, { useState } from 'react';
import { Shop, User, Role } from '../types';
import { db, authenticate, authenticateShop } from '../services/mockDb';

interface ShopSelectorProps {
  onLoginSuccess: (user: User, shop: Shop | null) => void;
  isSelectionMode?: boolean; // If true, skips password check (for Super Admin)
  onLogout?: () => void;
}

const ShopSelector: React.FC<ShopSelectorProps> = ({ onLoginSuccess, isSelectionMode = false, onLogout }) => {
  const shops = db.getShops();
  const [showShopLogin, setShowShopLogin] = useState<string | null>(null); // shopId
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleShopClick = (shop: Shop) => {
    if (isSelectionMode) {
      // Direct selection for Super Admin (bypass password)
      // We pass a placeholder user object because App.tsx already holds the real Super Admin user state
      onLoginSuccess({ id: 'temp', username: 'temp', role: Role.SUPER_ADMIN }, shop);
    } else {
      // Normal Login Mode: Show password modal
      setShowShopLogin(shop.id);
      setPassword('');
      setError('');
    }
  };

  const handleAdminClick = () => {
    setShowAdminLogin(true);
    setUsername('');
    setPassword('');
    setError('');
  };

  const submitShopLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showShopLogin) return;
    
    const user = authenticateShop(showShopLogin, password);
    if (user) {
      const shop = shops.find(s => s.id === showShopLogin) || null;
      onLoginSuccess(user, shop);
    } else {
      setError('Invalid password (Try: 1234)');
    }
  };

  const submitAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = authenticate(username, password);
    if (user) {
      onLoginSuccess(user, null); // Super admin selects shop later
    } else {
      setError('Invalid credentials (Try: admin/admin)');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 animate-fade-in relative">
      
      {/* Back Button (Only in Selection Mode) */}
      {isSelectionMode && onLogout && (
        <button 
          onClick={onLogout}
          className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 text-gray-600 bg-white rounded-lg shadow-sm hover:bg-gray-50 hover:text-indigo-600 transition-all font-medium z-10"
        >
          <span>←</span> Logout
        </button>
      )}

      {/* Super Admin Login Button (Only in Login Mode) */}
      {!isSelectionMode && (
        <button 
          onClick={handleAdminClick}
          className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 text-white bg-slate-800 rounded-lg shadow-sm hover:bg-slate-900 transition-all font-medium z-10 text-sm"
        >
          <span>🔐</span> Super Admin Login
        </button>
      )}

      <div className="text-center mb-10 mt-12 md:mt-0">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">CrediFlow Manager</h1>
        <p className="text-gray-500">
          {isSelectionMode ? 'Welcome back! Select a shop to manage.' : 'Select your shop to login'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full">
        {shops.map((shop) => (
          <button
            key={shop.id}
            onClick={() => handleShopClick(shop)}
            className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group border border-gray-200 hover:border-indigo-300 flex flex-col items-center text-center h-64 relative"
          >
            <div className={`w-full h-24 ${shop.color} flex items-center justify-center`}>
              <span className="text-4xl">
                {shop.type === 'WHOLESALE' ? '🏭' : shop.type === 'RETAIL' ? '🛍️' : '🏪'}
              </span>
            </div>
            
            <div className="p-6 flex-1 flex flex-col justify-between w-full">
              <div>
                <h3 className="font-bold text-xl text-gray-800 group-hover:text-indigo-600 transition-colors">
                  {shop.name}
                </h3>
                <span className="inline-block mt-2 px-3 py-1 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full uppercase tracking-wider">
                  {shop.type}
                </span>
              </div>
              
              <div className="w-full bg-gray-50 py-2 rounded-lg text-sm text-gray-400 font-medium group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                {isSelectionMode ? 'Manage Shop →' : 'Click to Login →'}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Shop Login Modal */}
      {showShopLogin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-96 animate-fade-in relative">
            <button onClick={() => setShowShopLogin(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            <div className="text-center mb-6">
               <h3 className="text-2xl font-bold text-gray-800">Shop Login</h3>
               <p className="text-sm text-gray-500">{shops.find(s => s.id === showShopLogin)?.name}</p>
            </div>
            <form onSubmit={submitShopLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Enter Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center text-lg tracking-widest"
                  placeholder="••••"
                  autoFocus
                />
              </div>
              {error && <p className="text-red-500 text-xs text-center font-medium">{error}</p>}
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg">Access Shop</button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-96 animate-fade-in relative">
            <button onClick={() => setShowAdminLogin(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            <div className="text-center mb-6">
               <h3 className="text-2xl font-bold text-gray-800">Super Admin</h3>
               <p className="text-sm text-gray-500">Enter your credentials</p>
            </div>
            <form onSubmit={submitAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="admin"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="••••"
                />
              </div>
              {error && <p className="text-red-500 text-xs text-center font-medium">{error}</p>}
              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg shadow-lg">Login as Owner</button>
            </form>
          </div>
        </div>
      )}
      
      <div className="mt-12 text-gray-400 text-sm text-center">
        <p>CrediFlow Multi-Shop Management System</p>
        <p className="mt-2 text-xs">Create by : <a href="https://mushieditz.vercel.app/" target="_blank" rel="noopener noreferrer" className="font-bold text-gray-500 hover:text-indigo-600 transition-colors">Mushi Editz</a></p>
      </div>
    </div>
  );
};

export default ShopSelector;
