# Video Editor Tab - Implementation Plan

## Overview
Add a new "Video Editor" tab to Meta Video Converter with simple, easy-to-use video editing features including AI-powered captions.

---

## Features

### 1. Video Import & Timeline
- Drag & drop multiple video clips
- Visual timeline showing clips in order
- Drag to reorder clips
- Click to select/preview clip
- Trim clips (set start/end points)

### 2. Transitions (Between Clips)
- Optional transitions between clips
- Presets:
  - None (direct cut)
  - Fade (fade to black)
  - Dissolve (cross-fade)
  - Slide Left/Right
  - Wipe
  - Zoom
- Duration: 0.5s, 1s, 1.5s, 2s options

### 3. AI Captions (Whisper)
- One-click "Generate Captions" button
- Uses OpenAI Whisper locally (offline)
- Word-level timestamps for animations
- Edit captions text after generation
- Multiple languages support

### 4. Caption Style Templates
| Template | Style |
|----------|-------|
| **Minimal** | Clean white text, bottom center |
| **Bold Pop** | Large bold, words pop in |
| **Highlight** | Current word highlighted in color |
| **Box** | Text with background box |
| **Hormozi** | Big text, keywords colored |
| **Karaoke** | Words highlight as spoken |
| **Outline** | Bold text with outline |
| **Gradient** | Colorful gradient text |

### 5. Caption Customization
- Font selection (5-10 preset fonts)
- Text color (primary)
- Highlight color (for current word)
- Font size (Small, Medium, Large)
- Position (Top, Center, Bottom)
- Background box on/off

### 6. Background Music
- Add audio file (MP3, WAV)
- Volume slider for music
- Volume slider for original audio
- Fade in/out option

### 7. Export
- Output format: MP4 (H.264)
- Quality presets: Low, Medium, High, Original
- Resolution options: Original, 1080p, 720p, 480p
- Progress bar during export

---

## UI Design

### Tab Layout
```
┌─────────────────────────────────────────────────────────┐
│  [Video Editor Tab]                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────┐  ┌─────────────────────────┐   │
│  │                     │  │  Settings Panel          │   │
│  │   Video Preview     │  │                          │   │
│  │                     │  │  [Transitions ▼]         │   │
│  │   ▶ Play/Pause      │  │  [Captions    ▼]         │   │
│  │                     │  │  [Music       ▼]         │   │
│  └─────────────────────┘  │  [Export      ▼]         │   │
│                           └─────────────────────────┘   │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Timeline                                           │  │
│  │ [Clip 1] ◇ [Clip 2] ◇ [Clip 3] ◇ [Clip 4]        │  │
│  │          ↑ transition                              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ + Add Videos    [Clear All]    [Export Video]    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Settings Panel Sections (Collapsible)

**Transitions Section:**
```
┌─ Transitions ──────────────────┐
│ Style: [Fade        ▼]         │
│ Duration: ○0.5s ●1s ○1.5s ○2s  │
│ Apply to: ○All ○Selected       │
└────────────────────────────────┘
```

**Captions Section:**
```
┌─ AI Captions ──────────────────┐
│ [🎤 Generate Captions]         │
│                                │
│ Template: [Bold Pop    ▼]      │
│ Font: [Montserrat      ▼]      │
│ Size: ○S ●M ○L                 │
│ Position: ○Top ○Center ●Bottom │
│ Color: [■ White]               │
│ Highlight: [■ Yellow]          │
│ ☑ Background box               │
│                                │
│ [Edit Captions Text...]        │
└────────────────────────────────┘
```

**Music Section:**
```
┌─ Background Music ─────────────┐
│ [+ Add Music]  🎵 song.mp3  ✕  │
│                                │
│ Music Volume:    ────●──── 70% │
│ Original Audio:  ──●────── 50% │
│ ☑ Fade in/out                  │
└────────────────────────────────┘
```

**Export Section:**
```
┌─ Export ───────────────────────┐
│ Format: MP4 (H.264)            │
│ Quality: ○Low ●Medium ○High    │
│ Resolution: [1080p      ▼]     │
│                                │
│ [    Export Video    ]         │
└────────────────────────────────┘
```

---

## Technical Implementation

### Dependencies to Add

```json
{
  "dependencies": {
    "fluent-ffmpeg": "^2.1.2",
    "whisper-node": "^1.0.0"
  }
}
```

**FFmpeg Binary:**
- Bundle FFmpeg with the app (like Real-ESRGAN)
- Place in `assets/ffmpeg/`

**Whisper Model:**
- Download on first use (like Real-ESRGAN)
- Use `whisper.cpp` or `whisper-node`
- Model: `base` or `small` (good balance of speed/accuracy)
- Store in `assets/whisper/`

### File Structure

```
src/
├── main/
│   ├── main.js          # Add video editor IPC handlers
│   ├── video-editor.js  # NEW: Video processing logic
│   ├── whisper.js       # NEW: Whisper AI integration
│   └── captions.js      # NEW: Caption generation & styling
├── renderer/
│   ├── index.html       # Add Video Editor tab
│   ├── app.js           # Add video editor functions
│   └── styles.css       # Add video editor styles
assets/
├── ffmpeg/              # NEW: FFmpeg binaries
├── whisper/             # NEW: Whisper model files
└── fonts/               # NEW: Caption fonts
```

### IPC Handlers to Add

```javascript
// Video Editor
ipcMain.handle('add-video-clips', ...)      // Add clips to project
ipcMain.handle('get-video-info', ...)       // Get duration, resolution
ipcMain.handle('generate-thumbnail', ...)   // Thumbnail for timeline
ipcMain.handle('trim-video', ...)           // Set in/out points
ipcMain.handle('preview-video', ...)        // Generate preview

// Captions
ipcMain.handle('generate-captions', ...)    // Whisper transcription
ipcMain.handle('save-captions', ...)        // Save edited captions
ipcMain.handle('get-caption-templates', ...)// Get style presets

// Export
ipcMain.handle('export-video', ...)         // Final render
ipcMain.handle('cancel-export', ...)        // Cancel rendering
```

### Caption Template Format (ASS/SSA)

```ass
[Script Info]
Title: Styled Captions
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Alignment, MarginV
Style: BoldPop,Montserrat,48,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,1,0,2,30

[Events]
Format: Layer, Start, End, Style, Text
Dialogue: 0,0:00:01.00,0:00:02.00,BoldPop,{\fad(100,100)\t(\fs56)}This {\t(\fs48)}is {\c&H00FFFF&\t(\fs60)}AMAZING
```

---

## Implementation Steps

### Phase 1: Basic Video Editor (Week 1)
1. Create Video Editor tab UI
2. Add video import & timeline
3. Implement drag-to-reorder
4. Add video preview player
5. Implement clip trimming
6. Bundle FFmpeg

### Phase 2: Transitions (Week 1-2)
7. Add transition selector UI
8. Implement FFmpeg xfade filter
9. Add transition preview
10. Apply transitions to all/selected

### Phase 3: AI Captions (Week 2)
11. Integrate Whisper (download model)
12. Generate word-level timestamps
13. Create caption editor UI
14. Build caption templates (ASS format)
15. Preview captions on video

### Phase 4: Music & Export (Week 2-3)
16. Add music import
17. Implement audio mixing
18. Create export settings UI
19. Implement FFmpeg export pipeline
20. Add progress tracking

### Phase 5: Polish (Week 3)
21. Error handling
22. Loading states
23. Tooltips & help text
24. Performance optimization
25. Testing

---

## FFmpeg Commands Reference

### Merge Videos with Transition
```bash
ffmpeg -i clip1.mp4 -i clip2.mp4 -filter_complex \
  "[0][1]xfade=transition=fade:duration=1:offset=4" \
  output.mp4
```

### Add Styled Captions (ASS)
```bash
ffmpeg -i input.mp4 -vf "ass=captions.ass" output.mp4
```

### Add Background Music
```bash
ffmpeg -i video.mp4 -i music.mp3 -filter_complex \
  "[0:a]volume=0.5[a1];[1:a]volume=0.3[a2];[a1][a2]amix=inputs=2" \
  -c:v copy output.mp4
```

### Full Export Pipeline
```bash
ffmpeg -i merged.mp4 -i music.mp3 -filter_complex \
  "[0:a]volume=0.5[a1];[1:a]volume=0.3[a2];[a1][a2]amix=inputs=2[aout]" \
  -vf "ass=captions.ass" \
  -map 0:v -map "[aout]" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 192k \
  output.mp4
```

---

## Caption Templates Code

```javascript
const captionTemplates = {
  minimal: {
    name: 'Minimal',
    fontName: 'Arial',
    fontSize: 42,
    primaryColor: '&H00FFFFFF', // White
    outlineColor: '&H00000000', // Black
    outline: 2,
    shadow: 1,
    alignment: 2, // Bottom center
    bold: false,
    animation: 'fade'
  },
  boldPop: {
    name: 'Bold Pop',
    fontName: 'Montserrat',
    fontSize: 52,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    outline: 3,
    shadow: 0,
    alignment: 2,
    bold: true,
    animation: 'pop', // Scale animation
    highlightColor: '&H0000FFFF' // Yellow for current word
  },
  hormozi: {
    name: 'Hormozi',
    fontName: 'Impact',
    fontSize: 64,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    outline: 4,
    shadow: 2,
    alignment: 5, // Center
    bold: true,
    animation: 'none',
    keywordColor: '&H0000FF00' // Green for keywords
  },
  // ... more templates
};
```

---

## User Flow

1. **Import Videos**
   - Click "Add Videos" or drag & drop
   - Videos appear in timeline

2. **Arrange & Trim**
   - Drag clips to reorder
   - Double-click to trim

3. **Add Transitions** (Optional)
   - Select transition style
   - Set duration
   - Apply to all or selected

4. **Generate Captions** (Optional)
   - Click "Generate Captions"
   - Wait for AI processing
   - Select style template
   - Edit text if needed

5. **Add Music** (Optional)
   - Click "Add Music"
   - Adjust volume levels

6. **Export**
   - Select quality/resolution
   - Click "Export Video"
   - Wait for rendering

---

## Summary

| Feature | Complexity | Priority |
|---------|------------|----------|
| Video Import/Timeline | Medium | High |
| Clip Trimming | Medium | High |
| Transitions | Medium | High |
| AI Captions | High | High |
| Caption Templates | Medium | High |
| Background Music | Low | Medium |
| Export | Medium | High |

**Total Estimated Time:** 2-3 weeks

**Dependencies:**
- FFmpeg (bundled)
- Whisper model (downloaded on first use)
- Custom fonts (bundled)

---

## Next Steps

1. ✅ Plan approved
2. Create Video Editor tab UI (HTML/CSS)
3. Implement timeline component
4. Bundle FFmpeg
5. Integrate Whisper
6. Build caption templates
7. Implement export pipeline
8. Test & polish
