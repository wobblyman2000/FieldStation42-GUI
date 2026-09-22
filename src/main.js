import { ChannelList } from './components/ChannelList.js';
import { ChannelEditor } from './components/ChannelEditor.js';
import { CrtPreview } from './components/CrtPreview.js';
import { RecipeModal } from './components/RecipeModal.js';
import { DirectoryBrowserModal } from './components/DirectoryBrowserModal.js';
import { MediaImporterModal } from './components/MediaImporterModal.js';
import { RemoteControl } from './components/RemoteControl.js';

class App {
  constructor() {
    this.channels = [];
    this.activeChannelId = null;

    this.crtPreview = new CrtPreview();
    this.recipeModal = new RecipeModal((preset) => this.handleApplyRecipe(preset));

    this.remoteControl = new RemoteControl(
      (chNum) => this.handleTuneChannel(chNum),
      (msg, type) => this.showToast(msg, type)
    );

    this.dirBrowserModal = new DirectoryBrowserModal();
    this.mediaImporterModal = new MediaImporterModal(
      (relTargetDir, createdCount, mode) => this.handleMediaImported(relTargetDir, createdCount, mode),
      (onSelectCb) => {
        this.dirBrowserModal.onSelectDirectoryCallback = onSelectCb;
        const currentVal = document.getElementById('import-source-path')?.value || '';
        this.dirBrowserModal.open(currentVal);
      }
    );

    this.channelList = new ChannelList('channel-list-container', (channel) => {
      this.activeChannelId = channel.id;
      this.channelEditor.loadChannel(channel);
      this.crtPreview.updatePreview(channel);
    });

    this.channelEditor = new ChannelEditor(
      (updatedCh) => this.handleChannelUpdated(updatedCh),
      (savedCh) => this.handleSaveChannel(savedCh),
      (deletedCh) => this.handleDeleteChannel(deletedCh),
      (dupCh) => this.handleDuplicateChannel(dupCh)
    );

    this.initHeaderEvents();
    this.initFolderBrowseButtons();
    this.fetchSystemInfo();
    this.fetchConfsFromBackend();
  }

  async fetchSystemInfo() {
    try {
      const res = await fetch('/api/info');
      if (res.ok) {
        const info = await res.json();
        const confsPathEl = document.getElementById('confs-path');
        const statusTextEl = document.getElementById('backend-status');
        if (confsPathEl) confsPathEl.textContent = info.confs_dir;
        if (statusTextEl) statusTextEl.textContent = 'FS42 CONFS CONNECTED';
      }
    } catch (e) {
      console.warn('Could not fetch server info:', e);
    }
  }

  async fetchConfsFromBackend() {
    try {
      const res = await fetch('/api/confs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.channels = data.map(item => ({
            id: item.filename,
            filename: item.filename,
            station_conf: item.station_conf
          }));

          this.activeChannelId = this.channels[0].id;
          this.channelList.setChannels(this.channels, this.activeChannelId);
          this.channelEditor.loadChannel(this.channels[0]);
          this.crtPreview.updatePreview(this.channels[0]);
          return;
        }
      }
    } catch (e) {
      console.warn('Could not load backend confs, falling back to local presets:', e);
    }

    this.loadDefaultChannels();
  }

  initFolderBrowseButtons() {
    const btnImporter = document.getElementById('btn-open-media-importer');
    if (btnImporter) {
      btnImporter.addEventListener('click', () => {
        const activeCh = this.channels.find(c => c.id === this.activeChannelId);
        this.mediaImporterModal.open(activeCh);
      });
    }

    const btnQuickImport = document.getElementById('btn-quick-import-media');
    if (btnQuickImport) {
      btnQuickImport.addEventListener('click', () => {
        const activeCh = this.channels.find(c => c.id === this.activeChannelId);
        this.mediaImporterModal.open(activeCh);
      });
    }

    const browseBtns = document.querySelectorAll('.btn-browse-dir-target');
    browseBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetInputId = btn.dataset.target;
        const targetInput = document.getElementById(targetInputId);
        const currentVal = targetInput ? targetInput.value : '';

        this.dirBrowserModal.onSelectDirectoryCallback = (selectedPath) => {
          if (targetInput) {
            targetInput.value = selectedPath;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        };
        this.dirBrowserModal.open(currentVal);
      });
    });

    const btnBrowseMain = document.getElementById('btn-browse-dir');
    if (btnBrowseMain) {
      btnBrowseMain.addEventListener('click', () => {
        const targetInput = document.getElementById('input-content-dir');
        this.dirBrowserModal.onSelectDirectoryCallback = (selectedPath) => {
          if (targetInput) {
            targetInput.value = selectedPath;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        };
        this.dirBrowserModal.open(targetInput ? targetInput.value : '');
      });
    }

    // Direct Tune Button in Editor Header
    const btnTuneLive = document.getElementById('btn-tune-live-channel');
    if (btnTuneLive) {
      btnTuneLive.addEventListener('click', () => {
        const activeCh = this.channels.find(c => c.id === this.activeChannelId);
        if (activeCh && activeCh.station_conf) {
          const chNum = activeCh.station_conf.channel_number;
          this.remoteControl.tuneDirect(chNum);
        }
      });
    }
  }

  loadDefaultChannels() {
    this.channels = [
      {
        id: 'bikie_channel.json',
        filename: 'bikie_channel.json',
        station_conf: {
          network_name: 'bikie',
          network_type: 'loop',
          channel_number: 3,
          content_dir: 'catalog/Bikie',
          network_long_name: 'My Looping Bikie Channel'
        }
      },
      {
        id: 'new_web_channel.json',
        filename: 'new_web_channel.json',
        station_conf: {
          network_name: 'New Web Channel',
          channel_number: 18,
          network_type: 'web',
          web_url: 'https://www.youtube.com/watch?v=awdLU9-Lzho'
        }
      }
    ];

    if (this.channels.length > 0) {
      this.activeChannelId = this.channels[0].id;
      this.channelList.setChannels(this.channels, this.activeChannelId);
      this.channelEditor.loadChannel(this.channels[0]);
      this.crtPreview.updatePreview(this.channels[0]);
    }
  }

  initHeaderEvents() {
    const btnNew = document.getElementById('btn-new-channel');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.createNewChannel());
    }

    const btnExport = document.getElementById('btn-export-bundle');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportAllConfs());
    }

    const btnSync = document.getElementById('btn-sync-confs');
    if (btnSync) {
      btnSync.addEventListener('click', () => {
        this.fetchConfsFromBackend();
        this.showToast('Synced directly with /home/dave/FieldStation42/confs', 'success');
      });
    }

    const btnCrtToggle = document.getElementById('btn-toggle-crt');
    if (btnCrtToggle) {
      btnCrtToggle.addEventListener('click', () => {
        document.body.classList.toggle('crt-enabled');
        this.showToast('Toggled CRT Scanlines', 'info');
      });
    }

    const btnRebuild = document.getElementById('btn-rebuild-schedules');
    if (btnRebuild) {
      btnRebuild.addEventListener('click', async () => {
        this.showToast('Compiling broadcast schedules & rebuilding catalogs...', 'info');
        try {
          const res = await fetch('/api/rebuild_schedules', { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            this.showToast(data.message || 'Schedules compiled successfully!', 'success');
          } else {
            this.showToast('Failed to compile schedules', 'error');
          }
        } catch (err) {
          this.showToast('Error connecting to backend server', 'error');
        }
      });
    }
  }

  handleMediaImported(relTargetDir, createdCount, mode) {
    const activeCh = this.channels.find(c => c.id === this.activeChannelId);
    if (activeCh) {
      activeCh.station_conf.content_dir = relTargetDir;
      this.channelEditor.loadChannel(activeCh);
      this.handleChannelUpdated(activeCh);
    }
    const modeText = mode === 'symlink' ? 'symlinked' : 'copied';
    this.showToast(`Successfully ${modeText} ${createdCount} media files into '${relTargetDir}'!`, 'success');
  }

  createNewChannel() {
    const usedNums = this.channels.map(c => Number(c.station_conf?.channel_number || 0));
    let nextNum = 5;
    while (usedNums.includes(nextNum)) {
      nextNum++;
    }

    const filename = `station_${String(nextNum).padStart(2, '0')}_channel.json`;
    const newCh = {
      id: filename,
      filename: filename,
      station_conf: {
        network_name: `Channel ${nextNum}`,
        channel_number: nextNum,
        network_type: 'standard',
        call_sign: `CH-${nextNum}`,
        content_dir: `catalog/channel_${nextNum}`,
        commercial_free: false
      }
    };

    this.channels.push(newCh);
    this.activeChannelId = newCh.id;
    this.channelList.setChannels(this.channels, this.activeChannelId);
    this.channelEditor.loadChannel(newCh);
    this.crtPreview.updatePreview(newCh);
    this.handleSaveChannel(newCh);
  }

  handleApplyRecipe(preset) {
    if (!preset || !preset.station_conf) return;

    const conf = preset.station_conf;
    const usedNums = this.channels.map(c => Number(c.station_conf?.channel_number || 0));
    let nextNum = conf.channel_number || 10;
    while (usedNums.includes(nextNum)) {
      nextNum++;
    }
    conf.channel_number = nextNum;

    const netSlug = (conf.network_name || 'channel').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `station_${String(nextNum).padStart(2, '0')}_${netSlug}.json`;

    const newCh = {
      id: filename,
      filename: filename,
      station_conf: conf
    };

    this.channels.push(newCh);
    this.activeChannelId = newCh.id;
    this.channelList.setChannels(this.channels, this.activeChannelId);
    this.channelEditor.loadChannel(newCh);
    this.crtPreview.updatePreview(newCh);
    this.handleSaveChannel(newCh);
  }

  handleChannelUpdated(updatedCh) {
    const idx = this.channels.findIndex(c => c.id === updatedCh.id);
    if (idx !== -1) {
      this.channels[idx] = updatedCh;
      this.channelList.setChannels(this.channels, this.activeChannelId);
      this.crtPreview.updatePreview(updatedCh);
    }
  }

  async handleSaveChannel(savedCh) {
    if (savedCh && savedCh.station_conf) {
      // If standard channel has no day schedule templates, auto generate 24/7 template
      if (savedCh.station_conf.network_type === 'standard' && !savedCh.station_conf.monday) {
        if (this.channelEditor) {
          this.channelEditor.generate247ScheduleTemplate();
        }
      }
      // If guide channel, ensure valid images & messages
      if (savedCh.station_conf.network_type === 'guide') {
        if (!savedCh.station_conf.images || savedCh.station_conf.images.length === 0) {
          savedCh.station_conf.images = [
            "runtime/logo_images/gold42.png",
            "runtime/logo_images/groove42.png",
            "runtime/logo_images/city42.png",
            "runtime/logo_images/timeless42.png",
            "runtime/logo_images/mountains42.png"
          ];
        }
        if (!savedCh.station_conf.messages || savedCh.station_conf.messages.length === 0) {
          savedCh.station_conf.messages = [
            "FieldStation42\nInteractive TV Guide",
            "Retro Cable Goodness\nTimeless TV",
            "FS42\nTune in anytime!"
          ];
        }
        if (!savedCh.station_conf.content_dir) {
          savedCh.station_conf.content_dir = "catalog/loop";
        }
        savedCh.station_conf.play_sound = false;
        savedCh.station_conf.fullscreen = false;
        savedCh.station_conf.width = 720;
        savedCh.station_conf.height = 480;
      }
    }

    this.handleChannelUpdated(savedCh);
    try {
      const res = await fetch('/api/save_conf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: savedCh.filename || savedCh.id,
          station_conf: savedCh.station_conf
        })
      });

      if (res.ok) {
        const result = await res.json();
        this.showToast(`Saved ${result.filename || savedCh.id}! Auto-compiling broadcast schedule...`, 'success');

        // Automatically trigger background schedule compilation so the channel plays instantly
        fetch('/api/rebuild_schedules', { method: 'POST' }).catch(() => {});
      } else {
        this.showToast('Failed to save configuration to backend', 'error');
      }
    } catch (e) {
      this.showToast(`Saved locally: ${e.message}`, 'info');
    }
  }

  async handleDeleteChannel(chToDelete) {
    if (confirm(`Are you sure you want to delete Channel ${chToDelete.station_conf?.channel_number} (${chToDelete.station_conf?.network_name})?`)) {
      try {
        await fetch('/api/delete_conf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: chToDelete.filename || chToDelete.id })
        });
      } catch (e) {
        console.warn('Backend delete error:', e);
      }

      this.channels = this.channels.filter(c => c.id !== chToDelete.id);
      if (this.channels.length > 0) {
        this.activeChannelId = this.channels[0].id;
        this.channelList.setChannels(this.channels, this.activeChannelId);
        this.channelEditor.loadChannel(this.channels[0]);
        this.crtPreview.updatePreview(this.channels[0]);
      }
      this.showToast('Channel deleted and backed up (.bak)', 'info');
    }
  }

  handleDuplicateChannel(chToDup) {
    const copyConf = JSON.parse(JSON.stringify(chToDup.station_conf));
    const usedNums = this.channels.map(c => Number(c.station_conf?.channel_number || 0));
    let nextNum = (copyConf.channel_number || 1) + 1;
    while (usedNums.includes(nextNum)) {
      nextNum++;
    }

    copyConf.network_name = `${copyConf.network_name} (Copy)`;
    copyConf.channel_number = nextNum;

    const filename = `station_${String(nextNum).padStart(2, '0')}_copy.json`;
    const dupCh = {
      id: filename,
      filename: filename,
      station_conf: copyConf
    };

    this.channels.push(dupCh);
    this.activeChannelId = dupCh.id;
    this.channelList.setChannels(this.channels, this.activeChannelId);
    this.channelEditor.loadChannel(dupCh);
    this.crtPreview.updatePreview(dupCh);
    this.handleSaveChannel(dupCh);
  }

  exportAllConfs() {
    const bundle = {};
    this.channels.forEach(c => {
      const filename = c.filename || `station_${c.station_conf?.channel_number || 0}.json`;
      bundle[filename] = { station_conf: c.station_conf };
    });

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fieldstation42_confs_bundle.json';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Exported all channel confs bundle!', 'success');
  }

  showToast(msg, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="ri-checkbox-circle-fill"></i> <span>${msg}</span>`;

    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
