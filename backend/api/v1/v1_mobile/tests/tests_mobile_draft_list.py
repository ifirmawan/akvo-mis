from django.test import TestCase
from api.v1.v1_mobile.tests.mixins import AssignmentTokenTestHelperMixin
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin
from api.v1.v1_profile.models import (
    Administration,
    Levels,
)
from django.core.management import call_command
from api.v1.v1_mobile.models import MobileAssignment
from api.v1.v1_forms.models import Forms
from api.v1.v1_data.models import FormData
from api.v1.v1_data.functions import add_fake_answers
from rest_framework import status


class MobileAssignmentApiDraftListTest(
    TestCase, AssignmentTokenTestHelperMixin, ProfileTestHelperMixin
):
    def setUp(self):
        call_command("administration_seeder", "--test")
        call_command("form_seeder", "--test")
        call_command("default_roles_seeder", "--test", 1)

        adm_level = Levels.objects.filter(level=3).order_by("?").first()
        self.administration = Administration.objects.filter(
            level=adm_level
        ).order_by("?").last()
        self.geo = [-121.8863, 37.3382]
        self.uuid = "2f14a095-fb1e-48c1-ae13-d3ca8ba92cfe"

        self.form = Forms.objects.get(pk=1)

        # Create approver user
        self.create_user(
            email="approver.123@test.com",
            administration=self.administration,
            role_level=self.IS_APPROVER,
            form=self.form,
        )

        # Create admnin user
        self.user = self.create_user(
            email="test@test.org",
            administration=self.administration,
            role_level=self.IS_ADMIN,
            form=self.form,
        )

        # Create draft form data
        for i in range(3):
            # Registration data
            form_data = FormData.objects.create(
                form=self.form,
                created_by=self.user,
                administration=self.administration,
                uuid=self.uuid,
                geo=self.geo,
            )
            form_data.mark_as_draft()
            # Add fake answers to the form data
            add_fake_answers(form_data)
            # monitoring data
            for child_form in self.form.children.all():
                child_form_data = FormData.objects.create(
                    form=child_form,
                    created_by=self.user,
                    administration=self.administration,
                    uuid=self.uuid,
                    geo=self.geo,
                )
                # Mark the child form data as draft
                child_form_data.mark_as_draft()
                # Add fake answers to the child form data
                add_fake_answers(child_form_data)

        self.user.set_password("test1234")
        self.user.save()

        self.user_token = self.get_auth_token(self.user.email, "test1234")

        passcode = "passcode1234"
        MobileAssignment.objects.create_assignment(
            user=self.user, name="test assignment", passcode=passcode
        )
        self.mobile_assignment = MobileAssignment.objects.get(user=self.user)
        self.administration_children = Administration.objects.filter(
            parent=self.administration
        ).all()
        self.mobile_assignment.administrations.add(
            *self.administration_children
        )
        self.mobile_assignment.forms.add(self.form)
        self.mobile_token = self.get_assignmen_token(passcode)

    def test_get_draft_list(self):
        """
        Test to get the draft list of forms for a mobile user.
        """
        response = self.client.get(
            "/api/v1/device/draft-list",
            follow=True,
            content_type="application/json",
            **{"HTTP_AUTHORIZATION": f"Bearer {self.mobile_token}"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        res_json = response.json()
        self.assertEqual(
            list(res_json),
            [
                "current",
                "total",
                "total_page",
                "data",
            ]
        )
        # 3 parent forms + 3 x 2 child forms = 9 total forms
        self.assertEqual(res_json["total"], 9)
        self.assertEqual(
            list(res_json["data"][0]),
            [
                "id",
                "uuid",
                "form",
                "administration",
                "datapoint_name",
                "geolocation",
                "submittedAt",
                "duration",
                "json",
                "repeats",
            ]
        )

    def test_get_draft_list_with_invalid_token(self):
        """
        Test to get the draft list of forms
        for a mobile user with an invalid token.
        """
        response = self.client.get(
            "/api/v1/device/draft-list",
            follow=True,
            content_type="application/json",
            **{"HTTP_AUTHORIZATION": "Bearer invalid_token"},
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
