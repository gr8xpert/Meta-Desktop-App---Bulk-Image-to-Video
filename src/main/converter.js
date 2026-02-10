const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class MetaConverter {
  constructor(cookies, options = {}) {
    this.cookies = cookies;
    this.headless = options.headless !== false;
    this.retryAttempts = options.retryAttempts || 3;
    this.delayBetween = options.delayBetween || 30;

    this.browser = null;
    this.context = null;
    this.page = null;
    this._running = false;
    this._progressCallback = null;
  }

  onProgress(callback) {
    this._progressCallback = callback;
  }

  isRunning() {
    return this._running;
  }

  async start() {
    if (this.browser) return;

    console.log('[BROWSER] Starting...');

    try {
      this.browser = await chromium.launch({
        headless: this.headless,
        channel: 'chrome',  // Use system Chrome instead of bundled Chromium
        args: ['--disable-blink-features=AutomationControlled']
      });
    } catch (e) {
      if (e.message.includes('Executable doesn\'t exist') || e.message.includes('executable')) {
        throw new Error('Google Chrome is not installed. Please install Chrome from https://google.com/chrome');
      }
      throw e;
    }

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Add cookies
    const cookieList = [];
    for (const [name, value] of Object.entries(this.cookies)) {
      if (value) {
        cookieList.push({
          name,
          value,
          domain: '.meta.ai',
          path: '/'
        });
      }
    }
    await this.context.addCookies(cookieList);

    this.page = await this.context.newPage();

    // Navigate to Meta AI
    console.log('[BROWSER] Navigating to Meta AI...');
    await this.page.goto('https://www.meta.ai', { waitUntil: 'networkidle', timeout: 60000 });
    await this.page.waitForTimeout(2000);

    const currentUrl = this.page.url();
    console.log('[BROWSER] Current URL:', currentUrl);

    // Check for various login/auth redirects
    if (currentUrl.toLowerCase().includes('login') ||
        currentUrl.toLowerCase().includes('auth') ||
        currentUrl.toLowerCase().includes('facebook.com') ||
        currentUrl.toLowerCase().includes('checkpoint')) {
      throw new Error(`Not logged in. Redirected to: ${currentUrl}`);
    }

    // Check for actual logged-in state (not just guest access)
    // Look for signs of being logged in vs guest mode
    try {
      // Wait a bit for page to fully load
      await this.page.waitForTimeout(2000);

      // Check for login/signup prompts that appear for guests
      const guestIndicators = [
        'text="Log in"',
        'text="Sign up"',
        'text="Continue with Facebook"',
        '[aria-label="Log in"]',
        '[aria-label="Sign up"]'
      ];

      for (const selector of guestIndicators) {
        const element = this.page.locator(selector).first();
        if (await element.count() > 0 && await element.isVisible()) {
          console.log('[BROWSER] Found guest indicator:', selector);
          throw new Error('Not logged in. Please provide valid cookies.');
        }
      }

      console.log('[BROWSER] Logged in state verified');
    } catch (e) {
      if (e.message.includes('Not logged in')) {
        throw e;
      }
      // Ignore other errors (element not found, etc.)
      console.log('[BROWSER] Login check warning:', e.message);
    }

    console.log('[BROWSER] Ready!');
    this._running = true;
  }

  async stop() {
    this._running = false;
    try {
      if (this.page) await this.page.close().catch(() => {});
      if (this.context) await this.context.close().catch(() => {});
      if (this.browser) await this.browser.close().catch(() => {});
    } catch (e) {
      console.error('[BROWSER] Error closing:', e);
    }
    this.page = null;
    this.context = null;
    this.browser = null;
    console.log('[BROWSER] Closed.');
  }

  async validateSession() {
    try {
      await this.start();
      console.log('[VALIDATE] Current URL:', this.page.url());
      return true;
    } catch (e) {
      console.log('[VALIDATE] Failed:', e.message);
      return false;
    } finally {
      await this.stop();
    }
  }

  async _goToHome() {
    console.log('[NAV] Returning to home...');
    try {
      await this.page.goto('https://www.meta.ai', { waitUntil: 'networkidle', timeout: 30000 });
      await this.page.waitForTimeout(1500);
    } catch (e) {
      await this.page.goto('https://www.meta.ai', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(2000);
    }
  }

  async _uploadImage(imagePath) {
    console.log(`[UPLOAD] ${path.basename(imagePath)}...`);

    // Try direct file input
    try {
      const fileInput = this.page.locator('input[type="file"]').first();
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(imagePath);
        await this.page.waitForTimeout(1500);
        console.log('[UPLOAD] Done via file input');
        return true;
      }
    } catch (e) {
      console.log('[UPLOAD] File input failed:', e.message);
    }

    // Try clicking + button
    const plusSelectors = [
      'div[aria-label="Add"]',
      'button:has-text("+")',
      '[data-testid="add-button"]',
      'div[role="button"]:has-text("+")'
    ];

    for (const selector of plusSelectors) {
      try {
        const btn = this.page.locator(selector).first();
        if (await btn.count() > 0 && await btn.isVisible()) {
          await btn.click();
          await this.page.waitForTimeout(500);

          const fileInput = this.page.locator('input[type="file"]').first();
          await fileInput.setInputFiles(imagePath);
          await this.page.waitForTimeout(1500);
          console.log(`[UPLOAD] Done via ${selector}`);
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    return false;
  }

  async _clickVideoMode() {
    console.log('[MODE] Switching to Video...');

    const videoSelectors = [
      'text=Video',
      'button:has-text("Video")',
      'div:has-text("Video"):not(:has(*))',
      '[aria-label*="Video"]'
    ];

    for (const selector of videoSelectors) {
      try {
        const btn = this.page.locator(selector).first();
        if (await btn.count() > 0 && await btn.isVisible()) {
          await btn.click();
          await this.page.waitForTimeout(800);
          console.log('[MODE] Video mode selected');
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    console.log('[MODE] Could not find Video button');
    return false;
  }

  async _typePromptAndAnimate(prompt) {
    console.log(`[ANIMATE] Prompt: ${prompt.substring(0, 40)}...`);

    // Input selectors
    const inputSelectors = [
      'textarea[placeholder*="animation" i]',
      'textarea[placeholder*="Describe" i]',
      'input[placeholder*="animation" i]',
      'div[contenteditable="true"]',
      'textarea'
    ];

    for (const selector of inputSelectors) {
      try {
        const elem = this.page.locator(selector).first();
        if (await elem.count() > 0 && await elem.isVisible()) {
          await elem.fill(prompt);
          await this.page.waitForTimeout(500);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Click Animate
    const animateSelectors = [
      'button:has-text("Animate")',
      'div[role="button"]:has-text("Animate")',
      '[aria-label*="Animate"]'
    ];

    for (const selector of animateSelectors) {
      try {
        const btn = this.page.locator(selector).first();
        if (await btn.count() > 0 && await btn.isVisible()) {
          await btn.click();
          console.log('[ANIMATE] Started');
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    console.log('[ANIMATE] Could not click Animate button');
    return false;
  }

  async _waitForVideo(timeout = 180) {
    console.log(`[VIDEO] Waiting (max ${timeout}s)...`);

    const startTime = Date.now();
    let lastLog = 0;

    // Step 1: Capture message container ID for scoped search
    let messageContainerId = null;
    try {
      await this.page.waitForSelector('[data-message-id$="_assistant"]', { timeout: 10000 });
      await this.page.waitForTimeout(500);

      const lastAssistantMsg = this.page.locator('[data-message-id$="_assistant"]').last();
      if (await lastAssistantMsg.count() > 0) {
        messageContainerId = await lastAssistantMsg.getAttribute('data-message-id');
        console.log(`[VIDEO] Tracking message: ${messageContainerId}`);
      }
    } catch (e) {
      console.log('[VIDEO] Could not capture message ID, using global search');
    }

    while ((Date.now() - startTime) / 1000 < timeout) {
      if (!this._running) return null;

      const elapsed = Math.floor((Date.now() - startTime) / 1000);

      // Log every 15 seconds
      if (elapsed - lastLog >= 15) {
        console.log(`[VIDEO] ${elapsed}s elapsed...`);
        lastLog = elapsed;
      }

      // Minimum wait: 20 seconds for generation to complete
      if (elapsed < 20) {
        await this.page.waitForTimeout(2000);
        continue;
      }

      // PRIORITY 1: Check data-video-url attribute (scoped)
      try {
        let videoUrlAttr = null;

        if (messageContainerId) {
          const container = this.page.locator(`[data-message-id="${messageContainerId}"]`);
          const videoElem = container.locator('[data-testid="generated-video"]');
          if (await videoElem.count() > 0) {
            videoUrlAttr = await videoElem.getAttribute('data-video-url');
          }
        } else {
          // Fallback: global search only if no container
          videoUrlAttr = await this.page.getAttribute(
            '[data-testid="generated-video"]',
            'data-video-url'
          );
        }

        if (videoUrlAttr && videoUrlAttr.includes('.mp4')) {
          const decodedUrl = videoUrlAttr.replace(/&amp;/g, '&');
          console.log(`[VIDEO] Found via data-video-url! (${elapsed}s)`);
          console.log('[VIDEO] Waiting 2s for CDN stabilization...');
          await this.page.waitForTimeout(2000);
          return decodedUrl;
        }
      } catch (e) {
        // Element not found yet
      }

      // PRIORITY 2: Search for video URL pattern within scoped container
      try {
        if (messageContainerId) {
          const container = this.page.locator(`[data-message-id="${messageContainerId}"]`);
          const containerHtml = await container.innerHTML();

          // Match URLs like: https://video-arn2-1.xx.fbcdn.net/...mp4...
          const videoUrlPattern = /https:\/\/video-[^.]+\.xx\.fbcdn\.net\/[^\s"'<>]+\.mp4[^\s"'<>]*/g;
          const matches = containerHtml.match(videoUrlPattern);

          if (matches && matches.length > 0) {
            // Decode HTML entities
            const decodedUrl = matches[0].replace(/&amp;/g, '&');
            console.log(`[VIDEO] Found via container URL pattern! (${elapsed}s)`);
            await this.page.waitForTimeout(2000);
            return decodedUrl;
          }
        }
      } catch (e) {
        // Pattern not found yet
      }

      // PRIORITY 3: Click download button and capture download URL (last resort)
      try {
        if (messageContainerId && elapsed > 45) {  // Only try after 45s if other methods failed
          const container = this.page.locator(`[data-message-id="${messageContainerId}"]`);

          // Hover over container to trigger lazy-load of download button
          await container.hover();
          await this.page.waitForTimeout(500);

          // Look for download button within the container
          const downloadBtn = container.locator('[aria-label="Download"]').first();
          if (await downloadBtn.count() > 0) {
            console.log(`[VIDEO] Found download button, clicking... (${elapsed}s)`);

            // Set up download listener BEFORE clicking
            const [download] = await Promise.all([
              this.page.waitForEvent('download', { timeout: 10000 }),
              downloadBtn.click()
            ]);

            // Get URL from the download object
            const url = download.url();
            if (url && url.includes('.mp4')) {
              console.log(`[VIDEO] Captured download URL! (${elapsed}s)`);
              // Cancel the browser's download since we'll download ourselves
              await download.cancel();
              await this.page.waitForTimeout(2000);
              return url;
            }
          }
        }
      } catch (e) {
        // Download button not found or click failed
        if (elapsed > 50) {
          console.log('[VIDEO] Download button attempt failed:', e.message);
        }
      }

      await this.page.waitForTimeout(1500);
    }

    console.log('[VIDEO] Timeout!');
    return null;
  }

  async _downloadVideo(videoUrl, outputPath) {
    console.log(`[DOWNLOAD] Saving to ${path.basename(outputPath)}...`);

    try {
      const response = await this.page.request.get(videoUrl);
      console.log(`[DOWNLOAD] HTTP status: ${response.status()}`);

      if (response.ok()) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const body = await response.body();
        fs.writeFileSync(outputPath, body);
        const sizeMb = body.length / (1024 * 1024);
        console.log(`[DOWNLOAD] Done (${sizeMb.toFixed(1)} MB)`);
        return true;
      } else {
        console.log(`[DOWNLOAD] Failed: HTTP ${response.status()}`);
      }
    } catch (e) {
      console.log('[DOWNLOAD] Error:', e.message);
    }

    return false;
  }

  async _downloadWithRetry(videoUrl, outputPath, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[DOWNLOAD] Attempt ${attempt}/${maxRetries}...`);
      if (await this._downloadVideo(videoUrl, outputPath)) {
        return true;
      }
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s between retries
      }
    }
    return false;
  }

  async retryDownload(videoUrl, outputPath) {
    console.log(`[RETRY] Downloading ${path.basename(outputPath)}...`);
    return await this._downloadWithRetry(videoUrl, outputPath, 3);
  }

  async convert(imagePath, outputPath, prompt, progressCallback) {
    const result = {
      success: false,
      videoUrl: null,
      outputPath,
      error: null,
      attempts: 0
    };

    const update = (stage, percent) => {
      if (progressCallback) {
        progressCallback(stage, percent);
      }
    };

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      if (!this._running) break;

      result.attempts = attempt;

      try {
        if (attempt > 1) {
          console.log(`[RETRY] Attempt ${attempt}/${this.retryAttempts}`);
          update(`Retry ${attempt}/${this.retryAttempts}...`, 5);
        }

        if (!this.browser) {
          update('Starting browser...', 5);
          await this.start();
        } else {
          update('Preparing...', 5);
          await this._goToHome();
        }

        update('Uploading image...', 15);
        if (!await this._uploadImage(imagePath)) {
          throw new Error('Failed to upload image');
        }

        update('Selecting video mode...', 25);
        await this._clickVideoMode();

        update('Starting animation...', 35);
        if (!await this._typePromptAndAnimate(prompt)) {
          // Try just clicking Animate
          const btn = this.page.locator('button:has-text("Animate")').first();
          if (await btn.count() > 0) {
            await btn.click();
          }
        }

        update('Generating video...', 45);
        const videoUrl = await this._waitForVideo(180);

        if (!videoUrl) {
          // Save debug screenshot
          try {
            const debugPath = path.join(path.dirname(outputPath), `debug_${path.basename(imagePath, path.extname(imagePath))}.png`);
            await this.page.screenshot({ path: debugPath });
            console.log(`[DEBUG] Screenshot saved: ${debugPath}`);
          } catch (e) {}

          throw new Error('Video generation timed out - could not detect video URL');
        }

        result.videoUrl = videoUrl;

        update('Downloading...', 85);
        const downloadSuccess = await this._downloadWithRetry(videoUrl, outputPath);

        if (downloadSuccess) {
          update('Complete!', 100);
          result.success = true;
          result.downloadMethod = 'immediate';
          return result;
        } else {
          // Download failed but video was generated
          result.success = false;
          result.videoUrl = videoUrl;  // Store URL for retry
          result.downloadFailed = true; // Flag to distinguish from generation failure
          result.error = 'Download failed after retries';
          return result;
        }

      } catch (e) {
        result.error = e.message;
        console.log(`[ERROR] ${e.message}`);

        if (attempt < this.retryAttempts) {
          await this.page.waitForTimeout(2000);
          try {
            await this._goToHome();
          } catch (e) {}
        }
      }
    }

    update(`Failed after ${this.retryAttempts} attempts`, -1);
    return result;
  }
}

module.exports = { MetaConverter };
