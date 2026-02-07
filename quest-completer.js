/**
 * Discord Quest Auto-Complete
 * 
 * Automatically completes Discord quests by simulating watch time and activity.
 * 
 * Features:
 * - Auto-detection of webpack structure
 * - Multiple quest processing
 * - Real-time visual dashboard
 * - Browser notifications
 * - Stealth mode (randomized timings)
 * - Rate limit detection
 * - Statistics tracking
 * 
 * Usage: Paste this script in Discord's DevTools console (Ctrl+Shift+I)
 */

(function () {
    'use strict';

    const CONFIG = {
        features: {
            notifications: true,
            dashboard: true,
            stealthMode: true,
            autoSave: true,
        },

        supportedTasks: [
            "WATCH_VIDEO",
            "PLAY_ON_DESKTOP",
            "STREAM_ON_DESKTOP",
            "PLAY_ACTIVITY",
            "WATCH_VIDEO_ON_MOBILE"
        ],

        stealth: {
            minSpeed: 5,
            maxSpeed: 9,
            randomPauseChance: 0.1,
            pauseMinDuration: 3000,
            pauseMaxDuration: 8000,
        },

        retry: {
            maxAttempts: 3,
            baseDelay: 2000,
        },

        filters: {
            priorityApps: [],
            skipApps: [],
            maxMinutesPerQuest: 60,
        },

        autoCheck: {
            enabled: true,
            interval: 30000,
        },

        debug: {
            enabled: false,
            verbose: false,
        }
    };

    class Statistics {
        constructor() {
            this.loadFromStorage();
        }

        loadFromStorage() {
            let saved = null;
            try {
                if (typeof localStorage !== 'undefined') {
                    saved = localStorage.getItem('questStats');
                }
            } catch (e) { }

            if (saved) {
                Object.assign(this, JSON.parse(saved));
            } else {
                this.questsCompleted = 0;
                this.questsFailed = 0;
                this.totalTimeSpent = 0;
                this.history = [];
                this.startTime = Date.now();
            }
        }

        save() {
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('questStats', JSON.stringify(this));
                }
            } catch (e) { }
        }

        addCompleted(questName, timeSpent) {
            this.questsCompleted++;
            this.totalTimeSpent += timeSpent;
            this.history.push({
                name: questName,
                status: 'completed',
                time: new Date().toISOString(),
                duration: timeSpent
            });
            this.save();
        }

        addFailed(questName, error) {
            this.questsFailed++;
            this.history.push({
                name: questName,
                status: 'failed',
                time: new Date().toISOString(),
                error: error
            });
            this.save();
        }

        getReport() {
            const totalMinutes = Math.floor(this.totalTimeSpent / 60);
            const avgTime = this.questsCompleted > 0
                ? Math.floor(this.totalTimeSpent / this.questsCompleted / 60)
                : 0;

            return `
📊 QUEST STATISTICS
━━━━━━━━━━━━━━━━━━━━━━
✅ Completed: ${this.questsCompleted}
❌ Failed: ${this.questsFailed}
⏱️  Total time: ${totalMinutes} minutes
📈 Average time: ${avgTime} min/quest
📅 Last quest: ${this.history[this.history.length - 1]?.name || 'N/A'}
🕐 Session started: ${new Date(this.startTime).toLocaleString()}
            `.trim();
        }

        reset() {
            this.questsCompleted = 0;
            this.questsFailed = 0;
            this.totalTimeSpent = 0;
            this.history = [];
            this.startTime = Date.now();
            this.save();
        }
    }

    class Logger {
        static colors = {
            INFO: '#4CAF50',
            WARN: '#FF9800',
            ERROR: '#F44336',
            SUCCESS: '#00BCD4',
            DEBUG: '#9C27B0'
        };

        static log(msg, type = 'INFO') {
            const timestamp = new Date().toLocaleTimeString();
            const color = this.colors[type] || this.colors.INFO;
            console.log(`%c[${timestamp}] [${type}] ${msg}`, `color: ${color}; font-weight: bold;`);
        }

        static info(msg) { this.log(msg, 'INFO'); }
        static warn(msg) { this.log(msg, 'WARN'); }
        static error(msg) { this.log(msg, 'ERROR'); }
        static success(msg) { this.log(msg, 'SUCCESS'); }
        static debug(msg) {
            if (CONFIG.debug.enabled) this.log(msg, 'DEBUG');
        }
    }

    class Notifier {
        static async init() {
            if (!CONFIG.features.notifications) return;

            if (typeof Notification !== 'undefined' && Notification.permission === "default") {
                await Notification.requestPermission();
            }
        }

        static notify(title, message, icon = 'https://discord.com/assets/favicon.ico') {
            if (!CONFIG.features.notifications) return;

            if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
                new Notification(title, { body: message, icon });
            }
        }
    }

    class Dashboard {
        static create() {
            if (!CONFIG.features.dashboard) return;
            if (typeof document === 'undefined') return;

            const existing = document.getElementById('quest-dashboard');
            if (existing) existing.remove();

            if (!document.getElementById('quest-styles')) {
                const styleSheet = document.createElement("style");
                styleSheet.id = 'quest-styles';
                styleSheet.innerText = `
                    @keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(88, 101, 242, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(88, 101, 242, 0); } 100% { box-shadow: 0 0 0 0 rgba(88, 101, 242, 0); } }
                    .quest-btn { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; font-family: 'gg sans', system-ui, sans-serif; }
                    .quest-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); filter: brightness(1.1); }
                    .quest-btn:active { transform: translateY(0); filter: brightness(0.9); }
                `;
                document.head.appendChild(styleSheet);
            }

            const dashboard = document.createElement('div');
            dashboard.id = 'quest-dashboard';
            dashboard.style.cssText = `
                position: fixed;
                top: 24px;
                right: 24px;
                background: rgba(10, 10, 15, 0.6);
                color: #e0e0e0;
                padding: 24px;
                border-radius: 16px;
                z-index: 99999;
                font-family: 'gg sans', 'Segoe UI', system-ui, sans-serif;
                width: 320px;
                box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.12);
                backdrop-filter: blur(24px) saturate(180%);
                -webkit-backdrop-filter: blur(24px) saturate(180%);
                animation: slideIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
            `;

            dashboard.innerHTML = `
                <div id="quest-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; cursor: move; user-select: none;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 8px; height: 8px; background: #5865F2; border-radius: 50%; box-shadow: 0 0 12px #5865F2; animation: pulse 2s infinite;"></div>
                        <h3 style="margin: 0; font-size: 14px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #fff;">Quest Completer</h3>
                    </div>
                    <button id="close-dashboard" style="background: transparent; border: none; color: #72767d; padding: 4px; cursor: pointer; font-size: 18px; line-height: 1;">×</button>
                </div>

                <div id="quest-status" style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.05);">
                    <p style="margin: 0; color: #96989d; font-size: 13px; font-weight: 500;">Waiting for quests...</p>
                </div>

                <div style="display: flex; gap: 10px; margin-bottom: 0;">
                    <button id="pause-btn" class="quest-btn" style="flex: 1; background: #5865F2; border: none; color: white; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">⏸️ Pause</button>
                    <button id="stats-btn" class="quest-btn" style="flex: 1; background: #4f545c; border: none; color: white; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">📊 Stats</button>
                </div>
                
                <div id="queue-info" style="margin-top: 12px; font-size: 11px; color: #5c5e66; text-align: center; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
                    Queue: 0 quests
                </div>
            `;

            document.body.appendChild(dashboard);

            document.getElementById('close-dashboard').onclick = () => {
                dashboard.style.opacity = '0';
                dashboard.style.transform = 'translateY(-20px)';
                setTimeout(() => dashboard.remove(), 300);
            };

            document.getElementById('pause-btn').onclick = () => {
                window.questManager.togglePause();
            };

            document.getElementById('stats-btn').onclick = () => {
                Logger.info(window.stats.getReport());
                alert(window.stats.getReport());
            };

            // Drag functionality
            const header = document.getElementById('quest-header');
            let isDragging = false;
            let currentX, currentY, initialX, initialY;
            let xOffset = 0, yOffset = 0;

            header.addEventListener("mousedown", dragStart);
            document.addEventListener("mouseup", dragEnd);
            document.addEventListener("mousemove", drag);

            function dragStart(e) {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
                if (e.target === header || header.contains(e.target)) {
                    if (e.target.id === 'close-dashboard') return;
                    isDragging = true;
                }
            }

            function dragEnd() {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
            }

            function drag(e) {
                if (isDragging) {
                    e.preventDefault();
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                    xOffset = currentX;
                    yOffset = currentY;
                    dashboard.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
                    dashboard.style.animation = 'none';
                }
            }
        }

        static update(questName, progress, total, queued = 0) {
            if (typeof document === 'undefined') return;
            const status = document.getElementById('quest-status');
            const queueInfo = document.getElementById('queue-info');

            if (!status) return;

            const percent = Math.floor((progress / total) * 100);
            const remaining = Math.ceil((total - progress) / 60);

            status.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 700; font-size: 13px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${questName}</span>
                    <span style="font-size: 12px; color: #b9bbbe; font-family: monospace;">${percent}%</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="background: linear-gradient(90deg, #5865F2, #4752C4); width: ${percent}%; height: 100%; box-shadow: 0 0 10px rgba(88, 101, 242, 0.4); transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #96989d; font-weight: 500;">
                    <span>⏱️ ${progress}s / ${total}s</span>
                    <span>~${remaining} min</span>
                </div>
            `;

            if (queueInfo) {
                queueInfo.textContent = `QUEUE: ${queued} QUEST${queued !== 1 ? 'S' : ''}`;
            }
        }

        static setStatus(message) {
            if (typeof document === 'undefined') return;
            const status = document.getElementById('quest-status');
            if (status) {
                status.innerHTML = `<p style="margin: 0; opacity: 0.8;">${message}</p>`;
            }
        }

        static updatePauseButton(paused) {
            if (typeof document === 'undefined') return;
            const btn = document.getElementById('pause-btn');
            if (btn) {
                btn.innerHTML = paused ? '▶️ Resume' : '⏸️ Pause';
            }
        }
    }

    class Utils {
        static randomDelay(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        static async retryRequest(fn, maxRetries = CONFIG.retry.maxAttempts) {
            for (let i = 0; i < maxRetries; i++) {
                try {
                    return await fn();
                } catch (e) {
                    if (i === maxRetries - 1) throw e;
                    const delay = CONFIG.retry.baseDelay * Math.pow(2, i);
                    Logger.warn(`Attempt ${i + 1}/${maxRetries} failed, waiting ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        static estimateTimeRemaining(quests, supportedTasks) {
            let totalSeconds = 0;

            quests.forEach(q => {
                const taskConfig = q.config.taskConfig ?? q.config.taskConfigV2;
                const taskName = supportedTasks.find(x => taskConfig.tasks[x] != null);
                if (!taskName) return;

                const needed = taskConfig.tasks[taskName].target;
                const done = q.userStatus?.progress?.[taskName]?.value ?? 0;
                totalSeconds += (needed - done);
            });

            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);

            return { totalSeconds, hours, minutes };
        }

        static saveState(state) {
            if (!CONFIG.features.autoSave) return;
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('questState', JSON.stringify({
                        ...state,
                        timestamp: Date.now()
                    }));
                }
            } catch (e) { }
        }

        static loadState() {
            try {
                if (typeof localStorage === 'undefined') return null;
                const saved = localStorage.getItem('questState');
                if (!saved) return null;

                const state = JSON.parse(saved);
                const age = Date.now() - state.timestamp;

                if (age > 3600000) {
                    localStorage.removeItem('questState');
                    return null;
                }

                return state;
            } catch (e) {
                return null;
            }
        }
    }

    class QuestManager {
        constructor(api, stores) {
            this.api = api;
            this.stores = stores;
            this.quests = [];
            this.processedIds = new Set();
            this.currentQuest = null;
            this.paused = false;
            this.isApp = typeof DiscordNative !== "undefined";
            this.rateLimitHits = 0;
        }

        async initialize() {
            Logger.info('🚀 Initializing Quest Manager...');
            Logger.info(`📱 Environment: ${this.isApp ? 'Discord Desktop App' : 'Browser (some quests may not work)'}`);

            await Notifier.init();

            if (CONFIG.features.dashboard) {
                Dashboard.create();
            }

            await this.loadQuests();

            if (CONFIG.autoCheck.enabled) {
                this.startAutoCheck();
            }

            const estimate = Utils.estimateTimeRemaining(this.quests, CONFIG.supportedTasks);
            Logger.info(`⏰ Estimated total time: ${estimate.hours}h ${estimate.minutes}m`);

            this.processNext();
        }

        async loadQuests() {
            try {
                const allQuests = [...this.stores.QuestsStore.quests.values()];

                this.quests = allQuests.filter(q =>
                    q.userStatus?.enrolledAt &&
                    !q.userStatus?.completedAt &&
                    new Date(q.config.expiresAt).getTime() > Date.now() &&
                    CONFIG.supportedTasks.find(t =>
                        (q.config.taskConfig ?? q.config.taskConfigV2).tasks[t] != null
                    ) &&
                    !CONFIG.filters.skipApps.includes(q.config.application.name)
                );

                const desktopOnlyTasks = ["PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP"];
                const skippedQuests = [];

                if (!this.isApp) {
                    this.quests = this.quests.filter(q => {
                        const taskConfig = q.config.taskConfig ?? q.config.taskConfigV2;
                        const taskName = CONFIG.supportedTasks.find(t => taskConfig.tasks[t] != null);

                        if (desktopOnlyTasks.includes(taskName)) {
                            skippedQuests.push({
                                name: q.config.messages.questName,
                                app: q.config.application.name,
                                type: taskName
                            });
                            return false;
                        }
                        return true;
                    });

                    if (skippedQuests.length > 0) {
                        Logger.warn(`⚠️ ${skippedQuests.length} quest(s) skipped (requires Discord Desktop App):`);
                        skippedQuests.forEach(q => {
                            Logger.warn(`   - ${q.name} (${q.app}) [${q.type}]`);
                        });
                    }
                }

                this.quests.sort((a, b) => {
                    const aPriority = CONFIG.filters.priorityApps.includes(a.config.application.name);
                    const bPriority = CONFIG.filters.priorityApps.includes(b.config.application.name);
                    return bPriority - aPriority;
                });

                Logger.success(`📋 ${this.quests.length} quest(s) loaded`);
                this.quests.forEach(q => this.processedIds.add(q.id));

            } catch (e) {
                Logger.error(`Failed to load quests: ${e.message}`);
            }
        }

        startAutoCheck() {
            setInterval(async () => {
                if (this.paused) return;

                try {
                    const allQuests = [...this.stores.QuestsStore.quests.values()];
                    const desktopOnlyTasks = ["PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP"];

                    const newQuests = allQuests.filter(q => {
                        if (this.processedIds.has(q.id)) return false;
                        if (!q.userStatus?.enrolledAt) return false;
                        if (q.userStatus?.completedAt) return false;
                        if (new Date(q.config.expiresAt).getTime() <= Date.now()) return false;

                        if (!this.isApp) {
                            const taskConfig = q.config.taskConfig ?? q.config.taskConfigV2;
                            const taskName = CONFIG.supportedTasks.find(t => taskConfig.tasks[t] != null);
                            if (desktopOnlyTasks.includes(taskName)) return false;
                        }

                        return true;
                    });

                    if (newQuests.length > 0) {
                        Logger.info(`🆕 ${newQuests.length} new quest(s) detected!`);
                        newQuests.forEach(q => {
                            this.quests.push(q);
                            this.processedIds.add(q.id);
                        });
                    }

                } catch (e) {
                    Logger.debug(`Auto-check error: ${e.message}`);
                }
            }, CONFIG.autoCheck.interval);
        }

        async processNext() {
            if (this.paused) {
                Dashboard.setStatus('⏸️ Paused');
                return;
            }

            const quest = this.quests.pop();

            if (!quest) {
                Logger.success('🎉 All quests completed!');
                Dashboard.setStatus('✅ All quests completed!');
                Notifier.notify('Quests Completed!', 'All quests have been processed successfully!');
                return;
            }

            this.currentQuest = quest;

            try {
                await this.processQuest(quest);
            } catch (e) {
                Logger.error(`Error processing quest: ${e.message}`);
                window.stats.addFailed(quest.config.application.name, e.message);
            }

            setTimeout(() => this.processNext(), 2000);
        }

        async processQuest(quest) {
            const startTime = Date.now();
            const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
            const taskName = CONFIG.supportedTasks.find(x => taskConfig.tasks[x] != null);
            const questName = quest.config.messages.questName;
            const applicationName = quest.config.application.name;
            const secondsNeeded = taskConfig.tasks[taskName].target;
            let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;

            Logger.info(`\n🎯 Starting: ${questName} (${applicationName})`);
            Logger.info(`📋 Type: ${taskName}`);
            Logger.info(`⏱️  Progress: ${secondsDone}/${secondsNeeded}s`);

            let processed = false;

            if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
                await this.processVideoQuest(quest, taskName, secondsNeeded, secondsDone, questName);
                processed = true;
            } else if (taskName === "PLAY_ON_DESKTOP") {
                if (!this.isApp) {
                    throw new Error('This quest requires Discord Desktop App!');
                }
                await this.processDesktopQuest(quest, secondsNeeded, secondsDone, applicationName);
                processed = true;
            } else if (taskName === "STREAM_ON_DESKTOP") {
                if (!this.isApp) {
                    throw new Error('This quest requires Discord Desktop App!');
                }
                await this.processStreamQuest(quest, secondsNeeded, secondsDone, applicationName);
                processed = true;
            } else if (taskName === "PLAY_ACTIVITY") {
                await this.processActivityQuest(quest, secondsNeeded, secondsDone, questName);
                processed = true;
            } else {
                throw new Error(`Unsupported quest type: ${taskName}`);
            }

            if (!processed) {
                throw new Error(`Quest was not processed correctly`);
            }

            const timeSpent = Math.floor((Date.now() - startTime) / 1000);
            window.stats.addCompleted(questName, timeSpent);

            Logger.success(`✅ Quest completed: ${questName}`);
            Notifier.notify('Quest Completed!', `${questName} was completed successfully!`);
        }

        async processVideoQuest(quest, taskName, secondsNeeded, secondsDone, questName) {
            const enrolledAt = new Date(quest.userStatus.enrolledAt).getTime();
            let completed = false;

            Logger.info(`🎬 Processing video for: ${questName}`);

            while (secondsDone < secondsNeeded && !this.paused) {
                const maxAllowed = Math.floor((Date.now() - enrolledAt) / 1000) + 10;

                const speed = CONFIG.stealth.stealthMode
                    ? Utils.randomDelay(CONFIG.stealth.minSpeed, CONFIG.stealth.maxSpeed)
                    : 7;

                const timestamp = secondsDone + speed;

                if (maxAllowed - secondsDone >= speed) {
                    const res = await this.safeAPICall(() =>
                        this.api.post({
                            url: `/quests/${quest.id}/video-progress`,
                            body: { timestamp: Math.min(secondsNeeded, timestamp + Math.random()) }
                        })
                    );

                    completed = res.body.completed_at != null;
                    secondsDone = Math.min(secondsNeeded, timestamp);

                    Dashboard.update(questName, secondsDone, secondsNeeded, this.quests.length);
                    Logger.debug(`Progress: ${secondsDone}/${secondsNeeded}s`);
                }

                if (CONFIG.stealth.stealthMode && Math.random() < CONFIG.stealth.randomPauseChance) {
                    const pauseDuration = Utils.randomDelay(
                        CONFIG.stealth.pauseMinDuration,
                        CONFIG.stealth.pauseMaxDuration
                    );
                    Logger.debug(`💤 Stealth pause: ${pauseDuration}ms`);
                    await new Promise(r => setTimeout(r, pauseDuration));
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (!completed && !this.paused) {
                await this.safeAPICall(() =>
                    this.api.post({
                        url: `/quests/${quest.id}/video-progress`,
                        body: { timestamp: secondsNeeded }
                    })
                );
            }
        }

        async processActivityQuest(quest, secondsNeeded, secondsDone, questName) {
            const channelId = this.stores.ChannelStore.getSortedPrivateChannels()[0]?.id ??
                Object.values(this.stores.GuildChannelStore.getAllGuilds())
                    .find(x => x != null && x.VOCAL?.length > 0)?.VOCAL[0].channel.id;

            const streamKey = `call:${channelId}:1`;

            Logger.info(`🎮 Processing activity for: ${questName}`);

            while (secondsDone < secondsNeeded && !this.paused) {
                const res = await this.safeAPICall(() =>
                    this.api.post({
                        url: `/quests/${quest.id}/heartbeat`,
                        body: { stream_key: streamKey, terminal: false }
                    })
                );

                secondsDone = res.body.progress.PLAY_ACTIVITY.value;
                Dashboard.update(questName, secondsDone, secondsNeeded, this.quests.length);

                await new Promise(resolve => setTimeout(resolve, 20000));
            }

            if (!this.paused) {
                await this.safeAPICall(() =>
                    this.api.post({
                        url: `/quests/${quest.id}/heartbeat`,
                        body: { stream_key: streamKey, terminal: true }
                    })
                );
            }
        }

        async processDesktopQuest(quest, secondsNeeded, secondsDone, applicationName) {
            const applicationId = quest.config.application.id;
            const pid = Math.floor(Math.random() * 30000) + 1000;

            Logger.info(`🎮 Spoofing game: ${applicationName}`);

            const appDataRes = await this.safeAPICall(() =>
                this.api.get({ url: `/applications/public?application_ids=${applicationId}` })
            );

            const appData = appDataRes.body[0];
            if (!appData || !appData.executables) {
                throw new Error(`Could not get application data for ${applicationName}`);
            }

            const exeData = appData.executables.find(x => x.os === "win32");
            if (!exeData) {
                throw new Error(`Windows executable not found for ${applicationName}`);
            }

            const exeName = exeData.name.replace(">", "");

            const fakeGame = {
                cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
                exeName,
                exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
                hidden: false,
                isLauncher: false,
                id: applicationId,
                name: appData.name,
                pid: pid,
                pidPath: [pid],
                processName: appData.name,
                start: Date.now(),
            };

            const realGames = this.stores.RunningGameStore.getRunningGames();
            const fakeGames = [fakeGame];
            const realGetRunningGames = this.stores.RunningGameStore.getRunningGames;
            const realGetGameForPID = this.stores.RunningGameStore.getGameForPID;

            this.stores.RunningGameStore.getRunningGames = () => fakeGames;
            this.stores.RunningGameStore.getGameForPID = (pid) => fakeGames.find(x => x.pid === pid);

            this.stores.FluxDispatcher.dispatch({
                type: "RUNNING_GAMES_CHANGE",
                removed: realGames,
                added: [fakeGame],
                games: fakeGames
            });

            Logger.success(`✅ Game spoofed: ${applicationName}. Wait ${Math.ceil((secondsNeeded - secondsDone) / 60)} minutes.`);

            return new Promise((resolve, reject) => {
                const questName = quest.config.messages.questName;
                let lastKnownProgress = secondsDone;
                let lastHeartbeatTime = Date.now();
                let isCompleted = false;
                let progressInterval = null;

                progressInterval = setInterval(() => {
                    if (isCompleted || this.paused) return;

                    const elapsed = Math.floor((Date.now() - lastHeartbeatTime) / 1000);
                    const estimatedProgress = Math.min(secondsNeeded, lastKnownProgress + elapsed);

                    Dashboard.update(questName, estimatedProgress, secondsNeeded, this.quests.length);
                }, 1000);

                const fn = (data) => {
                    try {
                        let progress = quest.config.configVersion === 1
                            ? data.userStatus.streamProgressSeconds
                            : Math.floor(data.userStatus.progress?.PLAY_ON_DESKTOP?.value ?? 0);

                        lastKnownProgress = progress;
                        lastHeartbeatTime = Date.now();

                        Logger.debug(`Real progress (heartbeat): ${progress}/${secondsNeeded}`);
                        Dashboard.update(questName, progress, secondsNeeded, this.quests.length);

                        if (progress >= secondsNeeded) {
                            isCompleted = true;
                            clearInterval(progressInterval);

                            this.stores.RunningGameStore.getRunningGames = realGetRunningGames;
                            this.stores.RunningGameStore.getGameForPID = realGetGameForPID;
                            this.stores.FluxDispatcher.dispatch({
                                type: "RUNNING_GAMES_CHANGE",
                                removed: [fakeGame],
                                added: [],
                                games: []
                            });
                            this.stores.FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                            resolve();
                        }
                    } catch (e) {
                        Logger.error(`Heartbeat error: ${e.message}`);
                    }
                };

                this.stores.FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);

                setTimeout(() => {
                    isCompleted = true;
                    clearInterval(progressInterval);
                    this.stores.RunningGameStore.getRunningGames = realGetRunningGames;
                    this.stores.RunningGameStore.getGameForPID = realGetGameForPID;
                    this.stores.FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                    reject(new Error('Timeout: quest took too long'));
                }, 30 * 60 * 1000);
            });
        }

        async processStreamQuest(quest, secondsNeeded, secondsDone, applicationName) {
            const applicationId = quest.config.application.id;
            const pid = Math.floor(Math.random() * 30000) + 1000;

            Logger.info(`📺 Spoofing stream: ${applicationName}`);

            const realFunc = this.stores.ApplicationStreamingStore.getStreamerActiveStreamMetadata;
            this.stores.ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
                id: applicationId,
                pid,
                sourceName: null
            });

            Logger.success(`✅ Stream spoofed: ${applicationName}. Stream any window in VC for ${Math.ceil((secondsNeeded - secondsDone) / 60)} minutes.`);
            Logger.info('⚠️ Remember: you need at least 1 other person in the VC!');

            return new Promise((resolve, reject) => {
                const questName = quest.config.messages.questName;
                let lastKnownProgress = secondsDone;
                let lastHeartbeatTime = Date.now();
                let isCompleted = false;
                let progressInterval = null;

                progressInterval = setInterval(() => {
                    if (isCompleted || this.paused) return;

                    const elapsed = Math.floor((Date.now() - lastHeartbeatTime) / 1000);
                    const estimatedProgress = Math.min(secondsNeeded, lastKnownProgress + elapsed);

                    Dashboard.update(questName, estimatedProgress, secondsNeeded, this.quests.length);
                }, 1000);

                const fn = (data) => {
                    try {
                        let progress = quest.config.configVersion === 1
                            ? data.userStatus.streamProgressSeconds
                            : Math.floor(data.userStatus.progress?.STREAM_ON_DESKTOP?.value ?? 0);

                        lastKnownProgress = progress;
                        lastHeartbeatTime = Date.now();

                        Logger.debug(`Real progress (heartbeat): ${progress}/${secondsNeeded}`);
                        Dashboard.update(questName, progress, secondsNeeded, this.quests.length);

                        if (progress >= secondsNeeded) {
                            isCompleted = true;
                            clearInterval(progressInterval);

                            this.stores.ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
                            this.stores.FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                            resolve();
                        }
                    } catch (e) {
                        Logger.error(`Heartbeat error: ${e.message}`);
                    }
                };

                this.stores.FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);

                setTimeout(() => {
                    isCompleted = true;
                    clearInterval(progressInterval);
                    this.stores.ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
                    this.stores.FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                    reject(new Error('Timeout: quest took too long'));
                }, 30 * 60 * 1000);
            });
        }

        async safeAPICall(fn) {
            try {
                const result = await Utils.retryRequest(fn);
                this.rateLimitHits = 0;
                return result;
            } catch (e) {
                if (e.status === 429) {
                    this.rateLimitHits++;
                    const delay = Math.min(30000, 1000 * Math.pow(2, this.rateLimitHits));
                    Logger.warn(`⚠️ Rate limited! Waiting ${delay / 1000}s...`);
                    await new Promise(r => setTimeout(r, delay));
                    return this.safeAPICall(fn);
                }
                throw e;
            }
        }

        togglePause() {
            this.paused = !this.paused;
            Logger.info(this.paused ? '⏸️ Paused' : '▶️ Resumed');
            Dashboard.updatePauseButton(this.paused);

            if (!this.paused) {
                this.processNext();
            }
        }
    }

    async function main() {
        try {
            Logger.info('🎮 Discord Quest Auto-Complete');
            Logger.info('================================');

            delete window.$;

            let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
            webpackChunkdiscord_app.pop();

            Logger.info('✅ Webpack loaded');

            let ApplicationStreamingStore = Object.values(wpRequire.c)
                .find(x => x?.exports?.Z?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.Z;

            let stores = {};

            if (!ApplicationStreamingStore) {
                Logger.info('🔄 Using alternative structure (.A, .Ay, .Bo, .h)');
                stores = {
                    ApplicationStreamingStore: Object.values(wpRequire.c)
                        .find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.A,
                    RunningGameStore: Object.values(wpRequire.c)
                        .find(x => x?.exports?.Ay?.getRunningGames)?.exports?.Ay,
                    QuestsStore: Object.values(wpRequire.c)
                        .find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A,
                    ChannelStore: Object.values(wpRequire.c)
                        .find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent)?.exports?.A,
                    GuildChannelStore: Object.values(wpRequire.c)
                        .find(x => x?.exports?.Ay?.getSFWDefaultChannel)?.exports?.Ay,
                    FluxDispatcher: Object.values(wpRequire.c)
                        .find(x => x?.exports?.h?.__proto__?.flushWaitQueue)?.exports?.h,
                };
                var api = Object.values(wpRequire.c)
                    .find(x => x?.exports?.Bo?.get)?.exports?.Bo;
            } else {
                Logger.info('✅ Using standard structure (.Z, .ZP, .tn)');
                stores = {
                    ApplicationStreamingStore,
                    RunningGameStore: Object.values(wpRequire.c)
                        .find(x => x?.exports?.ZP?.getRunningGames)?.exports?.ZP,
                    QuestsStore: Object.values(wpRequire.c)
                        .find(x => x?.exports?.Z?.__proto__?.getQuest)?.exports?.Z,
                    ChannelStore: Object.values(wpRequire.c)
                        .find(x => x?.exports?.Z?.__proto__?.getAllThreadsForParent)?.exports?.Z,
                    GuildChannelStore: Object.values(wpRequire.c)
                        .find(x => x?.exports?.ZP?.getSFWDefaultChannel)?.exports?.ZP,
                    FluxDispatcher: Object.values(wpRequire.c)
                        .find(x => x?.exports?.Z?.__proto__?.flushWaitQueue)?.exports?.Z,
                };
                var api = Object.values(wpRequire.c)
                    .find(x => x?.exports?.tn?.get)?.exports?.tn;
            }

            if (!stores.QuestsStore || !api) {
                throw new Error('Could not find required modules');
            }

            Logger.success('✅ All modules loaded');

            window.stats = new Statistics();
            window.questManager = new QuestManager(api, stores);
            await window.questManager.initialize();

            Logger.success('✅ System initialized successfully!');
            Logger.info('\n💡 Available commands:');
            Logger.info('   window.questManager.togglePause() - Pause/Resume');
            Logger.info('   window.stats.getReport() - View statistics');
            Logger.info('   window.stats.reset() - Reset statistics');

        } catch (e) {
            Logger.error(`❌ Fatal error: ${e.message}`);
            Logger.error(e.stack);
        }
    }

    main();

})();
