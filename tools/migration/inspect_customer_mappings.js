const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '../../frozhen/Starplus_Migration/Starplus_Customer_Target_Mapping_REVIEW.csv');
const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
const headers = lines[0].split(',');
console.log('Headers:', headers);

const rows = lines.slice(1).map(l => {
  const parts = l.split(',');
  return {
    source_id: parts[0],
    source_name: parts[1],
    target_id: parts[7],
    match_type: parts[8],
    suggested_id: parts[9],
    suggested_name: parts[10]
  };
});

const matches = rows.filter(r => r.match_type !== 'NO_EXACT_MATCH' || r.suggested_id);
console.log(`Found ${matches.length} matches / suggestions:`);
matches.forEach(m => console.log(m));

