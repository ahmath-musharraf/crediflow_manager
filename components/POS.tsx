
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockDb';
import { Product, Customer, CustomerType, User, Shop } from '../types';

interface POSProps {
  user: User;
  currentShop: Shop;
}

const POS: React.FC<POSProps> = ({ user, currentShop }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paidAmount, setPaidAmount] = useState<string>('');
  
  useEffect(() => {
    // Fetch products ONLY for current shop
    setProducts(db.getProducts(currentShop.id));
    setCustomers(db.getCustomers());
    
    const retail = db.getCustomers().find(c => c.type === CustomerType.RETAIL);
    if (retail) setSelectedCustomer(retail.id);
  }, [currentShop.id]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const currentCustomer = customers.find(c => c.id === selectedCustomer);
  const isWholesale = currentCustomer?.type === CustomerType.WHOLESALE;

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const price = isWholesale ? item.product.wholesalePrice : item.product.price;
      return sum + (price * item.quantity);
    }, 0);
  };

  const total = calculateTotal();

  const handleCheckout = () => {
    if (cart.length === 0) return;

    const paid = paidAmount === '' ? total : parseFloat(paidAmount);
    const balance = total - paid;
    
    // Create transaction
    db.createTransaction({
      id: `TRX-${Date.now()}`,
      shopId: currentShop.id, // Tag with Shop ID
      customerId: selectedCustomer,
      customerName: currentCustomer?.name || 'Unknown',
      date: new Date().toISOString(),
      items: cart.map(i => ({
        productId: i.product.id,
        name: i.product.name,
        quantity: i.quantity,
        price: isWholesale ? i.product.wholesalePrice : i.product.price
      })),
      totalAmount: total,
      paidAmount: paid,
      balance: balance,
      status: balance <= 0 ? 'PAID' : (paid === 0 ? 'UNPAID' : 'PARTIAL')
    }, user); 

    setCart([]);
    setPaidAmount('');
    
    // Refresh customers to update the Debt/Due amount in the dropdown immediately
    const updatedCustomers = db.getCustomers();
    setCustomers(updatedCustomers);

    alert(`Transaction Complete! ${balance > 0 ? `Added Rs. ${balance.toFixed(2)} to customer balance.` : 'Fully Paid.'}`);
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const currentPaid = paidAmount === '' ? 0 : parseFloat(paidAmount);
  const displayBalance = paidAmount === '' ? 0 : Math.max(0, total - currentPaid);
  
  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 p-4">
      {/* Product List */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <input 
            type="text" 
            placeholder="Search products..." 
            className="flex-1 p-2 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="ml-4 text-xs font-bold text-gray-500 px-3 py-1 bg-gray-100 rounded">
            {currentShop.name}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center text-gray-400 py-10">No products found in this shop.</div>
          ) : (
            filteredProducts.map(product => (
              <div key={product.id} 
                onClick={() => addToCart(product)}
                className="border rounded-lg p-3 cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all group"
              >
                <div className="h-24 bg-gray-100 rounded mb-2 flex items-center justify-center text-gray-400">
                  <span className="text-2xl">📦</span>
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">{product.name}</h3>
                <p className="text-xs text-gray-500">{product.category}</p>
                <div className="flex justify-between items-center mt-2">
                   <span className="text-indigo-600 font-bold text-sm">
                     Rs. {isWholesale ? product.wholesalePrice : product.price}
                   </span>
                   <span className="text-xs bg-gray-200 px-1 rounded text-gray-600">Stock: {product.stock}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Cart / Checkout */}
      <div className="w-full lg:w-96 bg-white rounded-xl shadow-lg border border-gray-100 flex flex-col">
        <div className="p-4 bg-indigo-600 text-white rounded-t-xl">
          <h2 className="font-bold text-lg">Current Bill</h2>
          <p className="text-xs text-indigo-200">{currentShop.name}</p>
        </div>
        
        {/* Customer Selector */}
        <div className="p-4 border-b bg-indigo-50">
          <label className="block text-xs font-semibold text-indigo-800 mb-1">CUSTOMER</label>
          <select 
            value={selectedCustomer} 
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="w-full p-2 border border-indigo-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type}) {c.totalDebt > 0 ? `[Due: Rs. ${c.totalDebt.toLocaleString()}]` : ''}
              </option>
            ))}
          </select>
          {isWholesale && (
             <div className="mt-1 text-xs text-indigo-600 font-medium">
               Wholesale pricing active
             </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              Cart is empty
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <div>
                  <div className="font-medium text-gray-800">{item.product.name}</div>
                  <div className="text-gray-500 text-xs">
                    {item.quantity} x Rs. {isWholesale ? item.product.wholesalePrice : item.product.price}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-700">
                    Rs. {((isWholesale ? item.product.wholesalePrice : item.product.price) * item.quantity).toFixed(2)}
                  </span>
                  <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-600">×</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t space-y-3">
          <div className="flex justify-between text-lg font-bold text-gray-800">
            <span>Total</span>
            <span>Rs. {total.toFixed(2)}</span>
          </div>
          
          <div className="space-y-1">
             <div className="flex justify-between items-end mb-1">
                <label className="text-xs font-semibold text-gray-500">PAYMENT RECEIVED</label>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setPaidAmount(total.toString())}
                    disabled={total === 0}
                    className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium disabled:opacity-50"
                  >
                    Full
                  </button>
                  <button 
                    onClick={() => setPaidAmount((total / 2).toFixed(2))}
                    disabled={total === 0}
                    className="text-[10px] px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 font-medium disabled:opacity-50"
                  >
                    Half
                  </button>
                  <button 
                    onClick={() => setPaidAmount('0')}
                    disabled={total === 0}
                    className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium disabled:opacity-50"
                  >
                    Credit
                  </button>
                </div>
             </div>
             <input 
               type="number" 
               className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
               placeholder={`Full Payment (Rs. ${total})`}
               value={paidAmount}
               onChange={(e) => setPaidAmount(e.target.value)}
             />
          </div>

          <div className="mt-2">
             {(total > 0) && (
                <div className={`flex justify-between text-sm font-semibold p-3 rounded border animate-fade-in ${displayBalance > 0 ? 'text-red-600 bg-red-50 border-red-100' : 'text-green-600 bg-green-50 border-green-100'}`}>
                  <span>{displayBalance > 0 ? 'Balance Due' : 'Status'}</span>
                  <span>{displayBalance > 0 ? `Rs. ${displayBalance.toFixed(2)}` : 'Fully Paid'}</span>
                </div>
             )}
          </div>

          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  );
};

export default POS;
