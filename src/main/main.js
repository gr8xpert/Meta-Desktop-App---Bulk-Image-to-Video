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
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0f',
      symbolColor: '#ffffff',
      height: 40
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
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
    await testConverter.stop();
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
          status: result.success ? 'success' : 'failed',
          error: result.error,
          prompt,
          attempts: result.attempts
        });

        mainWindow.webContents.send('conversion-progress', {
          type: 'file-complete',
          index: i,
          file: file.name,
          success: result.success,
          error: result.error
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
