export class ChannelList {
  constructor(containerId, onSelectCallback) {
    this.container = document.getElementById(containerId);
    this.onSelectCallback = onSelectCallback;
    this.activeFilter = 'all';
    this.searchQuery = '';
    this.channels = [];
    this.activeChannelId = null;

    this.initFilterChips();
    this.initSearch();
  }

  initFilterChips() {
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeFilter = chip.dataset.filter;
        this.render();
      });
    });
  }

  initSearch() {
    const searchInput = document.getElementById('channel-search-input');
    const clearBtn = document.getElementById('clear-search-btn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        if (clearBtn) {
          clearBtn.classList.toggle('hidden', this.searchQuery.length === 0);
        }
        this.render();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        clearBtn.classList.add('hidden');
        this.render();
      });
    }
  }

  setChannels(channels, activeId = null) {
    this.channels = channels;
    if (activeId !== null) {
      this.activeChannelId = activeId;
    }
    this.updateCounts();
    this.render();
  }

  updateCounts() {
    const countBadge = document.getElementById('count-all');
    if (countBadge) {
      countBadge.textContent = this.channels.length;
    }
    const totalBadge = document.getElementById('total-channels-badge');
    if (totalBadge) {
      totalBadge.textContent = `${this.channels.length} Channels Configured`;
    }
  }

  render() {
    this.container.innerHTML = '';

    const filtered = this.channels.filter(ch => {
      const conf = ch.station_conf || {};
      const type = (conf.network_type || 'standard').toLowerCase();
      const name = (conf.network_name || '').toLowerCase();
      const chNum = String(conf.channel_number || '');

      const matchesFilter = (this.activeFilter === 'all') || (type === this.activeFilter);
      const matchesSearch = !this.searchQuery || 
                            name.includes(this.searchQuery) || 
                            chNum.includes(this.searchQuery);

      return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state" style="padding: 30px 10px; text-align: center; color: var(--text-dim);">
          <i class="ri-tv-off-line" style="font-size: 2rem; margin-bottom: 8px; display: block;"></i>
          <span>No channels match criteria</span>
        </div>
      `;
      return;
    }

    // Sort by channel number ascending
    filtered.sort((a, b) => {
      const numA = Number(a.station_conf?.channel_number || 0);
      const numB = Number(b.station_conf?.channel_number || 0);
      return numA - numB;
    });

    filtered.forEach(ch => {
      const conf = ch.station_conf || {};
      const chNum = conf.channel_number !== undefined ? String(conf.channel_number).padStart(2, '0') : '--';
      const name = conf.network_name || 'Unnamed Channel';
      const type = conf.network_type || 'standard';
      const isSelected = ch.id === this.activeChannelId;

      const item = document.createElement('div');
      item.className = `channel-item ${isSelected ? 'active' : ''}`;
      item.dataset.id = ch.id;

      item.innerHTML = `
        <div class="ch-info">
          <div class="ch-badge">${chNum}</div>
          <div class="ch-meta">
            <span class="ch-name">${this.escapeHtml(name)}</span>
            <span class="ch-sub">${conf.call_sign ? this.escapeHtml(conf.call_sign) : type}</span>
          </div>
        </div>
        <span class="type-tag tag-${type.toLowerCase()}">${type}</span>
      `;

      item.addEventListener('click', () => {
        this.activeChannelId = ch.id;
        this.render();
        if (this.onSelectCallback) {
          this.onSelectCallback(ch);
        }
      });

      this.container.appendChild(item);
    });
  }

  escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }
}
