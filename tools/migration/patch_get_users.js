const fs = require('fs');
let content = fs.readFileSync('tools/StarplusMigrationRunner/Program.cs', 'utf8');

content = content.replace(
  'SELECT ""Id"", ""TenantId"", ""Email"", ""Username"", ""Role"", ""IsActive""',
  'SELECT ""Id"", ""TenantId"", ""Email"", ""Name"", ""Role"", ""IsActive""'
);

content = content.replace(
  'Console.WriteLine($"  Tenant {reader[""TenantId""]} | User {reader[""Id""]}: {reader[""Username""]} ({reader[""Email""]}) | Role: {reader[""Role""]} | Active: {reader[""IsActive""]}");',
  'Console.WriteLine($"  Tenant {reader[""TenantId""]} | User {reader[""Id""]}: {reader[""Name""]} ({reader[""Email""]}) | Role: {reader[""Role""]} | Active: {reader[""IsActive""]}");'
);

fs.writeFileSync('tools/StarplusMigrationRunner/Program.cs', content, 'utf8');
console.log('Fixed Program.cs column name');
