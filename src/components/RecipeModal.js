export class RecipeModal {
  constructor(onApplyRecipeCallback) {
    this.modalEl = document.getElementById('modal-recipe-wizard');
    this.onApplyRecipeCallback = onApplyRecipeCallback;

    this.initEvents();
  }

  initEvents() {
    const btnOpen = document.getElementById('btn-recipe-wizard');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => this.show());
    }

    const closeBtns = this.modalEl.querySelectorAll('.close-modal-btn');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => this.hide());
    });

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.hide();
    });

    // Recipe Cards Click Handler
    const cards = this.modalEl.querySelectorAll('.recipe-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const recipeType = card.dataset.recipe;
        this.applyRecipe(recipeType);
        this.hide();
      });
    });

    // Mini Widget Recipe Cards
    const miniCards = document.querySelectorAll('.recipe-mini-card');
    miniCards.forEach(mini => {
      mini.addEventListener('click', () => {
        const recipeType = mini.dataset.recipe;
        this.applyRecipe(recipeType);
      });
    });
  }

  show() {
    this.modalEl.classList.remove('hidden');
  }

  hide() {
    this.modalEl.classList.add('hidden');
  }

  applyRecipe(recipeKey) {
    let preset = {};

    switch (recipeKey) {
      case 'standard-tv':
      case 'cartoons':
        preset = {
          station_conf: {
            network_name: recipeKey === 'cartoons' ? 'Saturday Morning Cartoons' : 'Retro Broadcast Network',
            channel_number: 5,
            network_type: 'standard',
            call_sign: 'WRET-TV',
            content_dir: 'catalog/cartoons/',
            commercials_dir: 'runtime/commercials/',
            bumps_dir: 'runtime/bumps/',
            commercial_free: false,
            parental_controls: false
          }
        };
        break;

      case 'movie-loop':
      case 'loop':
        preset = {
          station_conf: {
            network_name: '24/7 Cult Cinema Loop',
            channel_number: 12,
            network_type: 'loop',
            call_sign: 'LOOP-12',
            content_dir: 'catalog/movies/ambient_loop',
            commercial_free: true
          }
        };
        break;

      case 'tv-guide':
      case 'guide':
        preset = {
          station_conf: {
            network_name: 'Interactive TV Guide Network',
            channel_number: 2,
            network_type: 'guide',
            call_sign: 'GUIDE',
            content_dir: 'catalog/loop',
            messages: [
              "FieldStation42\nInteractive TV Guide",
              "Retro Cable Goodness\nTimeless TV",
              "FS42\nTune in anytime!",
              "FieldStation42\nMountain Fresh"
            ],
            images: [
              "runtime/logo_images/gold42.png",
              "runtime/logo_images/groove42.png",
              "runtime/logo_images/city42.png",
              "runtime/logo_images/timeless42.png",
              "runtime/logo_images/mountains42.png"
            ],
            fullscreen: false,
            width: 720,
            height: 480,
            scroll_speed: 1.0,
            play_sound: false
          }
        };
        break;

      case 'iptv-stream':
      case 'iptv':
        preset = {
          station_conf: {
            network_name: 'Retro News Feed',
            channel_number: 24,
            network_type: 'streaming',
            call_sign: 'IPTV',
            stream_url: 'https://example.com/live/stream.m3u8',
            commercial_free: true
          }
        };
        break;

      case 'web-widget':
        preset = {
          station_conf: {
            network_name: 'Station Weather & Teletext Web',
            channel_number: 42,
            network_type: 'web',
            web_url: 'http://localhost:8080/teletext',
            commercial_free: true
          }
        };
        break;

      case 'ppv-movies':
      case 'ppv':
        preset = {
          station_conf: {
            network_name: 'PPV Movie Cinema',
            channel_number: 10,
            network_type: 'ppv',
            call_sign: 'PPV-10',
            description: 'On-Demand Pay-Per-View Movie Library',
            content_dir: 'catalog/ppv',
            web_url: 'http://localhost:4242/static/ppv/ppv.html?channel=10',
            commercial_free: true
          }
        };
        break;

      case 'retro-arcade':
        preset = {
          station_conf: {
            network_name: '8-Bit Retro Arcade Launcher',
            channel_number: 88,
            network_type: 'executable',
            exec_command: 'retroarch -L /cores/nes_libretro.so game.nes'
          }
        };
        break;

      case 'audio-radio':
      case 'audio':
        preset = {
          station_conf: {
            network_name: 'Music42',
            network_type: 'standard',
            media_filter: 'audio',
            content_dir: 'catalog/music42/',
            commercial_dir: 'commercials',
            bump_dir: 'bumps'
          }
        };
        break;

      default:
        break;
    }

    if (this.onApplyRecipeCallback) {
      this.onApplyRecipeCallback(preset);
    }
  }
}
