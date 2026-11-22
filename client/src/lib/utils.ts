import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { User } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(paise: number, options: { signed?: boolean; compact?: boolean } = {}) {
  const value = paise / 100;
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: options.compact ? 0 : 2,
    notation: options.compact ? 'compact' : 'standard',
  });
  const formatted = formatter.format(Math.abs(value));
  if (!options.signed) return formatter.format(value);
  if (paise > 0) return `+${formatted}`;
  if (paise < 0) return `−${formatted}`;
  return formatted;
}

export function formatAmount(paise: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(paise / 100);
}

export function initialsOf(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function person(ref: User | string | null | undefined): User {
  if (ref && typeof ref === 'object') return ref;
  return {
    _id: String(ref || ''),
    name: 'Unknown member',
    email: '',
    avatarColor: '#94a3b8',
  };
}

export function formatDate(value: string | Date, style: 'short' | 'long' = 'short') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function timeAgo(value: string | Date) {
  const date = new Date(value).getTime();
  const diff = Date.now() - date;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return formatDate(value);
}

export function todayInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function monthInput(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadFile(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadFile(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function methodLabel(method: string) {
  const labels: Record<string, string> = {
    equal: 'Equally',
    exact: 'Exact amounts',
    percentage: 'Percentages',
    shares: 'Shares',
    unequal: 'Custom amounts',
  };
  return labels[method] || method;
}

export function settlementMethodLabel(method: string) {
  const labels: Record<string, string> = {
    UPI: 'UPI',
    CASH: 'Cash',
    BANK: 'Bank transfer',
    OTHER: 'Other',
  };
  return labels[method] || method;
}

export function avatarStyle(color?: string) {
  const base = color || '#6366f1';
  return {
    backgroundColor: `${base}1f`,
    color: base,
  };
}
