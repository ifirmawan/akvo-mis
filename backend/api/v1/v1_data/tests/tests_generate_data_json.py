import os
from mis.settings import STORAGE_PATH
from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings
from api.v1.v1_data.models import FormData


@override_settings(USE_TZ=False, TEST_ENV=True)
class GenerateDataJSONTestCase(TestCase):
    def setUp(self):
        call_command("administration_seeder", "--test")
        call_command("form_seeder", "--test")

        user_payload = {"email": "admin@akvo.org", "password": "Test105*"}
        user_response = self.client.post(
            "/api/v1/login", user_payload, content_type="application/json"
        )
        self.token = user_response.json().get("token")
        call_command("fake_data_seeder", "-r", 1, "-t", True)
        call_command("generate_data_json", "--test", 1)

    def test_data_json_exists(self):
        form_data = FormData.objects.filter(is_pending=False).first()
        self.assertTrue(
            os.path.exists(f"{STORAGE_PATH}/datapoints/{form_data.uuid}.json"),
            "File not exists"
        )
