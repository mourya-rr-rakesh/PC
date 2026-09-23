import json
from django.conf import settings
from django.test import TestCase, RequestFactory
from unittest.mock import patch

from inventory.models import Medicine
from .views import search_and_match_medicine
from .external_sources import (
    get_medicine_information,
    parse_gemini_response,
)


class AIMedicineSearchTests(TestCase):
    def setUp(self):
        self.rf = RequestFactory()
        # Create a test inventory medicine
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user, _ = User.objects.get_or_create(username="testpharmacist", defaults={"email": "test@pharmacy.com"})
        self.medicine = Medicine.objects.create(
            user=user,
            name="TestLosartan 50mg",
            composition="Losartan Potassium 50mg",
            exp_date="2027-12-31",
            buy_price=40.0,
            sell_price=60.0,
            mrp=65.0,
            stock=100,
        )

    def test_gemini_api_key_configured(self):
        """Test that GEMINI_API_KEY exists in settings."""
        api_key = getattr(settings, "GEMINI_API_KEY", "")
        self.assertTrue(bool(api_key), "GEMINI_API_KEY must be configured in settings.")

    @patch("ai_search.views.get_medicine_information", return_value={"found": False, "sources": []})
    def test_local_inventory_match(self, external_search):
        """Test that local medicines are returned with medicine_id, name, composition, stock, mrp."""
        request = self.rf.get("/ai/api/search/?query=TestLosartan")
        response = search_and_match_medicine(request)
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.content)
        self.assertTrue(data["found_in_inventory"])
        self.assertEqual(data["source"], "inventory")
        self.assertGreaterEqual(len(data["inventory_matches"]), 1)

        first = data["inventory_matches"][0]
        self.assertEqual(first["medicine_name"], "TestLosartan 50mg")
        self.assertEqual(first["composition"], "Losartan Potassium 50mg")
        self.assertEqual(first["stock"], 100)
        self.assertEqual(first["mrp"], 65.0)

    def test_empty_query_returns_400(self):
        """Test empty query validation."""
        request = self.rf.get("/ai/api/search/?query=")
        response = search_and_match_medicine(request)
        self.assertEqual(response.status_code, 400)

    def test_parser_markdown_and_raw_text(self):
        """Test that parse_gemini_response handles markdown and raw text gracefully."""
        # Valid markdown fenced JSON
        md_json = "```json\n{\"found\": true, \"medicine_name\": \"Nicip\", \"composition\": \"Nimesulide\"}\n```"
        parsed = parse_gemini_response(md_json, "Nicip")
        self.assertTrue(parsed["found"])
        self.assertEqual(parsed["medicine_name"], "Nicip")
        self.assertEqual(parsed["composition"], "Nimesulide")

        # Unstructured text
        unstructured = "The medicine is Nicip.\ncomposition: Nimesulide 100mg\ndescription: Pain relief"
        parsed_raw = parse_gemini_response(unstructured, "Nicip")
        self.assertTrue(parsed_raw["found"])
        self.assertIn("Nimesulide", parsed_raw["composition"])

        # Unidentifiable medicine
        negative = "This query could not be identified as a medicine from available sources."
        parsed_neg = parse_gemini_response(negative, "randomxyz")
        self.assertFalse(parsed_neg["found"])

    @patch("ai_search.views.get_medicine_information")
    def test_local_result_also_returns_external_result(self, external_search):
        external_search.return_value = {
            "found": True,
            "source": "Gemini + Google Search",
            "medicine_name": "TestLosartan",
            "composition": "Losartan potassium",
            "strength": "50 mg",
            "dosage_form": "tablet",
            "description": "Reference information",
            "common_uses": "Hypertension",
            "age_information": "Not available",
            "warnings": "Not available",
            "sources": [{"title": "NLM", "url": "https://example.com/nlm"}],
        }
        response = search_and_match_medicine(self.rf.post(
            "/ai/api/search/",
            data=json.dumps({"query": "TestLosartan 50mg"}),
            content_type="application/json",
        ))

        data = json.loads(response.content)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data["found_in_inventory"])
        self.assertTrue(data["external_info"]["found"])
        external_search.assert_called_once_with("TestLosartan 50mg")

    @patch("ai_search.views.get_medicine_information")
    def test_external_failure_is_a_structured_non_500_response(self, external_search):
        external_search.return_value = {
            "found": False,
            "source": None,
            "error": "Provider temporarily unavailable",
            "sources": [],
        }
        response = search_and_match_medicine(self.rf.get(
            "/ai/api/search/?query=UnknownMedicine"
        ))

        data = json.loads(response.content)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(data["found_in_inventory"])
        self.assertFalse(data["external_info"]["found"])
        self.assertEqual(data["message"], "Provider temporarily unavailable")

    @patch("ai_search.external_sources.search_with_gemini")
    def test_external_search_typo_or_brand(self, gemini_search):
        """External search contract for a brand medicine."""
        gemini_search.return_value = {
            "found": True,
            "source": "Gemini + Google Search",
            "medicine_name": "Nicip",
            "composition": "Nimesulide 100mg",
            "strength": "100mg",
            "dosage_form": "tablet",
            "description": "Pain relief medicine",
            "common_uses": "Pain and inflammation",
            "age_information": "Not available",
            "warnings": "Not available",
            "sources": [{"title": "NLM", "url": "https://example.com/nlm"}],
        }
        info = get_medicine_information("Nicip")
        self.assertTrue(info["found"])
        self.assertEqual(info["source"], "Gemini + Google Search")
        self.assertIn("nimesulide", info["composition"].lower())
        self.assertIsInstance(info["sources"], list)
