#!/usr/bin/env python3
"""Cross-platform Unified Development Server for HELIOS.

Launches the FastAPI backend and Vite frontend dev server concurrently,
streams prefixed logs, and ensures clean termination on Ctrl+C.
Works on Windows, macOS, and Linux.
"""

import argparse
import os
import platform
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

# Enable ANSI escape sequences on Windows console
if platform.system() == "Windows":
    os.system("")

# ANSI color codes
CLR_RESET = "\033[0m"
CLR_API = "\033[36m"     # Cyan
CLR_UI = "\033[32m"      # Green
CLR_SYS = "\033[35m"     # Magenta
CLR_ERR = "\033[31m"     # Red
CLR_WARN = "\033[33m"    # Yellow
CLR_BOLD = "\033[1m"


def log(prefix: str, msg: str, color: str = CLR_SYS) -> None:
    """Print prefixed log message with timestamp."""
    now = time.strftime("%H:%M:%S")
    print(f"{color}{CLR_BOLD}[{prefix} {now}]{CLR_RESET} {msg}", flush=True)


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Check if a network port is already bound."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def find_repo_root() -> Path:
    """Locate the repository root containing api/ and frontend/."""
    current = Path(__file__).resolve().parent
    for candidate in [current, current.parent, current.parent.parent]:
        if (candidate / "api").is_dir() and (candidate / "frontend").is_dir():
            return candidate
    return Path.cwd()


def find_python_executable(root: Path) -> str:
    """Find virtualenv Python if available, else current sys.executable."""
    if platform.system() == "Windows":
        venv_py = root / ".venv" / "Scripts" / "python.exe"
        if venv_py.exists():
            return str(venv_py)
    else:
        venv_py = root / ".venv" / "bin" / "python"
        if venv_py.exists():
            return str(venv_py)
    return sys.executable


def find_npm_executable() -> str:
    """Find npm executable across platforms."""
    npm_cmd = shutil.which("npm.cmd") if platform.system() == "Windows" else shutil.which("npm")
    if npm_cmd:
        return npm_cmd
    return "npm.cmd" if platform.system() == "Windows" else "npm"


def stream_output(pipe, prefix: str, color: str, stop_event: threading.Event) -> None:
    """Stream process stdout/stderr line-by-line with prefix."""
    try:
        for line in iter(pipe.readline, ""):
            if stop_event.is_set() and not line:
                break
            line_str = line.rstrip()
            if line_str:
                print(f"{color}[{prefix}]{CLR_RESET} {line_str}", flush=True)
    except Exception:
        pass
    finally:
        pipe.close()


def kill_process_tree(proc: subprocess.Popen) -> None:
    """Terminate a process and all its children across OS platforms."""
    if proc.poll() is not None:
        return

    if platform.system() == "Windows":
        try:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        except Exception:
            proc.kill()
    else:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except Exception:
            proc.terminate()


def main() -> None:
    """Run backend and frontend servers together."""
    parser = argparse.ArgumentParser(
        description="Launch HELIOS FastAPI backend and Vite frontend concurrently."
    )
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--api-port", type=int, default=8000, help="FastAPI port (default: 8000)")
    parser.add_argument("--ui-port", type=int, default=5173, help="Vite UI port (default: 5173)")
    parser.add_argument("--no-reload", action="store_true", help="Disable uvicorn auto-reload")
    args = parser.parse_args()

    root = find_repo_root()
    frontend_dir = root / "frontend"
    py_exec = find_python_executable(root)
    npm_exec = find_npm_executable()

    print("=" * 65)
    print(f"{CLR_BOLD}HELIOS — AI Renewable Energy Management Dev Server{CLR_RESET}")
    print("=" * 65)
    log("HELIOS", f"Project root: {root}")
    log("HELIOS", f"Python executable: {py_exec}")
    log("HELIOS", f"NPM executable:    {npm_exec}")

    # Check port availability
    if is_port_in_use(args.api_port, args.host):
        log("WARN", f"Port {args.api_port} is already in use. FastAPI may fail to bind.", CLR_WARN)
    if is_port_in_use(args.ui_port, args.host):
        log("WARN", f"Port {args.ui_port} is already in use. Vite may switch to another port.", CLR_WARN)

    # Check node_modules
    if not (frontend_dir / "node_modules").exists():
        log("WARN", "frontend/node_modules not found. Run 'npm ci' in frontend/ first.", CLR_WARN)

    api_cmd = [
        py_exec,
        "-m",
        "uvicorn",
        "api.main:app",
        "--host",
        args.host,
        "--port",
        str(args.api_port),
    ]
    if not args.no_reload:
        api_cmd.append("--reload")

    ui_cmd = [
        npm_exec,
        "run",
        "dev",
        "--",
        "--host",
        args.host,
        "--port",
        str(args.ui_port),
    ]

    log("HELIOS", f"Starting API backend: {' '.join(api_cmd)}")
    log("HELIOS", f"Starting Vite UI:     {' '.join(ui_cmd)}")
    log("HELIOS", f"Press {CLR_BOLD}Ctrl+C{CLR_RESET} to gracefully stop both servers.\n")

    popen_kwargs = {}
    if platform.system() != "Windows":
        popen_kwargs["preexec_fn"] = os.setsid

    api_proc = subprocess.Popen(
        api_cmd,
        cwd=str(root),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace",
        **popen_kwargs,
    )

    ui_proc = subprocess.Popen(
        ui_cmd,
        cwd=str(frontend_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace",
        **popen_kwargs,
    )

    stop_event = threading.Event()
    threads = [
        threading.Thread(
            target=stream_output,
            args=(api_proc.stdout, "API", CLR_API, stop_event),
            daemon=True,
        ),
        threading.Thread(
            target=stream_output,
            args=(ui_proc.stdout, "UI ", CLR_UI, stop_event),
            daemon=True,
        ),
    ]
    for t in threads:
        t.start()

    def signal_handler(sig, frame):
        stop_event.set()
        log("HELIOS", "\nShutdown signal received. Stopping servers...", CLR_WARN)
        kill_process_tree(api_proc)
        kill_process_tree(ui_proc)
        log("HELIOS", "Servers stopped cleanly. Goodbye!", CLR_SYS)
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    if platform.system() != "Windows":
        signal.signal(signal.SIGTERM, signal_handler)

    try:
        while True:
            # Check if any process exited prematurely
            if api_proc.poll() is not None:
                log("API", f"FastAPI process exited with code {api_proc.returncode}", CLR_ERR)
                break
            if ui_proc.poll() is not None:
                log("UI", f"Vite process exited with code {ui_proc.returncode}", CLR_ERR)
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        stop_event.set()
        kill_process_tree(api_proc)
        kill_process_tree(ui_proc)
        log("HELIOS", "Servers shut down.", CLR_SYS)


if __name__ == "__main__":
    main()

