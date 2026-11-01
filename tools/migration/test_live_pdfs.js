const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

const SECRET = 'z4qGVNFXkPS9mxTVuLVpT3iVp3TV5+rau2mY1hSmaT7vJ4ZXV9yegsvREiIXBqzqm0YPJ9o6I3cfYTJ4ZrVqKw==';
const EDGE_SECRET = 'spNjekAfZtuAtxhEzfshUKNnIGkhS+Rym2W50jK8oQiMx6ILaDmJ0+sSV0DXAi9Y';

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createToken(userId, email, name, tenantId, slug, role = 'Owner', sv = '0') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': userId.toString(),
    'UserId': userId.toString(),
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': email,
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': role,
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': name,
    'sv': sv, 'plat': 'false', 'tid': tenantId.toString(), 'tenant_id': tenantId.toString(),
    'tslug': slug, 'nbf': now, 'exp': now + (8 * 3600), 'iat': now, 'iss': 'HexaBill.Api', 'aud': 'HexaBill.Api'
  };
  const unsigned = base64UrlEncode(JSON.stringify(header)) + '.' + base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(unsigned).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return unsigned + '.' + sig;
}

const tokenFh1 = createToken(34, 'frozenhubfoods@gmail.com', 'Vahid Shamsudheen', 20, 'frozenhub', 'Owner', '0');

function downloadPdf(endpoint, outPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'hexabill.onrender.com',
      port: 443,
      path: endpoint,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenFh1}`,
        'Accept': 'application/pdf',
        'X-HexaBill-Original-Host': 'frozenhub.hexabill.company',
        'X-HexaBill-Edge-Secret': EDGE_SECRET
      }
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        fs.writeFileSync(outPath, buffer);
        resolve({ status: res.statusCode, length: buffer.length, buffer });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function inspectPdf(buffer) {
  const str = buffer.toString('latin1');
  const isPdf = str.startsWith('%PDF-');
  const pageMatches = str.match(/\/Type\s*\/Page[^s]/g) || [];
  return {
    isPdf,
    version: isPdf ? str.slice(0, 8) : 'invalid',
    pageCount: pageMatches.length,
    containsStarplus: str.includes('Starplus') || str.includes('STARPLUS'),
    contains4403: str.includes('4403'),
    contains8954: str.includes('8,954') || str.includes('8954')
  };
}

async function testPdfs() {
  const outDir = path.resolve('artifacts/reconciliation');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('Testing Statement PDF for Customer 136...');
  const stmtPath = path.join(outDir, 'customer_136_statement.pdf');
  const stmtRes = await downloadPdf('/api/customers/136/statement?fromDate=2025-01-01&toDate=2026-11-01', stmtPath);
  console.log(`Statement PDF HTTP status: ${stmtRes.status}, File size: ${stmtRes.length} bytes`);
  const stmtAnalysis = inspectPdf(stmtRes.buffer);
  console.log('Statement PDF Analysis:', stmtAnalysis);

  console.log('\nTesting Pending Bills PDF for Customer 136...');
  const pendingPath = path.join(outDir, 'customer_136_pending_bills.pdf');
  const pendingRes = await downloadPdf('/api/customers/136/pending-bills-pdf', pendingPath);
  console.log(`Pending Bills PDF HTTP status: ${pendingRes.status}, File size: ${pendingRes.length} bytes`);
  const pendingAnalysis = inspectPdf(pendingRes.buffer);
  console.log('Pending Bills PDF Analysis:', pendingAnalysis);
}

testPdfs().catch(console.error);
