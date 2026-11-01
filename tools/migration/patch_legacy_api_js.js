const fs = require('fs');
const file = 'frontend/hexabill-ui/src/services/legacyApi.js';
let content = fs.readFileSync(file, 'utf8');

const addition = `  getPurchases: async (params = {}) => {
    const response = await api.get('/legacy/purchases', { params })
    return response.data
  },
  getPurchaseById: async (id) => {
    const response = await api.get(\`/legacy/purchases/\${id}\`)
    return response.data
  },
  getExpenses: async (params = {}) => {
    const response = await api.get('/legacy/expenses', { params })
    return response.data
  },
  getSuppliers: async (params = {}) => {
    const response = await api.get('/legacy/suppliers', { params })
    return response.data
  }
};`;

content = content.replace(/getReconciliation: async \(\) => {[\s\S]*?}\s*}/, (match) => {
  return match.slice(0, -1) + ',\n' + addition;
});

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated legacyApi.js');

