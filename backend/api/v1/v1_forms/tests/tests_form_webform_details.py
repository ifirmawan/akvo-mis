from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings

from api.v1.v1_forms.models import Forms
from api.v1.v1_profile.models import Administration
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin


@override_settings(USE_TZ=False)
class WebFormDetailsTestCase(TestCase, ProfileTestHelperMixin):
    def setUp(self):
        call_command("administration_seeder", "--test", 1)
        call_command("default_roles_seeder", "--test", 1)
        call_command("form_seeder", "--test", 1)

        self.form = Forms.objects.filter(
            parent__isnull=True
        ).order_by("?").first()

        self.adm = Administration.objects.filter(
            level__level__gt=2,
        ).first()

        user = self.create_user(
            email="user.123@test.com",
            role_level=self.IS_ADMIN,
            administration=self.adm,
            form=self.form,
        )
        user.set_password("password")
        user.save()

        self.token = self.get_auth_token(
            email=user.email,
            password="password",
        )

    def test_success_get_web_form_details(self):
        response = self.client.get(
            f"/api/v1/form/web/{self.form.id}/",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(
            list(data),
            [
                "id",
                "name",
                "version",
                "cascades",
                "approval_instructions",
                "parent",
                "question_group",
            ]
        )
        self.assertEqual(
            list(data["question_group"][0]),
            [
                "name",
                "label",
                "question",
                "repeatable",
                "repeat_text",
                "order",
            ]
        )

    def test_get_web_form_details_by_superuser(self):
        superuser = self.create_user(
            email="super@akvo.org",
            role_level=self.IS_SUPER_ADMIN,
        )
        superuser.set_password("password")
        superuser.save()

        token = self.get_auth_token(
            email=superuser.email,
            password="password",
        )

        response = self.client.get(
            f"/api/v1/form/web/{self.form.id}/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(response.status_code, 200)

    def test_get_web_form_details_with_invalid_form_id(self):
        response = self.client.get(
            "/api/v1/form/web/9999/",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 404)
