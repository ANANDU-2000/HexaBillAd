// Deterministic intent detection for the assistant. Pure: no React, no network, no model.
// It turns common phrases and the quick-action chips into either a read-only tool call or a pre-filled action card, so the
// everyday actions work instantly, in English, Malayalam, Hindi and Arabic, even when no AI provider is reachable.
// Nothing here saves anything: a card is always reviewed and confirmed by the person.

/** Digits in Arabic-Indic, Devanagari, Malayalam and other scripts become 0-9. */
export function normalizeDigits (value) {
  let out = ''
  for (const ch of String(value ?? '')) {
    const code = ch.codePointAt(0)
    if (code >= 0x30 && code <= 0x39) out += ch
    else if (code >= 0x0660 && code <= 0x0669) out += String(code - 0x0660) // Arabic-Indic
    else if (code >= 0x06f0 && code <= 0x06f9) out += String(code - 0x06f0) // Eastern Arabic-Indic
    else if (code >= 0x0966 && code <= 0x096f) out += String(code - 0x0966) // Devanagari
    else if (code >= 0x0d66 && code <= 0x0d6f) out += String(code - 0x0d66) // Malayalam
    else if (ch === '٫') out += '.'
    else if (ch === '٬') continue
    else out += ch
  }
  return out
}

const has = (text, re) => re.test(text)

// Keyword sets. English plus the common Malayalam, Hindi and Arabic words people actually say.
const RE = {
  summary: /\b(summary|summaries|overview|dashboard|how(?:'s| is) (?:the )?business|today'?s (?:sales|business|report))\b|സംഗ്രഹ|ഇന്നത്തെ (?:വിൽപ്പന|കച്ചവടം)|सारांश|आज की बिक्री|ملخص|مبيعات اليوم/i,
  overdue: /\b(overdue|outstanding|pending (?:bills?|payments?|dues?)|who owes|unpaid|receivables?)\b|കുടിശ്ശിക|ബാക്കി തരാനുള്ള|बकाया|उधार|متأخر|مستحق/i,
  lowStock: /\b(low[\s-]?stock|out of stock|running out|reorder|stock (?:is )?(?:low|finish(?:ed)?)|short(?:age)?)\b|സ്റ്റോക്ക് (?:കുറവ്|തീർന്ന)|स्टॉक (?:कम|खत्म)|مخزون (?:منخفض|ناقص)/i,
  stockOf: /\b(?:stock|qty|quantity|how (?:many|much))\s+(?:of|for)\s+(.{2,40}?)\s*[?.!]*$|^\s*(.{2,40}?)\s+stock\s*[?.!]*$/i,
  payment: /\b(received|receive|collected|collection|payment (?:from|received)|got (?:paid|payment)|paid me|receipt)\b|പണം (?:കിട്ടി|ലഭിച്ചു)|കിട്ടി|मिला|वसूल|استلمت|قبضت|دفعة/i,
  expense: /\b(expense|expenses|spent|spend|bought for|paid for|fuel|petrol|diesel|rent|salary|wages|electricity|dewa|transport|maintenance|repair|lunch|tea|internet|etisalat)\b|ചെലവ്|ചിലവ്|खर्च|खर्चा|مصروف|مصاريف/i,
  invoice: /\b(invoice|bill|sale|sell|sold|quotation|quote|pos)\b|ബിൽ|ഇൻവോയ്സ്|विक्रय|बिल|فاتورة|بيع/i,
  customer: /\b(customer|client|party)\b|കസ്റ്റമർ|ഉപഭോക്താവ്|ग्राहक|عميل/i,
  product: /\b(product|item|stock item|sku)\b|ഉൽപ്പന്നം|സാധനം|प्रोडक्ट|सामान|منتج/i,
  create: /\b(add|new|create|make|register|enter|record|raise|start)\b|പുതിയ|ചേർക്ക|ഉണ്ടാക്ക|नया|जोड़|बनाओ|أضف|جديد|انشئ/i,
}

const CATEGORY_WORDS = [
  [/\b(fuel|petrol|diesel|gas)\b/i, 'Fuel'],
  [/\brent\b/i, 'Rent'],
  [/\b(salary|salaries|wages|wage)\b/i, 'Salary'],
  [/\b(electricity|dewa|water bill|utility|utilities)\b/i, 'Utilities'],
  [/\b(transport|delivery|freight|taxi|parking|toll|salik)\b/i, 'Transport'],
  [/\b(maintenance|repair|service)\b/i, 'Maintenance'],
  [/\b(lunch|tea|coffee|food|meal|snacks?)\b/i, 'Food'],
  [/\b(internet|phone|mobile|etisalat|du\b|recharge)\b/i, 'Communication'],
  [/\b(packing|packaging|carton|bags?)\b/i, 'Packaging'],
]

/** First sensible money amount in the text, or ''. Phone-length numbers are ignored. */
export function extractAmount (text) {
  const t = normalizeDigits(text).replace(/(\d),(\d{3})/g, '$1$2')
  const matches = t.match(/\d+(?:\.\d{1,2})?/g) || []
  for (const m of matches) {
    const digits = m.replace('.', '')
    if (digits.length > 9) continue
    const n = Number(m)
    if (n > 0) return String(n)
  }
  return ''
}

const STOP = '(?=\\s+(?:for|of|via|by|in|on|at|cash|card|bank|transfer|cheque|check|upi|aed|dirhams?|dhs?|rs|today|yesterday|as)\\b|[,.;!?\\d]|$)'

/** Customer name after "from / by / to", e.g. "Received 500 from Al Noor in cash" -> "Al Noor". */
export function extractParty (text) {
  const t = normalizeDigits(text)
  const m = t.match(new RegExp(`\\b(?:from|by|to|for customer|customer|client)\\s+([\\p{L}][\\p{L}\\p{M}'&.\\- ]{1,50}?)${STOP}`, 'iu'))
  if (!m) return ''
  const name = m[1].trim().replace(/\s+/g, ' ')
  return /^(me|us|the|a|an|my|our|today|cash|card)$/i.test(name) ? '' : name
}

export function extractMode (text) {
  if (/\b(card|visa|master)\b/i.test(text)) return 'ONLINE'
  if (/\b(bank|transfer|neft|iban|online)\b/i.test(text)) return 'ONLINE'
  if (/\b(cheque|check)\b/i.test(text)) return 'CHEQUE'
  if (/\b(upi|gpay|wallet)\b/i.test(text)) return 'ONLINE'
  return 'CASH'
}

export function extractCategory (text) {
  for (const [re, name] of CATEGORY_WORDS) if (re.test(text)) return name
  return ''
}

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n)

/**
 * text -> null (let the AI route it) or
 *   { type: 'tool', tool, args, label }                 read-only lookup
 *   { type: 'form', kind, fields, label }               action card to review and confirm
 */
export function detectIntent (raw) {
  const text = clip(raw, 500)
  if (text.length < 2) return null
  const wantsNew = has(text, RE.create)

  // Lookups first: they never need a name or an amount.
  if (has(text, RE.lowStock)) return { type: 'tool', tool: 'low_stock_products', args: { limit: 10 }, label: 'Low and out-of-stock products' }
  if (has(text, RE.summary) && !has(text, RE.expense)) return { type: 'tool', tool: 'dashboard_summary', args: { query: 'today', limit: 1 }, label: "Today's business summary" }
  if (has(text, RE.overdue) && !has(text, RE.payment)) return { type: 'tool', tool: 'route_overdue', args: { query: 'all', limit: 10 }, label: 'Overdue customers' }

  // Actions.
  const amount = extractAmount(text)
  const party = extractParty(text)
  const isPayment = has(text, RE.payment)
  if (isPayment) {
    return { type: 'form', kind: 'new_payment', label: 'Payment received', fields: { ...(party && { customerName: party }), ...(amount && { amount }), mode: extractMode(text), note: '' } }
  }
  if (has(text, RE.expense) && (wantsNew || amount || extractCategory(text) || /\b(expense|expenses)\b|ചെലവ്|ചിലവ്|खर्च|مصروف/i.test(text))) {
    const category = extractCategory(text)
    return { type: 'form', kind: 'new_expense', label: 'New expense', fields: { ...(amount && { amount }), ...(category && { categoryName: category }), note: clip(text, 200) } }
  }
  if (has(text, RE.customer) && wantsNew) {
    return { type: 'form', kind: 'new_customer', label: 'New customer', fields: { ...(party && { name: party }) } }
  }
  if (has(text, RE.product) && wantsNew) {
    const m = normalizeDigits(text).match(/\b(?:product|item)\s+(?:called|named)?\s*([\p{L}\p{N}][\p{L}\p{N}\p{M}'&.\-/ ]{1,60}?)(?=\s+(?:for|at|price|cost|sell|selling)\b|[,.;!?]|$)/iu)
    return { type: 'form', kind: 'new_product', label: 'New product', fields: { ...(m && { name: m[1].trim() }) } }
  }
  if (has(text, RE.invoice) && (wantsNew || /\b(sold|sell)\b/i.test(text))) {
    return { type: 'form', kind: 'new_sale', label: 'New invoice', fields: { ...(party && { customerName: party }) } }
  }

  // "stock of rice" / "rice stock"
  const stock = text.match(RE.stockOf)
  if (stock) {
    const q = clip(stock[1] || stock[2], 60)
    if (q.length >= 2 && !/^(low|the|our|my)$/i.test(q)) return { type: 'tool', tool: 'product_stock', args: { query: q, limit: 5 }, label: `Stock of “${q}”` }
  }
  return null
}

/** A one-line spoken or written confirmation for the assistant's bubble before the card. */
export function introFor (intent) {
  if (!intent) return ''
  if (intent.type === 'tool') return `${intent.label}:`
  const filled = Object.keys(intent.fields || {}).filter((k) => intent.fields[k] && k !== 'mode').length
  return filled > 0
    ? `${intent.label}. I filled in what you said. Check it and tap Confirm.`
    : `${intent.label}. Fill in the details below, then tap Confirm.`
}
