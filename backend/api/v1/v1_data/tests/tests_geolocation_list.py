import time
from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings

from api.v1.v1_forms.models import Forms
from api.v1.v1_data.functions import add_fake_answers
from api.v1.v1_profile.models import Administration
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin
from faker import Faker

fake = Faker()


@override_settings(USE_TZ=False)
class GeolocationListTestCases(TestCase, ProfileTestHelperMixin):
    def setUp(self):
        super().setUp()
        self.maxDiff = None
        call_command("administration_seeder", "--test")
        call_command("form_seeder", "--test")
        call_command("default_roles_seeder", "--test", 1)
        call_command(
            "fake_data_seeder",
            repeat=5,
            test=True,
            approved=True,
            draft=False,
        )
        self.form = Forms.objects.get(pk=1)
        self.data = (
            self.form.form_form_data.filter(
                is_pending=False,
                is_draft=False,
            )
            .order_by("?")
            .first()
        )
        # Create a new superuser
        self.user = self.create_user(
            email="super@akvo.org",
            role_level=self.IS_SUPER_ADMIN,
        )

        self.user.set_password("test")
        self.user.save()

        self.token = self.get_auth_token(self.user.email, "test")

        # Create a draft data entry
        draft_data = self.form.form_form_data.create(
            name="Draft Data",
            administration=self.data.administration,
            geo=self.data.geo,
            created_by=self.user,
            updated_by=self.user,
            is_pending=False,
            is_draft=True,
        )
        add_fake_answers(draft_data)
        self.draft_data = draft_data

    def test_geolocation_list_exclude_draft(self):
        """Test that the geolocation list excludes draft data."""
        response = self.client.get(
            f"/api/v1/maps/geolocation/{self.form.id}",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(len(data), 0)
        self.assertEqual(
            list(data[0]),
            [
                "id",
                "label",
                "point",
                "administration_id",
            ]
        )
        # Ensure draft data is not included in the response
        self.assertNotIn(self.draft_data.id, [d["id"] for d in data])

        # Ensure the geolocation is correctly formatted
        self.assertIsInstance(data[0]["point"], list)

    def test_get_geolocation_list_with_administration_filter(self):
        """
            Test that the geolocation list can be filtered by administration.
        """
        admin = self.data.administration
        response = self.client.get(
            (
                f"/api/v1/maps/geolocation/{self.form.id}"
                f"?administration={admin.id}"
            ),
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(len(data), 0)
        for item in data:
            self.assertEqual(item["administration_id"], admin.id)

    def test_get_geolocation_list_with_invalid_administration_filter(self):
        """
            Test that an invalid administration filter returns an empty list.
        """
        response = self.client.get(
            f"/api/v1/maps/geolocation/{self.form.id}?administration=9999",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data, [])

    def test_get_geolocation_list_with_invalid_form_id(self):
        """
            Test that an invalid form ID returns a 404 error.
        """
        response = self.client.get(
            "/api/v1/maps/geolocation/9999",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 404)

    def test_get_geolocation_list_with_unauthenticated_user(self):
        """
            Test that an unauthenticated user cannot
            access the geolocation list.
        """
        response = self.client.get(
            f"/api/v1/maps/geolocation/{self.form.id}",
        )
        self.assertEqual(response.status_code, 401)

    def test_performance_geolocation_list(self):
        """
            Test the performance of the geolocation list endpoint
            with a large number of entries.
        """
        # Delete existing data entries to ensure a clean state
        self.form.form_form_data.all().delete(hard=True)
        # Create additional data entries to test performance
        for _ in range(1000):
            random_adm = Administration.objects.filter(
                level__level__gte=1
            ).order_by("?").first()
            fake_geo = fake.local_latlng(country_code="ID", coords_only=True)
            self.form.form_form_data.create(
                name="Performance Data",
                administration=random_adm,
                geo=fake_geo,
                created_by=self.user,
                updated_by=self.user,
                is_pending=False,
                is_draft=False,
            )
            # add_fake_answers(new_data)
        # Calculate the time taken for the response
        start_time = time.time()
        response = self.client.get(
            f"/api/v1/maps/geolocation/{self.form.id}",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        end_time = time.time()
        duration = end_time - start_time
        self.assertLess(duration, 2)  # Ensure response time is under 2 seconds
        self.assertEqual(response.status_code, 200)
