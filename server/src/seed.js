import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from './db.js';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { Category } from './models/Category.js';
import { Group } from './models/Group.js';
import { Expense } from './models/Expense.js';
import { Settlement } from './models/Settlement.js';
import { Notification } from './models/Notification.js';
import { Activity } from './models/Activity.js';
import { RecurringExpense } from './models/RecurringExpense.js';
import { prepareExpense } from './services/expense.service.js';
import { logActivity, notifyUsers } from './services/activity.service.js';
import { nextRunDate } from './services/recurring.service.js';
import { formatINR } from './utils/money.js';

if (env.isProd) {
  console.error('Refusing to seed: NODE_ENV=production. Seeding is for local development only.');
  process.exit(1);
}

const reset = process.argv.includes('--reset');

const DEFAULT_USERS = [
  { name: 'Sashank', email: 'sashank@splitmate.app', avatarColor: '#6366f1' },
  { name: 'Sai', email: 'sai@splitmate.app', avatarColor: '#0ea5e9' },
  { name: 'Sundhari', email: 'sundhari@splitmate.app', avatarColor: '#ec4899' },
  { name: 'Mounika', email: 'mounika@splitmate.app', avatarColor: '#f59e0b' },
  { name: 'Sangeeetha', email: 'sangeeetha@splitmate.app', avatarColor: '#10b981' },
  { name: 'Manasa', email: 'manasa@splitmate.app', avatarColor: '#8b5cf6' },
  { name: 'Jahnavi', email: 'jahnavi@splitmate.app', avatarColor: '#f43f5e' },
];

const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: 'UtensilsCrossed', color: '#f97316' },
  { name: 'Groceries', icon: 'ShoppingBasket', color: '#22c55e' },
  { name: 'Travel', icon: 'Plane', color: '#0ea5e9' },
  { name: 'Shopping', icon: 'ShoppingBag', color: '#ec4899' },
  { name: 'Rent', icon: 'House', color: '#8b5cf6' },
  { name: 'Electricity', icon: 'Zap', color: '#eab308' },
  { name: 'Entertainment', icon: 'Clapperboard', color: '#f43f5e' },
  { name: 'Fuel', icon: 'Fuel', color: '#64748b' },
  { name: 'Medical', icon: 'HeartPulse', color: '#14b8a6' },
  { name: 'Other', icon: 'Receipt', color: '#94a3b8' },
];

const GROUPS = [
  {
    name: 'Friends',
    emoji: '🎉',
    description: 'The original gang — dinners, movies and everything in between.',
    members: ['Sashank', 'Sai', 'Sundhari', 'Mounika', 'Sangeeetha', 'Manasa', 'Jahnavi'],
  },
  {
    name: 'Trip to Goa',
    emoji: '🏖️',
    description: 'Four days, five people, one unforgettable beach trip.',
    members: ['Sashank', 'Sai', 'Mounika', 'Manasa', 'Jahnavi'],
  },
  {
    name: 'Roommates',
    emoji: '🏠',
    description: 'Rent, bills and the occasional late-night grocery run.',
    members: ['Sashank', 'Sai', 'Sundhari'],
  },
];

const daysAgo = (days) => new Date(Date.now() - days * 86_400_000);

const EXPENSES = [
  {
    description: 'Dinner at Truffles',
    amount: 2100,
    category: 'Food',
    group: 'Friends',
    method: 'equal',
    paidBy: [['Sashank', 2100]],
    participants: ['Sashank', 'Sai', 'Mounika', 'Manasa'],
    daysAgo: 12,
    notes: 'Catch-up dinner after work',
  },
  {
    description: 'Groceries for the week',
    amount: 3450,
    category: 'Groceries',
    group: 'Roommates',
    method: 'exact',
    paidBy: [['Sundhari', 3450]],
    participants: [
      ['Sashank', 1150],
      ['Sai', 1150],
      ['Sundhari', 1150],
    ],
    daysAgo: 8,
  },
  {
    description: 'Goa villa booking',
    amount: 18000,
    category: 'Travel',
    group: 'Trip to Goa',
    method: 'shares',
    paidBy: [
      ['Sai', 12000],
      ['Sashank', 6000],
    ],
    participants: [
      ['Sashank', 2],
      ['Sai', 2],
      ['Mounika', 2],
      ['Manasa', 1],
      ['Jahnavi', 1],
    ],
    daysAgo: 18,
    notes: 'Two nights at the beach house',
  },
  {
    description: 'Petrol for the road trip',
    amount: 2000,
    category: 'Fuel',
    group: 'Trip to Goa',
    method: 'equal',
    paidBy: [['Manasa', 2000]],
    participants: ['Sashank', 'Manasa', 'Jahnavi'],
    daysAgo: 17,
  },
  {
    description: 'Electricity bill',
    amount: 4200,
    category: 'Electricity',
    group: 'Roommates',
    method: 'percentage',
    paidBy: [['Sashank', 4200]],
    participants: [
      ['Sashank', 40],
      ['Sai', 30],
      ['Sundhari', 30],
    ],
    daysAgo: 21,
  },
  {
    description: 'Movie night',
    amount: 1200,
    category: 'Entertainment',
    group: 'Friends',
    method: 'equal',
    paidBy: [['Sundhari', 1200]],
    participants: ['Sashank', 'Sai', 'Sundhari', 'Mounika', 'Sangeeetha', 'Manasa', 'Jahnavi'],
    daysAgo: 5,
    notes: 'Tickets + popcorn',
  },
  {
    description: 'Weekly groceries',
    amount: 2800,
    category: 'Groceries',
    group: 'Friends',
    method: 'equal',
    paidBy: [['Mounika', 2800]],
    participants: ['Sashank', 'Sai', 'Mounika', 'Sangeeetha'],
    daysAgo: 2,
  },
  {
    description: 'Lunch at office',
    amount: 1050,
    category: 'Food',
    group: 'Friends',
    method: 'exact',
    paidBy: [['Sangeeetha', 1050]],
    participants: [
      ['Sashank', 350],
      ['Sangeeetha', 350],
      ['Mounika', 350],
    ],
    daysAgo: 1,
  },
  {
    description: "Sangeeetha's birthday cake",
    amount: 1500,
    category: 'Other',
    group: 'Friends',
    method: 'equal',
    paidBy: [['Jahnavi', 1500]],
    participants: ['Jahnavi', 'Sashank', 'Sai', 'Sundhari', 'Mounika', 'Manasa'],
    daysAgo: 30,
  },
  {
    description: 'Stationery haul',
    amount: 600,
    category: 'Shopping',
    group: null,
    method: 'equal',
    paidBy: [['Sashank', 600]],
    participants: ['Sashank', 'Sai'],
    daysAgo: 15,
  },
  {
    description: 'Cab to airport',
    amount: 850,
    category: 'Travel',
    group: 'Trip to Goa',
    method: 'equal',
    paidBy: [['Jahnavi', 850]],
    participants: ['Jahnavi', 'Manasa'],
    daysAgo: 45,
  },
  {
    description: 'Medical checkup',
    amount: 1800,
    category: 'Medical',
    group: 'Roommates',
    method: 'exact',
    paidBy: [['Sai', 1800]],
    participants: [
      ['Sai', 900],
      ['Sashank', 900],
    ],
    daysAgo: 60,
  },
  {
    description: 'New headphones',
    amount: 2499,
    category: 'Shopping',
    group: 'Friends',
    method: 'percentage',
    paidBy: [['Sashank', 2499]],
    participants: [
      ['Sashank', 60],
      ['Sai', 40],
    ],
    daysAgo: 3,
    notes: 'Split on a pair of noise-cancelling headphones',
  },
  {
    description: 'Monthly rent',
    amount: 30000,
    category: 'Rent',
    group: 'Roommates',
    method: 'equal',
    paidBy: [['Sashank', 30000]],
    participants: ['Sashank', 'Sai', 'Sundhari'],
    daysAgo: 25,
  },
  {
    description: 'Team lunch',
    amount: 3600,
    category: 'Food',
    group: 'Friends',
    method: 'shares',
    paidBy: [['Mounika', 3600]],
    participants: [
      ['Sashank', 1],
      ['Sai', 1],
      ['Sundhari', 1],
      ['Mounika', 1],
      ['Sangeeetha', 1],
      ['Manasa', 1],
      ['Jahnavi', 1],
    ],
    daysAgo: 35,
  },
  {
    description: 'Beach shack lunch',
    amount: 2750,
    category: 'Food',
    group: 'Trip to Goa',
    method: 'equal',
    paidBy: [['Sai', 2750]],
    participants: ['Sashank', 'Sai', 'Mounika', 'Manasa'],
    daysAgo: 16,
  },
  {
    description: "Sundhari's salon day",
    amount: 1800,
    category: 'Other',
    group: null,
    method: 'equal',
    paidBy: [['Sundhari', 1800]],
    participants: ['Sundhari', 'Mounika'],
    daysAgo: 11,
  },
  {
    description: 'Weekend brunch',
    amount: 1600,
    category: 'Food',
    group: 'Friends',
    method: 'equal',
    paidBy: [['Manasa', 1600]],
    participants: ['Manasa', 'Jahnavi', 'Sashank', 'Sai'],
    daysAgo: 7,
  },
  {
    description: 'Uber to office',
    amount: 420,
    category: 'Travel',
    group: 'Friends',
    method: 'equal',
    paidBy: [['Sai', 420]],
    participants: ['Sai', 'Sashank'],
    daysAgo: 0,
  },
  {
    description: 'Internet bill',
    amount: 1199,
    category: 'Electricity',
    group: 'Roommates',
    method: 'unequal',
    paidBy: [['Sundhari', 1199]],
    participants: [
      ['Sashank', 500],
      ['Sai', 400],
      ['Sundhari', 299],
    ],
    daysAgo: 14,
  },
];

const SETTLEMENTS = [
  { from: 'Sai', to: 'Sashank', amount: 500, method: 'UPI', group: 'Friends', daysAgo: 6, reference: 'UPI 442918' },
  { from: 'Sundhari', to: 'Sashank', amount: 750, method: 'CASH', group: null, daysAgo: 4 },
  { from: 'Manasa', to: 'Sashank', amount: 1000, method: 'UPI', group: 'Trip to Goa', daysAgo: 9, reference: 'UPI 773001' },
  { from: 'Sashank', to: 'Sundhari', amount: 300, method: 'UPI', group: 'Roommates', daysAgo: 2, reference: 'UPI 918244' },
];

async function seed() {
  await connectDb();
  console.log('Seeding SplitMate…');

  if (reset) {
    await Promise.all([
      Expense.deleteMany({}),
      Settlement.deleteMany({}),
      RecurringExpense.deleteMany({}),
      Notification.deleteMany({}),
      Activity.deleteMany({}),
      Group.deleteMany({}),
      Category.deleteMany({}),
      User.deleteMany({}),
    ]);
    console.log('Cleared existing collections (--reset)');
  }

  const passwordHash = await bcrypt.hash(env.demoPassword, 12);
  const users = new Map();
  for (const entry of DEFAULT_USERS) {
    const user = await User.findOneAndUpdate(
      { email: entry.email },
      {
        $set: {
          name: entry.name,
          avatarColor: entry.avatarColor,
          passwordHash,
          hasAccount: true,
          isDemo: true,
        },
        $setOnInsert: { theme: 'system', defaultCurrency: 'INR' },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    users.set(entry.name, user);
  }
  console.log(`Seeded ${users.size} default users`);

  const sashank = users.get('Sashank');
  await User.updateOne({ _id: sashank._id }, { $set: { upiId: 'sashank@upi', monthlyBudgetPaise: 3_500_000 } });

  const categories = new Map();
  for (const entry of DEFAULT_CATEGORIES) {
    const category = await Category.findOneAndUpdate(
      { name: entry.name, createdBy: null },
      { $set: { ...entry, isDefault: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    categories.set(entry.name, category);
  }
  console.log(`Seeded ${categories.size} categories`);

  const groups = new Map();
  for (const entry of GROUPS) {
    const memberIds = entry.members.map((name) => users.get(name)._id);
    const group = await Group.findOneAndUpdate(
      { name: entry.name },
      {
        $set: {
          description: entry.description,
          emoji: entry.emoji,
          members: memberIds,
          createdBy: sashank._id,
        },
        $setOnInsert: { archived: false },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    groups.set(entry.name, group);
  }
  console.log(`Seeded ${groups.size} groups`);

  const existingExpenses = await Expense.estimatedDocumentCount();
  if (existingExpenses > 0) {
    console.log(`Found ${existingExpenses} existing expenses — skipping sample transactions.`);
    await disconnectDb();
    return;
  }

  for (const entry of EXPENSES) {
    const payers = entry.paidBy.map(([name, amount]) => [users.get(name), amount]);
    const participants = entry.participants.map((item) =>
      Array.isArray(item) ? { user: users.get(item[0])._id, value: item[1] } : { user: users.get(item)._id },
    );
    const actor = payers[0][0];
    const group = entry.group ? groups.get(entry.group) : null;

    const data = await prepareExpense(
      {
        description: entry.description,
        amount: entry.amount,
        category: categories.get(entry.category)._id,
        group: group?._id || null,
        date: daysAgo(entry.daysAgo),
        notes: entry.notes || '',
        paidBy: payers.map(([user, amount]) => ({ user: user._id, amount })),
        splitMethod: entry.method,
        participants,
      },
      actor,
    );

    const expense = await Expense.create(data);
    await logActivity({
      actor: actor._id,
      action: 'EXPENSE_CREATED',
      entityType: 'expense',
      entityId: expense._id,
      group: expense.group,
      amountPaise: expense.baseAmountPaise,
      message: `${actor.name} added “${expense.description}” (${formatINR(expense.baseAmountPaise)})`,
    });
    await notifyUsers(
      [...payers.map(([user]) => user._id), ...participants.map((p) => p.user)],
      {
        type: 'EXPENSE_ADDED',
        title: 'New expense added',
        message: `${actor.name} added “${expense.description}” (${formatINR(expense.baseAmountPaise)})`,
        link: `/expenses/${expense._id}`,
      },
      actor._id,
    );
  }
  console.log(`Seeded ${EXPENSES.length} expenses`);

  for (const entry of SETTLEMENTS) {
    const from = users.get(entry.from);
    const to = users.get(entry.to);
    const createdAt = daysAgo(entry.daysAgo);
    const settlement = await Settlement.create({
      fromUser: from._id,
      toUser: to._id,
      group: entry.group ? groups.get(entry.group)._id : null,
      amountPaise: entry.amount * 100,
      method: entry.method,
      reference: entry.reference || '',
      note: '',
      status: 'COMPLETED',
      createdBy: from._id,
      createdAt,
      updatedAt: createdAt,
    });

    await Activity.create({
      actor: from._id,
      action: 'SETTLEMENT_CREATED',
      entityType: 'settlement',
      entityId: settlement._id,
      group: settlement.group,
      amountPaise: settlement.amountPaise,
      message: `${from.name} paid ${to.name} ${formatINR(settlement.amountPaise)} via ${settlement.method}`,
      createdAt,
    });
    await Notification.create({
      user: to._id,
      type: 'SETTLEMENT',
      title: 'Payment recorded',
      message: `${from.name} recorded a ${formatINR(settlement.amountPaise)} payment`,
      link: '/settlements',
    });
  }
  console.log(`Seeded ${SETTLEMENTS.length} settlements`);

  const rentTemplate = EXPENSES.find((entry) => entry.description === 'Monthly rent');
  const rentData = await prepareExpense(
    {
      description: rentTemplate.description,
      amount: rentTemplate.amount,
      category: categories.get(rentTemplate.category)._id,
      group: groups.get(rentTemplate.group)._id,
      date: new Date(),
      paidBy: [{ user: sashank._id, amount: rentTemplate.amount }],
      splitMethod: 'equal',
      participants: rentTemplate.participants.map((name) => ({ user: users.get(name)._id })),
    },
    sashank,
  );
  await RecurringExpense.create({
    description: rentData.description,
    amountPaise: rentData.amountPaise,
    baseAmountPaise: rentData.baseAmountPaise,
    category: rentData.category,
    group: rentData.group,
    notes: 'Auto-created rent reminder',
    paidBy: rentData.paidBy,
    splits: rentData.splits,
    splitMethod: 'equal',
    frequency: 'MONTHLY',
    nextRunAt: nextRunDate(new Date(), 'MONTHLY'),
    createdBy: sashank._id,
  });

  await Notification.create({
    user: sashank._id,
    type: 'SYSTEM',
    title: 'Welcome to SplitMate',
    message: 'Your demo workspace is ready — explore expenses, balances and analytics.',
    link: '/dashboard',
  });
  console.log('Seeded a recurring rent template and welcome notification');

  console.log('\nDone.');
  console.log('Demo login is', env.demoLoginEnabled ? 'enabled' : 'disabled', 'for the seven seeded users.');
  if (!env.isProd) {
    console.log(`Development password for demo users: ${env.demoPassword}`);
  }
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Seed failed:', error);
  await disconnectDb();
  process.exit(1);
});
