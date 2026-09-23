from inventory.models import Medicine
from ai_inventory.features import get_medicine_features
from ai_inventory.training_data import build_demand_training_data


def test_features():
    print("\n========== FEATURE TEST ==========")

    medicine = Medicine.objects.first()

    if not medicine:
        print(" No medicine found in database.")
        return

    print(f"Medicine: {medicine.name}")

    features = get_medicine_features(medicine)

    print("\nGenerated Features:")

    for key, value in features.items():
        print(f"{key}: {value}")


def test_training_data():
    print("\n========== TRAINING DATA TEST ==========")

    data = build_demand_training_data()

    print(f"Training samples: {len(data)}")

    if len(data) == 0:
        print(" No training samples available.")
        print("Need historical sales data.")
        return

    print("\nFirst training sample:")

    print(data[0])


if __name__ == "__main__":
    test_features()
    test_training_data()