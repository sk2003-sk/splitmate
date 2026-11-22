const MAX_SAFE_PAISE = 9_000_000_000_000;

export function toPaise(rupees) {
  const value = Number(rupees);
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * 100);
}

export function toRupees(paise) {
  return Math.round(Number(paise)) / 100;
}

/**
 * Split an integer paise amount proportionally to positive weights.
 * Uses the largest-remainder method so the parts always sum to `amountPaise`.
 */
export function allocate(amountPaise, weights) {
  const amount = Math.round(Number(amountPaise));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('allocate() needs a positive integer amount');
  }
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new Error('allocate() needs at least one weight');
  }
  const numeric = weights.map((w) => Number(w) || 0);
  if (numeric.some((w) => w < 0)) {
    throw new Error('allocate() weights cannot be negative');
  }
  const total = numeric.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    throw new Error('allocate() weights must have a positive total');
  }

  const raw = numeric.map((w) => (amount * w) / total);
  const parts = raw.map((value) => Math.floor(value));
  const used = parts.reduce((sum, part) => sum + part, 0);
  let remainder = amount - used;

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

export function assertPaise(value, label = 'amount') {
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_SAFE_PAISE) {
    throw new Error(`${label} must be a positive amount`);
  }
  return amount;
}

export function formatINR(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(toRupees(paise));
}
