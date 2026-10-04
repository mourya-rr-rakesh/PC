# Supervised medicine search

The `/ai/api/search/` endpoint uses the trained composition model from the
supervised pharmacy ML project and compares its predicted composition with the
logged-in user's unexpired, in-stock medicines.

At runtime, provide the trusted `supervised_model.pkl` artifact either by:

- placing it at `ai_search/supervised_model.pkl`, or
- setting `PHARMACARE_SUPERVISED_MODEL_PATH` to its absolute path.

For local development, the predictor also checks the sibling
`pharmacy_supervised_ml_app/pharmacy_project/supervised_model.pkl` path.
Deployments must include the artifact or configure the environment variable.
The artifact must contain `vectorizer` and `model` entries, as produced by
`train_supervised.py`. The training CSV/XLSX is only needed to retrain the
model, not to run predictions. Install the root project requirements, which
include scikit-learn.

Only load model artifacts produced by a trusted training process; Python pickle
files can execute code when loaded.
