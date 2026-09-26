export class CrtPreview {
  constructor(onChannelChange) {
    this.onChannelChange = onChannelChange;
    this.screenEl = document.getElementById('crt-sim-screen');
    this.osdCh = document.getElementById('crt-osd-ch');
    this.osdName = document.getElementById('crt-osd-name');
    this.osdTime = document.getElementById('crt-osd-time');
    this.simTitle = document.getElementById('sim-title');
    this.simSub = document.getElementById('sim-sub');
    this.promoBillboard = document.getElementById('crt-promo-billboard');
    this.promoMovieName = document.getElementById('promo-movie-name');
    this.simStandard = document.getElementById('sim-standard');
    this.simAudioVisualizer = document.getElementById('sim-audio-visualizer');
    this.audioTrackTitle = document.getElementById('audio-track-title');

    this.isScrambledActive = false;

    this.startClock();
    this.initControls();
  }

  startClock() {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      if (this.osdTime) {
        this.osdTime.textContent = `${hours}:${minutes} ${ampm}`;
      }
    };
    updateTime();
    setInterval(updateTime, 10000);
  }

  initControls() {
    if (this.btnTestScramble) {
      this.btnTestScramble.addEventListener('click', () => {
        this.isScrambledActive = !this.isScrambledActive;
        if (this.scrambleLayer) this.scrambleLayer.classList.toggle('hidden', !this.isScrambledActive);
        this.btnTestScramble.textContent = this.isScrambledActive ? 'CLEAR FX' : 'TEST FX';
      });
    }

    const knob = document.getElementById('knob-tuner');
    if (knob) {
      const turnKnob = (dir) => {
        let currentRot = parseInt(knob.dataset.rot || 0, 10);
        let nextRot = dir === 'down' ? currentRot - 45 : currentRot + 45;
        knob.style.transform = `rotate(${nextRot}deg)`;
        knob.dataset.rot = nextRot;

        if (typeof this.onChannelChange === 'function') {
          this.onChannelChange(dir);
        }
      };

      knob.addEventListener('click', () => {
        turnKnob('up');
      });

      knob.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
          turnKnob('up');
        } else if (e.deltaY > 0) {
          turnKnob('down');
        }
      }, { passive: false });
    }
  }

  updatePreview(channel) {
    if (!channel) return;
    const conf = channel.station_conf || {};

    const chNum = conf.channel_number !== undefined ? String(conf.channel_number).padStart(2, '0') : '00';
    const name = conf.network_name || 'NO SIGNAL';
    const type = conf.network_type || 'standard';
    const isAudio = type === 'audio' || conf.media_filter === 'audio';

    if (this.osdCh) this.osdCh.textContent = `CH ${chNum}`;
    if (this.osdName) this.osdName.textContent = name.toUpperCase();
    if (this.simTitle) this.simTitle.textContent = name;
    if (this.simSub) {
      let desc = `Mode: ${isAudio ? 'AUDIO RADIO' : type.toUpperCase()}`;
      if (type === 'standard') desc += conf.content_dir ? ` | ${conf.content_dir}` : ' | Scheduled TV';
      else if (type === 'loop') desc += ` | Loop Dir: ${conf.content_dir || 'Default'}`;
      else if (type === 'streaming') desc += ` | Feed: ${conf.stream_url || 'HLS URL'}`;
      else if (type === 'web') desc += ` | Web: ${conf.web_url || 'HTTP'}`;
      else if (type === 'executable') desc += ` | Exec: ${conf.exec_command || 'Command'}`;
      this.simSub.textContent = desc;
    }

    if (this.simTypePill) {
      const displayType = isAudio ? 'AUDIO' : type.toUpperCase();
      this.simTypePill.textContent = displayType;
      this.simTypePill.className = `status-pill tag-${displayType.toLowerCase()}`;
    }

    // Toggle Audio Cassette / Winamp Visualizer vs Standard TV graphic
    if (this.simAudioVisualizer && this.simStandard) {
      if (isAudio) {
        this.simAudioVisualizer.classList.remove('hidden');
        this.simStandard.classList.add('hidden');
        if (this.audioTrackTitle) {
          this.audioTrackTitle.textContent = `NOW PLAYING: ${name.toUpperCase()}`;
        }
      } else {
        this.simAudioVisualizer.classList.add('hidden');
        this.simStandard.classList.remove('hidden');
      }
    }

    // Promo Billboard for 8:00 PM Prime Time Feature Movie
    const primeMovie = conf.prime_time_movie;
    if (this.promoBillboard) {
      if (primeMovie) {
        const cleanName = primeMovie.split('/').pop().replace(/\.[^/.]+$/, '').replace(/_+/g, ' ').toUpperCase();
        if (this.promoMovieName) this.promoMovieName.textContent = cleanName;
        this.promoBillboard.classList.remove('hidden');
      } else {
        this.promoBillboard.classList.add('hidden');
      }
    }

    // Auto trigger scramble layer preview if video_scramble_fx is set
    const hasScramble = conf.video_scramble_fx && conf.video_scramble_fx !== 'none';
    this.isScrambledActive = hasScramble;
    if (this.scrambleLayer) {
      this.scrambleLayer.classList.toggle('hidden', !hasScramble);
    }
    if (this.btnTestScramble) {
      this.btnTestScramble.textContent = hasScramble ? 'CLEAR FX' : 'TEST FX';
    }
  }
}
