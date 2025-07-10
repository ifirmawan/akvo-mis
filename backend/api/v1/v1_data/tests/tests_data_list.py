from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings

from api.v1.v1_forms.models import Forms
from api.v1.v1_data.functions import add_fake_answers
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin


@override_settings(USE_TZ=False)
class FormDataListTestCase(TestCase, ProfileTestHelperMixin):
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

    def test_form_data_list_exclude_draft(self):
        """Test that the form data list excludes draft data."""
        response = self.client.get(
            f"/api/v1/form-data/{self.form.id}",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(data["total"], 0)
        self.assertNotIn(self.draft_data.id, [d["id"] for d in data["data"]])
