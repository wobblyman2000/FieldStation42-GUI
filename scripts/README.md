# FieldStation42 Startup & Launcher Scripts

This directory contains automated startup, shutdown, desktop launcher, and autostart service files for **FieldStation42** and **FieldStation42-GUI**.

---

### Files Included

1. **`start_fieldstation42.sh`**:
   - Master startup script.
   - Cleans dangling processes, starts GUI Server (Port 4240), launches playback engine (`field_player.py`), starts TV OSD overlay, and opens `http://localhost:4240` in your web browser.

2. **`stop_fieldstation42.sh`**:
   - Master shutdown script.
   - Gracefully stops all FieldStation42 services.

3. **`FieldStation42.desktop`**:
   - Linux application launcher shortcut.
   - Place in `~/.local/share/applications/` or `~/Desktop/`.

4. **`fs42.service`**:
   - Systemd user service for automatic boot/login autostart.
   - Place in `~/.config/systemd/user/fs42.service` and run `systemctl --user enable fs42.service`.
