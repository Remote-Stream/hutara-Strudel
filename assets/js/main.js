
        /**
         * Main class for CyberSynth Strudel, managing sequencer, code editor, synth controls, and patterns.
         * @class
         */
        class CyberStrudel {
            constructor() {
                this.currentPattern = null;
                this.isPlaying = false;
                this.sequencerState = {
                    bd: Array(8).fill(false),
                    sd: Array(8).fill(false),
                    hh: Array(8).fill(false),
                    cp: Array(8).fill(false)
                };
                this.trackStates = {
                    bd: { muted: false, solo: false, steps: 8, sound: 'bd' },
                    sd: { muted: false, solo: false, steps: 8, sound: 'sd' },
                    hh: { muted: false, solo: false, steps: 8, sound: 'hh' },
                    cp: { muted: false, solo: false, steps: 8, sound: 'cp' }
                };
                this.synthParams = {
                    lpf: 800,
                    lpq: 1,
                    room: 0.5,
                    delay: 0.3,
                    bpm: 120,
                    bpmEnabled: true
                };
                this.mixedPatterns = {
                    presets: {},
                    tracks: {}
                };
                this.savedPatterns = new Map();
                this.strudelReady = false;
                this.history = [];
                this.historyIndex = -1;
                this.maxHistory = 50;
                this.strudelAPI = null;
                this.init();
            }
            async init() {
                try {
                    await this.initStrudel();
                    this.strudelReady = true;
                    this.setupSequencer();
                    this.setupEventListeners();
                    this.loadSavedData();
                    this.saveToHistory();
                    this.showNotification('CyberSynth Strudel initialized!', 'success');
                } catch (error) {
                    console.error('Initialization failed:', error);
                    this.showNotification('Failed to initialize. Check console for details.', 'error');
                }
            }
            async initStrudel() {
                try {
                    const { initStrudel, samples, setCps } = window.strudel;
                    this.strudelAPI = window.strudel;
                    await initStrudel({
                        prebake: async () => {
                            try {
                                await samples('github:tidalcycles/dirt-samples');
                            } catch (error) {
                                console.warn('Could not load default samples:', error);
                            }
                        }
                    });
                    if (setCps) {
                        setCps(this.synthParams.bpm / 60 / 4);
                    }
                } catch (error) {
                    throw new Error('Strudel initialization failed: ' + error.message);
                }
            }
            saveToHistory() {
                const state = JSON.parse(JSON.stringify({
                    sequencerState: this.sequencerState,
                    trackStates: this.trackStates,
                    code: document.getElementById('code-editor').value,
                    mixedPatterns: this.mixedPatterns,
                    synthParams: this.synthParams
                }));
                if (this.historyIndex < this.history.length - 1) {
                    this.history.splice(this.historyIndex + 1);
                }
                this.history.push(state);
                if (this.history.length > this.maxHistory) {
                    this.history.shift();
                }
                this.historyIndex = this.history.length - 1;
                this.updateUndoRedoButtons();
            }
            updateUndoRedoButtons() {
                document.getElementById('undo-btn').disabled = this.historyIndex <= 0;
                document.getElementById('redo-btn').disabled = this.historyIndex >= this.history.length - 1;
            }
            undo() {
                if (this.historyIndex <= 0) {
                    this.showNotification('Nothing to undo', 'error');
                    return;
                }
                this.historyIndex--;
                this.restoreState(this.history[this.historyIndex]);
                this.showNotification('Undo successful', 'success');
            }
            redo() {
                if (this.historyIndex >= this.history.length - 1) {
                    this.showNotification('Nothing to redo', 'error');
                    return;
                }
                this.historyIndex++;
                this.restoreState(this.history[this.historyIndex]);
                this.showNotification('Redo successful', 'success');
            }
            restoreState(state) {
                this.sequencerState = JSON.parse(JSON.stringify(state.sequencerState));
                this.trackStates = JSON.parse(JSON.stringify(state.trackStates));
                this.mixedPatterns = JSON.parse(JSON.stringify(state.mixedPatterns));
                this.synthParams = JSON.parse(JSON.stringify(state.synthParams));
                document.getElementById('code-editor').value = state.code || '';
                ['bd', 'sd', 'hh', 'cp'].forEach(track => {
                    document.getElementById(`${track}-steps`).value = this.trackStates[track].steps;
                    document.getElementById(`${track}-sound`).value = this.trackStates[track].sound;
                    this.updateSequencerTrack(track);
                    document.getElementById(`mute-${track}`).classList.toggle('active', this.trackStates[track].muted);
                    document.getElementById(`mute-${track}`).setAttribute('aria-pressed', this.trackStates[track].muted);
                    document.getElementById(`solo-${track}`).classList.toggle('active', this.trackStates[track].solo);
                    document.getElementById(`solo-${track}`).setAttribute('aria-pressed', this.trackStates[track].solo);
                    document.getElementById(`mix-${track}`).classList.toggle('active', !!this.mixedPatterns.tracks[track]);
                    document.getElementById(`mix-${track}`).setAttribute('aria-pressed', !!this.mixedPatterns.tracks[track]);
                });
                Object.keys(this.presets).forEach(key => {
                    document.getElementById(`mix-${key}`).checked = !!this.mixedPatterns.presets[key];
                    document.getElementById(`mix-preset-${key}`).classList.toggle('active', !!this.mixedPatterns.presets[key]);
                    document.getElementById(`mix-preset-${key}`).setAttribute('aria-pressed', !!this.mixedPatterns.presets[key]);
                });
                document.getElementById('lpf-freq').value = this.synthParams.lpf;
                document.getElementById('lpf-freq-value').textContent = `${this.synthParams.lpf} Hz`;
                document.getElementById('lpf-freq').setAttribute('aria-valuenow', this.synthParams.lpf);
                document.getElementById('lpq').value = this.synthParams.lpq;
                document.getElementById('lpq-value').textContent = this.synthParams.lpq;
                document.getElementById('lpq').setAttribute('aria-valuenow', this.synthParams.lpq);
                document.getElementById('room').value = this.synthParams.room;
                document.getElementById('room-value').textContent = this.synthParams.room;
                document.getElementById('room').setAttribute('aria-valuenow', this.synthParams.room);
                document.getElementById('delay').value = this.synthParams.delay;
                document.getElementById('delay-value').textContent = this.synthParams.delay;
                document.getElementById('delay').setAttribute('aria-valuenow', this.synthParams.delay);
                document.getElementById('bpm').value = this.synthParams.bpm;
                document.getElementById('bpm-value').textContent = this.synthParams.bpm;
                document.getElementById('bpm').setAttribute('aria-valuenow', this.synthParams.bpm);
                document.getElementById('bpm-enable').checked = this.synthParams.bpmEnabled;
                this.updateUndoRedoButtons();
                this.saveToLocalStorage();
            }
            setupSequencer() {
                ['bd', 'sd', 'hh', 'cp'].forEach(track => {
                    this.updateSequencerTrack(track);
                });
                this.adjustSequencerGrid();
                window.addEventListener('resize', () => this.adjustSequencerGrid());
            }
            adjustSequencerGrid() {
                const isSmallScreen = window.innerWidth <= 480;
                ['bd', 'sd', 'hh', 'cp'].forEach(track => {
                    const container = document.getElementById(`${track}-pattern`);
                    const stepCount = this.trackStates[track].steps;
                    container.style.gridTemplateColumns = `repeat(${isSmallScreen && stepCount > 8 ? 4 : stepCount}, 1fr)`;
                });
            }
            updateSequencerTrack(track) {
                const container = document.getElementById(`${track}-pattern`);
                const stepCount = this.trackStates[track].steps;
                container.innerHTML = '';
                const isSmallScreen = window.innerWidth <= 480;
                container.style.gridTemplateColumns = `repeat(${isSmallScreen && stepCount > 8 ? 4 : stepCount}, 1fr)`;
                for (let i = 0; i < stepCount; i++) {
                    const step = document.createElement('div');
                    step.className = 'step';
                    step.textContent = i + 1;
                    step.dataset.track = track;
                    step.dataset.step = i;
                    step.setAttribute('role', 'button');
                    step.setAttribute('aria-label', `Step ${i + 1} for ${track}`);
                    step.tabIndex = 0;
                    step.addEventListener('click', () => this.toggleStep(track, i));
                    step.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            this.toggleStep(track, i);
                            e.preventDefault();
                        }
                    });
                    container.appendChild(step);
                }
                this.updateSequencerUI(track);
            }
            toggleStep(track, index) {
                this.saveToHistory();
                this.sequencerState[track][index] = !this.sequencerState[track][index];
                this.updateSequencerUI(track);
                if (this.mixedPatterns.tracks[track]) {
                    this.updateMixedCode();
                }
                this.saveToLocalStorage();
            }
            updateSequencerUI(track) {
                const container = document.getElementById(`${track}-pattern`);
                const isSoloActive = Object.values(this.trackStates).some(state => state.solo);
                const isEnabled = !isSoloActive || this.trackStates[track].solo;
                const stepCount = this.trackStates[track].steps;
                for (let i = 0; i < stepCount; i++) {
                    const step = container.children[i];
                    if (step) {
                        const active = this.sequencerState[track][i];
                        step.classList.toggle('active', active && isEnabled && !this.trackStates[track].muted);
                        step.setAttribute('aria-pressed', active);
                        step.style.opacity = isEnabled && !this.trackStates[track].muted ? '1' : '0.5';
                    }
                }
            }
            setupEventListeners() {
                const debounce = (fn, delay) => {
                    let timeout;
                    return (...args) => {
                        clearTimeout(timeout);
                        timeout = setTimeout(() => fn(...args), delay);
                    };
                };
                document.getElementById('play-btn').addEventListener('click', () => this.togglePlayback());
                document.getElementById('stop-btn').addEventListener('click', () => this.stop());
                document.getElementById('stop-code-btn').addEventListener('click', () => this.stop());
                document.getElementById('undo-btn').addEventListener('click', () => this.undo());
                document.getElementById('redo-btn').addEventListener('click', () => this.redo());
                document.getElementById('evaluate-btn').addEventListener('click', () => this.evaluateCode());
                document.getElementById('clear-code-btn').addEventListener('click', () => {
                    this.saveToHistory();
                    document.getElementById('code-editor').value = '';
                    this.mixedPatterns = { presets: {}, tracks: {} };
                    ['bd', 'sd', 'hh', 'cp'].forEach(track => {
                        document.getElementById(`mix-${track}`).classList.remove('active');
                        document.getElementById(`mix-${track}`).setAttribute('aria-pressed', 'false');
                    });
                    Object.keys(this.presets).forEach(key => {
                        document.getElementById(`mix-${key}`).checked = false;
                        document.getElementById(`mix-preset-${key}`).classList.remove('active');
                        document.getElementById(`mix-preset-${key}`).setAttribute('aria-pressed', 'false');
                    });
                    this.saveToLocalStorage();
                    this.showNotification('Code cleared', 'success');
                });
                document.getElementById('save-code-btn').addEventListener('click', () => this.saveCode());
                document.getElementById('load-code-btn').addEventListener('click', () => this.loadCode());
                document.getElementById('code-editor').addEventListener('input', debounce(() => {
                    this.saveToHistory();
                    this.saveToLocalStorage();
                }, 500));
                ['bd', 'sd', 'hh', 'cp'].forEach(track => {
                    document.getElementById(`mute-${track}`).addEventListener('click', () => {
                        this.saveToHistory();
                        this.toggleMute(track);
                    });
                    document.getElementById(`solo-${track}`).addEventListener('click', () => {
                        this.saveToHistory();
                        this.toggleSolo(track);
                    });
                    document.getElementById(`mix-${track}`).addEventListener('click', () => {
                        this.saveToHistory();
                        this.mixTrack(track);
                    });
                    document.getElementById(`random-${track}`).addEventListener('click', () => {
                        this.saveToHistory();
                        this.randomizeTrack(track);
                    });
                    document.getElementById(`generate-${track}`).addEventListener('click', () => this.generateTrackCode(track));
                    document.getElementById(`${track}-steps`).addEventListener('change', (e) => {
                        this.saveToHistory();
                        this.changeStepCount(track, parseInt(e.target.value));
                    });
                    document.getElementById(`${track}-sound`).addEventListener('change', (e) => {
                        this.saveToHistory();
                        this.changeTrackSound(track, e.target.value);
                    });
                });
                document.getElementById('sequencer-random').addEventListener('click', () => {
                    this.saveToHistory();
                    this.randomizeSequencer();
                });
                document.getElementById('sequencer-clear').addEventListener('click', () => {
                    this.saveToHistory();
                    this.clearSequencer();
                });
                document.getElementById('sequencer-generate').addEventListener('click', () => this.generateSequencerCode());
                const updateSynthSlider = (id, param, unit = '') => {
                    const slider = document.getElementById(id);
                    slider.addEventListener('input', debounce((e) => {
                        this.synthParams[param] = parseFloat(e.target.value);
                        document.getElementById(`${id}-value`).textContent = `${this.synthParams[param]}${unit}`;
                        slider.setAttribute('aria-valuenow', this.synthParams[param]);
                        this.saveToLocalStorage();
                    }, 100));
                };
                updateSynthSlider('lpf-freq', 'lpf', ' Hz');
                updateSynthSlider('lpq', 'lpq');
                updateSynthSlider('room', 'room');
                updateSynthSlider('delay', 'delay');
                const updateBpmSlider = () => {
                    const slider = document.getElementById('bpm');
                    slider.addEventListener('input', debounce((e) => {
                        this.synthParams.bpm = parseFloat(e.target.value);
                        document.getElementById('bpm-value').textContent = this.synthParams.bpm;
                        slider.setAttribute('aria-valuenow', this.synthParams.bpm);
                        this.saveToLocalStorage();
                        if (this.synthParams.bpmEnabled) {
                            this.updateMixedCode();
                            this.showNotification(`BPM set to ${this.synthParams.bpm}`, 'success');
                        }
                    }, 100));
                };
                updateBpmSlider();
                document.getElementById('bpm-enable').addEventListener('change', (e) => {
                    this.saveToHistory();
                    this.synthParams.bpmEnabled = e.target.checked;
                    this.updateMixedCode();
                    if (this.isPlaying) {
                        this.evaluateCode();
                    }
                    this.saveToLocalStorage();
                    this.showNotification(`BPM ${this.synthParams.bpmEnabled ? 'enabled' : 'disabled'}`, 'success');
                });
                document.getElementById('apply-synth').addEventListener('click', () => this.applySynthToCode());
                this.setupMixCheckboxes();
                Object.keys(this.presets).forEach(key => {
                    document.getElementById(`preset-${key}`).addEventListener('click', () => {
                        this.saveToHistory();
                        this.loadPreset(key);
                    });
                    document.getElementById(`mix-preset-${key}`).addEventListener('click', () => {
                        this.saveToHistory();
                        this.mixPreset(key);
                    });
                });
                document.getElementById('mix-combine').addEventListener('click', () => {
                    this.saveToHistory();
                    this.combineMix();
                });
                document.getElementById('mix-random').addEventListener('click', () => {
                    this.saveToHistory();
                    this.randomMix();
                });
                document.getElementById('save-pattern-btn').addEventListener('click', () => {
                    this.saveToHistory();
                    this.savePattern();
                });
                document.getElementById('export-patterns-btn').addEventListener('click', () => this.exportPatterns());
                document.getElementById('import-patterns-btn').addEventListener('click', () => document.getElementById('import-file').click());
                document.getElementById('import-file').addEventListener('change', (e) => {
                    this.saveToHistory();
                    this.importPatterns(e);
                });
            }
            get presets() {
                return {
                    a: `s('bd,bass(4,8)').jux(rev).gain(0.8)`,
                    b: `s('bd,bass(4,8)').jux(rev).gain(0.8).lpf(800).lpq(1).room(0.5).delay(0.3)`,
                    c: `s('bd*2,hh(3,4),jvbass:[1 4](5,8,1)').jux(rev).stack(s('~ sd')).gain(0.8)`,
                    d: `note("[c eb g <f bb>](3,8,<0 1>)".sub(12))
.s("<sawtooth>/64")
.lpf(sine.range(300,2000).slow(16))
.lpa(0.005)
.lpd(perlin.range(.02,.2))
.lps(perlin.range(0,.5).slow(3))
.lpq(sine.range(2,10).slow(32))
.release(.5)
.lpenv(perlin.range(1,8).slow(2))
.ftype('24db')
.room(1)
.juxBy(.5,rev)
.sometimes(add(note(12)))
.stack(s("bd*2").bank('RolandTR909'))
.gain(.5).fast(2)`,
                    e: `s("hh*8").gain(".4!2 1 .4!2 1 .4 1").fast(2).gain(0.8)`,
                    f: `n("<-4,0 5 2 1>*<2!3 4>")
.scale("<C F>/8:pentatonic")
.s("sine")
.penv("<.5 0 7 -2>*2").vib("4:.1")
.phaser(2).delay(.25).room(.3)
.size(4).fast(1.5)

.fm(3)
.fmdecay(.2)
.fmsustain(1)
.fmenv("<exp lin>")
.fm("<1 2 1.5 1.61>")

.lpf(tri.range(100, 5000).slow(2))
.lpf(tri.range(100, 5000).slow(2))
//.lpenv(4).lpf(500).ftype("<0 1 2>").lpq(1)
.vowel("<a e i <o u>>")
.vib("<.5 1 2 4 8 16>:8")
.room(1).roomsize(5).orbit(2)`,
                    g: `s("bass*8").gain(".4!2 1 .4!2 1 .4 1").fast(2).gain(0.8)`,
                    h: `stack(s("sd*8").struct("~ ~ x ~ ~ ~ x ~").gain(0.8), s("hh*8").struct("x x x x x x x x").gain(0.8)).lpf(4500).lpq(3.5).room(0.3).delay(0.5)`,
                    i: `note("c4 d4 e4 f4 g4 a4 b4 c5").sound('sine').gain(0.8)`,
                    j: `n("<-4,0 5 2 1>*<2!3 4>")
.scale("<C F>/8:pentatonic")
.s("sine")
.penv("<.5 0 7 -2>*2").vib("4:.1")
.phaser(2).delay(.25).room(.3)
.size(4).fast(1.5)

stack(s('bd*4,jvbass*16(1,8),jvbass(8,8,1)').jux(rev) , 
note('D#1 eb3 D#1 eb1 g1 F1 g1 F1 ').sound('sine') , note('D#2 eb2 g4 F1 D#1 eb1 g2 F1').sound('sine')
.lpf(sine.range(500,1000).fast(60)).lpq(10)) 
.fm(sine.range(10,50).fast(70))
.fm(10)

.lpf(tri.range(100, 5000).slow(2))
.lpf(tri.range(100, 5000).slow(2))
//.lpenv(4).lpf(500).ftype("<0 1 2>").lpq(1)
.vowel("<a e i <o u>>")
.vib("<.5 1 2 4 8 16>:8")
.room(1).roomsize(5).orbit(2)`,
                    k: `stack(s('bd*2,jvbass*4(2,8),jvbass(8,8,1)').jux(rev), note('c1 eb1 g1 bb1').sound('sawtooth').lpf(sine.range(500,1000).slow(8)).lpq(5)).fm(sine.range(3,8).slow(100)).gain(0.8)`,
                    l: `note("g1*4").s("sine").pdec(.5).penv(32).pcurve("<1>").gain(0.8)`
                };
            }
            setupMixCheckboxes() {
                const container = document.getElementById('mix-checkboxes');
                container.innerHTML = '';
                Object.keys(this.presets).forEach(key => {
                    const div = document.createElement('div');
                    div.className = 'checkbox-item';
                    div.innerHTML = `
                        <label for="mix-${key}">${key.toUpperCase()}: Pattern ${key}</label>
                        <input type="checkbox" id="mix-${key}" aria-label="Select pattern ${key} for combining">
                        <button class="cyber-btn" id="mix-preset-${key}" aria-label="Mix preset ${key} to code"><i class="las la-random"></i> Mix</button>
                    `;
                    container.appendChild(div);
                    document.getElementById(`mix-${key}`).checked = !!this.mixedPatterns.presets[key];
                    document.getElementById(`mix-preset-${key}`).classList.toggle('active', !!this.mixedPatterns.presets[key]);
                    document.getElementById(`mix-preset-${key}`).setAttribute('aria-pressed', !!this.mixedPatterns.presets[key]);
                    document.getElementById(`mix-${key}`).addEventListener('change', (e) => {
                        this.saveToHistory();
                        this.mixedPatterns.presets[key] = e.target.checked;
                        document.getElementById(`mix-preset-${key}`).classList.toggle('active', e.target.checked);
                        document.getElementById(`mix-preset-${key}`).setAttribute('aria-pressed', e.target.checked);
                        this.updateMixedCode();
                        this.saveToLocalStorage();
                        this.showNotification(`Preset ${key.toUpperCase()} ${e.target.checked ? 'selected' : 'deselected'}`, 'success');
                    });
                });
            }
            changeStepCount(track, count) {
                this.trackStates[track].steps = count;
                const current = this.sequencerState[track].slice(0, count);
                this.sequencerState[track] = Array(count).fill(false);
                for (let i = 0; i < Math.min(current.length, count); i++) {
                    this.sequencerState[track][i] = current[i];
                }
                this.updateSequencerTrack(track);
                if (this.mixedPatterns.tracks[track]) {
                    this.updateMixedCode();
                }
                this.saveToLocalStorage();
                this.showNotification(`${track.toUpperCase()} set to ${count} steps`, 'success');
            }
            changeTrackSound(track, sound) {
                this.trackStates[track].sound = sound;
                if (this.mixedPatterns.tracks[track]) {
                    this.updateMixedCode();
                }
                this.saveToLocalStorage();
                this.showNotification(`${track.toUpperCase()} sound set to ${sound}`, 'success');
            }
            randomizeTrack(track) {
                const stepCount = this.trackStates[track].steps;
                this.sequencerState[track] = Array(stepCount).fill(false).map(() => Math.random() > 0.7);
                this.updateSequencerUI(track);
                if (this.mixedPatterns.tracks[track]) {
                    this.updateMixedCode();
                }
                this.saveToLocalStorage();
                this.showNotification(`${track.toUpperCase()} randomized`, 'success');
            }
            generateTrackCode(track) {
                if (this.trackStates[track].muted || (Object.values(this.trackStates).some(state => state.solo) && !this.trackStates[track].solo)) {
                    this.showNotification(`${track.toUpperCase()} is muted or not soloed`, 'error');
                    return;
                }
                const stepCount = this.trackStates[track].steps;
                const sound = this.trackStates[track].sound;
                const steps = this.sequencerState[track].slice(0, stepCount).map(active => active ? 'x' : '~').join(' ');
                if (!steps.includes('x')) {
                    this.showNotification(`No active steps in ${track.toUpperCase()}`, 'error');
                    return;
                }
                let code = ['sawtooth', 'sine', 'triangle'].includes(sound)
                    ? `note('c3').sound('${sound}').struct("${steps}").gain(0.8)`
                    : `s("${sound}*${stepCount}").struct("${steps}").gain(0.8)`;
                if (this.synthParams.bpmEnabled) {
                    code = `setCps(${this.synthParams.bpm}/60/4)\n${code}`;
                }
                document.getElementById('code-editor').value = code;
                this.mixedPatterns = { presets: {}, tracks: { [track]: true } };
                ['bd', 'sd', 'hh', 'cp'].forEach(t => {
                    document.getElementById(`mix-${t}`).classList.toggle('active', t === track);
                    document.getElementById(`mix-${t}`).setAttribute('aria-pressed', t === track);
                });
                Object.keys(this.presets).forEach(key => {
                    document.getElementById(`mix-${key}`).checked = false;
                    document.getElementById(`mix-preset-${key}`).classList.remove('active');
                    document.getElementById(`mix-preset-${key}`).setAttribute('aria-pressed', 'false');
                });
                this.evaluateCode();
                this.saveToHistory();
                this.showNotification(`Code generated for ${track.toUpperCase()} with ${sound}`, 'success');
            }
            updateMixedCode() {
                const patterns = [];
                Object.keys(this.mixedPatterns.tracks).forEach(track => {
                    if (this.mixedPatterns.tracks[track]) {
                        if (this.trackStates[track].muted || (Object.values(this.trackStates).some(state => state.solo) && !this.trackStates[track].solo)) {
                            return;
                        }
                        const stepCount = this.trackStates[track].steps;
                        const sound = this.trackStates[track].sound;
                        const steps = this.sequencerState[track].slice(0, stepCount).map(active => active ? 'x' : '~').join(' ');
                        if (steps.includes('x')) {
                            const code = ['sawtooth', 'sine', 'triangle'].includes(sound)
                                ? `note('c3').sound('${sound}').struct("${steps}").gain(0.8)`
                                : `s("${sound}*${stepCount}").struct("${steps}").gain(0.8)`;
                            patterns.push(code);
                        }
                    }
                });
                Object.keys(this.mixedPatterns.presets).forEach(key => {
                    if (this.mixedPatterns.presets[key]) {
                        patterns.push(this.presets[key]);
                    }
                });
                let newCode = patterns.length > 0 ? `stack(${patterns.join(', ')})` : '';
                if (this.synthParams.bpmEnabled && patterns.length > 0) {
                    newCode = `setCps(${this.synthParams.bpm}/60/4)\n${newCode}`;
                }
                document.getElementById('code-editor').value = newCode;
                if (newCode) {
                    this.evaluateCode();
                } else {
                    this.stop();
                    this.showNotification('No active patterns to play', 'error');
                }
            }
            mixTrack(track) {
                if (this.trackStates[track].muted || (Object.values(this.trackStates).some(state => state.solo) && !this.trackStates[track].solo)) {
                    this.showNotification(`${track.toUpperCase()} is muted or not soloed`, 'error');
                    return;
                }
                const stepCount = this.trackStates[track].steps;
                const sound = this.trackStates[track].sound;
                const steps = this.sequencerState[track].slice(0, stepCount).map(active => active ? 'x' : '~').join(' ');
                if (!steps.includes('x')) {
                    this.showNotification(`No active steps in ${track.toUpperCase()}`, 'error');
                    return;
                }
                this.mixedPatterns.tracks[track] = !this.mixedPatterns.tracks[track];
                document.getElementById(`mix-${track}`).classList.toggle('active', this.mixedPatterns.tracks[track]);
                document.getElementById(`mix-${track}`).setAttribute('aria-pressed', this.mixedPatterns.tracks[track]);
                this.updateMixedCode();
                this.saveToHistory();
                this.showNotification(`Track ${track.toUpperCase()} ${this.mixedPatterns.tracks[track] ? 'mixed' : 'removed'}`, 'success');
            }
            mixPreset(key) {
                const presetCode = this.presets[key];
                if (!presetCode) {
                    this.showNotification(`Preset ${key.toUpperCase()} is not valid`, 'error');
                    return;
                }
                this.mixedPatterns.presets[key] = !this.mixedPatterns.presets[key];
                document.getElementById(`mix-${key}`).checked = this.mixedPatterns.presets[key];
                document.getElementById(`mix-preset-${key}`).classList.toggle('active', this.mixedPatterns.presets[key]);
                document.getElementById(`mix-preset-${key}`).setAttribute('aria-pressed', this.mixedPatterns.presets[key]);
                this.updateMixedCode();
                this.saveToHistory();
                this.showNotification(`Preset ${key.toUpperCase()} ${this.mixedPatterns.presets[key] ? 'mixed' : 'removed'}`, 'success');
            }
            parsePresetToSequencer(presetCode) {
                const tracks = ['bd', 'sd', 'hh', 'cp'];
                tracks.forEach(track => {
                    const regex = new RegExp(`s\\(['"]([^'"]*${track}[^'"]*)['"]\\)`, 'g');
                    const match = presetCode.match(regex);
                    if (match) {
                        const pattern = match[0].match(/['"]([^'"]*)['"]/)[1];
                        const steps = pattern.split(/[, ]+/).filter(s => s.includes(track));
                        if (steps.length > 0) {
                            const stepCount = this.trackStates[track].steps;
                            this.sequencerState[track] = Array(stepCount).fill(false);
                            const structMatch = presetCode.match(/\.struct\(['"]([^'"]*)['"]\)/);
                            if (structMatch) {
                                const struct = structMatch[1].split(' ').slice(0, stepCount);
                                struct.forEach((s, i) => {
                                    if (s === 'x') this.sequencerState[track][i] = true;
                                });
                            } else {
                                steps[0].split(/[*()]+/).forEach((s, i) => {
                                    if (i < stepCount && s.includes(track)) {
                                        this.sequencerState[track][i] = true;
                                    }
                                });
                            }
                            this.updateSequencerUI(track);
                        }
                    }
                });
            }
            async evaluateCode() {
                if (!this.strudelReady || !this.strudelAPI) {
                    this.showNotification('Strudel not initialized. Please wait.', 'error');
                    return;
                }
                const code = document.getElementById('code-editor').value.trim();
                if (!code) {
                    this.showNotification('No code to evaluate', 'error');
                    return;
                }
                try {
                    if (this.currentPattern) {
                        this.stop();
                    }
                    if (this.synthParams.bpmEnabled && this.strudelAPI.setCps) {
                        this.strudelAPI.setCps(this.synthParams.bpm / 60 / 4);
                    }
                    const { evaluate } = this.strudelAPI;
                    this.currentPattern = await evaluate(code);
                    this.isPlaying = true;
                    document.getElementById('play-btn').classList.add('active');
                    document.getElementById('play-btn').innerHTML = '<i class="las la-pause"></i> Pause';
                    document.getElementById('evaluate-btn').classList.add('active');
                    document.getElementById('audio-status').innerHTML = '<i class="las la-volume-up"></i> Playing';
                    this.showNotification('Code playing', 'success');
                } catch (error) {
                    console.error('Code evaluation failed:', error);
                    this.showNotification(`Error: ${error.message}`, 'error');
                }
            }
            stop() {
                if (!this.strudelReady || !this.strudelAPI) {
                    this.showNotification('Strudel not initialized. Cannot stop.', 'error');
                    return;
                }
                try {
                    const { hush } = this.strudelAPI;
                    if (hush) {
                        hush();
                    }
                    this.currentPattern = null;
                    this.isPlaying = false;
                    document.getElementById('play-btn').classList.remove('active');
                    document.getElementById('play-btn').innerHTML = '<i class="las la-play"></i> Play';
                    document.getElementById('evaluate-btn').classList.remove('active');
                    document.getElementById('audio-status').innerHTML = '<i class="las la-volume-up"></i> Ready';
                    this.showNotification('Playback stopped', 'success');
                } catch (error) {
                    console.error('Stop failed:', error);
                    this.showNotification('Failed to stop playback', 'error');
                }
                this.saveToLocalStorage();
            }
            togglePlayback() {
                if (this.isPlaying) {
                    this.stop();
                } else {
                    this.evaluateCode();
                }
            }
            toggleMute(track) {
                this.trackStates[track].muted = !this.trackStates[track].muted;
                this.trackStates[track].solo = false;
                document.getElementById(`mute-${track}`).classList.toggle('active', this.trackStates[track].muted);
                document.getElementById(`mute-${track}`).setAttribute('aria-pressed', this.trackStates[track].muted);
                document.getElementById(`solo-${track}`).classList.remove('active');
                document.getElementById(`solo-${track}`).setAttribute('aria-pressed', 'false');
                ['bd', 'sd', 'hh', 'cp'].forEach(t => this.updateSequencerUI(t));
                if (this.mixedPatterns.tracks[track]) {
                    this.updateMixedCode();
                }
                this.saveToLocalStorage();
                this.showNotification(`${track.toUpperCase()} ${this.trackStates[track].muted ? 'muted' : 'unmuted'}`, 'success');
            }
            toggleSolo(track) {
                const wasSolo = this.trackStates[track].solo;
                Object.keys(this.trackStates).forEach(t => {
                    this.trackStates[t].solo = t === track ? !wasSolo : false;
                    document.getElementById(`solo-${t}`).classList.toggle('active', t === track && !wasSolo);
                    document.getElementById(`solo-${t}`).setAttribute('aria-pressed', t === track && !wasSolo);
                    if (t !== track) {
                        this.trackStates[t].muted = false;
                        document.getElementById(`mute-${t}`).classList.remove('active');
                        document.getElementById(`mute-${t}`).setAttribute('aria-pressed', 'false');
                    }
                });
                ['bd', 'sd', 'hh', 'cp'].forEach(t => this.updateSequencerUI(t));
                if (Object.values(this.mixedPatterns.tracks).some(v => v)) {
                    this.updateMixedCode();
                }
                this.saveToLocalStorage();
                this.showNotification(`${track.toUpperCase()} ${!wasSolo ? 'soloed' : 'unsoloed'}`, 'success');
            }
            randomizeSequencer() {
                ['bd', 'sd', 'hh', 'cp'].forEach(track => {
                    this.randomizeTrack(track);
                });
                this.showNotification('All tracks randomized', 'success');
            }
            clearSequencer() {
                ['bd', 'sd', 'hh', 'cp'].forEach(track => {
                    this.sequencerState[track] = Array(this.trackStates[track].steps).fill(false);
                    this.updateSequencerUI(track);
                    this.mixedPatterns.tracks[track] = false;
                    document.getElementById(`mix-${track}`).classList.remove('active');
                    document.getElementById(`mix-${track}`).setAttribute('aria-pressed', 'false');
                });
                this.updateMixedCode();
                this.saveToLocalStorage();
                this.showNotification('Sequencer cleared', 'success');
            }
            generateSequencerCode() {
                const patterns = [];
                const isSoloActive = Object.values(this.trackStates).some(state => state.solo);
                ['bd', 'sd', 'hh', 'cp'].forEach(track => {
                    if (this.trackStates[track].muted || (isSoloActive && !this.trackStates[track].solo)) {
                        return;
                    }
                    const stepCount = this.trackStates[track].steps;
                    const sound = this.trackStates[track].sound;
                    const steps = this.sequencerState[track].slice(0, stepCount).map(active => active ? 'x' : '~').join(' ');
                    if (steps.includes('x')) {
                        const code = ['sawtooth', 'sine', 'triangle'].includes(sound)
                            ? `note('c3').sound('${sound}').struct("${steps}").gain(0.8)`
                            : `s("${sound}*${stepCount}").struct("${steps}").gain(0.8)`;
                        patterns.push(code);
                    }
                });
                if (patterns.length === 0) {
                    this.showNotification('No active steps to generate code', 'error');
                    return;
                }
                let newCode = `stack(${patterns.join(', ')})`;
                if (this.synthParams.bpmEnabled) {
                    newCode = `setCps(${this.synthParams.bpm}/60/4)\n${newCode}`;
                }
                document.getElementById('code-editor').value = newCode;
                this.mixedPatterns = { presets: {}, tracks: { bd: true, sd: true, hh: true, cp: true } };
                ['bd', 'sd', 'hh', 'cp'].forEach(track => {
                    document.getElementById(`mix-${track}`).classList.add('active');
                    document.getElementById(`mix-${track}`).setAttribute('aria-pressed', 'true');
                });
                Object.keys(this.presets).forEach(key => {
                    document.getElementById(`mix-${key}`).checked = false;
                    document.getElementById(`mix-preset-${key}`).classList.remove('active');
                    document.getElementById(`mix-preset-${key}`).setAttribute('aria-pressed', 'false');
                });
                this.evaluateCode();
                this.saveToHistory();
                this.showNotification('Sequencer code generated', 'success');
            }
            applySynthToCode() {
                let code = document.getElementById('code-editor').value.trim();
                if (!code) {
                    this.showNotification('No code to apply synth parameters', 'error');
                    return;
                }
                code = code.replace(/\.lpf\(\d+\)/g, '').replace(/\.lpq\(\d+\.?(\d+)?\)/g, '').replace(/\.room\(\d+\.?(\d+)?\)/g, '').replace(/\.delay\(\d+\.?(\d+)?\)/g, '');
                code += `.lpf(${this.synthParams.lpf}).lpq(${this.synthParams.lpq}).room(${this.synthParams.room}).delay(${this.synthParams.delay})`;
                document.getElementById('code-editor').value = code;
                this.evaluateCode();
                this.saveToHistory();
                this.showNotification('Synth parameters applied', 'success');
            }
            combineMix() {
                const selectedPresets = Object.keys(this.mixedPatterns.presets).filter(key => this.mixedPatterns.presets[key]);
                if (selectedPresets.length === 0 && !Object.values(this.mixedPatterns.tracks).some(v => v)) {
                    this.showNotification('No patterns selected for combining', 'error');
                    return;
                }
                this.updateMixedCode();
                this.showNotification('Patterns combined', 'success');
            }
            randomMix() {
                const keys = Object.keys(this.presets);
                const randomKeys = [];
                while (randomKeys.length < 3 && keys.length > 0) {
                    const idx = Math.floor(Math.random() * keys.length);
                    randomKeys.push(keys.splice(idx, 1)[0]);
                }
                Object.keys(this.presets).forEach(key => {
                    this.mixedPatterns.presets[key] = randomKeys.includes(key);
                    document.getElementById(`mix-${key}`).checked = randomKeys.includes(key);
                    document.getElementById(`mix-preset-${key}`).classList.toggle('active', randomKeys.includes(key));
                    document.getElementById(`mix-preset-${key}`).setAttribute('aria-pressed', randomKeys.includes(key));
                });
                ['bd', 'sd', 'hh', 'cp'].forEach(track => {
                    this.mixedPatterns.tracks[track] = false;
                    document.getElementById(`mix-${track}`).classList.remove('active');
                    document.getElementById(`mix-${track}`).setAttribute('aria-pressed', 'false');
                });
                this.updateMixedCode();
                this.showNotification('Random patterns selected', 'success');
            }
            loadPreset(key) {
                const presetCode = this.presets[key];
                if (!presetCode) {
                    this.showNotification(`Preset ${key.toUpperCase()} not found`, 'error');
                    return;
                }
                document.getElementById('code-editor').value = presetCode;
                this.mixedPatterns = { presets: { [key]: true }, tracks: {} };
                Object.keys(this.presets).forEach(k => {
                    document.getElementById(`mix-${k}`).checked = k === key;
                    document.getElementById(`mix-preset-${k}`).classList.toggle('active', k === key);
                    document.getElementById(`mix-preset-${k}`).setAttribute('aria-pressed', k === key);
                });
                ['bd', 'sd', 'hh', 'cp'].forEach(track => {
                    document.getElementById(`mix-${track}`).classList.remove('active');
                    document.getElementById(`mix-${track}`).setAttribute('aria-pressed', 'false');
                    this.mixedPatterns.tracks[track] = false;
                });
                this.parsePresetToSequencer(presetCode);
                this.evaluateCode();
                this.saveToHistory();
                this.showNotification(`Preset ${key.toUpperCase()} loaded`, 'success');
            }
            savePattern() {
                const name = document.getElementById('pattern-name').value.trim();
                if (!name) {
                    this.showNotification('Pattern name is required', 'error');
                    return;
                }
                const code = document.getElementById('code-editor').value.trim();
                if (!code) {
                    this.showNotification('No code to save', 'error');
                    return;
                }
                this.savedPatterns.set(name, {
                    code,
                    sequencerState: JSON.parse(JSON.stringify(this.sequencerState)),
                    trackStates: JSON.parse(JSON.stringify(this.trackStates)),
                    synthParams: JSON.parse(JSON.stringify(this.synthParams))
                });
                this.updatePatternBankUI();
                this.saveToLocalStorage();
                this.showNotification(`Pattern "${name}" saved`, 'success');
            }
            updatePatternBankUI() {
                const container = document.getElementById('pattern-bank');
                container.innerHTML = '';
                this.savedPatterns.forEach((pattern, name) => {
                    const div = document.createElement('div');
                    div.className = 'checkbox-item';
                    div.innerHTML = `
                        <span>${name}</span>
                        <div>
                            <button class="cyber-btn" data-name="${name}" data-action="load" aria-label="Load pattern ${name}"><i class="las la-folder-open"></i> Load</button>
                            <button class="cyber-btn" data-name="${name}" data-action="delete" aria-label="Delete pattern ${name}"><i class="las la-trash"></i> Delete</button>
                        </div>
                    `;
                    container.appendChild(div);
                });
                container.querySelectorAll('button[data-action="load"]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        this.saveToHistory();
                        this.loadPattern(btn.dataset.name);
                    });
                });
                container.querySelectorAll('button[data-action="delete"]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        this.saveToHistory();
                        this.deletePattern(btn.dataset.name);
                    });
                });
            }
            loadPattern(name) {
                const pattern = this.savedPatterns.get(name);
                if (!pattern) {
                    this.showNotification(`Pattern "${name}" not found`, 'error');
                    return;
                }
                this.sequencerState = JSON.parse(JSON.stringify(pattern.sequencerState));
                this.trackStates = JSON.parse(JSON.stringify(pattern.trackStates));
                this.synthParams = JSON.parse(JSON.stringify(pattern.synthParams));
                document.getElementById('code-editor').value = pattern.code;
                ['bd', 'sd', 'hh', 'cp'].forEach(track => {
                    this.updateSequencerTrack(track);
                    document.getElementById(`${track}-steps`).value = this.trackStates[track].steps;
                    document.getElementById(`${track}-sound`).value = this.trackStates[track].sound;
                    document.getElementById(`mute-${track}`).classList.toggle('active', this.trackStates[track].muted);
                    document.getElementById(`mute-${track}`).setAttribute('aria-pressed', this.trackStates[track].muted);
                    document.getElementById(`solo-${track}`).classList.toggle('active', this.trackStates[track].solo);
                    document.getElementById(`solo-${track}`).setAttribute('aria-pressed', this.trackStates[track].solo);
                });
                document.getElementById('lpf-freq').value = this.synthParams.lpf;
                document.getElementById('lpf-freq-value').textContent = `${this.synthParams.lpf} Hz`;
                document.getElementById('lpf-freq').setAttribute('aria-valuenow', this.synthParams.lpf);
                document.getElementById('lpq').value = this.synthParams.lpq;
                document.getElementById('lpq-value').textContent = this.synthParams.lpq;
                document.getElementById('lpq').setAttribute('aria-valuenow', this.synthParams.lpq);
                document.getElementById('room').value = this.synthParams.room;
                document.getElementById('room-value').textContent = this.synthParams.room;
                document.getElementById('room').setAttribute('aria-valuenow', this.synthParams.room);
                document.getElementById('delay').value = this.synthParams.delay;
                document.getElementById('delay-value').textContent = this.synthParams.delay;
                document.getElementById('delay').setAttribute('aria-valuenow', this.synthParams.delay);
                document.getElementById('bpm').value = this.synthParams.bpm;
                document.getElementById('bpm-value').textContent = this.synthParams.bpm;
                document.getElementById('bpm').setAttribute('aria-valuenow', this.synthParams.bpm);
                document.getElementById('bpm-enable').checked = this.synthParams.bpmEnabled;
                this.evaluateCode();
                this.showNotification(`Pattern "${name}" loaded`, 'success');
            }
            deletePattern(name) {
                this.savedPatterns.delete(name);
                this.updatePatternBankUI();
                this.saveToLocalStorage();
                this.showNotification(`Pattern "${name}" deleted`, 'success');
            }
            exportPatterns() {
                const data = JSON.stringify([...this.savedPatterns], null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'cybersynth_patterns.json';
                a.click();
                URL.revokeObjectURL(url);
                this.showNotification('Patterns exported', 'success');
            }
            importPatterns(event) {
                const file = event.target.files[0];
                if (!file) {
                    this.showNotification('No file selected', 'error');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        this.savedPatterns = new Map(data);
                        this.updatePatternBankUI();
                        this.saveToLocalStorage();
                        this.showNotification('Patterns imported', 'success');
                    } catch (error) {
                        this.showNotification('Invalid pattern file', 'error');
                    }
                };
                reader.readAsText(file);
            }
            saveCode() {
                const code = document.getElementById('code-editor').value.trim();
                if (!code) {
                    this.showNotification('No code to save', 'error');
                    return;
                }
                const blob = new Blob([code], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'cybersynth_code.txt';
                a.click();
                URL.revokeObjectURL(url);
                this.showNotification('Code saved', 'success');
            }
            loadCode() {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.txt';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) {
                        this.showNotification('No file selected', 'error');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        this.saveToHistory();
                        document.getElementById('code-editor').value = ev.target.result;
                        this.evaluateCode();
                        this.showNotification('Code loaded', 'success');
                    };
                    reader.readAsText(file);
                };
                input.click();
            }
            saveToLocalStorage() {
                const data = {
                    sequencerState: this.sequencerState,
                    trackStates: this.trackStates,
                    synthParams: this.synthParams,
                    mixedPatterns: this.mixedPatterns,
                    savedPatterns: [...this.savedPatterns],
                    code: document.getElementById('code-editor').value
                };
                localStorage.setItem('cyberStrudelState', JSON.stringify(data));
            }
            loadSavedData() {
                const data = localStorage.getItem('cyberStrudelState');
                if (data) {
                    const parsed = JSON.parse(data);
                    this.sequencerState = parsed.sequencerState || this.sequencerState;
                    this.trackStates = parsed.trackStates || this.trackStates;
                    this.synthParams = parsed.synthParams || this.synthParams;
                    this.mixedPatterns = parsed.mixedPatterns || this.mixedPatterns;
                    this.savedPatterns = new Map(parsed.savedPatterns || []);
                    document.getElementById('code-editor').value = parsed.code || '';
                    ['bd', 'sd', 'hh', 'cp'].forEach(track => {
                        this.updateSequencerTrack(track);
                        document.getElementById(`${track}-steps`).value = this.trackStates[track].steps;
                        document.getElementById(`${track}-sound`).value = this.trackStates[track].sound;
                        document.getElementById(`mute-${track}`).classList.toggle('active', this.trackStates[track].muted);
                        document.getElementById(`mute-${track}`).setAttribute('aria-pressed', this.trackStates[track].muted);
                        document.getElementById(`solo-${track}`).classList.toggle('active', this.trackStates[track].solo);
                        document.getElementById(`solo-${track}`).setAttribute('aria-pressed', this.trackStates[track].solo);
                        document.getElementById(`mix-${track}`).classList.toggle('active', !!this.mixedPatterns.tracks[track]);
                        document.getElementById(`mix-${track}`).setAttribute('aria-pressed', !!this.mixedPatterns.tracks[track]);
                    });
                    document.getElementById('lpf-freq').value = this.synthParams.lpf;
                    document.getElementById('lpf-freq-value').textContent = `${this.synthParams.lpf} Hz`;
                    document.getElementById('lpf-freq').setAttribute('aria-valuenow', this.synthParams.lpf);
                    document.getElementById('lpq').value = this.synthParams.lpq;
                    document.getElementById('lpq-value').textContent = this.synthParams.lpq;
                    document.getElementById('lpq').setAttribute('aria-valuenow', this.synthParams.lpq);
                    document.getElementById('room').value = this.synthParams.room;
                    document.getElementById('room-value').textContent = this.synthParams.room;
                    document.getElementById('room').setAttribute('aria-valuenow', this.synthParams.room);
                    document.getElementById('delay').value = this.synthParams.delay;
                    document.getElementById('delay-value').textContent = this.synthParams.delay;
                    document.getElementById('delay').setAttribute('aria-valuenow', this.synthParams.delay);
                    document.getElementById('bpm').value = this.synthParams.bpm;
                    document.getElementById('bpm-value').textContent = this.synthParams.bpm;
                    document.getElementById('bpm').setAttribute('aria-valuenow', this.synthParams.bpm);
                    document.getElementById('bpm-enable').checked = this.synthParams.bpmEnabled;
                    this.updatePatternBankUI();
                }
            }
            showNotification(message, type = 'info') {
                const notification = document.getElementById('notification');
                const notificationText = document.getElementById('notification-text');
                notificationText.textContent = message;
                notification.className = `notification ${type} show`;
                setTimeout(() => {
                    notification.classList.remove('show');
                }, 3000);
            }
        }
        const app = new CyberStrudel();
   