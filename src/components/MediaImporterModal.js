export class MediaImporterModal {
  constructor(onMediaImportedCallback, openDirBrowserFunc) {
    this.modalEl = document.getElementById('modal-media-importer');
    this.onMediaImportedCallback = onMediaImportedCallback;
    this.openDirBrowserFunc = openDirBrowserFunc;
    this.currentChannel = null;

    this.initEvents();
  }

  initEvents() {
    if (!this.modalEl) return;

    const closeBtns = this.modalEl.querySelectorAll('.close-modal-btn');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => this.hide());
    });

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.hide();
    });

    const btnBrowseSource = document.getElementById('btn-browse-import-source');
    if (btnBrowseSource) {
      btnBrowseSource.addEventListener('click', () => {
        if (this.openDirBrowserFunc) {
          this.openDirBrowserFunc((selectedPath) => {
            const inputSource = document.getElementById('import-source-path');
            if (inputSource) inputSource.value = selectedPath;
            this.scanSourceDir(selectedPath);
          });
        }
      });
    }

    const inputSource = document.getElementById('import-source-path');
    if (inputSource) {
      inputSource.addEventListener('change', () => {
        this.scanSourceDir(inputSource.value);
      });
    }

    const btnExecute = document.getElementById('btn-execute-import');
    if (btnExecute) {
      btnExecute.addEventListener('click', () => this.executeImport());
    }
  }

  open(channel) {
    this.currentChannel = channel;
    if (!this.modalEl) return;

    const conf = channel?.station_conf || {};
    const netName = conf.network_name || 'channel';
    const defaultCatalogName = netName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

    const inputTarget = document.getElementById('import-target-folder');
    if (inputTarget) inputTarget.value = defaultCatalogName;

    this.modalEl.classList.remove('hidden');
  }

  hide() {
    if (this.modalEl) this.modalEl.classList.add('hidden');
  }

  async scanSourceDir(path) {
    const scanStatus = document.getElementById('import-scan-status');
    if (!path) return;

    if (scanStatus) {
      scanStatus.innerHTML = `<i class="ri-loader-4-line spin"></i> Scanning source directory...`;
    }

    try {
      const res = await fetch('/api/browse_dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      const data = await res.json();
      if (scanStatus) {
        scanStatus.innerHTML = `<i class="ri-checkbox-circle-line"></i> Found <strong>${data.media_count}</strong> compatible video/audio files in source folder.`;
      }
    } catch (e) {
      if (scanStatus) {
        scanStatus.innerHTML = `<i class="ri-error-warning-line"></i> Could not scan folder.`;
      }
    }
  }

  async executeImport() {
    const sourceDir = document.getElementById('import-source-path')?.value;
    const targetFolder = document.getElementById('import-target-folder')?.value;
    const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'symlink';
    const btnExecute = document.getElementById('btn-execute-import');

    if (!sourceDir || !targetFolder) {
      alert('Please specify both source media folder and target catalog name.');
      return;
    }

    if (btnExecute) {
      btnExecute.disabled = true;
      btnExecute.innerHTML = `<i class="ri-loader-4-line spin"></i> Generating Catalog...`;
    }

    try {
      const res = await fetch('/api/import_media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_dir: sourceDir,
          target_folder_name: targetFolder,
          mode: mode
        })
      });

      if (!res.ok) throw new Error('Failed to generate catalog media');
      const data = await res.json();

      if (data.success) {
        if (this.onMediaImportedCallback) {
          this.onMediaImportedCallback(data.rel_target_dir, data.created_count, mode);
        }
        this.hide();
      } else {
        alert(`Error importing media: ${data.errors ? data.errors.join(', ') : 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Import Failed: ${err.message}`);
    } finally {
      if (btnExecute) {
        btnExecute.disabled = false;
        btnExecute.innerHTML = `<i class="ri-play-line"></i> Generate Media Links`;
      }
    }
  }
}
