const path = require('path');
const { chromium } = require(path.resolve('frontend/hexabill-ui/node_modules/playwright'));

async function renderPdfScreenshot() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 1600 } });
  const page = await context.newPage();

  const pendingPdfPath = 'file:///' + path.resolve('artifacts/reconciliation/customer_136_pending_bills.pdf').replace(/\\/g, '/');
  console.log('Loading PDF URL:', pendingPdfPath);
  await page.goto(pendingPdfPath, { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const pendingPng = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/rendered_pending_bills_pdf.png';
  await page.screenshot({ path: pendingPng });
  console.log('Saved rendered Pending Bills PDF screenshot to:', pendingPng);

  const stmtPdfPath = 'file:///' + path.resolve('artifacts/reconciliation/customer_136_statement.pdf').replace(/\\/g, '/');
  console.log('Loading PDF URL:', stmtPdfPath);
  await page.goto(stmtPdfPath, { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const stmtPng = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/rendered_customer_statement_pdf.png';
  await page.screenshot({ path: stmtPng });
  console.log('Saved rendered Customer Statement PDF screenshot to:', stmtPng);

  await browser.close();
}

renderPdfScreenshot().catch(console.error);

