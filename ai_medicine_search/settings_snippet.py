# Add to your project's settings.py

AI_SEARCH_SETTINGS = {
    # "local" today; switch to "production" once ProductionAIProvider
    # (in medicines/services/ai_service.py) is implemented.
    "PROVIDER": "local",

    # Only used by LocalModelAIProvider — adjust to how your local
    # model is actually served.
    "LOCAL_AI_ENDPOINT": "http://127.0.0.1:8001/identify",
    "LOCAL_AI_TIMEOUT_SECONDS": 15,
}

# If you don't already have `requests` installed (used by the example
# LocalModelAIProvider HTTP call), add it:
#
#   pip install requests
#
# If your local model is invoked a different way (a Python import,
# a subprocess call, a different SDK), you don't need `requests` at
# all — just rewrite LocalModelAIProvider._call_local_model() to match,
# per the comments in ai_service.py.
