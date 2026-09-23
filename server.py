#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
import sys
import shutil
import subprocess
import signal
import time

PORT = 4240
GUI_DIR = os.path.dirname(os.path.abspath(__file__))

# Primary Field Station 42 Installation Path
FS42_HOME = "/home/dave/FieldStation42"
if not os.path.exists(FS42_HOME):
    FS42_HOME = GUI_DIR

VENV_PYTHON = os.path.join(FS42_HOME, "env", "bin", "python3")
if not os.path.exists(VENV_PYTHON):
    VENV_PYTHON = sys.executable

CONFS_DIR = os.path.join(FS42_HOME, "confs")
CATALOG_DIR = os.path.join(FS42_HOME, "catalog")
RUNTIME_DIR = os.path.join(FS42_HOME, "runtime")
CHANNEL_SOCKET = os.path.join(RUNTIME_DIR, "channel.socket")
PLAY_STATUS_SOCKET = os.path.join(RUNTIME_DIR, "play_status.socket")

os.makedirs(CONFS_DIR, exist_ok=True)
os.makedirs(CATALOG_DIR, exist_ok=True)
os.makedirs(RUNTIME_DIR, exist_ok=True)

VIDEO_EXTS = {'.mp4', '.mkv', '.avi', '.ts', '.mov', '.webm', '.m4v', '.mpg', '.mpeg', '.flv'}
AUDIO_EXTS = {'.mp3', '.wav', '.ogg', '.flac', '.m4a'}

player_process = None

def is_player_running():
    global player_process
    if player_process and player_process.poll() is None:
        return True
    try:
        output = subprocess.check_output(["pgrep", "-f", "field_player.py|station_42.py"], text=True)
        return bool(output.strip())
    except Exception:
        return False

flirc_enabled = True
remote_controller_proc = None

def start_remote_controller():
    global remote_controller_proc
    if remote_controller_proc and remote_controller_proc.poll() is None:
        return True

    remote_script = os.path.join(FS42_HOME, "fs42", "pi", "remote_controller.py")
    if os.path.exists(remote_script):
        try:
            env = os.environ.copy()
            env["FS42_HOST"] = "127.0.0.1"
            env["FS42_PORT"] = "4242"
            remote_controller_proc = subprocess.Popen(
                [VENV_PYTHON, remote_script, "-d", "flirc"],
                cwd=FS42_HOME,
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            print("🚀 Started FLIRC background listener process (remote_controller.py)")
            return True
        except Exception as e:
            print(f"⚠️ Could not start remote_controller.py: {e}")
            return False
    return False

def stop_remote_controller():
    global remote_controller_proc
    if remote_controller_proc and remote_controller_proc.poll() is None:
        try:
            remote_controller_proc.terminate()
            remote_controller_proc.wait(timeout=2)
            print("🛑 Stopped FLIRC background listener process")
        except Exception:
            try:
                remote_controller_proc.kill()
            except Exception:
                pass
    remote_controller_proc = None

osd_enabled = True
osd_proc = None

def start_osd():
    global osd_proc
    if is_osd_running():
        return True

    osd_script = os.path.join(FS42_HOME, "fs42", "osd", "main.py")
    if os.path.exists(osd_script):
        try:
            osd_proc = subprocess.Popen(
                [VENV_PYTHON, osd_script],
                cwd=FS42_HOME,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            print("📺 Started On-Screen Display process (fs42/osd/main.py)")
            return True
        except Exception as e:
            print(f"⚠️ Could not start osd/main.py: {e}")
            return False
    return False

def stop_osd():
    global osd_proc
    try:
        subprocess.run(["pkill", "-f", "fs42/osd/main.py"], check=False)
    except Exception:
        pass
    if osd_proc and osd_proc.poll() is None:
        try:
            osd_proc.terminate()
            osd_proc.wait(timeout=2)
            print("🛑 Stopped On-Screen Display process")
        except Exception:
            try:
                osd_proc.kill()
            except Exception:
                pass
    osd_proc = None

def is_osd_running():
    global osd_proc
    if osd_proc and osd_proc.poll() is None:
        return True
    try:
        output = subprocess.check_output(["pgrep", "-f", "fs42/osd/main.py"], text=True)
        return bool(output.strip())
    except Exception:
        return False


def get_flirc_device_info():
    flirc_path = "/dev/input/by-id/usb-flirc.tv_flirc-event-kbd"
    if os.path.exists(flirc_path):
        try:
            with open(flirc_path, "rb"):
                pass
            return {"connected": True, "path": flirc_path, "has_permission": True, "name": "FLIRC USB Remote Receiver"}
        except PermissionError:
            return {"connected": True, "path": flirc_path, "has_permission": False, "name": "FLIRC USB Remote Receiver"}
        except Exception:
            pass

    if os.path.exists("/dev/input"):
        try:
            import evdev
            for path in evdev.list_devices():
                try:
                    dev = evdev.InputDevice(path)
                    if "flirc" in dev.name.lower():
                        return {"connected": True, "path": path, "has_permission": True, "name": dev.name}
                except PermissionError:
                    return {"connected": True, "path": path, "has_permission": False, "name": "FLIRC USB Remote Receiver"}
                except Exception:
                    pass
        except Exception:
            pass

    return {"connected": False, "path": None, "has_permission": False, "name": None}

class FieldStationServerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        directory = GUI_DIR
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        url_path = self.path.split('?')[0]
        if url_path == '/api/confs':
            self.handle_get_confs()
            return
        elif url_path == '/api/info':
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "fs42_home": FS42_HOME,
                "confs_dir": CONFS_DIR,
                "catalog_dir": CATALOG_DIR,
                "gui_port": PORT,
                "fs42_port": 4242,
                "player_running": is_player_running()
            }).encode("utf-8"))
            return
        elif url_path == '/api/player/status':
            self.handle_player_status()
            return
        elif url_path == '/api/schedule':
            self.handle_get_schedule()
            return
        elif url_path == '/api/ppv/items':
            self.handle_get_ppv_items()
            return
        elif url_path == '/api/file':
            self.handle_serve_file()
            return
        elif url_path == '/api/flirc/status':
            self.handle_flirc_status()
            return
        elif url_path == '/api/osd/status':
            self.handle_osd_status()
            return

        super().do_GET()

    def do_POST(self):
        url_path = self.path.split('?')[0]
        if url_path == '/api/save_conf':
            self.handle_save_conf()
            return
        elif url_path == '/api/delete_conf':
            self.handle_delete_conf()
            return
        elif url_path == '/api/browse_dir':
            self.handle_browse_dir()
            return
        elif url_path == '/api/import_media':
            self.handle_import_media()
            return
        elif url_path == '/api/player/start':
            self.handle_player_start()
            return
        elif url_path == '/api/player/stop':
            self.handle_player_stop()
            return
        elif url_path == '/api/player/channel':
            self.handle_player_channel()
            return
        elif url_path == '/api/player/volume':
            self.handle_player_volume()
            return
        elif url_path == '/api/rebuild_schedules':
            self.handle_rebuild_schedules()
            return
        elif url_path == '/api/ppv/play':
            self.handle_ppv_play()
            return
        elif url_path == '/api/ppv/generate_metadata':
            self.handle_ppv_generate_metadata()
            return
        elif url_path == '/api/create_dir':
            self.handle_create_dir()
            return
        elif url_path == '/api/flirc/toggle':
            self.handle_flirc_toggle()
            return
        elif url_path == '/api/osd/toggle':
            self.handle_osd_toggle()
            return
        elif url_path == '/api/osd/test':
            self.handle_osd_test()
            return

        self.send_error(404, "Endpoint not found")

    def handle_create_dir(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        try:
            payload = json.loads(post_data.decode("utf-8")) if content_length > 0 else {}
            target_path = payload.get("path")
            if not target_path:
                self.send_error(400, "Path required")
                return

            if not os.path.isabs(target_path):
                target_path = os.path.abspath(os.path.join(FS42_HOME, target_path))

            os.makedirs(target_path, exist_ok=True)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "path": target_path}).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error creating directory: {e}")

    def handle_get_confs(self):
        files_data = []
        if os.path.exists(CONFS_DIR):
            for filename in sorted(os.listdir(CONFS_DIR)):
                if filename.endswith(".json") and not filename.endswith(".bak"):
                    filepath = os.path.join(CONFS_DIR, filename)
                    try:
                        with open(filepath, "r", encoding="utf-8") as f:
                            content = json.load(f)
                            if "station_conf" in content:
                                files_data.append({
                                    "id": filename,
                                    "filename": filename,
                                    "station_conf": content.get("station_conf", {})
                                })
                            elif "network_name" in content:
                                files_data.append({
                                    "id": filename,
                                    "filename": filename,
                                    "station_conf": content
                                })
                    except Exception as e:
                        print(f"Error reading {filename}: {e}")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(files_data).encode("utf-8"))

    def handle_save_conf(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        try:
            payload = json.loads(post_data.decode("utf-8"))
            filename = payload.get("filename")
            station_conf = payload.get("station_conf", {})

            if not filename:
                ch_num = station_conf.get("channel_number", 1)
                net_name = station_conf.get("network_name", "channel").lower().replace(" ", "_")
                filename = f"station_{ch_num:02d}_{net_name}.json"

            if not filename.endswith(".json"):
                filename += ".json"

            filepath = os.path.join(CONFS_DIR, filename)

            # Auto-ensure content_dir exists on disk and normalize path relative to FS42_HOME
            content_dir = station_conf.get("content_dir")
            if content_dir:
                if os.path.isabs(content_dir):
                    abs_content_dir = content_dir
                    if content_dir.startswith(FS42_HOME):
                        rel_dir = os.path.relpath(content_dir, FS42_HOME)
                        station_conf["content_dir"] = rel_dir
                else:
                    abs_content_dir = os.path.join(FS42_HOME, content_dir)
                os.makedirs(abs_content_dir, exist_ok=True)

            # Auto normalize PPV web_url if network_type is ppv
            if station_conf.get("network_type") == "ppv":
                ch_num = station_conf.get("channel_number", 10)
                web_url = station_conf.get("web_url", "")
                if not web_url or "<IP_ADDRESS_OR_HOST>" in web_url or "localhost" not in web_url:
                    station_conf["web_url"] = f"http://localhost:4242/static/ppv/ppv.html?channel={ch_num}"

            # Create backup if file exists
            if os.path.exists(filepath):
                shutil.copy2(filepath, filepath + ".bak")

            with open(filepath, "w", encoding="utf-8") as f:
                json.dump({"station_conf": station_conf}, f, indent=2)

            # Rebuild catalog and schedules using -r and -w
            station_script = os.path.join(FS42_HOME, "station_42.py")
            net_name = station_conf.get("network_name")
            if os.path.exists(station_script):
                cmd = [VENV_PYTHON, station_script, "-r", net_name, "-w", net_name] if net_name else [VENV_PYTHON, station_script, "-r", "-w"]
                print(f"🔄 Auto-building catalog and week schedule for saved channel: {cmd}")
                try:
                    subprocess.run(cmd, cwd=FS42_HOME, capture_output=True, text=True, timeout=45)
                except Exception as build_err:
                    print(f"Warning: Schedule build process had issue: {build_err}")

            # Auto reload player engine if running so StationManager loads the new channel immediately
            if is_player_running():
                print("🔄 Restarting playback engine to load newly saved channel into StationManager...")
                try:
                    subprocess.call(["pkill", "-f", "field_player.py"])
                    time.sleep(0.5)
                    player_script = os.path.join(FS42_HOME, "field_player.py")
                    subprocess.Popen(
                        [VENV_PYTHON, player_script],
                        cwd=FS42_HOME,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL
                    )
                except Exception as pe:
                    print(f"Error restarting player after saving channel: {pe}")

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True, 
                "filename": filename,
                "message": f"Saved configuration, rebuilt schedules, and updated playback engine"
            }).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error saving configuration: {e}")

    def handle_delete_conf(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        try:
            payload = json.loads(post_data.decode("utf-8"))
            filename = payload.get("filename")
            if not filename:
                self.send_error(400, "Missing filename")
                return

            filepath = os.path.join(CONFS_DIR, filename)
            if os.path.exists(filepath):
                shutil.move(filepath, filepath + ".bak")

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": f"Deleted {filename}"}).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error deleting configuration: {e}")

    def handle_player_status(self):
        running = is_player_running()
        status_info = {
            "running": running,
            "status": "PLAYING" if running else "STOPPED",
            "current_channel": None,
            "current_title": None
        }

        if running and os.path.exists(PLAY_STATUS_SOCKET):
            try:
                with open(PLAY_STATUS_SOCKET, "r") as f:
                    content = json.load(f)
                    status_info["current_channel"] = content.get("channel_number")
                    status_info["current_title"] = content.get("title")
            except Exception:
                pass

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(status_info).encode("utf-8"))

    def handle_player_start(self):
        global player_process
        if is_player_running():
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "Player is already running"}).encode("utf-8"))
            return

        try:
            player_script = os.path.join(FS42_HOME, "field_player.py")
            if not os.path.exists(player_script):
                player_script = os.path.join(FS42_HOME, "station_42.py")

            print(f"🚀 Launching FieldStation42 playback engine: {player_script}")
            player_process = subprocess.Popen(
                [VENV_PYTHON, player_script],
                cwd=FS42_HOME,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "Started FieldStation42 playback engine"}).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Failed to start playback process: {e}")

    def handle_player_stop(self):
        global player_process
        try:
            with open(CHANNEL_SOCKET, "w") as f:
                f.write(json.dumps({"command": "exit"}))

            subprocess.call(["pkill", "-f", "field_player.py"])
            subprocess.call(["pkill", "-f", "station_42.py"])

            player_process = None

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "Stopped FieldStation42 playback"}).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error stopping playback: {e}")

    def handle_player_channel(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        try:
            payload = json.loads(post_data.decode("utf-8"))
            cmd_type = payload.get("command", "direct")
            channel = payload.get("channel")

            cmd_obj = {}
            if cmd_type == "direct":
                cmd_obj = {"command": "direct", "channel": int(channel)}
            elif cmd_type == "up":
                cmd_obj = {"command": "up"}
            elif cmd_type == "down":
                cmd_obj = {"command": "down"}
            elif cmd_type == "guide":
                cmd_obj = {"command": "guide"}

            with open(CHANNEL_SOCKET, "w") as f:
                f.write(json.dumps(cmd_obj))

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "sent": cmd_obj}).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error sending channel command: {e}")

    def handle_player_volume(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        try:
            payload = json.loads(post_data.decode("utf-8"))
            action = payload.get("action", "up")

            if shutil.which("amixer"):
                if action == "up":
                    subprocess.call(["amixer", "sset", "Master", "5%+"])
                elif action == "down":
                    subprocess.call(["amixer", "sset", "Master", "5%-"])
                elif action == "mute":
                    subprocess.call(["amixer", "sset", "Master", "toggle"])
            elif shutil.which("pactl"):
                if action == "up":
                    subprocess.call(["pactl", "set-sink-volume", "@DEFAULT_SINK@", "+5%"])
                elif action == "down":
                    subprocess.call(["pactl", "set-sink-volume", "@DEFAULT_SINK@", "-5%"])
                elif action == "mute":
                    subprocess.call(["pactl", "set-sink-mute", "@DEFAULT_SINK@", "toggle"])

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "action": action}).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error changing volume: {e}")

    def handle_browse_dir(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        try:
            payload = json.loads(post_data.decode("utf-8")) if content_length > 0 else {}
            target_path = payload.get("path", os.path.expanduser("~"))

            if not target_path or target_path == "~":
                target_path = os.path.expanduser("~")
            elif target_path == "catalog":
                target_path = CATALOG_DIR

            if not os.path.isabs(target_path):
                target_path = os.path.abspath(os.path.join(FS42_HOME, target_path))

            if not os.path.exists(target_path) or not os.path.isdir(target_path):
                target_path = os.path.expanduser("~")

            subdirs = []
            files_info = []

            try:
                dir_items = sorted(os.listdir(target_path))
            except Exception:
                dir_items = []

            for item in dir_items:
                if item.startswith('.'):
                    continue
                full_item = os.path.join(target_path, item)
                try:
                    if os.path.isdir(full_item):
                        subdirs.append({
                            "name": item,
                            "path": full_item
                        })
                    elif os.path.isfile(full_item):
                        ext = os.path.splitext(item)[1].lower()
                        if ext in VIDEO_EXTS or ext in AUDIO_EXTS:
                            files_info.append({
                                "name": item,
                                "type": "video" if ext in VIDEO_EXTS else "audio"
                            })
                except Exception:
                    pass

            parent_dir = os.path.dirname(target_path) if target_path != "/" else "/"

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "current_path": target_path,
                "parent_path": parent_dir,
                "subdirs": subdirs,
                "media_files": files_info,
                "media_count": len(files_info)
            }).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error browsing directory: {e}")

    def handle_import_media(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        try:
            payload = json.loads(post_data.decode("utf-8"))
            source_dir = payload.get("source_dir")
            target_folder_name = payload.get("target_folder_name")
            mode = payload.get("mode", "symlink")

            if not source_dir or not target_folder_name:
                self.send_error(400, "Missing source_dir or target_folder_name")
                return

            if not os.path.exists(source_dir):
                self.send_error(404, f"Source directory does not exist: {source_dir}")
                return

            clean_target_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in target_folder_name.strip())
            rel_target_dir = os.path.join("catalog", clean_target_name)
            abs_target_dir = os.path.join(CATALOG_DIR, clean_target_name)

            os.makedirs(abs_target_dir, exist_ok=True)

            processed_count = 0
            errors = []

            for root, dirs, files in os.walk(source_dir, followlinks=False):
                dirs[:] = [d for d in dirs if not d.startswith(".")]
                rel_root = os.path.relpath(root, source_dir)

                for item in files:
                    if item.startswith("."):
                        continue
                    ext = os.path.splitext(item)[1].lower()
                    if ext in VIDEO_EXTS or ext in AUDIO_EXTS:
                        source_item = os.path.join(root, item)

                        if rel_root != ".":
                            prefix = rel_root.replace(os.sep, "_").replace(" ", "_")
                            symlink_name = f"{prefix}_{item}"
                        else:
                            symlink_name = item

                        target_item = os.path.join(abs_target_dir, symlink_name)
                        try:
                            if os.path.exists(target_item) or os.path.islink(target_item):
                                os.remove(target_item)

                            if mode == "symlink":
                                os.symlink(source_item, target_item)
                            else:
                                shutil.copy2(source_item, target_item)
                            processed_count += 1
                        except Exception as err:
                            errors.append(f"Failed {item}: {str(err)}")

            # Auto trigger FieldStation42 catalog rebuild and schedule compilation
            station_script = os.path.join(FS42_HOME, "station_42.py")
            if os.path.exists(station_script):
                print("🔄 Auto-triggering FieldStation42 catalog rebuild and schedule compilation after media import...")
                subprocess.Popen(
                    [VENV_PYTHON, station_script, "-r", "-w"],
                    cwd=FS42_HOME,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "mode": mode,
                "created_count": processed_count,
                "rel_target_dir": rel_target_dir,
                "abs_target_dir": abs_target_dir,
                "errors": errors
            }).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error processing media import: {e}")

    def handle_rebuild_schedules(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            payload = {}
            if content_length > 0:
                try:
                    payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
                except Exception:
                    pass

            station_name = payload.get("station") or payload.get("station_name") or payload.get("network_name")
            channel_id = payload.get("channel_id") or payload.get("filename")

            if not station_name and channel_id:
                filepath = os.path.join(CONFS_DIR, channel_id)
                if not filepath.endswith(".json"):
                    filepath += ".json"
                if os.path.exists(filepath):
                    try:
                        with open(filepath, "r", encoding="utf-8") as f:
                            cdata = json.load(f)
                            station_name = cdata.get("station_conf", {}).get("network_name") or cdata.get("network_name")
                    except Exception:
                        pass

            station_script = os.path.join(FS42_HOME, "station_42.py")
            if not os.path.exists(station_script):
                self.send_error(404, "station_42.py script not found")
                return

            if station_name:
                cmd = [VENV_PYTHON, station_script, "-r", station_name, "-w", station_name]
                msg_target = f"for '{station_name}'"
            else:
                cmd = [VENV_PYTHON, station_script, "-r", "-w"]
                msg_target = "for all stations"

            print(f"🔄 Running FieldStation42 catalog rebuild & schedule compilation {msg_target}...")
            res = subprocess.run(
                cmd,
                cwd=FS42_HOME,
                capture_output=True,
                text=True,
                timeout=60
            )

            # Auto reload player engine if running so StationManager loads updated schedules immediately
            if is_player_running():
                print("🔄 Restarting playback engine to apply rebuilt schedules in StationManager...")
                try:
                    subprocess.call(["pkill", "-f", "field_player.py"])
                    time.sleep(0.5)
                    player_script = os.path.join(FS42_HOME, "field_player.py")
                    subprocess.Popen(
                        [VENV_PYTHON, player_script],
                        cwd=FS42_HOME,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL
                    )
                except Exception as pe:
                    print(f"Error restarting player after schedule rebuild: {pe}")

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": res.returncode == 0,
                "output": res.stdout[-1000:] if res.stdout else "",
                "message": f"Rebuilt catalog and updated week schedules {msg_target}"
            }).encode("utf-8"))
        except subprocess.TimeoutExpired:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "message": "Schedule rebuild process initiated in background"
            }).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error rebuilding schedules: {e}")

    def handle_get_schedule(self):
        from urllib.parse import parse_qs, urlparse
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        target_station = qs.get("station", [None])[0] or qs.get("channel", [None])[0]

        db_path = os.path.join(FS42_HOME, "runtime", "fs42_fluid.db")
        result_stations = []

        if os.path.exists(db_path):
            try:
                import sqlite3, datetime, re
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()

                query = "SELECT station, start_time, end_time, title, plan_json FROM liquid_blocks ORDER BY start_time ASC;"
                cursor.execute(query)
                rows = cursor.fetchall()
                now = datetime.datetime.now()

                by_station = {}

                for row in rows:
                    station_name = row[0]
                    if target_station and target_station.lower() not in (station_name.lower(), str(row[0]).lower()):
                        continue

                    try:
                        plan = json.loads(row[4])
                    except Exception:
                        plan = []

                    block_start_str = row[1]
                    try:
                        t = datetime.datetime.strptime(block_start_str.split('.')[0], "%Y-%m-%d %H:%M:%S")
                    except Exception:
                        t = now

                    if station_name not in by_station:
                        by_station[station_name] = []

                    for entry in plan:
                        path = entry.get("path", "")
                        duration = entry.get("duration", 0)
                        if not path or duration <= 0:
                            continue

                        end_t = t + datetime.timedelta(seconds=duration)

                        # Clean Title
                        base = os.path.basename(path)
                        name, _ = os.path.splitext(base)
                        clean = re.sub(r'_+', ' ', name).strip()
                        halves = clean.split(' ')
                        mid = len(halves) // 2
                        if len(halves) > 2 and ' '.join(halves[:mid]) == ' '.join(halves[mid:]):
                            clean = ' '.join(halves[:mid])

                        is_now_playing = (t <= now < end_t)

                        by_station[station_name].append({
                            "station": station_name,
                            "file": path,
                            "title": clean,
                            "start_iso": t.isoformat(),
                            "end_iso": end_t.isoformat(),
                            "start_fmt": t.strftime("%I:%M %p"),
                            "end_fmt": end_t.strftime("%I:%M %p"),
                            "duration_mins": int(round(duration / 60)),
                            "is_now_playing": is_now_playing
                        })

                        t = end_t

                for st_name, items in by_station.items():
                    result_stations.append({
                        "station": st_name,
                        "items": items
                    })

                conn.close()
            except Exception as err:
                print(f"Error querying schedule DB: {err}")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(result_stations).encode("utf-8"))

    def handle_serve_file(self):
        from urllib.parse import parse_qs, urlparse
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        target_path = qs.get("path", [None])[0]
        if target_path and os.path.exists(target_path) and os.path.isfile(target_path):
            import mimetypes
            mime, _ = mimetypes.guess_type(target_path)
            self.send_response(200)
            self.send_header("Content-Type", mime or "application/octet-stream")
            self.end_headers()
            with open(target_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, "File not found")

    def handle_get_ppv_items(self):
        from urllib.parse import parse_qs, urlparse
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        target_dir = qs.get("content_dir", [None])[0] or "catalog/ppv"

        if not os.path.isabs(target_dir):
            abs_dir = os.path.abspath(os.path.join(FS42_HOME, target_dir))
        else:
            abs_dir = target_dir

        items = []
        if os.path.exists(abs_dir) and os.path.isdir(abs_dir):
            for root, dirs, files in os.walk(abs_dir):
                for filename in sorted(files):
                    if filename.startswith('.'):
                        continue

                    file_path = os.path.join(root, filename)
                    base, ext = os.path.splitext(filename)
                    if ext.lower() in VIDEO_EXTS:
                        import re
                        clean_title = re.sub(r'_+', ' ', base).strip()
                        halves = clean_title.split(' ')
                        mid = len(halves) // 2
                        if len(halves) > 2 and ' '.join(halves[:mid]) == ' '.join(halves[mid:]):
                            clean_title = ' '.join(halves[:mid])

                        info = ""
                        desc = ""
                        nfo_path = os.path.join(root, f"{base}.nfo")
                        if os.path.exists(nfo_path):
                            try:
                                with open(nfo_path, 'r', encoding='utf-8', errors='ignore') as f:
                                    lines = [line.strip() for line in f if line.strip()]
                                    if len(lines) >= 1: clean_title = lines[0]
                                    if len(lines) >= 2: info = lines[1]
                                    if len(lines) >= 3: desc = " ".join(lines[2:])
                            except Exception:
                                pass

                        poster_url = None
                        for img_ext in ['.jpg', '.jpeg', '.png', '.webp']:
                            img_path = os.path.join(root, f"{base}{img_ext}")
                            if os.path.exists(img_path):
                                poster_url = f"/api/file?path={img_path}"
                                break

                        rel_path = os.path.relpath(file_path, FS42_HOME)
                        items.append({
                            "filename": filename,
                            "file_path": file_path,
                            "rel_path": rel_path,
                            "title": clean_title,
                            "info": info,
                            "description": desc,
                            "poster_url": poster_url
                        })

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({
            "content_dir": target_dir,
            "count": len(items),
            "items": items
        }).encode("utf-8"))

    def handle_ppv_play(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        try:
            payload = json.loads(post_data.decode("utf-8"))
            file_path = payload.get("file_path")
            if not file_path:
                self.send_error(400, "Missing file_path")
                return

            cmd_obj = {
                "command": "play_file",
                "file_path": file_path
            }
            with open(CHANNEL_SOCKET, "w") as f:
                f.write(json.dumps(cmd_obj))

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "message": f"Queued PPV playback for: {os.path.basename(file_path)}"
            }).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error sending PPV play command: {e}")

    def handle_ppv_generate_metadata(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        try:
            payload = json.loads(post_data.decode("utf-8")) if content_length > 0 else {}
            target_dir = payload.get("content_dir") or "catalog/ppv"
            if not os.path.isabs(target_dir):
                abs_dir = os.path.abspath(os.path.join(FS42_HOME, target_dir))
            else:
                abs_dir = target_dir

            if not os.path.exists(abs_dir) or not os.path.isdir(abs_dir):
                self.send_error(404, f"Directory '{target_dir}' not found")
                return

            gen_nfo = 0
            gen_poster = 0
            for root, dirs, files in os.walk(abs_dir):
                for filename in sorted(files):
                    if filename.startswith('.'):
                        continue
                    file_path = os.path.join(root, filename)
                    base, ext = os.path.splitext(filename)
                    if ext.lower() in VIDEO_EXTS:
                        import re
                        title_clean = re.sub(r'_+', ' ', base).strip()
                        nfo_path = os.path.join(root, f"{base}.nfo")
                        jpg_path = os.path.join(root, f"{base}.jpg")

                        # Generate NFO if missing
                        if not os.path.exists(nfo_path):
                            info_str = "Feature Film"
                            desc_str = f"{title_clean} on-demand feature presentation for Pay-Per-View Cinema."

                            try:
                                with open(nfo_path, "w", encoding="utf-8") as f:
                                    f.write(f"{title_clean}\n{info_str}\n{desc_str}\n")
                                gen_nfo += 1
                            except Exception:
                                pass

                    # Generate Poster if missing
                    if not os.path.exists(jpg_path):
                        thumb_path = os.path.join(abs_dir, f"{base}_temp_frame.jpg")
                        cmd = ['ffmpeg', '-y', '-ss', '00:02:00', '-i', file_path, '-vframes', '1', '-q:v', '2', thumb_path]
                        res = subprocess.run(cmd, capture_output=True)
                        if res.returncode != 0 or not os.path.exists(thumb_path):
                            subprocess.run(['ffmpeg', '-y', '-ss', '00:00:05', '-i', file_path, '-vframes', '1', '-q:v', '2', thumb_path], capture_output=True)

                        img = None
                        if os.path.exists(thumb_path) and os.path.getsize(thumb_path) > 0:
                            try:
                                from PIL import Image
                                img = Image.open(thumb_path).convert('RGB')
                            except Exception:
                                pass

                        if not img:
                            try:
                                from PIL import Image
                                img = Image.new('RGB', (640, 800), color=(15, 27, 45))
                            except Exception:
                                pass

                        if img:
                            try:
                                from PIL import ImageDraw
                                img = img.resize((640, 800))
                                draw = ImageDraw.Draw(img)
                                for y in range(500, 800):
                                    alpha = int((y - 500) / 300 * 220)
                                    draw.line([(0, y), (640, y)], fill=(0, 0, 150, alpha))
                                img.save(jpg_path, 'JPEG', quality=90)
                                gen_poster += 1
                            except Exception:
                                pass

                        if os.path.exists(thumb_path):
                            try:
                                os.remove(thumb_path)
                            except Exception:
                                pass

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "generated_nfos": gen_nfo,
                "generated_posters": gen_poster,
                "message": f"Processed PPV catalog in '{target_dir}'. Created {gen_nfo} NFO files and {gen_poster} posters."
            }).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error generating PPV metadata: {e}")

    def handle_flirc_status(self):
        info = get_flirc_device_info()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({
            "enabled": flirc_enabled,
            "device": info
        }).encode("utf-8"))

    def handle_flirc_toggle(self):
        global flirc_enabled
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        try:
            payload = json.loads(post_data.decode("utf-8")) if content_length > 0 else {}
            if "enabled" in payload:
                flirc_enabled = bool(payload["enabled"])
                if flirc_enabled:
                    start_remote_controller()
                else:
                    stop_remote_controller()

            info = get_flirc_device_info()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "enabled": flirc_enabled,
                "device": info
            }).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error toggling FLIRC listener: {e}")

    def handle_osd_status(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({
            "enabled": osd_enabled,
            "running": is_osd_running()
        }).encode("utf-8"))

    def handle_osd_toggle(self):
        global osd_enabled
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        try:
            payload = json.loads(post_data.decode("utf-8")) if content_length > 0 else {}
            if "enabled" in payload:
                osd_enabled = bool(payload["enabled"])
                if osd_enabled:
                    start_osd()
                else:
                    stop_osd()
            elif is_osd_running():
                osd_enabled = False
                stop_osd()
            else:
                osd_enabled = True
                start_osd()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "enabled": osd_enabled,
                "running": is_osd_running()
            }).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error toggling OSD: {e}")

    def handle_osd_test(self):
        try:
            test_status = {
                "status": "playing",
                "channel_number": 42,
                "network_name": "FIELD STATION 42",
                "title": "OSD Overlay Test Signal",
                "timestamp": "test"
            }
            with open(PLAY_STATUS_SOCKET, "w") as f:
                json.dump(test_status, f)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "Triggered OSD test overlay signal"}).encode("utf-8"))
        except Exception as e:
            self.send_error(500, f"Error sending OSD test signal: {e}")

if __name__ == "__main__":
    os.chdir(GUI_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    if flirc_enabled:
        start_remote_controller()
    if osd_enabled:
        start_osd()

    with socketserver.TCPServer(("", PORT), FieldStationServerHandler) as httpd:
        print(f"📡 Field Station 42 Studio Server running at http://localhost:{PORT}")
        print(f"📂 Syncing directly with FieldStation42 installation at: {FS42_HOME}")
        print(f"🐍 Using FieldStation42 VirtualEnv Python: {VENV_PYTHON}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            stop_remote_controller()
            stop_osd()
            sys.exit(0)
