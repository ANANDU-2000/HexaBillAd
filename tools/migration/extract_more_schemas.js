const fs = require('fs');
const content = fs.readFileSync('frozhen/2026-10-31T13_45Z/starplus_billing_2025/toc.dat', 'latin1');

['Purchases', 'PurchaseItems', 'Expenses', 'ExpenseCategories', 'InventoryTransactions', 'InvoiceVersions', 'PaymentReceipts', 'PaymentReceiptPayments'].forEach(name => {
  const match = content.match(new RegExp(`CREATE TABLE "public"\\."${name}"\\s*\\(([^;]+)\\);`));
  if (match) {
    console.log(`\n=== CREATE TABLE "public"."${name}" ===`);
    console.log(match[1].trim());
  }
});
