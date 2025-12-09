import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import CustomerLedger from './components/CustomerLedger';
import Inventory from './components/Inventory';
import ShopSelector from './components/ShopSelector';
import { User, ViewState, Shop, Role } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');

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

  // 1. Not Logged In: Show Shop Selector (Login Mode)
  if (!user) {
    return <ShopSelector onLoginSuccess={handleLoginSuccess} isSelectionMode={false} />;
  }

  // 2. Logged In (Super Admin) BUT No Shop Selected: Show Shop Selector (Selection Mode)
  if (user.role === Role.SUPER_ADMIN && !selectedShop) {
    return (
      <ShopSelector 
        onLoginSuccess={handleLoginSuccess} 
        isSelectionMode={true} 
        onLogout={handleLogout}
      />
    );
  }

  // 3. Main App Layout
  // Note: the non-null assertion (!) is safe here because of the checks above
  const renderContent = () => {
    if (!selectedShop) return null; 

    switch (currentView) {
      case 'DASHBOARD': return <Dashboard user={user} currentShop={selectedShop} />;
      case 'POS': return <POS user={user} currentShop={selectedShop} />;
      case 'CUSTOMERS': return <CustomerLedger user={user} currentShop={selectedShop} />;
      case 'INVENTORY': return <Inventory user={user} currentShop={selectedShop} />;
      default: return <Dashboard user={user} currentShop={selectedShop} />;
    }
  };

  return (
    <Layout 
      user={user} 
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
