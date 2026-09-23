import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

# Seed for reproducibility
np.random.seed(42)
random.seed(42)

# ==========================================
# 1. MEDICINE MASTER DATA (50 Real Medicines)
# ==========================================
medicines_data = [
    (73130, "Pantop DSR", "Pantoprazole 40mg + Domperidone 30mg", "Gastroenterology", 165.0, 95.0, 148.0),
    (73131, "Dolo 650", "Paracetamol 650mg", "Analgesic/Antipyretic", 34.0, 21.0, 30.0),
    (73132, "Montair LC", "Montelukast 10mg + Levocetirizine 5mg", "Anti-allergic / Asthma", 230.0, 138.0, 200.0),
    (73133, "Azithral 500", "Azithromycin 500mg", "Antibiotic", 132.0, 78.0, 115.0),
    (73134, "Ascoril LS Syrup", "Levosalbutamol + Ambroxol + Guaiphenesin", "Cough & Cold", 125.0, 72.0, 110.0),
    (73135, "Glycomet GP2", "Glimepiride 2mg + Metformin 500mg", "Anti-Diabetic", 180.0, 105.0, 160.0),
    (73136, "Telmikind 40", "Telmisartan 40mg", "Anti-Hypertensive", 85.0, 48.0, 75.0),
    (73137, "Electral Powder", "Oral Rehydration Salts (ORS)", "Electrolyte", 22.0, 13.5, 20.0),
    (73138, "Moxikind CV 625", "Amoxicillin 500mg + Clavulanic Acid 125mg", "Antibiotic", 210.0, 125.0, 185.0),
    (73139, "Ondem 4mg", "Ondansetron 4mg", "Anti-Emetic", 55.0, 30.0, 48.0),
    (73140, "Atorva 10", "Atorvastatin 10mg", "Cardiovascular", 98.0, 56.0, 85.0),
    (73141, "Pan 40", "Pantoprazole 40mg", "Gastroenterology", 150.0, 88.0, 132.0),
    (73142, "Ciplox 500", "Ciprofloxacin 500mg", "Antibiotic", 45.0, 25.0, 39.0),
    (73143, "Allegra 120", "Fexofenadine 120mg", "Anti-Allergic", 215.0, 130.0, 190.0),
    (73144, "Combiflam", "Ibuprofen 400mg + Paracetamol 325mg", "Analgesic", 48.0, 28.0, 42.0),
    (73145, "Benadryl Syrup", "Diphenhydramine + Ammonium Chloride", "Cough & Cold", 140.0, 82.0, 125.0),
    (73146, "Janumet 50/500", "Sitagliptin 50mg + Metformin 500mg", "Anti-Diabetic", 340.0, 220.0, 305.0),
    (73147, "Amlokind 5", "Amlodipine 5mg", "Anti-Hypertensive", 32.0, 18.0, 28.0),
    (73148, "Cyclopam", "Dicyclomine 20mg + Paracetamol 325mg", "Antispasmodic", 62.0, 35.0, 54.0),
    (73149, "Becosules Caps", "Vitamin B-Complex + Vitamin C", "Multivitamin", 50.0, 29.0, 44.0),
    (73150, "Shelcal 500", "Calcium 500mg + Vitamin D3", "Supplement", 135.0, 78.0, 118.0),
    (73151, "Celin 500", "Vitamin C 500mg", "Supplement", 40.0, 22.0, 35.0),
    (73152, "Zocon 150", "Fluconazole 150mg", "Anti-Fungal", 28.0, 15.0, 24.0),
    (73153, "Deriphyllin 150", "Etofylline + Theophylline", "Respiratory", 38.0, 20.0, 32.0),
    (73154, "Gelusil MPS", "Aluminum Hydroxide + Magnesium", "Antacid", 120.0, 70.0, 105.0),
    (73155, "Thyronorm 50", "Thyroxine Sodium 50mcg", "Endocrinology", 185.0, 110.0, 160.0),
    (73156, "Ecosprin 75", "Aspirin 75mg", "Cardiovascular", 15.0, 8.0, 12.0),
    (73157, "Eldoper Caps", "Loperamide 2mg", "Anti-Diarrheal", 25.0, 12.0, 20.0),
    (73158, "Cefakind 500", "Cefuroxime Axetil 500mg", "Antibiotic", 450.0, 280.0, 390.0),
    (73159, "Taxim O 200", "Cefixime 200mg", "Antibiotic", 110.0, 65.0, 95.0),
    (73160, "Meftal Spas", "Mefenamic Acid + Dicyclomine", "Analgesic", 52.0, 30.0, 45.0),
    (73161, "Aztor 10", "Atorvastatin 10mg", "Cardiovascular", 95.0, 52.0, 82.0),
    (73162, "Cipcal 500", "Calcium + Vitamin D3", "Supplement", 128.0, 72.0, 110.0),
    (73163, "Metolar XR 25", "Metoprolol Succinate 25mg", "Cardiovascular", 88.0, 50.0, 76.0),
    (73164, "Limcee 500", "Ascorbic Acid 500mg", "Supplement", 25.0, 14.0, 21.0),
    (73165, "Lupisulide P", "Nimesulide + Paracetamol", "Analgesic", 75.0, 42.0, 65.0),
    (73166, "Ofal-OZ", "Ofloxacin + Ornidazole", "Antibiotic/Gastro", 145.0, 85.0, 125.0),
    (73167, "Zerodol SP", "Aceclofenac + Paracetamol + Serratiopeptidase", "Analgesic", 115.0, 68.0, 100.0),
    (73168, "Rabekind D", "Rabeprazole + Domperidone", "Gastroenterology", 140.0, 80.0, 120.0),
    (73169, "Foracort 200", "Formoterol + Budesonide Inhaler", "Asthma", 420.0, 260.0, 370.0),
    (73170, "Asthalin Inhaler", "Salbutamol 100mcg", "Asthma", 155.0, 92.0, 135.0),
    (73171, "Alex Cough Syrup", "Dextromethorphan + Chlorpheniramine", "Cough & Cold", 135.0, 78.0, 118.0),
    (73172, "Evion 400", "Vitamin E 400mg", "Supplement", 35.0, 20.0, 30.0),
    (73173, "Neurobion Forte", "Vitamin B Complex + B12", "Multivitamin", 42.0, 24.0, 36.0),
    (73174, "Dulcoflex 5mg", "Bisacodyl 5mg", "Laxative", 12.0, 6.5, 10.0),
    (73175, "Avil 25", "Pheniramine Maleate 25mg", "Anti-Allergic", 10.0, 5.0, 8.0),
    (73176, "Calpol 500", "Paracetamol 500mg", "Analgesic", 18.0, 10.0, 15.0),
    (73177, "Voveran SR 100", "Diclofenac 100mg", "Analgesic", 160.0, 95.0, 140.0),
    (73178, "Ovez-D", "Ofloxacin + Dexamethasone Eye Drop", "Ophthalmic", 58.0, 32.0, 50.0),
    (73179, "Itaspor 100", "Itraconazole 100mg", "Anti-Fungal", 190.0, 115.0, 165.0)
]

df_medicines = pd.DataFrame(medicines_data, columns=[
    "medicine_id", "medicine_name", "composition", "category", "mrp", "buy_price", "sell_price"
])

# ==========================================
# 2. RAW TRANSACTIONS (2,800+ Sales Records)
# ==========================================
shops = ["SHOP001", "SHOP002"]
sales_list = []

start_date = datetime(2025, 1, 1)
end_date = datetime(2026, 9, 18)
total_days = (end_date - start_date).days

for _ in range(2850):
    day_offset = random.randint(0, total_days)
    current_date = start_date + timedelta(days=day_offset)
    m = current_date.month
    shop = random.choice(shops)
    med = random.choice(medicines_data)
    
    med_id, med_name, category = med[0], med[1], med[3]
    
    qty = random.randint(1, 5)
    
    # Monsoon Seasonality (July-Oct)
    if m in [7, 8, 9, 10] and med_name in ["Dolo 650", "Azithral 500", "Ondem 4mg", "Ofal-OZ", "Calpol 500"]:
        qty = random.randint(6, 25)
    # Winter Seasonality (Nov-Feb)
    elif m in [11, 12, 1, 2] and (category in ["Anti-allergic / Asthma", "Cough & Cold"] or med_name in ["Montair LC", "Ascoril LS Syrup", "Alex Cough Syrup"]):
        qty = random.randint(5, 20)
    # Summer Seasonality (March-June)
    elif m in [3, 4, 5, 6] and med_name in ["Electral Powder", "Pantop DSR", "Pan 40", "Gelusil MPS"]:
        qty = random.randint(8, 30)
    # Year-round Chronic Demand
    elif category in ["Anti-Diabetic", "Anti-Hypertensive", "Cardiovascular"]:
        qty = random.randint(3, 10)
        
    sales_list.append({
        "shop_id": shop,
        "medicine_id": med_id,
        "medicine_name": med_name,
        "sale_date": current_date.strftime("%Y-%m-%d"),
        "quantity": qty
    })

df_sales = pd.DataFrame(sales_list).sort_values("sale_date")

# ==========================================
# 3. PURCHASES & INVENTORY ADJUSTMENTS
# ==========================================
purchase_list = []
txn_id = 10000

for med in medicines_data:
    med_id = med[0]
    for shop in shops:
        # Initial Stock (Jan 2025)
        txn_id += 1
        purchase_list.append({
            "transaction_id": f"TXN{txn_id}",
            "shop_id": shop,
            "medicine_id": med_id,
            "type": "PURCHASE",
            "date": "2025-01-02",
            "quantity": random.randint(100, 500),
            "reason": "Initial Opening Stock"
        })
        
        # Mid-Year Replenishment (July 2025)
        txn_id += 1
        purchase_list.append({
            "transaction_id": f"TXN{txn_id}",
            "shop_id": shop,
            "medicine_id": med_id,
            "type": "PURCHASE",
            "date": "2025-07-01",
            "quantity": random.randint(150, 400),
            "reason": "Monsoon Restock"
        })
        
        # Expired/Damaged Stock Adjustments
        if random.random() < 0.25:
            txn_id += 1
            purchase_list.append({
                "transaction_id": f"TXN{txn_id}",
                "shop_id": shop,
                "medicine_id": med_id,
                "type": "ADJUSTMENT",
                "date": f"2025-{random.randint(1,12):02d}-15",
                "quantity": -random.randint(5, 20),
                "reason": random.choice(["Damaged Packets", "Expired Batch Removed", "Audit Discrepancy"])
            })

df_inventory = pd.DataFrame(purchase_list).sort_values("date")

# Exporting to CSV
df_sales.to_csv("raw_sales_transactions.csv", index=False)
df_medicines.to_csv("medicine_master.csv", index=False)
df_inventory.to_csv("purchase_and_adjustments.csv", index=False)

print(f"Dataset generated successfully!")
print(f"1. raw_sales_transactions.csv ({len(df_sales)} rows)")
print(f"2. medicine_master.csv ({len(df_medicines)} rows)")
print(f"3. purchase_and_adjustments.csv ({len(df_inventory)} rows)")


df_sales.to_csv("datasets/raw_sales_transactions.csv", index=False)
df_medicines.to_csv("datasets/medicine_master.csv", index=False)
df_inventory.to_csv("datasets/purchase_and_adjustments.csv", index=False)