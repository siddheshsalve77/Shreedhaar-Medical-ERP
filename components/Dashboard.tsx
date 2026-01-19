import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { TrendingUp, DollarSign, AlertTriangle, Calendar, Package, X, RotateCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type ModalType = 'REVENUE' | 'PROFIT' | 'COLLECTION' | 'TODAY_PROFIT' | 'EXPIRY' | null;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Dashboard: React.FC = () => {
  const { sales, products, hardReset } = useApp();
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const stats = useMemo(() => {
    const start = new Date(startDate); start.setHours(0,0,0,0);
    const end = new Date(endDate); end.setHours(23,59,59,999);
    
    const rangeSales = sales.filter(s => { const t = new Date(s.timestamp); return t >= start && t <= end; });
    const todayStr = new Date().toDateString();
    const todaySales = sales.filter(s => new Date(s.timestamp).toDateString() === todayStr);
    const todayDate = new Date();
    const expiringProducts = products.filter(p => new Date(p.expiryDate) < todayDate);
    const lowStockItems = products.filter(p => p.stock < 10);

    return {
        revenue: rangeSales.reduce((acc, curr) => acc + curr.totalAmount, 0),
        profit: rangeSales.reduce((acc, curr) => acc + curr.totalProfit, 0),
        todayCollection: todaySales.reduce((acc, curr) => acc + curr.totalAmount, 0),
        todayProfit: todaySales.reduce((acc, curr) => acc + curr.totalProfit, 0),
        expiryStockValue: expiringProducts.reduce((acc, curr) => acc + (curr.buyPrice * curr.stock), 0),
        rangeSalesList: rangeSales, todaySalesList: todaySales, expiringList: expiringProducts, lowStockItems
    };
  }, [sales, products, startDate, endDate]);

  const lineChartData = useMemo(() => {
    const data = [];
    const start = new Date(startDate); const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayString = d.toDateString();
        const daySales = sales.filter(s => new Date(s.timestamp).toDateString() === dayString);
        data.push({ name: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), revenue: daySales.reduce((acc, curr) => acc + curr.totalAmount, 0) });
    }
    return data;
  }, [sales, startDate, endDate]);

  const pieChartData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    stats.rangeSalesList.forEach(sale => {
      sale.items.forEach(item => {
         const current = categoryMap.get(item.category) || 0;
         categoryMap.set(item.category, current + (item.sellPrice * item.quantity));
      });
    });
    return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  }, [stats.rangeSalesList]);

  const renderModalContent = () => {
      if (activeModal === 'EXPIRY') {
          return (
              <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100"><tr><th className="p-2">Name</th><th className="p-2">Batch</th><th className="p-2">Stock</th><th className="p-2">Cost</th></tr></thead>
                  <tbody>
                      {stats.expiringList.map(p => (
                          <tr key={p.id} className="border-b"><td className="p-2">{p.name}</td><td className="p-2">{p.batch}</td><td className="p-2">{p.stock}</td><td className="p-2 text-red-600">₹{p.buyPrice * p.stock}</td></tr>
                      ))}
                      {stats.expiringList.length === 0 && <tr><td colSpan={4} className="p-4 text-center">No expired items.</td></tr>}
                  </tbody>
              </table>
          )
      }
      const listToShow = (activeModal === 'TODAY_PROFIT' || activeModal === 'COLLECTION') ? stats.todaySalesList : stats.rangeSalesList;
      return (
          <table className="w-full text-left text-sm">
              <thead className="bg-gray-100"><tr><th className="p-2">Time</th><th className="p-2">Customer</th><th className="p-2">Items</th><th className="p-2">Amount</th></tr></thead>
              <tbody>
                  {listToShow.map(s => (
                      <tr key={s.id} className="border-b">
                          <td className="p-2">{new Date(s.timestamp).toLocaleTimeString()}</td>
                          <td className="p-2">{s.customerName || 'Guest'}</td>
                          <td className="p-2">{s.items.length}</td>
                          <td className="p-2 font-bold text-teal-700">₹{s.totalAmount.toFixed(2)}</td>
                      </tr>
                  ))}
                  {listToShow.length === 0 && <tr><td colSpan={4} className="p-4 text-center">No sales records found.</td></tr>}
              </tbody>
          </table>
      )
  };

  const getModalTitle = () => {
      switch(activeModal) {
          case 'REVENUE': return `Revenue Breakdown (${startDate} to ${endDate})`;
          case 'PROFIT': return `Profit Breakdown (${startDate} to ${endDate})`;
          case 'COLLECTION': return "Today's Collection Details";
          case 'TODAY_PROFIT': return "Today's Profit Details";
          case 'EXPIRY': return "Expired Stock List";
          default: return "";
      }
  };

  const handleReset = async () => {
      if (window.confirm("CRITICAL WARNING: This will delete ALL Inventory, Sales, and Categories. This cannot be undone. Proceed?")) {
          const password = prompt("ENTER ADMIN PASSWORD TO CONFIRM FACTORY RESET:");
          if(password === "Medical@123") {
              await hardReset();
          } else if (password !== null) {
              alert("Incorrect Password. Reset aborted.");
          }
      }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h1>
          <div className="flex gap-2 w-full md:w-auto justify-end">
            <button onClick={handleReset} className="flex items-center space-x-2 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 border border-red-200 text-sm font-semibold transition-colors">
                 <RotateCcw size={16} /> <span className="hidden md:inline">Factory Reset</span>
            </button>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200 flex-1 md:flex-none justify-center">
                <Calendar size={18} className="text-gray-500" />
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm bg-transparent outline-none text-gray-700 bg-white w-28" />
                <span className="text-gray-400">-</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm bg-transparent outline-none text-gray-700 bg-white w-28" />
            </div>
          </div>
      </div>
      
      <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div onClick={() => setActiveModal('REVENUE')} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition">
          <div className="flex justify-between items-start">
             <div><p className="text-xs text-gray-500 uppercase font-semibold">Total Revenue</p><h3 className="text-xl font-bold text-gray-900 mt-1">₹{stats.revenue.toFixed(0)}</h3></div>
             <div className="p-2 bg-teal-50 rounded-full text-teal-600"><DollarSign size={20} /></div>
          </div>
        </div>
        <div onClick={() => setActiveModal('PROFIT')} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition">
          <div className="flex justify-between items-start">
             <div><p className="text-xs text-gray-500 uppercase font-semibold">Total Profit</p><h3 className="text-xl font-bold text-gray-900 mt-1">₹{stats.profit.toFixed(0)}</h3></div>
             <div className="p-2 bg-green-50 rounded-full text-green-600"><TrendingUp size={20} /></div>
          </div>
        </div>
        <div onClick={() => setActiveModal('COLLECTION')} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition ring-2 ring-teal-50">
          <div className="flex justify-between items-start">
             <div><p className="text-xs text-gray-500 uppercase font-semibold">Today's Sales</p><h3 className="text-xl font-bold text-teal-700 mt-1">₹{stats.todayCollection.toFixed(0)}</h3></div>
             <div className="p-2 bg-blue-50 rounded-full text-blue-600"><Package size={20} /></div>
          </div>
        </div>
        <div onClick={() => setActiveModal('TODAY_PROFIT')} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition">
          <div className="flex justify-between items-start">
             <div><p className="text-xs text-gray-500 uppercase font-semibold">Today's Profit</p><h3 className="text-xl font-bold text-green-700 mt-1">₹{stats.todayProfit.toFixed(0)}</h3></div>
             <div className="p-2 bg-green-50 rounded-full text-green-600"><TrendingUp size={20} /></div>
          </div>
        </div>
        <div onClick={() => setActiveModal('EXPIRY')} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition">
          <div className="flex justify-between items-start">
             <div><p className="text-xs text-gray-500 uppercase font-semibold">Expiry Value</p><h3 className="text-xl font-bold text-red-600 mt-1">₹{stats.expiryStockValue.toFixed(0)}</h3></div>
             <div className="p-2 bg-red-50 rounded-full text-red-600"><AlertTriangle size={20} /></div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Revenue Trend</h3>
                <div className="h-64 md:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                        <YAxis axisLine={false} tickLine={false} fontSize={12} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Line type="monotone" dataKey="revenue" stroke="#008080" strokeWidth={3} dot={{ r: 4, fill: '#008080' }} activeDot={{ r: 6 }} />
                    </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Sales by Category (₹)</h3>
                <div className="h-64 md:h-72">
                    {pieChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieChartData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                                    {pieChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-gray-400">No sales data for pie chart</div>
                    )}
                </div>
            </div>
        </div>

        <div className="lg:col-span-1 bg-white p-0 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[650px] overflow-hidden">
             <div className="p-4 border-b border-gray-100 bg-red-50 flex items-center justify-between">
                <h3 className="font-bold text-red-700 flex items-center gap-2"><AlertTriangle size={18}/> Low Stock Alert</h3>
                <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full font-bold">{stats.lowStockItems.length}</span>
             </div>
             <div className="flex-1 overflow-y-auto">
                 {stats.lowStockItems.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
                         <CheckCircle className="text-green-500 mb-2" size={32}/>
                         <p>Stock levels are healthy.</p>
                     </div>
                 ) : (
                    <div className="divide-y divide-gray-100">
                        {stats.lowStockItems.map(p => (
                            <div key={p.id} className="p-3 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-semibold text-gray-800 text-sm">{p.name}</h4>
                                    <span className="font-bold text-red-600 text-sm bg-red-100 px-2 rounded">{p.stock} left</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <span>{p.category}</span>
                                    <span className="italic">{p.vendor || 'Unknown Vendor'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                 )}
             </div>
        </div>
      </div>

      {activeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                      <h3 className="font-bold text-lg text-gray-800">{getModalTitle()}</h3>
                      <button onClick={() => setActiveModal(null)} className="text-gray-500 hover:text-red-500"><X /></button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1">
                      {renderModalContent()}
                  </div>
                  <div className="p-4 border-t border-gray-200 text-right">
                      <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Close</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

import { CheckCircle } from 'lucide-react';
export default Dashboard;