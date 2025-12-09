
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../services/mockDb';
import { Product, User, Shop } from '../types';

interface InventoryProps {
  user: User;
  currentShop: Shop;
}

type SortKey = 'name' | 'category' | 'price' | 'wholesalePrice' | 'stock';

const Inventory: React.FC<InventoryProps> = ({ user, currentShop }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  
  // Transfer State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({ productName: '', toShopId: '', quantity: '1' });
  
  // Edit State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    price: '',
    wholesalePrice: '',
    stock: '',
    description: ''
  });
  const [editReason, setEditReason] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch products ONLY for current shop
    setProducts(db.getProducts(currentShop.id));
  }, [currentShop.id]);

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());
    return values;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        processCSV(text);
      } catch (err) {
        alert('Failed to parse CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processCSV = (csvText: string) => {
    const lines = csvText.split('\n');
    const newProducts: Product[] = [];
    
    // Check for header row
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('name') && firstLine.includes('price');
    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = parseCSVLine(line);
      
      // Expected format: Name, Category, Retail Price, Wholesale Price, Stock, Description (Optional)
      if (parts.length < 5) continue; 

      const [name, category, price, wholesalePrice, stock, description] = parts;

      if (!name || isNaN(parseFloat(price))) continue;

      newProducts.push({
        id: `CSV-${Date.now()}-${i}`,
        shopId: currentShop.id, // Assign to current shop
        name: name.replace(/^"|"$/g, ''),
        category: category?.replace(/^"|"$/g, '') || 'Uncategorized',
        price: parseFloat(price),
        wholesalePrice: parseFloat(wholesalePrice) || parseFloat(price), // Fallback if missing
        stock: parseInt(stock) || 0,
        description: description?.replace(/^"|"$/g, '') || ''
      });
    }

    if (newProducts.length > 0) {
      db.addProducts(newProducts, user); 
      setProducts(db.getProducts(currentShop.id)); // Refresh filtered list
      alert(`Success! Imported ${newProducts.length} new products into ${currentShop.name}.`);
    } else {
      alert('No valid products found. Please ensure CSV format is: Name, Category, Retail Price, Wholesale Price, Stock, Description');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedProducts = useMemo(() => {
    let sortableItems = [...filteredProducts];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        } else {
          if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        }
      });
    }
    return sortableItems;
  }, [filteredProducts, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-indigo-600 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleTransfer = () => {
    if (!transferData.toShopId || !transferData.productName || !transferData.quantity) return;

    try {
      db.transferProduct(transferData.productName, currentShop.id, transferData.toShopId, parseInt(transferData.quantity), user);
      setProducts(db.getProducts(currentShop.id)); // Refresh
      setShowTransferModal(false);
      setTransferData({ productName: '', toShopId: '', quantity: '1' });
      alert('Stock transferred successfully!');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openTransferModal = (product: Product) => {
    setTransferData({ ...transferData, productName: product.name, quantity: '1' });
    setShowTransferModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      wholesalePrice: product.wholesalePrice.toString(),
      stock: product.stock.toString(),
      description: product.description || ''
    });
    setEditReason('');
    setShowEditModal(true);
  };

  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      db.updateProduct(editingProduct.id, {
        name: editForm.name,
        category: editForm.category,
        price: parseFloat(editForm.price),
        wholesalePrice: parseFloat(editForm.wholesalePrice),
        stock: parseInt(editForm.stock),
        description: editForm.description
      }, user, editReason);

      setProducts(db.getProducts(currentShop.id)); // Refresh
      setShowEditModal(false);
      setEditingProduct(null);
    } catch (err) {
      alert('Failed to update product');
    }
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Inventory Management</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-3 h-3 rounded-full ${currentShop.color}`}></span>
            <p className="text-gray-500 text-sm">Managing: {currentShop.name}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition"
          >
            <span>📂</span> Import CSV
          </button>
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept=".csv"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Stats/Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input 
            type="text" 
            placeholder="Search by product name or category..." 
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-500">
          Showing <span className="font-bold text-gray-800">{sortedProducts.length}</span> items
        </div>
      </div>

      {/* Product Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b select-none">
              <tr>
                <th 
                  className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => requestSort('name')}
                >
                  <div className="flex items-center">Product Name {getSortIcon('name')}</div>
                </th>
                <th 
                  className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => requestSort('category')}
                >
                  <div className="flex items-center">Category {getSortIcon('category')}</div>
                </th>
                <th 
                  className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => requestSort('price')}
                >
                  <div className="flex items-center justify-end">Retail Price {getSortIcon('price')}</div>
                </th>
                <th 
                  className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => requestSort('wholesalePrice')}
                >
                  <div className="flex items-center justify-end">Wholesale {getSortIcon('wholesalePrice')}</div>
                </th>
                <th 
                  className="py-3 px-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => requestSort('stock')}
                >
                  <div className="flex items-center justify-center">Stock {getSortIcon('stock')}</div>
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400">
                    No products found for this shop.
                  </td>
                </tr>
              ) : (
                sortedProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">{product.name}</div>
                      {product.description && <div className="text-xs text-gray-400 truncate max-w-xs">{product.description}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                        {product.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-700">Rs. {product.price}</td>
                    <td className="py-3 px-4 text-right font-medium text-indigo-600">Rs. {product.wholesalePrice}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-bold ${product.stock < 10 ? 'text-red-500' : 'text-gray-700'}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        product.stock > 10 ? 'bg-green-100 text-green-700' : 
                        product.stock > 0 ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {product.stock > 10 ? 'In Stock' : product.stock > 0 ? 'Low Stock' : 'Out of Stock'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button 
                           onClick={() => openEditModal(product)}
                           className="text-gray-600 hover:text-indigo-600 text-xs font-bold border border-gray-200 px-2 py-1 rounded hover:bg-gray-50"
                           title="Edit Product"
                        >
                          ✏️ Edit
                        </button>
                        <button 
                           onClick={() => openTransferModal(product)}
                           className="text-indigo-600 hover:text-indigo-800 text-xs font-bold border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-50"
                           title="Transfer Stock"
                        >
                          ⇄ Transfer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

       {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
           <div className="bg-white p-6 rounded-xl shadow-2xl w-96 animate-fade-in">
              <h3 className="text-lg font-bold mb-4">Transfer Stock</h3>
              <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Product</label>
                    <input type="text" disabled value={transferData.productName} className="w-full p-2 bg-gray-100 rounded border border-gray-200 text-gray-600" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Destination Shop</label>
                    <select 
                      value={transferData.toShopId} 
                      onChange={(e) => setTransferData({...transferData, toShopId: e.target.value})}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                       <option value="">Select Shop...</option>
                       {db.getShops().filter(s => s.id !== currentShop.id).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                       ))}
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantity</label>
                    <input 
                      type="number" 
                      min="1"
                      value={transferData.quantity} 
                      onChange={(e) => setTransferData({...transferData, quantity: e.target.value})}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                 </div>
                 <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setShowTransferModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                    <button onClick={handleTransfer} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Confirm Transfer</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
           <div className="bg-white p-6 rounded-xl shadow-2xl w-[500px] animate-fade-in max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                 <h3 className="text-xl font-bold text-gray-800">Edit Product</h3>
                 <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
              </div>
              
              <form onSubmit={handleUpdateProduct} className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Product Name</label>
                    <input 
                      type="text" 
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                       <input 
                         type="text" 
                         value={editForm.category}
                         onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                         className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stock</label>
                       <input 
                         type="number" 
                         value={editForm.stock}
                         onChange={(e) => setEditForm({...editForm, stock: e.target.value})}
                         className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                         required
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Retail Price (Rs)</label>
                       <input 
                         type="number" 
                         value={editForm.price}
                         onChange={(e) => setEditForm({...editForm, price: e.target.value})}
                         className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                         required
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-indigo-600 uppercase mb-1">Wholesale Price (Rs)</label>
                       <input 
                         type="number" 
                         value={editForm.wholesalePrice}
                         onChange={(e) => setEditForm({...editForm, wholesalePrice: e.target.value})}
                         className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                         required
                       />
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                    <textarea 
                      value={editForm.description}
                      onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
                    ></textarea>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stock Adjustment Note (Optional)</label>
                    <input 
                      type="text" 
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none placeholder-gray-300"
                      placeholder="e.g. Restocked from warehouse, Damaged goods removed..."
                    />
                 </div>

                 <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                    <button type="button" onClick={() => setShowEditModal(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">Cancel</button>
                    <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-md transition">Save Changes</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
