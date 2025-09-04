from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings
from django_q.tasks import async_task
from rest_framework import status

from api.v1.v1_jobs.models import Jobs
from api.v1.v1_jobs.constants import JobStatus, JobTypes, DataDownloadTypes
from api.v1.v1_forms.models import Forms
from api.v1.v1_profile.models import Administration
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin


@override_settings(USE_TZ=False, TEST_ENV=True)
class DownloadStatusAPITestCase(TestCase, ProfileTestHelperMixin):
    def setUp(self):
        call_command("administration_seeder", "--test", 1)
        call_command("default_roles_seeder", "--test", 1)
        call_command("form_seeder", "--test", 1)

        self.form = Forms.objects.get(pk=1)
        self.administration = Administration.objects.filter(
            level__level=1
        ).order_by("?").first()
        self.user = self.create_user(
            email="admin@akvo.org",
            password="Test105*",
            role_level=self.IS_ADMIN,
            administration=self.administration,
            form=self.form
        )
        self.token = self.get_auth_token(
            email=self.user.email,
            password="Test105*"
        )
        # Create a new job
        self.job = Jobs.objects.create(
            type=JobTypes.download,
            user=self.user,
            status=JobStatus.pending,
            info={
                "form_id": self.form.id,
                "administration_id": self.administration.id,
                "download_type": DataDownloadTypes.all,
            },
        )
        task_id = async_task(
            "api.v1.v1_jobs.job.seed_data_job",
            self.job.id,
            hook="api.v1.v1_jobs.job.seed_data_job_result",
        )
        self.job.task_id = task_id
        self.job.save()

        self.job.refresh_from_db()

        self.url = f"/api/v1/download/status/{task_id}"

    def test_get_download_status(self):
        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION=f"Bearer {self.token}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("status", response.data)

    def test_get_download_status_with_invalid_token(self):
        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION="Bearer invalid_token"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
