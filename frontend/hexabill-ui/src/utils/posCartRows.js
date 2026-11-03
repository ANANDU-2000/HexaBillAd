// Cart rows that have a product and a quantity but no selling price. The server refuses such lines (AED 0.00),
// so POS must stop and say which product needs a price instead of dropping the row and saving the rest.
// A zero invoice (free sample) is allowed to carry zero-price rows.
export function findPricelessCartRows(cart, isZeroInvoice) {
  if (isZeroInvoice) return []
  return (cart || []).filter(item => item?.productId && Number(item.qty) > 0 && !(Number(item.unitPrice) > 0))
}
