export class DirectoryBrowserModal {
  constructor(onSelectDirectoryCallback) {
    this.modalEl = document.getElementById('modal-dir-browser');
    this.onSelectDirectoryCallback = onSelectDirectoryCallback;
    this.currentPath = '';
    this.parentPath = '';

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

    const btnSelect = document.getElementById('btn-confirm-dir-select');
    if (btnSelect) {
      btnSelect.addEventListener('click', () => {
        const pathDisplay = document.getElementById('dir-current-path-display');
        const path = pathDisplay ? pathDisplay.value.trim() : this.currentPath;
        if (this.onSelectDirectoryCallback && path) {
          this.onSelectDirectoryCallback(path);
        }
        this.hide();
      });
    }

    const btnUp = document.getElementById('btn-dir-up');
    if (btnUp) {
      btnUp.addEventListener('click', () => {
        if (this.parentPath) {
          this.fetchPath(this.parentPath);
        }
      });
    }

    // Path input enter key navigation
    const pathDisplay = document.getElementById('dir-current-path-display');
    if (pathDisplay) {
      pathDisplay.removeAttribute('readonly');
      pathDisplay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.fetchPath(pathDisplay.value.trim());
        }
      });
    }

    // Quick Bookmarks
    const bookmarks = this.modalEl.querySelectorAll('.dir-bookmark');
    bookmarks.forEach(bm => {
      bm.addEventListener('click', () => {
        const path = bm.dataset.path;
        this.fetchPath(path);
      });
    });
  }

  open(initialPath = '') {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('hidden');
    this.fetchPath(initialPath || '');
  }

  hide() {
    if (this.modalEl) this.modalEl.classList.add('hidden');
  }

  async fetchPath(path) {
    const pathDisplay = document.getElementById('dir-current-path-display');
    const folderList = document.getElementById('dir-folders-list');
    const mediaCountBadge = document.getElementById('dir-media-count-badge');

    if (folderList) {
      folderList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-dim);">
          <i class="ri-loader-4-line spin" style="font-size: 1.5rem;"></i> Loading path...
        </div>
      `;
    }

    try {
      const res = await fetch('/api/browse_dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });

      if (!res.ok) throw new Error('Failed to browse directory');
      const data = await res.json();

      this.currentPath = data.current_path;
      this.parentPath = data.parent_path;

      if (pathDisplay) pathDisplay.value = this.currentPath;
      if (mediaCountBadge) {
        mediaCountBadge.textContent = `${data.media_count} Video/Audio Files Found`;
      }

      this.renderList(data.subdirs, data.media_files);
    } catch (err) {
      if (folderList) {
        folderList.innerHTML = `
          <div style="padding: 20px; text-align: center; color: var(--accent-rose);">
            <i class="ri-error-warning-line"></i> Error accessing directory: ${err.message}
          </div>
        `;
      }
    }
  }

  renderList(subdirs, mediaFiles) {
    const folderList = document.getElementById('dir-folders-list');
    if (!folderList) return;

    folderList.innerHTML = '';

    if (subdirs.length === 0 && mediaFiles.length === 0) {
      folderList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-dim);">
          Directory is empty
        </div>
      `;
      return;
    }

    // Render Subdirectories
    subdirs.forEach(dir => {
      const item = document.createElement('div');
      item.className = 'dir-item folder';
      item.innerHTML = `
        <i class="ri-folder-fill folder-icon"></i>
        <span class="dir-name">${this.escapeHtml(dir.name)}</span>
      `;

      item.addEventListener('click', () => {
        folderList.querySelectorAll('.dir-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        this.currentPath = dir.path;
        const pathDisplay = document.getElementById('dir-current-path-display');
        if (pathDisplay) pathDisplay.value = this.currentPath;
      });

      item.addEventListener('dblclick', () => {
        this.fetchPath(dir.path);
      });

      folderList.appendChild(item);
    });

    // Render Media Files
    mediaFiles.forEach(file => {
      const item = document.createElement('div');
      item.className = 'dir-item file';
      item.innerHTML = `
        <i class="ri-film-line file-icon"></i>
        <span class="dir-name">${this.escapeHtml(file.name)}</span>
        <span class="file-type-badge">${file.type}</span>
      `;
      folderList.appendChild(item);
    });
  }

  escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }
}
