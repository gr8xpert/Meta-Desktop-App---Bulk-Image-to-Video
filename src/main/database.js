const fs = require('fs');
const path = require('path');

class Database {
  constructor(dbPath) {
    // Use JSON file instead of SQLite for easier portability
    this.dbPath = dbPath.replace('.db', '.json');
    this.data = { entries: [] };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, 'utf8');
        this.data = JSON.parse(content);
      }
    } catch (e) {
      console.error('Failed to load database:', e);
      this.data = { entries: [] };
    }
  }

  _save() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('Failed to save database:', e);
    }
  }

  addEntry(entry) {
    const newEntry = {
      id: Date.now(),
      inputPath: entry.inputPath,
      outputPath: entry.outputPath || null,
      status: entry.status,
      error: entry.error || null,
      prompt: entry.prompt || null,
      attempts: entry.attempts || 1,
      type: entry.type || 'video',  // 'video' or 'tti'
      aspectRatio: entry.aspectRatio || null,
      videoUrl: entry.videoUrl || null,
      createdAt: new Date().toISOString()
    };

    this.data.entries.unshift(newEntry); // Add to beginning

    // Keep only last 1000 entries
    if (this.data.entries.length > 1000) {
      this.data.entries = this.data.entries.slice(0, 1000);
    }

    this._save();
    return newEntry;
  }

  getEntries(options = {}) {
    const { limit = 100, offset = 0, status, search } = options;

    let filtered = this.data.entries;

    if (status && status !== 'all') {
      if (status === 'tti') {
        // Filter by type instead of status
        filtered = filtered.filter(e => e.type === 'tti');
      } else {
        filtered = filtered.filter(e => e.status === status);
      }
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(e =>
        (e.inputPath && e.inputPath.toLowerCase().includes(searchLower)) ||
        (e.outputPath && e.outputPath.toLowerCase().includes(searchLower)) ||
        (e.prompt && e.prompt.toLowerCase().includes(searchLower))
      );
    }

    return filtered.slice(offset, offset + limit);
  }

  getStats() {
    const entries = this.data.entries;
    return {
      total: entries.length,
      success: entries.filter(e => e.status === 'success').length,
      failed: entries.filter(e => e.status === 'failed').length,
      skipped: entries.filter(e => e.status === 'skipped').length
    };
  }

  clear() {
    this.data.entries = [];
    this._save();
    return true;
  }

  close() {
    // No-op for JSON storage
  }
}

module.exports = { Database };
