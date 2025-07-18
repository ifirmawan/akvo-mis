from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings
from api.v1.v1_data.models import FormData


@override_settings(USE_TZ=False, TEST_ENV=True)
class DataDetailsTestCase(TestCase):
    def setUp(self):
        call_command("administration_seeder", "--test")
        call_command("form_seeder", "--test")

        user_payload = {"email": "admin@akvo.org", "password": "Test105*"}
        user_response = self.client.post(
            "/api/v1/login", user_payload, content_type="application/json"
        )
        self.token = user_response.json().get("token")
        call_command("fake_data_seeder", "-r", 1, "-t", True)

    def test_success_data_details(self):
        form_data = FormData.objects.order_by("?").first()
        data_id = form_data.id

        response = self.client.get(
            f"/api/v1/data-details/{data_id}",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            list(response.json()),
            [
                "id",
                "uuid",
                "name",
                "form",
                "administration",
                "geo",
                "created_by",
                "updated_by",
                "created",
                "updated",
                "submitter",
                "duration",
                "answers",
            ]
        )

    def test_error_data_details(self):
        invalid_data_id = 9999
        response = self.client.get(
            f"/api/v1/data-details/{invalid_data_id}",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 404)
