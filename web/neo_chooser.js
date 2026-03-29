import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

let available_sounds = ["# No Sound"];
let isQueueActive = false;

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

function drawCleanNeonText(ctx, text, x, y, color, size, isBold = false, textAlign = "center", maxWidth = null) {
    ctx.save();
    ctx.font = `${isBold ? "700" : "500"} ${size}px 'Rajdhani', sans-serif`;
    ctx.textAlign = textAlign; 
    ctx.textBaseline = "middle";
    
    ctx.shadowOffsetX = 0; 
    ctx.shadowOffsetY = 0; 
    
    ctx.fillStyle = color; 
    ctx.shadowColor = color; 
    ctx.shadowBlur = 4;
    
    let t = (maxWidth && ctx.measureText(text).width > maxWidth) ? text.slice(0, -3) + "..." : text;
    ctx.fillText(t, x, y); 
    ctx.shadowBlur = 0; 
    ctx.fillText(t, x, y);
    ctx.restore();
}

function drawCleanNeonRect(ctx, x, y, w, h, radius, color, blur = 0, isFill = false) {
    ctx.save(); 
    safeRoundRect(ctx, x, y, w, h, radius);
    
    ctx.shadowOffsetX = 0; 
    ctx.shadowOffsetY = 0; 

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
            const r = await api.fetchApi("/neo_chooser/sounds"); 
            available_sounds = ["# No Sound", ...await r.json()]; 
        } catch (e) {}

        const reset = () => { 
            isQueueActive = false; 
            app.graph._nodes.forEach(n => { 
                if (n.type === "NeoChooser") { 
                    n.is_paused = false; 
                    n.neo_images = []; 
                    n.setDirtyCanvas(true); 
                } 
            }); 
        };

        api.addEventListener("execution_start", () => { 
            isQueueActive = true; 
            app.graph._nodes.forEach(n => { if(n.type === "NeoChooser") n.setDirtyCanvas(true); }); 
        });

        api.addEventListener("neo_chooser_show", (e) => {
            isQueueActive = false; 
            const n = app.graph.getNodeById(e.detail.node_id); 
            if (!n) return;

            n.neo_selected = new Set(); 
            n.neo_images = []; 
            n.is_paused = true;
            if (e.detail.images.length === 1) n.neo_selected.add(0);

            if (n.properties.sound_index > 0 && n.properties.volume_index > 0) {
                const a = new Audio(`/extensions/NeoChooser/sounds/${available_sounds[n.properties.sound_index]}`);
                a.volume = n.properties.volume_index / 10; 
                a.play().catch(()=>{});
            }

            e.detail.images.forEach((img, i) => { 
                const obj = new Image(); 
                obj.onload = () => n.setDirtyCanvas(true); 
                obj.src = `/view?filename=${img.filename}&type=${img.type}&subfolder=${img.subfolder}`; 
                n.neo_images.push({ img: obj, idx: i }); 
            });
            n.setDirtyCanvas(true);
        });

        api.addEventListener("execution_interrupted", reset); 
        api.addEventListener("execution_error", reset);
        api.addEventListener("executing", ({ detail }) => { 
            if (detail === null) reset(); 
            else { 
                isQueueActive = true; 
                app.graph._nodes.forEach(n => { if(n.type === "NeoChooser") n.setDirtyCanvas(true); }); 
            } 
        });
    },

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "NeoChooser") {
            
            nodeType.prototype.onNodeCreated = function () {
                this.title = "Neo Image Chooser 👁️"; 
                this.properties = this.properties || { sound_index: 0, volume_index: 5, show_preview: true };
                this.size = [350, 320]; 
                this.is_paused = false; 
                this.neo_images = []; 
                this.neo_selected = new Set(); 
                this.last_click_time = 0;
            };

            nodeType.prototype.sendReply = async function(action) {
                this.is_paused = false; 
                if (action === "cancel") api.interrupt();
                await api.fetchApi("/neo_chooser/reply", { 
                    method: "POST", 
                    body: JSON.stringify({ node_id: String(this.id), action, selected: Array.from(this.neo_selected) }) 
                });
                this.setDirtyCanvas(true);
            };

            nodeType.prototype.onDrawBackground = function (ctx) {
                if (this.flags && this.flags.collapsed) return;
                
                const [w, h] = this.size; 
                const active = this.is_paused && this.neo_images.length > 0; 
                
                const padding = 3; 
                drawCleanNeonRect(ctx, padding, padding, w - padding*2, h - padding*2, 6, "#0b0b0e", 0, true);

                // --- ЗВУКОВАЯ ПАНЕЛЬ ---
                const cY = (h < 130) ? padding + 22 : padding + 35; 
                const bH = 26; 
                const vW = 80; 
                const tX = padding + 8; 
                const vX = w - padding - 8 - vW; 
                const tW = vX - tX - 12;

                drawCleanNeonRect(ctx, tX, cY, tW, bH, 4, "#2a2a35");
                drawCleanNeonRect(ctx, vX, cY, vW, bH, 4, "#2a2a35");
                
                this.btn_prev_rect = { x: tX, y: cY, w: 24, h: bH }; 
                this.btn_next_rect = { x: tX + tW - 24, y: cY, w: 24, h: bH };
                
                drawCleanNeonText(ctx, "◀", tX + 12, cY + bH/2 + 1, "#777788", 12);
                drawCleanNeonText(ctx, "▶", tX + tW - 12, cY + bH/2 + 1, "#777788", 12);
                
                drawCleanNeonText(ctx, available_sounds[this.properties.sound_index] || "...", tX + tW/2, cY + bH/2 + 1, "#00cc88", 14, false, "center", tW - 60);
                
                this.vol_bars_rects = [];
                for (let i = 1; i <= 10; i++) {
                    const bx = vX + 6 + (i-1)*7; 
                    const bh = 6 + (14-6)*((i-1)/9);
                    this.vol_bars_rects.push({ x: bx-1, y: cY, w: 7, h: bH, idx: i });
                    ctx.fillStyle = (this.properties.volume_index >= i) ? "#00cc88" : "#1a1a25";
                    ctx.fillRect(bx, cY + (bH-bh)/2, 5, bh);
                }

                // --- ПРЕВЬЮ ---
                const togY = cY + bH + 12; 
                this.toggle_preview_rect = { x: padding + 8, y: togY, w: 100, h: 14 };
                drawCleanNeonText(ctx, (this.properties.show_preview ? "☑" : "☐") + " SHOW PREVIEW", padding+8, togY+7, this.properties.show_preview ? "#00cc88" : "#777788", 10, false, "left");
                
                if (this.properties.show_preview && this.neo_images.length > 0) {
                    const sY = (h < 130) ? togY + 10 : togY + 22; 
                    const avH = h - padding - sY - 60;
                    if (avH > 20) {
                        const count = this.neo_images.length; 
                        const cols = Math.ceil(Math.sqrt(count)); 
                        const rows = Math.ceil(count/cols);
                        const cellW = (w - padding*2 - 16)/cols; 
                        const cellH = avH/rows; 
                        this.image_rects = [];
                        
                        this.neo_images.forEach((img, i) => {
                            if (!img.img.complete) return; 
                            const r = Math.min((cellW-6)/img.img.width, (cellH-6)/img.img.height);
                            const dW = img.img.width*r; 
                            const dH = img.img.height*r;
                            const dX = padding+8 + (i%cols)*cellW + (cellW-dW)/2; 
                            const dY = sY + Math.floor(i/cols)*cellH + (cellH-dH)/2;
                            this.image_rects.push({ x: dX, y: dY, w: dW, h: dH, idx: i });
                            
                            drawCleanNeonRect(ctx, dX-1, dY-1, dW+2, dH+2, 2, "#333345", 2); 
                            ctx.drawImage(img.img, dX, dY, dW, dH);
                            if (this.neo_selected.has(i)) { 
                                drawCleanNeonRect(ctx, dX-1, dY-1, dW+2, dH+2, 2, "#00cc88", 6); 
                                ctx.fillStyle = "rgba(0, 204, 136, 0.15)"; 
                                ctx.fillRect(dX, dY, dW, dH); 
                            }
                        });
                    }
                }

                // --- КНОПКИ УПРАВЛЕНИЯ ---
                const btnH = (h < 130) ? 24 : 30; 
                const btnY = h - padding - btnH - 12;
                const textYOffset = 2;

                if (active) {
                    this.btn_run_rect = null; 

                    const bw = (w - padding*2 - 26)/2; 
                    this.btn_cancel_rect = { x: padding+8, y: btnY, w: bw, h: btnH }; 
                    this.btn_continue_rect = { x: padding+bw+18, y: btnY, w: bw, h: btnH };
                    
                    drawCleanNeonRect(ctx, this.btn_cancel_rect.x, btnY, bw, btnH, 15, "#cc4444", 4); 
                    drawCleanNeonText(ctx, "CANCEL", this.btn_cancel_rect.x+bw/2, btnY+btnH/2 + textYOffset, "#cc4444", 13, true);
                    
                    drawCleanNeonRect(ctx, this.btn_continue_rect.x, btnY, bw, btnH, 15, "#00cc88", 4); 
                    const txt = (this.neo_selected.size > 0 ? `CONTINUE (${this.neo_selected.size})` : "SKIP");
                    drawCleanNeonText(ctx, txt, this.btn_continue_rect.x+bw/2, btnY+btnH/2 + textYOffset, "#00cc88", 13, true);
                } else {
                    this.btn_cancel_rect = null; 
                    this.btn_continue_rect = null;

                    const bw = w - padding*2 - 16; 
                    this.btn_run_rect = { x: padding+8, y: btnY, w: bw, h: btnH };
                    
                    const isPr = (Date.now() - this.last_click_time) < 120; 
                    const off = isPr ? 2 : 0;
                    let col = isQueueActive ? "#ffaa00" : "#4488ff"; 
                    if (isPr) col = isQueueActive ? "#885500" : "#224488";
                    
                    drawCleanNeonRect(ctx, padding+8, btnY + off, bw, btnH, 15, col, isPr ? 0 : (isQueueActive ? 3+Math.sin(Date.now()/200)*2 : 4));
                    drawCleanNeonText(ctx, isQueueActive ? "ADD TO QUEUE" : "RUN GENERATION", padding+8+bw/2, btnY + bH/2 + off + textYOffset, col, 13, true);
                    
                    if (isQueueActive || isPr) this.setDirtyCanvas(true);
                }
            };

            nodeType.prototype.onMouseDown = function (e, pos) {
                const [x, y] = pos;
                
                if (this.btn_run_rect && x >= this.btn_run_rect.x && x <= this.btn_run_rect.x + this.btn_run_rect.w && y >= this.btn_run_rect.y && y <= this.btn_run_rect.y + this.btn_run_rect.h) { 
                    this.last_click_time = Date.now(); 
                    app.queuePrompt(0); 
                    this.setDirtyCanvas(true);
                    return true; 
                }
                
                if (this.toggle_preview_rect && x >= this.toggle_preview_rect.x && x <= this.toggle_preview_rect.x+this.toggle_preview_rect.w && y >= this.toggle_preview_rect.y && y <= this.toggle_preview_rect.y+this.toggle_preview_rect.h) { 
                    this.properties.show_preview = !this.properties.show_preview; 
                    this.size[1] = this.properties.show_preview ? 320 : 150; 
                    this.setDirtyCanvas(true);
                    return true; 
                }
                
                // ИСПРАВЛЕНО: добавлена проверка по Y
                if (this.btn_prev_rect && x >= this.btn_prev_rect.x && x <= this.btn_prev_rect.x+this.btn_prev_rect.w && y >= this.btn_prev_rect.y && y <= this.btn_prev_rect.y+this.btn_prev_rect.h) { 
                    this.properties.sound_index = (this.properties.sound_index - 1 + available_sounds.length) % available_sounds.length; 
                    this.setDirtyCanvas(true);
                    return true; 
                }
                // ИСПРАВЛЕНО: добавлена проверка по Y
                if (this.btn_next_rect && x >= this.btn_next_rect.x && x <= this.btn_next_rect.x+this.btn_next_rect.w && y >= this.btn_next_rect.y && y <= this.btn_next_rect.y+this.btn_next_rect.h) { 
                    this.properties.sound_index = (this.properties.sound_index + 1) % available_sounds.length; 
                    this.setDirtyCanvas(true);
                    return true; 
                }
                // ИСПРАВЛЕНО: добавлена проверка по Y
                for (let b of (this.vol_bars_rects || [])) { 
                    if (x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h) { 
                        this.properties.volume_index = b.idx; 
                        this.setDirtyCanvas(true);
                        return true; 
                    } 
                }
                
                if (this.is_paused) {
                    for (let r of (this.image_rects || [])) { 
                        if (x >= r.x && x <= r.x+r.w && y >= r.y && y <= r.y+r.h) { 
                            if (this.neo_selected.has(r.idx)) this.neo_selected.delete(r.idx); 
                            else this.neo_selected.add(r.idx); 
                            this.setDirtyCanvas(true);
                            return true; 
                        } 
                    }
                    if (this.btn_continue_rect && x >= this.btn_continue_rect.x && x <= this.btn_continue_rect.x+this.btn_continue_rect.w && y >= this.btn_continue_rect.y && y <= this.btn_continue_rect.y+this.btn_continue_rect.h) { 
                        this.sendReply("continue"); 
                        return true; 
                    }
                    if (this.btn_cancel_rect && x >= this.btn_cancel_rect.x && x <= this.btn_cancel_rect.x+this.btn_cancel_rect.w && y >= this.btn_cancel_rect.y && y <= this.btn_cancel_rect.y+this.btn_cancel_rect.h) { 
                        this.sendReply("cancel"); 
                        return true; 
                    }
                }
            };
        }
    }
});