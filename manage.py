"""Compatibility entry point for hosting platforms using root-level commands."""

import os
import runpy
import sys
from pathlib import Path


project_dir = Path(__file__).resolve().parent / "Pharmacare"
sys.path.insert(0, str(project_dir))
os.chdir(project_dir)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "pharmacare.settings")

runpy.run_path(str(project_dir / "manage.py"), run_name="__main__")