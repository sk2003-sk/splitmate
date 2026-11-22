import { toPaise } from '../utils/money.js';

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&rsquo;': "'",
  '&ldquo;': '"',
  '&rdquo;': '"',
};

function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&[a-z]+;|&#39;/gi, (match) => ENTITIES[match.toLowerCase()] || match);
}

function stripHtml(value) {
  return decodeEntities(String(value || ''))
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(?:p|div|tr|li|h\d)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const IGNORE_RULES = [
  [
    'otp',
    /\b(one[- ]?time password|otp|verification code|do not share (?:this|the) (?:code|otp))\b/i,
  ],
  [
    'failed',
    /\b(?:payment|transaction|transfer|request)\b[^.]{0,60}\b(?:failed|declined|unsuccessful|cancelled|canceled|not processed)\b/i,
  ],
  [
    'failed',
    /\b(?:failed|declined|unsuccessful)\b[^.]{0,30}\b(?:payment|transaction|transfer)\b/i,
  ],
  [
    'not-a-transaction',
    /\b(?:e-?statement|statement (?:for|is ready)|minimum (?:amount )?due|total amount due|bill generated|bill is ready|payment due|due date|reminder|exclusive offer|offer for you|cashback offer|kyc|login alert|new device login|password (?:changed|reset)|collect request|requested money|payment request|mandate|autopay|e-?mandate)\b/i,
  ],
];

const VPA_RE =
  /\b([a-z0-9._-]{2,}@(?:okaxis|okhdfcbank|okicici|oksbi|okbizaxis|ybl|ibl|axl|paytm|apl|airtel|slc|slice|upi))\b/i;

const CATEGORY_RULES = [
  ['Food', /\b(swiggy|zomato|restaurant|cafe|coffee|pizza|bakery|food|eatfit|dominos|kfc|mcdonald|burger)\b/i],
  ['Groceries', /\b(bigbasket|blinkit|zepto|instamart|grofers|dmart|supermarket|grocery|kirana)\b/i],
  ['Transport', /\b(uber|ola|rapido|metro|petrol|fuel|indian oil|hp pay|fastag|irctc|redbus|parking)\b/i],
  ['Shopping', /\b(amazon|flipkart|myntra|ajio|meesho|nykaa|decathlon|shopping)\b/i],
  ['Bills', /\b(electricity|water bill|gas bill|broadband|recharge|jio|airtel|bsnl|dth|insurance|premium)\b/i],
  ['Entertainment', /\b(netflix|spotify|hotstar|prime video|bookmyshow|pvr|inox)\b/i],
  ['Health', /\b(pharmacy|apollo|medplus|hospital|clinic|doctor|1mg|pharmeasy)\b/i],
  ['Rent', /\b(rent|landlord)\b/i],
  ['Travel', /\b(flight|airlines|hotel|makemytrip|goibibo|cleartrip|oyo|ixigo)\b/i],
];

const BAD_PAYEE =
  /^(?:your|the)\s+account$|^a\/c\b|^account\b|^vpa$|^upi$|^bank$|^beneficiary$|^unknown$|.*\baccount\s+(?:ending|no)\b/i;

function stripBalanceChunks(text) {
  return text.replace(
    /(?:avl\.?\s*bal(?:ance)?|available balance|closing balance|current balance|account balance)[^0-9]{0,40}(?:₹|rs\.?|inr)?\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?/gi,
    ' ',
  );
}

function extractAmount(text) {
  const cleaned = stripBalanceChunks(text);
  const patterns = [
    /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,
    /([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:₹|rs\.?|inr)\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of cleaned.matchAll(pattern)) {
      const value = Number(String(match[1]).replace(/,/g, ''));
      if (Number.isFinite(value) && value > 0 && value <= 1_000_000_000) return value;
    }
  }
  return null;
}

function detectDirection(text) {
  const debit = /\b(?:debited|debit|withdrawn|withdrawal|paid|sent|spent|purchase|charged|transferred to|trf to)\b/i.test(
    text,
  );
  const credit = /\b(?:credited|credit|deposited|received|refund(?:ed)?|reversal)\b/i.test(text);
  if (debit) return 'OUT';
  if (credit) return 'IN';
  return null;
}

function cleanPayee(value) {
  const cleaned = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,.@-]+|[\s:;,.@-]+$/g, '')
    .slice(0, 120)
    .trim();
  if (!cleaned || BAD_PAYEE.test(cleaned)) return '';
  return cleaned;
}

function extractPayee(text, vpa) {
  const hdfc = text.match(/Info\s*:\s*UPI\/(?:P2M|P2A)\/[^/]+\/([^/\n|]+)/i);
  if (hdfc) {
    const value = cleanPayee(hdfc[1]);
    if (value) return value;
  }

  const vpaWithName = text.match(/\b(?:vpa|upi id)\s+([a-z0-9._-]+@[a-z]+)\s*\(([^)]{2,60})\)/i);
  if (vpaWithName) {
    const value = cleanPayee(vpaWithName[2]);
    if (value) return value;
  }

  const towardsVpa = text.match(/towards\s+([A-Za-z0-9 .&'-]{2,60})\s*\(([^)]+)\)/i);
  if (towardsVpa) {
    const value = cleanPayee(towardsVpa[2]) || cleanPayee(towardsVpa[1]);
    if (value) return value;
  }

  const toMatch = text.match(
    /(?:towards|to|at|merchant(?:\s+name)?\s*[:\-]?)\s+([A-Za-z0-9][A-Za-z0-9 &.'_@-]{1,59}?)(?=\s+(?:on|dated|via|using|through|ref|reference|upi|vpa|from|for)\b|[,.;|]|$)/i,
  );
  if (toMatch) {
    const value = cleanPayee(toMatch[1]);
    if (value) return value;
  }

  if (vpa) return vpa;
  return '';
}

function detectApp(text, vpa) {
  const lower = text.toLowerCase();
  if (/\b(?:google pay|gpay|tez)\b/.test(lower)) return 'GPAY';
  if (/\bphonepe\b/.test(lower)) return 'PHONEPE';
  if (/\bpaytm\b/.test(lower)) return 'PAYTM';
  if (/\bslice\b/.test(lower)) return 'SLICE';
  if (vpa) {
    if (/@(?:okaxis|okhdfcbank|okicici|oksbi|okbizaxis)$/i.test(vpa)) return 'GPAY';
    if (/@(?:ybl|ibl|axl)$/i.test(vpa)) return 'PHONEPE';
    if (/@paytm$/i.test(vpa)) return 'PAYTM';
    if (/@(?:slc|slice)$/i.test(vpa)) return 'SLICE';
  }
  return 'BANK';
}

function detectCategory(text) {
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }
  return 'Other';
}

function resolvePaidAt(dateValue) {
  const parsed = dateValue ? new Date(dateValue) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return new Date();
  const now = Date.now();
  if (parsed.getTime() > now + 24 * 60 * 60 * 1000) return new Date();
  if (now - parsed.getTime() > 45 * 24 * 60 * 60 * 1000) return new Date();
  return parsed;
}

/**
 * Turns a bank or payment-app alert email into a payment candidate.
 * Heuristic by design: anything without a clear amount and direction is ignored,
 * never guessed. Parsing happens on the server from the forwarded email body.
 */
export function parseBankEmail({ subject = '', text = '', html = '', date } = {}) {
  const body = stripHtml(text || html);
  const haystack = `${subject}\n${body}`.trim();
  if (!haystack) return { status: 'IGNORED', reason: 'empty' };

  for (const [reason, pattern] of IGNORE_RULES) {
    if (pattern.test(haystack)) return { status: 'IGNORED', reason };
  }

  const amount = extractAmount(haystack);
  if (!amount) return { status: 'IGNORED', reason: 'no-amount' };

  const direction = detectDirection(haystack);
  if (!direction) return { status: 'IGNORED', reason: 'no-direction' };

  const amountPaise = toPaise(amount);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    return { status: 'IGNORED', reason: 'no-amount' };
  }

  const vpaMatch = haystack.match(VPA_RE);
  const vpa = vpaMatch ? vpaMatch[1].toLowerCase() : '';
  const namedPayee = extractPayee(haystack, vpa);
  const payee = namedPayee || 'Bank transaction';
  const app = detectApp(haystack, vpa);
  const category = detectCategory(haystack);

  let confidence = 0.6;
  if (namedPayee) confidence += 0.25;
  if (vpa) confidence += 0.05;
  if (app !== 'BANK') confidence += 0.05;
  if (category !== 'Other') confidence += 0.05;
  confidence = Math.min(1, Math.round(confidence * 100) / 100);

  return {
    status: 'CREATED',
    confidence,
    needsReview: confidence < 0.8,
    payment: {
      payee,
      amountPaise,
      app,
      direction,
      category,
      paidAt: resolvePaidAt(date),
      note: 'Auto-captured from a forwarded email',
    },
  };
}
