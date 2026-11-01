const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../../backend/HexaBill.Api/Modules/Legacy/LegacyHistoryController.cs');
let content = fs.readFileSync(file, 'utf8');

// Replace 1: Invoices
content = content.replace(
  /if \(fromDate\.HasValue\)[\r\n\s]+{[\r\n\s]+var fromUtc = DateTime\.SpecifyKind\(fromDate\.Value, DateTimeKind\.Utc\);[\r\n\s]+query = query\.Where\(i => i\.InvoiceDate >= fromUtc\);[\r\n\s]+}[\r\n\s]+if \(toDate\.HasValue\)[\r\n\s]+{[\r\n\s]+var toUtc = DateTime\.SpecifyKind\(toDate\.Value, DateTimeKind\.Utc\);[\r\n\s]+query = query\.Where\(i => i\.InvoiceDate <= toUtc\);[\r\n\s]+}/g,
  `if (fromDate.HasValue)
                {
                    var fromUtc = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
                    query = query.Where(i => i.InvoiceDate >= fromUtc);
                }

                if (toDate.HasValue)
                {
                    var toUtc = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
                    query = query.Where(i => i.InvoiceDate <= toUtc);
                }`
);

// Replace 2: Payments
content = content.replace(
  /if \(fromDate\.HasValue\)[\r\n\s]+{[\r\n\s]+var fromUtc = DateTime\.SpecifyKind\(fromDate\.Value, DateTimeKind\.Utc\);[\r\n\s]+query = query\.Where\(x => x\.p\.PaymentDate >= fromUtc\);[\r\n\s]+}[\r\n\s]+if \(toDate\.HasValue\)[\r\n\s]+{[\r\n\s]+var toUtc = DateTime\.SpecifyKind\(toDate\.Value, DateTimeKind\.Utc\);[\r\n\s]+query = query\.Where\(x => x\.p\.PaymentDate <= toUtc\);[\r\n\s]+}/g,
  `if (fromDate.HasValue)
                {
                    var fromUtc = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
                    query = query.Where(x => x.p.PaymentDate >= fromUtc);
                }

                if (toDate.HasValue)
                {
                    var toUtc = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
                    query = query.Where(x => x.p.PaymentDate <= toUtc);
                }`
);

// Replace 3: Unified
content = content.replace(
  /if \(fromDate\.HasValue\)[\r\n\s]+{[\r\n\s]+var fromUtc = DateTime\.SpecifyKind\(fromDate\.Value, DateTimeKind\.Utc\);[\r\n\s]+baseLegacy = baseLegacy\.Where\(i => i\.InvoiceDate >= fromUtc\);[\r\n\s]+}[\r\n\s]+if \(toDate\.HasValue\)[\r\n\s]+{[\r\n\s]+var toUtc = DateTime\.SpecifyKind\(toDate\.Value, DateTimeKind\.Utc\);[\r\n\s]+baseLegacy = baseLegacy\.Where\(i => i\.InvoiceDate <= toUtc\);[\r\n\s]+}/g,
  `if (fromDate.HasValue)
                    {
                        var fromUtc = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
                        baseLegacy = baseLegacy.Where(i => i.InvoiceDate >= fromUtc);
                    }
                    if (toDate.HasValue)
                    {
                        var toUtc = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
                        baseLegacy = baseLegacy.Where(i => i.InvoiceDate <= toUtc);
                    }`
);

// Replace 4: Purchases
content = content.replace(
  /if \(fromDate\.HasValue\)[\r\n\s]+{[\r\n\s]+var fromUtc = DateTime\.SpecifyKind\(fromDate\.Value, DateTimeKind\.Utc\);[\r\n\s]+query = query\.Where\(p => p\.PurchaseDate >= fromUtc\);[\r\n\s]+}[\r\n\s]+if \(toDate\.HasValue\)[\r\n\s]+{[\r\n\s]+var toUtc = DateTime\.SpecifyKind\(toDate\.Value, DateTimeKind\.Utc\);[\r\n\s]+query = query\.Where\(p => p\.PurchaseDate <= toUtc\);[\r\n\s]+}/g,
  `if (fromDate.HasValue)
                {
                    var fromUtc = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
                    query = query.Where(p => p.PurchaseDate >= fromUtc);
                }

                if (toDate.HasValue)
                {
                    var toUtc = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
                    query = query.Where(p => p.PurchaseDate <= toUtc);
                }`
);

// Replace 5: Expenses
content = content.replace(
  /if \(fromDate\.HasValue\)[\r\n\s]+{[\r\n\s]+var fromUtc = DateTime\.SpecifyKind\(fromDate\.Value, DateTimeKind\.Utc\);[\r\n\s]+query = query\.Where\(e => e\.Date >= fromUtc\);[\r\n\s]+}[\r\n\s]+if \(toDate\.HasValue\)[\r\n\s]+{[\r\n\s]+var toUtc = DateTime\.SpecifyKind\(toDate\.Value, DateTimeKind\.Utc\);[\r\n\s]+query = query\.Where\(e => e\.Date <= toUtc\);[\r\n\s]+}/g,
  `if (fromDate.HasValue)
                {
                    var fromUtc = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
                    query = query.Where(e => e.Date >= fromUtc);
                }

                if (toDate.HasValue)
                {
                    var toUtc = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
                    query = query.Where(e => e.Date <= toUtc);
                }`
);

fs.writeFileSync(file, content, 'utf8');
console.log('LegacyHistoryController.cs date boundaries patched successfully!');

