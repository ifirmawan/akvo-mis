from mis.settings import WEBDOMAIN
from django.test import TestCase
from django.core.management import call_command
from api.v1.v1_mobile.models import MobileAssignment
from api.v1.v1_profile.models import (
    Administration,
)
from api.v1.v1_forms.models import Forms
from api.v1.v1_data.models import FormData
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin
from api.v1.v1_data.functions import add_fake_answers
from rest_framework import status


class MobileDataPointDownloadListTestCase(TestCase, ProfileTestHelperMixin):
    def setUp(self):
        call_command("administration_seeder", "--test")
        call_command("form_seeder", "--test")
        call_command("default_roles_seeder", "--test", 1)

        self.administration = Administration.objects.filter(
            parent__isnull=True
        ).first()
        self.forms = Forms.objects.filter(parent__isnull=True).all()
        self.user = self.create_user(
            email="test@test.org",
            role_level=self.IS_ADMIN,
            administration=self.administration,
        )
        for f in self.forms:
            self.user.user_form.create(
                form=f,
            )
            self.user.save()
        self.uuid = "uuid-1234-5678-9101"
        self.passcode = "passcode1234"
        self.mobile_assignment = MobileAssignment.objects.create_assignment(
            user=self.user, name="test", passcode=self.passcode
        )
        self.adm_children = self.administration.parent_administration.all()
        self.mobile_assignment.administrations.add(
            *self.adm_children
        )
        self.mobile_assignment = MobileAssignment.objects.get(user=self.user)
        self.mobile_assignment.forms.add(*self.forms)
        self.form_data = FormData.objects.create(
            name="TEST",
            geo=None,
            form=self.forms[0],
            administration=self.adm_children.first(),
            created_by=self.user,
            uuid=self.uuid,
        )

    def test_get_datapoints_list_url(self):
        code = {"code": self.passcode}
        response = self.client.post(
            "/api/v1/device/auth",
            code,
            content_type="application/json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        token = response.data["syncToken"]
        url = "/api/v1/device/datapoint-list/"
        response = self.client.get(
            url,
            follow=True,
            content_type="application/json",
            **{"HTTP_AUTHORIZATION": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["data"][0]["id"], self.form_data.id)
        self.assertEqual(data["data"][0]["name"], self.form_data.name)
        self.assertEqual(data["data"][0]["form_id"], self.forms[0].id)
        self.assertEqual(
            data["data"][0]["administration_id"],
            self.form_data.administration.id,
        )
        self.assertFalse(self.mobile_assignment.last_synced_at, None)
        # test if url is correct
        self.assertEqual(
            data["data"][0]["url"], f"{WEBDOMAIN}/datapoints/{self.uuid}.json"
        )
        self.assertEqual(
            list(data["data"][0]),
            [
                "id",
                "form_id",
                "name",
                "administration_id",
                "url",
                "last_updated",
            ],
        )

    def test_get_datapoints_list_by_national_user(self):
        # Remove current administration mobile assignment
        self.mobile_assignment.administrations.clear()
        # Add national administration
        self.mobile_assignment.administrations.add(
            self.administration
        )
        self.mobile_assignment.save()
        code = {"code": self.passcode}
        response = self.client.post(
            "/api/v1/device/auth",
            code,
            content_type="application/json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        token = response.data["syncToken"]
        url = "/api/v1/device/datapoint-list/"
        response = self.client.get(
            url,
            follow=True,
            content_type="application/json",
            **{"HTTP_AUTHORIZATION": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["total"], 1)

    def test_get_datapoints_list_by_second_level_administration(self):
        # Remove current administration mobile assignment
        self.mobile_assignment.administrations.clear()
        # Add second level administration
        self.mobile_assignment.administrations.add(
            self.administration.parent_administration.first()
        )
        self.mobile_assignment.save()
        code = {"code": self.passcode}
        response = self.client.post(
            "/api/v1/device/auth",
            code,
            content_type="application/json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        token = response.data["syncToken"]
        url = "/api/v1/device/datapoint-list/"
        response = self.client.get(
            url,
            follow=True,
            content_type="application/json",
            **{"HTTP_AUTHORIZATION": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["total"], 1)

    def test_get_datapoints_list_by_last_administration_level(self):
        # Remove current administration mobile assignment
        self.mobile_assignment.administrations.clear()
        # Add last level administration
        adm = self.adm_children.first()
        adm_children = adm.parent_administration.first()
        self.mobile_assignment.administrations.add(
            adm_children
        )
        self.mobile_assignment.save()
        code = {"code": self.passcode}
        response = self.client.post(
            "/api/v1/device/auth",
            code,
            content_type="application/json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        token = response.data["syncToken"]
        url = "/api/v1/device/datapoint-list/"
        response = self.client.get(
            url,
            follow=True,
            content_type="application/json",
            **{"HTTP_AUTHORIZATION": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        # No data points for last level administration
        self.assertEqual(data["total"], 0)

    def test_get_datapoints_list_exclude_pending_data(self):
        # Create a pending form data
        pending_form_data = FormData.objects.create(
            name="Pending Data",
            geo=None,
            form=self.forms[0],
            administration=self.adm_children.first(),
            created_by=self.user,
            uuid="pending-uuid-1234",
            is_pending=True,  # Mark as pending
        )
        add_fake_answers(pending_form_data)

        code = {"code": self.passcode}
        response = self.client.post(
            "/api/v1/device/auth",
            code,
            content_type="application/json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        token = response.data["syncToken"]
        url = "/api/v1/device/datapoint-list/"
        response = self.client.get(
            url,
            follow=True,
            content_type="application/json",
            **{"HTTP_AUTHORIZATION": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        # Ensure that the pending data is not included in the list
        self.assertEqual(data["total"], 1)
        self.assertNotIn(pending_form_data.id, [d["id"] for d in data["data"]])

    def test_get_datapoint_list_from_last_synced_at(self):
        # Create a new form data after the last synced time
        self.mobile_assignment.last_synced_at = self.form_data.created
        self.mobile_assignment.save()

        new_form_data = FormData.objects.create(
            name="New Data",
            geo=None,
            form=self.forms[0],
            administration=self.adm_children.first(),
            created_by=self.user,
            uuid="new-uuid-1234",
        )
        add_fake_answers(new_form_data)

        code = {"code": self.passcode}
        response = self.client.post(
            "/api/v1/device/auth",
            code,
            content_type="application/json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        token = response.data["syncToken"]
        url = "/api/v1/device/datapoint-list/"
        response = self.client.get(
            url,
            follow=True,
            content_type="application/json",
            **{"HTTP_AUTHORIZATION": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        # Ensure that the new data is included in the list
        self.assertEqual(data["total"], 2)
        self.assertIn(new_form_data.id, [d["id"] for d in data["data"]])

    def test_get_datapoint_list_exclude_draft_data(self):
        # Create a draft form data
        draft_form_data = FormData.objects.create(
            name="Draft Data",
            geo=None,
            form=self.forms[0],
            administration=self.adm_children.first(),
            created_by=self.user,
            uuid="draft-uuid-1234",
            is_pending=False,  # Not pending
            is_draft=True,  # Mark as draft
        )
        add_fake_answers(draft_form_data)

        code = {"code": self.passcode}
        response = self.client.post(
            "/api/v1/device/auth",
            code,
            content_type="application/json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        token = response.data["syncToken"]
        url = "/api/v1/device/datapoint-list/"
        response = self.client.get(
            url,
            follow=True,
            content_type="application/json",
            **{"HTTP_AUTHORIZATION": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        # Ensure that the draft data is not included in the list
        self.assertEqual(data["total"], 1)
        self.assertNotIn(draft_form_data.id, [d["id"] for d in data["data"]])
