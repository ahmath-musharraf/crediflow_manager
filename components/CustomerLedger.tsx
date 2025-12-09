import React, { useState, useEffect } from 'react';
import { db } from '../services/mockDb';
import { Customer, CustomerType, User, Shop, ActivityLog } from '../types';

interface StatementItem {
  id: string;
  date: string;
  type: 'SALE' | 'PAYMENT' | 'EXPENSE';
  description: string;
  amount: number; 
  balanceChange: number; // Sale/Expense adds to debt (+), Payment reduces debt (-)
  shopId: string;
  shopName: string;
  runningBalance: number;
}

interface CustomerLedgerProps {
  user: User;
  currentShop: Shop;
}

const CustomerLedger: React.FC<CustomerLedgerProps> = ({ user, currentShop }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  
  // View State
  const [viewMode, setViewMode] = useState<'LIST' | 'ADD_CUSTOMER' | 'EDIT_CUSTOMER'>('LIST');

  // Tab State
  const [activeTab, setActiveTab] = useState<'STATEMENT' | 'ACTIVITY'>('STATEMENT');

  // Statement Data
  const [statementData, setStatementData] = useState<StatementItem[]>([]);
  const [shopBalances, setShopBalances] = useState<Record<string, number>>({});
  const [summaryStats, setSummaryStats] = useState({ totalBilled: 0, totalPaid: 0 });
  
  // Activity Log Data
  const [customerActivities, setCustomerActivities] = useState<ActivityLog[]>([]);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Forms
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', date: new Date().toISOString().split('T')[0] });

  // WhatsApp Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [whatsAppNumber, setWhatsAppNumber] = useState('');

  const [editPhone, setEditPhone] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  // New Customer Form State
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    shopName: '',
    location: '',
    whatsapp: '',
    creditLimit: ''
  });
  const [isWhatsappSame, setIsWhatsappSame] = useState(true);

  // Edit Customer Form State
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    shopName: '',
    location: '',
    whatsapp: '',
    creditLimit: ''
  });

  useEffect(() => {
    setCustomers(db.getCustomers().filter(c => c.type === CustomerType.WHOLESALE));
    setShops(db.getShops());
  }, []);

  useEffect(() => {
    if (selectedCustId) {
      loadCustomerData(selectedCustId);
    }
  }, [selectedCustId, customers, currentShop.id]);

  const getShopName = (id: string) => shops.find(s => s.id === id)?.name || id;

  const loadCustomerData = (custId: string, customerList = customers) => {
    const cust = customerList.find(c => c.id === custId);
    if (cust) {
      setEditPhone(cust.phone);
      setSaveStatus('idle');
      
      const transactions = db.getTransactionsByCustomer(custId);
      const payments = db.getPaymentsByCustomer(custId);
      const expenses = db.getExpensesByCustomer(custId);
      const activities = db.getActivitiesByCustomer(custId);

      setCustomerActivities(activities);

      // Calculate Balance Per Shop
      const balances: Record<string, number> = {};
      shops.forEach(s => balances[s.id] = 0);

      transactions.forEach(t => {
        if (balances[t.shopId] === undefined) balances[t.shopId] = 0;
        balances[t.shopId] += t.balance; 
      });

      payments.forEach(p => {
        if (balances[p.shopId] === undefined) balances[p.shopId] = 0;
        balances[p.shopId] -= p.amount;
      });

      expenses.forEach(e => {
        if (balances[e.shopId] === undefined) balances[e.shopId] = 0;
        balances[e.shopId] += e.amount; // Expenses increase debt
      });
      
      setShopBalances(balances);

      // Merge Statement Items
      const items: StatementItem[] = [
        ...transactions.map(t => ({
          id: t.id,
          date: t.date,
          type: 'SALE' as const,
          description: `Invoice #${t.id.slice(-4)}`,
          amount: t.totalAmount,
          balanceChange: t.balance, 
          shopId: t.shopId,
          shopName: getShopName(t.shopId),
          runningBalance: 0
        })),
        ...payments.map(p => ({
          id: p.id,
          date: p.date,
          type: 'PAYMENT' as const,
          description: `Payment Received`,
          amount: p.amount,
          balanceChange: -p.amount,
          shopId: p.shopId,
          shopName: getShopName(p.shopId),
          runningBalance: 0
        })),
        ...expenses.map(e => ({
          id: e.id,
          date: e.date,
          type: 'EXPENSE' as const,
          description: `Expense: ${e.description}`,
          amount: e.amount,
          balanceChange: e.amount, // Increases debt
          shopId: e.shopId,
          shopName: getShopName(e.shopId),
          runningBalance: 0
        }))
      ];

      // Sort Chronologically (Oldest First)
      items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let currentBalance = 0;
      let totalBilled = 0;
      let totalPaid = 0;

      const itemsWithBalance = items.map(item => {
        currentBalance += item.balanceChange;
        
        if (item.type === 'SALE' || item.type === 'EXPENSE') totalBilled += item.amount;
        if (item.type === 'PAYMENT') totalPaid += item.amount;

        return { ...item, runningBalance: currentBalance };
      });

      setStatementData(itemsWithBalance);
      setSummaryStats({ totalBilled, totalPaid });
    }
  };

  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) {
      alert('Name and Phone are required');
      return;
    }

    const waNumber = isWhatsappSame ? newCustomer.phone : newCustomer.whatsapp;

    const newCust: Customer = {
      id: `CUST-${Date.now()}`,
      name: newCustomer.name,
      phone: newCustomer.phone,
      type: CustomerType.WHOLESALE,
      shopName: newCustomer.shopName,
      location: newCustomer.location,
      whatsapp: waNumber,
      creditLimit: parseFloat(newCustomer.creditLimit) || 0,
      totalDebt: 0
    };

    db.addCustomer(newCust, user); 
    const updatedList = db.getCustomers().filter(c => c.type === CustomerType.WHOLESALE);
    setCustomers(updatedList);
    setViewMode('LIST');
    setSelectedCustId(newCust.id);
    setNewCustomer({ name: '', phone: '', shopName: '', location: '', whatsapp: '', creditLimit: '' });
    setIsWhatsappSame(true);
  };

  const openEditCustomer = () => {
    const cust = customers.find(c => c.id === selectedCustId);
    if (!cust) return;
    setEditFormData({
      name: cust.name,
      phone: cust.phone,
      shopName: cust.shopName || '',
      location: cust.location || '',
      whatsapp: cust.whatsapp || '',
      creditLimit: cust.creditLimit?.toString() || ''
    });
    setViewMode('EDIT_CUSTOMER');
  };

  const handleEditCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustId) return;

    db.updateCustomer(selectedCustId, {
      name: editFormData.name,
      phone: editFormData.phone,
      shopName: editFormData.shopName,
      location: editFormData.location,
      whatsapp: editFormData.whatsapp,
      creditLimit: parseFloat(editFormData.creditLimit) || 0
    }, user);

    const updatedList = db.getCustomers().filter(c => c.type === CustomerType.WHOLESALE);
    setCustomers(updatedList);
    loadCustomerData(selectedCustId, updatedList);
    setViewMode('LIST');
  };

  const handleWhatsAppReminder = () => {
    const cust = customers.find(c => c.id === selectedCustId);
    if (!cust) return;
    
    const phoneToUse = cust.whatsapp || cust.phone;
    if (!phoneToUse) {
      alert('No WhatsApp or Phone number available.');
      return;
    }

    const phone = phoneToUse.replace(/\D/g, ''); 
    setWhatsAppNumber(phone);
    
    const breakdown = Object.entries(shopBalances)
      .filter(([_, amount]) => amount > 0)
      .map(([shopId, amount]) => `📍 *${getShopName(shopId)}:* Rs. ${amount.toLocaleString()}`)
      .join('\n');

    // Use \n for line breaks so textarea displays them correctly
    const messageText = `👋 Hello *${cust.name}*,\n\n` +
      `This is a friendly reminder from *CrediFlow Group* regarding your account status. 🧾\n\n` +
      `💰 *Total Outstanding: Rs. ${cust.totalDebt.toLocaleString()}*\n\n` +
      `🔍 *Breakdown by Shop:*\n${breakdown}\n\n` +
      `We value your partnership! Please arrange for the payment at your earliest convenience. 🏦\n\n` +
      `Thank you! ✨`;

    setWhatsAppMessage(messageText);
    setShowWhatsAppModal(true);
  };

  const sendWhatsApp = () => {
    const encodedMsg = encodeURIComponent(whatsAppMessage);
    window.open(`https://wa.me/${whatsAppNumber}?text=${encodedMsg}`, '_blank');
    setShowWhatsAppModal(false);
  };

  const handlePaymentSubmit = () => {
    if (selectedCustId && payAmount) {
      db.recordPayment(selectedCustId, parseFloat(payAmount), user, currentShop.id); 
      const updatedCustomers = db.getCustomers().filter(c => c.type === CustomerType.WHOLESALE);
      setCustomers(updatedCustomers);
      loadCustomerData(selectedCustId, updatedCustomers);
      setShowPayModal(false);
      setPayAmount('');
    }
  };

  const handleExpenseSubmit = () => {
    if (selectedCustId && expenseForm.amount && expenseForm.description) {
      db.recordExpense(selectedCustId, expenseForm.description, parseFloat(expenseForm.amount), expenseForm.date, user, currentShop.id);
      const updatedCustomers = db.getCustomers().filter(c => c.type === CustomerType.WHOLESALE);
      setCustomers(updatedCustomers);
      loadCustomerData(selectedCustId, updatedCustomers);
      setShowExpenseModal(false);
      setExpenseForm({ description: '', amount: '', date: new Date().toISOString().split('T')[0] });
    }
  };

  const handleSavePhone = () => {
    if (selectedCustId) {
      db.updateCustomer(selectedCustId, { phone: editPhone }, user); 
      const updatedList = db.getCustomers().filter(c => c.type === CustomerType.WHOLESALE);
      setCustomers(updatedList);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleExportCSV = () => {
    const csvRows = [];
    const headers = ['Name', 'Phone', 'Shop Name', 'Location', 'WhatsApp', 'Credit Limit', 'Total Debt (Rs)'];
    csvRows.push(headers.join(','));

    for (const customer of customers) {
      const row = [
        `"${customer.name.replace(/"/g, '""')}"`,
        `"${customer.phone.replace(/"/g, '""')}"`,
        `"${(customer.shopName || '').replace(/"/g, '""')}"`,
        `"${(customer.location || '').replace(/"/g, '""')}"`,
        `"${(customer.whatsapp || '').replace(/"/g, '""')}"`,
        customer.creditLimit || 0,
        customer.totalDebt
      ];
      csvRows.push(row.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wholesale_customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => {
    const cust = customers.find(c => c.id === selectedCustId);
    if (!cust) return;

    const printWindow = window.open('', '', 'height=800,width=800');
    if (!printWindow) return;

    const sortedForPrint = [...statementData];

    const rows = sortedForPrint.map(item => {
      const debit = (item.type === 'SALE' || item.type === 'EXPENSE') ? item.amount : 0;
      const credit = item.type === 'PAYMENT' ? item.amount : 0;
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(item.date).toLocaleDateString()}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.shopName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.description}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; color: #dc2626;">${debit ? debit.toLocaleString() : '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; color: #16a34a;">${credit ? credit.toLocaleString() : '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">${item.runningBalance.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Statement - ${cust.name}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
            th { background: #f3f4f6; text-align: left; padding: 10px; border-bottom: 2px solid #ddd; font-weight: bold; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 20px; background: #f9fafb; padding: 15px; border-radius: 8px; }
            .summary { display: flex; justify-content: flex-end; gap: 30px; margin-top: 20px; font-size: 14px; }
            .total { text-align: right; font-size: 1.4em; font-weight: bold; margin-top: 20px; color: #dc2626; border-top: 2px solid #333; padding-top: 10px; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin:0;">CREDIFLOW GROUP</h1>
            <p style="margin:5px 0 0 0;">Wholesale & Retail Management Statement</p>
          </div>
          <div class="meta">
            <div>
              <div style="font-size:12px; color:#666;">BILL TO</div>
              <strong style="font-size:16px;">${cust.name}</strong><br>
              ${cust.shopName ? `${cust.shopName}<br>` : ''}
              ${cust.location ? `${cust.location}<br>` : ''}
              Phone: ${cust.phone}
            </div>
            <div style="text-align: right;">
              <div style="font-size:12px; color:#666;">STATEMENT DATE</div>
              <strong>${new Date().toLocaleDateString()}</strong><br><br>
              <div style="font-size:12px; color:#666;">ACCOUNT STATUS</div>
              <span style="color: ${cust.totalDebt > 0 ? '#dc2626' : '#16a34a'}; font-weight:bold;">${cust.totalDebt > 0 ? 'OVERDUE' : 'CLEAR'}</span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Shop</th>
                <th>Description</th>
                <th style="text-align: right;">Debit (Dr)</th>
                <th style="text-align: right;">Credit (Cr)</th>
                <th style="text-align: right;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="summary">
            <div>Total Billed: <strong>Rs. ${summaryStats.totalBilled.toLocaleString()}</strong></div>
            <div>Total Paid: <strong>Rs. ${summaryStats.totalPaid.toLocaleString()}</strong></div>
          </div>
          <div class="total">
            Balance Due: Rs. ${cust.totalDebt.toLocaleString()}
          </div>
          <div class="footer">
            Generated by CrediFlow System
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustId);
  const creditLimitVal = (selectedCustomer && typeof selectedCustomer.creditLimit === 'number') ? selectedCustomer.creditLimit : 0;
  const isOverLimit = selectedCustomer && creditLimitVal > 0 && selectedCustomer.totalDebt > creditLimitVal;
  const exceededAmount = selectedCustomer ? selectedCustomer.totalDebt - creditLimitVal : 0;

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm) ||
    (c.shopName && c.shopName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    c.totalDebt.toString().includes(searchTerm) ||
    (typeof c.creditLimit === 'number' && c.creditLimit.toString().includes(searchTerm))
  );

  return (
    <div className="p-6 h-full flex flex-col md:flex-row gap-6">
      
      {/* Sidebar */}
      <div className="w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
        <div className="p-4 border-b bg-gray-50 rounded-t-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">Accounts</h2>
            <div className="flex gap-2">
              <button onClick={handleExportCSV} className="bg-emerald-600 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-700 transition shadow" title="Export CSV">
                <span className="text-sm font-bold">⬇</span>
              </button>
              <button onClick={() => { setViewMode('ADD_CUSTOMER'); setSelectedCustId(null); }} className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-indigo-700 transition shadow" title="Add Customer">
                <span className="text-lg font-bold">+</span>
              </button>
            </div>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
              type="text" 
              placeholder="Search name, shop, phone, amount..." 
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {filteredCustomers.length === 0 ? (
            <div className="text-center text-gray-400 mt-10 text-sm">No customers found</div>
          ) : (
            filteredCustomers.map(c => (
              <div key={c.id} onClick={() => { setSelectedCustId(c.id); setViewMode('LIST'); }} className={`p-4 rounded-lg cursor-pointer transition mb-2 border relative ${selectedCustId === c.id && viewMode === 'LIST' ? 'bg-indigo-50 border-indigo-500' : 'hover:bg-gray-50 border-transparent'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-800">{c.name}</h3>
                    <p className="text-xs text-gray-500 font-medium">{c.shopName}</p>
                  </div>
                  {c.totalDebt > 0 ? (
                     <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">-Rs. {c.totalDebt.toLocaleString()}</span>
                  ) : (
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">Paid</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col relative overflow-hidden">
        
        {viewMode === 'ADD_CUSTOMER' && (
          <div className="p-8 max-w-2xl mx-auto w-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Wholesale Customer</h2>
            <form onSubmit={handleAddCustomerSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input required type="text" value={newCustomer.name} onChange={e => /^[a-zA-Z\s]*$/.test(e.target.value) && setNewCustomer({...newCustomer, name: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. John Doe" />
                  <p className="text-xs text-gray-400 mt-1">Only alphabets and spaces allowed</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
                  <input type="text" value={newCustomer.shopName} onChange={e => setNewCustomer({...newCustomer, shopName: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. John's Textiles" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input required type="text" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. 0771234567" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
                  <div className="flex flex-col sm:flex-row gap-4 mb-2">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input type="radio" name="wa_same" checked={isWhatsappSame} onChange={() => setIsWhatsappSame(true)} className="text-indigo-600 focus:ring-indigo-500" /> Same as Phone
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input type="radio" name="wa_same" checked={!isWhatsappSame} onChange={() => { setIsWhatsappSame(false); setNewCustomer(prev => ({...prev, whatsapp: ''})); }} className="text-indigo-600 focus:ring-indigo-500" /> Different Number
                    </label>
                  </div>
                  {!isWhatsappSame && (
                    <input type="text" value={newCustomer.whatsapp} onChange={e => setNewCustomer({...newCustomer, whatsapp: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none animate-fade-in" placeholder="Enter WhatsApp Number" />
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location / Address</label>
                  <input type="text" value={newCustomer.location} onChange={e => setNewCustomer({...newCustomer, location: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. 123 Main St, Colombo" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (Rs)</label>
                  <input type="number" value={newCustomer.creditLimit} onChange={e => setNewCustomer({...newCustomer, creditLimit: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="50000" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setViewMode('LIST')} className="px-6 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow">Create Customer</button>
              </div>
            </form>
          </div>
        )}

        {viewMode === 'EDIT_CUSTOMER' && (
          <div className="p-8 max-w-2xl mx-auto w-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit Customer Details</h2>
            <form onSubmit={handleEditCustomerSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input required type="text" value={editFormData.name} onChange={e => /^[a-zA-Z\s]*$/.test(e.target.value) && setEditFormData({...editFormData, name: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <p className="text-xs text-gray-400 mt-1">Only alphabets and spaces allowed</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
                  <input type="text" value={editFormData.shopName} onChange={e => setEditFormData({...editFormData, shopName: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input required type="text" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
                  <input type="text" value={editFormData.whatsapp} onChange={e => setEditFormData({...editFormData, whatsapp: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location / Address</label>
                  <input type="text" value={editFormData.location} onChange={e => setEditFormData({...editFormData, location: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (Rs)</label>
                  <input type="number" value={editFormData.creditLimit} onChange={e => setEditFormData({...editFormData, creditLimit: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setViewMode('LIST')} className="px-6 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow">Save Changes</button>
              </div>
            </form>
          </div>
        )}

        {viewMode === 'LIST' && selectedCustomer && (
          <>
            <div className="p-6 border-b bg-gray-50">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-800">{selectedCustomer.name}</h2>
                    {selectedCustomer.shopName && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{selectedCustomer.shopName}</span>}
                    <button onClick={openEditCustomer} className="ml-2 text-gray-400 hover:text-indigo-600 p-1 rounded-full hover:bg-gray-100 transition" title="Edit Details">
                      ✏️
                    </button>
                  </div>
                  {isOverLimit && (
                    <div className="mt-2 bg-red-50 border-l-4 border-red-500 p-3 rounded-r flex items-start gap-3 animate-fade-in">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <h3 className="text-red-800 font-bold text-sm">Credit Limit Exceeded</h3>
                        <p className="text-red-700 text-xs">Limit: Rs. {selectedCustomer.creditLimit?.toLocaleString()} | Exceeded by: <strong className="underline decoration-red-500">Rs. {exceededAmount.toLocaleString()}</strong></p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2"><span className="w-4">📍</span> {selectedCustomer.location || 'No location set'}</div>
                    <div className="flex items-center gap-2">
                      <span className="w-4">📞</span> 
                      {selectedCustomer.phone}
                    </div>
                    {typeof selectedCustomer.creditLimit === 'number' && <div className="flex items-center gap-2"><span className="w-4">💳</span> Limit: Rs. {selectedCustomer.creditLimit.toLocaleString()}</div>}
                  </div>
                  <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
                     <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm min-w-[140px]">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">Total Balance</span>
                        <div className="text-xl font-bold text-red-600">Rs. {selectedCustomer.totalDebt.toLocaleString()}</div>
                     </div>
                     {Object.entries(shopBalances).map(([sId, bal]) => bal !== 0 && (
                        <div key={sId} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm min-w-[140px]">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1 truncate">{getShopName(sId)}</span>
                          <div className={`text-xl font-bold ${bal > 0 ? 'text-orange-600' : 'text-green-600'}`}>{bal > 0 ? `-Rs. ${bal.toLocaleString()}` : `+Rs. ${Math.abs(bal).toLocaleString()}`}</div>
                        </div>
                     ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 justify-center min-w-[160px]">
                  <button onClick={() => setShowPayModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm font-medium transition flex items-center justify-center gap-2"><span>💵</span> Receive Payment</button>
                  <button onClick={() => setShowExpenseModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg shadow-sm font-medium transition flex items-center justify-center gap-2"><span>📉</span> Add Expense</button>
                  <button onClick={handleWhatsAppReminder} className="bg-[#25D366] hover:bg-[#128C7E] text-white px-4 py-2 rounded-lg shadow-sm font-medium transition flex items-center justify-center gap-2"><span>✆</span> WhatsApp</button>
                  <button onClick={handlePrintPDF} className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg shadow-sm font-medium transition flex items-center justify-center gap-2"><span>📄</span> Download PDF</button>
                </div>
              </div>
            </div>

            <div className="flex border-b border-gray-200 bg-white">
              <button onClick={() => setActiveTab('STATEMENT')} className={`flex-1 py-3 text-sm font-medium text-center transition ${activeTab === 'STATEMENT' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Financial Statement</button>
              <button onClick={() => setActiveTab('ACTIVITY')} className={`flex-1 py-3 text-sm font-medium text-center transition ${activeTab === 'ACTIVITY' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Activity Log</button>
            </div>

            <div className="flex-1 overflow-y-auto p-0">
              {activeTab === 'STATEMENT' ? (
                <>
                  <div className="px-6 py-3 bg-gray-50 border-b flex justify-between text-xs text-gray-500">
                     <span>History (Oldest to Newest)</span>
                     <div className="flex gap-4">
                        <span>Total Billed: <strong>Rs. {summaryStats.totalBilled.toLocaleString()}</strong></span>
                        <span>Total Paid: <strong>Rs. {summaryStats.totalPaid.toLocaleString()}</strong></span>
                     </div>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                      <tr>
                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Shop</th>
                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="py-3 px-6 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Debit (Rs)</th>
                        <th className="py-3 px-6 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Credit (Rs)</th>
                        <th className="py-3 px-6 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-l border-gray-200 bg-gray-100">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {statementData.length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-gray-400">No financial history found</td></tr>
                      ) : (
                        statementData.map((item) => (
                          <tr key={`${item.type}-${item.id}`} className="hover:bg-gray-50 transition group">
                            <td className="py-3 px-6 text-sm text-gray-600 whitespace-nowrap">{new Date(item.date).toLocaleDateString()}</td>
                            <td className="py-3 px-6 text-sm"><span className="px-2 py-1 rounded bg-gray-100 text-xs font-medium text-gray-600">{item.shopName}</span></td>
                            <td className="py-3 px-6 text-sm"><span className={`font-medium ${item.type === 'PAYMENT' ? 'text-green-700' : 'text-gray-800'}`}>{item.description}</span></td>
                            <td className="py-3 px-6 text-sm text-right font-medium text-red-600">{(item.type === 'SALE' || item.type === 'EXPENSE') ? item.amount.toLocaleString() : '-'}</td>
                            <td className="py-3 px-6 text-sm text-right font-medium text-green-600">{item.type === 'PAYMENT' ? item.amount.toLocaleString() : '-'}</td>
                            <td className="py-3 px-6 text-sm text-right font-bold text-gray-800 border-l border-gray-100 bg-gray-50 group-hover:bg-gray-100">Rs. {item.runningBalance.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </>
              ) : (
                <div className="p-0">
                   {customerActivities.length === 0 ? (
                      <div className="p-8 text-center text-gray-400">No activity logs recorded for this customer.</div>
                   ) : (
                      <ul className="divide-y divide-gray-100">
                        {customerActivities.map(log => (
                          <li key={log.id} className="p-4 hover:bg-gray-50 flex gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 font-bold ${log.action === 'SALE' ? 'bg-green-500' : log.action === 'PAYMENT' ? 'bg-indigo-500' : log.action.includes('EXPENSE') ? 'bg-red-400' : 'bg-blue-400'}`}>
                              {log.action === 'SALE' ? '💲' : log.action === 'PAYMENT' ? '💵' : log.action.includes('EXPENSE') ? '📉' : '📝'}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <span className="font-semibold text-gray-800">{log.action.replace('_', ' ')}</span>
                                <span className="text-xs text-gray-400">{new Date(log.date).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{log.description}</p>
                              <div className="flex gap-2 mt-2">
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">User: {log.performedBy}</span>
                                {log.shopName && <span className="text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded">Shop: {log.shopName}</span>}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                   )}
                </div>
              )}
            </div>
          </>
        )}

        {viewMode === 'LIST' && !selectedCustomer && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-5xl mb-4">📒</span>
            <p className="text-lg">Select a customer to view their ledger</p>
            <button onClick={() => setViewMode('ADD_CUSTOMER')} className="mt-4 text-indigo-600 hover:underline">Or create a new customer</button>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-96 animate-fade-in">
            <h3 className="text-xl font-bold mb-1 text-gray-800">Receive Payment</h3>
            <p className="text-sm text-gray-500 mb-6">From: {selectedCustomer?.name}</p>
            <div className="mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
               <p className="text-xs text-yellow-800 font-bold mb-1">CURRENT SHOP</p>
               <p className="text-sm text-gray-700">Receiving for: <span className="font-bold text-indigo-700">{currentShop.name}</span></p>
            </div>
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Payment Amount (LKR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Rs.</span>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-lg font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00" autoFocus />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowPayModal(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">Cancel</button>
              <button onClick={handlePaymentSubmit} className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-lg shadow-green-200 transition">Confirm Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-96 animate-fade-in">
            <h3 className="text-xl font-bold mb-1 text-gray-800">Record Expense</h3>
            <p className="text-sm text-gray-500 mb-6">Charge to: {selectedCustomer?.name}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                <input type="text" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Transport Charges" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Amount (LKR)</label>
                <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                <input type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowExpenseModal(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">Cancel</button>
              <button onClick={handleExpenseSubmit} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 transition">Save Expense</button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Preview Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-[500px] animate-fade-in flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
              <span className="text-[#25D366]">✆</span> Send WhatsApp Reminder
            </h3>
            
            <div className="flex-1 overflow-hidden flex flex-col">
               <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Message Preview (Editable)</label>
               <textarea 
                 value={whatsAppMessage}
                 onChange={(e) => setWhatsAppMessage(e.target.value)}
                 className="w-full flex-1 p-4 border border-gray-200 rounded-lg text-sm font-sans focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none h-64 bg-gray-50"
               />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowWhatsAppModal(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">Cancel</button>
              <button onClick={sendWhatsApp} className="px-5 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-lg font-bold shadow-lg shadow-green-100 transition flex items-center gap-2">
                <span>🚀</span> Send Now
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CustomerLedger;