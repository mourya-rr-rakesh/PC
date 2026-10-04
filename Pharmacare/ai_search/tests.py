from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from inventory.models import Medicine
from .predictor import normalize_ingredient_names


class SupervisedMedicineSearchTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="pharmacist",
            password="test-password",
        )
        self.client.force_login(self.user)
        self.search_url = reverse("supervised_medicine_search")

    @patch(
        "ai_search.views.supervised_medicine_predictor.predict",
        return_value={
            "predicted_composition": "Paracetamol (1000mg)",
            "confidence": 38.8,
            "algorithm": "KNN",
            "training_records": 248868,
            "target_column": "active_ingredients",
        },
    )
    def test_returns_prediction_and_only_matching_current_user_inventory(self, predict):
        matching_medicine = Medicine.objects.create(
            user=self.user,
            name="Local Paracetamol",
            composition="paracetamol 1000 mg",
            exp_date=date.today() + timedelta(days=30),
            mrp=50,
            buy_price=30,
            sell_price=40,
            stock=5,
        )
        different_strength_medicine = Medicine.objects.create(
            user=self.user,
            name="Nimoril Plus",
            composition="Paracetamol 500mg",
            exp_date=date.today() - timedelta(days=30),
            mrp=12,
            buy_price=8,
            sell_price=10,
            stock=0,
        )
        Medicine.objects.create(
            user=self.user,
            name="Different Composition",
            composition="Ibuprofen 200 mg",
            exp_date=date.today() + timedelta(days=30),
            mrp=50,
            buy_price=30,
            sell_price=40,
            stock=5,
        )
        other_user = get_user_model().objects.create_user(
            username="another-pharmacist",
            password="test-password",
        )
        Medicine.objects.create(
            user=other_user,
            name="Other User Paracetamol",
            composition="Paracetamol 1000 mg",
            exp_date=date.today() + timedelta(days=30),
            mrp=50,
            buy_price=30,
            sell_price=40,
            stock=5,
        )

        response = self.client.post(
            self.search_url,
            data='{"query": "Paracetamol"}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(
            payload["supervised_prediction"]["predicted_composition"],
            "Paracetamol (1000mg)",
        )
        self.assertEqual(
            [item["medicine_id"] for item in payload["inventory_matches"]],
            [matching_medicine.id, different_strength_medicine.id],
        )
        predict.assert_called_once_with("Paracetamol")

    def test_rejects_missing_query(self):
        response = self.client.post(
            self.search_url,
            data='{"query": "  "}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_normalizes_same_ingredient_with_different_strength(self):
        self.assertEqual(
            normalize_ingredient_names("Paracetamol (1000mg)"),
            normalize_ingredient_names("Paracetamol 500mg"),
        )
