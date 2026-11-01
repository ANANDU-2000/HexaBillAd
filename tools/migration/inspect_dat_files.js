const fs = require('fs');
const readline = require('readline');

const files = {
  ExpenseCategories: 'frozhen/2026-10-31T13_45Z/starplus_billing_2025/3661.dat',
  Expenses: 'frozhen/2026-10-31T13_45Z/starplus_billing_2025/3674.dat',
  Purchases: 'frozhen/2026-10-31T13_45Z/starplus_billing_2025/3680.dat',
  PurchaseItems: 'frozhen/2026-10-31T13_45Z/starplus_billing_2025/3684.dat',
  InventoryTransactions: 'frozhen/2026-10-31T13_45Z/starplus_billing_2025/3668.dat',
  InvoiceVersions: 'frozhen/2026-10-31T13_45Z/starplus_billing_2025/3688.dat',
  PaymentReceipts: 'frozhen/2026-10-31T13_45Z/starplus_billing_2025/3701.dat',
  PaymentReceiptPayments: 'frozhen/2026-10-31T13_45Z/starplus_billing_2025/3703.dat'
};

async function inspect() {
  for (const [name, filepath] of Object.entries(files)) {
    console.log(`\n=== ${name} (${filepath}) ===`);
    const rl = readline.createInterface({
      input: fs.createReadStream(filepath, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });
    let count = 0;
    for await (const line of rl) {
      if (line === '\\.') break;
      count++;
      if (count <= 2) {
        console.log(`  Sample ${count}: ${line.slice(0, 150)}`);
      }
    }
    console.log(`  Total rows: ${count}`);
  }
}

inspect().catch(console.error);

