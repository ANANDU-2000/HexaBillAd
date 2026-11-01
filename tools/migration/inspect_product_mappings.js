const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '../../frozhen/Starplus_Migration/Starplus_Product_Target_Mapping_REVIEW.csv');
const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
const headers = lines[0].split(',');
console.log('Headers:', headers);

const rows = lines.slice(1).map(l => {
  const parts = l.split(',');
  return {
    source_id: parts[0],
    source_sku: parts[1],
    source_name: parts[2],
    source_unit: parts[3],
    target_id: parts[5],
    mapping_type: parts[6]
  };
});

const matched = rows.filter(r => r.mapping_type !== 'NEW_OR_REVIEW' || r.target_id);
console.log(`Matched products: ${matched.length}`);
matched.forEach(m => console.log(m));

