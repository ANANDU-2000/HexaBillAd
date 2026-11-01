const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../../frozhen/Starplus_Migration/Starplus_Archive_Clean_Staging_READ_ONLY.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

['dilkush', 'golden', 'plate'].forEach(word => {
  console.log(`\nSearch for '${word}':`);
  data.customers.filter(c => c.name.toLowerCase().includes(word)).forEach(c => {
    console.log(`  Starplus ID: ${c.source_customer_id} | Name: "${c.name}" | TRN: ${c.trn} | Phone: ${c.phone}`);
  });
});

