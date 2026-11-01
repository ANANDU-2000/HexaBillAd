const https = require('https');

const targetCommit = '6171d688';
console.log(`[POLL] Waiting for Render deployment of commit ${targetCommit}...`);

function checkHealth() {
  return new Promise((resolve) => {
    https.get('https://hexabill.onrender.com/health', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

(async () => {
  const start = Date.now();
  while (Date.now() - start < 300000) { // 5 minutes max
    const health = await checkHealth();
    if (health) {
      console.log(`[${new Date().toLocaleTimeString()}] Live version: ${health.deployVersion?.substring(0, 8)} | Status: ${health.status}`);
      if (health.deployVersion && health.deployVersion.startsWith(targetCommit)) {
        console.log(`\n[SUCCESS] Render successfully deployed commit ${targetCommit}!`);
        process.exit(0);
      }
    } else {
      console.log(`[${new Date().toLocaleTimeString()}] Render service building / restarting...`);
    }
    await new Promise(r => setTimeout(r, 10000));
  }
  console.error('[TIMEOUT] Deployment polling timed out.');
  process.exit(1);
})();
