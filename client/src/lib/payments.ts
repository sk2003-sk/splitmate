import type { PaymentApp } from '@/types';

export const PAYMENT_APPS: { value: PaymentApp; label: string; short: string }[] = [
  { value: 'GPAY', label: 'Google Pay', short: 'GPay' },
  { value: 'PHONEPE', label: 'PhonePe', short: 'PhonePe' },
  { value: 'SLICE', label: 'Slice', short: 'Slice' },
  { value: 'PAYTM', label: 'Paytm', short: 'Paytm' },
  { value: 'BANK', label: 'Bank / NEFT', short: 'Bank' },
  { value: 'CASH', label: 'Cash', short: 'Cash' },
  { value: 'OTHER', label: 'Other app', short: 'Other' },
];

export function paymentAppLabel(app: PaymentApp | string) {
  return PAYMENT_APPS.find((entry) => entry.value === app)?.short || 'Other';
}

export const PAYMENT_CATEGORIES = [
  'Food',
  'Groceries',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Rent',
  'Travel',
  'Other',
];
