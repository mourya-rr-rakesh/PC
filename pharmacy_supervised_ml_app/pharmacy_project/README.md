# Supervised ML Pharmacy Search Engine

App medicine name se **composition (active ingredients)** predict karke same composition wali inventory medicines dhoondhta hai.

## Quick Setup Steps:

1. ZIP file ko extract karein.
2. Apni `Medicine_Details.xlsx` ya CSV file ko `pharmacy_project/` folder ke andar rakhein.
3. Dependencies install karein:
   ```bash
   pip install -r requirements.txt
   ```
4. Django Database setup karein aur CSV import karein:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   python manage.py import_csv
   ```
5. **Supervised ML Model ko Train karein:**
   ```bash
   python train_supervised.py --data "C:\path\to\Medicine_Details.xlsx"
   ```
   Script pehle test data par model ka score print karti hai, phir final model ko saaf records par train karke save karti hai. Composition model ka default output `supervised_model.pkl` hai.

### `all_medicine databased.csv` par train karna

Is dataset mein `name` aur `Therapeutic Class` columns hain; `Composition` column nahi hai. Isliye therapeutic category predict karne ke liye, `pharmacy_project` directory se yeh command chalayein:

```bash
python train_supervised.py --data "C:\Users\rakes\OneDrive\Desktop\ProgramingMaterial\PC\dataset0\all_medicine databased.csv" --target "Therapeutic Class"
```

Training steps:
1. CSV se sirf medicine name aur target class columns read kiye jaate hain.
2. Blank rows, duplicate names aur conflicting class labels check hote hain. Ek hi naam ke conflicting labels waale records training se skip hote hain.
3. TF-IDF character n-grams aur Logistic Regression se category model train hota hai; baaki held-out names par accuracy aur macro F1 report hote hain.
4. Therapeutic Class model alag `therapeutic_class_model.pkl` file mein save hota hai. Yeh app ke composition/substitute model ko replace nahi karta, aur pharmacy search page is category model ko use nahi karti.

Dataset0 mein composition column nahi hai, isliye us dataset se composition/substitute model train nahi kiya ja sakta.

### Composition model ke liye active ingredients dataset

`indian_pharmaceutical_products_clean.csv` file mein `brand_name` aur `active_ingredients` columns hain. Composition model ko dobara train karne ke liye:

```bash
python train_supervised.py --data "C:\path\to\indian_pharmaceutical_products_clean.csv" --name-column brand_name --target active_ingredients --algorithm knn --output supervised_model.pkl
```

Script `active_ingredients` values ko readable ingredient/composition label mein badalti hai. High-cardinality composition labels ke liye cosine KNN use hota hai; is dataset par test score ek held-out sample par report hota hai. Training complete hone ke baad server restart karke naya model load karein.

6. Django Server run karein:
   ```bash
   python manage.py runserver 0.0.0.0:8001
   ```
7. Browser me `http://127.0.0.1:8001/` par jaakar koi bhi medicine name search karein!
