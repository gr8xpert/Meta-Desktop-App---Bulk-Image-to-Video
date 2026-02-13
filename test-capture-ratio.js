const { chromium } = require('playwright');
const fs = require('fs');

async function captureRatioRequest() {
  console.log('Starting browser to capture aspect ratio requests...');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  const logFile = 'network-requests.log';
  fs.writeFileSync(logFile, '=== Network Request Log ===\n\n');

  // Capture all network requests
  page.on('request', request => {
    const url = request.url();
    const postData = request.postData();

    // Log all graphql requests
    if (url.includes('graphql') || url.includes('imagine')) {
      const timestamp = new Date().toISOString();
      const entry = '\n=====================================\n' +
        'TIME: ' + timestamp + '\n' +
        'URL: ' + url + '\n' +
        'METHOD: ' + request.method() + '\n' +
        'POST DATA:\n' + (postData || 'none') + '\n' +
        '=====================================\n';

      fs.appendFileSync(logFile, entry);
      console.log('Captured request - saved to network-requests.log');

      // Also print if it contains ratio-related data
      if (postData && (postData.includes('aspect') || postData.includes('ratio') ||
          postData.includes('16') || postData.includes('dimension'))) {
        console.log('*** FOUND RATIO-RELATED DATA! ***');
        console.log(postData.substring(0, 1000));
      }
    }
  });

  console.log('\nNavigating to meta.ai/media...');
  console.log('\n*** INSTRUCTIONS ***');
  console.log('1. Log in to Meta AI if needed');
  console.log('2. Click on the aspect ratio selector (shows 9:16 by default)');
  console.log('3. Select 16:9');
  console.log('4. Type a simple prompt like "a red apple"');
  console.log('5. Click send/submit');
  console.log('6. Wait for image to generate');
  console.log('7. Close browser when done');
  console.log('\nAll requests saved to: network-requests.log\n');

  await page.goto('https://www.meta.ai/media', { waitUntil: 'domcontentloaded' });

  // Wait for browser to close
  await new Promise(resolve => {
    browser.on('disconnected', resolve);
  });

  console.log('\nBrowser closed. Check network-requests.log for captured data.');
}

captureRatioRequest().catch(console.error);
