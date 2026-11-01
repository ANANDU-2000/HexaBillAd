const fs = require('fs');
const file = 'tools/StarplusMigrationRunner/Program.cs';
let content = fs.readFileSync(file, 'utf8');
const search = 'else if (mode == "verify")';
const idx = content.indexOf(search);
if (idx !== -1) {
  const insertPos = content.indexOf('else if (mode == "test-ef-queries")', idx);
  if (insertPos !== -1) {
    const code = `else if (mode == "comprehensive-audit")
                {
                    var outDir = Path.GetFullPath("artifacts/reconciliation");
                    return await ComprehensiveAuditor.RunFullAuditAsync(conn, archiveData, targetTenantId, outDir);
                }
                `;
    content = content.slice(0, insertPos) + code + content.slice(insertPos);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Successfully inserted comprehensive-audit mode into Program.cs');
  } else {
    console.log('test-ef-queries not found');
  }
} else {
  console.log('verify not found');
}

