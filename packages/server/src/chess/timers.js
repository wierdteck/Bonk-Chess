export class GameTimers {
  constructor({ gameId, initialSeconds = 600, incrementSeconds = 5, onTick, onTimeout }) {
    this.gameId = gameId;
    this.initialSeconds = initialSeconds;
    this.whiteSeconds = initialSeconds;
    this.blackSeconds = initialSeconds;
    this.increment = incrementSeconds;
    this.active = null; // 'white' | 'black' | null
    this.interval = null;
    this.onTick = onTick;
    this.onTimeout = onTimeout;
  }

  start(activeColor) {
    if (this.interval) clearInterval(this.interval);
    this.active = activeColor;
    this.interval = setInterval(() => this.tick(), 1000);
    // immediate tick to update UI
    this._emitTick();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.active = null;
  }

  tick() {
    if (!this.active) return;
    if (this.active === 'white') {
      this.whiteSeconds -= 1;
      if (this.whiteSeconds <= 0) {
        this.whiteSeconds = 0;
        this._emitTick();
        this._timeout('white');
        return;
      }
    } else {
      this.blackSeconds -= 1;
      if (this.blackSeconds <= 0) {
        this.blackSeconds = 0;
        this._emitTick();
        this._timeout('black');
        return;
      }
    }
    this._emitTick();
  }

  switchTurn() {
    // add increment to player who just moved (i.e. the one not active now)
    if (this.active === 'white') {
      this.whiteSeconds += this.increment;
      this.active = 'black';
    } else if (this.active === 'black') {
      this.blackSeconds += this.increment;
      this.active = 'white';
    } else {
      // not running; start running to other side
      this.active = this.active === 'white' ? 'black' : 'white';
    }
    if (!this.interval) {
      this.interval = setInterval(() => this.tick(), 1000);
    }
    this._emitTick();
  }

  _timeout(color) {
    this.stop();
    if (this.onTimeout) this.onTimeout(this.gameId, color);
  }

  _emitTick() {
    if (this.onTick) {
      this.onTick(this.gameId, {
        whiteSeconds: this.whiteSeconds,
        blackSeconds: this.blackSeconds,
        active: this.active
      });
    }
  }
}