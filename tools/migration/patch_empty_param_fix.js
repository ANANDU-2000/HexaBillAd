const fs = require('fs');
const path = require('path');

// 1. Update UtcDateTimeModelBinder.cs
const binderPath = path.resolve(__dirname, '../../backend/HexaBill.Api/ModelBinders/UtcDateTimeModelBinder.cs');
let binderContent = fs.readFileSync(binderPath, 'utf8');
const isCRLF1 = binderContent.includes('\r\n');
binderContent = binderContent.replace(/\r\n/g, '\n');

binderContent = binderContent.replace(
  `            if (string.IsNullOrEmpty(value))\n                return Task.CompletedTask;`,
  `            if (string.IsNullOrWhiteSpace(value))\n            {\n                if (bindingContext.ModelMetadata?.ModelType == typeof(DateTime?) || bindingContext.ModelType == typeof(DateTime?))\n                {\n                    bindingContext.Result = ModelBindingResult.Success(null);\n                }\n                return Task.CompletedTask;\n            }`
);

if (isCRLF1) binderContent = binderContent.replace(/\n/g, '\r\n');
fs.writeFileSync(binderPath, binderContent, 'utf8');
console.log('Updated UtcDateTimeModelBinder.cs successfully!');

// 2. Update frontend api.js to clean empty string params
const apiPath = path.resolve(__dirname, '../../frontend/hexabill-ui/src/services/api.js');
let apiContent = fs.readFileSync(apiPath, 'utf8');
const isCRLF2 = apiContent.includes('\r\n');
apiContent = apiContent.replace(/\r\n/g, '\n');

apiContent = apiContent.replace(
  `    plainConfig.method = String(plainConfig.method || 'GET').trim().toUpperCase() || 'GET'\n    config = plainConfig`,
  `    plainConfig.method = String(plainConfig.method || 'GET').trim().toUpperCase() || 'GET'
    if (plainConfig.params && typeof plainConfig.params === 'object' && !Array.isArray(plainConfig.params)) {
      const cleaned = {}
      for (const [k, v] of Object.entries(plainConfig.params)) {
        if (v !== '' && v !== null && v !== undefined) {
          cleaned[k] = v
        }
      }
      plainConfig.params = cleaned
    }
    config = plainConfig`
);

if (isCRLF2) apiContent = apiContent.replace(/\n/g, '\r\n');
fs.writeFileSync(apiPath, apiContent, 'utf8');
console.log('Updated frontend api.js successfully!');

