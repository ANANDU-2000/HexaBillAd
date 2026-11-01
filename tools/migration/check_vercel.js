const https = require('https');

https.get('https://frozenhub.hexabill.company', (res) => {
  console.log('Status:', res.statusCode);
  console.log('x-vercel-id:', res.headers['x-vercel-id']);
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const matches = body.match(/src="([^"]+\.js)"/g);
    console.log('Scripts:', matches);
  });
}).on('error', err => console.error(err));

