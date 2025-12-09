import { Customer, CustomerType, PaymentRecord, Product, Transaction, User, Role, ActivityLog, Shop, ExpenseRecord } from '../types';
import { neon } from '@neondatabase/serverless';

// --- DATABASE CONFIGURATION ---
// Using the connection string you provided
const DATABASE_URL = 'postgresql://neondb_owner:npg_B0Z6sVdrPkLK@ep-delicate-silence-a4cwsorx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Initialize SQL client
const sql = neon(DATABASE_URL);

// --- INITIAL DEFAULT DATA (Fallback) ---
const INITIAL_SHOPS: Shop[] = [
  { id: 'shop1', name: 'Osaka - Kattankudy', type: 'WHOLESALE', color: 'bg-blue-600' },
  { id: 'shop2', name: 'Shop 2: City Retail', type: 'RETAIL', color: 'bg-emerald-600' },
  { id: 'shop3', name: 'Shop 3: Outlet Store', type: 'HYBRID', color: 'bg-purple-600' },
  { id: 'shop4', name: 'Shop 4: Warehouse B', type: 'WHOLESALE', color: 'bg-orange-600' }
];

const INITIAL_PRODUCTS: Product[] = [
  { id: '1', shopId: 'shop1', name: 'Premium Cotton Shirt', category: 'Clothing', price: 1200, wholesalePrice: 800, stock: 150 },
  { id: '2', shopId: 'shop1', name: 'Denim Jeans - Bulk', category: 'Clothing', price: 1800, wholesalePrice: 1200, stock: 80 },
  { id: '3', shopId: 'shop2', name: 'Leather Belt', category: 'Accessories', price: 500, wholesalePrice: 300, stock: 20 },
  { id: '4', shopId: 'shop2', name: 'Running Shoes', category: 'Footwear', price: 3500, wholesalePrice: 2500, stock: 40 },
  { id: '5', shopId: 'shop3', name: 'Silk Scarf', category: 'Accessories', price: 900, wholesalePrice: 600, stock: 100 },
];

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Retail Walk-in', phone: '', type: CustomerType.RETAIL, totalDebt: 0 },
  { 
    id: 'c2', 
    name: 'Rahul Kumar', 
    phone: '0771234567', 
    type: CustomerType.WHOLESALE, 
    shopName: 'Rahul Traders',
    location: '12 Market St', 
    whatsapp: '0771234567',
    creditLimit: 50000,
    totalDebt: 15000 
  },
  { 
    id: 'c3', 
    name: 'Sarah Jenkins', 
    phone: '0719876543', 
    type: CustomerType.WHOLESALE, 
    shopName: 'City Boutique',
    location: '45 Mall Road', 
    whatsapp: '0719876543',
    creditLimit: 20000,
    totalDebt: 5000 
  },
];

const INITIAL_TRANSACTIONS: Transaction[] = [];

// LocalStorage Keys
const KEYS = {
  SHOPS: 'crediflow_shops',
  PRODUCTS: 'crediflow_products',
  CUSTOMERS: 'crediflow_customers',
  TRANSACTIONS: 'crediflow_transactions',
  PAYMENTS: 'crediflow_payments',
  EXPENSES: 'crediflow_expenses',
  ACTIVITIES: 'crediflow_activities'
};

class MockDbService {
  private shops: Shop[];
  private products: Product[];
  private customers: Customer[];
  private transactions: Transaction[];
  private payments: PaymentRecord[];
  private expenses: ExpenseRecord[]; 
  private activities: ActivityLog[];
  private dbInitialized: boolean = false;

  constructor() {
    this.shops = this.load(KEYS.SHOPS, INITIAL_SHOPS);
    this.products = this.load(KEYS.PRODUCTS, INITIAL_PRODUCTS);
    this.customers = this.load(KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    this.transactions = this.load(KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    this.payments = this.load(KEYS.PAYMENTS, []);
    this.expenses = this.load(KEYS.EXPENSES, []);
    
    const defaultActivity = [{
      id: 'log1',
      shopId: 'shop1',
      date: new Date().toISOString(),
      action: 'SYSTEM_START',
      description: 'System loaded locally',
      performedBy: 'System'
    }];
    this.activities = this.load(KEYS.ACTIVITIES, defaultActivity);

    // Attempt to sync with Neon DB in the background
    this.initDatabase();
  }

  // --- Database Logic (Neon) ---
  
  private async initDatabase() {
    try {
      // Create table if not exists (Simple Key-Value Store pattern for JSON blobs)
      await sql`CREATE TABLE IF NOT EXISTS app_storage (
        key TEXT PRIMARY KEY,
        value JSONB
      )`;
      this.dbInitialized = true;
      console.log("Neon DB Connected. Syncing...");
      await this.pullFromCloud();
    } catch (err) {
      console.error("Failed to connect to Neon DB:", err);
    }
  }

  private async pushToCloud(key: string, data: any) {
    if (!this.dbInitialized) return;
    try {
      await sql`
        INSERT INTO app_storage (key, value)
        VALUES (${key}, ${JSON.stringify(data)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    } catch (err) {
      console.error(`Failed to push ${key} to cloud:`, err);
    }
  }

  private async pullFromCloud() {
    if (!this.dbInitialized) return;
    try {
      const rows = await sql`SELECT key, value FROM app_storage`;
      let updated = false;
      
      for (const row of rows) {
        // Update local memory and storage if cloud has data
        const data = row.value;
        localStorage.setItem(row.key, JSON.stringify(data));
        
        switch (row.key) {
          case KEYS.SHOPS: this.shops = data; break;
          case KEYS.PRODUCTS: this.products = data; break;
          case KEYS.CUSTOMERS: this.customers = data; break;
          case KEYS.TRANSACTIONS: this.transactions = data; break;
          case KEYS.PAYMENTS: this.payments = data; break;
          case KEYS.EXPENSES: this.expenses = data; break;
          case KEYS.ACTIVITIES: this.activities = data; break;
        }
        updated = true;
      }
      
      if (updated) {
        console.log("Data synced from Cloud.");
        // We might need to trigger a re-render here in a real React architecture, 
        // but for this prototype, data will be fresh on next interaction/page load.
      }
    } catch (err) {
      console.error("Failed to pull from cloud:", err);
    }
  }

  // --- Persistence Helpers ---
  private load<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  private save(key: string, data: any) {
    try {
      // 1. Save Local
      localStorage.setItem(key, JSON.stringify(data));
      // 2. Save Cloud (Fire and Forget)
      this.pushToCloud(key, data);
    } catch (e) {
      console.error(`Error saving ${key}`, e);
    }
  }

  public clearDatabase() {
    localStorage.clear();
    // Optional: Clear cloud DB
    // sql`DELETE FROM app_storage`; 
    window.location.reload();
  }

  // --- Getters ---
  getShops() { return this.shops; }

  getProducts(shopId?: string) { 
    if (!shopId) return this.products;
    return this.products.filter(p => p.shopId === shopId); 
  }
  
  getCustomers() { return this.customers; }
  
  getTransactions(shopId?: string) { 
    if (!shopId) return this.transactions;
    return this.transactions.filter(t => t.shopId === shopId); 
  }

  getActivities(shopId?: string) { 
    let filtered = this.activities;
    if (shopId) {
      filtered = this.activities.filter(a => a.shopId === shopId);
    }
    return filtered.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); 
  }

  getActivitiesByCustomer(customerId: string) {
    return this.activities
      .filter(a => a.customerId === customerId)
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  getTransactionsByCustomer(customerId: string) {
    return this.transactions.filter(t => t.customerId === customerId);
  }

  getPaymentsByCustomer(customerId: string) {
    return this.payments.filter(p => p.customerId === customerId);
  }

  getExpensesByCustomer(customerId: string) {
    return this.expenses.filter(e => e.customerId === customerId);
  }

  // --- Modifiers (with Save) ---

  private log(action: string, description: string, user?: User, shopId?: string, customerId?: string) {
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      shopId,
      customerId,
      date: new Date().toISOString(),
      action,
      description,
      performedBy: user ? user.username : 'Unknown',
      shopName: user?.shopName
    };
    this.activities = [newLog, ...this.activities];
    this.save(KEYS.ACTIVITIES, this.activities);
  }

  addProduct(product: Product, user?: User) {
    this.products = [...this.products, product];
    this.save(KEYS.PRODUCTS, this.products);
    this.log('ADD_PRODUCT', `Added product: ${product.name}`, user, product.shopId);
  }

  updateProduct(productId: string, updates: Partial<Product>, user?: User, reason?: string) {
    const index = this.products.findIndex(p => p.id === productId);
    if (index > -1) {
      const oldData = this.products[index];
      this.products[index] = { ...oldData, ...updates };
      this.save(KEYS.PRODUCTS, this.products);
      
      const changes = Object.keys(updates).join(', ');
      const reasonText = reason ? ` | Note: ${reason}` : '';
      this.log('UPDATE_PRODUCT', `Updated ${oldData.name} [${changes}]${reasonText}`, user, oldData.shopId);
    } else {
        throw new Error("Product not found");
    }
  }

  addProducts(products: Product[], user?: User) {
    this.products = [...this.products, ...products];
    this.save(KEYS.PRODUCTS, this.products);
    const shopId = products[0]?.shopId;
    this.log('IMPORT_CSV', `Imported ${products.length} products via CSV`, user, shopId);
  }

  transferProduct(productName: string, fromShopId: string, toShopId: string, quantity: number, user?: User) {
    const sourceIndex = this.products.findIndex(p => p.shopId === fromShopId && p.name === productName);
    if (sourceIndex === -1) {
      throw new Error("Product not found in source shop");
    }
    
    if (this.products[sourceIndex].stock < quantity) {
      throw new Error("Insufficient stock");
    }

    // Deduct
    this.products[sourceIndex].stock -= quantity;

    // Add to dest
    const destIndex = this.products.findIndex(p => p.shopId === toShopId && p.name === productName);
    if (destIndex > -1) {
      this.products[destIndex].stock += quantity;
    } else {
      const newProduct = {
        ...this.products[sourceIndex],
        id: `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        shopId: toShopId,
        stock: quantity
      };
      this.products.push(newProduct);
    }
    
    this.save(KEYS.PRODUCTS, this.products);

    const toShopName = this.shops.find(s => s.id === toShopId)?.name;
    this.log('STOCK_TRANSFER', `Transferred ${quantity}x ${productName} to ${toShopName}`, user, fromShopId);
  }

  addCustomer(customer: Customer, user?: User) {
    this.customers = [...this.customers, customer];
    this.save(KEYS.CUSTOMERS, this.customers);
    this.log('ADD_CUSTOMER', `Created new customer: ${customer.name}`, user, undefined, customer.id);
  }

  updateCustomer(id: string, updates: Partial<Customer>, user?: User) {
    const index = this.customers.findIndex(c => c.id === id);
    if (index > -1) {
      const oldData = this.customers[index];
      this.customers[index] = { ...oldData, ...updates };
      this.save(KEYS.CUSTOMERS, this.customers);
      
      const changes = Object.keys(updates).join(', ');
      this.log('UPDATE_CUSTOMER', `Updated ${oldData.name} (Fields: ${changes})`, user, undefined, id);
    }
  }

  createTransaction(transaction: Transaction, user?: User) {
    this.transactions = [transaction, ...this.transactions];
    this.save(KEYS.TRANSACTIONS, this.transactions);
    
    // Update stock
    transaction.items.forEach(item => {
      const prodIndex = this.products.findIndex(p => p.id === item.productId);
      if (prodIndex > -1) {
        this.products[prodIndex].stock -= item.quantity;
      }
    });
    this.save(KEYS.PRODUCTS, this.products);

    // Update debt
    if (transaction.balance > 0) {
      const custIndex = this.customers.findIndex(c => c.id === transaction.customerId);
      if (custIndex > -1) {
        this.customers[custIndex].totalDebt += transaction.balance;
        this.save(KEYS.CUSTOMERS, this.customers);
      }
    }

    this.log('SALE', `New Invoice #${transaction.id.slice(-4)} for ${transaction.customerName} (Rs. ${transaction.totalAmount})`, user, transaction.shopId, transaction.customerId);
  }

  recordPayment(customerId: string, amount: number, user?: User, shopId?: string) {
    const custIndex = this.customers.findIndex(c => c.id === customerId);
    if (custIndex > -1) {
      this.customers[custIndex].totalDebt -= amount;
      if (this.customers[custIndex].totalDebt < 0) this.customers[custIndex].totalDebt = 0;
      this.save(KEYS.CUSTOMERS, this.customers);
      
      const payment: PaymentRecord = {
        id: Math.random().toString(36).substr(2, 9),
        shopId: shopId || 'unknown',
        customerId,
        amount,
        date: new Date().toISOString()
      };
      this.payments.push(payment);
      this.save(KEYS.PAYMENTS, this.payments);
      
      this.log('PAYMENT', `Received payment of Rs. ${amount} from ${this.customers[custIndex].name}`, user, shopId, customerId);
    }
  }

  recordExpense(customerId: string, description: string, amount: number, date: string, user?: User, shopId?: string) {
    const custIndex = this.customers.findIndex(c => c.id === customerId);
    if (custIndex > -1) {
      this.customers[custIndex].totalDebt += amount;
      this.save(KEYS.CUSTOMERS, this.customers);
      
      const expense: ExpenseRecord = {
        id: `exp-${Date.now()}`,
        shopId: shopId || 'unknown',
        customerId,
        description,
        amount,
        date
      };
      this.expenses.push(expense);
      this.save(KEYS.EXPENSES, this.expenses);

      this.log('EXPENSE', `Added expense: ${description} (Rs. ${amount})`, user, shopId, customerId);
    }
  }
}

export const db = new MockDbService();

export const authenticate = (username: string, password: string): User | null => {
  if (username === 'admin' && password === 'admin') {
    return { id: 'u1', username: 'Super Admin', role: Role.SUPER_ADMIN };
  }
  return null;
};

export const authenticateShop = (shopId: string, password: string): User | null => {
  // Simple password check for prototype
  if (password === '1234') {
    const shop = db.getShops().find(s => s.id === shopId);
    if (shop) {
      return { 
        id: `shop-admin-${shop.id}`, 
        username: `${shop.name} Manager`, 
        role: Role.SHOP_ADMIN, 
        shopName: shop.name 
      };
    }
  }
  return null;
};
