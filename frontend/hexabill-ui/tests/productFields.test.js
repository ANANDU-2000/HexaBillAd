import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanText, fixName, fixMoney, fixConversion, fixBarcode, MAX_PRICE, validateProductFields } from '../src/utils/productFields.js'

test('names lose extra spaces', () => {
  assert.equal(cleanText('  Beef   Nan  250gm '), 'Beef Nan 250gm')
  assert.ok(fixName(' Beef  ').note)
  assert.equal(fixName('Beef').note, '')
})

test('prices are rounded, cleaned and clamped', () => {
  assert.deepEqual(fixMoney(12.345), { value: 12.35, note: 'Price rounded to 2 decimals (12.35).' })
  assert.equal(fixMoney('1,200.50').value, 1200.5)
  assert.equal(fixMoney('AED 12').value, 12)
  assert.equal(fixMoney('').value, 0)
  assert.equal(fixMoney('abc').value, 0)
  assert.equal(fixMoney(-5, 'Cost price').value, 0)
  assert.match(fixMoney(-5, 'Cost price').note, /Cost price cannot be below 0/)
  assert.equal(fixMoney(5_000_000).value, MAX_PRICE)
  assert.equal(fixMoney(140).note, '')
})

test('conversion is repaired to a positive number', () => {
  assert.equal(fixConversion(0).value, 1)
  assert.equal(fixConversion(-3).value, 1)
  assert.equal(fixConversion('').value, 1)
  assert.equal(fixConversion(12).note, '')
  assert.equal(fixConversion(0.123456).value, 0.1235)
})

test('barcode spaces are removed', () => {
  assert.equal(fixBarcode(' 6281 0000 00001 ').value, '6281000000001')
})

const validForm = { sku: 'QA-18KG', nameEn: 'Synthetic carton', unitType: 'CRTN', conversionToBase: 1, costPrice: 120, sellPrice: 145, reorderLevel: 0 }

test('invalid product values are rejected without guessing or changing the submitted values', () => {
  const values = { ...validForm, nameEn: '', costPrice: -1, conversionToBase: 0, reorderLevel: 0.5 }
  const original = { ...values }
  const errors = validateProductFields(values)
  assert.match(errors.nameEn, /English product name/)
  assert.match(errors.costPrice, /between 0 and/)
  assert.match(errors.conversionToBase, /0.0001/)
  assert.match(errors.reorderLevel, /whole-number/)
  assert.deepEqual(values, original)
})

test('product validation aligns supported decimal conversions, limits and optional text with the API', () => {
  assert.deepEqual(validateProductFields({ ...validForm, conversionToBase: 0.0001, costPrice: 0 }), {})
  assert.match(validateProductFields({ ...validForm, descriptionAr: 'ع'.repeat(501) }).descriptionAr, /500/)
  assert.match(validateProductFields({ ...validForm, sellPrice: '' }).sellPrice, /Selling price/)
  assert.match(validateProductFields({ ...validForm, conversionToBase: 1000000 }).conversionToBase, /999,999.99/)
})
