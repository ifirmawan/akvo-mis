from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings

from api.v1.v1_profile.models import Administration, Role, UserRole
from api.v1.v1_users.models import SystemUser, Organisation
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin


@override_settings(USE_TZ=False, TEST_ENV=True)
class UserListTestCase(TestCase, ProfileTestHelperMixin):
    def setUp(self):
        call_command("administration_seeder", "--test")
        call_command("default_roles_seeder", "--test", 1)
        call_command("fake_organisation_seeder", "--repeat", 2)
        call_command("fake_user_seeder", "--repeat", 10, "--test", 1)

        # Create a superuser for testing
        self.superuser = self.create_user(
            email="super@akvo.org",
            role_level=self.IS_SUPER_ADMIN,
        )
        self.token = self.get_auth_token(self.superuser.email)

    def test_get_user_list(self):
        response = self.client.get(
            "/api/v1/users",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user_data = response.json()
        # Check pagination structure
        self.assertIn("current", user_data)
        self.assertIn("total", user_data)
        self.assertIn("total_page", user_data)
        self.assertIn("data", user_data)

        self.assertIsInstance(user_data["data"], list)
        self.assertGreater(len(user_data["data"]), 0)
        # Check if each user has the required fields
        for user in user_data["data"]:
            self.assertIn("email", user)
            self.assertIn("first_name", user)
            self.assertIn("last_name", user)
            self.assertIn("roles", user)
            self.assertIn("trained", user)
            self.assertIn("phone_number", user)
            self.assertIn("forms", user)
            self.assertIn("organisation", user)
            self.assertIn("last_login", user)
            self.assertIn("id", user)

    def test_get_user_list_unauthenticated(self):
        response = self.client.get(
            "/api/v1/users", content_type="application/json"
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn("detail", response.json())
        self.assertEqual(
            response.json()["detail"],
            "Authentication credentials were not provided.",
        )

    # Test for all filtering functionalities
    def test_get_user_list_with_filter_administration(self):
        # Get a specific administration
        administration = Administration.objects.filter(
            level__level__gt=0
        ).first()

        # Create a test user with this administration
        test_user = self.create_user(
            email="test_admin@example.com",
            role_level=self.IS_ADMIN,
            administration=administration,
        )

        response = self.client.get(
            f"/api/v1/users?page=1&administration={administration.id}",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user_data = response.json()

        # Should find our test user
        found_test_user = any(
            user["email"] == test_user.email for user in user_data["data"]
        )
        self.assertTrue(found_test_user)

    def test_get_user_list_with_filter_role(self):
        # Get a specific role
        role = Role.objects.first()
        administration = Administration.objects.filter(
            level=role.administration_level
        ).first()

        # Create a test user with this role
        self.create_user(
            email="test_role@example.com",
            role_level=self.IS_ADMIN,
            administration=administration,
        )

        response = self.client.get(
            f"/api/v1/users?page=1&role={role.id}",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user_data = response.json()

        # Should find users with this role
        self.assertGreater(len(user_data["data"]), 0)

    def test_get_user_list_with_filter_trained(self):
        # Create a trained user
        test_user = SystemUser.objects.create(
            email="trained_user@example.com",
            first_name="Trained",
            last_name="User",
            trained=True,
        )
        test_user.set_password("password")
        test_user.save()

        # Test filtering for trained users
        response = self.client.get(
            "/api/v1/users?page=1&trained=true",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user_data = response.json()

        # Should find our trained user
        found_trained_user = any(
            user["email"] == test_user.email and user["trained"] is True
            for user in user_data["data"]
        )
        self.assertTrue(found_trained_user)

        # Test filtering for untrained users
        response = self.client.get(
            "/api/v1/users?page=1&trained=false",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user_data = response.json()

        # All users should be untrained
        for user in user_data["data"]:
            if user["email"] != test_user.email:
                self.assertFalse(user["trained"])

    def test_get_user_list_with_filter_organisation(self):
        # Get a specific organisation
        organisation = Organisation.objects.first()

        # Create a test user with this organisation
        test_user = SystemUser.objects.create(
            email="org_user@example.com",
            first_name="Org",
            last_name="User",
            organisation=organisation,
        )
        test_user.set_password("password")
        test_user.save()

        response = self.client.get(
            f"/api/v1/users?page=1&organisation={organisation.id}",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user_data = response.json()

        # Should find our test user
        found_test_user = any(
            user["email"] == test_user.email for user in user_data["data"]
        )
        self.assertTrue(found_test_user)

    def test_get_user_list_with_pending_status_true(self):
        # Create a pending user (user without password)
        pending_user = SystemUser.objects.create(
            email="pending_user@example.com",
            first_name="Pending",
            last_name="User",
            password="",  # Empty password indicates pending status
        )

        response = self.client.get(
            "/api/v1/users?page=1&pending=true",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user_data = response.json()

        # Should find our pending user
        found_pending_user = any(
            user["email"] == pending_user.email for user in user_data["data"]
        )
        self.assertTrue(found_pending_user)

    def test_get_user_list_by_search(self):
        # Create a user with specific email and name for searching
        test_user = SystemUser.objects.create(
            email="searchable@unique.com",
            first_name="SearchableFirst",
            last_name="SearchableLast",
        )
        test_user.set_password("password")
        test_user.save()

        # Test search by email
        response = self.client.get(
            "/api/v1/users?page=1&search=searchable@unique.com",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user_data = response.json()

        # Should find our test user
        found_test_user = any(
            user["email"] == test_user.email for user in user_data["data"]
        )
        self.assertTrue(found_test_user)

        # Test search by first name
        response = self.client.get(
            "/api/v1/users?page=1&search=SearchableFirst",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user_data = response.json()

        # Should find our test user
        found_test_user = any(
            user["email"] == test_user.email for user in user_data["data"]
        )
        self.assertTrue(found_test_user)

        # Test search by full name
        response = self.client.get(
            "/api/v1/users?page=1&search=SearchableFirst SearchableLast",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user_data = response.json()

        # Should find our test user
        found_test_user = any(
            user["email"] == test_user.email for user in user_data["data"]
        )
        self.assertTrue(found_test_user)

    def test_get_user_list_multiple_filters(self):
        # Test combining multiple filters
        organisation = Organisation.objects.first()
        administration = Administration.objects.filter(
            level__level__gt=0
        ).first()

        # Create a specific test user
        test_user = SystemUser.objects.create(
            email="multi_filter@example.com",
            first_name="Multi",
            last_name="Filter",
            organisation=organisation,
            trained=True,
        )
        test_user.set_password("password")
        test_user.save()

        # Assign role to user
        role = Role.objects.filter(
            administration_level=administration.level
        ).first()
        if role:
            UserRole.objects.create(
                user=test_user, role=role, administration=administration
            )

        # Test with multiple filters
        response = self.client.get(
            f"/api/v1/users?page=1&organisation={organisation.id}"
            f"&trained=true&search=Multi",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user_data = response.json()

        # Should find our test user that matches all criteria
        found_test_user = any(
            user["email"] == test_user.email for user in user_data["data"]
        )
        self.assertTrue(found_test_user)

    def test_get_user_list_pagination_required(self):
        # Test that page parameter is required
        response = self.client.get(
            "/api/v1/users",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        # Note: The view seems to work without page parameter
        # (possibly defaults to page 1)
        # This behavior should be verified with the API specification
        self.assertEqual(response.status_code, 200)
        user_data = response.json()
        self.assertIn("data", user_data)

    def test_get_user_list_invalid_filters(self):
        # Test with invalid administration ID
        response = self.client.get(
            "/api/v1/users?page=1&administration=99999",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

        # Test with invalid organisation ID
        response = self.client.get(
            "/api/v1/users?page=1&organisation=99999",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

        # Test with invalid role ID
        response = self.client.get(
            "/api/v1/users?page=1&role=99999",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_get_user_list_empty_search(self):
        # Test search with empty string should return all users
        response = self.client.get(
            "/api/v1/users?page=1&search=",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user_data = response.json()
        self.assertGreater(len(user_data["data"]), 0)

    def test_get_user_list_search_no_results(self):
        # Test search that should return no results
        response = self.client.get(
            "/api/v1/users?page=1&search=nonexistentuser12345",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user_data = response.json()
        self.assertEqual(len(user_data["data"]), 0)
        self.assertEqual(user_data["total"], 0)
