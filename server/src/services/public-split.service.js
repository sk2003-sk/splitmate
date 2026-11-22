import { randomBytes } from 'node:crypto';
import { allocate } from '../utils/money.js';

export function newPersonKey() {
  return randomBytes(4).toString('hex');
}

export function newSplitCode() {
  return randomBytes(4).toString('hex');
}

function participantKeysFor(expense, peopleByKey) {
  const seen = new Set();
  const keys = [];
  for (const key of expense.participantKeys || []) {
    if (peopleByKey.has(key) && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

export function summarizePublicSplit(split) {
  const plain = typeof split.toObject === 'function' ? split.toObject() : split;
  const people = plain.people || [];
  const peopleByKey = new Map(people.map((person) => [person.key, person]));

  const netPaise = new Map(people.map((person) => [person.key, 0]));
  const paidPaise = new Map(people.map((person) => [person.key, 0]));
  const sharePaise = new Map(people.map((person) => [person.key, 0]));
  const directMap = new Map();

  const expenses = [...(plain.expenses || [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((expense) => {
      const keys = participantKeysFor(expense, peopleByKey);
      const payerKey = peopleByKey.has(expense.paidBy?.personKey)
        ? expense.paidBy.personKey
        : keys[0];
      const shares = keys.length ? allocate(expense.amountPaise, keys.map(() => 1)) : [];

      if (payerKey && netPaise.has(payerKey)) {
        netPaise.set(payerKey, netPaise.get(payerKey) + expense.amountPaise);
        paidPaise.set(payerKey, paidPaise.get(payerKey) + expense.amountPaise);
      }
      keys.forEach((key, index) => {
        netPaise.set(key, netPaise.get(key) - shares[index]);
        sharePaise.set(key, sharePaise.get(key) + shares[index]);
        if (key === payerKey) return;
        const directKey = `${key}:${payerKey}`;
        const direct = directMap.get(directKey);
        if (direct) direct.amountPaise += shares[index];
        else directMap.set(directKey, { fromKey: key, toKey: payerKey, amountPaise: shares[index] });
      });

      return {
        _id: String(expense._id),
        description: expense.description,
        amountPaise: expense.amountPaise,
        payer: peopleByKey.get(payerKey) || null,
        date: expense.date,
        splits: keys.map((key, index) => ({
          person: peopleByKey.get(key) || null,
          amountPaise: shares[index],
        })),
      };
    });

  const totalPaise = expenses.reduce((sum, expense) => sum + expense.amountPaise, 0);

  const balances = people.map((person) => ({
    person,
    paidPaise: paidPaise.get(person.key) || 0,
    sharePaise: sharePaise.get(person.key) || 0,
    netPaise: netPaise.get(person.key) || 0,
  }));

  const debtors = balances
    .filter((row) => row.netPaise < 0)
    .map((row) => ({ person: row.person, amountPaise: -row.netPaise }))
    .sort((a, b) => b.amountPaise - a.amountPaise);
  const creditors = balances
    .filter((row) => row.netPaise > 0)
    .map((row) => ({ person: row.person, amountPaise: row.netPaise }))
    .sort((a, b) => b.amountPaise - a.amountPaise);

  const transfers = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountPaise = Math.min(debtor.amountPaise, creditor.amountPaise);
    if (amountPaise > 0) {
      transfers.push({
        from: debtor.person,
        to: creditor.person,
        amountPaise,
      });
    }
    debtor.amountPaise -= amountPaise;
    creditor.amountPaise -= amountPaise;
    if (debtor.amountPaise === 0) debtorIndex += 1;
    if (creditor.amountPaise === 0) creditorIndex += 1;
  }

  const directPayments = [...directMap.values()]
    .filter((row) => row.amountPaise > 0)
    .map((row) => ({
      from: peopleByKey.get(row.fromKey) || null,
      to: peopleByKey.get(row.toKey) || null,
      amountPaise: row.amountPaise,
    }))
    .sort(
      (a, b) =>
        b.amountPaise - a.amountPaise ||
        String(a.from?.name || '').localeCompare(String(b.from?.name || '')),
    );

  return {
    split: {
      code: plain.code,
      title: plain.title,
      people,
      expenses,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    },
    summary: {
      totalPaise,
      expenseCount: expenses.length,
      peopleCount: people.length,
      balances,
      directPayments,
      transfers,
    },
  };
}
