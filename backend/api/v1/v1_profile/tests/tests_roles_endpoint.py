# Import necessary modules for mocking
from unittest.mock import patch
from django.db.models import ProtectedError
from django.core.management import call_command
from django.test import TestCase
# from rest_framework_simplejwt.tokens import RefreshToken

from django.test.utils import override_settings
from api.v1.v1_profile.models import (
    Role,
    Levels,
    Administration,
)
from api.v1.v1_profile.constants import DataAccessTypes
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin


@override_settings(USE_TZ=False, TEST_ENV=True)
class RolesEndpointTestCase(TestCase, ProfileTestHelperMixin):
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

    def test_get_roles_list(self):
        res = self.client.get(
            "/api/v1/roles/",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token}"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertIn("current", data)
        self.assertIn("total", data)
        self.assertIn("total_page", data)
        self.assertIn("data", data)

        self.assertEqual(
            list(data["data"][0]),
            [
                "id",
                "name",
                "description",
                "administration_level",
                "role_access",
                "role_features",
                "total_users",
            ]
        )

        self.assertGreater(data["total"], 0)
        self.assertGreater(data["total_page"], 0)
        self.assertGreater(len(data["data"]), 0)

    def test_create_role(self):
        administration_level = Levels.objects.order_by("?").first()
        new_role = {
            "name": f"{administration_level.name} Data entry",
            "description": f"Role for {administration_level.name} data entry",
            "administration_level": administration_level.id,
            "role_access": [
                DataAccessTypes.read,
                DataAccessTypes.submit,
            ],
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
            len(data["role_access_list"]), len(new_role["role_access"])
        )

    def test_get_role_detail(self):
        # Get existing role
        role = Role.objects.order_by("?").first()
        res = self.client.get(
            f"/api/v1/role/{role.id}/",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["id"], role.id)
        self.assertEqual(data["name"], role.name)
        self.assertEqual(data["description"], role.description)
        self.assertEqual(
            data["administration_level"],
            {
                "id": role.administration_level.id,
                "name": role.administration_level.name,
            }
        )
        self.assertIn("role_access", data)
        # Show role access as a list of dictionaries
        self.assertIsInstance(data["role_access"], list)
        self.assertGreater(len(data["role_access"]), 0)
        # Each role access should have id and data_access
        for access in data["role_access"]:
            self.assertIn("id", access)
            self.assertIn("data_access", access)
            self.assertIn("data_access_name", access)

    def test_update_role(self):
        # Update existing role
        role = Role.objects.order_by("?").first()
        updated_role = {
            "name": f"{role.name} Read-only",
            "description": f"{role.description} Updated to read-only",
            "administration_level": role.administration_level.id,
            "role_access": [
                DataAccessTypes.read,
            ],
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
        # count of role access should match the number of accesses provided
        self.assertEqual(
            len(data["role_access_list"]), len(updated_role["role_access"])
        )

    def test_delete_role(self):
        # Delete existing role
        role = Role.objects.order_by("?").first()
        res = self.client.delete(
            f"/api/v1/role/{role.id}/",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(res.status_code, 204)
        # Verify the role is deleted
        self.assertFalse(Role.objects.filter(id=role.id).exists())

    def test_delete_role_is_protected(self):
        # Get a role to attempt to delete
        role = Role.objects.order_by("?").first()
        # Mock the delete method to raise ProtectedError
        with patch.object(Role, 'delete') as mock_delete:
            # Make it raise ProtectedError when called
            mock_delete.side_effect = ProtectedError("Cannot delete role", [])

            # Attempt to delete the role
            res = self.client.delete(
                f"/api/v1/role/{role.id}/",
                content_type="application/json",
                HTTP_AUTHORIZATION=f"Bearer {self.token}",
            )

            # Should get 409 Conflict because the role is protected
            self.assertEqual(res.status_code, 409)
            data = res.json()

            # Check for expected fields in the response
            self.assertIn("error", data)
            self.assertIn("referenced_by", data)

            # Verify error message contains the role name
            self.assertTrue(f'Role: {role}' in data["error"])
            self.assertTrue("referenced by other data" in data["error"])

    def test_get_roles_list_non_superuser(self):
        res = self.client.get(
            "/api/v1/roles/",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_token}",
        )
        self.assertEqual(res.status_code, 403)
        # Non-superuser should not have access to the roles list
        data = res.json()
        self.assertIn("detail", data)
        self.assertEqual(
            data["detail"],
            "You do not have permission to perform this action."
        )

    def test_create_role_non_superuser(self):
        administration_level = Levels.objects.order_by("?").first()
        new_role = {
            "name": f"{administration_level.name} Data entry",
            "description": f"Role for {administration_level.name} data entry",
            "administration_level": administration_level.id,
            "role_access": [
                DataAccessTypes.read,
                DataAccessTypes.submit,
            ],
        }
        res = self.client.post(
            "/api/v1/roles/",
            data=new_role,
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_token}",
        )
        self.assertEqual(res.status_code, 403)
        # Non-superuser should not have access to create roles
        data = res.json()
        self.assertIn("detail", data)
        self.assertEqual(
            data["detail"],
            "You do not have permission to perform this action."
        )

    def test_get_role_detail_non_superuser(self):
        # Get existing role
        role = Role.objects.order_by("?").first()
        res = self.client.get(
            f"/api/v1/role/{role.id}/",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_token}",
        )
        self.assertEqual(res.status_code, 403)
        # Non-superuser should not have access to role details
        data = res.json()
        self.assertIn("detail", data)
        self.assertEqual(
            data["detail"],
            "You do not have permission to perform this action."
        )

    def test_update_role_non_superuser(self):
        # Update existing role
        role = Role.objects.order_by("?").first()
        updated_role = {
            "name": f"{role.name} Updated",
            "description": f"{role.description} Updated",
            "administration_level": role.administration_level.id,
            "role_access": [
                DataAccessTypes.read,
                DataAccessTypes.edit,
            ],
        }
        res = self.client.put(
            f"/api/v1/role/{role.id}/",
            data=updated_role,
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_token}",
        )
        self.assertEqual(res.status_code, 403)
        # Non-superuser should not have access to update roles
        data = res.json()
        self.assertIn("detail", data)
        self.assertEqual(
            data["detail"],
            "You do not have permission to perform this action."
        )

    def test_delete_role_non_superuser(self):
        # Delete existing role
        role = Role.objects.order_by("?").first()
        res = self.client.delete(
            f"/api/v1/role/{role.id}/",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_token}",
        )
        self.assertEqual(res.status_code, 403)
        # Non-superuser should not have access to delete roles
        data = res.json()
        self.assertIn("detail", data)
        self.assertEqual(
            data["detail"],
            "You do not have permission to perform this action."
        )
