const fs = require('fs');
const path = 'tools/StarplusMigrationRunner/Program.cs';
let content = fs.readFileSync(path, 'utf8');

content = content.replace('AND ""TransactionType"" = 1', "AND \"\"TransactionType\"\" = 'Sale'");
fs.writeFileSync(path, content, 'utf8');

console.log('Fixed verbatim string TransactionType!');
