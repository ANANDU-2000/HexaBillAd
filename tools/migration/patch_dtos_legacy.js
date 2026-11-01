const fs = require('fs');

let file = fs.readFileSync('backend/HexaBill.Api/Models/DTOs.cs', 'utf8');

// 1. CustomerLedgerEntry
const target1 = `        public decimal PaidAmount { get; set; } // Amount paid for invoice
    }`;
const repl1 = `        public decimal PaidAmount { get; set; } // Amount paid for invoice
        public bool IsLegacy { get; set; }
        public int? LegacyInvoiceId { get; set; }
        public int? LegacyPaymentId { get; set; }
    }`;

// 2. PendingBillDto
const target2 = `        public string PaymentStatus { get; set; } = string.Empty;
        public int DaysOverdue { get; set; }
    }`;
const repl2 = `        public string PaymentStatus { get; set; } = string.Empty;
        public int DaysOverdue { get; set; }
        public bool IsLegacy { get; set; }
    }`;

// 3. OutstandingInvoiceDto
const target3 = `        public string PaymentStatus { get; set; } = string.Empty;
        public int DaysOverdue { get; set; }
    }

    // Delete Customer Summary DTO`;
const repl3 = `        public string PaymentStatus { get; set; } = string.Empty;
        public int DaysOverdue { get; set; }
        public bool IsLegacy { get; set; }
        public int? LegacyInvoiceId { get; set; }
    }

    // Delete Customer Summary DTO`;

file = file.replace(/\r\n/g, '\n');
if (!file.includes(target1)) console.error('Target 1 not found!');
if (!file.includes(target2)) console.error('Target 2 not found!');
if (!file.includes(target3)) console.error('Target 3 not found!');

file = file.replace(target1, repl1);
file = file.replace(target2, repl2);
file = file.replace(target3, repl3);

file = file.replace(/\n/g, '\r\n');
fs.writeFileSync('backend/HexaBill.Api/Models/DTOs.cs', file, 'utf8');
console.log('DTOs.cs patched successfully!');

