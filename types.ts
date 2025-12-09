export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SHOP_ADMIN = 'SHOP_ADMIN',
}

export enum PaymentMethod {
  CASH = 'CASH',
  ONLINE = 'ONLINE',
  CREDIT = 'CREDIT', // Bill to bill / balance
}

export enum CustomerType {
  RETAIL = 'RETAIL',
  WHOLESALE = 'WHOLESALE',
}

export interface Shop {
  id: string;
  name: string;
  type: 'WHOLESALE' | 'RETAIL' | 'HYBRID';
  color: string;
}

export interface Product {
  id: string;
  shopId: string; // Belongs to specific shop
  name: string;
  category: string;
  price: number; // Retail price
  wholesalePrice: number;
  stock: number;
  description?: string;
}

export interface Transaction {
  id: string;
  shopId: string; // Belongs to specific shop
  customerId: string; // 'GUEST' for retail walk-ins
  customerName: string;
  date: string;
  items: { productId: string; name: string; quantity: number; price: number }[];
  totalAmount: number;
  paidAmount: number;
  balance: number; // totalAmount - paidAmount
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
}

export interface PaymentRecord {
  id: string;
  shopId: string;
  customerId: string;
  amount: number;
  date: string;
  note?: string;
}

export interface ExpenseRecord {
  id: string;
  shopId: string;
  customerId: string;
  description: string;
  amount: number;
  date: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  address?: string; // Kept for backward compatibility
  totalDebt: number; // Calculated field usually
  // New Fields
  shopName?: string;
  location?: string;
  whatsapp?: string;
  creditLimit?: number;
}

export interface User {
  id: string;
  username: string;
  role: Role;
  shopName?: string; // Only for SHOP_ADMIN
}

export interface ActivityLog {
  id: string;
  shopId?: string;
  customerId?: string; // Related customer
  date: string;
  action: string; // e.g., "SALE", "ADD_PRODUCT", "UPDATE_CUSTOMER"
  description: string;
  performedBy: string; // Username
  shopName?: string; // Shop context
}

export type ViewState = 'LOGIN' | 'SHOP_SELECT' | 'DASHBOARD' | 'POS' | 'CUSTOMERS' | 'INVENTORY';
