export interface User {
  _id: string;
  name: string;
  email: string;
  avatarColor: string;
  avatarUrl?: string;
  upiId?: string;
  defaultCurrency?: string;
  theme?: 'light' | 'dark' | 'system';
  monthlyBudgetPaise?: number;
  trackPayments?: boolean;
  paymentPromptSeen?: boolean;
  isDemo?: boolean;
  hasAccount?: boolean;
  initials?: string;
  createdAt?: string;
}

export interface Category {
  _id: string;
  name: string;
  icon: string;
  color: string;
  isDefault?: boolean;
  createdBy?: string | null;
}

export interface GroupRef {
  _id: string;
  name: string;
  emoji: string;
}

export interface Group {
  _id: string;
  name: string;
  description: string;
  emoji: string;
  imageUrl?: string;
  members: User[];
  createdBy: User | string;
  archived?: boolean;
  memberCount?: number;
  totalPaise?: number;
  expenseCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Payer {
  user: User | string;
  amountPaise: number;
  baseAmountPaise: number;
}

export interface Split {
  user: User | string;
  amountPaise: number;
  baseAmountPaise: number;
  value?: number | null;
}

export type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares' | 'unequal';

export interface Expense {
  _id: string;
  description: string;
  amountPaise: number;
  baseAmountPaise: number;
  currency: string;
  exchangeRate: number;
  category: Category | string;
  group: GroupRef | string | null;
  date: string;
  notes?: string;
  receiptUrl?: string;
  paidBy: Payer[];
  splits: Split[];
  splitMethod: SplitMethod;
  createdBy: User | string;
  mySharePaise?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceRow {
  from: User;
  to: User;
  amountPaise: number;
}

export interface SimplifiedTransfer {
  from?: User;
  to?: User;
  amountPaise: number;
}

export interface GroupBalance {
  group: GroupRef;
  youOwePaise: number;
  youAreOwedPaise: number;
  netPaise: number;
  pairwise: BalanceRow[];
}

export interface BalancesResponse {
  summary: {
    youOwePaise: number;
    youAreOwedPaise: number;
    netPaise: number;
  };
  pairwise: BalanceRow[];
  simplified: SimplifiedTransfer[];
  groupBalances: GroupBalance[];
}

export interface AnalyticsSummary {
  totalExpensesPaise: number;
  mySharePaise: number;
  expenseCount: number;
  youOwePaise: number;
  youAreOwedPaise: number;
  netPaise: number;
  settledPaise: number;
  monthlySpendPaise: number;
  monthlyMySharePaise: number;
  groupCount: number;
  memberCount: number;
  month: string;
}

export type SettlementMethod = 'UPI' | 'CASH' | 'BANK' | 'OTHER';

export type PaymentApp = 'GPAY' | 'PHONEPE' | 'SLICE' | 'PAYTM' | 'BANK' | 'CASH' | 'OTHER';

export interface Payment {
  _id: string;
  user: string;
  payee: string;
  amountPaise: number;
  app: PaymentApp;
  direction: 'OUT' | 'IN';
  category: string;
  paidAt: string;
  note?: string;
  receiptUrl?: string;
  source?: 'MANUAL' | 'EMAIL' | 'SMS';
  needsReview?: boolean;
  createdAt: string;
}

export interface EmailCaptureItem {
  _id: string;
  status: 'PROCESSING' | 'CREATED' | 'DUPLICATE' | 'IGNORED' | 'FAILED';
  reason?: string;
  subject?: string;
  sender?: string;
  payee?: string;
  amountPaise?: number;
  direction?: 'OUT' | 'IN';
  createdAt: string;
  payment?: string | null;
}

export interface EmailCaptureInfo {
  configured: boolean;
  domain: string | null;
  address: string | null;
  enabled: boolean;
}

export interface SmsCaptureInfo {
  enabled: boolean;
  endpoint: string;
}

export interface PaymentMonth {
  month: string;
  outPaise: number;
  inPaise: number;
  count: number;
}

export interface PaymentSummary {
  year: number;
  totals: { outPaise: number; inPaise: number; count: number };
  months: PaymentMonth[];
  byApp: { app: PaymentApp; outPaise: number; inPaise: number; count: number }[];
  currentMonth: PaymentMonth;
}

export interface Settlement {
  _id: string;
  fromUser: User;
  toUser: User;
  group: GroupRef | null;
  amountPaise: number;
  method: SettlementMethod;
  reference?: string;
  receiptUrl?: string;
  note?: string;
  status: 'COMPLETED' | 'REVERSED';
  createdBy: User | string;
  reversedBy?: User | string | null;
  reversedAt?: string | null;
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  type:
    | 'EXPENSE_ADDED'
    | 'EXPENSE_UPDATED'
    | 'SETTLEMENT'
    | 'GROUP_INVITE'
    | 'MEMBER_ADDED'
    | 'SYSTEM';
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface ActivityItem {
  _id: string;
  actor: User;
  action: string;
  entityType: 'expense' | 'settlement' | 'group' | 'member' | 'user' | 'recurring';
  entityId?: string;
  group?: GroupRef | null;
  amountPaise?: number | null;
  message: string;
  createdAt: string;
}

export interface MonthlyPoint {
  key: string;
  label: string;
  totalPaise: number;
  mySharePaise: number;
  count: number;
}

export interface WeeklyPoint {
  key: string;
  label: string;
  totalPaise: number;
  count: number;
}

export interface DailyPoint {
  date: string;
  totalPaise: number;
  mySharePaise: number;
  count: number;
}

export interface CategoryStat {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  totalPaise: number;
  mySharePaise: number;
  count: number;
}

export interface MemberStat {
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  avatarUrl?: string;
  paidPaise: number;
  sharePaise: number;
  netPaise: number;
  count: number;
  isCurrentUser: boolean;
}

export interface GroupStat {
  groupId: string;
  name: string;
  emoji: string;
  totalPaise: number;
  mySharePaise: number;
  count: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface RecurringExpense {
  _id: string;
  description: string;
  amountPaise: number;
  baseAmountPaise: number;
  category: Category;
  group: GroupRef | null;
  notes?: string;
  paidBy: Payer[];
  splits: Split[];
  splitMethod: SplitMethod;
  frequency: 'WEEKLY' | 'MONTHLY';
  nextRunAt: string;
  lastRunAt?: string | null;
  active: boolean;
  createdAt: string;
}

export interface PublicPerson {
  key: string;
  name: string;
}

export interface PublicSplitExpense {
  _id: string;
  description: string;
  amountPaise: number;
  payer: PublicPerson | null;
  date: string;
  splits: { person: PublicPerson | null; amountPaise: number }[];
}

export interface PublicSplit {
  code: string;
  title: string;
  people: PublicPerson[];
  expenses: PublicSplitExpense[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicBalanceRow {
  person: PublicPerson;
  paidPaise: number;
  sharePaise: number;
  netPaise: number;
}

export interface PublicTransfer {
  from: PublicPerson;
  to: PublicPerson;
  amountPaise: number;
}

export interface PublicSplitSummary {
  totalPaise: number;
  expenseCount: number;
  peopleCount: number;
  balances: PublicBalanceRow[];
  directPayments: PublicTransfer[];
  transfers: PublicTransfer[];
}

export interface PublicSplitPayload {
  split: PublicSplit;
  summary: PublicSplitSummary;
}

export interface PublicSplitListItem {
  code: string;
  title: string;
  peopleCount: number;
  expenseCount: number;
  totalPaise: number;
  updatedAt: string;
}
