export class ChannelEditor {
  constructor(onChannelUpdatedCallback, onSaveCallback, onDeleteCallback, onDuplicateCallback) {
    this.onChannelUpdatedCallback = onChannelUpdatedCallback;
    this.onSaveCallback = onSaveCallback;
    this.onDeleteCallback = onDeleteCallback;
    this.onDuplicateCallback = onDuplicateCallback;

    this.currentChannel = null;
    this.activeTab = 'tab-general';
    this.isUpdatingFromForm = false;
    this.isUpdatingFromCode = false;

    this.initTabs();
    this.initFormBindings();
    this.initJsonInspector();
    this.initActionButtons();
  }

  initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const targetTab = btn.dataset.tab;
        this.activeTab = targetTab;
        document.querySelectorAll('.tab-pane').forEach(pane => {
          pane.classList.toggle('active', pane.id === targetTab);
        });

        if (targetTab === 'tab-code') {
          this.syncJsonCodeFromModel();
        } else if (targetTab === 'tab-epg') {
          this.loadUpcomingSchedule();
        } else if (targetTab === 'tab-ppv') {
          this.loadPpvCatalog();
        }
      });
    });

    const btnRefreshEpg = document.getElementById('btn-refresh-epg-schedule');
    if (btnRefreshEpg) {
      btnRefreshEpg.addEventListener('click', () => this.loadUpcomingSchedule());
    }

    const btnRebuildEpg = document.getElementById('btn-rebuild-epg-catalog');
    if (btnRebuildEpg) {
      btnRebuildEpg.addEventListener('click', () => this.rebuildCurrentChannelCatalog());
    }

    const btnRebuildStation = document.getElementById('btn-rebuild-station-catalog');
    if (btnRebuildStation) {
      btnRebuildStation.addEventListener('click', () => this.rebuildCurrentChannelCatalog());
    }

    const btnRefreshPpv = document.getElementById('btn-refresh-ppv-catalog');
    if (btnRefreshPpv) {
      btnRefreshPpv.addEventListener('click', () => this.loadPpvCatalog());
    }

    const btnGenerateMeta = document.getElementById('btn-generate-ppv-meta');
    if (btnGenerateMeta) {
      btnGenerateMeta.addEventListener('click', () => this.generatePpvMetadata());
    }

    const btnImportPpv = document.getElementById('btn-import-ppv-movies');
    if (btnImportPpv) {
      btnImportPpv.addEventListener('click', () => {
        const modal = document.getElementById('modal-media-importer');
        if (modal) {
          const folderInput = document.getElementById('import-target-folder');
          if (folderInput) folderInput.value = 'ppv';
          modal.classList.remove('hidden');
        }
      });
    }
  }

  initFormBindings() {
    // Input elements
    this.inputName = document.getElementById('input-network-name');
    this.inputNum = document.getElementById('input-channel-number');
    this.inputType = document.getElementById('input-network-type');
    this.inputCallSign = document.getElementById('input-call-sign');
    this.inputDesc = document.getElementById('input-station-desc');
    this.inputParental = document.getElementById('input-parental-controls');

    this.inputMediaFilter = document.getElementById('input-media-filter');
    this.inputContentDir = document.getElementById('input-content-dir');
    this.inputStreamUrl = document.getElementById('input-stream-url');
    this.inputWebUrl = document.getElementById('input-web-url');
    this.inputExecCmd = document.getElementById('input-exec-cmd');
    this.inputCommercialDir = document.getElementById('input-commercial-dir');
    this.inputBumpsDir = document.getElementById('input-station-bumps');

    this.inputPlaySound = document.getElementById('input-play-sound');
    this.inputSoundPath = document.getElementById('input-sound-path');

    this.inputCommercialFree = document.getElementById('input-commercial-free');
    this.inputAspectRatio = document.getElementById('input-aspect-ratio');
    this.inputVideoScramble = document.getElementById('input-video-scramble');
    this.inputAudioScramble = document.getElementById('input-audio-scramble');

    // Attach listeners to sync back to data model reactively
    const formElements = [
      this.inputName, this.inputNum, this.inputType, this.inputMediaFilter,
      this.inputCallSign, this.inputDesc, this.inputParental, this.inputContentDir,
      this.inputStreamUrl, this.inputWebUrl, this.inputExecCmd,
      this.inputCommercialDir, this.inputBumpsDir, this.inputPlaySound,
      this.inputSoundPath, this.inputCommercialFree, this.inputAspectRatio,
      this.inputVideoScramble, this.inputAudioScramble
    ];

    formElements.forEach(el => {
      if (!el) return;
      const eventName = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(eventName, () => {
        if (this.isUpdatingFromCode || !this.currentChannel) return;
        this.updateModelFromForm();
      });
    });

    const chkScheduleCommFree = document.getElementById('chk-schedule-commercial-free');
    if (chkScheduleCommFree && this.inputCommercialFree) {
      chkScheduleCommFree.addEventListener('change', () => {
        this.inputCommercialFree.checked = chkScheduleCommFree.checked;
        if (!this.isUpdatingFromCode && this.currentChannel) {
          this.updateModelFromForm();
        }
      });
      this.inputCommercialFree.addEventListener('change', () => {
        chkScheduleCommFree.checked = this.inputCommercialFree.checked;
      });
    }

    // Network type change visibility logic
    if (this.inputType) {
      this.inputType.addEventListener('change', () => {
        if (this.inputType.value === 'audio') {
          if (this.inputMediaFilter) this.inputMediaFilter.value = 'audio';
          if (this.inputContentDir && !this.inputContentDir.value) {
            this.inputContentDir.value = 'catalog/music42/';
          }
          if (this.inputCommercialDir && !this.inputCommercialDir.value) {
            this.inputCommercialDir.value = 'commercials';
          }
          if (this.inputBumpsDir && !this.inputBumpsDir.value) {
            this.inputBumpsDir.value = 'bumps';
          }
        } else if (this.inputType.value === 'standard' && this.inputMediaFilter?.value === 'audio') {
          if (this.inputMediaFilter) this.inputMediaFilter.value = 'video';
        }
        this.updateVisibilityForNetworkType(this.inputType.value);
        if (!this.isUpdatingFromCode && this.currentChannel) {
          this.updateModelFromForm();
        }
      });
    }

    if (this.inputMediaFilter) {
      this.inputMediaFilter.addEventListener('change', () => {
        if (this.inputMediaFilter.value === 'audio') {
          if (this.inputType) this.inputType.value = 'audio';
        }
        if (!this.isUpdatingFromCode && this.currentChannel) {
          this.updateModelFromForm();
        }
      });
    }

    // Add Slot Override Button
    const btnAddSlot = document.getElementById('btn-add-slot-override');
    if (btnAddSlot) {
      btnAddSlot.addEventListener('click', () => this.addSlotOverrideRow());
    }

    // Auto Generate 24/7 Schedule Template Button
    const btnGenSchedule = document.getElementById('btn-generate-247-schedule');
    if (btnGenSchedule) {
      btnGenSchedule.addEventListener('click', () => this.generate247ScheduleTemplate());
    }

    this.initSmartScheduleEvents();
  }

  updateVisibilityForNetworkType(type) {
    const secs = document.querySelectorAll('.content-type-sec');
    secs.forEach(sec => sec.classList.add('hidden'));

    const normalizedType = (type || 'standard').toLowerCase();

    if (['standard', 'loop', 'audio', 'ppv'].includes(normalizedType)) {
      document.querySelectorAll('.sec-standard, .sec-loop, .sec-audio, .sec-ppv').forEach(s => s.classList.remove('hidden'));
    } else if (normalizedType === 'streaming') {
      document.querySelectorAll('.sec-streaming').forEach(s => s.classList.remove('hidden'));
    } else if (normalizedType === 'web') {
      document.querySelectorAll('.sec-web').forEach(s => s.classList.remove('hidden'));
    } else if (normalizedType === 'executable') {
      document.querySelectorAll('.sec-executable').forEach(s => s.classList.remove('hidden'));
    } else if (normalizedType === 'guide') {
      document.querySelectorAll('.sec-guide').forEach(s => s.classList.remove('hidden'));
    }
  }

  initJsonInspector() {
    this.jsonTextarea = document.getElementById('json-code-textarea');
    this.validationStatus = document.getElementById('json-validation-status');

    if (this.jsonTextarea) {
      this.jsonTextarea.addEventListener('input', () => {
        this.parseAndApplyJsonCode();
      });
    }

    const btnCopy = document.getElementById('btn-copy-json');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        if (this.jsonTextarea) {
          navigator.clipboard.writeText(this.jsonTextarea.value);
          this.showToast('Copied JSON to clipboard', 'info');
        }
      });
    }

    const btnFormat = document.getElementById('btn-format-json');
    if (btnFormat) {
      btnFormat.addEventListener('click', () => {
        try {
          const parsed = JSON.parse(this.jsonTextarea.value);
          this.jsonTextarea.value = JSON.stringify(parsed, null, 2);
          this.showToast('Formatted JSON code', 'info');
        } catch (err) {
          this.showToast('Cannot format invalid JSON', 'error');
        }
      });
    }

    const btnDownload = document.getElementById('btn-download-json');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        const conf = this.currentChannel?.station_conf || {};
        const chNum = conf.channel_number !== undefined ? String(conf.channel_number).padStart(2, '0') : '00';
        const filename = `station_${chNum}.json`;
        const blob = new Blob([this.jsonTextarea.value], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }

  initActionButtons() {
    const btnSave = document.getElementById('btn-save-channel');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        if (this.onSaveCallback && this.currentChannel) {
          this.onSaveCallback(this.currentChannel);
        }
      });
    }

    const btnDelete = document.getElementById('btn-delete-channel');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        if (this.onDeleteCallback && this.currentChannel) {
          this.onDeleteCallback(this.currentChannel);
        }
      });
    }

    const btnDuplicate = document.getElementById('btn-duplicate-channel');
    if (btnDuplicate) {
      btnDuplicate.addEventListener('click', () => {
        if (this.onDuplicateCallback && this.currentChannel) {
          this.onDuplicateCallback(this.currentChannel);
        }
      });
    }
  }

  loadChannel(channel) {
    this.currentChannel = channel;
    const conf = channel.station_conf || {};

    // Header Display
    const chNumBadge = document.getElementById('edit-ch-num-badge');
    const netNameTitle = document.getElementById('edit-network-name');
    const typeTag = document.getElementById('edit-type-tag');

    const chNumStr = conf.channel_number !== undefined ? String(conf.channel_number).padStart(2, '0') : '--';
    if (chNumBadge) chNumBadge.textContent = `CH ${chNumStr}`;
    if (netNameTitle) netNameTitle.textContent = conf.network_name || 'Unnamed Station';
    if (typeTag) {
      typeTag.textContent = (conf.network_type || 'standard').toUpperCase();
      typeTag.className = `type-tag tag-${(conf.network_type || 'standard').toLowerCase()}`;
    }

    // Populate inputs
    this.isUpdatingFromCode = true;

    if (this.inputName) this.inputName.value = conf.network_name || '';
    if (this.inputNum) this.inputNum.value = conf.channel_number !== undefined ? conf.channel_number : '';

    const isAudioChannel = conf.media_filter === 'audio' || conf.network_type === 'audio';
    if (this.inputType) this.inputType.value = isAudioChannel ? 'audio' : (conf.network_type || 'standard');
    if (this.inputMediaFilter) this.inputMediaFilter.value = conf.media_filter || (isAudioChannel ? 'audio' : 'video');

    if (this.inputCallSign) this.inputCallSign.value = conf.call_sign || '';
    if (this.inputDesc) this.inputDesc.value = conf.description || '';
    if (this.inputParental) this.inputParental.checked = !!conf.parental_controls;

    if (this.inputContentDir) this.inputContentDir.value = conf.content_dir || '';
    if (this.inputStreamUrl) this.inputStreamUrl.value = conf.stream_url || '';
    if (this.inputWebUrl) this.inputWebUrl.value = conf.web_url || '';
    if (this.inputExecCmd) this.inputExecCmd.value = conf.exec_command || '';
    if (this.inputCommercialDir) this.inputCommercialDir.value = conf.commercials_dir || conf.commercial_dir || '';
    if (this.inputBumpsDir) this.inputBumpsDir.value = conf.bumps_dir || conf.bump_dir || '';

    if (this.inputPlaySound) this.inputPlaySound.checked = conf.play_sound !== false;
    if (this.inputSoundPath) this.inputSoundPath.value = conf.sound_to_play || '';

    if (this.inputCommercialFree) this.inputCommercialFree.checked = !!conf.commercial_free;
    const chkScheduleCommFree = document.getElementById('chk-schedule-commercial-free');
    if (chkScheduleCommFree) chkScheduleCommFree.checked = !!conf.commercial_free;

    const firstBumper = conf.start_bump || Object.values(conf.day_templates?.all_day || {}).find(s => s && s.start_bump)?.start_bump;
    const chkInsertBumpers = document.getElementById('chk-schedule-insert-bumpers');
    const inputBumperSource = document.getElementById('input-schedule-bumper-source');
    if (chkInsertBumpers) chkInsertBumpers.checked = !!firstBumper;
    if (inputBumperSource && firstBumper) inputBumperSource.value = firstBumper;

    const hasSequence = !!Object.values(conf.day_templates?.all_day || {}).find(s => s && s.sequence);
    const chkSequentialOrder = document.getElementById('chk-schedule-sequential-order');
    if (chkSequentialOrder) chkSequentialOrder.checked = hasSequence;

    if (this.inputAspectRatio) this.inputAspectRatio.value = conf.aspect_ratio || '4:3';
    if (this.inputVideoScramble) this.inputVideoScramble.value = conf.video_scramble_fx || 'none';
    if (this.inputAudioScramble) this.inputAudioScramble.value = conf.audio_scramble_fx || 'none';

    this.updateVisibilityForNetworkType(isAudioChannel ? 'audio' : (conf.network_type || 'standard'));
    this.renderSlotOverrides(conf.slot_overrides || []);
    this.syncJsonCodeFromModel();

    const jsonFileDisplay = document.getElementById('json-filename-display');
    if (jsonFileDisplay) {
      jsonFileDisplay.textContent = `station_${chNumStr}.json`;
    }

    this.isUpdatingFromCode = false;
    this.scanShowFolders();
  }

  updateModelFromForm() {
    if (!this.currentChannel) return;

    const conf = this.currentChannel.station_conf || {};

    conf.network_name = this.inputName?.value || 'New Channel';
    conf.channel_number = this.inputNum?.value ? parseInt(this.inputNum.value, 10) : 1;

    const selectedType = this.inputType?.value || 'standard';
    const selectedFilter = this.inputMediaFilter?.value || 'video';

    if (selectedType === 'audio' || selectedFilter === 'audio') {
      conf.network_type = 'standard';
      conf.media_filter = 'audio';
    } else {
      conf.network_type = selectedType;
      if (selectedFilter !== 'video') {
        conf.media_filter = selectedFilter;
      } else {
        delete conf.media_filter;
      }
    }

    conf.call_sign = this.inputCallSign?.value || '';
    conf.description = this.inputDesc?.value || '';
    conf.parental_controls = !!this.inputParental?.checked;

    conf.content_dir = this.inputContentDir?.value || '';
    conf.stream_url = this.inputStreamUrl?.value || '';
    conf.web_url = this.inputWebUrl?.value || '';
    conf.exec_command = this.inputExecCmd?.value || '';
    if (this.inputCommercialDir?.value) {
      if ('commercial_dir' in conf) conf.commercial_dir = this.inputCommercialDir.value;
      else conf.commercials_dir = this.inputCommercialDir.value;
    }
    if (this.inputBumpsDir?.value) {
      if ('bump_dir' in conf) conf.bump_dir = this.inputBumpsDir.value;
      else conf.bumps_dir = this.inputBumpsDir.value;
    }

    conf.play_sound = !!this.inputPlaySound?.checked;
    conf.sound_to_play = this.inputSoundPath?.value || '';

    conf.commercial_free = !!this.inputCommercialFree?.checked;
    conf.aspect_ratio = this.inputAspectRatio?.value || '4:3';
    conf.video_scramble_fx = this.inputVideoScramble?.value || 'none';
    conf.audio_scramble_fx = this.inputAudioScramble?.value || 'none';

    this.currentChannel.station_conf = conf;

    // Header badge reactive update
    const chNumBadge = document.getElementById('edit-ch-num-badge');
    const netNameTitle = document.getElementById('edit-network-name');
    const typeTag = document.getElementById('edit-type-tag');

    const chNumStr = conf.channel_number !== undefined ? String(conf.channel_number).padStart(2, '0') : '--';
    if (chNumBadge) chNumBadge.textContent = `CH ${chNumStr}`;
    if (netNameTitle) netNameTitle.textContent = conf.network_name;
    if (typeTag) {
      const displayTag = (selectedType === 'audio' || selectedFilter === 'audio') ? 'AUDIO' : conf.network_type.toUpperCase();
      typeTag.textContent = displayTag;
      typeTag.className = `type-tag tag-${displayTag.toLowerCase()}`;
    }

    this.syncJsonCodeFromModel();

    if (this.onChannelUpdatedCallback) {
      this.onChannelUpdatedCallback(this.currentChannel);
    }
  }

  syncJsonCodeFromModel() {
    if (!this.currentChannel || !this.jsonTextarea) return;
    const cleanObject = {
      station_conf: this.currentChannel.station_conf
    };
    this.jsonTextarea.value = JSON.stringify(cleanObject, null, 2);
    this.validateSchema(cleanObject);
  }

  parseAndApplyJsonCode() {
    if (!this.jsonTextarea) return;
    try {
      const parsed = JSON.parse(this.jsonTextarea.value);
      this.validateSchema(parsed);
      if (parsed.station_conf) {
        this.currentChannel.station_conf = parsed.station_conf;
        this.loadChannel(this.currentChannel);
        if (this.onChannelUpdatedCallback) {
          this.onChannelUpdatedCallback(this.currentChannel);
        }
      }
    } catch (err) {
      this.showInvalidSchemaStatus(`JSON Syntax Error: ${err.message}`);
    }
  }

  validateSchema(obj) {
    if (!this.validationStatus) return;
    if (!obj || typeof obj !== 'object' || !obj.station_conf) {
      this.showInvalidSchemaStatus("Missing required top-level 'station_conf' object.");
      return;
    }

    const conf = obj.station_conf;
    if (!conf.network_name) {
      this.showInvalidSchemaStatus("Warning: 'network_name' property is required.");
      return;
    }
    if (conf.channel_number === undefined) {
      this.showInvalidSchemaStatus("Warning: 'channel_number' property is required.");
      return;
    }

    this.validationStatus.className = 'validation-status valid';
    this.validationStatus.innerHTML = `<i class="ri-checkbox-circle-fill"></i> Valid FieldStation42 station_conf JSON structure.`;
  }

  showInvalidSchemaStatus(msg) {
    if (!this.validationStatus) return;
    this.validationStatus.className = 'validation-status invalid';
    this.validationStatus.innerHTML = `<i class="ri-error-warning-fill"></i> ${msg}`;
  }

  renderSlotOverrides(slots) {
    const container = document.getElementById('slot-overrides-list');
    if (!container) return;

    container.innerHTML = '';
    if (slots.length === 0) {
      container.innerHTML = `
        <div style="padding: 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); text-align: center; color: var(--text-dim); font-size: 0.85rem;">
          No slot overrides defined for this channel. Click "Add Slot Override" above to schedule specific blocks.
        </div>
      `;
      return;
    }

    slots.forEach((slot, index) => {
      const row = document.createElement('div');
      row.className = 'slot-item';

      row.innerHTML = `
        <input type="text" class="form-input slot-name" value="${slot.name || 'Block Name'}" placeholder="Block Name">
        <input type="time" class="form-input slot-start" value="${slot.start_time || '20:00'}">
        <input type="text" class="form-input slot-dir" value="${slot.content_dir || ''}" placeholder="override/folder">
        <select class="form-select slot-scramble">
          <option value="none" ${!slot.scramble ? 'selected' : ''}>No Scramble</option>
          <option value="color_inversion" ${slot.scramble === 'color_inversion' ? 'selected' : ''}>Color Invert</option>
          <option value="severe_noise" ${slot.scramble === 'severe_noise' ? 'selected' : ''}>Severe Noise</option>
        </select>
        <button type="button" class="btn btn-icon btn-ghost text-danger btn-del-slot" title="Remove block"><i class="ri-delete-bin-line"></i></button>
      `;

      row.querySelector('.btn-del-slot').addEventListener('click', () => {
        slots.splice(index, 1);
        this.renderSlotOverrides(slots);
        this.updateModelFromForm();
      });

      container.appendChild(row);
    });
  }

  addSlotOverrideRow() {
    if (!this.currentChannel) return;
    if (!this.currentChannel.station_conf.slot_overrides) {
      this.currentChannel.station_conf.slot_overrides = [];
    }

    this.currentChannel.station_conf.slot_overrides.push({
      name: 'Primetime Block',
      start_time: '20:00',
      content_dir: 'catalog/primetime',
      scramble: 'none'
    });

    this.renderSlotOverrides(this.currentChannel.station_conf.slot_overrides);
    this.updateModelFromForm();
  }

  generate247ScheduleTemplate() {
    if (!this.currentChannel) return;
    const conf = this.currentChannel.station_conf || {};

    conf.schedule_increment = 30;
    conf.commercial_free = true;
    conf.day_templates = {
      all_day: {
        "0": {"tags": "content"},
        "1": {"tags": "content"},
        "2": {"tags": "content"},
        "3": {"tags": "content"},
        "4": {"tags": "content"},
        "5": {"tags": "content"},
        "6": {"tags": "content"},
        "7": {"tags": "content"},
        "8": {"tags": "content"},
        "9": {"tags": "content"},
        "10": {"tags": "content"},
        "11": {"tags": "content"},
        "12": {"tags": "content"},
        "13": {"tags": "content"},
        "14": {"tags": "content"},
        "15": {"tags": "content"},
        "16": {"tags": "content"},
        "17": {"tags": "content"},
        "18": {"tags": "content"},
        "19": {"tags": "content"},
        "20": {"tags": "content"},
        "21": {"tags": "content"},
        "22": {"tags": "content"},
        "23": {"tags": "content"}
      }
    };

    conf.monday = "all_day";
    conf.tuesday = "all_day";
    conf.wednesday = "all_day";
    conf.thursday = "all_day";
    conf.friday = "all_day";
    conf.saturday = "all_day";
    conf.sunday = "all_day";

    this.currentChannel.station_conf = conf;
    this.syncJsonCodeFromModel();
    this.showToast('Generated 24/7 liquid schedule template!', 'success');
  }

  async rebuildCurrentChannelCatalog() {
    if (!this.currentChannel || !this.currentChannel.station_conf) return;
    const netName = this.currentChannel.station_conf.network_name;
    this.showToast(`Rebuilding catalog & schedule for '${netName}'...`, 'info');
    try {
      const res = await fetch('/api/rebuild_schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station: netName })
      });
      if (res.ok) {
        const data = await res.json();
        this.showToast(data.message || `Rebuilt catalog for '${netName}'`, 'success');
        this.loadUpcomingSchedule();
      } else {
        this.showToast(`Failed to rebuild catalog for '${netName}'`, 'error');
      }
    } catch (err) {
      this.showToast('Error connecting to backend server', 'error');
    }
  }

  async loadUpcomingSchedule() {
    const container = document.getElementById('epg-schedule-list');
    if (!container) return;

    if (!this.currentChannel || !this.currentChannel.station_conf) {
      container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-dim);">No channel selected.</div>`;
      return;
    }

    const netName = this.currentChannel.station_conf.network_name;
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--primary-cyan);"><i class="ri-loader-4-line ri-spin" style="font-size: 1.5rem;"></i><p style="margin-top: 8px;">Loading schedule for ${netName}...</p></div>`;

    try {
      const res = await fetch(`/api/schedule?station=${encodeURIComponent(netName)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const stations = await res.json();

      let items = [];
      if (Array.isArray(stations) && stations.length > 0) {
        items = stations[0].items || [];
      }

      if (items.length === 0) {
        container.innerHTML = `
          <div style="padding: 32px; text-align: center; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
            <i class="ri-movie-line" style="font-size: 2.5rem; color: var(--text-dim); display: block; margin-bottom: 12px;"></i>
            <h4 style="margin: 0 0 8px 0; color: var(--text-bright);">No Schedule Compiled Yet for ${netName}</h4>
            <p style="margin: 0 0 16px 0; color: var(--text-dim); font-size: 0.9rem;">
              Click "Update Catalog & Rescan Media" below to scan media files and compile a 1-week liquid schedule.
            </p>
            <button type="button" class="btn btn-primary glow-cyan" id="btn-epg-trigger-rebuild">
              <i class="ri-refresh-line"></i> Rescan Media & Rebuild Catalog
            </button>
          </div>
        `;
        const btnTrigger = document.getElementById('btn-epg-trigger-rebuild');
        if (btnTrigger) {
          btnTrigger.addEventListener('click', () => this.rebuildCurrentChannelCatalog());
        }
        return;
      }

      container.innerHTML = items.map((item) => {
        const nowClass = item.is_now_playing ? 'now-playing-card' : '';
        const badge = item.is_now_playing
          ? `<span class="epg-badge now"><i class="ri-broadcast-fill"></i> NOW PLAYING</span>`
          : `<span class="epg-badge time">${item.start_fmt} - ${item.end_fmt}</span>`;

        return `
          <div class="epg-item-card ${nowClass}">
            <div class="epg-time-column">
              ${badge}
              <span class="epg-duration">${item.duration_mins} mins</span>
            </div>
            <div class="epg-info-column">
              <h4 class="epg-item-title">${item.title}</h4>
              <span class="epg-file-path" title="${item.file}"><i class="ri-file-video-line"></i> ${item.file}</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--accent-red);">
          <i class="ri-error-warning-line" style="font-size: 1.5rem;"></i>
          <p style="margin-top: 8px;">Failed to fetch schedule: ${err.message}</p>
        </div>
      `;
    }
  }

  async loadPpvCatalog() {
    const container = document.getElementById('ppv-movies-grid');
    if (!container) return;

    const conf = this.currentChannel?.station_conf || {};
    const contentDir = conf.content_dir || 'catalog/ppv';

    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--primary-cyan);">
        <i class="ri-loader-4-line ri-spin" style="font-size: 1.5rem;"></i>
        <p style="margin-top: 8px;">Scanning PPV movie catalog in '${contentDir}'...</p>
      </div>
    `;

    try {
      const res = await fetch(`/api/ppv/items?content_dir=${encodeURIComponent(contentDir)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = data.items || [];

      if (items.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 32px; text-align: center; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
            <i class="ri-film-line" style="font-size: 2.5rem; color: var(--text-dim); display: block; margin-bottom: 12px;"></i>
            <h4 style="margin: 0 0 8px 0; color: var(--text-bright);">No PPV Movies Found in '${contentDir}'</h4>
            <p style="margin: 0 0 16px 0; color: var(--text-dim); font-size: 0.9rem;">
              Click below to import video files into <code>catalog/ppv</code>.
            </p>
            <button type="button" class="btn btn-primary glow-cyan" id="btn-ppv-empty-import">
              <i class="ri-folder-add-line"></i> Import Movies to PPV Catalog
            </button>
          </div>
        `;
        const btnEmptyImp = document.getElementById('btn-ppv-empty-import');
        if (btnEmptyImp) {
          btnEmptyImp.addEventListener('click', () => {
            const modal = document.getElementById('modal-media-importer');
            if (modal) {
              const folderInput = document.getElementById('import-target-folder');
              if (folderInput) folderInput.value = 'ppv';
              modal.classList.remove('hidden');
            }
          });
        }
        return;
      }

      container.innerHTML = items.map((item) => {
        const posterHtml = item.poster_url
          ? `<img src="${item.poster_url}" class="ppv-poster-img" alt="${item.title}">`
          : `<div class="ppv-poster-fallback"><i class="ri-clapperboard-line"></i></div>`;

        const infoTag = item.info ? `<span class="ppv-badge">${item.info}</span>` : '';
        const descText = item.description ? item.description : 'On-Demand Pay-Per-View Cinema Feature.';

        return `
          <div class="ppv-movie-card">
            <div class="ppv-poster-box">
              ${posterHtml}
              <div class="ppv-card-overlay">
                <button type="button" class="btn btn-primary glow-cyan btn-sm btn-play-ppv" data-filepath="${item.file_path}">
                  <i class="ri-play-fill"></i> Play On-Demand
                </button>
              </div>
            </div>
            <div class="ppv-movie-info">
              <div class="ppv-title-row">
                <h4 class="ppv-movie-title">${item.title}</h4>
                ${infoTag}
              </div>
              <p class="ppv-movie-desc">${descText}</p>
              <div class="ppv-card-footer">
                <span class="ppv-file-path" title="${item.rel_path}"><i class="ri-file-video-line"></i> ${item.rel_path}</span>
                <button type="button" class="btn btn-ghost btn-sm btn-play-ppv text-cyan" data-filepath="${item.file_path}">
                  <i class="ri-play-line"></i> Play Now
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.btn-play-ppv').forEach(btn => {
        btn.addEventListener('click', () => {
          const filePath = btn.dataset.filepath;
          if (filePath) this.playPpvMovie(filePath);
        });
      });

    } catch (err) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--accent-red);">
          <i class="ri-error-warning-line" style="font-size: 1.5rem;"></i>
          <p style="margin-top: 8px;">Failed to load PPV catalog: ${err.message}</p>
        </div>
      `;
    }
  }

  async playPpvMovie(filePath) {
    const filename = filePath.split('/').pop();
    this.showToast(`Starting PPV on-demand playback for '${filename}'...`, 'info');
    try {
      const res = await fetch('/api/ppv/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath })
      });
      if (res.ok) {
        const data = await res.json();
        this.showToast(data.message || `Playing '${filename}' on FieldStation42 output!`, 'success');
      } else {
        this.showToast(`Failed to play PPV movie '${filename}'`, 'error');
      }
    } catch (err) {
      this.showToast('Error connecting to backend server', 'error');
    }
  }

  async generatePpvMetadata() {
    const conf = this.currentChannel?.station_conf || {};
    const contentDir = conf.content_dir || 'catalog/ppv';

    this.showToast(`Auto-generating metadata & posters for '${contentDir}'...`, 'info');
    try {
      const res = await fetch('/api/ppv/generate_metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_dir: contentDir })
      });

      if (res.ok) {
        const data = await res.json();
        this.showToast(data.message || 'Metadata & posters generated successfully!', 'success');
        this.loadPpvCatalog();
      } else {
        this.showToast('Failed to generate PPV metadata', 'error');
      }
    } catch (err) {
      this.showToast(`Metadata generation error: ${err.message}`, 'error');
    }
  }

  initSmartScheduleEvents() {
    const btnScan = document.getElementById('btn-scan-show-folders');
    if (btnScan) {
      btnScan.addEventListener('click', () => this.scanShowFolders());
    }

    const btnCreateSub = document.getElementById('btn-create-show-subfolder');
    if (btnCreateSub) {
      btnCreateSub.addEventListener('click', () => this.createShowSubfolder());
    }

    const selectMode = document.getElementById('select-schedule-mode');
    const groupTod = document.getElementById('group-timeofday-config');
    if (selectMode && groupTod) {
      selectMode.addEventListener('change', () => {
        if (selectMode.value === 'timeofday') {
          groupTod.classList.remove('hidden');
        } else {
          groupTod.classList.add('hidden');
        }
      });
    }

    const btnApply = document.getElementById('btn-apply-smart-schedule');
    if (btnApply) {
      btnApply.addEventListener('click', () => this.applySmartSchedule());
    }

    const btnJump = document.getElementById('btn-jump-to-schedule-tab');
    if (btnJump) {
      btnJump.addEventListener('click', () => {
        const schedTabBtn = document.querySelector('.tab-btn[data-tab="tab-schedule"]');
        if (schedTabBtn) schedTabBtn.click();
      });
    }
  }

  async scanShowFolders() {
    const container = document.getElementById('detected-shows-container');
    const conf = this.currentChannel?.station_conf || {};
    const contentDir = conf.content_dir || '';

    if (!container) return;

    if (!contentDir) {
      container.innerHTML = `<span style="color: var(--accent-rose); font-size: 0.85rem;"><i class="ri-error-warning-line"></i> Please specify a <code>content_dir</code> in Content & Sources tab first.</span>`;
      return;
    }

    container.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-dim);"><i class="ri-loader-4-line spin"></i> Scanning '${contentDir}' for show subfolders...</span>`;

    try {
      const res = await fetch('/api/browse_dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: contentDir })
      });

      if (!res.ok) throw new Error('Failed to scan channel directory');
      const data = await res.json();

      const subdirs = data.subdirs || [];
      const rootMediaCount = data.media_count || 0;

      this.detectedShows = [];

      for (const sub of subdirs) {
        try {
          const subRes = await fetch('/api/browse_dir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: sub.path })
          });
          if (subRes.ok) {
            const subData = await subRes.json();
            this.detectedShows.push({
              name: sub.name,
              path: sub.path,
              mediaCount: subData.media_count || 0
            });
          }
        } catch (e) {
          this.detectedShows.push({ name: sub.name, path: sub.path, mediaCount: 0 });
        }
      }

      this.renderDetectedShowChips(rootMediaCount);
      this.populateTimeOfDayDropdowns();
    } catch (err) {
      container.innerHTML = `<span style="color: var(--accent-rose); font-size: 0.85rem;"><i class="ri-error-warning-line"></i> Error scanning folder: ${err.message}</span>`;
    }
  }

  renderDetectedShowChips(rootMediaCount = 0) {
    const container = document.getElementById('detected-shows-container');
    if (!container) return;

    container.innerHTML = '';

    if (!this.detectedShows || this.detectedShows.length === 0) {
      container.innerHTML = `
        <div style="width: 100%; padding: 10px 14px; background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 6px; font-size: 0.82rem; color: var(--accent-amber);">
          <i class="ri-alert-line"></i> <strong>No show subfolders found in <code>${this.escapeHtml(this.currentChannel?.station_conf?.content_dir || 'catalog/')}</code></strong>.
          ${rootMediaCount > 0 ? `<br>Found <strong>${rootMediaCount}</strong> loose video files in root folder. Standard channels require subfolders for each program (e.g. <code>cartoons/</code>, <code>big_cars/</code>).` : ''}
          <br>Use "Create New Show Subfolder" above to add program folders!
        </div>
      `;
      return;
    }

    this.detectedShows.forEach(show => {
      const chip = document.createElement('label');
      chip.className = 'day-chip show-chip';
      chip.style.display = 'inline-flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '6px';
      chip.style.padding = '6px 12px';
      chip.style.borderRadius = '20px';
      chip.style.background = 'var(--bg-card)';
      chip.style.border = '1px solid var(--border-color)';
      chip.style.fontSize = '0.85rem';
      chip.style.cursor = 'pointer';

      chip.innerHTML = `
        <input type="checkbox" class="show-tag-checkbox" value="${this.escapeHtml(show.name)}" checked />
        <i class="ri-folder-film-line text-cyan"></i>
        <strong>${this.escapeHtml(show.name)}</strong>
        <span class="file-count-badge" style="font-size: 0.72rem; opacity: 0.75; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 10px;">${show.mediaCount} vids</span>
      `;

      container.appendChild(chip);
    });
  }

  populateTimeOfDayDropdowns() {
    const todSelects = document.querySelectorAll('.tod-select');
    const shows = this.detectedShows || [];

    todSelects.forEach(select => {
      select.innerHTML = '';
      if (shows.length === 0) {
        select.innerHTML = `<option value="">No show subfolders</option>`;
        return;
      }
      shows.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = `${s.name} (${s.mediaCount} vids)`;
        select.appendChild(opt);
      });
    });
  }

  async createShowSubfolder() {
    const inputName = document.getElementById('input-new-show-folder-name');
    const folderName = inputName ? inputName.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') : '';
    const conf = this.currentChannel?.station_conf || {};
    const contentDir = conf.content_dir || 'catalog/my_channel';

    if (!folderName) {
      alert('Please enter a valid subfolder name (e.g. cartoons, big_cars).');
      return;
    }

    const fullPath = `${contentDir}/${folderName}`;
    this.showToast(`Creating show subfolder '${fullPath}'...`, 'info');

    try {
      const res = await fetch('/api/create_dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath })
      });

      if (!res.ok) throw new Error('Failed to create directory');
      const data = await res.json();

      if (data.success) {
        if (inputName) inputName.value = '';
        this.showToast(`Created subfolder '${fullPath}'!`, 'success');
        this.scanShowFolders();
      }
    } catch (err) {
      this.showToast(`Error creating subfolder: ${err.message}`, 'error');
    }
  }

  async applySmartSchedule() {
    if (!this.currentChannel) return;

    const selectedCheckboxes = document.querySelectorAll('.show-tag-checkbox:checked');
    const selectedTags = Array.from(selectedCheckboxes).map(cb => cb.value);
    const mode = document.getElementById('select-schedule-mode')?.value || 'alternate';

    if (selectedTags.length === 0 && mode !== 'timeofday') {
      alert('Please select at least one show subfolder or create subfolders first.');
      return;
    }

    const insertBumpers = document.getElementById('chk-schedule-insert-bumpers')?.checked;
    const bumperFreq = parseInt(document.getElementById('select-schedule-bumper-freq')?.value || '3', 10);
    const bumperSource = document.getElementById('input-schedule-bumper-source')?.value.trim() || 'bumps';
    const isCommercialFree = document.getElementById('chk-schedule-commercial-free')?.checked;
    const isSequential = document.getElementById('chk-schedule-sequential-order')?.checked;

    const conf = this.currentChannel.station_conf || {};
    const allDayTemplate = {};

    if (mode === 'alternate') {
      for (let h = 0; h < 24; h++) {
        const tag = selectedTags[h % selectedTags.length];
        const slotObj = { "tags": tag };
        if (isSequential) {
          slotObj.sequence = "sequential";
        }
        if (insertBumpers && (h % bumperFreq === 0)) {
          slotObj.start_bump = bumperSource;
        }
        allDayTemplate[String(h)] = slotObj;
      }
    } else if (mode === 'random') {
      for (let h = 0; h < 24; h++) {
        const randomIndex = Math.floor(Math.random() * selectedTags.length);
        const tag = selectedTags[randomIndex];
        const slotObj = { "tags": tag };
        if (isSequential) {
          slotObj.sequence = "sequential";
        }
        if (insertBumpers && (h % bumperFreq === 0)) {
          slotObj.start_bump = bumperSource;
        }
        allDayTemplate[String(h)] = slotObj;
      }
    } else if (mode === 'timeofday') {
      const morningTag = document.getElementById('sel-tod-morning')?.value || selectedTags[0] || 'content';
      const afternoonTag = document.getElementById('sel-tod-afternoon')?.value || selectedTags[0] || 'content';
      const eveningTag = document.getElementById('sel-tod-evening')?.value || selectedTags[0] || 'content';
      const nightTag = document.getElementById('sel-tod-night')?.value || selectedTags[0] || 'content';

      for (let h = 0; h < 24; h++) {
        let tag = nightTag;
        if (h >= 6 && h < 12) tag = morningTag;
        else if (h >= 12 && h < 18) tag = afternoonTag;
        else if (h >= 18 && h < 23) tag = eveningTag;

        const slotObj = { "tags": tag };
        if (isSequential) {
          slotObj.sequence = "sequential";
        }
        if (insertBumpers && (h % bumperFreq === 0)) {
          slotObj.start_bump = bumperSource;
        }
        allDayTemplate[String(h)] = slotObj;
      }
    }

    if (isCommercialFree !== undefined) {
      conf.commercial_free = !!isCommercialFree;
    }

    conf.schedule_increment = 30;
    conf.day_templates = {
      all_day: allDayTemplate
    };

    conf.monday = "all_day";
    conf.tuesday = "all_day";
    conf.wednesday = "all_day";
    conf.thursday = "all_day";
    conf.friday = "all_day";
    conf.saturday = "all_day";
    conf.sunday = "all_day";

    this.currentChannel.station_conf = conf;
    this.syncJsonCodeFromModel();

    this.showToast('Saving station config & compiling 24/7 week schedule...', 'info');

    if (this.onSaveCallback) {
      await this.onSaveCallback(this.currentChannel);
    }

    try {
      const res = await fetch('/api/rebuild_schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station: conf.network_name,
          channel_id: this.currentChannel.id || this.currentChannel.filename
        })
      });
      if (res.ok) {
        this.showToast('24/7 Schedule successfully compiled & active!', 'success');
      }
    } catch (e) {
      this.showToast('24/7 Schedule generated!', 'info');
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }

  showToast(msg, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="ri-information-fill"></i> <span>${msg}</span>`;

    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }
}
