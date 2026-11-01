const fs = require('fs');
const file = 'frontend/hexabill-ui/src/tenant/TenantBrandingContext.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = 'const updateFavicon = useCallback((logoUrl) => {';
const replacement = `const updateFavicon = useCallback((logoUrl) => {
    if (!logoUrl) return
    try {
      if (typeof logoUrl === 'string' && logoUrl.startsWith('data:')) {
        const link = document.querySelector("link[rel*='icon']") || document.createElement('link')
        link.rel = 'shortcut icon'
        link.href = logoUrl
        document.getElementsByTagName('head')[0].appendChild(link)
        return
      }
      const base = getApiBaseUrlNoSuffix()`;

if (content.includes("const base = getApiBaseUrlNoSuffix()")) {
  content = content.replace(
    /const updateFavicon = useCallback\(\(logoUrl\) => \{\s*if \(!logoUrl\) return\s*try \{\s*const base = getApiBaseUrlNoSuffix\(\)/,
    replacement
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully patched updateFavicon in TenantBrandingContext.jsx');
} else {
  console.error('Target not found');
}

