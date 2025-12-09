
import React, { useEffect, useState } from 'react';
import { db } from '../services/mockDb';
import { User, ActivityLog, Shop } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardProps {
  user: User;
  currentShop: Shop;
}

const Dashboard: React.FC<DashboardProps> = ({ user, currentShop }) => {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalReceivables: 0,
    transactionCount: 0,
    topCustomer: ''
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    // Fetch data specifically for this shop
    const transactions = db.getTransactions(currentShop.id);
    const customers = db.getCustomers(); // Global customers
    const recentActivities = db.getActivities(currentShop.id);

    const totalSales = transactions.reduce((acc, t) => acc + t.totalAmount, 0);
    const totalReceivables = customers.reduce((acc, c) => acc + c.totalDebt, 0); // TODO: Filter debt by shop if needed later
    
    // Simple chart data: Sales by date (last 7 entries for demo)
    const lastTx = [...transactions].reverse().slice(-7);
    const cData = lastTx.map(t => ({
      name: new Date(t.date).toLocaleDateString(undefined, {weekday: 'short'}),
      amount: t.totalAmount
    }));
    setChartData(cData);
    setActivities(recentActivities);

    setStats({
      totalSales,
      totalReceivables,
      transactionCount: transactions.length,
      topCustomer: customers.sort((a,b) => b.totalDebt - a.totalDebt)[0]?.name || 'N/A'
    });

  }, [currentShop.id]);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
          <p className="text-sm text-gray-500">{currentShop.name} ({currentShop.type})</p>
        </div>
        <div className={`px-4 py-2 rounded-lg text-white font-medium ${currentShop.color} shadow-lg`}>
          {currentShop.name}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-sm font-medium text-gray-500 uppercase">Shop Revenue</span>
          <span className="text-3xl font-bold text-green-600">Rs. {stats.totalSales.toLocaleString()}</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-sm font-medium text-gray-500 uppercase">Outstanding Credit</span>
          <span className="text-3xl font-bold text-red-500">Rs. {stats.totalReceivables.toLocaleString()}</span>
          <span className="text-xs text-red-300 mt-1">Global Debt</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-sm font-medium text-gray-500 uppercase">Transactions</span>
          <span className="text-3xl font-bold text-blue-600">{stats.transactionCount}</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-sm font-medium text-gray-500 uppercase">Highest Debt</span>
          <span className="text-xl font-bold text-orange-600 truncate">{stats.topCustomer}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Shop Sales Trends (LKR)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
              <Tooltip 
                formatter={(value: number) => [`Rs. ${value}`, 'Sales']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                cursor={{fill: '#f1f5f9'}}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#4f46e5' : '#818cf8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activity Log Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>📜</span> Recent Shop Activity
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {activities.length === 0 ? (
              <p className="text-gray-400 text-sm">No activity recorded for this shop yet.</p>
            ) : (
              activities.map(log => (
                <div key={log.id} className="flex gap-3 text-sm border-b border-gray-50 pb-3 last:border-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 font-bold text-xs
                    ${log.action === 'SALE' ? 'bg-green-500' : 
                      log.action === 'PAYMENT' ? 'bg-indigo-500' : 
                      log.action.includes('ADD') ? 'bg-blue-500' : 'bg-gray-400'}`}>
                    {log.performedBy.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-800">{log.performedBy}</span>
                      <span className="text-xs text-gray-400">{new Date(log.date).toLocaleString()}</span>
                    </div>
                    <p className="text-gray-600 mt-0.5">{log.description}</p>
                    {log.shopName && <span className="text-xs text-gray-400 bg-gray-100 px-1 rounded">{log.shopName}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
