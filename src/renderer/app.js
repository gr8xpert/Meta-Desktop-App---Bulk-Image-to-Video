// ============================================
// Meta Video Converter - Renderer Process
// ============================================

// State
let files = [];
let presets = [];
let isConverting = false;
let config = {};

// TTI State
let ttiPrompts = [];           // Array of { id, text, status, progress }
let ttiPresets = [];           // Style presets from main process
let selectedRatio = '16:9';    // Current aspect ratio
let isTTIGenerating = false;
let ttiPromptIdCounter = 0;

// DOM Elements
const elements = {
  // Tabs
  navTabs: document.querySelectorAll('.nav-tab'),
  tabContents: document.querySelectorAll('.tab-content'),

  // Drop zone
  dropZone: document.getElementById('dropZone'),
  btnSelectFiles: document.getElementById('btnSelectFiles'),
  btnSelectFolder: document.getElementById('btnSelectFolder'),
  includeSubfolders: document.getElementById('includeSubfolders'),

  // File grid
  fileGrid: document.getElementById('fileGrid'),
  fileActions: document.getElementById('fileActions'),
  selectedCount: document.getElementById('selectedCount'),
  btnRetryDownload: document.getElementById('btnRetryDownload'),
  btnRetryGeneration: document.getElementById('btnRetryGeneration'),
  btnClearFiles: document.getElementById('btnClearFiles'),

  // Window controls
  btnMinimize: document.getElementById('btnMinimize'),
  btnMaximize: document.getElementById('btnMaximize'),
  btnClose: document.getElementById('btnClose'),

  // Output settings
  outputFolder: document.getElementById('outputFolder'),
  btnSelectOutput: document.getElementById('btnSelectOutput'),
  namingPattern: document.getElementById('namingPattern'),

  // Animation settings
  presetSelect: document.getElementById('presetSelect'),
  customPromptGroup: document.getElementById('customPromptGroup'),
  customPrompt: document.getElementById('customPrompt'),

  // Progress
  progressSection: document.getElementById('progressSection'),
  progressCompleted: document.getElementById('progressCompleted'),
  progressTotal: document.getElementById('progressTotal'),
  progressFailed: document.getElementById('progressFailed'),
  progressBar: document.getElementById('progressBar'),
  progressStatus: document.getElementById('progressStatus'),

  // Action buttons
  btnStart: document.getElementById('btnStart'),
  btnStop: document.getElementById('btnStop'),

  // History
  historySearch: document.getElementById('historySearch'),
  historyFilter: document.getElementById('historyFilter'),
  historyList: document.getElementById('historyList'),
  btnClearHistory: document.getElementById('btnClearHistory'),

  // Settings
  cookieDatr: document.getElementById('cookieDatr'),
  cookieAbraSess: document.getElementById('cookieAbraSess'),
  cookieStatus: document.getElementById('cookieStatus'),
  btnValidateCookies: document.getElementById('btnValidateCookies'),
  btnClearCookies: document.getElementById('btnClearCookies'),
  settingDelay: document.getElementById('settingDelay'),
  settingRetries: document.getElementById('settingRetries'),
  settingHeadless: document.getElementById('settingHeadless'),
  btnSaveSettings: document.getElementById('btnSaveSettings'),

  // Modal
  videoModal: document.getElementById('videoModal'),
  previewVideo: document.getElementById('previewVideo'),
  btnCloseModal: document.getElementById('btnCloseModal'),

  // Toast
  toastContainer: document.getElementById('toastContainer'),

  // TTI Elements
  ttiPromptInput: document.getElementById('ttiPromptInput'),
  ttiStylePreset: document.getElementById('ttiStylePreset'),
  btnAddPrompt: document.getElementById('btnAddPrompt'),
  btnImportPrompts: document.getElementById('btnImportPrompts'),
  btnClearPrompts: document.getElementById('btnClearPrompts'),
  ttiPromptCount: document.getElementById('ttiPromptCount'),
  ttiPromptList: document.getElementById('ttiPromptList'),
  ttiOutputFolder: document.getElementById('ttiOutputFolder'),
  btnTTISelectFolder: document.getElementById('btnTTISelectFolder'),
  ttiConvertToVideo: document.getElementById('ttiConvertToVideo'),
  ttiVideoPromptGroup: document.getElementById('ttiVideoPromptGroup'),
  ttiVideoPreset: document.getElementById('ttiVideoPreset'),
  ttiCustomVideoPromptGroup: document.getElementById('ttiCustomVideoPromptGroup'),
  ttiCustomVideoPrompt: document.getElementById('ttiCustomVideoPrompt'),
  ttiProgressSection: document.getElementById('ttiProgressSection'),
  ttiProgressTotal: document.getElementById('ttiProgressTotal'),
  ttiProgressCompleted: document.getElementById('ttiProgressCompleted'),
  ttiProgressFailed: document.getElementById('ttiProgressFailed'),
  ttiProgressBar: document.getElementById('ttiProgressBar'),
  ttiProgressStatus: document.getElementById('ttiProgressStatus'),
  btnStartTTI: document.getElementById('btnStartTTI'),
  btnStopTTI: document.getElementById('btnStopTTI'),

  // Gallery Elements
  galleryGrid: document.getElementById('galleryGrid'),
  galleryStats: document.getElementById('galleryStats'),
  galleryCount: document.getElementById('galleryCount'),
  btnRefreshGallery: document.getElementById('btnRefreshGallery'),
  btnOpenGalleryFolder: document.getElementById('btnOpenGalleryFolder'),

  // Image Editor Elements
  imageEditorModal: document.getElementById('imageEditorModal'),
  btnCloseEditor: document.getElementById('btnCloseEditor'),
  editorPreviewImage: document.getElementById('editorPreviewImage'),
  editorOriginalImage: document.getElementById('editorOriginalImage'),
  editorLoading: document.getElementById('editorLoading'),
  editorImageInfo: document.getElementById('editorImageInfo'),
  editorCompare: document.getElementById('editorCompare'),
  compareSlider: document.getElementById('compareSlider'),

  // Editor Sliders
  editorBrightness: document.getElementById('editorBrightness'),
  editorContrast: document.getElementById('editorContrast'),
  editorSaturation: document.getElementById('editorSaturation'),
  editorSharpness: document.getElementById('editorSharpness'),
  editorBlur: document.getElementById('editorBlur'),
  brightnessValue: document.getElementById('brightnessValue'),
  contrastValue: document.getElementById('contrastValue'),
  saturationValue: document.getElementById('saturationValue'),
  sharpnessValue: document.getElementById('sharpnessValue'),
  blurValue: document.getElementById('blurValue'),

  // Editor Filters
  filterGrayscale: document.getElementById('filterGrayscale'),
  filterSepia: document.getElementById('filterSepia'),
  filterNegative: document.getElementById('filterNegative'),

  // Editor Actions
  btnResetEditor: document.getElementById('btnResetEditor'),
  btnSaveAsNew: document.getElementById('btnSaveAsNew'),
  btnSaveEditor: document.getElementById('btnSaveEditor'),

  // Transform
  btnRotateLeft: document.getElementById('btnRotateLeft'),
  btnRotate180: document.getElementById('btnRotate180'),
  btnRotateRight: document.getElementById('btnRotateRight'),
  btnFlipH: document.getElementById('btnFlipH'),
  btnFlipV: document.getElementById('btnFlipV'),
  resizeWidth: document.getElementById('resizeWidth'),
  resizeHeight: document.getElementById('resizeHeight'),
  resizeLock: document.getElementById('resizeLock'),
  btnApplyResize: document.getElementById('btnApplyResize'),

  // Export
  exportFormat: document.getElementById('exportFormat'),
  exportQuality: document.getElementById('exportQuality'),
  exportQualityValue: document.getElementById('exportQualityValue'),
  watermarkText: document.getElementById('watermarkText'),
  watermarkSize: document.getElementById('watermarkSize'),
  watermarkOpacity: document.getElementById('watermarkOpacity'),
  btnApplyWatermark: document.getElementById('btnApplyWatermark'),
  btnGenerateThumbnails: document.getElementById('btnGenerateThumbnails'),
  thumbYoutube: document.getElementById('thumbYoutube'),
  thumbInstagram: document.getElementById('thumbInstagram'),
  thumbTwitter: document.getElementById('thumbTwitter'),
  thumbFacebook: document.getElementById('thumbFacebook'),

  // Presets
  presetSelect: document.getElementById('presetSelect'),
  btnLoadPreset: document.getElementById('btnLoadPreset'),
  btnSavePreset: document.getElementById('btnSavePreset'),
  btnDeletePreset: document.getElementById('btnDeletePreset'),

  // Bulk Upscale Elements
  upscaleDropZone: document.getElementById('upscaleDropZone'),
  btnUpscaleSelectFiles: document.getElementById('btnUpscaleSelectFiles'),
  btnUpscaleSelectFolder: document.getElementById('btnUpscaleSelectFolder'),
  upscaleFileCount: document.getElementById('upscaleFileCount'),
  upscaleFileList: document.getElementById('upscaleFileList'),
  upscaleFileActions: document.getElementById('upscaleFileActions'),
  btnUpscaleClearFiles: document.getElementById('btnUpscaleClearFiles'),
  upscaleOutputFolder: document.getElementById('upscaleOutputFolder'),
  btnUpscaleSelectOutput: document.getElementById('btnUpscaleSelectOutput'),
  upscaleOutputFormat: document.getElementById('upscaleOutputFormat'),
  btnStartUpscale: document.getElementById('btnStartUpscale'),
  btnStopUpscale: document.getElementById('btnStopUpscale'),
  upscaleProgressSection: document.getElementById('upscaleProgressSection'),
  upscaleProgressCompleted: document.getElementById('upscaleProgressCompleted'),
  upscaleProgressTotal: document.getElementById('upscaleProgressTotal'),
  upscaleProgressStatus: document.getElementById('upscaleProgressStatus'),
  upscaleProgressBar: document.getElementById('upscaleProgressBar')
};

// Gallery State
let galleryItems = [];
let galleryFilter = 'all';

// Image Editor State
let editorImagePath = null;
let editorOriginalBase64 = null;
let editorImageMetadata = null;
let editorEdits = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sharpness: 0,
  blur: 0,
  grayscale: false,
  sepia: false,
  negative: false,
  rotation: 0,
  flipH: false,
  flipV: false,
  watermark: null  // { text, fontSize, opacity, color }
};
let editorPreviewTimeout = null;
let editorPresets = {};
let resizeAspectLocked = true;

// Bulk Upscale State
let upscaleFiles = [];           // Array of { id, name, path, status, progress, thumbnail }
let upscaleMethod = 'ai';        // AI upscaling only (Real-ESRGAN)
let upscaleScale = 2;            // 2, 3, or 4
let isUpscaling = false;
let upscaleIdCounter = 0;

// ============================================
// Initialization
// ============================================

async function init() {
  // Load config
  config = await window.api.loadConfig();
  applyConfig(config);

  // Load presets
  presets = await window.api.getPresets();
  populatePresets();

  // Load TTI presets
  ttiPresets = await window.api.getTTIPresets();

  // Check for resume data
  const resumeData = await window.api.getResumeData();
  if (resumeData && resumeData.files.length > 0) {
    const resume = confirm(`Found ${resumeData.files.length} files from previous session. Resume conversion?`);
    if (resume) {
      files = resumeData.files;
      renderFileGrid();
      elements.outputFolder.value = resumeData.outputFolder;
    }
  }

  // Set up event listeners
  setupEventListeners();

  // Set up progress listeners
  window.api.onProgress(handleProgress);
  window.api.onTTIProgress(handleTTIProgress);
}

function applyConfig(cfg) {
  if (cfg.datr) elements.cookieDatr.value = cfg.datr;
  if (cfg.abra_sess) elements.cookieAbraSess.value = cfg.abra_sess;
  if (cfg.outputFolder) elements.outputFolder.value = cfg.outputFolder;
  if (cfg.namingPattern) elements.namingPattern.value = cfg.namingPattern;
  if (cfg.prompt) elements.customPrompt.value = cfg.prompt;
  if (cfg.delayBetween) elements.settingDelay.value = cfg.delayBetween;
  if (cfg.retryAttempts) elements.settingRetries.value = cfg.retryAttempts;
  if (cfg.headless !== undefined) elements.settingHeadless.checked = cfg.headless;

  // TTI config - use same output folder by default
  if (cfg.ttiOutputFolder) {
    elements.ttiOutputFolder.value = cfg.ttiOutputFolder;
  } else if (cfg.outputFolder) {
    elements.ttiOutputFolder.value = cfg.outputFolder;
  }

  // Upscale config - use same output folder by default
  if (cfg.upscaleOutputFolder) {
    elements.upscaleOutputFolder.value = cfg.upscaleOutputFolder;
  } else if (cfg.outputFolder) {
    elements.upscaleOutputFolder.value = cfg.outputFolder;
  }
}

function populatePresets() {
  elements.presetSelect.innerHTML = presets.map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join('');

  // Set initial visibility of custom prompt
  toggleCustomPrompt();
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
  // Navigation tabs
  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Drop zone
  elements.dropZone.addEventListener('dragover', handleDragOver);
  elements.dropZone.addEventListener('dragleave', handleDragLeave);
  elements.dropZone.addEventListener('drop', handleDrop);
  elements.dropZone.addEventListener('click', () => elements.btnSelectFiles.click());

  elements.btnSelectFiles.addEventListener('click', async (e) => {
    e.stopPropagation();
    const selectedFiles = await window.api.selectFiles();
    if (selectedFiles.length > 0) {
      await addFiles(selectedFiles);
    }
  });

  elements.btnSelectFolder.addEventListener('click', async (e) => {
    e.stopPropagation();
    const folder = await window.api.selectFolder('input');
    if (folder) {
      const scannedFiles = await window.api.scanFolder(folder, elements.includeSubfolders.checked);
      await addFilesFromScan(scannedFiles);
    }
  });

  elements.btnClearFiles.addEventListener('click', clearFiles);
  elements.btnRetryDownload.addEventListener('click', retryDownloads);
  elements.btnRetryGeneration.addEventListener('click', retryGeneration);

  // Window controls
  elements.btnMinimize.addEventListener('click', () => window.api.minimizeWindow());
  elements.btnMaximize.addEventListener('click', () => window.api.maximizeWindow());
  elements.btnClose.addEventListener('click', () => window.api.closeWindow());

  // Output folder
  elements.btnSelectOutput.addEventListener('click', async () => {
    const folder = await window.api.selectFolder('output');
    if (folder) {
      elements.outputFolder.value = folder;
    }
  });

  // Preset selection
  elements.presetSelect.addEventListener('change', toggleCustomPrompt);

  // Action buttons
  elements.btnStart.addEventListener('click', startConversion);
  elements.btnStop.addEventListener('click', stopConversion);

  // History
  elements.historySearch.addEventListener('input', debounce(loadHistory, 300));
  elements.historyFilter.addEventListener('change', loadHistory);
  elements.btnClearHistory.addEventListener('click', async () => {
    if (confirm('Clear all history?')) {
      await window.api.clearHistory();
      loadHistory();
      showToast('History cleared', 'success');
    }
  });

  // Settings
  elements.btnValidateCookies.addEventListener('click', validateCookies);
  elements.btnClearCookies.addEventListener('click', clearCookies);
  elements.btnSaveSettings.addEventListener('click', saveSettings);

  // Modal
  elements.btnCloseModal.addEventListener('click', closeModal);
  elements.videoModal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // TTI Event Listeners
  setupTTIEventListeners();
}

function setupTTIEventListeners() {
  // Add prompt button
  elements.btnAddPrompt.addEventListener('click', () => {
    const text = elements.ttiPromptInput.value.trim();
    if (text) {
      addTTIPrompt(text);
      elements.ttiPromptInput.value = '';
    } else {
      showToast('Please enter a prompt', 'warning');
    }
  });

  // Enter key to add prompt
  elements.ttiPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      elements.btnAddPrompt.click();
    }
  });

  // Import prompts from file
  elements.btnImportPrompts.addEventListener('click', async () => {
    const prompts = await window.api.importPromptsFile();
    if (prompts.length > 0) {
      prompts.forEach(text => addTTIPrompt(text));
      showToast(`Imported ${prompts.length} prompts`, 'success');
    }
  });

  // Clear all prompts
  elements.btnClearPrompts.addEventListener('click', () => {
    if (ttiPrompts.length > 0 && confirm('Clear all prompts from queue?')) {
      ttiPrompts = [];
      renderTTIPromptList();
      showToast('Queue cleared', 'info');
    }
  });

  // Aspect ratio buttons
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRatio = btn.dataset.ratio;
    });
  });

  // Output folder selection
  elements.btnTTISelectFolder.addEventListener('click', async () => {
    const folder = await window.api.selectFolder('output');
    if (folder) {
      elements.ttiOutputFolder.value = folder;
    }
  });

  // Convert to video checkbox
  elements.ttiConvertToVideo.addEventListener('change', () => {
    elements.ttiVideoPromptGroup.style.display = elements.ttiConvertToVideo.checked ? 'block' : 'none';
  });

  // Video preset selection
  elements.ttiVideoPreset.addEventListener('change', () => {
    elements.ttiCustomVideoPromptGroup.style.display =
      elements.ttiVideoPreset.value === 'custom' ? 'block' : 'none';
  });

  // Start/Stop TTI generation
  elements.btnStartTTI.addEventListener('click', startTTIGeneration);
  elements.btnStopTTI.addEventListener('click', stopTTIGeneration);
}

// ============================================
// Tab Navigation
// ============================================

function switchTab(tabId) {
  elements.navTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });

  elements.tabContents.forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });

  if (tabId === 'history') {
    loadHistory();
  }

  if (tabId === 'gallery') {
    loadGallery();
  }
}

// ============================================
// Drag & Drop
// ============================================

function handleDragOver(e) {
  e.preventDefault();
  elements.dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.preventDefault();
  elements.dropZone.classList.remove('drag-over');
}

async function handleDrop(e) {
  e.preventDefault();
  elements.dropZone.classList.remove('drag-over');

  const items = Array.from(e.dataTransfer.items);
  const paths = [];

  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file.path) {
        paths.push(file.path);
      }
    }
  }

  if (paths.length > 0) {
    await addFiles(paths);
  }
}

// ============================================
// File Management
// ============================================

async function addFiles(paths) {
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

  for (const filePath of paths) {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    if (imageExts.includes(ext)) {
      const name = filePath.substring(filePath.lastIndexOf('\\') + 1);
      if (!files.some(f => f.path === filePath)) {
        files.push({
          name,
          path: filePath,
          status: 'pending',
          progress: 0
        });
      }
    }
  }

  renderFileGrid();
}

async function addFilesFromScan(scannedFiles) {
  for (const file of scannedFiles) {
    if (!files.some(f => f.path === file.path)) {
      files.push({
        ...file,
        status: 'pending',
        progress: 0
      });
    }
  }

  renderFileGrid();
}

function clearFiles() {
  files = [];
  renderFileGrid();
}

async function renderFileGrid() {
  if (files.length === 0) {
    elements.fileGrid.innerHTML = '';
    elements.fileActions.style.display = 'none';
    elements.dropZone.style.display = 'block';
    return;
  }

  elements.dropZone.style.display = 'none';
  elements.fileActions.style.display = 'flex';
  elements.selectedCount.textContent = files.length;

  const html = await Promise.all(files.map(async (file, index) => {
    let thumbnail = '';
    try {
      thumbnail = await window.api.getThumbnail(file.path);
    } catch (e) {
      thumbnail = '';
    }

    const statusIcon = getStatusIcon(file.status);

    return `
      <div class="file-card ${file.status}" data-index="${index}">
        ${thumbnail ? `<img class="file-thumbnail" src="${thumbnail}" alt="${file.name}">` : ''}
        <div class="file-overlay">
          <span class="file-name">${file.name}</span>
        </div>
        <div class="file-status-badge ${file.status}" title="${file.status}">
          ${statusIcon}
        </div>
        ${file.status === 'converting' ? `
          <div class="file-progress">
            <div class="file-progress-bar" style="width: ${file.progress}%"></div>
          </div>
        ` : ''}
      </div>
    `;
  }));

  elements.fileGrid.innerHTML = html.join('');

  // Add click handlers for completed files
  elements.fileGrid.querySelectorAll('.file-card.completed').forEach(card => {
    card.addEventListener('click', () => {
      const index = parseInt(card.dataset.index);
      const file = files[index];
      if (file.outputPath) {
        previewVideo(file.outputPath);
      }
    });
  });
}

function getStatusIcon(status) {
  switch (status) {
    case 'pending': return '○';
    case 'converting': return '◉';
    case 'downloading': return '↓';
    case 'completed': return '✓';
    case 'download_failed': return '↓';
    case 'error': return '✕';
    case 'skipped': return '⊘';
    default: return '○';
  }
}

// ============================================
// Conversion
// ============================================

async function startConversion() {
  // Validate
  if (files.length === 0) {
    showToast('No files selected', 'error');
    return;
  }

  if (!elements.outputFolder.value) {
    showToast('Please select an output folder', 'error');
    return;
  }

  if (!elements.cookieDatr.value || !elements.cookieAbraSess.value) {
    showToast('Please enter Meta AI cookies in Settings', 'error');
    switchTab('settings');
    return;
  }

  // Get prompt
  const selectedPreset = presets.find(p => p.id === elements.presetSelect.value);
  const prompt = elements.presetSelect.value === 'custom'
    ? elements.customPrompt.value
    : selectedPreset?.prompt || 'Animate with smooth cinematic motion';

  // Save resume data
  await window.api.saveResumeData({
    files: files.filter(f => f.status === 'pending'),
    outputFolder: elements.outputFolder.value
  });

  // Start conversion
  const result = await window.api.startConversion({
    cookies: {
      datr: elements.cookieDatr.value,
      abra_sess: elements.cookieAbraSess.value,
      wd: '1920x1080',
      dpr: '1'
    },
    files: files.filter(f => f.status === 'pending'),
    outputFolder: elements.outputFolder.value,
    prompt,
    namingPattern: elements.namingPattern.value || '{name}.mp4',
    delayBetween: parseInt(elements.settingDelay.value) || 30,
    retryAttempts: parseInt(elements.settingRetries.value) || 3,
    headless: elements.settingHeadless.checked
  });

  if (result.success) {
    isConverting = true;
    elements.btnStart.style.display = 'none';
    elements.btnStop.style.display = 'block';
    elements.progressSection.style.display = 'block';
    elements.progressTotal.textContent = files.filter(f => f.status === 'pending').length;
    elements.progressCompleted.textContent = '0';
    elements.progressFailed.textContent = '0';
    elements.progressBar.style.width = '0%';
    showToast('Conversion started', 'info');
  } else {
    showToast(result.error || 'Failed to start conversion', 'error');
  }
}

async function stopConversion() {
  await window.api.stopConversion();
  isConverting = false;
  elements.btnStart.style.display = 'block';
  elements.btnStop.style.display = 'none';
  showToast('Conversion stopped', 'warning');
}

function handleProgress(data) {
  switch (data.type) {
    case 'file-start':
      files[data.index].status = 'converting';
      files[data.index].progress = 0;
      elements.progressStatus.textContent = `Converting: ${data.file}`;
      renderFileGrid();
      break;

    case 'file-progress':
      files[data.index].progress = data.percent;
      elements.progressStatus.textContent = `${data.stage} - ${data.file}`;

      // Update file card progress bar
      const progressBar = document.querySelector(`.file-card[data-index="${data.index}"] .file-progress-bar`);
      if (progressBar) {
        progressBar.style.width = `${data.percent}%`;
      }
      break;

    case 'file-complete':
      if (data.downloadFailed) {
        files[data.index].status = 'download_failed';
        files[data.index].videoUrl = data.videoUrl;  // Store for retry
        files[data.index].outputPath = data.outputPath;
      } else if (data.success) {
        files[data.index].status = 'completed';
        files[data.index].outputPath = data.outputPath;
      } else {
        files[data.index].status = 'error';
      }
      files[data.index].progress = 100;

      // Update progress stats
      const completed = files.filter(f => f.status === 'completed' || f.status === 'skipped').length;
      const failed = files.filter(f => f.status === 'error' || f.status === 'download_failed').length;
      elements.progressCompleted.textContent = completed;
      elements.progressFailed.textContent = failed;

      // Update progress bar based on processed files (completed + failed)
      const processed = completed + failed;
      const percent = (processed / files.length) * 100;
      elements.progressBar.style.width = `${percent}%`;

      renderFileGrid();
      break;

    case 'file-skip':
      files[data.index].status = 'skipped';
      renderFileGrid();
      break;

    case 'complete':
      isConverting = false;
      elements.btnStart.style.display = 'block';
      elements.btnStop.style.display = 'none';
      elements.progressStatus.textContent = 'Complete!';

      // Clear resume data
      window.api.saveResumeData({ files: [], outputFolder: '' });

      const successCount = files.filter(f => f.status === 'completed').length;
      const errorCount = files.filter(f => f.status === 'error').length;
      const downloadFailedCount = files.filter(f => f.status === 'download_failed').length;

      if (errorCount > 0 || downloadFailedCount > 0) {
        const issues = [];
        if (errorCount > 0) issues.push(`${errorCount} error(s)`);
        if (downloadFailedCount > 0) issues.push(`${downloadFailedCount} download failed`);
        showToast(`Completed with ${issues.join(', ')}`, 'warning');
      } else {
        showToast(`Successfully converted ${successCount} files!`, 'success');
      }
      break;

    case 'error':
      showToast(data.error, 'error');
      break;
  }
}

// ============================================
// History
// ============================================

async function loadHistory() {
  const entries = await window.api.getHistory({
    search: elements.historySearch.value,
    status: elements.historyFilter.value
  });

  if (entries.length === 0) {
    elements.historyList.innerHTML = '<div class="history-empty">No history found</div>';
    return;
  }

  elements.historyList.innerHTML = entries.map(entry => {
    const isTTI = entry.inputPath.startsWith('[TTI]');
    const displayName = isTTI ? entry.inputPath.replace('[TTI] ', '') : entry.inputPath.split('\\').pop();
    const isImage = entry.outputPath && entry.outputPath.match(/\.(png|jpg|jpeg|gif|webp)$/i);
    const isVideo = entry.outputPath && entry.outputPath.match(/\.(mp4|webm|mov)$/i);

    return `
      <div class="history-item ${isTTI ? 'history-item-tti' : ''}">
        <div class="history-status ${entry.status}"></div>
        <div class="history-info">
          <div class="history-file">${isTTI ? '🖼️ ' : ''}${displayName}</div>
          <div class="history-meta">
            <span>${new Date(entry.createdAt).toLocaleString()}</span>
            <span>${entry.status}</span>
            ${isTTI && entry.aspectRatio ? `<span>${entry.aspectRatio}</span>` : ''}
            ${entry.attempts > 1 ? `<span>${entry.attempts} attempts</span>` : ''}
          </div>
        </div>
        <div class="history-actions">
          ${entry.status === 'success' && entry.outputPath ? `
            ${isVideo ? `
              <button class="btn btn-ghost btn-sm" onclick="previewVideo('${entry.outputPath.replace(/\\/g, '\\\\')}')">
                Preview
              </button>
            ` : `
              <button class="btn btn-ghost btn-sm" onclick="window.api.openFile('${entry.outputPath.replace(/\\/g, '\\\\')}')">
                View
              </button>
            `}
            <button class="btn btn-ghost btn-sm" onclick="window.api.openFolder('${entry.outputPath.replace(/\\/g, '\\\\').replace(/[^\\]+$/, '')}')">
              Open Folder
            </button>
          ` : ''}
          ${entry.status === 'failed' && !isTTI ? `
            <button class="btn btn-secondary btn-sm" onclick="retryConversion('${entry.inputPath.replace(/\\/g, '\\\\')}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Retry
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Retry failed conversion
async function retryConversion(inputPath) {
  // Check if file still exists
  const exists = await window.api.fileExists(inputPath);
  if (!exists) {
    showToast('Original file no longer exists', 'error');
    return;
  }

  // Add file to queue
  const fileName = inputPath.split('\\').pop();
  files.push({
    path: inputPath,
    name: fileName,
    status: 'pending',
    progress: 0
  });

  // Switch to convert tab
  switchTab('convert');

  // Update UI
  renderFileGrid();
  showToast(`Added "${fileName}" for retry`, 'info');
}

// Retry downloads only (for files where generation succeeded but download failed)
async function retryDownloads() {
  const downloadFailed = files.filter(f => f.status === 'download_failed');

  console.log('[RETRY] Files with download_failed status:', downloadFailed.length);
  console.log('[RETRY] All files:', files.map(f => ({ name: f.name, status: f.status, hasUrl: !!f.videoUrl })));

  if (downloadFailed.length === 0) {
    showToast('No failed downloads to retry', 'info');
    return;
  }

  // Check if any files have missing URLs
  const missingUrls = downloadFailed.filter(f => !f.videoUrl);
  if (missingUrls.length > 0) {
    showToast(`${missingUrls.length} file(s) have no stored URL - need regeneration`, 'warning');
  }

  const withUrls = downloadFailed.filter(f => f.videoUrl);
  if (withUrls.length === 0) {
    showToast('No valid URLs to retry. Use "Retry Generation" instead.', 'warning');
    return;
  }

  showToast(`Retrying ${withUrls.length} download(s)...`, 'info');

  let successCount = 0;
  let expiredCount = 0;

  for (const file of withUrls) {
    file.status = 'downloading';
    renderFileGrid();

    console.log(`[RETRY] Downloading ${file.name}...`);
    console.log(`[RETRY] Video URL: ${file.videoUrl?.substring(0, 100)}...`);
    console.log(`[RETRY] Output: ${file.outputPath}`);

    try {
      const result = await window.api.retryDownload({
        videoUrl: file.videoUrl,
        outputPath: file.outputPath
      });

      console.log(`[RETRY] Result:`, result);

      if (result.success) {
        file.status = 'completed';
        successCount++;
        renderFileGrid();
      } else if (result.expired) {
        // URL expired - clear it so Retry Generation will pick it up
        file.status = 'download_failed';
        file.videoUrl = null;
        expiredCount++;
        renderFileGrid();
      } else {
        file.status = 'download_failed';
        renderFileGrid();
        showToast(`Failed: ${file.name} - ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (e) {
      console.error(`[RETRY] Error:`, e);
      file.status = 'download_failed';
      renderFileGrid();
      showToast(`Error: ${file.name} - ${e.message}`, 'error');
    }
  }

  // Summary toast
  if (successCount > 0) {
    showToast(`Downloaded ${successCount} file(s) successfully`, 'success');
  }
  if (expiredCount > 0) {
    showToast(`${expiredCount} URL(s) expired - click "Retry Generation"`, 'warning');
  }
}

// Retry generation (for files where generation failed OR download failed with no URL)
function retryGeneration() {
  // Include: error status, OR download_failed without a valid URL
  const needsRegeneration = files.filter(f =>
    f.status === 'error' ||
    (f.status === 'download_failed' && !f.videoUrl)
  );

  console.log('[RETRY-GEN] Files needing regeneration:', needsRegeneration.length);

  if (needsRegeneration.length === 0) {
    showToast('No failed files to regenerate', 'info');
    return;
  }

  // Reset failed files to pending for re-conversion
  needsRegeneration.forEach(f => {
    f.status = 'pending';
    f.progress = 0;
    f.videoUrl = null;
    f.outputPath = null;
  });

  renderFileGrid();
  showToast(`${needsRegeneration.length} file(s) queued for re-generation. Click "Start Conversion" to begin.`, 'success');
}

// ============================================
// Settings
// ============================================

async function validateCookies() {
  elements.btnValidateCookies.disabled = true;
  elements.btnValidateCookies.innerHTML = '<span class="spinner"></span> Validating...';

  const result = await window.api.validateCookies({
    datr: elements.cookieDatr.value,
    abra_sess: elements.cookieAbraSess.value,
    wd: '1920x1080',
    dpr: '1'
  });

  elements.btnValidateCookies.disabled = false;
  elements.btnValidateCookies.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
    Validate Cookies
  `;

  if (result.valid) {
    elements.cookieStatus.className = 'cookie-status valid';
    elements.cookieStatus.innerHTML = '<div class="status-indicator"></div><span>Cookies valid</span>';
    showToast('Cookies validated successfully!', 'success');
  } else {
    elements.cookieStatus.className = 'cookie-status invalid';
    elements.cookieStatus.innerHTML = '<div class="status-indicator"></div><span>Invalid cookies</span>';
    showToast(result.error || 'Invalid cookies', 'error');
  }
}

async function saveSettings() {
  const cfg = {
    datr: elements.cookieDatr.value,
    abra_sess: elements.cookieAbraSess.value,
    outputFolder: elements.outputFolder.value,
    namingPattern: elements.namingPattern.value,
    prompt: elements.customPrompt.value,
    delayBetween: parseInt(elements.settingDelay.value),
    retryAttempts: parseInt(elements.settingRetries.value),
    headless: elements.settingHeadless.checked,
    ttiOutputFolder: elements.ttiOutputFolder.value,
    upscaleOutputFolder: elements.upscaleOutputFolder.value
  };

  await window.api.saveConfig(cfg);
  config = cfg;
  showToast('Settings saved', 'success');
}

async function clearCookies() {
  if (confirm('Clear all saved cookies?')) {
    elements.cookieDatr.value = '';
    elements.cookieAbraSess.value = '';
    elements.cookieStatus.className = 'cookie-status';
    elements.cookieStatus.innerHTML = '<div class="status-indicator"></div><span>Not validated</span>';

    // Save empty cookies to config
    const cfg = await window.api.loadConfig();
    cfg.datr = '';
    cfg.abra_sess = '';
    await window.api.saveConfig(cfg);

    showToast('Cookies cleared', 'success');
  }
}

function toggleCustomPrompt() {
  const isCustom = elements.presetSelect.value === 'custom';
  elements.customPromptGroup.style.display = isCustom ? 'block' : 'none';
}

// ============================================
// Video Preview
// ============================================

function previewVideo(filePath) {
  elements.previewVideo.src = filePath;
  elements.videoModal.classList.add('active');
}

function closeModal() {
  elements.videoModal.classList.remove('active');
  elements.previewVideo.pause();
  elements.previewVideo.src = '';
}

// ============================================
// Toast Notifications
// ============================================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-message">${message}</div>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ============================================
// Utilities
// ============================================

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// ============================================
// Text-to-Image Functions
// ============================================

function addTTIPrompt(text) {
  const prompt = {
    id: ++ttiPromptIdCounter,
    text: text.trim(),
    status: 'pending',
    progress: 0
  };
  ttiPrompts.push(prompt);
  renderTTIPromptList();
}

function removeTTIPrompt(id) {
  ttiPrompts = ttiPrompts.filter(p => p.id !== id);
  renderTTIPromptList();
}

function renderTTIPromptList() {
  elements.ttiPromptCount.textContent = ttiPrompts.length;

  if (ttiPrompts.length === 0) {
    elements.ttiPromptList.innerHTML = `
      <div class="prompt-list-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
        </svg>
        <p>No prompts in queue</p>
        <p class="text-muted">Add prompts above or import from a file</p>
      </div>
    `;
    return;
  }

  const html = ttiPrompts.map((prompt, index) => {
    const statusIcon = getTTIStatusIcon(prompt.status);
    const showProgress = prompt.status === 'generating';
    const showPreview = prompt.status === 'completed' && prompt.outputPath;

    return `
      <div class="prompt-card ${prompt.status}" data-id="${prompt.id}">
        <div class="prompt-card-number">${index + 1}</div>
        ${showPreview ? `
          <div class="prompt-card-preview">
            <img src="file://${prompt.outputPath}" alt="Generated image">
          </div>
        ` : ''}
        <div class="prompt-card-content">
          <div class="prompt-card-text">${escapeHtml(prompt.text)}</div>
          <div class="prompt-card-meta">
            <span class="prompt-card-status">${statusIcon} ${prompt.status}</span>
            ${prompt.error ? `<span class="text-danger">${prompt.error}</span>` : ''}
          </div>
          ${showProgress ? `
            <div class="prompt-progress">
              <div class="prompt-progress-bar" style="width: ${prompt.progress}%"></div>
            </div>
          ` : ''}
        </div>
        <div class="prompt-card-actions">
          ${prompt.status === 'completed' && prompt.outputPath ? `
            <button class="btn-preview" title="Open image" onclick="window.api.openFile('${prompt.outputPath.replace(/\\/g, '\\\\')}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          ` : ''}
          ${prompt.status === 'pending' ? `
            <button class="btn-remove" title="Remove" onclick="removeTTIPrompt(${prompt.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  elements.ttiPromptList.innerHTML = html;
}

function getTTIStatusIcon(status) {
  switch (status) {
    case 'pending': return '○';
    case 'generating': return '◉';
    case 'completed': return '✓';
    case 'failed': return '✕';
    default: return '○';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function startTTIGeneration() {
  const pendingPrompts = ttiPrompts.filter(p => p.status === 'pending');

  if (pendingPrompts.length === 0) {
    showToast('No prompts in queue', 'error');
    return;
  }

  if (!elements.ttiOutputFolder.value) {
    showToast('Please select an output folder', 'error');
    return;
  }

  if (!elements.cookieDatr.value || !elements.cookieAbraSess.value) {
    showToast('Please enter Meta AI cookies in Settings', 'error');
    switchTab('settings');
    return;
  }

  // Get style prefix
  const selectedPreset = ttiPresets.find(p => p.id === elements.ttiStylePreset.value);
  const stylePrefix = selectedPreset?.prefix || '';

  // Get video prompt if enabled
  let videoPrompt = '';
  if (elements.ttiConvertToVideo.checked) {
    if (elements.ttiVideoPreset.value === 'custom') {
      videoPrompt = elements.ttiCustomVideoPrompt.value;
    } else {
      const videoPreset = presets.find(p => p.id === elements.ttiVideoPreset.value);
      videoPrompt = videoPreset?.prompt || 'Animate with smooth cinematic motion';
    }
  }

  const result = await window.api.startTTIGeneration({
    cookies: {
      datr: elements.cookieDatr.value,
      abra_sess: elements.cookieAbraSess.value,
      wd: '1920x1080',
      dpr: '1'
    },
    prompts: pendingPrompts,
    aspectRatio: selectedRatio,
    outputFolder: elements.ttiOutputFolder.value,
    stylePrefix,
    convertToVideo: elements.ttiConvertToVideo.checked,
    videoPrompt,
    delayBetween: parseInt(elements.settingDelay.value) || 30,
    retryAttempts: parseInt(elements.settingRetries.value) || 3,
    headless: elements.settingHeadless.checked
  });

  if (result.success) {
    isTTIGenerating = true;
    elements.btnStartTTI.style.display = 'none';
    elements.btnStopTTI.style.display = 'block';
    elements.ttiProgressSection.style.display = 'block';
    elements.ttiProgressTotal.textContent = pendingPrompts.length;
    elements.ttiProgressCompleted.textContent = '0';
    elements.ttiProgressFailed.textContent = '0';
    elements.ttiProgressBar.style.width = '0%';
    showToast('Generation started', 'info');
  } else {
    showToast(result.error || 'Failed to start generation', 'error');
  }
}

async function stopTTIGeneration() {
  await window.api.stopTTIGeneration();
  isTTIGenerating = false;
  elements.btnStartTTI.style.display = 'block';
  elements.btnStopTTI.style.display = 'none';
  showToast('Generation stopped', 'warning');
}

function handleTTIProgress(data) {
  const prompt = ttiPrompts.find(p => p.id === data.promptId);

  switch (data.type) {
    case 'prompt-start':
      if (prompt) {
        prompt.status = 'generating';
        prompt.progress = 0;
        elements.ttiProgressStatus.textContent = `Generating: ${prompt.text.substring(0, 50)}...`;
        renderTTIPromptList();
      }
      break;

    case 'prompt-progress':
      if (prompt) {
        prompt.progress = data.percent;
        elements.ttiProgressStatus.textContent = `${data.stage} - ${prompt.text.substring(0, 40)}...`;

        // Update progress bar in the prompt card
        const progressBar = document.querySelector(`.prompt-card[data-id="${data.promptId}"] .prompt-progress-bar`);
        if (progressBar) {
          progressBar.style.width = `${data.percent}%`;
        }
      }
      break;

    case 'prompt-complete':
      if (prompt) {
        prompt.status = data.success ? 'completed' : 'failed';
        prompt.error = data.error;
        prompt.outputPath = data.outputPath;
        prompt.imageUrl = data.imageUrl;
        prompt.progress = 100;

        // Update progress stats
        const completed = ttiPrompts.filter(p => p.status === 'completed').length;
        const failed = ttiPrompts.filter(p => p.status === 'failed').length;
        elements.ttiProgressCompleted.textContent = completed;
        elements.ttiProgressFailed.textContent = failed;

        // Update progress bar
        const total = ttiPrompts.filter(p => p.status !== 'pending').length;
        const percent = (total / ttiPrompts.length) * 100;
        elements.ttiProgressBar.style.width = `${percent}%`;

        renderTTIPromptList();
      }
      break;

    case 'prompt-video-start':
      if (prompt) {
        elements.ttiProgressStatus.textContent = `Converting to video: ${prompt.text.substring(0, 40)}...`;
      }
      break;

    case 'prompt-video-progress':
      if (prompt) {
        elements.ttiProgressStatus.textContent = `${data.stage} (video) - ${prompt.text.substring(0, 30)}...`;
      }
      break;

    case 'prompt-video-complete':
      if (prompt && data.success) {
        prompt.videoPath = data.videoPath;
        renderTTIPromptList();
      }
      break;

    case 'complete':
      isTTIGenerating = false;
      elements.btnStartTTI.style.display = 'block';
      elements.btnStopTTI.style.display = 'none';
      elements.ttiProgressStatus.textContent = 'Complete!';

      const successCount = ttiPrompts.filter(p => p.status === 'completed').length;
      const errorCount = ttiPrompts.filter(p => p.status === 'failed').length;

      if (errorCount > 0) {
        showToast(`Completed with ${errorCount} error(s)`, 'warning');
      } else {
        showToast(`Successfully generated ${successCount} images!`, 'success');
      }
      break;

    case 'error':
      showToast(data.error, 'error');
      break;
  }
}

// ============================================
// Gallery Functions
// ============================================

async function loadGallery() {
  // Use the TTI output folder or the main output folder
  const galleryFolder = elements.ttiOutputFolder.value || elements.outputFolder.value;

  if (!galleryFolder) {
    renderGalleryEmpty('No output folder selected. Set one in Settings or Text to Image tab.');
    return;
  }

  elements.galleryStats.textContent = 'Scanning...';

  try {
    galleryItems = await window.api.scanGallery(galleryFolder);

    // Apply filter
    let filteredItems = galleryItems;
    if (galleryFilter === 'images') {
      filteredItems = galleryItems.filter(item => item.type === 'image');
    } else if (galleryFilter === 'videos') {
      filteredItems = galleryItems.filter(item => item.type === 'video');
    }

    const itemCount = filteredItems.length;
    elements.galleryStats.textContent = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;

    if (filteredItems.length === 0) {
      renderGalleryEmpty('No media files found in the output folder.');
      return;
    }

    renderGallery(filteredItems);
  } catch (e) {
    console.error('Gallery load error:', e);
    renderGalleryEmpty('Failed to load gallery: ' + e.message);
  }
}

function renderGalleryEmpty(message) {
  elements.galleryGrid.innerHTML = `
    <div class="gallery-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <p>${message}</p>
    </div>
  `;
}

async function renderGallery(items) {
  const html = await Promise.all(items.map(async (item, index) => {
    let thumbnail = '';

    if (item.type === 'image') {
      try {
        thumbnail = await window.api.getThumbnail(item.path);
      } catch (e) {
        thumbnail = '';
      }
    }

    const sizeStr = formatFileSize(item.size);
    const dateStr = new Date(item.created).toLocaleDateString();

    return `
      <div class="gallery-item ${item.type}" data-index="${index}" data-path="${item.path.replace(/\\/g, '\\\\')}" data-type="${item.type}">
        <div class="gallery-item-thumb">
          ${item.type === 'image' && thumbnail
            ? `<img src="${thumbnail}" alt="${item.name}">`
            : item.type === 'video'
              ? `<div class="gallery-video-thumb">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </div>`
              : '<div class="gallery-no-thumb">?</div>'
          }
        </div>
        <div class="gallery-item-overlay">
          <div class="gallery-item-actions">
            <button class="gallery-btn gallery-btn-view" title="View">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            ${item.type === 'image' ? `
            <button class="gallery-btn gallery-btn-edit" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            ` : ''}
            <button class="gallery-btn gallery-btn-folder" title="Show in folder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <button class="gallery-btn gallery-btn-delete" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="gallery-item-info">
          <span class="gallery-item-name" title="${item.name}">${item.name}</span>
          <span class="gallery-item-meta">${sizeStr} • ${dateStr}</span>
        </div>
        ${item.type === 'video' ? '<div class="gallery-item-badge">VIDEO</div>' : ''}
      </div>
    `;
  }));

  elements.galleryGrid.innerHTML = html.join('');

  // Add click handlers
  elements.galleryGrid.querySelectorAll('.gallery-item').forEach(item => {
    const path = item.dataset.path;
    const type = item.dataset.type;

    // View button
    item.querySelector('.gallery-btn-view').addEventListener('click', (e) => {
      e.stopPropagation();
      if (type === 'video') {
        previewVideo(path);
      } else {
        window.api.openFile(path);
      }
    });

    // Edit button (images only)
    const editBtn = item.querySelector('.gallery-btn-edit');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openImageEditor(path);
      });
    }

    // Folder button
    item.querySelector('.gallery-btn-folder').addEventListener('click', (e) => {
      e.stopPropagation();
      const folderPath = path.substring(0, path.lastIndexOf('\\'));
      window.api.openFolder(folderPath);
    });

    // Delete button
    item.querySelector('.gallery-btn-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      const itemName = galleryItems[parseInt(item.dataset.index)].name;
      if (confirm(`Delete "${itemName}"?`)) {
        const result = await window.api.deleteGalleryItem(path);
        if (result.success) {
          showToast('File deleted', 'success');
          loadGallery();
        } else {
          showToast('Failed to delete: ' + result.error, 'error');
        }
      }
    });

    // Click on item to view
    item.addEventListener('click', () => {
      if (type === 'video') {
        previewVideo(path);
      } else {
        window.api.openFile(path);
      }
    });
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function setupGalleryEventListeners() {
  // Refresh button
  if (elements.btnRefreshGallery) {
    elements.btnRefreshGallery.addEventListener('click', loadGallery);
  }

  // Open folder button
  if (elements.btnOpenGalleryFolder) {
    elements.btnOpenGalleryFolder.addEventListener('click', () => {
      const galleryFolder = elements.ttiOutputFolder.value || elements.outputFolder.value;
      if (galleryFolder) {
        window.api.openFolder(galleryFolder);
      } else {
        showToast('No output folder selected', 'warning');
      }
    });
  }

  // Filter buttons (gallery tabs)
  document.querySelectorAll('.gallery-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gallery-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      galleryFilter = btn.dataset.filter;
      loadGallery();
    });
  });
}

// ============================================
// Image Editor Functions
// ============================================

async function openImageEditor(imagePath) {
  editorImagePath = imagePath;
  resetEditorState();

  // Show modal
  elements.imageEditorModal.classList.add('active');
  showEditorLoading(true);

  try {
    // Load image
    const result = await window.api.loadImageForEdit(imagePath);
    if (result.success) {
      editorOriginalBase64 = result.base64;
      editorImageMetadata = { width: result.width, height: result.height, format: result.format };
      elements.editorPreviewImage.src = result.base64;
      elements.editorOriginalImage.src = result.base64;
      elements.editorImageInfo.textContent = `${result.width} x ${result.height} • ${result.format.toUpperCase()}`;

      // Set resize inputs
      elements.resizeWidth.value = result.width;
      elements.resizeHeight.value = result.height;

      // Load presets
      loadEditorPresets();
    } else {
      showToast('Failed to load image: ' + result.error, 'error');
      closeImageEditor();
    }
  } catch (e) {
    showToast('Error loading image', 'error');
    closeImageEditor();
  } finally {
    showEditorLoading(false);
  }
}

function closeImageEditor() {
  elements.imageEditorModal.classList.remove('active');
  editorImagePath = null;
  editorOriginalBase64 = null;
  editorImageMetadata = null;
  elements.editorPreviewImage.src = '';
  elements.editorOriginalImage.src = '';
  elements.editorCompare.checked = false;
  toggleCompareMode(false);
}

function resetEditorState() {
  editorEdits = {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    sharpness: 0,
    blur: 0,
    grayscale: false,
    sepia: false,
    negative: false,
    rotation: 0,
    flipH: false,
    flipV: false,
    watermark: null
  };

  // Reset sliders
  elements.editorBrightness.value = 100;
  elements.editorContrast.value = 100;
  elements.editorSaturation.value = 100;
  elements.editorSharpness.value = 0;
  elements.editorBlur.value = 0;

  // Update value displays
  elements.brightnessValue.textContent = '100%';
  elements.contrastValue.textContent = '100%';
  elements.saturationValue.textContent = '100%';
  elements.sharpnessValue.textContent = '0';
  elements.blurValue.textContent = '0';

  // Reset filter buttons
  elements.filterGrayscale.classList.remove('active');
  elements.filterSepia.classList.remove('active');
  elements.filterNegative.classList.remove('active');

  // Reset preview to original
  if (editorOriginalBase64) {
    elements.editorPreviewImage.src = editorOriginalBase64;
  }

  // Reset resize to original dimensions
  if (editorImageMetadata) {
    elements.resizeWidth.value = editorImageMetadata.width;
    elements.resizeHeight.value = editorImageMetadata.height;
  }
}

function showEditorLoading(show) {
  if (show) {
    elements.editorLoading.classList.add('active');
  } else {
    elements.editorLoading.classList.remove('active');
  }
}

function updateEditorPreview() {
  if (editorPreviewTimeout) {
    clearTimeout(editorPreviewTimeout);
  }

  editorPreviewTimeout = setTimeout(async () => {
    if (!editorImagePath) return;

    showEditorLoading(true);

    try {
      const result = await window.api.previewImageEdit({
        imagePath: editorImagePath,
        edits: editorEdits
      });

      if (result.success) {
        elements.editorPreviewImage.src = result.base64;
      }
    } catch (e) {
      console.error('Preview error:', e);
    } finally {
      showEditorLoading(false);
    }
  }, 150);
}

function handleSliderChange(slider, valueElement, editKey, isPercent = true) {
  const value = parseFloat(slider.value);

  if (isPercent) {
    editorEdits[editKey] = value / 100;
    valueElement.textContent = `${Math.round(value)}%`;
  } else {
    editorEdits[editKey] = value;
    valueElement.textContent = value.toString();
  }

  updateEditorPreview();
}

function toggleFilter(filterKey, button) {
  editorEdits[filterKey] = !editorEdits[filterKey];
  button.classList.toggle('active', editorEdits[filterKey]);
  updateEditorPreview();
}

async function saveEditedImage(asNew = false) {
  if (!editorImagePath) {
    showToast('No image loaded', 'error');
    return;
  }

  showEditorLoading(true);

  try {
    const format = elements.exportFormat.value || 'jpg';
    const quality = parseInt(elements.exportQuality.value) || 90;

    console.log('[SAVE] Image path:', editorImagePath);
    console.log('[SAVE] Format:', format);
    console.log('[SAVE] Quality:', quality);
    console.log('[SAVE] As new:', asNew);
    console.log('[SAVE] Edits:', editorEdits);

    const result = await window.api.exportImage({
      imagePath: editorImagePath,
      edits: editorEdits,
      format,
      quality,
      outputPath: asNew ? null : editorImagePath
    });

    console.log('[SAVE] Result:', result);

    if (result.success) {
      if (result.fallback) {
        showToast(`Original file was locked. Saved as: ${result.outputPath.split('\\').pop()}`, 'warning');
      } else {
        showToast(`Image saved: ${result.outputPath.split('\\').pop()}`, 'success');
      }
      closeImageEditor();
      loadGallery(); // Refresh gallery
    } else {
      showToast('Failed to save: ' + (result.error || 'Unknown error'), 'error');
      console.error('[SAVE] Error:', result.error);
    }
  } catch (e) {
    showToast('Error saving image: ' + e.message, 'error');
    console.error('[SAVE] Exception:', e);
  } finally {
    showEditorLoading(false);
  }
}

// Editor Tab Switching
function switchEditorTab(tabId) {
  document.querySelectorAll('.editor-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });
  document.querySelectorAll('.editor-tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `editorTab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  });
}

// Compare Mode
function toggleCompareMode(enabled) {
  elements.editorOriginalImage.style.display = enabled ? 'block' : 'none';
  elements.compareSlider.style.display = enabled ? 'block' : 'none';

  if (enabled) {
    // Reset slider to center
    updateComparePosition(50);
  }
}

// Update compare slider position
function updateComparePosition(percent) {
  percent = Math.max(0, Math.min(100, percent));
  elements.compareSlider.style.left = `${percent}%`;
  elements.editorOriginalImage.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
}

// Compare slider drag handlers
let isCompareDragging = false;

function initCompareSlider() {
  const previewContainer = document.querySelector('.editor-preview');

  elements.compareSlider.addEventListener('mousedown', (e) => {
    isCompareDragging = true;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isCompareDragging) return;

    const rect = previewContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = (x / rect.width) * 100;
    updateComparePosition(percent);
  });

  document.addEventListener('mouseup', () => {
    isCompareDragging = false;
  });

  // Touch support
  elements.compareSlider.addEventListener('touchstart', (e) => {
    isCompareDragging = true;
    e.preventDefault();
  });

  document.addEventListener('touchmove', (e) => {
    if (!isCompareDragging) return;

    const rect = previewContainer.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const percent = (x / rect.width) * 100;
    updateComparePosition(percent);
  });

  document.addEventListener('touchend', () => {
    isCompareDragging = false;
  });
}

// Transform Functions
async function rotateImage(angle) {
  editorEdits.rotation = (editorEdits.rotation + angle) % 360;
  showEditorLoading(true);
  try {
    const result = await window.api.rotateImage({ imagePath: editorImagePath, angle: editorEdits.rotation });
    if (result.success) {
      elements.editorPreviewImage.src = result.base64;
    }
  } finally {
    showEditorLoading(false);
  }
}

async function flipImage(direction) {
  if (direction === 'horizontal') {
    editorEdits.flipH = !editorEdits.flipH;
  } else {
    editorEdits.flipV = !editorEdits.flipV;
  }
  showEditorLoading(true);
  try {
    const result = await window.api.flipImage({ imagePath: editorImagePath, direction });
    if (result.success) {
      elements.editorPreviewImage.src = result.base64;
    }
  } finally {
    showEditorLoading(false);
  }
}

async function applyResize() {
  const width = parseInt(elements.resizeWidth.value);
  const height = parseInt(elements.resizeHeight.value);

  if (!width || !height) {
    showToast('Please enter valid dimensions', 'warning');
    return;
  }

  showEditorLoading(true);
  try {
    const result = await window.api.resizeImage({ imagePath: editorImagePath, width, height });
    if (result.success) {
      elements.editorPreviewImage.src = result.base64;
      elements.editorImageInfo.textContent = `${width} x ${height}`;
      showToast('Resize applied', 'success');
    }
  } finally {
    showEditorLoading(false);
  }
}

// Watermark
async function applyWatermark() {
  const text = elements.watermarkText.value.trim();
  if (!text) {
    showToast('Please enter watermark text', 'warning');
    return;
  }

  // Store watermark data in edits so it will be saved
  editorEdits.watermark = {
    text,
    fontSize: parseInt(elements.watermarkSize.value) || 24,
    opacity: (parseInt(elements.watermarkOpacity.value) || 50) / 100,
    color: 'white'
  };

  showEditorLoading(true);
  try {
    const result = await window.api.addWatermark({
      imagePath: editorImagePath,
      watermark: editorEdits.watermark
    });

    if (result.success) {
      elements.editorPreviewImage.src = result.base64;
      showToast('Watermark applied (will be saved)', 'success');
    }
  } finally {
    showEditorLoading(false);
  }
}

// Thumbnails
async function generateThumbnails() {
  const sizes = [];
  if (elements.thumbYoutube.checked) sizes.push({ name: 'youtube', width: 1280, height: 720 });
  if (elements.thumbInstagram.checked) sizes.push({ name: 'instagram', width: 1080, height: 1080 });
  if (elements.thumbTwitter.checked) sizes.push({ name: 'twitter', width: 1200, height: 675 });
  if (elements.thumbFacebook.checked) sizes.push({ name: 'facebook', width: 1200, height: 630 });

  if (sizes.length === 0) {
    showToast('Select at least one thumbnail size', 'warning');
    return;
  }

  const outputFolder = elements.ttiOutputFolder.value || elements.outputFolder.value;
  if (!outputFolder) {
    showToast('Please set an output folder first', 'warning');
    return;
  }

  showEditorLoading(true);
  try {
    const result = await window.api.generateThumbnails({
      imagePath: editorImagePath,
      outputFolder,
      sizes
    });

    if (result.success) {
      showToast(`Generated ${result.results.length} thumbnails!`, 'success');
      loadGallery();
    }
  } finally {
    showEditorLoading(false);
  }
}

// Presets
async function loadEditorPresets() {
  const result = await window.api.loadPresets();
  if (result.success) {
    editorPresets = result.presets;
    updatePresetDropdown();
  }
}

function updatePresetDropdown() {
  const names = Object.keys(editorPresets);
  elements.presetSelect.innerHTML = '<option value="">Select preset...</option>' +
    names.map(name => `<option value="${name}">${name}</option>`).join('');
}

async function saveCurrentPreset() {
  const name = prompt('Enter preset name:');
  if (!name) return;

  const result = await window.api.savePreset({ name, edits: editorEdits });
  if (result.success) {
    showToast('Preset saved', 'success');
    loadEditorPresets();
  }
}

function loadSelectedPreset() {
  const name = elements.presetSelect.value;
  if (!name || !editorPresets[name]) return;

  const preset = editorPresets[name];
  editorEdits = { ...editorEdits, ...preset };

  // Update UI
  elements.editorBrightness.value = (preset.brightness || 1) * 100;
  elements.editorContrast.value = (preset.contrast || 1) * 100;
  elements.editorSaturation.value = (preset.saturation || 1) * 100;
  elements.editorSharpness.value = preset.sharpness || 0;
  elements.editorBlur.value = preset.blur || 0;

  elements.brightnessValue.textContent = `${Math.round((preset.brightness || 1) * 100)}%`;
  elements.contrastValue.textContent = `${Math.round((preset.contrast || 1) * 100)}%`;
  elements.saturationValue.textContent = `${Math.round((preset.saturation || 1) * 100)}%`;
  elements.sharpnessValue.textContent = (preset.sharpness || 0).toString();
  elements.blurValue.textContent = (preset.blur || 0).toString();

  elements.filterGrayscale.classList.toggle('active', preset.grayscale);
  elements.filterSepia.classList.toggle('active', preset.sepia);
  elements.filterNegative.classList.toggle('active', preset.negative);

  updateEditorPreview();
  showToast('Preset loaded', 'success');
}

async function deleteSelectedPreset() {
  const name = elements.presetSelect.value;
  if (!name) return;

  if (!confirm(`Delete preset "${name}"?`)) return;

  const result = await window.api.deletePreset({ name });
  if (result.success) {
    showToast('Preset deleted', 'success');
    loadEditorPresets();
  }
}

function setupImageEditorEventListeners() {
  // Close button
  elements.btnCloseEditor.addEventListener('click', closeImageEditor);
  elements.imageEditorModal.querySelector('.modal-backdrop').addEventListener('click', closeImageEditor);

  // Editor tabs
  document.querySelectorAll('.editor-tab').forEach(tab => {
    tab.addEventListener('click', () => switchEditorTab(tab.dataset.tab));
  });

  // Compare toggle
  elements.editorCompare.addEventListener('change', () => {
    toggleCompareMode(elements.editorCompare.checked);
  });

  // Adjustment sliders
  elements.editorBrightness.addEventListener('input', () => handleSliderChange(elements.editorBrightness, elements.brightnessValue, 'brightness', true));
  elements.editorContrast.addEventListener('input', () => handleSliderChange(elements.editorContrast, elements.contrastValue, 'contrast', true));
  elements.editorSaturation.addEventListener('input', () => handleSliderChange(elements.editorSaturation, elements.saturationValue, 'saturation', true));
  elements.editorSharpness.addEventListener('input', () => handleSliderChange(elements.editorSharpness, elements.sharpnessValue, 'sharpness', false));
  elements.editorBlur.addEventListener('input', () => handleSliderChange(elements.editorBlur, elements.blurValue, 'blur', false));

  // Filters
  elements.filterGrayscale.addEventListener('click', () => toggleFilter('grayscale', elements.filterGrayscale));
  elements.filterSepia.addEventListener('click', () => toggleFilter('sepia', elements.filterSepia));
  elements.filterNegative.addEventListener('click', () => toggleFilter('negative', elements.filterNegative));

  // Transform
  elements.btnRotateLeft.addEventListener('click', () => rotateImage(-90));
  elements.btnRotate180.addEventListener('click', () => rotateImage(180));
  elements.btnRotateRight.addEventListener('click', () => rotateImage(90));
  elements.btnFlipH.addEventListener('click', () => flipImage('horizontal'));
  elements.btnFlipV.addEventListener('click', () => flipImage('vertical'));

  // Resize
  elements.resizeLock.addEventListener('click', () => {
    resizeAspectLocked = !resizeAspectLocked;
    elements.resizeLock.classList.toggle('unlocked', !resizeAspectLocked);
  });

  elements.resizeWidth.addEventListener('input', () => {
    if (resizeAspectLocked && editorImageMetadata) {
      const ratio = editorImageMetadata.height / editorImageMetadata.width;
      elements.resizeHeight.value = Math.round(parseInt(elements.resizeWidth.value) * ratio);
    }
  });

  elements.resizeHeight.addEventListener('input', () => {
    if (resizeAspectLocked && editorImageMetadata) {
      const ratio = editorImageMetadata.width / editorImageMetadata.height;
      elements.resizeWidth.value = Math.round(parseInt(elements.resizeHeight.value) * ratio);
    }
  });

  elements.btnApplyResize.addEventListener('click', applyResize);

  // Export quality
  elements.exportQuality.addEventListener('input', () => {
    elements.exportQualityValue.textContent = `${elements.exportQuality.value}%`;
  });

  // Watermark
  elements.btnApplyWatermark.addEventListener('click', applyWatermark);

  // Thumbnails
  elements.btnGenerateThumbnails.addEventListener('click', generateThumbnails);

  // Presets
  elements.btnLoadPreset.addEventListener('click', loadSelectedPreset);
  elements.btnSavePreset.addEventListener('click', saveCurrentPreset);
  elements.btnDeletePreset.addEventListener('click', deleteSelectedPreset);

  // Action buttons
  elements.btnResetEditor.addEventListener('click', () => {
    resetEditorState();
    if (editorOriginalBase64) {
      elements.editorPreviewImage.src = editorOriginalBase64;
    }
  });

  elements.btnSaveAsNew.addEventListener('click', () => saveEditedImage(true));
  elements.btnSaveEditor.addEventListener('click', () => saveEditedImage(false));

  // Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.imageEditorModal.classList.contains('active')) {
      closeImageEditor();
    }
  });
}

// ============================================
// Bulk Upscale Functions
// ============================================

function setupUpscaleEventListeners() {
  // Drop zone
  elements.upscaleDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.upscaleDropZone.classList.add('drag-over');
  });

  elements.upscaleDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    elements.upscaleDropZone.classList.remove('drag-over');
  });

  elements.upscaleDropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    elements.upscaleDropZone.classList.remove('drag-over');

    const items = Array.from(e.dataTransfer.items);
    const paths = [];

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file.path) {
          paths.push(file.path);
        }
      }
    }

    if (paths.length > 0) {
      await addUpscaleFiles(paths);
    }
  });

  elements.upscaleDropZone.addEventListener('click', () => {
    elements.btnUpscaleSelectFiles.click();
  });

  // File selection buttons
  elements.btnUpscaleSelectFiles.addEventListener('click', async (e) => {
    e.stopPropagation();
    const selectedFiles = await window.api.selectFiles();
    if (selectedFiles.length > 0) {
      await addUpscaleFiles(selectedFiles);
    }
  });

  elements.btnUpscaleSelectFolder.addEventListener('click', async (e) => {
    e.stopPropagation();
    const folder = await window.api.selectFolder('input');
    if (folder) {
      const scannedFiles = await window.api.scanFolder(folder, false);
      const paths = scannedFiles.map(f => f.path);
      await addUpscaleFiles(paths);
    }
  });

  // Clear files
  elements.btnUpscaleClearFiles.addEventListener('click', () => {
    if (upscaleFiles.length > 0 && confirm('Clear all files?')) {
      upscaleFiles = [];
      renderUpscaleFileList();
    }
  });

  // Scale buttons
  document.querySelectorAll('.scale-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      upscaleScale = parseInt(btn.dataset.scale);
    });
  });

  // Output folder
  elements.btnUpscaleSelectOutput.addEventListener('click', async () => {
    const folder = await window.api.selectFolder('output');
    if (folder) {
      elements.upscaleOutputFolder.value = folder;
    }
  });

  // Start/Stop
  elements.btnStartUpscale.addEventListener('click', startBulkUpscale);
  elements.btnStopUpscale.addEventListener('click', stopBulkUpscale);

  // Progress listener
  window.api.onBulkUpscaleProgress(handleBulkUpscaleProgress);
}

async function addUpscaleFiles(paths) {
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

  for (const filePath of paths) {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    if (imageExts.includes(ext)) {
      const name = filePath.substring(filePath.lastIndexOf('\\') + 1);
      if (!upscaleFiles.some(f => f.path === filePath)) {
        let thumbnail = '';
        try {
          thumbnail = await window.api.getThumbnail(filePath);
        } catch (e) {
          thumbnail = '';
        }

        upscaleFiles.push({
          id: ++upscaleIdCounter,
          name,
          path: filePath,
          status: 'pending',
          progress: 0,
          thumbnail
        });
      }
    }
  }

  renderUpscaleFileList();
}

function removeUpscaleFile(id) {
  upscaleFiles = upscaleFiles.filter(f => f.id !== id);
  renderUpscaleFileList();
}

function renderUpscaleFileList() {
  elements.upscaleFileCount.textContent = upscaleFiles.length;

  if (upscaleFiles.length === 0) {
    elements.upscaleDropZone.style.display = 'block';
    elements.upscaleFileList.style.display = 'none';
    elements.upscaleFileActions.style.display = 'none';
    return;
  }

  elements.upscaleDropZone.style.display = 'none';
  elements.upscaleFileList.style.display = 'block';
  elements.upscaleFileActions.style.display = 'flex';

  const html = upscaleFiles.map(file => {
    const statusText = getUpscaleStatusText(file.status);
    const statusClass = file.status;

    return `
      <div class="upscale-file-item ${statusClass}" data-id="${file.id}">
        <div class="upscale-file-thumb">
          ${file.thumbnail ? `<img src="${file.thumbnail}" alt="${file.name}">` : ''}
        </div>
        <div class="upscale-file-info">
          <div class="upscale-file-name" title="${file.name}">${file.name}</div>
          <div class="upscale-file-meta">${file.status === 'completed' ? 'Upscaled' : ''}</div>
        </div>
        <div class="upscale-file-status ${statusClass}">${statusText}</div>
        ${file.status === 'pending' ? `
          <button class="upscale-file-remove" title="Remove" onclick="removeUpscaleFile(${file.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  elements.upscaleFileList.innerHTML = html;
}

function getUpscaleStatusText(status) {
  switch (status) {
    case 'pending': return 'Waiting';
    case 'processing': return 'Processing...';
    case 'completed': return '✓ Done';
    case 'failed': return '✕ Failed';
    default: return status;
  }
}

async function startBulkUpscale() {
  const pendingFiles = upscaleFiles.filter(f => f.status === 'pending');

  if (pendingFiles.length === 0) {
    showToast('No files to upscale', 'warning');
    return;
  }

  if (!elements.upscaleOutputFolder.value) {
    showToast('Please select an output folder', 'error');
    return;
  }

  // Check if AI upscale is available
  const result = await window.api.checkRealesrgan();
  if (!result.installed) {
    showToast('Real-ESRGAN is not available for AI upscaling.', 'error');
    return;
  }

  isUpscaling = true;
  elements.btnStartUpscale.style.display = 'none';
  elements.btnStopUpscale.style.display = 'block';
  elements.upscaleProgressSection.style.display = 'block';
  elements.upscaleProgressTotal.textContent = pendingFiles.length;
  elements.upscaleProgressCompleted.textContent = '0';
  elements.upscaleProgressBar.style.width = '0%';
  elements.upscaleProgressStatus.textContent = 'Starting...';

  const startResult = await window.api.startBulkUpscale({
    files: pendingFiles,
    method: upscaleMethod,
    scale: upscaleScale,
    outputFolder: elements.upscaleOutputFolder.value,
    outputFormat: elements.upscaleOutputFormat.value
  });

  if (!startResult.success) {
    showToast(startResult.error || 'Failed to start upscaling', 'error');
    isUpscaling = false;
    elements.btnStartUpscale.style.display = 'block';
    elements.btnStopUpscale.style.display = 'none';
  }
}

async function stopBulkUpscale() {
  await window.api.stopBulkUpscale();
  isUpscaling = false;
  elements.btnStartUpscale.style.display = 'block';
  elements.btnStopUpscale.style.display = 'none';
  elements.upscaleProgressStatus.textContent = 'Stopped';
  showToast('Upscaling stopped', 'warning');
}

function handleBulkUpscaleProgress(data) {
  const file = upscaleFiles.find(f => f.id === data.fileId);

  switch (data.type) {
    case 'file-start':
      if (file) {
        file.status = 'processing';
        file.progress = 0;
        elements.upscaleProgressStatus.textContent = `Processing: ${file.name}`;
        renderUpscaleFileList();
      }
      break;

    case 'file-progress':
      if (file) {
        file.progress = data.percent;
        elements.upscaleProgressStatus.textContent = `${data.stage}: ${file.name}`;
      }
      break;

    case 'file-complete':
      if (file) {
        file.status = data.success ? 'completed' : 'failed';
        file.progress = 100;

        const completed = upscaleFiles.filter(f => f.status === 'completed').length;
        const failed = upscaleFiles.filter(f => f.status === 'failed').length;
        const total = completed + failed;
        const percent = (total / upscaleFiles.length) * 100;

        elements.upscaleProgressCompleted.textContent = completed;
        elements.upscaleProgressBar.style.width = `${percent}%`;

        renderUpscaleFileList();
      }
      break;

    case 'complete':
      isUpscaling = false;
      elements.btnStartUpscale.style.display = 'block';
      elements.btnStopUpscale.style.display = 'none';
      elements.upscaleProgressStatus.textContent = 'Complete!';

      const successCount = upscaleFiles.filter(f => f.status === 'completed').length;
      const errorCount = upscaleFiles.filter(f => f.status === 'failed').length;

      if (errorCount > 0) {
        showToast(`Completed with ${errorCount} error(s)`, 'warning');
      } else {
        showToast(`Successfully upscaled ${successCount} images!`, 'success');
      }
      break;

    case 'error':
      showToast(data.error, 'error');
      break;
  }
}

// ============================================
// Initialize
// ============================================

init();
setupGalleryEventListeners();
setupImageEditorEventListeners();
setupUpscaleEventListeners();
initCompareSlider();
