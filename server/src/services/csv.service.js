function escapeCell(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

export function expensesToCsv(expenses) {
  const header = [
    'Date',
    'Description',
    'Group',
    'Category',
    'Paid by',
    'Amount',
    'Currency',
    'Split method',
    'Notes',
  ];
  const rows = expenses.map((expense) => {
    const paidBy = (expense.paidBy || [])
      .map((payer) => `${payer.user?.name || 'Unknown'} (${(payer.amountPaise / 100).toFixed(2)})`)
      .join('; ');
    return [
      new Date(expense.date).toISOString().slice(0, 10),
      expense.description,
      expense.group?.name || 'No group',
      expense.category?.name || 'Uncategorized',
      paidBy,
      (expense.amountPaise / 100).toFixed(2),
      expense.currency,
      expense.splitMethod,
      expense.notes || '',
    ];
  });

  const total = expenses.reduce((sum, expense) => sum + expense.baseAmountPaise, 0);
  rows.push([]);
  rows.push(['Total (INR)', '', '', '', '', (total / 100).toFixed(2), 'INR', '', '']);
  return toCsv([header, ...rows]);
}
