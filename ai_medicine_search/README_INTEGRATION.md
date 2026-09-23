# AI Medicine Search — Integration Guide

No project files were attached to this request, so this was built as a
**drop-in, self-contained add-on** to an existing Django `medicines` app,
with every point that depends on your real model/template fields clearly
marked `ADJUST ME`. Nothing here replaces or rewrites your existing
search — it only adds a fallback path triggered by a new button.

## 1. Files to create (copy as-is)

```
medicines/
  services/
    __init__.py                  → medicines/services/__init__.py
    normalizer.py                → medicines/services/normalizer.py
    ingredient_matcher.py        → medicines/services/ingredient_matcher.py
    ai_service.py                → medicines/services/ai_service.py
  views_ai_search.py              → medicines/views_ai_search.py
  templates/medicines/
    ai_search_modal.html          → medicines/templates/medicines/ai_search_modal.html
  static/medicines/
    css/ai_search.css             → medicines/static/medicines/css/ai_search.css
    js/ai_search.js               → medicines/static/medicines/js/ai_search.js
```

## 2. Existing files that need small edits

- **`medicines/urls.py`** — add the import + one `path(...)` entry.
  See `urls_ai_search_snippet.py` for the exact lines.
- **`medicines/views.py`** (or wherever your Medicine model lives) —
  nothing *must* change here; `views_ai_search.py` is self-contained.
  You only need to fill in the three `ADJUST ME` spots inside it (see
  step 4).
- **Your existing search page template** — add the AI Search button
  next to the existing input, and include the modal partial once
  anywhere in the body:

  ```html
  <input type="text" id="existing-medicine-search-input" ...>
  <button type="button" id="ai-search-trigger-btn" class="ai-search-trigger-btn">
    ✨ AI Search
  </button>

  {% include "medicines/ai_search_modal.html" %}
  ```
- **`settings.py`** — add the `AI_SEARCH_SETTINGS` dict from
  `settings_snippet.py`.

## 3. Django URL code

See `urls_ai_search_snippet.py` — two lines to merge into your
existing `medicines/urls.py`, keeping your current namespace/patterns
untouched.

## 4. The three things only you can fill in

Since no project files were provided, three spots in
`views_ai_search.py` are placeholders (each marked `ADJUST ME` with a
docstring showing the expected shape):

1. **Import your real `Medicine` model.**
2. **`_find_existing_exact_match()` / `_existing_medicine_to_response_dict()`**
   — reuse your existing search function if you already have one
   (e.g. `search_medicines(query)`), and map your model's real field
   names (name, composition, description, age, etc.) into the response
   dict shape shown in the docstring.
3. **`_build_candidate_compositions()`** — query candidate medicines
   from your table (filtered by the AI-detected ingredient names so
   you're not scoring your whole table every request) and wrap each
   one in a `CandidateComposition`. If your DB stores composition as
   free text (e.g. `"Paracetamol 500mg + Caffeine 30mg"`), use
   `normalizer.parse_composition_string()` to turn it into the same
   shape the matcher expects — no separate parsing logic needed.

Everything else — AI call, response validation, matching/scoring,
JSON response shape, modal rendering — works without edits.

## 5. Local AI service (`medicines/services/ai_service.py`)

- `get_medicine_from_local_ai(name)` is the one function views call.
- It delegates to `LocalModelAIProvider`, whose `_call_local_model()`
  method is the **one place** that needs to know how your local model
  is actually invoked. As shipped, it assumes your local model is
  served over HTTP and posts a prompt + medicine name to it — replace
  the body of that method if your model is invoked differently
  (Python import, subprocess, a specific SDK, etc). The prompt text is
  in `_build_prompt()` right below it.
- `ProductionAIProvider` is a same-interface placeholder — implement
  it later and flip `AI_SEARCH_SETTINGS["PROVIDER"]` to `"production"`.
  Nothing else in the codebase needs to change when you do.
- All raw AI output is passed through `_validate_and_parse_response()`
  before anything downstream sees it — malformed fields are dropped
  rather than trusted.

## 6. Matching algorithm

- `normalizer.py` — normalizes ingredient names (synonym groups like
  paracetamol/acetaminophen, strips IP/BP/USP suffixes) and strength
  strings (mg/g/mcg, comparable regardless of format).
- `ingredient_matcher.py` — `find_matches()` scores each DB candidate
  against the AI-extracted composition using a configurable
  `MatchConfig` (ingredient-weight vs strength-weight, tolerance,
  minimum thresholds, result count). Tune those numbers, or the
  synonym list in `normalizer.py`, without touching scoring logic.
- The AI is never asked "what's a substitute" — it only identifies
  composition; all ranking happens in this file.

## 7. Testing the flow locally

1. Add `AI_SEARCH_SETTINGS` to `settings.py` and fill in the three
   `ADJUST ME` spots in `views_ai_search.py`.
2. Start (or point at) your local AI model, matching whatever
   `LOCAL_AI_ENDPOINT` you configured.
3. Run the Django dev server, open the existing medicine search page.
4. Type a medicine name that is **not** in your database, click
   **✨ AI Search**.
5. Confirm: modal opens → loading state → composition + matches (or a
   friendly empty/error state) render.
6. Test error paths deliberately: stop the local model (expect the
   "AI model unavailable" message), submit an empty input (expect the
   client-side alert before any request is sent), and a name with no
   DB overlap (expect the "no matching medicine was found" notice).

## 8. Preparing for production later

- Swapping AI backends: implement `ProductionAIProvider.identify_medicine()`
  in `ai_service.py`, set `AI_SEARCH_SETTINGS["PROVIDER"] = "production"`
  (env-var driven, ideally). No view, template, JS, or matcher code
  changes.
- Put `LOCAL_AI_ENDPOINT` / any production API keys in environment
  variables rather than hardcoding them in `settings.py`.
- Consider caching AI responses per medicine name (e.g. Django cache
  framework) once you have a production AI API with per-call cost.
- The matcher and normalizer have no external dependencies and are
  pure functions — safe to unit test in isolation before deploying.
- If your candidate query in `_build_candidate_compositions()` ever
  gets slow at scale, add DB indexes on whatever field you filter by
  (e.g. an ingredient/composition column), or move to a dedicated
  search backend later — the matcher itself doesn't care where
  candidates came from.

## 9. Migrations

None required — this add-on introduces no new models. It reuses your
existing Medicine table entirely.
