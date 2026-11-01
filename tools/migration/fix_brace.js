const fs = require('fs');
let file = fs.readFileSync('frontend/hexabill-ui/src/features/customers/CustomerLedgerPage.jsx', 'utf8');
file = file.replace(/\r\n/g, '\n');

const target = `        // SILENT PAYMENT INTEGRITY CHECK - only log, don't show toast
        const paymentIntegrity = verifyPaymentIntegrity(customerPayments, invoicesData)
        if (!paymentIntegrity.isValid) {
          console.warn('Payment integrity issues:', paymentIntegrity.issues)
          // Don't show toast - this message is confusing and floods on every load
          // User can manually reconcile if needed using the Reconcile button
        }
      }

      if (!isStale()) {`;

const replacement = `        // SILENT PAYMENT INTEGRITY CHECK - only log, don't show toast
        const paymentIntegrity = verifyPaymentIntegrity(customerPayments, invoicesData)
        if (!paymentIntegrity.isValid) {
          console.warn('Payment integrity issues:', paymentIntegrity.issues)
          // Don't show toast - this message is confusing and floods on every load
          // User can manually reconcile if needed using the Reconcile button
        }

      if (!isStale()) {`;

if (!file.includes(target)) {
  console.error('Target not found!');
  process.exit(1);
}

file = file.replace(target, replacement);
file = file.replace(/\n/g, '\r\n');
fs.writeFileSync('frontend/hexabill-ui/src/features/customers/CustomerLedgerPage.jsx', file, 'utf8');
console.log('Fixed dangling brace in CustomerLedgerPage.jsx!');

