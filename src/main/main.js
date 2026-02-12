const { app, BrowserWindow, ipcMain, dialog, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { MetaConverter } = require('./converter');
const { Database } = require('./database');

let mainWindow;
let converter = null;
let db = null;

// Config file path
const configPath = path.join(app.getPath('userData'), 'config.json');
const dbPath = path.join(app.getPath('userData'), 'history.db');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0f',
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  // Initialize database
  db = new Database(dbPath);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (converter) {
    converter.stop();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============ IPC Handlers ============

// Load config
ipcMain.handle('load-config', async () => {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return {};
});

// Save config
ipcMain.handle('save-config', async (event, config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save config:', e);
    return false;
  }
});

// Select folder dialog
ipcMain.handle('select-folder', async (event, type) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: type === 'input' ? 'Select Input Folder (Images)' : 'Select Output Folder (Videos)'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Select files dialog
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
    ],
    title: 'Select Images'
  });

  if (!result.canceled) {
    return result.filePaths;
  }
  return [];
});

// Scan folder for images
ipcMain.handle('scan-folder', async (event, folderPath, includeSubfolders) => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const images = [];

  function scanDir(dir) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory() && includeSubfolders) {
          scanDir(filePath);
        } else if (stat.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if (imageExtensions.includes(ext)) {
            images.push({
              name: file,
              path: filePath,
              size: stat.size,
              modified: stat.mtime
            });
          }
        }
      }
    } catch (e) {
      console.error('Scan error:', e);
    }
  }

  scanDir(folderPath);
  return images.sort((a, b) => a.name.localeCompare(b.name));
});

// Get image thumbnail (base64)
ipcMain.handle('get-thumbnail', async (event, imagePath) => {
  try {
    const data = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase().replace('.', '');
    const mimeType = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mimeType};base64,${data.toString('base64')}`;
  } catch (e) {
    return null;
  }
});

// Validate cookies
ipcMain.handle('validate-cookies', async (event, cookies) => {
  try {
    const testConverter = new MetaConverter(cookies, { headless: true });
    const valid = await testConverter.validateSession();
    return { valid, error: valid ? null : 'Invalid or expired cookies' };
  } catch (e) {
    return { valid: false, error: e.message };
  }
});

// Start conversion
ipcMain.handle('start-conversion', async (event, options) => {
  const { cookies, files, outputFolder, prompt, namingPattern, delayBetween, retryAttempts, headless } = options;

  if (converter) {
    return { success: false, error: 'Conversion already in progress' };
  }

  converter = new MetaConverter(cookies, {
    headless,
    retryAttempts,
    delayBetween
  });

  // Set up progress callback
  converter.onProgress((data) => {
    mainWindow.webContents.send('conversion-progress', data);
  });

  // Start conversion in background
  (async () => {
    try {
      await converter.start();

      for (let i = 0; i < files.length; i++) {
        if (!converter.isRunning()) break;

        const file = files[i];
        const outputName = namingPattern
          .replace('{name}', path.basename(file.path, path.extname(file.path)))
          .replace('{index}', String(i + 1).padStart(3, '0'));
        const outputPath = path.join(outputFolder, outputName);

        // Check if already exists
        if (fs.existsSync(outputPath)) {
          mainWindow.webContents.send('conversion-progress', {
            type: 'file-skip',
            index: i,
            file: file.name,
            reason: 'Already exists'
          });

          // Save to history
          db.addEntry({
            inputPath: file.path,
            outputPath,
            status: 'skipped',
            prompt
          });
          continue;
        }

        mainWindow.webContents.send('conversion-progress', {
          type: 'file-start',
          index: i,
          file: file.name
        });

        const result = await converter.convert(file.path, outputPath, prompt, (stage, percent) => {
          mainWindow.webContents.send('conversion-progress', {
            type: 'file-progress',
            index: i,
            file: file.name,
            stage,
            percent
          });
        });

        // Save to history
        db.addEntry({
          inputPath: file.path,
          outputPath,
          status: result.success ? 'success' : (result.downloadFailed ? 'download_failed' : 'failed'),
          error: result.error,
          prompt,
          attempts: result.attempts,
          videoUrl: result.videoUrl
        });

        mainWindow.webContents.send('conversion-progress', {
          type: 'file-complete',
          index: i,
          file: file.name,
          success: result.success,
          error: result.error,
          outputPath,
          videoUrl: result.videoUrl,
          downloadFailed: result.downloadFailed
        });

        // Delay between files (rate limit protection)
        if (i < files.length - 1 && converter.isRunning()) {
          await new Promise(resolve => setTimeout(resolve, delayBetween * 1000));
        }
      }

    } catch (e) {
      console.error('Conversion error:', e);
      mainWindow.webContents.send('conversion-progress', {
        type: 'error',
        error: e.message
      });
    } finally {
      await converter.stop();
      converter = null;

      mainWindow.webContents.send('conversion-progress', {
        type: 'complete'
      });

      // Show notification
      if (Notification.isSupported()) {
        new Notification({
          title: 'Meta Video Converter',
          body: 'Batch conversion completed!'
        }).show();
      }
    }
  })();

  return { success: true };
});

// Stop conversion
ipcMain.handle('stop-conversion', async () => {
  if (converter) {
    converter.stop();
    return true;
  }
  return false;
});

// Get history
ipcMain.handle('get-history', async (event, options) => {
  return db.getEntries(options);
});

// Clear history
ipcMain.handle('clear-history', async () => {
  return db.clear();
});

// Resume conversion (get pending files from last session)
ipcMain.handle('get-resume-data', async () => {
  try {
    const resumePath = path.join(app.getPath('userData'), 'resume.json');
    if (fs.existsSync(resumePath)) {
      const data = JSON.parse(fs.readFileSync(resumePath, 'utf8'));
      fs.unlinkSync(resumePath); // Clear after reading
      return data;
    }
  } catch (e) {
    console.error('Failed to load resume data:', e);
  }
  return null;
});

// Save resume data
ipcMain.handle('save-resume-data', async (event, data) => {
  try {
    const resumePath = path.join(app.getPath('userData'), 'resume.json');
    fs.writeFileSync(resumePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    return false;
  }
});

// Open folder in explorer
ipcMain.handle('open-folder', async (event, folderPath) => {
  shell.openPath(folderPath);
});

// Open file
ipcMain.handle('open-file', async (event, filePath) => {
  shell.openPath(filePath);
});

// Check if file exists
ipcMain.handle('file-exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

// Get prompt presets
ipcMain.handle('get-presets', async () => {
  return [
    { id: 'cinematic', name: 'Cinematic', prompt: 'Animate with smooth cinematic motion, dramatic camera movement' },
    { id: 'zoom-in', name: 'Zoom In', prompt: 'Slowly zoom into the center with subtle motion' },
    { id: 'zoom-out', name: 'Zoom Out', prompt: 'Slowly zoom out revealing more of the scene' },
    { id: 'pan-left', name: 'Pan Left', prompt: 'Smooth horizontal pan from right to left' },
    { id: 'pan-right', name: 'Pan Right', prompt: 'Smooth horizontal pan from left to right' },
    { id: 'parallax', name: 'Parallax', prompt: 'Create depth with parallax effect, foreground and background moving at different speeds' },
    { id: 'float', name: 'Floating', prompt: 'Gentle floating motion, dreamlike and ethereal' },
    { id: 'dramatic', name: 'Dramatic', prompt: 'Dramatic slow motion with intense atmosphere' },
    { id: 'nature', name: 'Nature', prompt: 'Natural movement like wind, water, or wildlife' },
    { id: 'portrait', name: 'Portrait', prompt: 'Subtle life-like motion for portraits, breathing, blinking' },
    { id: 'custom', name: 'Custom', prompt: '' }
  ];
});

// Window controls
ipcMain.handle('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('close-window', () => {
  mainWindow?.close();
});

// ============ Text-to-Image IPC Handlers ============

let ttiConverter = null;

// Get TTI style presets
ipcMain.handle('get-tti-presets', async () => {
  return [
    { id: 'realistic', name: 'Realistic Photo', prefix: 'Photorealistic image of ' },
    { id: 'artistic', name: 'Artistic', prefix: 'Artistic illustration of ' },
    { id: 'anime', name: 'Anime Style', prefix: 'Anime style image of ' },
    { id: '3d', name: '3D Render', prefix: '3D rendered image of ' },
    { id: 'fantasy', name: 'Fantasy Art', prefix: 'Fantasy art of ' },
    { id: 'cinematic', name: 'Cinematic', prefix: 'Cinematic shot of ' },
    { id: 'minimalist', name: 'Minimalist', prefix: 'Minimalist design of ' },
    { id: 'custom', name: 'None (Use my exact prompt)', prefix: '' }
  ];
});

// Import prompts from .txt file
ipcMain.handle('import-prompts-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt'] }
    ],
    title: 'Import Prompts from Text File'
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  try {
    const content = fs.readFileSync(result.filePaths[0], 'utf8');
    // Split by newlines, filter empty lines, trim whitespace
    const prompts = content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#')); // Skip empty lines and comments

    return prompts;
  } catch (e) {
    console.error('Failed to read prompts file:', e);
    return [];
  }
});

// Start TTI generation
ipcMain.handle('start-tti-generation', async (event, options) => {
  const { cookies, prompts, aspectRatio, outputFolder, stylePrefix, convertToVideo, videoPrompt, delayBetween, retryAttempts, headless } = options;

  if (ttiConverter) {
    return { success: false, error: 'TTI generation already in progress' };
  }

  ttiConverter = new MetaConverter(cookies, {
    headless,
    retryAttempts,
    delayBetween
  });

  // Start generation in background
  (async () => {
    try {
      await ttiConverter.start();

      for (let i = 0; i < prompts.length; i++) {
        if (!ttiConverter.isRunning()) break;

        const promptData = prompts[i];
        const fullPrompt = stylePrefix ? `${stylePrefix}${promptData.text}` : promptData.text;

        // Generate output filename
        const sanitizedPrompt = promptData.text
          .substring(0, 50)
          .replace(/[^a-zA-Z0-9]/g, '_')
          .replace(/_+/g, '_');
        const timestamp = Date.now();
        const outputName = `${String(i + 1).padStart(3, '0')}_${sanitizedPrompt}_${timestamp}.png`;
        const outputPath = path.join(outputFolder, outputName);

        mainWindow.webContents.send('tti-progress', {
          type: 'prompt-start',
          index: i,
          promptId: promptData.id,
          prompt: promptData.text
        });

        const result = await ttiConverter.textToImage(fullPrompt, outputPath, {
          aspectRatio,
          progressCallback: (stage, percent) => {
            mainWindow.webContents.send('tti-progress', {
              type: 'prompt-progress',
              index: i,
              promptId: promptData.id,
              stage,
              percent
            });
          }
        });

        // Save to history
        db.addEntry({
          inputPath: `[TTI] ${promptData.text.substring(0, 100)}`,
          outputPath,
          status: result.success ? 'success' : (result.downloadFailed ? 'download_failed' : 'failed'),
          error: result.error,
          prompt: fullPrompt,
          attempts: result.attempts,
          type: 'tti',
          aspectRatio
        });

        mainWindow.webContents.send('tti-progress', {
          type: 'prompt-complete',
          index: i,
          promptId: promptData.id,
          success: result.success,
          error: result.error,
          outputPath: result.success ? outputPath : null,
          imageUrl: result.imageUrl
        });

        // If convertToVideo is enabled and image was generated successfully
        if (result.success && convertToVideo && converter === null) {
          mainWindow.webContents.send('tti-progress', {
            type: 'prompt-video-start',
            index: i,
            promptId: promptData.id
          });

          // Use the same converter to convert image to video
          const videoOutputPath = outputPath.replace(/\.png$/, '.mp4');
          const videoResult = await ttiConverter.convert(outputPath, videoOutputPath, videoPrompt || 'Animate with smooth cinematic motion', (stage, percent) => {
            mainWindow.webContents.send('tti-progress', {
              type: 'prompt-video-progress',
              index: i,
              promptId: promptData.id,
              stage,
              percent
            });
          });

          mainWindow.webContents.send('tti-progress', {
            type: 'prompt-video-complete',
            index: i,
            promptId: promptData.id,
            success: videoResult.success,
            videoPath: videoResult.success ? videoOutputPath : null
          });
        }

        // Delay between prompts
        if (i < prompts.length - 1 && ttiConverter.isRunning()) {
          await new Promise(resolve => setTimeout(resolve, delayBetween * 1000));
        }
      }

    } catch (e) {
      console.error('TTI generation error:', e);
      mainWindow.webContents.send('tti-progress', {
        type: 'error',
        error: e.message
      });
    } finally {
      await ttiConverter.stop();
      ttiConverter = null;

      mainWindow.webContents.send('tti-progress', {
        type: 'complete'
      });

      // Show notification
      if (Notification.isSupported()) {
        new Notification({
          title: 'Meta Video Converter',
          body: 'Text-to-Image generation completed!'
        }).show();
      }
    }
  })();

  return { success: true };
});

// Stop TTI generation
ipcMain.handle('stop-tti-generation', async () => {
  if (ttiConverter) {
    ttiConverter.stop();
    return true;
  }
  return false;
});

// Retry failed download - uses direct HTTPS download (no browser needed)
ipcMain.handle('retry-download', async (event, { videoUrl, outputPath }) => {
  console.log('[RETRY-DOWNLOAD] Starting...');
  console.log('[RETRY-DOWNLOAD] URL:', videoUrl);
  console.log('[RETRY-DOWNLOAD] Output:', outputPath);

  if (!videoUrl) {
    console.log('[RETRY-DOWNLOAD] No video URL provided');
    return { success: false, error: 'No video URL stored for this file' };
  }

  if (!outputPath) {
    console.log('[RETRY-DOWNLOAD] No output path provided');
    return { success: false, error: 'No output path specified' };
  }

  // Load cookies from config for authentication
  let cookies = '';
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const cookieParts = [];
    if (config.datr) cookieParts.push(`datr=${config.datr}`);
    if (config.abra_sess) cookieParts.push(`abra_sess=${config.abra_sess}`);
    cookies = cookieParts.join('; ');
    console.log('[RETRY-DOWNLOAD] Cookies loaded:', cookies ? 'Yes' : 'No');
  } catch (e) {
    console.log('[RETRY-DOWNLOAD] Could not load cookies:', e.message);
  }

  // Try direct download first (faster, no browser needed)
  try {
    const https = require('https');
    const http = require('http');

    const downloadWithRedirects = (url, maxRedirects = 5) => {
      return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Referer': 'https://www.meta.ai/',
          'Origin': 'https://www.meta.ai'
        };

        // Add cookies if available
        if (cookies) {
          headers['Cookie'] = cookies;
        }

        const req = protocol.get(url, { headers }, (res) => {
          console.log(`[RETRY-DOWNLOAD] HTTP ${res.statusCode}`);

          // Handle redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (maxRedirects <= 0) {
              reject(new Error('Too many redirects'));
              return;
            }
            console.log('[RETRY-DOWNLOAD] Redirect to:', res.headers.location);
            downloadWithRedirects(res.headers.location, maxRedirects - 1)
              .then(resolve)
              .catch(reject);
            return;
          }

          if (res.statusCode === 403) {
            reject(new Error('URL_EXPIRED'));
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            return;
          }

          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        });

        req.on('error', reject);
        req.setTimeout(60000, () => {
          req.destroy();
          reject(new Error('Download timeout'));
        });
      });
    };

    console.log('[RETRY-DOWNLOAD] Attempting direct download...');
    const data = await downloadWithRedirects(videoUrl);

    if (data.length < 10000) {
      // Too small, probably an error page
      console.log('[RETRY-DOWNLOAD] File too small, likely expired URL');
      return { success: false, error: 'URL expired - video needs to be regenerated' };
    }

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, data);
    const sizeMb = (data.length / (1024 * 1024)).toFixed(1);
    console.log(`[RETRY-DOWNLOAD] Success! (${sizeMb} MB)`);

    return { success: true };
  } catch (e) {
    console.log('[RETRY-DOWNLOAD] Direct download failed:', e.message);

    // Check if URL expired (403)
    if (e.message === 'URL_EXPIRED') {
      return { success: false, error: 'URL expired - needs regeneration', expired: true };
    }

    return { success: false, error: `Download failed: ${e.message}` };
  }
});
