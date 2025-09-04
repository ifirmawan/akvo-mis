import os
from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings
from rest_framework import status

from api.v1.v1_jobs.models import Jobs
from api.v1.v1_jobs.constants import JobStatus, JobTypes, DataDownloadTypes
from api.v1.v1_forms.models import Forms
from api.v1.v1_profile.models import Administration
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin
from utils import storage
from mis.settings import STORAGE_PATH


def generate_file(filename: str, folder: str = "download"):
    f = open(filename, "a")
    f.write("This is a test file!")
    f.close()
    storage.upload(file=filename, folder=folder)
    return filename


@override_settings(USE_TZ=False, TEST_ENV=True)
class DownloadFileAPITestCase(TestCase, ProfileTestHelperMixin):
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
        self.url = "/api/v1/download/file/"

    def test_successful_file_download(self):
        # Create a Job with result is download-test_form.xlsx path
        filename = "download-test_form.xlsx"
        file = generate_file(filename=filename)
        job = Jobs.objects.create(
            type=JobTypes.download,
            user=self.user,
            status=JobStatus.done,
            info={
                "form_id": self.form.id,
                "administration_id": self.administration.id,
                "download_type": DataDownloadTypes.all,
            },
            result=filename
        )
        response = self.client.get(
            f"{self.url}{job.result}",
            HTTP_AUTHORIZATION=f"Bearer {self.token}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertTrue(
            os.path.exists(f"{STORAGE_PATH}/download/{filename}"),
            "File not exists"
        )
        # Remove the file after test
        os.remove(file)
        storage.delete(url=f"download/{filename}")

        # Create a Job with result is download-report-test-form-123.docx
        filename = "download-report-test-form-123.docx"
        file = generate_file(
            filename=filename,
            folder="download_datapoint_report"
        )
        job = Jobs.objects.create(
            type=JobTypes.download_datapoint_report,
            user=self.user,
            status=JobStatus.done,
            info={
                "form_id": self.form.id,
                "administration_id": self.administration.id,
                "selection_ids": [1, 2, 3]
            },
            result=filename
        )
        response = self.client.get(
            (
                f"{self.url}{job.result}"
                "?type={0}".format(
                    JobTypes.FieldStr.get(JobTypes.download_datapoint_report)
                )
            ),
            HTTP_AUTHORIZATION=f"Bearer {self.token}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertTrue(
            os.path.exists(
                f"{STORAGE_PATH}/download_datapoint_report/{filename}"
            ),
            "File not exists"
        )
        # Remove the file after test
        os.remove(file)
        storage.delete(url=f"download_datapoint_report/{filename}")
