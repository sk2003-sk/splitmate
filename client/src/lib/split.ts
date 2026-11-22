export function allocatePaise(amountPaise: number, weights: number[]): number[] {
  const amount = Math.round(amountPaise);
  if (!Number.isFinite(amount) || amount <= 0 || !weights.length) {
    return weights.map(() => 0);
  }
  const total = weights.reduce((sum, weight) => sum + (Number(weight) || 0), 0);
  if (total <= 0) return weights.map(() => 0);

  const raw = weights.map((weight) => (amount * (Number(weight) || 0)) / total);
  const parts = raw.map((value) => Math.floor(value));
  let remainder = amount - parts.reduce((sum, part) => sum + part, 0);

  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  let cursor = 0;
  while (remainder > 0) {
    parts[order[cursor % order.length].index] += 1;
    cursor += 1;
    remainder -= 1;
  }
  return parts;
}

export interface SplitPreview {
  shares: Record<string, number>;
  total: number;
  remaining: number;
  valid: boolean;
  error?: string;
}

export function previewSplits(
  amountPaise: number,
  method: string,
  participantIds: string[],
  values: Record<string, string>,
): SplitPreview {
  const shares: Record<string, number> = {};
  const safeAmount = Number.isFinite(amountPaise) ? Math.max(0, Math.round(amountPaise)) : 0;

  if (!participantIds.length) {
    return { shares, total: 0, remaining: safeAmount, valid: false, error: 'Select at least one participant' };
  }
  if (safeAmount <= 0) {
    return { shares, total: 0, remaining: 0, valid: false, error: 'Enter an amount first' };
  }

  if (method === 'equal') {
    const parts = allocatePaise(safeAmount, participantIds.map(() => 1));
    participantIds.forEach((id, index) => {
      shares[id] = parts[index];
    });
    return { shares, total: safeAmount, remaining: 0, valid: true };
  }

  if (method === 'percentage') {
    const percentages = participantIds.map((id) => Number(values[id] || 0));
    const sum = percentages.reduce((total, value) => total + value, 0);
    if (percentages.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
      return { shares, total: 0, remaining: safeAmount, valid: false, error: 'Percentages must be between 0 and 100' };
    }
    if (Math.abs(sum - 100) > 0.01) {
      return {
        shares,
        total: 0,
        remaining: safeAmount,
        valid: false,
        error: `Percentages add up to ${sum.toFixed(2)}% — they must total 100%`,
      };
    }
    const parts = allocatePaise(safeAmount, percentages);
    participantIds.forEach((id, index) => {
      shares[id] = parts[index];
    });
    return { shares, total: safeAmount, remaining: 0, valid: true };
  }

  if (method === 'shares') {
    const weights = participantIds.map((id) => Number(values[id] || 0));
    if (weights.some((value) => !Number.isFinite(value) || value < 0)) {
      return { shares, total: 0, remaining: safeAmount, valid: false, error: 'Shares must be zero or positive' };
    }
    if (weights.reduce((sum, value) => sum + value, 0) <= 0) {
      return { shares, total: 0, remaining: safeAmount, valid: false, error: 'Total shares must be greater than zero' };
    }
    const parts = allocatePaise(safeAmount, weights);
    participantIds.forEach((id, index) => {
      shares[id] = parts[index];
    });
    return { shares, total: safeAmount, remaining: 0, valid: true };
  }

  const amounts = participantIds.map((id) => Math.round(Number(values[id] || 0) * 100));
  const total = amounts.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  participantIds.forEach((id, index) => {
    shares[id] = amounts[index];
  });
  const remaining = safeAmount - total;
  return {
    shares,
    total,
    remaining,
    valid: remaining === 0,
    error:
      remaining === 0
        ? undefined
        : remaining > 0
          ? `₹${(remaining / 100).toFixed(2)} is still unallocated`
          : `₹${(Math.abs(remaining) / 100).toFixed(2)} over the expense total`,
  };
}
