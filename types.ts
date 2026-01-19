
export type ProductCategory = string;

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  batch: string;
  expiryDate: string; // YYYY-MM-DD
  buyPrice: number;
  sellPrice: number;
  stock: number;
  location: string;
  vendor?: string;    // New Field
  image?: string; // Base64 string for product image
}

export interface CartItem extends Product {
  quantity: number;
  itemDiscountType: 'PERCENT' | 'FLAT'; // New Field
  itemDiscountValue: number;            // New Field
}

export interface Sale {
  id: string;
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
  items: CartItem[];
  subTotal: number;
  gstAmount: number;
  discountPercentage?: number;
  discountAmount?: number;
  totalAmount: number;
  totalProfit: number;
  timestamp: number;
}

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'alert';
  timestamp: number;
  read: boolean;
}

export type ViewState = 'DASHBOARD' | 'POS' | 'INVENTORY' | 'SALES_HISTORY';
