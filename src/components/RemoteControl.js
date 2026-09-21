export class RemoteControl {
  constructor(onChannelTuneCallback, showToastCallback) {
    this.onChannelTuneCallback = onChannelTuneCallback;
    this.showToastCallback = showToastCallback;

    this.isPlaying = false;
    this.flircEnabled = true;
    this.currentDigitBuffer = '';
    this.digitTimeout = null;

    this.initElements();
    this.initEvents();
    this.initKeyboardRemoteListener();
    this.pollStatus();
    this.checkFlircStatus();
    this.checkOsdStatus();
  }

  initElements() {
    this.btnPower = document.getElementById('remote-btn-power');
    this.powerStatusBadge = document.getElementById('remote-power-status');
    this.btnChUp = document.getElementById('remote-btn-ch-up');
    this.btnChDown = document.getElementById('remote-btn-ch-down');
    this.btnGuide = document.getElementById('remote-btn-guide');
    this.btnVolUp = document.getElementById('remote-btn-vol-up');
    this.btnVolDown = document.getElementById('remote-btn-vol-down');
    this.btnMute = document.getElementById('remote-btn-mute');
    this.digitDisplay = document.getElementById('remote-digit-display');

    // FLIRC & OSD Elements
    this.chkFlirc = document.getElementById('chk-enable-flirc');
    this.chkHeaderFlirc = document.getElementById('chk-header-flirc');
    this.chkHeaderOsd = document.getElementById('chk-header-osd');
    this.btnTestOsd = document.getElementById('btn-test-osd');
    this.btnFlircInfo = document.getElementById('btn-flirc-info');
    this.flircStatusBadge = document.getElementById('flirc-status-badge');
    this.modalFlirc = document.getElementById('modal-flirc-setup');
    this.modalFlircClose = document.getElementById('modal-flirc-close');
    this.modalFlircOk = document.getElementById('modal-flirc-ok');
  }

  initEvents() {
    if (this.btnPower) {
      this.btnPower.addEventListener('click', () => this.togglePower());
    }

    if (this.btnChUp) {
      this.btnChUp.addEventListener('click', () => {
        if (typeof this.currentChannelNumber === 'number') {
          this.currentChannelNumber++;
        } else {
          this.currentChannelNumber = 5;
        }
        if (this.digitDisplay) {
          this.digitDisplay.textContent = `CH ${String(this.currentChannelNumber).padStart(2, '0')}`;
        }
        this.sendChannelCommand('up');
      });
    }

    if (this.btnChDown) {
      this.btnChDown.addEventListener('click', () => {
        if (typeof this.currentChannelNumber === 'number' && this.currentChannelNumber > 1) {
          this.currentChannelNumber--;
        } else {
          this.currentChannelNumber = 2;
        }
        if (this.digitDisplay) {
          this.digitDisplay.textContent = `CH ${String(this.currentChannelNumber).padStart(2, '0')}`;
        }
        this.sendChannelCommand('down');
      });
    }

    if (this.btnGuide) {
      this.btnGuide.addEventListener('click', () => this.sendChannelCommand('guide'));
    }

    if (this.btnVolUp) {
      this.btnVolUp.addEventListener('click', () => this.sendVolumeCommand('up'));
    }

    if (this.btnVolDown) {
      this.btnVolDown.addEventListener('click', () => this.sendVolumeCommand('down'));
    }

    if (this.btnMute) {
      this.btnMute.addEventListener('click', () => this.sendVolumeCommand('mute'));
    }

    // Keypad digits 0-9
    const digitBtns = document.querySelectorAll('.remote-key-num');
    digitBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const digit = btn.dataset.num;
        this.pressDigit(digit);
      });
    });

    const btnClear = document.getElementById('remote-btn-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.currentDigitBuffer = '';
        if (this.digitDisplay) this.digitDisplay.textContent = '--';
      });
    }

    const btnEnter = document.getElementById('remote-btn-enter');
    if (btnEnter) {
      btnEnter.addEventListener('click', () => {
        if (this.currentDigitBuffer.length > 0) {
          const chNum = parseInt(this.currentDigitBuffer, 10);
          this.tuneDirect(chNum);
          this.currentDigitBuffer = '';
        }
      });
    }

    // FLIRC Controls
    if (this.chkFlirc) {
      this.chkFlirc.addEventListener('change', (e) => {
        this.toggleFlircListener(e.target.checked);
      });
    }

    if (this.chkHeaderFlirc) {
      this.chkHeaderFlirc.addEventListener('change', (e) => {
        this.toggleFlircListener(e.target.checked);
      });
    }

    if (this.chkHeaderOsd) {
      this.chkHeaderOsd.addEventListener('change', (e) => {
        this.toggleOsd(e.target.checked);
      });
    }

    if (this.btnTestOsd) {
      this.btnTestOsd.addEventListener('click', () => {
        this.testOsd();
      });
    }

    if (this.btnFlircInfo) {
      this.btnFlircInfo.addEventListener('click', () => {
        if (this.modalFlirc) this.modalFlirc.classList.remove('hidden');
      });
    }

    if (this.modalFlircClose) {
      this.modalFlircClose.addEventListener('click', () => {
        if (this.modalFlirc) this.modalFlirc.classList.add('hidden');
      });
    }

    if (this.modalFlircOk) {
      this.modalFlircOk.addEventListener('click', () => {
        if (this.modalFlirc) this.modalFlirc.classList.add('hidden');
      });
    }
  }

  initKeyboardRemoteListener() {
    window.addEventListener('keydown', (e) => {
      if (!this.flircEnabled) return;

      // Ignore if user is currently typing in an input field or text area
      const activeEl = document.activeElement;
      if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) {
        return;
      }
      if (activeEl && activeEl.isContentEditable) {
        return;
      }

      const key = e.key;

      // Channel Up
      if (key === 'PageUp' || (key === 'ArrowUp' && e.altKey)) {
        e.preventDefault();
        this.btnChUp?.click();
      }
      // Channel Down
      else if (key === 'PageDown' || (key === 'ArrowDown' && e.altKey)) {
        e.preventDefault();
        this.btnChDown?.click();
      }
      // Volume Up
      else if (key === 'AudioVolumeUp' || key === '+' || key === '=') {
        e.preventDefault();
        this.sendVolumeCommand('up');
      }
      // Volume Down
      else if (key === 'AudioVolumeDown' || key === '-') {
        e.preventDefault();
        this.sendVolumeCommand('down');
      }
      // Mute
      else if (key === 'AudioVolumeMute' || key === 'm' || key === 'M') {
        e.preventDefault();
        this.sendVolumeCommand('mute');
      }
      // Keypad 0-9
      else if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        this.pressDigit(key);
      }
      // TV Guide
      else if (key === 'g' || key === 'G') {
        e.preventDefault();
        this.sendChannelCommand('guide');
      }
    });
  }

  async toggleFlircListener(enabled) {
    this.flircEnabled = enabled;
    try {
      const res = await fetch('/api/flirc/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      this.updateFlircStatusUI(data);

      if (this.showToastCallback) {
        this.showToastCallback(
          enabled ? 'FLIRC Remote Receiver Enabled' : 'FLIRC Remote Receiver Disabled',
          enabled ? 'success' : 'info'
        );
      }
    } catch (e) {
      // Local fallback state
      this.updateFlircStatusUI({ enabled, device: { connected: true, has_permission: false } });
    }
  }

  async checkFlircStatus() {
    try {
      const res = await fetch('/api/flirc/status');
      if (res.ok) {
        const data = await res.json();
        this.flircEnabled = data.enabled;
        if (this.chkFlirc) this.chkFlirc.checked = data.enabled;
        this.updateFlircStatusUI(data);
      }
    } catch (e) {
      // Ignore offline error
    }
  }

  updateFlircStatusUI(data) {
    if (this.chkFlirc) this.chkFlirc.checked = !!data.enabled;
    if (this.chkHeaderFlirc) this.chkHeaderFlirc.checked = !!data.enabled;

    if (!this.flircStatusBadge) return;

    if (!data.enabled) {
      this.flircStatusBadge.innerHTML = `<span class="dot"></span> Listener Disabled`;
      return;
    }

    const device = data.device || {};
    if (device.connected && device.has_permission) {
      this.flircStatusBadge.innerHTML = `<span class="dot online"></span> FLIRC Active (Web & evdev)`;
    } else if (device.connected) {
      this.flircStatusBadge.innerHTML = `<span class="dot online"></span> FLIRC Active (Web Receiver)`;
    } else {
      this.flircStatusBadge.innerHTML = `<span class="dot warn"></span> FLIRC Active (Web Listener)`;
    }
  }

  async checkOsdStatus() {
    try {
      const res = await fetch('/api/osd/status');
      if (res.ok) {
        const data = await res.json();
        if (this.chkHeaderOsd) this.chkHeaderOsd.checked = !!data.enabled;
      }
    } catch (e) {
      // Ignore offline error
    }
  }

  async toggleOsd(enabled) {
    try {
      const res = await fetch('/api/osd/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      if (this.chkHeaderOsd) this.chkHeaderOsd.checked = !!data.enabled;
      if (this.showToastCallback) {
        this.showToastCallback(
          data.running ? 'FieldStation42 OSD Overlay Active' : 'FieldStation42 OSD Overlay Stopped',
          data.running ? 'success' : 'info'
        );
      }
    } catch (e) {
      if (this.showToastCallback) {
        this.showToastCallback(`OSD toggle error: ${e.message}`, 'error');
      }
    }
  }

  async testOsd() {
    try {
      const res = await fetch('/api/osd/test', { method: 'POST' });
      const data = await res.json();
      if (data.success && this.showToastCallback) {
        this.showToastCallback('Triggered OSD Test Overlay Signal!', 'success');
      }
    } catch (e) {
      if (this.showToastCallback) {
        this.showToastCallback('Failed to send OSD test signal', 'error');
      }
    }
  }

  async pollStatus() {
    try {
      const res = await fetch('/api/player/status');
      if (res.ok) {
        const data = await res.json();
        this.isPlaying = data.running;
        this.updatePowerUI(data);

        if (data.current_channel !== null && data.current_channel !== undefined) {
          this.currentChannelNumber = data.current_channel;
          if (this.digitDisplay && !this.currentDigitBuffer) {
            this.digitDisplay.textContent = `CH ${String(data.current_channel).padStart(2, '0')}`;
          }
        }
      }
    } catch (e) {
      // Offline fallback
    }
    setTimeout(() => this.pollStatus(), 2000);
  }

  updatePowerUI(data) {
    if (this.powerStatusBadge) {
      if (this.isPlaying) {
        this.powerStatusBadge.textContent = 'BROADCASTING LIVE';
        this.powerStatusBadge.className = 'remote-status live';
      } else {
        this.powerStatusBadge.textContent = 'STANDBY';
        this.powerStatusBadge.className = 'remote-status standby';
      }
    }

    if (this.btnPower) {
      this.btnPower.classList.toggle('power-on', this.isPlaying);
    }
  }

  async togglePower() {
    const endpoint = this.isPlaying ? '/api/player/stop' : '/api/player/start';
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        this.isPlaying = !this.isPlaying;
        this.updatePowerUI({ running: this.isPlaying });
        if (this.showToastCallback) {
          this.showToastCallback(
            this.isPlaying ? 'Started FieldStation42 Playback!' : 'Stopped Playback',
            this.isPlaying ? 'success' : 'info'
          );
        }
      }
    } catch (err) {
      if (this.showToastCallback) {
        this.showToastCallback(`Power Toggle Error: ${err.message}`, 'error');
      }
    }
  }

  async sendChannelCommand(cmdType, channelNum = null) {
    try {
      const payload = { command: cmdType };
      if (channelNum !== null) {
        payload.channel = channelNum;
      }

      const res = await fetch('/api/player/channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success && this.showToastCallback) {
        const desc = cmdType === 'direct' ? `Tuned to CH ${channelNum}` : `Channel ${cmdType.toUpperCase()}`;
        this.showToastCallback(`TV Remote: ${desc}`, 'success');
      }
    } catch (e) {
      if (this.showToastCallback) {
        this.showToastCallback('Remote signal error', 'error');
      }
    }
  }

  async sendVolumeCommand(action) {
    try {
      const res = await fetch('/api/player/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok && this.showToastCallback) {
        this.showToastCallback(`Volume: ${action.toUpperCase()}`, 'info');
      }
    } catch (e) {
      // Ignore
    }
  }

  pressDigit(digit) {
    if (this.currentDigitBuffer.length >= 3) {
      this.currentDigitBuffer = digit;
    } else {
      this.currentDigitBuffer += digit;
    }

    if (this.digitDisplay) {
      this.digitDisplay.textContent = `CH ${this.currentDigitBuffer}`;
    }

    clearTimeout(this.digitTimeout);
    this.digitTimeout = setTimeout(() => {
      if (this.currentDigitBuffer.length > 0) {
        const chNum = parseInt(this.currentDigitBuffer, 10);
        this.tuneDirect(chNum);
        this.currentDigitBuffer = '';
      }
    }, 1500);
  }

  tuneDirect(channelNum) {
    this.sendChannelCommand('direct', channelNum);
    if (this.digitDisplay) {
      this.digitDisplay.textContent = `CH ${String(channelNum).padStart(2, '0')}`;
    }
  }
}

