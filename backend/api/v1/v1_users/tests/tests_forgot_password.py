from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings

from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin


@override_settings(USE_TZ=False, TEST_ENV=True)
class ForgotPasswordUserTestCase(TestCase, ProfileTestHelperMixin):
    def setUp(self):
        call_command("administration_seeder", "--test", 1)
        call_command("default_roles_seeder", "--test", 1)
        call_command("form_seeder", "--test", 1)

        self.user = self.create_user(
            email="test@example.com",
            role_level=self.IS_SUPER_ADMIN,
        )
        self.assertIsNotNone(
            self.user, "No user found for forgot password test"
        )

    def test_forgot_password(self):
        # Prepare user payload for forgot password
        user_payload = {
            "email": self.user.email,
        }
        # Perform forgot password request
        response = self.client.post(
            "/api/v1/user/forgot-password",
            user_payload,
            content_type="application/json",
        )
        # Check if the request was successful
        self.assertEqual(response.status_code, 200)
        response_data = response.json()

        self.assertIn("message", response_data)
        self.assertEqual(
            response_data["message"],
            "Reset password instructions sent to your email"
        )

    def test_forgot_password_non_existent_user(self):
        # Prepare payload for a non-existent user
        user_payload = {
            "email": "non_existent_user@example.com"
        }
        # Perform forgot password request
        response = self.client.post(
            "/api/v1/user/forgot-password",
            user_payload,
            content_type="application/json",
        )
        # Check if the request was successful
        self.assertEqual(response.status_code, 400)
        response_data = response.json()
        self.assertIn("message", response_data)
        self.assertEqual(
            response_data["message"],
            "Invalid email, user not found"
        )

    def test_forgot_password_invalid_email(self):
        # Prepare payload with an invalid email format
        user_payload = {
            "email": "invalid_email_format"
        }
        # Perform forgot password request
        response = self.client.post(
            "/api/v1/user/forgot-password",
            user_payload,
            content_type="application/json",
        )
        # Check if the request was successful
        self.assertEqual(response.status_code, 400)
        response_data = response.json()

        self.assertIn("message", response_data)
        self.assertEqual(
            response_data["message"],
            "Enter a valid email address."
        )
