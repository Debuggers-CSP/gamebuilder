import GameObject from '../BetterGameEngine/essentials/GameObject.js';

class Barrier extends GameObject {
    constructor(data = {}, gameEnv = null) {
        super(gameEnv);
        this.spriteData = data || {};
        this.id = this.spriteData.id || 'wall';
        this.visible = !!this.spriteData.visible;
        // Optional list of pass-through rectangles relative to barrier origin
        // Each item: { x, y, width, height }
        this.spriteData.passZones = Array.isArray(this.spriteData.passZones) ? this.spriteData.passZones : [];
        const width = Number(this.spriteData.width || 50);
        const height = Number(this.spriteData.height || 50);
        // Create an invisible canvas used only for collision bounds
        this.canvas = document.createElement('canvas');
        this.canvas.id = this.id;
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');
        // Explicit engine-space dimensions for collision math
        this.width = width;
        this.height = height;
        this.gameEnv.container.appendChild(this.canvas);
        // Place using transform to align with existing engine conventions
        this.transform = { x: Number(this.spriteData.x || 0), y: Number(this.spriteData.y || 0), xv: 0, yv: 0 };
        // Full-rect collisions by default
        this.hitbox = this.spriteData.hitbox || { widthPercentage: 0.0, heightPercentage: 0.0 };
        // Initialize CSS positioning immediately to ensure correct collision rects
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = `${this.transform.x}px`;
        this.canvas.style.top = `${this.gameEnv.top + this.transform.y}px`;
        this.canvas.style.width = `${this.canvas.width}px`;
        this.canvas.style.height = `${this.canvas.height}px`;
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = this.spriteData.zIndex !== undefined ? String(this.spriteData.zIndex) : '5';
        this.resize();
        // Ensure initial draw establishes canvas state
        this.draw();
    }

    update() {
        this.draw();
    }

    draw() {
        // Position the collision canvas; draw only if editing/visible
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = `${this.transform.x}px`;
        this.canvas.style.pointerEvents = 'none';
        // Align barrier canvas with game area offset consistently
        this.canvas.style.top = `${this.gameEnv.top + this.transform.y}px`;
        this.canvas.style.width = `${this.canvas.width}px`;
        this.canvas.style.height = `${this.canvas.height}px`;
        this.canvas.style.zIndex = this.spriteData.zIndex !== undefined ? String(this.spriteData.zIndex) : '5';

        if (this.visible) {
            // Show a subtle edit overlay when selected/edited in builder
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--pref-accent-color').trim() || '#ffd700';
            
            // Draw solid red fill + border to indicate full collision area
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.strokeStyle = accentColor;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

            // Optionally visualize pass-through zones when visible
            if (this.spriteData.passZones && this.spriteData.passZones.length) {
                this.ctx.save();
                this.ctx.globalAlpha = 0.25;
                this.ctx.fillStyle = '#2e7bf7'; // blue overlay for pass-through
                for (const zone of this.spriteData.passZones) {
                    const zx = Number(zone.x) || 0;
                    const zy = Number(zone.y) || 0;
                    const zw = Number(zone.width) || 0;
                    const zh = Number(zone.height) || 0;
                    this.ctx.fillRect(zx, zy, zw, zh);
                }
                this.ctx.restore();
            }
            this.canvas.style.opacity = '1';
        } else {
            // Invisible in runner; collision still works via canvas bounds
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.canvas.style.opacity = '0';
        }
    }

    resize() {
        // Keep absolute pixel sizing; collisions rely on canvas bounds.
        // If needed, proportional scaling can be added later.
    }

    destroy() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        const idx = this.gameEnv.gameObjects.indexOf(this);
        if (idx !== -1) this.gameEnv.gameObjects.splice(idx, 1);
    }
}

export default Barrier;
