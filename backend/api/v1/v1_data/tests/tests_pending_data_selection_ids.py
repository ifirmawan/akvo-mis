from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings
from api.v1.v1_data.models import FormData
from api.v1.v1_forms.models import Forms
from api.v1.v1_profile.models import Administration
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin
from api.v1.v1_data.functions import add_fake_answers


@override_settings(USE_TZ=False, TEST_ENV=True)
class PendingDataSelectionIDsTestCase(TestCase, ProfileTestHelperMixin):

    def setUp(self):
        call_command("administration_seeder", "--test")
        call_command("default_roles_seeder", "--test", 1)
        call_command("form_seeder", "--test")

        self.form = Forms.objects.get(pk=1)
        self.administration = Administration.objects.filter(
            level__level=3
        ).order_by("id").first()

        self.submitter = self.create_user(
            email="submitter@test.com",
            role_level=self.IS_ADMIN,
            password="test",
            administration=self.administration,
            form=self.form,
        )
        self.submitter.set_password("test")
        self.submitter.save()

        self.token = self.get_auth_token(self.submitter.email, "test")

        reg_1 = FormData.objects.create(
            name="New Reg #1",
            form=self.form,
            created_by=self.submitter,
            administration=self.administration,
            geo=[7.2088, 126.8456],
            is_pending=True,
        )
        add_fake_answers(reg_1)

        reg_2 = FormData.objects.create(
            name="New Reg #2",
            form=self.form,
            created_by=self.submitter,
            administration=self.administration,
            geo=[7.2088, 126.8456],
            is_pending=True,
        )
        add_fake_answers(reg_2)

        mon_2 = FormData.objects.create(
            name="Test Pending Monitoring Data 2",
            parent=reg_2,
            form=self.form.children.first(),
            created_by=self.submitter,
            administration=self.administration,
            geo=[7.2088, 126.8456],
            is_pending=True,
        )
        add_fake_answers(mon_2)

        self.reg_1 = reg_1
        self.reg_2 = reg_2
        self.mon_2 = mon_2

    def test_selection_ids_list(self):
        selection_ids = f"?selection_ids={self.reg_2.id}"
        selection_ids += f"&selection_ids={self.mon_2.id}"
        response = self.client.get(
            f"/api/v1/form-pending-data/{self.form.id}/{selection_ids}",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 200)
        res = response.json()
        self.assertNotIn("current", res)
        self.assertNotIn("total", res)
        self.assertNotIn("total_page", res)
        self.assertNotIn("data", res)

        # Check that the response contains only the selected data
        self.assertNotIn(self.reg_1.id, [
            d["id"] for d in res
        ])

        # Total should be 2 since we selected two items
        self.assertEqual(len(res), 2)

        self.assertEqual(
            list(res[0]),
            [
                "id",
                "uuid",
                "name",
                "form",
                "administration",
                "geo",
                "submitter",
                "duration",
                "created_by",
                "created",
                "answer_history",
                "parent",
            ]
        )
        self.assertEqual(
            res[0]["created_by"],
            self.submitter.get_full_name()
        )
