const fs = require('fs');
let content = fs.readFileSync('tools/StarplusMigrationRunner/Program.cs', 'utf8');

content = content.replace(
  'SELECT ""Id"", ""TenantId"", ""Email"", ""Name"", ""Role"", ""IsActive""',
  'SELECT ""Id"", ""TenantId"", ""Email"", ""Name"", ""Role"", ""IsActive"", ""SessionVersion""'
);

content = content.replace(
  'Active: {reader[""IsActive""]}',
  'Active: {reader[""IsActive""]} | SV: {reader[""SessionVersion""]}'
);

fs.writeFileSync('tools/StarplusMigrationRunner/Program.cs', content, 'utf8');
console.log('Updated Program.cs');
