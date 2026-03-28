import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

const GlobalTimer = {
    startTime: 0,
    accumulatedTime: 0, 
    intervalId: null,
    isRunning: false,
    isPaused: false,
    activeNodes: new Set(),

    formatTime(ms) {
        if (ms < 0) ms = 0;
        const minutes = String(Math.floor(ms / 60000)).padStart(2, '0');
        const seconds = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
        return `${minutes}:${seconds}`;
    },
    
    start() {
        this.isRunning = true;
        this.isPaused = false;
        this.accumulatedTime = 0;
        this.startTime = Date.now();
        this.activeNodes.forEach(node => {
            if (node.timerDisplay) {
                node.timerDisplay.style.setProperty('--text-color', '#0099ff');
                node.timerDisplay.style.setProperty('--glow-color', '#0099ff');
                node.timerDisplay.classList.remove('is-paused');
            }
        });
        this._runInterval();
    },

    pause() {
        if (!this.isRunning || this.isPaused) return;
        this.isPaused = true;
        this.accumulatedTime += Date.now() - this.startTime;
        clearInterval(this.intervalId);
        this.activeNodes.forEach(node => {
            if (node.timerDisplay) node.timerDisplay.classList.add('is-paused');
        });
    },

    resume() {
        if (!this.isRunning || !this.isPaused) return;
        this.isPaused = false;
        this.startTime = Date.now();
        this.activeNodes.forEach(node => {
            if (node.timerDisplay) node.timerDisplay.classList.remove('is-paused');
        });
        this._runInterval();
    },

    _runInterval() {
        clearInterval(this.intervalId);
        this.intervalId = setInterval(() => {
            const currentElapsed = Date.now() - this.startTime;
            const totalElapsed = this.accumulatedTime + currentElapsed;
            const timeString = this.formatTime(totalElapsed);
            this.activeNodes.forEach(node => {
                if (node.timerDisplay) node.timerDisplay.textContent = timeString;
            });
        }, 100);
    },

    stop() {
        if (!this.isRunning) return;
        clearInterval(this.intervalId);
        const finalTime = this.isPaused ? this.accumulatedTime : (this.accumulatedTime + (Date.now() - this.startTime));
        const finalTimeString = this.formatTime(finalTime);
        this.activeNodes.forEach(node => {
            if (node.timerDisplay) {
                node.timerDisplay.textContent = finalTimeString;
                node.timerDisplay.style.setProperty('--text-color', '#7300ff');
                node.timerDisplay.style.setProperty('--glow-color', '#7300ff');
                node.timerDisplay.classList.remove('is-paused');
            }
            node.properties.elapsed_time_str = finalTimeString;
        });
        this.isRunning = false;
        this.isPaused = false;
    },
    registerNode(node) { this.activeNodes.add(node); },
    unregisterNode(node) { this.activeNodes.delete(node); },
};

app.registerExtension({
    name: "Neo.Timer",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "NeoTimer") {
            nodeType.prototype.onNodeCreated = function () {
                this.bgcolor = "#000000";
                this.color = "#000000";
                this.title = "Neo Timer ⚡";
                this.properties = this.properties || {};
                this.size = [300, 100];

                const container = document.createElement("div");
                container.style.cssText = `width: 100%; height: 100%; position: relative; --text-color: #7300ff; --glow-color: #7300ff;`;

                this.timerDisplay = document.createElement("div");
                this.timerDisplay.className = "neo-timer-display";
                this.timerDisplay.textContent = this.properties.elapsed_time_str || "00:00";
                
                container.appendChild(this.timerDisplay);
                this.addDOMWidget("neoTimer", "Neo Timer", container, { serialize: false });
                GlobalTimer.registerNode(this);
            };
            nodeType.prototype.onRemoved = function() { GlobalTimer.unregisterNode(this); };
            nodeType.prototype.onConfigure = function(info) {
                this.properties = info.properties || {};
                if (this.timerDisplay) this.timerDisplay.textContent = this.properties.elapsed_time_str || "00:00";
            };
        }
    },
    setup() {
        const style = document.createElement("style");
        style.innerText = `
            @keyframes neo-glow-pulse { 0%, 100% { text-shadow: 0 0 15px var(--glow-color); } 50% { text-shadow: 0 0 25px var(--glow-color); } }
            @keyframes neo-pause-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
            .neo-timer-display {
                text-align: center; width: 100%; height: 100%; position: absolute;
                top: 0; left: 0; color: var(--text-color);
                font-family: 'Orbitron', sans-serif;
                display: flex; justify-content: center; align-items: center; 
                font-size: 50px; animation: neo-glow-pulse 8s infinite ease-in-out;
                font-weight: bold; font-variant-numeric: tabular-nums;
            }
            .neo-timer-display.is-paused { animation: neo-glow-pulse 8s infinite ease-in-out, neo-pause-blink 2s infinite ease-in-out; }
        `;
        document.head.appendChild(style);

        api.addEventListener("execution_start", () => GlobalTimer.start());
        api.addEventListener("executing", ({ detail }) => {
            if (detail === null) GlobalTimer.stop();
            else if (GlobalTimer.isPaused) GlobalTimer.resume();
        });
        api.addEventListener("neo_chooser_show", () => GlobalTimer.pause());
        api.addEventListener("execution_error", () => GlobalTimer.stop());
        api.addEventListener("execution_interrupted", () => GlobalTimer.stop());
    }
});