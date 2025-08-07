from django.core.management import call_command
from django.test import TestCase

from django.test.utils import override_settings
from api.v1.v1_profile.models import (
    Role,
    Levels,
    Administration,
)
from api.v1.v1_profile.constants import (
    DataAccessTypes,
    FeatureTypes,
    FeatureAccessTypes,
)
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin


@override_settings(USE_TZ=False, TEST_ENV=True)
class RolesWithFeaturesEndpointTestCase(TestCase, ProfileTestHelperMixin):
    def setUp(self):
        call_command("administration_seeder", "--test")
        call_command("default_roles_seeder", "--test", 1)
        # Create superuser for testing
        super_adm = Administration.objects.filter(
            level__level=0,
            parent_administration__isnull=True
        ).order_by("?").first()
        super_user = self.create_user(
            email="super@test.com",
            role_level=self.IS_SUPER_ADMIN,
            administration=super_adm,
        )
        self.token = self.get_auth_token(super_user.email)

        # Create non-superuser for testing
        non_super_adm = Administration.objects.filter(
            level__level__gt=0,
            parent_administration__gt=0
        ).order_by("?").first()
        non_super = self.create_user(
            email="non.super@test.com",
            role_level=self.IS_ADMIN,
            administration=non_super_adm,
        )
        self.admin_token = self.get_auth_token(non_super.email)

    def test_create_role_with_features(self):
        administration_level = Levels.objects.order_by("?").first()
        new_role = {
            "name": f"{administration_level.name} Data entry",
            "description": f"Role for {administration_level.name} data entry",
            "administration_level": administration_level.id,
            "role_access": [
                DataAccessTypes.read,
            ],
            "role_features": [
                {
                    "type": FeatureTypes.user_access,
                    "access": FeatureAccessTypes.invite_user,
                },
            ]
        }
        res = self.client.post(
            "/api/v1/roles/",
            data=new_role,
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["name"], new_role["name"])
        self.assertEqual(data["description"], new_role["description"])
        self.assertEqual(
            data["administration_level"],
            new_role["administration_level"]
        )
        self.assertIn("id", data)
        # count of role access should match the number of accesses provided
        self.assertEqual(
            len(data["role_access_list"]),
            len(new_role["role_access"])
        )
        # count of role features should match the number of features provided
        self.assertEqual(
            len(data["role_features_list"]),
            len(new_role["role_features"])
        )

    def test_update_role_with_empty_features(self):
        role = Role.objects.order_by("?").first()
        updated_role = {
            "name": f"{role.name} Editor",
            "description": f"{role.description} with edit access",
            "administration_level": role.administration_level.id,
            "role_access": [
                DataAccessTypes.read,
                DataAccessTypes.edit,
            ],
            "role_features": []
        }
        res = self.client.put(
            f"/api/v1/role/{role.id}/",
            data=updated_role,
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["name"], updated_role["name"])
        self.assertEqual(data["description"], updated_role["description"])
        self.assertEqual(
            data["administration_level"],
            updated_role["administration_level"]
        )
        self.assertIn("id", data)
        # Role features should be empty
        self.assertEqual(len(data["role_features_list"]), 0)
