import Character from '../essentials/Character.js';
import TouchControls from '../features/TouchControls.js';


// Define non-mutable constants as defaults
const SCALE_FACTOR = 25; // 1/nth of the height of the canvas
const STEP_FACTOR = 100; // 1/nth, or N steps up and across the canvas
const ANIMATION_RATE = 1; // 1/nth of the frame rate
const INIT_POSITION = { x: 0, y: 0 };


class Player extends Character {
    // Static counter for unique player IDs (uninitialized)
    static playerCount;
    /**
     * The constructor method is called when a new Player object is created.
     * 
     * @param {Object|null} data - The sprite data for the object. If null, a default red square is used.
     */
    constructor(data = null, gameEnv = null) {
        super(data, gameEnv);
        // Increment static player counter and assign unique id
        Player.playerCount = (Player.playerCount || 0) + 1;
        this.id = data?.id ? data.id.toLowerCase() : `player${Player.playerCount}`;
        this.keypress = data?.keypress || {up: 87, left: 65, down: 83, right: 68};
        this.touchOptions = data?.touchOptions || {interactLabel: "e", position: "left"};
        this.touchOptions.id = `touch-controls-${this.id}`;
        this.touchOptions.mapping = this.keypress;
        this.pressedKeys = {}; // active keys array
        this.bindMovementKeyListners();
        this.gravity = data.GRAVITY || false;
        this.acceleration = 1;
        this.time = 0;
        this.moved = false;
        // Initialize touch controls for mobile devices
        this.touchControls = new TouchControls(gameEnv, this.touchOptions);
    }

    /**
     * Binds key event listeners to handle object movement.
     * 
     * This method binds keydown and keyup event listeners to handle object movement.
     * The .bind(this) method ensures that 'this' refers to the object object.
     */
    bindMovementKeyListners() {
        addEventListener('keydown', this.handleKeyDown.bind(this));
        addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    handleKeyDown({ keyCode }) {
        // capture the pressed key in the active keys array
        this.pressedKeys[keyCode] = true;
        // set the velocity and direction based on the newly pressed key
        this.updateVelocity();
        this.updateDirection();
    }

    /**
     * Handles key up events to stop the player's velocity.
     * 
     * This method stops the player's velocity based on the key released.
     * 
     * @param {Object} event - The keyup event object.
     */
    handleKeyUp({ keyCode }) {
        // remove the lifted key from the active keys array
        if (keyCode in this.pressedKeys) {
            delete this.pressedKeys[keyCode];
        }
        // adjust the velocity and direction based on the remaining keys
        this.updateDirection();
    }

    /**
     * Update the player's velocity and direction based on the pressed keys.
     */

    updateVelocity() {
        this.moved = false;
        const mv = (this.state && this.state.movement) ? this.state.movement : { up: true, down: true, left: true, right: true };

        if (this.pressedKeys[this.keypress.right] || this.pressedKeys[this.keypress.left]) {
            this.moved = true;

            if (this.pressedKeys[this.keypress.right]) {
                if (mv.right) {
                    this.transform.xv += 1.2 * this.time;
                } else {
                    // Block pushing into collision from the right
                    this.transform.xv = Math.min(0, this.transform.xv);
                }
            }
            else if (this.pressedKeys[this.keypress.left]) {
                if (mv.left) {
                    this.transform.xv -= 1.2 * this.time;
                } else {
                    // Block pushing into collision from the left
                    this.transform.xv = Math.max(0, this.transform.xv);
                }
            }
        }

        if (this.pressedKeys[this.keypress.up] || this.pressedKeys[this.keypress.down]) {
            this.moved = true;

            if (this.pressedKeys[this.keypress.up]) {
                if (mv.up) {
                    this.transform.yv -= 1.2 * this.time;
                } else {
                    // Block pushing into collision from above
                    this.transform.yv = Math.max(0, this.transform.yv);
                }
            }
            else if (this.pressedKeys[this.keypress.down]) {
                if (mv.down) {
                    this.transform.yv += 0.6 * this.time;
                } else {
                    // Block pushing into collision from below
                    this.transform.yv = Math.min(0, this.transform.yv);
                }
            }
        }

        this.transform.xv *= 0.7;
        this.transform.yv *= 0.7;
    }

    updateDirection() {       
        // Single-key movement
        if (this.pressedKeys[this.keypress.up]) {
            this.direction = "up";
        } else if (this.pressedKeys[this.keypress.down]) {
            this.direction = "down";
        } else if (this.pressedKeys[this.keypress.right]) {
            this.direction = "right";
        } else if (this.pressedKeys[this.keypress.left]) {
            this.direction = "left";
        }

        // Multi-key movement
        if (this.pressedKeys[this.keypress.left] && this.pressedKeys[this.keypress.up]) {
            this.direction = "upLeft";
        } else if (this.pressedKeys[this.keypress.left] && this.pressedKeys[this.keypress.down]) {
            this.direction = "downLeft";
        } else if (this.pressedKeys[this.keypress.right] && this.pressedKeys[this.keypress.up]) {
            this.direction = "upRight";
        } else if (this.pressedKeys[this.keypress.right] && this.pressedKeys[this.keypress.down]) {
            this.direction = "downRight";
        }
    }

    update() {
        this.updateVelocity();
        // Save previous position before applying velocity
        const prevX = this.transform.x;
        const prevY = this.transform.y;
        
        // Apply gravity before position update (which super.update will handle)
        if(!this.moved){
            if (this.gravity) {
                    this.time += 1;
                    this.transform.yv -= this.acceleration * -this.time;
                }
            }
        else{
            this.time = 1;
        }

        // Apply velocity to position
        this.transform.x += this.transform.xv * this.time;
        this.transform.y += this.transform.yv * this.time;
        
        // Apply walking area boundaries if defined in sprite data
        if (this.data && this.data.walkingArea) {
            const walkingArea = this.data.walkingArea;
            
            if (this.transform.x < walkingArea.xMin) {
                this.transform.x = walkingArea.xMin;
                this.transform.xv = 0;
            }
            if (this.transform.x + this.width > walkingArea.xMax) {
                this.transform.x = walkingArea.xMax - this.width;
                this.transform.xv = 0;
            }
            if (this.transform.y < walkingArea.yMin) {
                this.transform.y = walkingArea.yMin;
                this.transform.yv = 0;
            }
            if (this.transform.y + this.height > walkingArea.yMax) {
                this.transform.y = walkingArea.yMax - this.height;
                this.transform.yv = 0;
            }
        }
        
        // Call super.update() to handle collision checks and rendering
        super.update();

        // If collision detected, revert only the axis pushing into the collision (no teleport sticking)
        if (this.state && Array.isArray(this.state.collisionEvents) && this.state.collisionEvents.length > 0) {
            const mv = (this.state && this.state.movement) ? this.state.movement : { up: true, down: true, left: true, right: true };
            const dx = this.transform.x - prevX;
            const dy = this.transform.y - prevY;
            // Horizontal correction: if pushing into blocked side, revert X
            if ((!mv.right && dx > 0) || (!mv.left && dx < 0)) {
                this.transform.x = prevX;
                this.transform.xv = 0;
            }
            // Vertical correction: if pushing into blocked side, revert Y
            if ((!mv.down && dy > 0) || (!mv.up && dy < 0)) {
                this.transform.y = prevY;
                this.transform.yv = 0;
            }
        }
    }
        
    /**
     * Overrides the reaction to the collision to handle
     *  - clearing the pressed keys array
     *  - stopping the player's velocity
     *  - updating the player's direction   
     * @param {*} other - The object that the player is colliding with
     */
    handleCollisionReaction(other) {    
        // Do not clear pressed keys; simply stop current movement
        this.transform.xv = 0;
        this.transform.yv = 0;
        super.handleCollisionReaction(other);
    }

    /**
     * Toggle touch controls visibility (useful for debugging or user preference)
     */
    toggleTouchControls() {
        if (this.touchControls) {
            this.touchControls.toggle();
        }
    }

    /**
     * Show touch controls explicitly
     */
    showTouchControls() {
        if (this.touchControls) {
            this.touchControls.show();
        }
    }

    /**
     * Hide touch controls explicitly  
     */
    hideTouchControls() {
        if (this.touchControls) {
            this.touchControls.hide();
        }
    }

    /**
     * Show the interact button when near an NPC
     */
    showInteractButton() {
        if (this.touchControls) {
            this.touchControls.showInteractButton();
        }
    }

    /**
     * Hide the interact button when not near an NPC
     */
    hideInteractButton() {
        if (this.touchControls) {
            this.touchControls.hideInteractButton();
        }
    }

    /**
     * Check if interact button is currently visible
     */
    isInteractButtonVisible() {
        return this.touchControls ? this.touchControls.isInteractButtonVisible() : false;
    }

    /**
     * Clean up resources when player is destroyed
     */
    destroy() {
        if (this.touchControls) {
            this.touchControls.destroy();
        }
        super.destroy?.();
    }


}

export default Player;