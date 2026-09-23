import re
from sentence_transformers import SentenceTransformer, util

# Load Lightweight Sentence Transformer Model once when server boots
try:
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
except Exception:
    embedding_model = None

def clean_composition(text):
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r'\d+(\.\d+)?\s*(mg|mcg|g|ml|%)\b', '', text)
    text = re.sub(r'[^a-z0-9\s+]', ' ', text)
    salts = [s.strip() for s in re.split(r'\+|\band\b', text) if s.strip()]
    return " ".join(sorted(salts))

def mock_web_search(medicine_name):
    """
    Mock Internet Fetcher. Direct scraping or API (Google/1mg) 
    integrations call goes here.
    """
    return {
        "searched_medicine": medicine_name,
        "web_composition": "Ibuprofen 400mg + Paracetamol 325mg",
        "description": f"{medicine_name} is commonly used for relieving pain, fever, and inflammation."
    }

def calculate_match(web_comp, db_comp):
    clean_web = clean_composition(web_comp)
    clean_db = clean_composition(db_comp)
    
    web_set = set(clean_web.split())
    db_set = set(clean_db.split())
    
    if not web_set or not db_set:
        return 0.0
        
    intersection = web_set.intersection(db_set)
    union = web_set.union(db_set)
    jaccard_score = len(intersection) / len(union)
    
    cosine_score = 0.0
    if embedding_model:
        emb_web = embedding_model.encode(clean_web, convert_to_tensor=True)
        emb_db = embedding_model.encode(clean_db, convert_to_tensor=True)
        cosine_score = float(util.cos_sim(emb_web, emb_db)[0][0])
    else:
        cosine_score = jaccard_score

    final_score = (jaccard_score * 0.6) + (cosine_score * 0.4)
    return round(final_score * 100, 2)