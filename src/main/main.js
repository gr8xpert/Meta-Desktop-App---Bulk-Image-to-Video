const { app, BrowserWindow, ipcMain, dialog, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { execFile } = require('child_process');
const sharp = require('sharp');
const { MetaConverter } = require('./converter');
const { Database } = require('./database');

// Real-ESRGAN paths (bundled with app)
// In packaged app, assets are in extraResources at resources/realesrgan/
// In development, they're at ../../assets/realesrgan relative to main.js
function getRealesrganPath() {
  const possiblePaths = [
    // Production path (extraResources - most reliable for portable)
    path.join(process.resourcesPath || '', 'realesrgan'),
    // Development path
    path.join(__dirname, '../../assets/realesrgan'),
    // Alternative: unpacked from asar
    path.join(process.resourcesPath || '', 'app.asar.unpacked/assets/realesrgan'),
    path.join(app.getAppPath().replace('app.asar', 'app.asar.unpacked'), 'assets/realesrgan'),
  ];

  console.log('[REALESRGAN] Checking paths:');
  console.log('[REALESRGAN] resourcesPath:', process.resourcesPath);
  console.log('[REALESRGAN] appPath:', app.getAppPath());

  for (const p of possiblePaths) {
    const exePath = path.join(p, 'realesrgan-ncnn-vulkan.exe');
    console.log('[REALESRGAN]   -', p, '-> exists:', fs.existsSync(exePath));
    if (fs.existsSync(exePath)) {
      console.log('[REALESRGAN] Found at:', p);
      return p;
    }
  }
  console.log('[REALESRGAN] Not found in any path, using first path');
  return possiblePaths[0]; // Fallback
}

let realesrganDir = null;
let realesrganExe = null;

// Editing presets path
const presetsPath = path.join(app.getPath('userData'), 'editing-presets.json');

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

  // Open DevTools in development for debugging
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  // Initialize Real-ESRGAN paths
  realesrganDir = getRealesrganPath();
  realesrganExe = path.join(realesrganDir, 'realesrgan-ncnn-vulkan.exe');
  console.log('[REALESRGAN] Dir:', realesrganDir);
  console.log('[REALESRGAN] Exe:', realesrganExe);
  console.log('[REALESRGAN] Exists:', fs.existsSync(realesrganExe));

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
  try {
    // Normalize path for Windows - fix double backslashes and forward slashes
    let normalizedPath = folderPath
      .replace(/\\\\/g, '\\')  // Replace double backslashes with single
      .replace(/\//g, '\\');    // Replace forward slashes with backslashes

    console.log('[OPEN-FOLDER] Original:', folderPath);
    console.log('[OPEN-FOLDER] Normalized:', normalizedPath);

    if (fs.existsSync(normalizedPath)) {
      shell.openPath(normalizedPath);
    } else {
      console.error('Folder not found:', normalizedPath);
    }
  } catch (err) {
    console.error('Error opening folder:', err);
  }
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

// ============ Gallery IPC Handlers ============

// Scan gallery folder for images and videos
ipcMain.handle('scan-gallery', async (event, folderPath) => {
  const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov'];
  const items = [];

  if (!folderPath || !fs.existsSync(folderPath)) {
    return [];
  }

  try {
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (mediaExtensions.includes(ext)) {
          const isVideo = ['.mp4', '.webm', '.mov'].includes(ext);
          items.push({
            name: file,
            path: filePath,
            type: isVideo ? 'video' : 'image',
            size: stat.size,
            modified: stat.mtime.getTime(),
            created: stat.birthtime.getTime()
          });
        }
      }
    }

    // Sort by creation date (newest first)
    items.sort((a, b) => b.created - a.created);

  } catch (e) {
    console.error('Gallery scan error:', e);
  }

  return items;
});

// Delete gallery item
ipcMain.handle('delete-gallery-item', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  } catch (e) {
    console.error('Delete error:', e);
    return { success: false, error: e.message };
  }
});

// ============ Image Editing IPC Handlers ============

// Get image metadata and base64 for editing
ipcMain.handle('load-image-for-edit', async (event, imagePath) => {
  try {
    // Read file into buffer to avoid file locking
    const inputBuffer = fs.readFileSync(imagePath);
    const metadata = await sharp(inputBuffer).metadata();
    const base64 = `data:image/${metadata.format};base64,${inputBuffer.toString('base64')}`;

    return {
      success: true,
      path: imagePath,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      base64
    };
  } catch (e) {
    console.error('Load image error:', e);
    return { success: false, error: e.message };
  }
});

// Preview edited image (returns base64 without saving)
ipcMain.handle('preview-image-edit', async (event, { imagePath, edits }) => {
  try {
    // Read file into buffer to avoid file locking
    const inputBuffer = fs.readFileSync(imagePath);
    let image = sharp(inputBuffer);

    // Get metadata from buffer
    const metadata = await sharp(inputBuffer).metadata();

    // Apply edits
    const { brightness, contrast, saturation, sharpness, blur, grayscale, sepia, negative } = edits;

    // Modulate: brightness, saturation
    const modulate = {};
    if (brightness !== undefined && brightness !== 1) {
      modulate.brightness = brightness;
    }
    if (saturation !== undefined && saturation !== 1) {
      modulate.saturation = saturation;
    }
    if (Object.keys(modulate).length > 0) {
      image = image.modulate(modulate);
    }

    // Linear for contrast (contrast is applied as a multiplier)
    if (contrast !== undefined && contrast !== 1) {
      // Contrast: multiply and offset to keep midtones stable
      const a = contrast;
      const b = 128 * (1 - contrast);
      image = image.linear(a, b);
    }

    // Sharpen
    if (sharpness !== undefined && sharpness > 0) {
      image = image.sharpen({ sigma: sharpness });
    }

    // Blur
    if (blur !== undefined && blur > 0.3) {
      image = image.blur(blur);
    }

    // Grayscale
    if (grayscale) {
      image = image.grayscale();
    }

    // Sepia (tint with sepia color)
    if (sepia) {
      image = image.tint({ r: 112, g: 66, b: 20 });
    }

    // Negative/Invert
    if (negative) {
      image = image.negate();
    }

    const buffer = await image.toBuffer();
    const base64 = `data:image/${metadata.format};base64,${buffer.toString('base64')}`;

    return { success: true, base64 };
  } catch (e) {
    console.error('Preview edit error:', e);
    return { success: false, error: e.message };
  }
});

// Save edited image
ipcMain.handle('save-edited-image', async (event, { imagePath, edits, outputPath }) => {
  try {
    // Read the file into a buffer first to avoid file locking issues
    const inputBuffer = fs.readFileSync(imagePath);
    let image = sharp(inputBuffer);

    // Apply edits (same as preview)
    const { brightness, contrast, saturation, sharpness, blur, grayscale, sepia, negative } = edits;

    const modulate = {};
    if (brightness !== undefined && brightness !== 1) {
      modulate.brightness = brightness;
    }
    if (saturation !== undefined && saturation !== 1) {
      modulate.saturation = saturation;
    }
    if (Object.keys(modulate).length > 0) {
      image = image.modulate(modulate);
    }

    if (contrast !== undefined && contrast !== 1) {
      const a = contrast;
      const b = 128 * (1 - contrast);
      image = image.linear(a, b);
    }

    if (sharpness !== undefined && sharpness > 0) {
      image = image.sharpen({ sigma: sharpness });
    }

    if (blur !== undefined && blur > 0.3) {
      // Sharp requires blur > 0.3
      image = image.blur(blur);
    }

    if (grayscale) {
      image = image.grayscale();
    }

    if (sepia) {
      image = image.tint({ r: 112, g: 66, b: 20 });
    }

    if (negative) {
      image = image.negate();
    }

    // Determine output path
    let savePath = outputPath;
    if (!savePath) {
      // Save as new file with _edited suffix
      const ext = path.extname(imagePath);
      const base = path.basename(imagePath, ext);
      const dir = path.dirname(imagePath);
      savePath = path.join(dir, `${base}_edited${ext}`);
    }

    // Since we loaded from buffer, we can now safely write to the same path
    await image.toFile(savePath);

    return { success: true, outputPath: savePath };
  } catch (e) {
    console.error('Save edited image error:', e);
    return { success: false, error: e.message };
  }
});

// Rotate image
ipcMain.handle('rotate-image', async (event, { imagePath, angle }) => {
  try {
    const inputBuffer = fs.readFileSync(imagePath);
    const metadata = await sharp(inputBuffer).metadata();
    const buffer = await sharp(inputBuffer).rotate(angle).toBuffer();
    const base64 = `data:image/${metadata.format};base64,${buffer.toString('base64')}`;
    return { success: true, base64 };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Flip image
ipcMain.handle('flip-image', async (event, { imagePath, direction }) => {
  try {
    const inputBuffer = fs.readFileSync(imagePath);
    const metadata = await sharp(inputBuffer).metadata();
    let image = sharp(inputBuffer);
    if (direction === 'horizontal') {
      image = image.flop();
    } else {
      image = image.flip();
    }
    const buffer = await image.toBuffer();
    const base64 = `data:image/${metadata.format};base64,${buffer.toString('base64')}`;
    return { success: true, base64 };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Crop image
ipcMain.handle('crop-image', async (event, { imagePath, crop }) => {
  try {
    const inputBuffer = fs.readFileSync(imagePath);
    const metadata = await sharp(inputBuffer).metadata();
    const { left, top, width, height } = crop;
    const buffer = await sharp(inputBuffer)
      .extract({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) })
      .toBuffer();
    const base64 = `data:image/${metadata.format};base64,${buffer.toString('base64')}`;
    return { success: true, base64 };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Resize image
ipcMain.handle('resize-image', async (event, { imagePath, width, height, fit }) => {
  try {
    const inputBuffer = fs.readFileSync(imagePath);
    const metadata = await sharp(inputBuffer).metadata();
    const buffer = await sharp(inputBuffer)
      .resize(width, height, { fit: fit || 'cover' })
      .toBuffer();
    const base64 = `data:image/${metadata.format};base64,${buffer.toString('base64')}`;
    return { success: true, base64 };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Basic upscale using sharp (lanczos) - preview only, doesn't save
ipcMain.handle('upscale-basic', async (event, { imagePath, scale }) => {
  try {
    const inputBuffer = fs.readFileSync(imagePath);
    const metadata = await sharp(inputBuffer).metadata();
    const newWidth = Math.round(metadata.width * scale);
    const newHeight = Math.round(metadata.height * scale);

    const buffer = await sharp(inputBuffer)
      .resize(newWidth, newHeight, { kernel: 'lanczos3' })
      .toBuffer();

    const base64 = `data:image/${metadata.format};base64,${buffer.toString('base64')}`;
    return { success: true, base64, width: newWidth, height: newHeight };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Check if Real-ESRGAN is installed
ipcMain.handle('check-realesrgan', async () => {
  return { installed: fs.existsSync(realesrganExe) };
});

// Download and install Real-ESRGAN
ipcMain.handle('install-realesrgan', async (event) => {
  const downloadUrl = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip';
  const zipPath = path.join(app.getPath('temp'), 'realesrgan.zip');

  try {
    // Create directory
    if (!fs.existsSync(realesrganDir)) {
      fs.mkdirSync(realesrganDir, { recursive: true });
    }

    // Download zip file
    mainWindow.webContents.send('realesrgan-progress', { stage: 'Downloading Real-ESRGAN...', percent: 10 });

    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(zipPath);
      https.get(downloadUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          https.get(response.headers.location, (res) => {
            res.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          }).on('error', reject);
        } else {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }
      }).on('error', reject);
    });

    mainWindow.webContents.send('realesrgan-progress', { stage: 'Extracting...', percent: 60 });

    // Extract zip using PowerShell (Windows)
    await new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      exec(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${realesrganDir}' -Force"`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Clean up zip
    fs.unlinkSync(zipPath);

    mainWindow.webContents.send('realesrgan-progress', { stage: 'Complete!', percent: 100 });

    return { success: true };
  } catch (e) {
    console.error('Real-ESRGAN install error:', e);
    return { success: false, error: e.message };
  }
});

// AI Upscale using Real-ESRGAN - saves to temp for preview, finalized on Save
ipcMain.handle('upscale-ai', async (event, { imagePath, scale }) => {
  console.log('[UPSCALE-AI] Starting...');
  console.log('[UPSCALE-AI] Image:', imagePath);
  console.log('[UPSCALE-AI] Scale:', scale);
  console.log('[UPSCALE-AI] Exe path:', realesrganExe);
  console.log('[UPSCALE-AI] Dir:', realesrganDir);

  if (!realesrganExe || !fs.existsSync(realesrganExe)) {
    console.log('[UPSCALE-AI] Exe not found');
    return { success: false, error: 'Real-ESRGAN executable not found at: ' + realesrganExe };
  }

  try {
    // Save to temp file for preview (will be used as source when saving)
    const ext = path.extname(imagePath);
    const tempDir = app.getPath('temp');
    const tempPath = path.join(tempDir, `ai_upscale_preview_${Date.now()}${ext}`);
    console.log('[UPSCALE-AI] Temp output:', tempPath);

    // Select model based on scale
    let model;
    if (scale === 4) {
      model = 'realesrgan-x4plus'; // Best quality for 4x
    } else {
      model = 'realesr-animevideov3'; // Supports 2x, 3x, 4x
    }

    const modelPath = path.join(realesrganDir, 'models');

    console.log('[UPSCALE-AI] Model:', model);
    console.log('[UPSCALE-AI] Scale:', scale);
    console.log('[UPSCALE-AI] Model path:', modelPath);

    const args = [
      '-i', imagePath,
      '-o', tempPath,
      '-n', model,
      '-s', scale.toString(),
      '-m', modelPath
    ];

    console.log('[UPSCALE-AI] Args:', args.join(' '));

    return new Promise((resolve) => {
      execFile(realesrganExe, args, { cwd: realesrganDir }, (error, stdout, stderr) => {
        console.log('[UPSCALE-AI] stdout:', stdout);
        console.log('[UPSCALE-AI] stderr:', stderr);

        if (error) {
          console.error('[UPSCALE-AI] Error:', error.message);
          resolve({ success: false, error: stderr || error.message });
        } else if (!fs.existsSync(tempPath)) {
          console.error('[UPSCALE-AI] Output file not created');
          resolve({ success: false, error: 'Output file was not created' });
        } else {
          // Read the upscaled image for preview
          const buffer = fs.readFileSync(tempPath);
          const extName = path.extname(tempPath).toLowerCase().replace('.', '');
          const mimeType = extName === 'jpg' ? 'jpeg' : extName;
          const base64 = `data:image/${mimeType};base64,${buffer.toString('base64')}`;
          console.log('[UPSCALE-AI] Success! Size:', buffer.length);
          // Return tempPath so frontend can track it for saving
          resolve({ success: true, base64, tempPath });
        }
      });
    });
  } catch (e) {
    console.error('[UPSCALE-AI] Exception:', e);
    return { success: false, error: e.message };
  }
});

// Add watermark to image
ipcMain.handle('add-watermark', async (event, { imagePath, watermark }) => {
  try {
    const { text, position, opacity, fontSize, color } = watermark;
    const inputBuffer = fs.readFileSync(imagePath);
    const metadata = await sharp(inputBuffer).metadata();

    // Create SVG watermark
    const svgText = `
      <svg width="${metadata.width}" height="${metadata.height}">
        <style>
          .watermark {
            fill: ${color || 'white'};
            font-size: ${fontSize || 24}px;
            font-family: Arial, sans-serif;
            opacity: ${opacity || 0.5};
          }
        </style>
        <text x="${metadata.width - 20}" y="${metadata.height - 20}" text-anchor="end" class="watermark">${text}</text>
      </svg>
    `;

    const buffer = await sharp(inputBuffer)
      .composite([{ input: Buffer.from(svgText), gravity: 'southeast' }])
      .toBuffer();

    const base64 = `data:image/${metadata.format};base64,${buffer.toString('base64')}`;
    return { success: true, base64 };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Export image with specific format and quality
ipcMain.handle('export-image', async (event, { imagePath, edits, format, quality, outputPath }) => {
  console.log('[EXPORT] Starting...');
  console.log('[EXPORT] Image:', imagePath);
  console.log('[EXPORT] Format:', format);
  console.log('[EXPORT] Quality:', quality);
  console.log('[EXPORT] Output:', outputPath);

  try {
    if (!imagePath || !fs.existsSync(imagePath)) {
      return { success: false, error: 'Image file not found: ' + imagePath };
    }

    // Check if there's an AI upscale temp file to use instead
    let sourceFile = imagePath;
    if (edits && edits.aiUpscaleTempPath && fs.existsSync(edits.aiUpscaleTempPath)) {
      console.log('[EXPORT] Using AI upscale temp file:', edits.aiUpscaleTempPath);
      sourceFile = edits.aiUpscaleTempPath;
    }

    // Read the file into a buffer first to avoid file locking issues
    const inputBuffer = fs.readFileSync(sourceFile);
    let image = sharp(inputBuffer);

    // Get image metadata for watermark
    const metadata = await sharp(inputBuffer).metadata();

    // Apply all edits if provided
    if (edits) {
      console.log('[EXPORT] Applying edits:', edits);
      const { brightness, contrast, saturation, sharpness, blur, grayscale, sepia, negative, rotation, flipH, flipV, crop, watermark, upscaleScale, aiUpscaleTempPath } = edits;

      // Apply basic upscale if set (skip if AI upscale was used)
      if (upscaleScale && upscaleScale > 1 && !aiUpscaleTempPath) {
        console.log('[EXPORT] Applying basic upscale:', upscaleScale + 'x');
        const newWidth = Math.round(metadata.width * upscaleScale);
        const newHeight = Math.round(metadata.height * upscaleScale);
        image = image.resize(newWidth, newHeight, { kernel: 'lanczos3' });
      }

      if (crop && crop.width && crop.height) {
        image = image.extract({
          left: Math.round(crop.left || 0),
          top: Math.round(crop.top || 0),
          width: Math.round(crop.width),
          height: Math.round(crop.height)
        });
      }

      if (rotation && rotation !== 0) {
        image = image.rotate(rotation);
      }

      if (flipH) {
        image = image.flop();
      }

      if (flipV) {
        image = image.flip();
      }

      const modulate = {};
      if (brightness !== undefined && brightness !== null && brightness !== 1) {
        modulate.brightness = brightness;
      }
      if (saturation !== undefined && saturation !== null && saturation !== 1) {
        modulate.saturation = saturation;
      }
      if (Object.keys(modulate).length > 0) {
        image = image.modulate(modulate);
      }

      if (contrast !== undefined && contrast !== null && contrast !== 1) {
        image = image.linear(contrast, 128 * (1 - contrast));
      }

      if (sharpness && sharpness > 0) {
        image = image.sharpen({ sigma: sharpness });
      }
      if (blur && blur > 0.3) {
        // Sharp requires blur sigma > 0.3
        image = image.blur(blur);
      }
      if (grayscale) {
        image = image.grayscale();
      }
      if (sepia) {
        image = image.tint({ r: 112, g: 66, b: 20 });
      }
      if (negative) {
        image = image.negate();
      }

      // Apply watermark if present
      if (watermark && watermark.text) {
        console.log('[EXPORT] Applying watermark:', watermark);
        const svgText = `
          <svg width="${metadata.width}" height="${metadata.height}">
            <style>
              .watermark {
                fill: ${watermark.color || 'white'};
                font-size: ${watermark.fontSize || 24}px;
                font-family: Arial, sans-serif;
                opacity: ${watermark.opacity || 0.5};
              }
            </style>
            <text x="${metadata.width - 20}" y="${metadata.height - 20}" text-anchor="end" class="watermark">${watermark.text}</text>
          </svg>
        `;
        image = image.composite([{ input: Buffer.from(svgText), gravity: 'southeast' }]);
      }
    }

    // Determine output path and format
    let savePath = outputPath;
    let outputFormat = format || 'jpg';

    // Generate filename
    if (!savePath) {
      // "Save as New" - use selected format
      const ext = outputFormat;
      const base = path.basename(imagePath, path.extname(imagePath));
      const dir = path.dirname(imagePath);
      const timestamp = Date.now();
      savePath = path.join(dir, `${base}_edited_${timestamp}.${ext}`);
    } else {
      // "Save" (overwrite) - if format is different, change the extension
      const originalExt = path.extname(savePath).toLowerCase().slice(1);
      const normalizedOriginal = originalExt === 'jpeg' ? 'jpg' : originalExt;

      if (outputFormat !== normalizedOriginal) {
        // User wants different format - change the filename extension
        const base = path.basename(savePath, path.extname(savePath));
        const dir = path.dirname(savePath);
        savePath = path.join(dir, `${base}.${outputFormat}`);
        console.log('[EXPORT] Format changed, new path:', savePath);
      }
    }

    // Set format and quality
    const q = quality || 90;
    switch (outputFormat) {
      case 'jpg':
      case 'jpeg':
        image = image.jpeg({ quality: q });
        break;
      case 'png':
        image = image.png({ compressionLevel: Math.round((100 - q) / 10) });
        break;
      case 'webp':
        image = image.webp({ quality: q });
        break;
      default:
        image = image.jpeg({ quality: q });
    }

    console.log('[EXPORT] Saving to:', savePath);
    console.log('[EXPORT] Output format:', outputFormat);

    // Ensure directory exists
    const saveDir = path.dirname(savePath);
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    // Get the output buffer
    const outputBuffer = await image.toBuffer();
    console.log('[EXPORT] Buffer ready, size:', outputBuffer.length);

    // Check if we're overwriting the original file
    const isOverwrite = savePath === imagePath || (outputPath && outputPath === imagePath);

    if (isOverwrite) {
      // For overwrite: save to temp file first, then replace original
      // This avoids file locking issues on Windows
      const tempPath = path.join(saveDir, `_temp_save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${path.extname(savePath)}`);

      console.log('[EXPORT] Overwrite mode - using temp file:', tempPath);

      // Write to temp file
      fs.writeFileSync(tempPath, outputBuffer);

      // Try to replace original with retry logic
      let replaced = false;
      let lastError = null;

      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          // Small delay to let Windows release file handles
          if (attempt > 1) {
            await new Promise(resolve => setTimeout(resolve, 200 * attempt));
          }

          // Try to delete original and rename temp
          if (fs.existsSync(savePath)) {
            fs.unlinkSync(savePath);
          }
          fs.renameSync(tempPath, savePath);
          replaced = true;
          console.log('[EXPORT] Replaced original on attempt', attempt);
          break;
        } catch (e) {
          lastError = e;
          console.log(`[EXPORT] Replace attempt ${attempt} failed:`, e.message);
        }
      }

      if (!replaced) {
        // Clean up temp file if it still exists
        try { fs.unlinkSync(tempPath); } catch (e) {}

        // Fall back: save as new file with timestamp
        const fallbackPath = path.join(saveDir, `${path.basename(savePath, path.extname(savePath))}_saved_${Date.now()}${path.extname(savePath)}`);
        fs.writeFileSync(fallbackPath, outputBuffer);
        console.log('[EXPORT] Fallback - saved as new file:', fallbackPath);
        return { success: true, outputPath: fallbackPath, fallback: true };
      }
    } else {
      // New file - just write directly
      fs.writeFileSync(savePath, outputBuffer);
    }

    console.log('[EXPORT] Saved successfully');

    return { success: true, outputPath: savePath };
  } catch (e) {
    console.error('[EXPORT] Error:', e);
    return { success: false, error: e.message };
  }
});

// Save editing preset
ipcMain.handle('save-preset', async (event, { name, edits }) => {
  try {
    let presets = {};
    if (fs.existsSync(presetsPath)) {
      presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
    }
    presets[name] = edits;
    fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Load editing presets
ipcMain.handle('load-presets', async () => {
  try {
    if (fs.existsSync(presetsPath)) {
      const presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
      return { success: true, presets };
    }
    return { success: true, presets: {} };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Delete editing preset
ipcMain.handle('delete-preset', async (event, { name }) => {
  try {
    if (fs.existsSync(presetsPath)) {
      const presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
      delete presets[name];
      fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2));
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Generate thumbnails for social media
ipcMain.handle('generate-thumbnails', async (event, { imagePath, outputFolder, sizes }) => {
  try {
    const inputBuffer = fs.readFileSync(imagePath);
    const results = [];
    const baseName = path.basename(imagePath, path.extname(imagePath));

    for (const size of sizes) {
      const outputPath = path.join(outputFolder, `${baseName}_${size.name}.jpg`);
      const outputBuffer = await sharp(inputBuffer)
        .resize(size.width, size.height, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toBuffer();
      fs.writeFileSync(outputPath, outputBuffer);
      results.push({ name: size.name, path: outputPath, width: size.width, height: size.height });
    }

    return { success: true, results };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Batch edit multiple images
ipcMain.handle('batch-edit-images', async (event, { imagePaths, edits, outputFolder, format, quality }) => {
  const results = [];

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    const baseName = path.basename(imagePath, path.extname(imagePath));
    const outputPath = path.join(outputFolder, `${baseName}_edited.${format || 'jpg'}`);

    try {
      const inputBuffer = fs.readFileSync(imagePath);
      let image = sharp(inputBuffer);

      // Apply edits
      const { brightness, contrast, saturation, sharpness, blur, grayscale, sepia, negative } = edits;

      const modulate = {};
      if (brightness !== undefined && brightness !== 1) modulate.brightness = brightness;
      if (saturation !== undefined && saturation !== 1) modulate.saturation = saturation;
      if (Object.keys(modulate).length > 0) image = image.modulate(modulate);

      if (contrast !== undefined && contrast !== 1) {
        image = image.linear(contrast, 128 * (1 - contrast));
      }

      if (sharpness > 0) image = image.sharpen({ sigma: sharpness });
      if (blur > 0) image = image.blur(blur);
      if (grayscale) image = image.grayscale();
      if (sepia) image = image.tint({ r: 112, g: 66, b: 20 });
      if (negative) image = image.negate();

      // Set format
      const q = quality || 90;
      switch (format) {
        case 'png':
          image = image.png();
          break;
        case 'webp':
          image = image.webp({ quality: q });
          break;
        default:
          image = image.jpeg({ quality: q });
      }

      await image.toFile(outputPath);
      results.push({ success: true, inputPath: imagePath, outputPath });

      // Send progress
      mainWindow.webContents.send('batch-edit-progress', {
        current: i + 1,
        total: imagePaths.length,
        file: path.basename(imagePath)
      });
    } catch (e) {
      results.push({ success: false, inputPath: imagePath, error: e.message });
    }
  }

  return { success: true, results };
});

// ============ Bulk Upscale IPC Handlers ============

let bulkUpscaleRunning = false;
let bulkUpscaleAbort = false;

// Start bulk upscale
ipcMain.handle('start-bulk-upscale', async (event, options) => {
  const { files, method, scale, outputFolder, outputFormat } = options;

  if (bulkUpscaleRunning) {
    return { success: false, error: 'Bulk upscale already in progress' };
  }

  bulkUpscaleRunning = true;
  bulkUpscaleAbort = false;

  // Process files in background
  (async () => {
    try {
      for (let i = 0; i < files.length; i++) {
        if (bulkUpscaleAbort) break;

        const file = files[i];
        const baseName = path.basename(file.path, path.extname(file.path));

        // Determine output format
        let ext = outputFormat;
        if (outputFormat === 'same') {
          ext = path.extname(file.path).toLowerCase().slice(1);
          if (ext === 'jpeg') ext = 'jpg';
        }

        const outputName = `${baseName}_${scale}x.${ext}`;
        const outputPath = path.join(outputFolder, outputName);

        mainWindow.webContents.send('bulk-upscale-progress', {
          type: 'file-start',
          fileId: file.id,
          index: i
        });

        try {
          let result;

          if (method === 'ai') {
            // AI Upscale using Real-ESRGAN
            mainWindow.webContents.send('bulk-upscale-progress', {
              type: 'file-progress',
              fileId: file.id,
              stage: 'AI Processing',
              percent: 30
            });

            // Select model based on scale
            let model;
            if (scale === 4) {
              model = 'realesrgan-x4plus';
            } else {
              model = 'realesr-animevideov3';
            }

            const modelPath = path.join(realesrganDir, 'models');
            const args = [
              '-i', file.path,
              '-o', outputPath,
              '-n', model,
              '-s', scale.toString(),
              '-m', modelPath
            ];

            result = await new Promise((resolve) => {
              execFile(realesrganExe, args, { cwd: realesrganDir }, (error, stdout, stderr) => {
                if (error) {
                  console.error('[BULK-UPSCALE] AI Error:', error.message);
                  resolve({ success: false, error: stderr || error.message });
                } else if (!fs.existsSync(outputPath)) {
                  resolve({ success: false, error: 'Output file not created' });
                } else {
                  resolve({ success: true });
                }
              });
            });

          } else {
            // Basic upscale using Sharp
            mainWindow.webContents.send('bulk-upscale-progress', {
              type: 'file-progress',
              fileId: file.id,
              stage: 'Upscaling',
              percent: 30
            });

            const inputBuffer = fs.readFileSync(file.path);
            const metadata = await sharp(inputBuffer).metadata();
            const newWidth = Math.round(metadata.width * scale);
            const newHeight = Math.round(metadata.height * scale);

            let image = sharp(inputBuffer).resize(newWidth, newHeight, { kernel: 'lanczos3' });

            // Set output format
            const q = 90;
            switch (ext) {
              case 'jpg':
              case 'jpeg':
                image = image.jpeg({ quality: q });
                break;
              case 'png':
                image = image.png({ compressionLevel: 6 });
                break;
              case 'webp':
                image = image.webp({ quality: q });
                break;
              default:
                image = image.jpeg({ quality: q });
            }

            // Ensure output directory exists
            if (!fs.existsSync(outputFolder)) {
              fs.mkdirSync(outputFolder, { recursive: true });
            }

            await image.toFile(outputPath);
            result = { success: true };
          }

          mainWindow.webContents.send('bulk-upscale-progress', {
            type: 'file-progress',
            fileId: file.id,
            stage: 'Finalizing',
            percent: 90
          });

          mainWindow.webContents.send('bulk-upscale-progress', {
            type: 'file-complete',
            fileId: file.id,
            success: result.success,
            error: result.error,
            outputPath: result.success ? outputPath : null
          });

        } catch (e) {
          console.error('[BULK-UPSCALE] File error:', e);
          mainWindow.webContents.send('bulk-upscale-progress', {
            type: 'file-complete',
            fileId: file.id,
            success: false,
            error: e.message
          });
        }
      }

    } catch (e) {
      console.error('[BULK-UPSCALE] Error:', e);
      mainWindow.webContents.send('bulk-upscale-progress', {
        type: 'error',
        error: e.message
      });
    } finally {
      bulkUpscaleRunning = false;
      mainWindow.webContents.send('bulk-upscale-progress', {
        type: 'complete'
      });

      // Show notification
      if (Notification.isSupported()) {
        new Notification({
          title: 'Meta Video Converter',
          body: 'Bulk upscale completed!'
        }).show();
      }
    }
  })();

  return { success: true };
});

// Stop bulk upscale
ipcMain.handle('stop-bulk-upscale', async () => {
  bulkUpscaleAbort = true;
  return { success: true };
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
