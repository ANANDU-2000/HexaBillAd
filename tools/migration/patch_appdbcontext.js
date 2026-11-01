const fs = require('fs');
const file = 'backend/HexaBill.Api/Data/AppDbContext.cs';
let content = fs.readFileSync(file, 'utf8');

const target = 'public DbSet<LegacyCustomerMapping> LegacyCustomerMappings { get; set; }';
const addition = `public DbSet<LegacyCustomerMapping> LegacyCustomerMappings { get; set; }
        public DbSet<LegacyPurchase> LegacyPurchases { get; set; }
        public DbSet<LegacyPurchaseItem> LegacyPurchaseItems { get; set; }
        public DbSet<LegacyExpenseCategory> LegacyExpenseCategories { get; set; }
        public DbSet<LegacyExpense> LegacyExpenses { get; set; }
        public DbSet<LegacyInventoryTransaction> LegacyInventoryTransactions { get; set; }
        public DbSet<LegacyInvoiceVersion> LegacyInvoiceVersions { get; set; }
        public DbSet<LegacyPaymentReceipt> LegacyPaymentReceipts { get; set; }
        public DbSet<LegacyPaymentReceiptPayment> LegacyPaymentReceiptPayments { get; set; }`;

if (content.includes(target)) {
  content = content.replace(target, addition);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully patched AppDbContext.cs');
} else {
  console.error('Target not found in AppDbContext.cs');
}

