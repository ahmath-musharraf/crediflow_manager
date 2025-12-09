
import { neon } from '@neondatabase/serverless';
import { Customer, CustomerType, PaymentRecord, Product, Transaction, User, Role, ActivityLog, Shop, ExpenseRecord } from '../types';

// =========================================================================================
// 🔧 DATABASE CONFIGURATION
// =========================================================================================
// We now support dynamic configuration via the UI. 
// If you prefer hardcoding it, paste it here, otherwise leave empty to use the UI.
const HARDCODED_DB_URL = ''; 

// Helper to clean the connection string for browser compatibility
const getSafeUrl = (url: string) => {
  if (!url) return '';
  const cleanUrl = url.trim();
  
  // Strict validation: Must start with postgres:// or postgresql://
  // This prevents the app from crashing if someone pastes a dashboard URL or random text
  if (!cleanUrl.startsWith('postgres://') && !cleanUrl.startsWith('postgresql://')) {
    console.warn("Invalid Database URL format. URL must start with 'postgres://'. Ignoring provided URL.");
    return '';
  }

  return cleanUrl.replace(/&channel_binding=[^&]*/g, '').replace(/\?channel_binding=[^&]*&?/g, '?');
};

const getEffectiveDbUrl = () => {
  // 1. Check Hardcoded
  if (HARDCODED_DB_URL) return getSafeUrl(HARDCODED_DB_URL);
  
  // 2. Check LocalStorage (User entered via UI)
  try {
    const stored = localStorage.getItem('crediflow_db_url');
    if (stored) return getSafeUrl(stored);
  } catch (e) { return ''; }
  
  return '';
};

// Initialize neon client safely
let sql: any = null;

const initSqlClient = () => {
  const url = getEffectiveDbUrl();
  try {
    if (url) {
      console.log("Initializing Neon Client...");
      sql = neon(url);
      return true;
    } else {
      console.warn("No valid DATABASE_URL provided. Running in offline mode.");
      sql = null;
      return false;
    }
  } catch (e) {
    console.error("Failed to initialize Neon client:", e);
    sql = null;
    return false;
  }
};

// Initial Mock Data (Used for seeding DB if empty)
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

class MockDbService {
  private shops: Shop[] = [];
  private products: Product[] = [];
  private customers: Customer[] = [];
  private transactions: Transaction[] = [];
  private payments: PaymentRecord[] = [];
  private expenses: ExpenseRecord[] = []; 
  private activities: ActivityLog[] = [];
  public isInitialized = false;
  public usingPostgres = false;

  // Set DB URL dynamically and reload
  public setDatabaseUrl(url: string) {
    localStorage.setItem('crediflow_db_url', url);
    window.location.reload();
  }

  public getDatabaseUrl() {
    return getEffectiveDbUrl();
  }

  // Initialize DB: Create tables and fetch data
  async init() {
    if (this.isInitialized) return;
    
    // 1. Try Loading from LocalStorage first (Fast load)
    this.loadFromLocalStorage();

    // 2. Initialize SQL
    const hasSql = initSqlClient();

    if (!hasSql) {
       this.usingPostgres = false;
       this.isInitialized = true;
       // Ensure default data exists if starting fresh offline
       if (this.shops.length === 0) {
        this.shops = INITIAL_SHOPS;
        this.products = INITIAL_PRODUCTS;
        this.customers = INITIAL_CUSTOMERS;
       }
       return;
    }

    try {
      if (!sql) throw new Error("Neon client not initialized");
      
      console.log('Connecting to Neon DB...');
      
      // 3. Create Schema (Idempotent)
      await sql`CREATE TABLE IF NOT EXISTS shops (id TEXT PRIMARY KEY, name TEXT, type TEXT, color TEXT)`;
      await sql`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, shop_id TEXT, name TEXT, category TEXT, price NUMERIC, wholesale_price NUMERIC, stock INTEGER, description TEXT)`;
      await sql`CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, type TEXT, shop_name TEXT, location TEXT, whatsapp TEXT, credit_limit NUMERIC, total_debt NUMERIC)`;
      await sql`CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, shop_id TEXT, customer_id TEXT, customer_name TEXT, date TEXT, items JSONB, total_amount NUMERIC, paid_amount NUMERIC, balance NUMERIC, status TEXT)`;
      await sql`CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, shop_id TEXT, customer_id TEXT, amount NUMERIC, date TEXT)`;
      await sql`CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, shop_id TEXT, customer_id TEXT, description TEXT, amount NUMERIC, date TEXT)`;
      await sql`CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, shop_id TEXT, customer_id TEXT, date TEXT, action TEXT, description TEXT, performed_by TEXT, shop_name TEXT)`;

      // 4. Fetch Data from DB
      const shops = await sql`SELECT * FROM shops`;
      
      if (shops.length === 0) {
        console.log('Database empty, seeding initial data...');
        await this.seed();
      } else {
        console.log('Loading data from database...');
        this.shops = shops as any;
        
        const products = await sql`SELECT * FROM products`;
        this.products = products.map((p: any) => ({
          id: p.id,
          shopId: p.shop_id,
          name: p.name,
          category: p.category,
          price: Number(p.price),
          wholesalePrice: Number(p.wholesale_price),
          stock: Number(p.stock),
          description: p.description
        }));

        const customers = await sql`SELECT * FROM customers`;
        this.customers = customers.map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone || '',
          type: c.type as CustomerType,
          shopName: c.shop_name,
          location: c.location,
          whatsapp: c.whatsapp,
          creditLimit: Number(c.credit_limit),
          totalDebt: Number(c.total_debt)
        }));

        const transactions = await sql`SELECT * FROM transactions`;
        this.transactions = transactions.map((t: any) => ({
          id: t.id,
          shopId: t.shop_id,
          customerId: t.customer_id,
          customerName: t.customer_name,
          date: t.date,
          items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items,
          totalAmount: Number(t.total_amount),
          paidAmount: Number(t.paid_amount),
          balance: Number(t.balance),
          status: t.status as any
        }));

        const payments = await sql`SELECT * FROM payments`;
        this.payments = payments.map((p: any) => ({
          id: p.id,
          shopId: p.shop_id,
          customerId: p.customer_id,
          amount: Number(p.amount),
          date: p.date
        }));

        const expenses = await sql`SELECT * FROM expenses`;
        this.expenses = expenses.map((e: any) => ({
          id: e.id,
          shopId: e.shop_id,
          customerId: e.customer_id,
          description: e.description,
          amount: Number(e.amount),
          date: e.date
        }));

        const activities = await sql`SELECT * FROM activities`;
        this.activities = activities.map((a: any) => ({
          id: a.id,
          shopId: a.shop_id,
          customerId: a.customer_id,
          date: a.date,
          action: a.action,
          description: a.description,
          performedBy: a.performed_by,
          shopName: a.shop_name
        }));
      }
      
      // Sync DB data to local storage for next time
      this.saveToLocalStorage();
      this.usingPostgres = true;
      console.log('Database initialized successfully.');
    } catch (e) {
      console.error("CRITICAL DB ERROR - Using LocalStorage fallback:", e);
      this.usingPostgres = false;
      // Fallback to in-memory/localstorage only if DB fails completely and local is empty
      if (this.shops.length === 0) {
        this.shops = INITIAL_SHOPS;
        this.products = INITIAL_PRODUCTS;
        this.customers = INITIAL_CUSTOMERS;
        this.saveToLocalStorage();
      }
    } finally {
      this.isInitialized = true;
    }
  }

  // --- LocalStorage Helpers ---
  private saveToLocalStorage() {
    try {
      localStorage.setItem('crediflow_shops', JSON.stringify(this.shops));
      localStorage.setItem('crediflow_products', JSON.stringify(this.products));
      localStorage.setItem('crediflow_customers', JSON.stringify(this.customers));
      localStorage.setItem('crediflow_transactions', JSON.stringify(this.transactions));
      localStorage.setItem('crediflow_payments', JSON.stringify(this.payments));
      localStorage.setItem('crediflow_expenses', JSON.stringify(this.expenses));
      localStorage.setItem('crediflow_activities', JSON.stringify(this.activities));
    } catch (e) { console.warn("LocalStorage Save Failed", e); }
  }

  private loadFromLocalStorage() {
    try {
      const s = localStorage.getItem('crediflow_shops');
      if (s) this.shops = JSON.parse(s);
      
      const p = localStorage.getItem('crediflow_products');
      if (p) this.products = JSON.parse(p);
      
      const c = localStorage.getItem('crediflow_customers');
      if (c) this.customers = JSON.parse(c);

      const t = localStorage.getItem('crediflow_transactions');
      if (t) this.transactions = JSON.parse(t);

      const py = localStorage.getItem('crediflow_payments');
      if (py) this.payments = JSON.parse(py);

      const ex = localStorage.getItem('crediflow_expenses');
      if (ex) this.expenses = JSON.parse(ex);

      const a = localStorage.getItem('crediflow_activities');
      if (a) this.activities = JSON.parse(a);
    } catch (e) { console.warn("LocalStorage Load Failed", e); }
  }

  async seed() {
    this.shops = INITIAL_SHOPS;
    this.products = INITIAL_PRODUCTS;
    this.customers = INITIAL_CUSTOMERS;
    this.saveToLocalStorage();

    // Bulk insert initial data if DB is connected
    if (sql) {
      try {
        for (const s of INITIAL_SHOPS) {
          await sql`INSERT INTO shops (id, name, type, color) VALUES (${s.id}, ${s.name}, ${s.type}, ${s.color})`;
        }
        for (const p of INITIAL_PRODUCTS) {
          await sql`INSERT INTO products (id, shop_id, name, category, price, wholesale_price, stock, description) 
                    VALUES (${p.id}, ${p.shopId}, ${p.name}, ${p.category}, ${p.price}, ${p.wholesalePrice}, ${p.stock}, ${p.description || ''})`;
        }
        for (const c of INITIAL_CUSTOMERS) {
          await sql`INSERT INTO customers (id, name, phone, type, shop_name, location, whatsapp, credit_limit, total_debt) 
                    VALUES (${c.id}, ${c.name}, ${c.phone}, ${c.type}, ${c.shopName || ''}, ${c.location || ''}, ${c.whatsapp || ''}, ${c.creditLimit || 0}, ${c.totalDebt})`;
        }
      } catch (e) { console.error("Seed failed", e); }
    }
  }

  // --- READS (Synchronous from Cache) ---
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
    return filtered.slice().sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); 
  }

  getActivitiesByCustomer(customerId: string) {
    return this.activities
      .filter(a => a.customerId === customerId)
      .slice()
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

  // --- WRITES (Async Persistence with Optimistic UI) ---

  private async log(action: string, description: string, user?: User, shopId?: string, customerId?: string) {
    const logEntry: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      shopId,
      customerId,
      date: new Date().toISOString(),
      action,
      description,
      performedBy: user ? user.username : 'Unknown',
      shopName: user?.shopName
    };
    
    this.activities.unshift(logEntry); // Optimistic
    this.saveToLocalStorage();

    if (sql) {
      try {
        await sql`INSERT INTO activities (id, shop_id, customer_id, date, action, description, performed_by, shop_name)
                  VALUES (${logEntry.id}, ${logEntry.shopId || null}, ${logEntry.customerId || null}, ${logEntry.date}, ${logEntry.action}, ${logEntry.description}, ${logEntry.performedBy}, ${logEntry.shopName || null})`;
      } catch (e) { console.error("Log Error", e); }
    }
  }

  async addProduct(product: Product, user?: User) {
    this.products.push(product); // Optimistic
    this.saveToLocalStorage();
    this.log('ADD_PRODUCT', `Added product: ${product.name}`, user, product.shopId);

    if (sql) {
      await sql`INSERT INTO products (id, shop_id, name, category, price, wholesale_price, stock, description) 
                VALUES (${product.id}, ${product.shopId}, ${product.name}, ${product.category}, ${product.price}, ${product.wholesalePrice}, ${product.stock}, ${product.description || ''})`;
    }
  }

  async updateProduct(productId: string, updates: Partial<Product>, user?: User, reason?: string) {
    const index = this.products.findIndex(p => p.id === productId);
    if (index > -1) {
      const oldData = this.products[index];
      const newData = { ...oldData, ...updates };
      this.products[index] = newData; // Optimistic
      this.saveToLocalStorage();
      
      const changes = Object.keys(updates).join(', ');
      const reasonText = reason ? ` | Note: ${reason}` : '';
      this.log('UPDATE_PRODUCT', `Updated ${oldData.name} [${changes}]${reasonText}`, user, oldData.shopId);

      if (sql) {
        if (updates.stock !== undefined) await sql`UPDATE products SET stock = ${updates.stock} WHERE id = ${productId}`;
        if (updates.price !== undefined) await sql`UPDATE products SET price = ${updates.price} WHERE id = ${productId}`;
        if (updates.wholesalePrice !== undefined) await sql`UPDATE products SET wholesale_price = ${updates.wholesalePrice} WHERE id = ${productId}`;
        if (updates.name !== undefined) await sql`UPDATE products SET name = ${updates.name} WHERE id = ${productId}`;
        if (updates.category !== undefined) await sql`UPDATE products SET category = ${updates.category} WHERE id = ${productId}`;
        if (updates.description !== undefined) await sql`UPDATE products SET description = ${updates.description} WHERE id = ${productId}`;
      }
    }
  }

  async addProducts(products: Product[], user?: User) {
    this.products = [...this.products, ...products]; // Optimistic
    this.saveToLocalStorage();
    const shopId = products[0]?.shopId;
    this.log('IMPORT_CSV', `Imported ${products.length} products via CSV`, user, shopId);

    if (sql) {
      for (const p of products) {
          await sql`INSERT INTO products (id, shop_id, name, category, price, wholesale_price, stock, description) 
                  VALUES (${p.id}, ${p.shopId}, ${p.name}, ${p.category}, ${p.price}, ${p.wholesalePrice}, ${p.stock}, ${p.description || ''})`;
      }
    }
  }

  async transferProduct(productName: string, fromShopId: string, toShopId: string, quantity: number, user?: User) {
    const sourceIndex = this.products.findIndex(p => p.shopId === fromShopId && p.name === productName);
    if (sourceIndex === -1) throw new Error("Product not found in source shop");
    if (this.products[sourceIndex].stock < quantity) throw new Error("Insufficient stock");

    // Deduct
    this.products[sourceIndex].stock -= quantity;
    if (sql) await sql`UPDATE products SET stock = ${this.products[sourceIndex].stock} WHERE id = ${this.products[sourceIndex].id}`;

    // Add to dest
    const destIndex = this.products.findIndex(p => p.shopId === toShopId && p.name === productName);
    let toShopName = '';
    
    if (destIndex > -1) {
      this.products[destIndex].stock += quantity;
      if (sql) await sql`UPDATE products SET stock = ${this.products[destIndex].stock} WHERE id = ${this.products[destIndex].id}`;
    } else {
      const newProduct = {
        ...this.products[sourceIndex],
        id: `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        shopId: toShopId,
        stock: quantity
      };
      this.products.push(newProduct);
      if (sql) {
        await sql`INSERT INTO products (id, shop_id, name, category, price, wholesale_price, stock, description) 
                VALUES (${newProduct.id}, ${newProduct.shopId}, ${newProduct.name}, ${newProduct.category}, ${newProduct.price}, ${newProduct.wholesalePrice}, ${newProduct.stock}, ${newProduct.description || ''})`;
      }
    }
    
    this.saveToLocalStorage();

    const shop = this.shops.find(s => s.id === toShopId);
    toShopName = shop ? shop.name : 'Unknown';
    this.log('STOCK_TRANSFER', `Transferred ${quantity}x ${productName} to ${toShopName}`, user, fromShopId);
  }

  async addCustomer(customer: Customer, user?: User) {
    this.customers.push(customer); // Optimistic
    this.saveToLocalStorage();
    this.log('ADD_CUSTOMER', `Created new customer: ${customer.name}`, user, undefined, customer.id);

    if (sql) {
      await sql`INSERT INTO customers (id, name, phone, type, shop_name, location, whatsapp, credit_limit, total_debt) 
                VALUES (${customer.id}, ${customer.name}, ${customer.phone}, ${customer.type}, ${customer.shopName || ''}, ${customer.location || ''}, ${customer.whatsapp || ''}, ${customer.creditLimit || 0}, ${customer.totalDebt})`;
    }
  }

  async updateCustomer(id: string, updates: Partial<Customer>, user?: User) {
    const index = this.customers.findIndex(c => c.id === id);
    if (index > -1) {
      const oldData = this.customers[index];
      this.customers[index] = { ...oldData, ...updates }; // Optimistic
      this.saveToLocalStorage();
      
      const changes = Object.keys(updates).join(', ');
      this.log('UPDATE_CUSTOMER', `Updated ${oldData.name} (Fields: ${changes})`, user, undefined, id);

      // Execute SQL update for changed fields
      if (sql) {
        if (updates.name) await sql`UPDATE customers SET name = ${updates.name} WHERE id = ${id}`;
        if (updates.phone) await sql`UPDATE customers SET phone = ${updates.phone} WHERE id = ${id}`;
        if (updates.shopName !== undefined) await sql`UPDATE customers SET shop_name = ${updates.shopName} WHERE id = ${id}`;
        if (updates.location !== undefined) await sql`UPDATE customers SET location = ${updates.location} WHERE id = ${id}`;
        if (updates.whatsapp !== undefined) await sql`UPDATE customers SET whatsapp = ${updates.whatsapp} WHERE id = ${id}`;
        if (updates.creditLimit !== undefined) await sql`UPDATE customers SET credit_limit = ${updates.creditLimit} WHERE id = ${id}`;
        if (updates.totalDebt !== undefined) await sql`UPDATE customers SET total_debt = ${updates.totalDebt} WHERE id = ${id}`;
      }
    }
  }

  async createTransaction(transaction: Transaction, user?: User) {
    this.transactions = [transaction, ...this.transactions]; // Optimistic
    
    // Update stock
    for (const item of transaction.items) {
      const prodIndex = this.products.findIndex(p => p.id === item.productId);
      if (prodIndex > -1) {
        this.products[prodIndex].stock -= item.quantity;
        if (sql) await sql`UPDATE products SET stock = ${this.products[prodIndex].stock} WHERE id = ${item.productId}`;
      }
    }

    // Update Customer Debt
    if (transaction.balance > 0) {
      const custIndex = this.customers.findIndex(c => c.id === transaction.customerId);
      if (custIndex > -1) {
        this.customers[custIndex].totalDebt += transaction.balance;
        if (sql) await sql`UPDATE customers SET total_debt = ${this.customers[custIndex].totalDebt} WHERE id = ${transaction.customerId}`;
      }
    }

    this.saveToLocalStorage();
    this.log('SALE', `New Invoice #${transaction.id.slice(-4)} for ${transaction.customerName} (Rs. ${transaction.totalAmount})`, user, transaction.shopId, transaction.customerId);

    if (sql) {
      await sql`INSERT INTO transactions (id, shop_id, customer_id, customer_name, date, items, total_amount, paid_amount, balance, status)
                VALUES (${transaction.id}, ${transaction.shopId}, ${transaction.customerId}, ${transaction.customerName}, ${transaction.date}, ${JSON.stringify(transaction.items)}::jsonb, ${transaction.totalAmount}, ${transaction.paidAmount}, ${transaction.balance}, ${transaction.status})`;
    }
  }

  async recordPayment(customerId: string, amount: number, user?: User, shopId?: string) {
    const custIndex = this.customers.findIndex(c => c.id === customerId);
    if (custIndex > -1) {
      this.customers[custIndex].totalDebt -= amount;
      if (this.customers[custIndex].totalDebt < 0) this.customers[custIndex].totalDebt = 0;
      
      const payment: PaymentRecord = {
        id: Math.random().toString(36).substr(2, 9),
        shopId: shopId || 'unknown',
        customerId,
        amount,
        date: new Date().toISOString()
      };
      this.payments.push(payment);
      this.saveToLocalStorage();
      
      this.log('PAYMENT', `Received payment of Rs. ${amount} from ${this.customers[custIndex].name}`, user, shopId, customerId);

      // Async DB Updates
      if (sql) {
        await sql`UPDATE customers SET total_debt = ${this.customers[custIndex].totalDebt} WHERE id = ${customerId}`;
        await sql`INSERT INTO payments (id, shop_id, customer_id, amount, date) 
                  VALUES (${payment.id}, ${payment.shopId}, ${payment.customerId}, ${payment.amount}, ${payment.date})`;
      }
    }
  }

  async recordExpense(customerId: string, description: string, amount: number, date: string, user?: User, shopId?: string) {
    const custIndex = this.customers.findIndex(c => c.id === customerId);
    if (custIndex > -1) {
      this.customers[custIndex].totalDebt += amount;
      
      const expense: ExpenseRecord = {
        id: `exp-${Date.now()}`,
        shopId: shopId || 'unknown',
        customerId,
        description,
        amount,
        date
      };
      this.expenses.push(expense);
      this.saveToLocalStorage();

      this.log('EXPENSE', `Added expense: ${description} (Rs. ${amount})`, user, shopId, customerId);

      // Async DB Updates
      if (sql) {
        await sql`UPDATE customers SET total_debt = ${this.customers[custIndex].totalDebt} WHERE id = ${customerId}`;
        await sql`INSERT INTO expenses (id, shop_id, customer_id, description, amount, date) 
                  VALUES (${expense.id}, ${expense.shopId}, ${expense.customerId}, ${expense.description}, ${expense.amount}, ${expense.date})`;
      }
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
