"""
This is a SNIPPET to merge into your existing medicines/urls.py —
not a standalone file Django will load. Add the import and the one
urlpatterns entry shown below; leave everything else in your urls.py
untouched.
"""

# 1) Add this import near your other view imports:
from medicines.views_ai_search import ai_medicine_search

# 2) Add this entry to your existing urlpatterns list (keep your
#    existing app_name / namespace as-is):
#
# app_name = "medicines"   # <- only if not already present
#
# urlpatterns = [
#     ...your existing patterns...
#     path("ai-search/", ai_medicine_search, name="ai_medicine_search"),
# ]
