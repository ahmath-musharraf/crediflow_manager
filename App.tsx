import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import CustomerLedger from './components/CustomerLedger';
import Inventory from './components/Inventory';
import ShopSelector from './components/ShopSelector';
import { User, ViewState, Shop, Role } from './types';
import { db } from './services/mockDb';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    const initDb = async () => {
      // Race condition: If DB init hangs (e.g. bad connection string), 
      // timeout after 2 seconds so the app still loads (in offline mode).
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));
      
      try {
        await Promise.race([db.init(), timeoutPromise]);
      } catch (e) {
        console.warn("DB Init timed out or failed", e);
      } finally {
         // ALWAYS set ready, so the app unblocks
         setIsDbReady(true);
      }
    };
    initDb();
  }, []);

  // Handle successful login or shop selection
  const handleLoginSuccess = (authenticatedUser: User, shop: Shop | null) => {
    // If not logged in yet, set the user
    if (!user) {
      setUser(authenticatedUser);
    }
    // If a shop was selected (either via login or super admin selection), set it
    if (shop) {
      setSelectedShop(shop);
      setCurrentView('DASHBOARD');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedShop(null);
  };

  if (!isDbReady) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-100">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 font-medium">Connecting to Database...</p>
        <p className="text-xs text-gray-400 mt-2">If this takes too long, we'll start in Offline Mode.</p>
      </div>
    );
  }

  // 1. Not Logged In
  if (!user) {
    return <ShopSelector onLoginSuccess={handleLoginSuccess} isSelectionMode={false} />;
  }

  // 2. Logged In but No Shop Selected (e.g. Super Admin initial state)
  if (!selectedShop) {
    return (
      <ShopSelector 
        onLoginSuccess={handleLoginSuccess} 
        isSelectionMode={user.role === Role.SUPER_ADMIN} 
        onLogout={handleLogout}
      />
    );
  }

  // 3. Main App Layout
  // Note: user and selectedShop are guaranteed not null here due to above checks
  const renderContent = () => {
    const currentUser = user!;
    const currentShop = selectedShop!;

    switch (currentView) {
      case 'DASHBOARD': return <Dashboard user={currentUser} currentShop={currentShop} />;
      case 'POS': return <POS user={currentUser} currentShop={currentShop} />;
      case 'CUSTOMERS': return <CustomerLedger user={currentUser} currentShop={currentShop} />;
      case 'INVENTORY': return <Inventory user={currentUser} currentShop={currentShop} />;
      default: return <Dashboard user={currentUser} currentShop={currentShop} />;
    }
  };

  return (
    <Layout 
      user={user!} 
      currentShop={selectedShop!}
      currentView={currentView} 
      onNavigate={setCurrentView}
      onLogout={handleLogout}
      onSwitchShop={() => setSelectedShop(null)}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;