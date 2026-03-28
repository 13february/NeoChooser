import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

let available_sounds = ["# No Sound"];

if (!document.querySelector('link[href*="Rajdhani"]')) {
    const fontLink = document.createElement("link");
    fontLink.href = "https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&display=swap";
    fontLink.rel = "stylesheet";
    document.head.appendChild(fontLink);
}

function safeRoundRect(ctx, x, y, w, h, radius) {
    let r = Math.max(0, Math.min(radius, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let ellipsis = '…';
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + ellipsis).width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + ellipsis;
}

function drawCleanNeonText(ctx, text, x, y, color, size, isBold = false, textAlign = "center", maxWidth = null) {
    ctx.save();
    const weight = isBold ? "700" : "500"; 
    ctx.font = `${weight} ${size}px 'Rajdhani', sans-serif`;
    ctx.textAlign = textAlign;
    ctx.textBaseline = "middle";
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    let textToDraw = text;
    if (maxWidth) textToDraw = truncateText(ctx, text, maxWidth);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4; ctx.fillText(textToDraw, x, y);
    ctx.shadowBlur = 0; ctx.fillText(textToDraw, x, y); 
    ctx.restore();
}

function drawCleanNeonRect(ctx, x, y, w, h, radius, color, blur = 0, isFill = false) {
    ctx.save();
    safeRoundRect(ctx, x, y, w, h, radius);
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    if (isFill) {
        ctx.fillStyle = color;
        ctx.fill();
    } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        if (blur > 0) {
            ctx.shadowColor = color;
            ctx.shadowBlur = blur;
        }
        ctx.stroke();
    }
    ctx.restore();
}

app.registerExtension({
    name: "Neo.ImageChooser.Polished",
    
    async setup() {
        try {
            const resp = await api.fetchApi("/neo_chooser/sounds");
            const files = await resp.json();
            available_sounds = ["# No Sound", ...files];
        } catch (e) {}

        api.addEventListener("neo_chooser_show", (event) => {
            const data = event.detail;
            const node = app.graph.getNodeById(data.node_id);
            if (!node) return;
            node.neo_selected = new Set();
            node.neo_images = [];
            node.is_paused = true;
            if (data.images.length === 1) node.neo_selected.add(0);
            
            // Читаем настройки из properties
            const sIdx = node.properties.sound_index || 0;
            const vIdx = node.properties.volume_index || 5;

            if (sIdx > 0 && available_sounds.length > 1 && vIdx > 0) {
                try {
                    const soundFile = available_sounds[sIdx];
                    const audio = new Audio(`/extensions/NeoChooser/sounds/${soundFile}`);
                    audio.volume = vIdx / 10;
                    audio.play().catch(e => {});
                } catch (err) {}
            }
            data.images.forEach((imgData, index) => {
                const img = new Image();
                img.onload = () => node.setDirtyCanvas(true, true);
                const params = new URLSearchParams({ filename: imgData.filename, type: imgData.type, subfolder: imgData.subfolder });
                img.src = `/view?${params.toString()}`;
                node.neo_images.push({ img: img, idx: index });
            });
            node.setDirtyCanvas(true, true);
        });
    },

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "NeoChooser") {
            
            nodeType.prototype.computeSize = function() {
                const minW = 250;
                const minH = this.properties.show_preview ? 250 : 150; 
                return [minW, minH];
            };

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);
                this.title = "Neo Image Chooser 👁️";
                
                // Инициализируем свойства для сохранения
                this.properties = this.properties || {};
                this.properties.sound_index = this.properties.sound_index || 0;
                this.properties.volume_index = this.properties.volume_index || 5; 
                this.properties.show_preview = this.properties.show_preview !== undefined ? this.properties.show_preview : true;
                
                this.size = [350, this.properties.show_preview ? 320 : 150];
                this.is_paused = false;
                this.neo_images = [];
                this.neo_selected = new Set();
                if (this.widgets) this.widgets.forEach(w => w.hidden = true);
            };

            nodeType.prototype.sendReply = async function(action) {
                this.is_paused = false;
                const selectedArr = Array.from(this.neo_selected || new Set());
                this.setDirtyCanvas(true, true);
                if (action === "cancel") api.interrupt();
                await api.fetchApi("/neo_chooser/reply", {
                    method: "POST",
                    body: JSON.stringify({ node_id: String(this.id), action: action, selected: selectedArr })
                });
            };

            const onDrawBackground = nodeType.prototype.onDrawBackground;
            nodeType.prototype.onDrawBackground = function (ctx) {
                if (onDrawBackground) onDrawBackground.apply(this, arguments);
                if (this.flags && this.flags.collapsed) return;

                if (!(this.neo_selected instanceof Set)) {
                    this.neo_selected = new Set(Array.isArray(this.neo_selected) ? this.neo_selected : []);
                }

                const w = this.size[0];
                const h = this.size[1];
                const active = this.is_paused && (this.neo_images && this.neo_images.length > 0);
                
                // УМЕНЬШЕНО: padding 4 -> 3
                const padding = 3; 

                const neonGreen = active ? "#00cc88" : "#335544";
                const neonRed = active ? "#cc4444" : "#553333";
                const neonBlue = "#4488ff"; 
                const idleColor = "#777788";
                const frameColor = "#2a2a35";

                drawCleanNeonRect(ctx, padding, padding, w - padding * 2, h - padding * 2, 6, "#0b0b0e", 0, true);

                // --- АУДИОПАНЕЛЬ ---
                const controlsY = (h < 130) ? padding + 22 : padding + 35; 
                const boxH = 26; 
                const volBoxW = 80; 
                const gap = 12; 
                
                // УМЕНЬШЕНО: отступ контента 15 -> 8
                const trackBoxX = padding + 8;
                const volBoxX = w - padding - 8 - volBoxW;
                const trackBoxW = Math.max(20, volBoxX - trackBoxX - gap);

                drawCleanNeonRect(ctx, trackBoxX, controlsY, trackBoxW, boxH, 4, frameColor, 0, false);
                drawCleanNeonRect(ctx, volBoxX, controlsY, volBoxW, boxH, 4, frameColor, 0, false);

                const arrowBtnW = 24;
                this.btn_prev_rect = { x: trackBoxX, y: controlsY, w: arrowBtnW, h: boxH };
                this.btn_next_rect = { x: trackBoxX + trackBoxW - arrowBtnW, y: controlsY, w: arrowBtnW, h: boxH };

                if (trackBoxW > arrowBtnW * 2) {
                    drawCleanNeonRect(ctx, trackBoxX, controlsY, arrowBtnW, boxH, 4, "#14141a", 0, true);
                    drawCleanNeonText(ctx, "<", trackBoxX + arrowBtnW/2, controlsY + boxH/2, idleColor, 14);
                    drawCleanNeonRect(ctx, this.btn_next_rect.x, controlsY, arrowBtnW, boxH, 4, "#14141a", 0, true);
                    drawCleanNeonText(ctx, ">", this.btn_next_rect.x + arrowBtnW/2, controlsY + boxH/2, idleColor, 14);
                    
                    // Используем свойство из properties
                    let sName = available_sounds[this.properties.sound_index] || "Loading...";
                    drawCleanNeonText(ctx, sName, trackBoxX + trackBoxW/2, controlsY + boxH/2 + 1, neonGreen, 14, false, "center", trackBoxW - arrowBtnW * 2 - 10);
                }

                const startBarX = volBoxX + 6; 
                this.vol_bars_rects = [];
                for (let i = 1; i <= 10; i++) {
                    const barX = startBarX + (i - 1) * 6.8; 
                    const bh = 6 + (14 - 6) * ((i - 1) / 9);
                    const by = controlsY + (boxH - bh) / 2;
                    this.vol_bars_rects.push({ x: barX - 1, y: controlsY, w: 7, h: boxH, idx: i });
                    // Используем свойство из properties
                    ctx.fillStyle = (this.properties.volume_index >= i) ? neonGreen : "#1a1a25";
                    ctx.fillRect(barX, by, 5, bh);
                }

                // ГАЛОЧКА
                if (h > 120) {
                    const toggleY = controlsY + boxH + 12;
                    // УМЕНЬШЕНО: 15 -> 8
                    this.toggle_preview_rect = { x: padding + 8, y: toggleY, w: 100, h: 14 };
                    const toggleTxt = this.properties.show_preview ? "☑ SHOW PREVIEW" : "☐ SHOW PREVIEW";
                    drawCleanNeonText(ctx, toggleTxt, padding + 8, toggleY + 7, this.properties.show_preview ? neonGreen : idleColor, 10, false, "left");
                } else {
                    this.toggle_preview_rect = null;
                }

                // ПРЕВЬЮ
                if (this.properties.show_preview && this.neo_images && this.neo_images.length > 0) {
                    const toggleY = controlsY + boxH + 12;
                    let startY = (h < 130) ? toggleY + 10 : toggleY + 22;
                    let bottomPadding = 60;
                    const availableH = h - padding - startY - bottomPadding;
                    if (availableH > 20) {
                        const count = this.neo_images.length;
                        const cols = Math.ceil(Math.sqrt(count));
                        const rows = Math.ceil(count / cols);
                        const cellW = (w - padding * 2 - 16) / cols; // Скорректировано под новые отступы
                        const cellH = availableH / rows;
                        this.image_rects = [];
                        this.neo_images.forEach((imgObj, i) => {
                            const img = imgObj.img;
                            if (!img.complete) return;
                            const ratio = Math.min((cellW - 6) / img.width, (cellH - 6) / img.height);
                            const drawW = img.width * ratio;
                            const drawH = img.height * ratio;
                            // УМЕНЬШЕНО: 15 -> 8
                            const drawX = padding + 8 + (i % cols) * cellW + (cellW - drawW) / 2;
                            const drawY = startY + Math.floor(i / cols) * cellH + (cellH - drawH) / 2;
                            this.image_rects.push({ x: drawX, y: drawY, w: drawW, h: drawH, idx: i });
                            drawCleanNeonRect(ctx, drawX - 1, drawY - 1, drawW + 2, drawH + 2, 2, "#333345", 2);
                            ctx.drawImage(img, drawX, drawY, drawW, drawH);
                            if (this.neo_selected.has(i)) {
                                drawCleanNeonRect(ctx, drawX - 1, drawY - 1, drawW + 2, drawH + 2, 2, neonGreen, 6);
                                ctx.fillStyle = "rgba(0, 204, 136, 0.15)";
                                ctx.fillRect(drawX, drawY, drawW, drawH);
                            }
                        });
                    }
                }

                // КНОПКИ
                const btnH = (h < 130) ? 24 : 30;
                // УМЕНЬШЕНО: 15 -> 8
                const sideMargin = 8;
                const btnY = h - padding - btnH - 12; 
                
                if (active) {
                    const btnW = (w - padding * 2 - sideMargin * 2 - 10) / 2;
                    this.btn_cancel_rect = { x: padding + sideMargin, y: btnY, w: btnW, h: btnH };
                    this.btn_continue_rect = { x: padding + sideMargin + btnW + 10, y: btnY, w: btnW, h: btnH };
                    this.btn_run_rect = null;

                    drawCleanNeonRect(ctx, this.btn_cancel_rect.x, btnY, btnW, btnH, 15, "#181111", 0, true);
                    drawCleanNeonRect(ctx, this.btn_cancel_rect.x, btnY, btnW, btnH, 15, neonRed, 4);
                    drawCleanNeonText(ctx, "CANCEL", this.btn_cancel_rect.x + btnW/2, btnY + btnH/2 + 1, neonRed, 13, true);

                    drawCleanNeonRect(ctx, this.btn_continue_rect.x, btnY, btnW, btnH, 15, "#111814", 0, true);
                    drawCleanNeonRect(ctx, this.btn_continue_rect.x, btnY, btnW, btnH, 15, neonGreen, 4);
                    const txt = (this.neo_selected.size > 0) ? `CONTINUE (${this.neo_selected.size})` : "SKIP";
                    drawCleanNeonText(ctx, txt, this.btn_continue_rect.x + btnW/2, btnY + btnH/2 + 1, neonGreen, 13, true);
                } else {
                    const fullBtnW = w - padding * 2 - sideMargin * 2;
                    this.btn_run_rect = { x: padding + sideMargin, y: btnY, w: fullBtnW, h: btnH };
                    this.btn_cancel_rect = null;
                    this.btn_continue_rect = null;

                    drawCleanNeonRect(ctx, this.btn_run_rect.x, btnY, fullBtnW, btnH, 15, "#101418", 0, true);
                    drawCleanNeonRect(ctx, this.btn_run_rect.x, btnY, fullBtnW, btnH, 15, neonBlue, 4);
                    drawCleanNeonText(ctx, "RUN GENERATION", this.btn_run_rect.x + fullBtnW/2, btnY + btnH/2 + 1, neonBlue, 13, true);
                }
            };

            const onMouseDown = nodeType.prototype.onMouseDown;
            nodeType.prototype.onMouseDown = function (e, pos) {
                const clickX = pos[0]; const clickY = pos[1];
                
                // Обработка кликов с записью в properties
                if (this.toggle_preview_rect && clickX >= this.toggle_preview_rect.x && clickX <= this.toggle_preview_rect.x + this.toggle_preview_rect.w &&
                    clickY >= this.toggle_preview_rect.y && clickY <= this.toggle_preview_rect.y + this.toggle_preview_rect.h) {
                    this.properties.show_preview = !this.properties.show_preview;
                    this.size[1] = this.properties.show_preview ? 320 : 150;
                    this.setDirtyCanvas(true, true);
                    return true;
                }
                if (this.btn_prev_rect && clickX >= this.btn_prev_rect.x && clickX <= this.btn_prev_rect.x + this.btn_prev_rect.w &&
                    clickY >= this.btn_prev_rect.y && clickY <= this.btn_prev_rect.y + this.btn_prev_rect.h) {
                    this.properties.sound_index = (this.properties.sound_index - 1 + available_sounds.length) % available_sounds.length;
                    this.setDirtyCanvas(true); return true;
                }
                if (this.btn_next_rect && clickX >= this.btn_next_rect.x && clickX <= this.btn_next_rect.x + this.btn_next_rect.w &&
                    clickY >= this.btn_next_rect.y && clickY <= this.btn_next_rect.y + this.btn_next_rect.h) {
                    this.properties.sound_index = (this.properties.sound_index + 1) % available_sounds.length;
                    this.setDirtyCanvas(true); return true;
                }
                for (let bar of (this.vol_bars_rects || [])) {
                    if (clickX >= bar.x && clickX <= bar.x + bar.w && clickY >= bar.y && clickY <= bar.y + bar.h) {
                        this.properties.volume_index = bar.idx; this.setDirtyCanvas(true); return true;
                    }
                }
                if (this.btn_run_rect && clickX >= this.btn_run_rect.x && clickX <= this.btn_run_rect.x + this.btn_run_rect.w &&
                    clickY >= this.btn_run_rect.y && clickY <= this.btn_run_rect.y + this.btn_run_rect.h) {
                    app.queuePrompt(0); return true;
                }
                if (!this.is_paused || (this.neo_images && this.neo_images.length === 0)) return onMouseDown ? onMouseDown.apply(this, arguments) : false;
                for (let rect of (this.image_rects || [])) {
                    if (clickX >= rect.x && clickX <= rect.x + rect.w && clickY >= rect.y && clickY <= rect.y + rect.h) {
                        if (this.neo_selected.has(rect.idx)) this.neo_selected.delete(rect.idx);
                        else this.neo_selected.add(rect.idx);
                        this.setDirtyCanvas(true); return true;
                    }
                }
                if (this.btn_continue_rect && clickX >= this.btn_continue_rect.x && clickX <= this.btn_continue_rect.x + this.btn_continue_rect.w &&
                    clickY >= this.btn_continue_rect.y && clickY <= this.btn_continue_rect.y + this.btn_continue_rect.h) {
                    this.sendReply("continue"); return true;
                }
                if (this.btn_cancel_rect && clickX >= this.btn_cancel_rect.x && clickX <= this.btn_cancel_rect.x + this.btn_cancel_rect.w &&
                    clickY >= this.btn_cancel_rect.y && clickY <= this.btn_cancel_rect.y + this.btn_cancel_rect.h) {
                    this.sendReply("cancel"); return true;
                }
                return onMouseDown ? onMouseDown.apply(this, arguments) : false;
            };
        }
    }
});