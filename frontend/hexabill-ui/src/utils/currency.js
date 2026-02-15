// Currency utility for multi-currency support
export const CURRENCIES = {
  AED: { symbol: 'AED', name: 'UAE Dirham', position: 'after', decimals: 2 },
  INR: { symbol: '₹', name: 'Indian Rupee', position: 'before', decimals: 2 },
  USD: { symbol: '$', name: 'US Dollar', position: 'before', decimals: 2 },
  EUR: { symbol: '€', name: 'Euro', position: 'before', decimals: 2 }
}

export const formatCurrency = (amount, currency = 'AED') => {
  const config = CURRENCIES[currency] || CURRENCIES.AED
  const formattedAmount = amount.toFixed(config.decimals)
  
  if (config.position === 'before') {
    return `${config.symbol} ${formattedAmount}`
  } else {
    return `${formattedAmount} ${config.symbol}`
  }
}

export const parseCurrency = (value, currency = 'AED') => {
  const config = CURRENCIES[currency] || CURRENCIES.AED
  const symbol = config.symbol
  
  // Remove currency symbol and parse
  let cleanValue = value.toString().replace(symbol, '').trim()
  
  // Handle different decimal separators
  cleanValue = cleanValue.replace(',', '.')
  
  return parseFloat(cleanValue) || 0
}

export const getCurrencySymbol = (currency = 'AED') => {
  return CURRENCIES[currency]?.symbol || 'AED'
}

export const getCurrencyName = (currency = 'AED') => {
  return CURRENCIES[currency]?.name || 'UAE Dirham'
}

// Format balance like Tally (Dr: for Debit/Positive, Cr: for Credit/Negative)
export const formatBalance = (balance, currency = 'AED') => {
  const config = CURRENCIES[currency] || CURRENCIES.AED
  const absBalance = Math.abs(balance)
  const formattedAmount = absBalance.toFixed(config.decimals)
  
  if (balance < 0) {
    // Negative balance = Credit (customer has overpaid or we owe them)
    return `Cr: ${formattedAmount} ${config.symbol}`
  } else if (balance > 0) {
    // Positive balance = Debit (customer owes us)
    return `Dr: ${formattedAmount} ${config.symbol}`
  } else {
    // Zero balance
    return `0.00 ${config.symbol}`
  }
}

// Format balance with color (red for debit, green for credit)
export const formatBalanceWithColor = (balance, currency = 'AED') => {
  const formatted = formatBalance(balance, currency)
  const colorClass = balance < 0 ? 'text-green-600 font-medium' : balance > 0 ? 'text-red-600 font-medium' : 'text-gray-600'
  return { formatted, colorClass }
}