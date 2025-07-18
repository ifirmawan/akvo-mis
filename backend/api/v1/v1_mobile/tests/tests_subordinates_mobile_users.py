import typing
from django.core.management import call_command
from django.http import HttpResponse
from django.test import TestCase, override_settings
from rest_framework_simplejwt.tokens import RefreshToken

from api.v1.v1_forms.models import Forms
from api.v1.v1_profile.models import SystemUser, Administration, Levels
from api.v1.v1_mobile.models import MobileAssignment
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin


@override_settings(USE_TZ=False)
class SubordinatesMobileUsersTestCase(TestCase, ProfileTestHelperMixin):

    def setUp(self):
        super().setUp()
        call_command("administration_seeder", "--test")
        call_command('form_seeder', '--test')
        call_command("default_roles_seeder", "--test", 1)
        last_level = Levels.objects.order_by('-id').first()
        administration = Administration.objects.filter(
            level=last_level
        ).first()
        form = Forms.objects.get(pk=1)
        self.form = form

        self.administration = administration
        self.user = self.create_user(
            email='user@akvo.org',
            role_level=self.IS_ADMIN,
            password='password',
            administration=administration,
            form=form,
        )
        self.parent_user = self.create_user(
            email='approver@akvo.org',
            role_level=self.IS_ADMIN,
            password='password',
            administration=administration.parent,
            form=form,
        )
        self.token = self.get_auth_token(self.user.email)

        self.form2 = Forms.objects.get(pk=2)

    def test_subordinates_mobile_users_list(self):
        payload = {
            'name': 'user1 assignment',
            'forms': [self.form.id],
            'administrations': [self.administration.id],
        }

        response = typing.cast(
                HttpResponse,
                self.client.post(
                    '/api/v1/mobile-assignments',
                    payload,
                    content_type="application/json",
                    HTTP_AUTHORIZATION=f'Bearer {self.token}'))

        self.assertEqual(response.status_code, 201)

        # Login as approver
        t = RefreshToken.for_user(self.parent_user)

        response = typing.cast(
                HttpResponse,
                self.client.get(
                    '/api/v1/mobile-assignments',
                    content_type="application/json",
                    HTTP_AUTHORIZATION=f'Bearer {t.access_token}'))
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['total'], 1)

    def test_same_level_mobile_users_list(self):
        payload = {
            'name': 'user2 assignment',
            'forms': [self.form.id],
            'administrations': [self.administration.id],
        }

        response = typing.cast(
                HttpResponse,
                self.client.post(
                    '/api/v1/mobile-assignments',
                    payload,
                    content_type="application/json",
                    HTTP_AUTHORIZATION=f'Bearer {self.token}'))
        self.assertEqual(response.status_code, 201)
        assignment = MobileAssignment.objects.get(name='user2 assignment')
        self.assertIsNotNone(assignment.pk)

        # login with other users of the same level
        same_level_user = SystemUser.objects.filter(
            user_user_role__administration__level=self.administration.level,
        ).first()

        t = RefreshToken.for_user(same_level_user)

        response = typing.cast(
                HttpResponse,
                self.client.get(
                    '/api/v1/mobile-assignments',
                    content_type="application/json",
                    HTTP_AUTHORIZATION=f'Bearer {t.access_token}'))
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body['data']), 1)
        self.assertTrue(True)


def test_subordinates_with_diff_forms(self):
    payload = {
        'name': 'user3 assignment',
        'forms': [self.form2.id],
        'administrations': [self.administration.id],
    }

    response = typing.cast(
        HttpResponse,
        self.client.post(
            '/api/v1/mobile-assignments',
            payload,
            content_type="application/json",
            HTTP_AUTHORIZATION=f'Bearer {self.token}'
        )
    )

    self.assertEqual(response.status_code, 201)

    # Login as approver
    t = RefreshToken.for_user(self.parent_user)

    response = typing.cast(
        HttpResponse,
        self.client.get(
            '/api/v1/mobile-assignments',
            content_type="application/json",
            HTTP_AUTHORIZATION=f'Bearer {t.access_token}'
        )
    )
    self.assertEqual(response.status_code, 200)
    body = response.json()
    # Get all sub-ordinate mobile users
    self.assertEqual(len(body['data']), 2)
