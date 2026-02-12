const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

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

  // Map aspect ratio to Meta AI orientation value
  _getOrientationFromRatio(ratio) {
    const orientationMap = {
      '16:9': 'LANDSCAPE',
      '9:16': 'VERTICAL',
      '1:1': 'SQUARE'
    };
    return orientationMap[ratio] || 'VERTICAL';
  }

  // Set up request interception to inject orientation into GraphQL requests
  async _setupOrientationInterceptor(orientation) {
    console.log(`[INTERCEPT] Setting up orientation interceptor: ${orientation}`);

    // Remove any existing route handler first
    try {
      await this.page.unroute('**/api/graphql');
    } catch (e) {
      // No existing route, that's fine
    }

    // Intercept GraphQL requests and inject orientation
    await this.page.route('**/api/graphql', async (route, request) => {
      const postData = request.postData();

      // Check if this is a TEXT_TO_IMAGE request
      if (postData && postData.includes('TEXT_TO_IMAGE')) {
        console.log('[INTERCEPT] Found TEXT_TO_IMAGE request, injecting orientation...');
        console.log('[INTERCEPT] Original request (first 500 chars):', postData.substring(0, 500));

        try {
          // Parse the request body
          let body = JSON.parse(postData);
          let modified = false;

          // Helper function to recursively find and modify textToImageParams
          const injectOrientation = (obj) => {
            if (!obj || typeof obj !== 'object') return;

            // Check if this object has textToImageParams
            if (obj.textToImageParams) {
              obj.textToImageParams.orientation = orientation;
              console.log(`[INTERCEPT] Injected orientation at textToImageParams level: ${orientation}`);
              modified = true;
              return;
            }

            // Check if this object has imagineOperationRequest
            if (obj.imagineOperationRequest && obj.imagineOperationRequest.textToImageParams) {
              obj.imagineOperationRequest.textToImageParams.orientation = orientation;
              console.log(`[INTERCEPT] Injected orientation at imagineOperationRequest level: ${orientation}`);
              modified = true;
              return;
            }

            // Recurse into nested objects
            for (const key of Object.keys(obj)) {
              if (typeof obj[key] === 'object' && obj[key] !== null) {
                injectOrientation(obj[key]);
              }
            }
          };

          injectOrientation(body);

          if (modified) {
            console.log('[INTERCEPT] Modified request (first 500 chars):', JSON.stringify(body).substring(0, 500));
          } else {
            console.log('[INTERCEPT] WARNING: Could not find textToImageParams to inject orientation');
          }

          // Continue with modified request
          await route.continue({
            postData: JSON.stringify(body)
          });
          return;
        } catch (e) {
          console.log('[INTERCEPT] Failed to parse/modify request:', e.message);
        }
      }

      // For non-matching requests, continue normally
      await route.continue();
    });

    console.log('[INTERCEPT] Orientation interceptor active');
  }

  // Remove the interceptor
  async _removeOrientationInterceptor() {
    try {
      await this.page.unroute('**/api/graphql');
      console.log('[INTERCEPT] Removed orientation interceptor');
    } catch (e) {
      // Ignore errors
    }
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

  async _goToImageCreator() {
    console.log('[NAV] Going to image creator (meta.ai/media)...');

    await this.page.goto('https://www.meta.ai/media', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for page to fully render
    await this.page.waitForTimeout(3000);

    // Click on input area to activate the UI (lazy-loaded components)
    const inputSelectors = [
      'textarea[placeholder*="Describe"]',
      'textarea[placeholder*="describe"]',
      'div[contenteditable="true"]',
      '[data-placeholder*="Describe"]',
      'input[placeholder*="image"]',
      'textarea'
    ];

    for (const selector of inputSelectors) {
      try {
        const input = this.page.locator(selector).first();
        if (await input.count() > 0 && await input.isVisible()) {
          await input.click();
          await this.page.waitForTimeout(1000);
          console.log('[NAV] Clicked input to activate UI');
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Save debug screenshot to help diagnose issues
    try {
      const debugPath = path.join(process.cwd(), 'debug_media_page.png');
      await this.page.screenshot({ path: debugPath });
      console.log(`[NAV] Debug screenshot saved: ${debugPath}`);
    } catch (e) {
      console.log('[NAV] Could not save debug screenshot:', e.message);
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

  // ============================================
  // Text-to-Image Methods
  // ============================================

  async _selectImageMode() {
    console.log('[MODE] Switching to Image...');

    // Wait for page to be ready
    await this.page.waitForTimeout(1000);

    // Look for mode selector dropdown first (might show "Video" or "Image")
    const modeDropdownSelectors = [
      '[aria-haspopup="listbox"]',
      '[aria-haspopup="menu"]',
      'button:has-text("Video")',
      'button:has-text("Image")',
      'div[role="button"]:has-text("Video")',
      'div[role="button"]:has-text("Image")',
      '[data-testid*="mode"]',
      '[aria-label*="mode" i]'
    ];

    // Try to click dropdown to open options
    for (const selector of modeDropdownSelectors) {
      try {
        const dropdown = this.page.locator(selector).first();
        if (await dropdown.count() > 0 && await dropdown.isVisible()) {
          await dropdown.click();
          await this.page.waitForTimeout(600);
          console.log(`[MODE] Clicked dropdown: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Now select "Image" option
    const imageSelectors = [
      'div[role="option"]:has-text("Image")',
      'div[role="menuitem"]:has-text("Image")',
      'li:has-text("Image")',
      'span:text-is("Image")',
      'button:has-text("Image")',
      'div[role="button"]:has-text("Image")',
      'text=Image'
    ];

    for (const selector of imageSelectors) {
      try {
        const options = this.page.locator(selector);
        const count = await options.count();

        for (let i = 0; i < count; i++) {
          const option = options.nth(i);
          if (await option.isVisible()) {
            await option.click();
            await this.page.waitForTimeout(800);
            console.log(`[MODE] Image mode selected via: ${selector}`);
            return true;
          }
        }
      } catch (e) {
        continue;
      }
    }

    console.log('[MODE] Could not find Image button, may already be in image mode');
    return false;
  }

  async _selectAspectRatio(ratio) {
    console.log(`[RATIO] Attempting to select ${ratio}...`);

    // Wait for page to be ready after clicking input
    await this.page.waitForTimeout(1500);

    // First, let's log all visible buttons to help debug
    try {
      const allButtons = await this.page.locator('button').all();
      console.log(`[RATIO] Found ${allButtons.length} buttons on page`);
      for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
        try {
          const text = await allButtons[i].textContent();
          const visible = await allButtons[i].isVisible();
          if (visible && text.trim()) {
            console.log(`[RATIO]   Button ${i}: "${text.trim().substring(0, 30)}"`);
          }
        } catch (e) {}
      }
    } catch (e) {
      console.log('[RATIO] Could not enumerate buttons:', e.message);
    }

    // On meta.ai/media, there's a ratio button showing current ratio (e.g., "9:16")
    // We need to click it to open dropdown, then select our desired ratio

    // Step 1: Click on the current ratio button to open the dropdown
    const currentRatioSelectors = [
      // Exact text matches for ratio buttons
      'button:has-text("9:16")',
      'button:has-text("16:9")',
      'button:has-text("1:1")',
      // Role-based buttons
      'div[role="button"]:has-text("9:16")',
      'div[role="button"]:has-text("16:9")',
      'div[role="button"]:has-text("1:1")',
      // Span with ratio text inside button
      'button:has(span:has-text("9:16"))',
      'button:has(span:has-text("16:9"))',
      'button:has(span:has-text("1:1"))',
      // Aria labels
      '[aria-label*="aspect" i]',
      '[aria-label*="ratio" i]',
      '[aria-label*="9:16"]',
      '[aria-label*="16:9"]',
      '[aria-label*="1:1"]',
      // Data attributes
      '[data-testid*="ratio" i]',
      '[data-testid*="aspect" i]'
    ];

    let dropdownOpened = false;

    for (const selector of currentRatioSelectors) {
      try {
        const btn = this.page.locator(selector).first();
        if (await btn.count() > 0 && await btn.isVisible()) {
          console.log(`[RATIO] Found ratio button via: ${selector}`);
          await btn.click();
          await this.page.waitForTimeout(1000);
          dropdownOpened = true;
          console.log(`[RATIO] Clicked ratio dropdown`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!dropdownOpened) {
      console.log('[RATIO] Could not find ratio dropdown button - UI may not be loaded');
      console.log('[RATIO] Will rely on post-processing crop as fallback');
      return false;
    }

    // Step 2: Select the desired ratio from the dropdown
    await this.page.waitForTimeout(500);

    const ratioOptionSelectors = [
      `text="${ratio}"`,
      `button:has-text("${ratio}")`,
      `div[role="option"]:has-text("${ratio}")`,
      `div[role="menuitem"]:has-text("${ratio}")`,
      `li:has-text("${ratio}")`,
      `span:text-is("${ratio}")`,
      `div:has-text("${ratio}"):not(:has(*))`
    ];

    for (const selector of ratioOptionSelectors) {
      try {
        const options = this.page.locator(selector);
        const count = await options.count();

        for (let i = 0; i < count; i++) {
          const option = options.nth(i);
          if (await option.isVisible()) {
            await option.click();
            await this.page.waitForTimeout(500);
            console.log(`[RATIO] Selected ${ratio} via: ${selector}`);
            return true;
          }
        }
      } catch (e) {
        continue;
      }
    }

    console.log(`[RATIO] Could not select ${ratio} from dropdown - will use crop fallback`);
    return false;
  }

  async _typeImagePrompt(prompt) {
    console.log(`[PROMPT] Typing: ${prompt.substring(0, 50)}...`);

    const inputSelectors = [
      'textarea[placeholder*="Describe" i]',
      'textarea[placeholder*="image" i]',
      'div[contenteditable="true"]',
      'input[placeholder*="image" i]',
      'textarea'
    ];

    for (const selector of inputSelectors) {
      try {
        const elem = this.page.locator(selector).first();
        if (await elem.count() > 0 && await elem.isVisible()) {
          await elem.fill(prompt);
          await this.page.waitForTimeout(500);
          console.log('[PROMPT] Entered successfully');
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    console.log('[PROMPT] Could not find input field');
    return false;
  }

  async _submitImagePrompt() {
    console.log('[SUBMIT] Clicking send button...');

    const submitSelectors = [
      'button[aria-label="Send"]',
      'button[aria-label*="send" i]',
      'div[role="button"][aria-label*="send" i]',
      'button[type="submit"]',
      'button:has(svg)'  // Blue circular button with icon
    ];

    for (const selector of submitSelectors) {
      try {
        const btn = this.page.locator(selector).last(); // Get the last matching (usually the send button)
        if (await btn.count() > 0 && await btn.isVisible()) {
          await btn.click();
          console.log('[SUBMIT] Clicked send button');
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    // Try pressing Enter as fallback
    try {
      await this.page.keyboard.press('Enter');
      console.log('[SUBMIT] Pressed Enter');
      return true;
    } catch (e) {
      console.log('[SUBMIT] Could not submit');
      return false;
    }
  }

  // Capture all existing image URLs on the page (to exclude them later)
  async _captureExistingImageUrls() {
    const existingUrls = new Set();

    const imageSelectors = [
      'img[src*="scontent"]',
      'img[src*="fbcdn.net"]',
      'img[src*="lookaside"]'
    ];

    for (const selector of imageSelectors) {
      try {
        const images = this.page.locator(selector);
        const count = await images.count();

        for (let i = 0; i < count; i++) {
          const img = images.nth(i);
          const src = await img.getAttribute('src');
          if (src) {
            // Store a normalized version (without query params that might change)
            const baseUrl = src.split('?')[0];
            existingUrls.add(baseUrl);
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }

    console.log(`[IMAGE] Captured ${existingUrls.size} existing images on page`);
    return existingUrls;
  }

  async _waitForImage(timeout = 120, existingUrls = new Set()) {
    console.log(`[IMAGE] Waiting for NEW image (max ${timeout}s, excluding ${existingUrls.size} existing)...`);

    const startTime = Date.now();
    let lastLog = 0;

    while ((Date.now() - startTime) / 1000 < timeout) {
      if (!this._running) return null;

      const elapsed = Math.floor((Date.now() - startTime) / 1000);

      // Log every 15 seconds
      if (elapsed - lastLog >= 15) {
        console.log(`[IMAGE] ${elapsed}s elapsed...`);
        lastLog = elapsed;
      }

      // Minimum wait: 10 seconds for generation to start
      if (elapsed < 10) {
        await this.page.waitForTimeout(2000);
        continue;
      }

      // Look for generated images
      const imageSelectors = [
        'img[src*="scontent"]',
        'img[src*="fbcdn.net"]',
        'img[src*="lookaside"]'
      ];

      for (const selector of imageSelectors) {
        try {
          const images = this.page.locator(selector);
          const count = await images.count();

          for (let i = 0; i < count; i++) {
            const img = images.nth(i);
            const src = await img.getAttribute('src');

            if (!src || (!src.includes('scontent') && !src.includes('fbcdn') && !src.includes('lookaside'))) {
              continue;
            }

            // Check if this is a NEW image (not in existing set)
            const baseUrl = src.split('?')[0];
            if (existingUrls.has(baseUrl)) {
              continue; // Skip existing images
            }

            // Get dimensions to verify it's a generated image (not UI element)
            const dimensions = await img.evaluate(el => ({
              width: el.naturalWidth || el.width,
              height: el.naturalHeight || el.height
            }));

            // Must be at least 400px to be a generated image
            if (dimensions.width > 400 && dimensions.height > 400) {
              console.log(`[IMAGE] Found NEW generated image: ${dimensions.width}x${dimensions.height}`);
              console.log(`[IMAGE] URL: ${src.substring(0, 100)}...`);
              await this.page.waitForTimeout(1500);
              return src;
            }
          }
        } catch (e) {
          continue;
        }
      }

      await this.page.waitForTimeout(2000);
    }

    console.log('[IMAGE] Timeout!');
    return null;
  }

  async _downloadImage(imageUrl, outputPath) {
    console.log(`[DOWNLOAD] Saving image to ${path.basename(outputPath)}...`);

    try {
      const response = await this.page.request.get(imageUrl);
      console.log(`[DOWNLOAD] HTTP status: ${response.status()}`);

      if (response.ok()) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const body = await response.body();
        fs.writeFileSync(outputPath, body);
        const sizeKb = body.length / 1024;
        console.log(`[DOWNLOAD] Done (${sizeKb.toFixed(1)} KB)`);
        return true;
      } else {
        console.log(`[DOWNLOAD] Failed: HTTP ${response.status()}`);
      }
    } catch (e) {
      console.log('[DOWNLOAD] Error:', e.message);
    }

    return false;
  }

  async _cropToAspectRatio(inputPath, outputPath, targetRatio) {
    console.log(`[CROP] Cropping image to ${targetRatio}...`);

    try {
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      const { width, height } = metadata;

      console.log(`[CROP] Original dimensions: ${width}x${height}`);

      let newWidth, newHeight, left, top;

      if (targetRatio === '16:9') {
        // Crop to 16:9 landscape from portrait (9:16)
        // Calculate the height that would give us 16:9 with the current width
        newHeight = Math.floor(width * 9 / 16);
        newWidth = width;

        // If the calculated height is larger than actual height, adjust
        if (newHeight > height) {
          newHeight = height;
          newWidth = Math.floor(height * 16 / 9);
        }

        left = Math.floor((width - newWidth) / 2);
        top = Math.floor((height - newHeight) / 2);
      } else if (targetRatio === '1:1') {
        // Crop to square
        const size = Math.min(width, height);
        newWidth = size;
        newHeight = size;
        left = Math.floor((width - size) / 2);
        top = Math.floor((height - size) / 2);
      } else {
        // 9:16 - no crop needed (Meta AI default)
        console.log('[CROP] 9:16 is default, no cropping needed');
        return inputPath;
      }

      console.log(`[CROP] Cropping to: ${newWidth}x${newHeight} (offset: ${left}, ${top})`);

      await image
        .extract({ left, top, width: newWidth, height: newHeight })
        .toFile(outputPath);

      // Get final file size
      const stats = fs.statSync(outputPath);
      const sizeKb = stats.size / 1024;
      console.log(`[CROP] Done! Output: ${path.basename(outputPath)} (${sizeKb.toFixed(1)} KB)`);

      return outputPath;
    } catch (e) {
      console.error('[CROP] Error:', e.message);
      // Return original path if crop fails
      return inputPath;
    }
  }

  async textToImage(prompt, outputPath, options = {}) {
    const { aspectRatio = '16:9', progressCallback } = options;

    const result = {
      success: false,
      imageUrl: null,
      outputPath,
      error: null,
      attempts: 0,
      orientationSet: false
    };

    const update = (stage, percent) => {
      if (progressCallback) {
        progressCallback(stage, percent);
      }
    };

    // Get the orientation value for Meta AI API
    const orientation = this._getOrientationFromRatio(aspectRatio);
    console.log(`[TTI] Target aspect ratio: ${aspectRatio} -> orientation: ${orientation}`);

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
        }

        update('Opening image creator...', 10);
        await this._goToImageCreator();

        // Set up request interceptor to inject orientation
        update(`Setting orientation (${orientation})...`, 20);
        await this._setupOrientationInterceptor(orientation);
        result.orientationSet = true;

        update('Entering prompt...', 35);
        if (!await this._typeImagePrompt(prompt)) {
          throw new Error('Failed to enter prompt');
        }

        // Capture existing images BEFORE submitting (so we can find the NEW one)
        const existingImages = await this._captureExistingImageUrls();

        update('Generating image...', 45);
        await this._submitImagePrompt();

        // Wait for a NEW image (not in the existing set)
        const imageUrl = await this._waitForImage(120, existingImages);

        // Remove interceptor after request is made
        await this._removeOrientationInterceptor();

        if (!imageUrl) {
          // Save debug screenshot
          try {
            const debugPath = outputPath.replace(/\.[^.]+$/, '_debug.png');
            await this.page.screenshot({ path: debugPath });
            console.log(`[DEBUG] Screenshot saved: ${debugPath}`);
          } catch (e) {}

          throw new Error('Image generation timed out - could not detect image URL');
        }

        result.imageUrl = imageUrl;

        update('Downloading image...', 85);
        const downloadSuccess = await this._downloadImage(imageUrl, outputPath);

        if (downloadSuccess) {
          update('Complete!', 100);
          result.success = true;
          return result;
        } else {
          result.success = false;
          result.imageUrl = imageUrl;
          result.downloadFailed = true;
          result.error = 'Download failed after retries';
          return result;
        }

      } catch (e) {
        result.error = e.message;
        console.log(`[ERROR] ${e.message}`);

        // Clean up interceptor on error
        await this._removeOrientationInterceptor();

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
