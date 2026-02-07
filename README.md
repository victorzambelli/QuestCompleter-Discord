# Discord Quest Auto-Complete

Automatically completes Discord quests by simulating watch time and activity progress.

## Features

- ✅ Auto-detection of Discord's webpack structure
- ✅ Multiple quest processing with queue management
- ✅ Real-time visual dashboard (draggable)
- ✅ Browser notifications
- ✅ **Safety Mode** with anti-detection features
- ✅ Rate limit detection and automatic backoff
- ✅ Statistics tracking with persistent storage
- ✅ Pause/Resume functionality

## 🛡️ Safety Features

This script includes several safety measures to reduce detection risk:

| Feature | Description |
|---------|-------------|
| **Randomized Timing** | Progress speed varies between 5-12 seconds (not constant) |
| **API Jitter** | Random delays (100-500ms) added to API calls |
| **Random Breaks** | 5% chance of short breaks (10-45s) during processing |
| **Cooldown Between Quests** | 30-90 second delay between quests |
| **Session Limits** | Optional max quests per session |
| **Initial Delay** | 3-8 second delay before starting |
| **Humanized Progress** | Slight randomness in progress reporting |

### Safety Configuration

You can adjust safety settings in `CONFIG.safety`:

```javascript
CONFIG.safety = {
    maxQuestsPerSession: 3,        // Limit quests per session (0 = unlimited)
    cooldownBetweenQuests: {
        min: 60000,                // 1 minute minimum
        max: 180000,               // 3 minutes maximum
    },
    maxSessionDuration: 3600000,   // 1 hour max (0 = unlimited)
    randomBreaks: {
        enabled: true,
        chance: 0.1,               // 10% chance
        minDuration: 15000,        // 15 seconds
        maxDuration: 60000,        // 1 minute
    },
};
```

## Supported Quest Types

| Quest Type | Browser | Desktop App |
|------------|---------|-------------|
| WATCH_VIDEO | ✅ | ✅ |
| WATCH_VIDEO_ON_MOBILE | ✅ | ✅ |
| PLAY_ACTIVITY | ✅ | ✅ |
| PLAY_ON_DESKTOP | ❌ | ✅ |
| STREAM_ON_DESKTOP | ❌ | ✅ |

## Usage

1. Open Discord in your browser or Desktop App
2. Press `Ctrl + Shift + I` to open DevTools
3. Go to the **Console** tab
4. Copy and paste the contents of `quest-completer.js`
5. Press **Enter** to run

The dashboard will appear in the top-right corner with a **🛡️ SAFE MODE ACTIVE** indicator.

## Commands

```javascript
// Pause or resume quest processing
window.questManager.togglePause()

// View statistics
window.stats.getReport()

// Reset statistics
window.stats.reset()
```

## Best Practices for Safety

1. **Don't run 24/7** - Use the script occasionally, not continuously
2. **Set session limits** - Configure `maxQuestsPerSession` to 2-3 quests
3. **Use during normal hours** - Run during times you'd normally be online
4. **Take breaks** - Close and reopen Discord between sessions
5. **Don't stack scripts** - Only run one automation at a time

## Dashboard

```
┌─────────────────────────────┐
│ ● Quest Completer        ×  │
├─────────────────────────────┤
│ Quest Name                  │
│ ████████░░░░░░░░░ 45%       │
│ ⏱️ 270s / 600s    ~6 min    │
├─────────────────────────────┤
│ 🛡️ SAFE MODE ACTIVE         │
├─────────────────────────────┤
│ [⏸️ Pause]  [📊 Stats]      │
│       QUEUE: 2 QUESTS       │
└─────────────────────────────┘
```

## Disclaimer

> ⚠️ **Use at your own risk.** This script may violate Discord's Terms of Service. The author is not responsible for any consequences including but not limited to account suspension or termination.

Even with safety features enabled, there is no guarantee against detection. This tool is provided for educational purposes only.

## License

MIT License - See [LICENSE](LICENSE) for details.
