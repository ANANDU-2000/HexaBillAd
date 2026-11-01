const fs = require('fs');
const file = 'frontend/hexabill-ui/src/features/purchases/SuppliersPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update import
content = content.replace(
  "import { suppliersAPI } from '../../services/index'",
  "import { suppliersAPI, legacyAPI } from '../../services/index'"
);

// 2. Replace loadSuppliers
const oldLoadSuppliersRegex = /const loadSuppliers = async \(\) => {[\s\S]*?finally {\s*setLoading\(false\)\s*}\s*}/;

const newLoadSuppliers = `const loadSuppliers = async () => {
    try {
      setLoading(true)
      setLoadError('')
      const isFrozenHub1 = user?.tenantId === 20 || (typeof window !== 'undefined' && window.location.hostname.includes('frozenhub'))
      const [response, legacyRes] = await Promise.all([
        suppliersAPI.getAllSuppliersSummary({ includeInactive: showDeactivated }),
        isFrozenHub1 ? legacyAPI.getSuppliers().catch(() => null) : Promise.resolve(null)
      ])
      let list = (response?.success && Array.isArray(response?.data)) ? [...response.data] : []
      if (legacyRes?.success && Array.isArray(legacyRes?.data)) {
        const existingNames = new Set(list.map(s => (s.supplierName || '').toLowerCase().trim()))
        for (const leg of legacyRes.data) {
          const norm = (leg.supplierName || '').toLowerCase().trim()
          if (!norm) continue
          if (existingNames.has(norm)) {
            const matched = list.find(s => (s.supplierName || '').toLowerCase().trim() === norm)
            if (matched) {
              matched.totalPurchases = (matched.totalPurchases || 0) + (leg.totalPurchases || 0)
              matched.purchaseCount = (matched.purchaseCount || 0) + (leg.purchaseCount || 0)
              matched.hasHistoricalData = true
            }
          } else {
            list.push({
              id: \`leg_\${leg.supplierName}\`,
              supplierName: leg.supplierName,
              phone: '—',
              email: '—',
              purchaseCount: leg.purchaseCount,
              totalPurchases: leg.totalPurchases,
              netPayable: 0,
              isActive: true,
              isHistorical: true
            })
          }
        }
      }
      setSuppliers(list)
    } catch (error) {
      console.error('Failed to load suppliers:', error)
      setSuppliers([])
      setLoadError('Could not load suppliers.')
    } finally {
      setLoading(false)
    }
  }`;

if (oldLoadSuppliersRegex.test(content)) {
  content = content.replace(oldLoadSuppliersRegex, newLoadSuppliers);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully updated SuppliersPage.jsx');
} else {
  console.error('Could not find loadSuppliers regex match');
}

