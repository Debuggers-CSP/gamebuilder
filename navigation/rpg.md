---
layout: opencs
title: RPG
permalink: /rpg/latest
---


<style>
.embedded .site-header,
.embedded .post-header,
.embedded .site-footer,
.embedded .page-description { display: none !important; }
.embedded body { margin: 0 !important; }
.embedded .page-content .wrapper { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
.embedded .page-content, .embedded .post-content, .embedded main, .embedded .page { margin: 0 !important; padding: 0 !important; }
html.embedded, html.embedded body { overflow: hidden !important; }


html, body { height: 100%; }
#gameContainer { width: 100%; height: 85vh; margin: 0; position: relative; }
.embedded #gameContainer { height: 100vh; position: fixed; top: 0; left: 0; right: 0; }
#gameCanvas { width: 100%; height: 100%; display: block; }


/* Ensure a black screen when the engine is not started */
#gameContainer, #gameCanvas { background: #000; }


/* Overlay to block interactions and ensure black screen when stopped */
#engine-blocker {
    position: absolute;
    inset: 0;
    background: #000;
    z-index: 10;
    display: none; /* shown when engine is stopped */
}


/* Hide Engine leaderboard when running inside Game Builder iframe */
.embedded .leaderboard-widget { display: none !important; visibility: hidden !important; }

/* Hide Engine HUD/scoreboard elements when embedded (used by GameBuilder) */
.embedded .pause-button-bar { display: none !important; }
.embedded .score-display { display: none !important; }
.embedded .score-counter { display: none !important; }
.embedded .stats-display { display: none !important; }
.embedded #scoreDisplay { display: none !important; }
.embedded #score { display: none !important; }
.embedded .hud { display: none !important; }
.embedded [id*="score" i] { display: none !important; }
.embedded [class*="score" i] { display: none !important; }


.custom-alert {
    display: none;
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
}


.custom-alert button {
    background-color: transparent; /* Fully transparent background */
    display: flex; /* Use flexbox for layout */
    align-items: center; /* Center items vertically */
    justify-content: center; /* Center items horizontally */
    width: 100%; /* Adjust width to fit content */
    height: 100%; /* Adjust height to fit content */
    position: absolute; /* Position the button relative to the alert box */
}


</style>


<script>
// Enable embed mode when inside an iframe or with ?embed=1
(function() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('embed') === '1' || window.self !== window.top) {
            document.documentElement.classList.add('embedded');
        }
    } catch (e) {
        // no-op
    }
})();


function closeCustomAlert() {
    try {
        const el = document.getElementById('custom-alert');
        if (el) el.style.display = 'none';
    } catch (_) {}
}
</script>


<div id="gameContainer">
    <canvas id='gameCanvas'></canvas>
    <div id="engine-blocker" aria-hidden="true"></div>
</div>


<div id="custom-alert" class="custom-alert">
    <button onclick="closeCustomAlert()" id="custom-alert-message"></button>
    </div>


<script type="module">
    const path = "{{site.baseurl}}";
    const origin = window.location.origin;


    // Dynamically resolve a working base prefix for assets (handles empty or mismatched baseurl)
    let basePrefix = null;
    async function ensureBasePrefix() {
        if (basePrefix) return basePrefix;
        const candidates = [];
        const siteBase = path || '';
        if (siteBase) candidates.push(`${origin}${siteBase}`);
        candidates.push(`${origin}`);
        // Derive first path segment (e.g., '/gamebuilder') if siteBase is empty
        try {
            const seg = '/' + (window.location.pathname.split('/').filter(Boolean)[0] || '');
            if (seg && seg !== '/') candidates.push(`${origin}${seg}`);
        } catch (_) {}
        // Deduplicate
        const uniq = [...new Set(candidates)];
        let lastErr = null;
        for (const cand of uniq) {
            try {
                // Probe multiple likely engine locations to detect a correct base
                const probes = [
                    `${cand}/assets/js/GameEngine/essentials/Game.js?v=${Date.now()}`,
                    `${cand}/assets/js/mansionGame/GameEngine/Game.js?v=${Date.now()}`,
                    `${cand}/assets/js/adventureGame/GameEngine/Game.js?v=${Date.now()}`
                ];
                let ok = false;
                let lastProbeErr = null;
                for (const testUrl of probes) {
                    try {
                        const res = await fetch(testUrl, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
                        const ctype = (res.headers.get('content-type') || '').toLowerCase();
                        const text = res.ok ? await res.text() : '';
                        if (!res.ok) {
                            lastProbeErr = new Error(`Probe failed: ${res?.status} @ ${testUrl}`);
                            continue;
                        }
                        // Reject HTML responses (which cause "Unexpected token '<'")
                        if (text.trim().startsWith('<')) {
                            lastProbeErr = new Error(`Probe returned HTML @ ${testUrl}`);
                            continue;
                        }
                        // Accept typical JS MIME types; if ambiguous but body isn't HTML, accept as well
                        if (ctype.includes('javascript') || ctype.includes('ecmascript') || ctype.includes('module') || ctype === '') {
                            basePrefix = cand; ok = true; break;
                        } else {
                            basePrefix = cand; ok = true; break;
                        }
                    } catch (probeErr) {
                        lastProbeErr = probeErr;
                    }
                }
                if (ok) return basePrefix;
                lastErr = lastProbeErr;
            } catch (e) {
                lastErr = e;
            }
        }
        // Fallback to origin + siteBase even if probe failed
        basePrefix = `${origin}${siteBase}`;
        console.warn('[RPG] Falling back to basePrefix:', basePrefix, 'Last probe error:', lastErr);
        return basePrefix;
    }


    // Proactively unregister any service workers to avoid stale/cached HTML
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const r of regs) { try { await r.unregister(); } catch (_) {} }
        } catch (_) {}
    }

    // Report environment metrics (offsets) to parent for overlay alignment
    function postEnvMetrics() {
        try {
            const el = document.getElementById('gameContainer');
            const rect = el?.getBoundingClientRect?.() || { top: 0, left: 0 };
            if (window && window.parent) {
                const w = el?.clientWidth || 0;
                const h = el?.clientHeight || 0;
                window.parent.postMessage({ type: 'rpg:env-metrics', top: rect.top || 0, left: rect.left || 0, width: w, height: h }, '*');
            }
        } catch (_) {}
    }
    window.addEventListener('resize', () => { postEnvMetrics(); });
    // Send initial metrics so overlays align before any resize
    try { postEnvMetrics(); } catch (_) {}


    // Lazy-load engine (Prefer GameEngine, fallback to Mansion engine)
    let EngineModule = null;
    let engineType = null; // 'gameengine' | 'mansion'
    async function loadEngine() {
        if (EngineModule) return EngineModule;
        // Prefer GameEngine first (present in this workspace), fallback to Mansion
        try {
            const prefix = await ensureBasePrefix();
            const primaryUrl = `${prefix}/assets/js/GameEngine/essentials/Game.js?v=${Date.now()}`;
            // Prefetch to validate MIME/content to avoid HTML imports
            try {
                const r = await fetch(primaryUrl, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
                const ct = (r.headers.get('content-type') || '').toLowerCase();
                const body = r.ok ? await r.text() : '';
                if (!r.ok || body.trim().startsWith('<') || !(ct.includes('javascript') || ct.includes('ecmascript') || ct.includes('module') || ct === '')) {
                    throw new Error(`GameEngine not served as JS (status ${r.status || 'unknown'})`);
                }
            } catch (prefetchErr) {
                throw prefetchErr;
            }
            const primaryMod = await import(primaryUrl);
            EngineModule = primaryMod?.default ?? primaryMod;
            engineType = 'gameengine';
            return EngineModule;
        } catch (eAdv) {
            console.warn('GameEngine load failed, trying Mansion engine:', eAdv);
            try {
                const prefix = await ensureBasePrefix();
                const mansionUrl = `${prefix}/assets/js/mansionGame/GameEngine/Game.js?v=${Date.now()}`;
                // Prefetch and validate Mansion engine too
                try {
                    const r = await fetch(mansionUrl, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
                    const ct = (r.headers.get('content-type') || '').toLowerCase();
                    const body = r.ok ? await r.text() : '';
                    if (!r.ok || body.trim().startsWith('<') || !(ct.includes('javascript') || ct.includes('ecmascript') || ct.includes('module') || ct === '')) {
                        throw new Error(`Mansion engine not served as JS (status ${r.status || 'unknown'})`);
                    }
                } catch (prefetchErr2) {
                    throw prefetchErr2;
                }
                const mansionMod = await import(mansionUrl);
                EngineModule = mansionMod?.default ?? mansionMod;
                engineType = 'mansion';
                return EngineModule;
            } catch (eBetter) {
                console.error('Both engine loads failed:', { gameEngineError: eAdv, mansionError: eBetter });
                throw eBetter;
            }
        }
    }


    // Explicit loader for Mansion engine (runtime fallback)
    async function loadMansionEngine() {
        try {
            const prefix = await ensureBasePrefix();
            const url = `${prefix}/assets/js/mansionGame/GameEngine/Game.js?v=${Date.now()}`;
            // Prefetch and validate response isn't HTML
            try {
                const r = await fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
                const ct = (r.headers.get('content-type') || '').toLowerCase();
                const body = r.ok ? await r.text() : '';
                if (!r.ok || body.trim().startsWith('<') || !(ct.includes('javascript') || ct.includes('ecmascript') || ct.includes('module') || ct === '')) {
                    throw new Error(`Mansion fallback not served as JS (status ${r.status || 'unknown'})`);
                }
            } catch (prefetchErr) {
                throw prefetchErr;
            }
            const mod = await import(url);
            EngineModule = mod?.default ?? mod;
            engineType = 'mansion';
            return EngineModule;
        } catch (e) {
            console.error('Failed to load Mansion engine fallback:', e);
            throw e;
        }
    }


    // Respect autostart query parameter (default: true)
    const params = new URLSearchParams(window.location.search);
    const autostartParam = (params.get('autostart') || '').toLowerCase();
    const autoStart = !(autostartParam === '0' || autostartParam === 'false' || autostartParam === 'no');


    // Blockers: prevent all input when engine inactive
    let engineActive = !!autoStart;
    const blockerEl = document.getElementById('engine-blocker');
    const blockEvents = [
        'keydown','keyup','keypress',
        'mousedown','mouseup','mousemove','contextmenu',
        'wheel','touchstart','touchmove','touchend','pointerdown','pointermove','pointerup'
    ];
    const handlers = new Map();


    function enableBlockers() {
        if (blockerEl) blockerEl.style.display = 'block';
        blockEvents.forEach(type => {
            if (!handlers.has(type)) {
                const h = (e) => { e.preventDefault(); e.stopPropagation(); };
                document.addEventListener(type, h, { capture: true, passive: false });
                handlers.set(type, h);
            }
        });
    }


    function disableBlockers() {
        if (blockerEl) blockerEl.style.display = 'none';
        handlers.forEach((h, type) => {
            document.removeEventListener(type, h, { capture: true });
        });
        handlers.clear();
    }


    // Try to import RPG GameControl dynamically (may not exist in this repo)
    async function tryStartDefault() {
        try {
            const mod = await import(`${origin}${path || ''}/assets/js/rpg/latest/GameControl.js?v=${Date.now()}`);
            const GameControl = mod?.default ?? mod?.GameControl ?? null;
            if (GameControl && typeof GameControl.start === 'function') {
                GameControl.start(path);
                return true;
            }
        } catch (e) {
            // GameControl not available; continue without autostart
            console.warn('RPG GameControl not found; running without default start.', e);
        }
        return false;
    }


    if (!engineActive) {
        enableBlockers();
    } else {
        // Start game engine by default, if RPG GameControl exists
        tryStartDefault().then((started) => {
            if (started) {
                disableBlockers();
            } else {
                enableBlockers();
            }
        });
    }


    // Track live engine instance (from code runner)
    let liveEngine = null;


    // Expose simple control handling for parent pages via postMessage
    let isPaused = false;
    window.addEventListener('message', (event) => {
        const data = event?.data;
        if (!data || data.type !== 'rpg:control') return;
        const action = data.action;
        try {
            switch (action) {
                case 'start':
                    if (document.documentElement.classList.contains('embedded')) {
                        // In embedded/live mode, parent will send rpg:run-code. No default turtle.
                        // Keep blockers until code arrives.
                        engineActive = false;
                        enableBlockers();
                        isPaused = false;
                    } else {
                        tryStartDefault().then((started) => {
                            engineActive = !!started;
                            if (started) disableBlockers(); else enableBlockers();
                            isPaused = false;
                        });
                    }
                    break;
                case 'pause':
                    if (liveEngine && liveEngine.gameControl && typeof liveEngine.gameControl.pause === 'function') {
                        liveEngine.gameControl.pause();
                        isPaused = true;
                    }
                    break;
                case 'resume':
                    if (liveEngine && liveEngine.gameControl && typeof liveEngine.gameControl.resume === 'function') {
                        liveEngine.gameControl.resume();
                        isPaused = false;
                    }
                    break;
                case 'stop':
                    // For consistency and clean teardown, reload.
                    location.reload();
                    engineActive = false;
                    // Ensure black screen and block all input
                    enableBlockers();
                    break;
                case 'reset':
                    // Reload resets the canvas/game state safely
                    location.reload();
                    break;
            }
        } catch (err) {
            console.error('Runner control error:', err);
        }
    });

    // Support simulated key events from GameBuilder
    window.addEventListener('message', (event) => {
        const d = event?.data;
        if (!d || d.type !== 'rpg:simulate-key') return;
        try {
            const evType = d.evType === 'keyup' ? 'keyup' : 'keydown';
            const evt = new KeyboardEvent(evType, { key: d.key || '', code: d.code || '', bubbles: true, cancelable: true });
            // Patch legacy keyCode/which getters for engines reading numeric codes
            try {
                Object.defineProperty(evt, 'keyCode', { get: () => (d.keyCode || 0) });
                Object.defineProperty(evt, 'which', { get: () => (d.keyCode || 0) });
            } catch (_) {}
            document.dispatchEvent(evt);
        } catch (e) {
            /* ignore */
        }
    });


    // Live code runner: accept code string, dynamic-import, and start engine
    window.addEventListener('message', async (event) => {
        const data = event?.data;
        if (!data || data.type !== 'rpg:run-code') return;
        let code = String(data.code || '');
        if (!code.trim()) return;
        try {
            // Show blockers during load
            enableBlockers();
            engineActive = false;


            // Rewrite import specifiers to fully-qualified URLs
            const origin = window.location.origin;
            await ensureBasePrefix();
            const basePrefixLocal = String(basePrefix || origin).replace(/\/+$/, '');
            // Static imports: import X from '/abs', import X from './rel'
            const fromAbsRe = /(from\s*["'])(\/[^"]+)(["'])/g; // import ... from '/x/y'
            const fromRelRe = /(from\s*["'])(\.{1,2}\/[^"]+)(["'])/g; // import ... from './x' or '../x'
            // Side-effect imports: import '/abs', import './rel' (no 'from')
            const bareImpAbsRe = /(import\s*["'])(\/[^"]+)(["'])/g; // import '/x/y'
            const bareImpRelRe = /(import\s*["'])(\.{1,2}\/[^"]+)(["'])/g; // import './x' or '../x'
            // Dynamic imports: import('/abs'), import('./rel')
            const dynImpAbsRe = /(import\(\s*["'])(\/[^"]+)(["']\s*\))/g; // import('/x/y')
            const dynImpRelRe = /(import\(\s*["'])(\.{1,2}\/[^"]+)(["']\s*\))/g; // import('./x') or import('../x')
            code = code
                // Absolute root paths
                .replace(fromAbsRe, (m, p1, p2, p3) => `${p1}${basePrefixLocal}${p2}${p3}`)
                .replace(bareImpAbsRe, (m, p1, p2, p3) => `${p1}${basePrefixLocal}${p2}${p3}`)
                .replace(dynImpAbsRe, (m, p1, p2, p3) => `${p1}${basePrefixLocal}${p2}${p3}`)
                // Relative paths -> prefix with base
                .replace(fromRelRe, (m, p1, p2, p3) => `${p1}${basePrefixLocal}/${p2}${p3}`)
                .replace(bareImpRelRe, (m, p1, p2, p3) => `${p1}${basePrefixLocal}/${p2}${p3}`)
                .replace(dynImpRelRe, (m, p1, p2, p3) => `${p1}${basePrefixLocal}/${p2}${p3}`)
                // Catch-all: any quoted root-absolute path becomes fully-qualified
                .replace(/(["'])(\/[^"']+)\1/g, (m, quote, abs) => `${quote}${basePrefixLocal}${abs}${quote}`);


            // Ensure engine is loaded before running
            const Engine = await loadEngine();


            // Extract and prefetch import specifiers to surface failing URLs early
            const specifiers = [];
            try {
                const fromList = [...code.matchAll(/from\s*["']([^"']+)["']/g)].map(m => m[1]);
                const dynImpList = [...code.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)].map(m => m[1]);
                const bareImpList = [...code.matchAll(/import\s*["']([^"']+)["']/g)].map(m => m[1]);
                specifiers.push(...fromList, ...dynImpList, ...bareImpList);
            } catch (_) {}
            const uniqSpecs = [...new Set(specifiers)].filter(s => /^https?:\/\//.test(s));
            for (const u of uniqSpecs) {
                try {
                    const r = await fetch(u, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
                    const ct = (r.headers.get('content-type') || '').toLowerCase();
                    const body = r.ok ? await r.text() : '';
                    if (!r.ok || body.trim().startsWith('<') || !(ct.includes('javascript') || ct.includes('ecmascript') || ct.includes('module') || ct === '')) {
                        throw new Error(`Import check failed for ${u} (status ${r.status || 'unknown'})`);
                    }
                } catch (prefErr) {
                    const el = document.getElementById('custom-alert');
                    const msgBtn = document.getElementById('custom-alert-message');
                    if (el && msgBtn) {
                        msgBtn.textContent = `Error: ${prefErr.message}`;
                        el.style.display = 'block';
                        disableBlockers();
                    }
                    return;
                }
            }

            // Create module blob and import
            // Helpful source name for better error stacks in devtools
            const sourceNamedCode = `${code}\n//# sourceURL=gamebuilder-live-code.js`;
            // Use a widely supported MIME for module import of Blob
            const blob = new Blob([sourceNamedCode], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            let mod = null;
            try {
                mod = await import(url);
            } finally {
                URL.revokeObjectURL(url);
            }


            const env = {
                path,
                gameContainer: document.getElementById('gameContainer'),
                gameCanvas: document.getElementById('gameCanvas'),
                pythonURI: '',
                javaURI: '',
                fetchOptions: {}
            };


            let levelClasses = Array.isArray(mod.gameLevelClasses)
                ? mod.gameLevelClasses
                : Array.isArray(mod?.default?.gameLevelClasses)
                ? mod.default.gameLevelClasses
                : [];
            if (!levelClasses.length) {
                const candidates = [];
                if (typeof mod?.default === 'function') candidates.push(mod.default);
                if (typeof mod.CustomLevel === 'function') candidates.push(mod.CustomLevel);
                try {
                    Object.keys(mod || {}).forEach(k => {
                        if (k !== 'default' && /Level$/i.test(k) && typeof mod[k] === 'function') {
                            candidates.push(mod[k]);
                        }
                    });
                } catch (_) {}
                if (candidates.length) levelClasses = [candidates[0]];
            }


            try {
                console.debug('[Runner] Module export diagnostics', {
                    hasNamedGameLevelClasses: Array.isArray(mod?.gameLevelClasses),
                    hasDefaultGameLevelClasses: Array.isArray(mod?.default?.gameLevelClasses),
                    detectedLevelCount: levelClasses.length,
                    hasDefaultFunction: typeof mod?.default === 'function',
                    hasCustomLevel: typeof mod?.CustomLevel === 'function',
                    engineType
                });
            } catch (_) {}


            let started = false;
            let lastStartError = null;
            if (levelClasses.length > 0 && Engine && typeof Engine.main === 'function') {
                try {
                    if (engineType === 'mansion') {
                        const GameControlClass = mod.GameControl || mod?.default?.GameControl; // from user module
                        if (!GameControlClass) throw new Error('GameControl export required for Mansion engine');
                        const containerWidth = env.gameContainer?.clientWidth || window.innerWidth;
                        const containerHeight = Math.min(580, window.innerHeight);
                        env.innerWidth = containerWidth;
                        env.innerHeight = containerHeight;
                        env.gameLevelClasses = levelClasses;
                        try {
                            liveEngine = Engine.main(env, GameControlClass);
                        } catch (startErrBetter) {
                            lastStartError = startErrBetter;
                            throw startErrBetter;
                        }
                    } else {
                        // GameEngine expects environment with level classes
                        const containerWidth = env.gameContainer?.clientWidth || window.innerWidth;
                        const containerHeight = Math.min(580, window.innerHeight);
                        try {
                            liveEngine = Engine.main({
                            path: env.path,
                            gameContainer: env.gameContainer,
                            gameCanvas: env.gameCanvas,
                            pythonURI: env.pythonURI,
                            javaURI: env.javaURI,
                            fetchOptions: env.fetchOptions,
                            innerWidth: containerWidth,
                            innerHeight: containerHeight,
                            gameLevelClasses: levelClasses
                            });
                        } catch (startErrAdv) {
                            lastStartError = startErrAdv;
                            throw startErrAdv;
                        }
                    }
                    started = true;
                } catch (e) {
                    console.warn('Engine start failed, attempting Mansion fallback:', e);
                    try {
                        const Engine2 = await loadMansionEngine();
                        const containerWidth = env.gameContainer?.clientWidth || window.innerWidth;
                        const containerHeight = Math.min(580, window.innerHeight);
                        try {
                            liveEngine = Engine2.main({
                            path: env.path,
                            gameContainer: env.gameContainer,
                            gameCanvas: env.gameCanvas,
                            pythonURI: env.pythonURI,
                            javaURI: env.javaURI,
                            fetchOptions: env.fetchOptions,
                            innerWidth: containerWidth,
                            innerHeight: containerHeight,
                            gameLevelClasses: levelClasses
                            });
                        } catch (startErrFB) {
                            lastStartError = startErrFB;
                            throw startErrFB;
                        }
                        started = true;
                    } catch (ef) {
                        console.error('Mansion fallback failed:', ef);
                    }
                }
            }


            if (started) {
                engineActive = true;
                disableBlockers();
                postEnvMetrics();
            } else {
                const noLevels = !levelClasses || levelClasses.length === 0;
                const msg = noLevels
                    ? 'No levels detected. Export array `gameLevelClasses` or a default/named level class (e.g., `CustomLevel`).'
                    : `Engine start failed. ${lastStartError?.message ? 'Reason: ' + lastStartError.message : 'Check import paths and ensure assets exist under base.'} Base: ${basePrefix || (origin + (path || ''))}`;
                try {
                    const el = document.getElementById('custom-alert');
                    const msgBtn = document.getElementById('custom-alert-message');
                    if (el && msgBtn) {
                        msgBtn.textContent = msg;
                        el.style.display = 'block';
                        disableBlockers();
                    }
                } catch (_) {}
                return;
            }
        } catch (err) {
            console.error('Live code run error:', err);
            try { console.debug('[Runner] Code (first 1000 chars):', String(code || '').slice(0, 1000)); } catch (_) {}
            try {
                const el = document.getElementById('custom-alert');
                const msgBtn = document.getElementById('custom-alert-message');
                if (el && msgBtn) {
                    msgBtn.textContent = `Error: ${err.message || err}`;
                    el.style.display = 'block';
                    disableBlockers();
                }
            } catch (_) {}
        }
    });
 
    window.addEventListener('message', (event) => {
        const data = event?.data;
        if (!data || data.type !== 'rpg:simulate-key') return;
        try {
            const evType = data.evType === 'keyup' ? 'keyup' : 'keydown';
            const keyCode = Number(data.keyCode) || 0;
            const key = typeof data.key === 'string' ? data.key : undefined;
            const code = typeof data.code === 'string' ? data.code : undefined;
            const synth = new KeyboardEvent(evType, {
                keyCode,
                which: keyCode,
                key,
                code,
                bubbles: true,
                cancelable: true
            });
            const targets = [document, window, document.activeElement].filter(Boolean);
            targets.forEach(t => {
                try { t.dispatchEvent(synth); } catch (_) {}
            });
        } catch (e) {
            console.warn('simulate-key failed', e);
        }
    });


    window.addEventListener('message', (event) => {
        const data = event?.data;
        if (!data || data.type !== 'rpg:trigger-interact') return;
        try {
            const gc = liveEngine && liveEngine.gameControl;
            const handlers = gc && gc.globalInteractionHandlers ? Array.from(gc.globalInteractionHandlers) : [];
            handlers.forEach(h => {
                try {
                    if (typeof h.handleKeyInteract === 'function') {
                        h.handleKeyInteract();
                    } else if (typeof h.interact === 'function') {
                        h.interact.call(h);
                    }
                } catch (_) {}
            });
        } catch (e) {
            console.warn('trigger-interact failed', e);
        }
    });
</script>