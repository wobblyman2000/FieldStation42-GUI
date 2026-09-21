# Field Station 42 Studio GUI 📺⚡

A retro-futuristic, CRT-themed web management interface and visual editor for **Field Station 42**. Built with HTML, Vite, JavaScript, CSS, and Python.

![Field Station 42 Studio](https://raw.githubusercontent.com/wobblyman2000/FieldStation42-GUI/main/dist/index.html)

---

## 🌟 Key Features

- **📺 Retro-Modern Broadcast UI**: CRT television phosphor dark mode aesthetic, scanline toggles, and live TV station identification.
- **📁 Interactive Directory Browser & Media Importer**: Browse local directories and create zero-disk-space symlinks directly into Field Station 42's `catalog/`.
- **🎛️ Visual Multi-Tab Channel Editor**: Configure General Settings, Content Sources, Playback & Subscription Scramble FX (`color_inversion`, `severe_noise`, `special_sauce`), Schedule Slots, and JSON schemas.
- **🪄 Preset Channel Recipe Wizard**: 1-click blueprints for Classic Cable TV, Commercial-Free Movie Loops, Scrolling TV Guide, IPTV Streams, Web Dashboards, and Pay-Per-View Cinema.
- **🍿 Pay-Per-View Cinema & Artwork Generator**: Auto-generate `.nfo` metadata and `.jpg` retro posters from video files with single-click on-demand cinema playback.
- **📡 Built-In On-Screen Display (OSD) Controls**: Toggle and test Field Station 42's OpenGL transparent overlay (`fs42/osd/main.py`) directly from the top header bar (`CH 05`, station bugs, volume meter).
- **📟 Remote Control & FLIRC Listener**: Full 10-key numeric remote control with FLIRC USB IR receiver event integration and web keyboard shortcuts.

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js & npm
- Field Station 42 core installation at `/home/dave/FieldStation42` or adjacent directory

### Running Field Station 42 Studio

```bash
# Clone the repository
git clone https://github.com/wobblyman2000/FieldStation42-GUI.git
cd FieldStation42-GUI

# Install frontend dependencies (optional for dev build)
npm install

# Launch the Studio Server
python3 server.py
```

Access the Studio interface in your web browser at:
`http://localhost:4240`

---

## 🛠️ Architecture & Ports

- **Studio Web Interface**: `http://localhost:4240` (`server.py`)
- **Field Station 42 Player**: `http://localhost:4242` (`field_player.py`)
- **OSD Subsystem**: Transparent OpenGL overlay (`fs42/osd/main.py`)
- **FLIRC Remote Listener**: `/dev/input/by-id/usb-flirc.tv_flirc-event-kbd`

---

## 📄 License

MIT License
