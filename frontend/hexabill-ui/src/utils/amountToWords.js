/**
 * Gulf-style integer amount to words (uppercase) — mirrors backend AmountToWords.IntegerUpper
 * for salary certificate live preview / auto-fill.
 */
const UNITS = [
  'ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
  'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
]
const TENS = ['ZERO', 'TEN', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']

function integerWords(n) {
  let number = Math.floor(Math.abs(Number(n) || 0))
  if (number === 0) return 'ZERO'

  let words = ''
  if (Math.floor(number / 1000000000) > 0) {
    words += `${integerWords(Math.floor(number / 1000000000))} BILLION `
    number %= 1000000000
  }
  if (Math.floor(number / 1000000) > 0) {
    words += `${integerWords(Math.floor(number / 1000000))} MILLION `
    number %= 1000000
  }
  if (Math.floor(number / 1000) > 0) {
    words += `${integerWords(Math.floor(number / 1000))} THOUSAND `
    number %= 1000
  }
  if (Math.floor(number / 100) > 0) {
    words += `${integerWords(Math.floor(number / 100))} HUNDRED `
    number %= 100
  }
  if (number > 0) {
    if (number < 20) words += UNITS[number]
    else {
      words += TENS[Math.floor(number / 10)]
      if (number % 10 > 0) words += ` ${UNITS[number % 10]}`
    }
  }
  return words.trim()
}

/** @param {string|number|null|undefined} amount */
export function amountToWordsUpper(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n) || n < 0) return ''
  const words = integerWords(n)
  return n < 0 ? `MINUS ${words}` : words
}
