import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "pharmacare.settings")

from Pharmacare.pharmacare.wsgi import application

app = application