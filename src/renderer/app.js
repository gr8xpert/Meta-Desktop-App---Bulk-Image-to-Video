// ============================================
// Meta Video Converter - Renderer Process
// ============================================

// State
let files = [];
let presets = [];
let isConverting = false;
let config = {};

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
  btnRetryFailed: document.getElementById('btnRetryFailed'),
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
  progressEta: document.getElementById('progressEta'),
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
  toastContainer: document.getElementById('toastContainer')
};

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

  // Set up progress listener
  window.api.onProgress(handleProgress);
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
  elements.btnRetryFailed.addEventListener('click', retryFailedFiles);

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
    case 'completed': return '✓';
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
      files[data.index].status = data.success ? 'completed' : 'error';
      files[data.index].progress = 100;
      if (data.success) {
        files[data.index].outputPath = data.outputPath;
      }

      // Update progress stats
      const completed = files.filter(f => f.status === 'completed' || f.status === 'error' || f.status === 'skipped').length;
      elements.progressCompleted.textContent = completed;

      // Calculate ETA
      if (completed > 0) {
        const remaining = files.length - completed;
        const avgTime = 90; // Approximate seconds per file
        const etaSeconds = remaining * avgTime;
        elements.progressEta.textContent = formatTime(etaSeconds);
      }

      // Update progress bar
      const percent = (completed / files.length) * 100;
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

      if (errorCount > 0) {
        showToast(`Completed with ${errorCount} errors`, 'warning');
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

  elements.historyList.innerHTML = entries.map(entry => `
    <div class="history-item">
      <div class="history-status ${entry.status}"></div>
      <div class="history-info">
        <div class="history-file">${entry.inputPath.split('\\').pop()}</div>
        <div class="history-meta">
          <span>${new Date(entry.createdAt).toLocaleString()}</span>
          <span>${entry.status}</span>
          ${entry.attempts > 1 ? `<span>${entry.attempts} attempts</span>` : ''}
        </div>
      </div>
      <div class="history-actions">
        ${entry.status === 'success' && entry.outputPath ? `
          <button class="btn btn-ghost btn-sm" onclick="previewVideo('${entry.outputPath.replace(/\\/g, '\\\\')}')">
            Preview
          </button>
          <button class="btn btn-ghost btn-sm" onclick="window.api.openFolder('${entry.outputPath.replace(/\\/g, '\\\\').replace(/[^\\]+$/, '')}')">
            Open Folder
          </button>
        ` : ''}
        ${entry.status === 'failed' ? `
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
  `).join('');
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
  renderFiles();
  showToast(`Added "${fileName}" for retry`, 'info');
}

// Retry all failed files in current queue
function retryFailedFiles() {
  const failedFiles = files.filter(f => f.status === 'error');
  if (failedFiles.length === 0) {
    showToast('No failed files to retry', 'info');
    return;
  }

  // Reset failed files to pending
  failedFiles.forEach(f => {
    f.status = 'pending';
    f.progress = 0;
  });

  renderFiles();
  showToast(`${failedFiles.length} file(s) queued for retry`, 'success');
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
    headless: elements.settingHeadless.checked
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
// Initialize
// ============================================

init();
