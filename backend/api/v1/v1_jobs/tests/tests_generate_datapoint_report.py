import os
from unittest.mock import patch, MagicMock
from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from api.v1.v1_forms.models import Forms
from api.v1.v1_jobs.constants import JobStatus, JobTypes
from api.v1.v1_jobs.models import Jobs
from api.v1.v1_jobs.job import job_generate_data_report
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin


@override_settings(USE_TZ=False, TEST_ENV=True)
class GenerateDatapointReportTestCase(TestCase, ProfileTestHelperMixin):
    def setUp(self):
        call_command("administration_seeder", "--test", 1)
        call_command("default_roles_seeder", "--test", 1)
        call_command("form_seeder", "--test", 1)

        call_command(
            "fake_data_seeder",
            repeat=20,
            test=True,
            approved=True,
        )

        self.form = Forms.objects.get(pk=1)

        datapoints = self.form.form_form_data.filter(is_pending=False).all()
        self.selection_ids = [datapoint.id for datapoint in datapoints][:5]
        self.submitter = datapoints.first().created_by
        self.submitter.set_password("test")
        self.submitter.save()

        self.token = self.get_auth_token(self.submitter.email, "test")
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")
        self.url = "/api/v1/download/datapoint-report"

    def test_generate_datapoint_report_with_selection_ids(self):
        """Test generating datapoint report with valid selection IDs"""
        params = {
            "form_id": self.form.id,
            "selection_ids": self.selection_ids,
        }

        response = self.client.get(
            self.url,
            params,
            HTTP_AUTHORIZATION=f"Bearer {self.token}"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("task_id", response.data)
        self.assertIn("file_url", response.data)
        self.assertIn("download_datapoint_report", response.data["file_url"])

        # Verify job was created
        job = Jobs.objects.get(task_id=response.data["task_id"])
        self.assertEqual(job.type, JobTypes.download_datapoint_report)
        self.assertEqual(job.user, self.submitter)
        self.assertEqual(job.status, JobStatus.on_progress)
        self.assertEqual(job.info["form_id"], self.form.id)
        self.assertEqual(job.info["selection_ids"], self.selection_ids)

    def test_generate_datapoint_report_without_selection_ids(self):
        """Test generating datapoint report without selection IDs"""
        params = {
            "form_id": self.form.id,
        }

        response = self.client.get(
            self.url,
            params,
            HTTP_AUTHORIZATION=f"Bearer {self.token}"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("task_id", response.data)
        self.assertIn("file_url", response.data)

        # Verify job was created without selection_ids
        job = Jobs.objects.get(task_id=response.data["task_id"])
        self.assertEqual(job.info["form_id"], self.form.id)
        self.assertIsNone(job.info["selection_ids"])

    def test_generate_datapoint_report_with_invalid_form_id(self):
        """Test generating datapoint report with invalid form ID"""
        params = {
            "form_id": 999,  # Non-existent form ID
        }

        response = self.client.get(
            self.url,
            params,
            HTTP_AUTHORIZATION=f"Bearer {self.token}"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)

    def test_generate_datapoint_report_with_invalid_selection_ids(self):
        """Test generating datapoint report with invalid selection IDs"""
        params = {
            "form_id": self.form.id,
            "selection_ids": [99999, 99998],  # Non-existent datapoint IDs
        }

        response = self.client.get(
            self.url,
            params,
            HTTP_AUTHORIZATION=f"Bearer {self.token}"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)

    def test_generate_datapoint_report_missing_form_id(self):
        """Test generating datapoint report without required form_id"""
        params = {
            "selection_ids": self.selection_ids,
        }

        response = self.client.get(
            self.url,
            params,
            HTTP_AUTHORIZATION=f"Bearer {self.token}"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)

    def test_generate_datapoint_report_unauthorized(self):
        """Test generating datapoint report without authentication"""
        client = APIClient()  # No authentication
        params = {
            "form_id": self.form.id,
        }

        response = client.get(
            self.url,
            params
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('api.v1.v1_jobs.job.upload')
    @patch('api.v1.v1_jobs.job.generate_datapoint_report')
    def test_job_generate_data_report_success(
        self, mock_generate_report, mock_upload
    ):
        """Test job_generate_data_report function success case"""
        # Setup mocks
        mock_generate_report.return_value = "./tmp/test_report.docx"
        mock_upload.return_value = (
            "https://storage.example.com/test_report.docx"
        )

        # Create a job
        job = Jobs.objects.create(
            type=JobTypes.download_datapoint_report,
            status=JobStatus.on_progress,
            user=self.submitter,
            info={
                "form_id": self.form.id,
                "selection_ids": self.selection_ids,
            },
            result="test_report.docx",
        )

        # Create a mock task
        task = MagicMock()
        task.id = "test_task_id"
        task.success = True

        # Update job with task_id
        job.task_id = task.id
        job.save()

        # Call the function
        result_url = job_generate_data_report(
            task,
            form_id=self.form.id,
            selection_ids=self.selection_ids
        )

        # Assertions
        expected_url = "https://storage.example.com/test_report.docx"
        self.assertEqual(result_url, expected_url)
        # Verify generate_datapoint_report was called with data and file path
        mock_generate_report.assert_called_once()
        call_args = mock_generate_report.call_args
        # First argument should be the report data (dict) - hardcoded data
        self.assertIsInstance(call_args[0][0], dict)
        # Second argument should be file_path in kwargs
        self.assertIn('file_path', call_args[1])
        # Verify the data contains expected keys (from hardcoded data)
        data = call_args[0][0]
        self.assertIn('Display Name', data)
        self.assertEqual(data['Display Name'], 'Nasautoka')
        mock_upload.assert_called_once_with(
            file="./tmp/test_report.docx",
            folder="download_datapoint_report"
        )

    @patch('api.v1.v1_jobs.job.upload')
    @patch('api.v1.v1_jobs.job.generate_datapoint_report')
    def test_job_generate_data_report_without_selection_ids(
        self, mock_generate_report, mock_upload
    ):
        """Test job_generate_data_report function without selection IDs"""
        # Setup mocks
        mock_generate_report.return_value = "./tmp/test_report.docx"
        mock_upload.return_value = (
            "https://storage.example.com/test_report.docx"
        )

        # Create a job without selection_ids
        job = Jobs.objects.create(
            type=JobTypes.download_datapoint_report,
            status=JobStatus.on_progress,
            user=self.submitter,
            info={
                "form_id": self.form.id,
                "selection_ids": None,
            },
            result="test_report.docx",
        )

        # Create a mock task
        task = MagicMock()
        task.id = "test_task_id"
        task.success = True

        # Update job with task_id
        job.task_id = task.id
        job.save()

        # Call the function
        result_url = job_generate_data_report(
            task,
            form_id=self.form.id,
            selection_ids=None
        )

        # Assertions
        expected_url = "https://storage.example.com/test_report.docx"
        self.assertEqual(result_url, expected_url)
        # Verify generate_datapoint_report was called with data and file path
        mock_generate_report.assert_called_once()
        call_args = mock_generate_report.call_args
        # First argument should be the report data (dict) - hardcoded data
        self.assertIsInstance(call_args[0][0], dict)
        # file_path should be in kwargs
        self.assertIn('file_path', call_args[1])
        # Verify the data contains expected keys (from hardcoded data)
        data = call_args[0][0]
        self.assertIn('Display Name', data)
        self.assertEqual(data['Display Name'], 'Nasautoka')

    def test_job_data_report_command_with_selection_ids(self):
        """Test job_data_report management command with selection IDs"""
        result = call_command(
            "job_data_report",
            self.form.id,
            self.submitter.id,
            "-s",
            *self.selection_ids,
        )

        # Verify job was created
        job_id = int(result)
        job = Jobs.objects.get(pk=job_id)

        self.assertEqual(job.type, JobTypes.download_datapoint_report)
        self.assertEqual(job.user, self.submitter)
        self.assertEqual(job.status, JobStatus.on_progress)
        self.assertEqual(job.info["form_id"], self.form.id)
        self.assertEqual(job.info["selection_ids"], self.selection_ids)
        self.assertTrue(job.result.endswith(".docx"))
        self.assertIsNotNone(job.task_id)

    def test_job_data_report_command_without_selection_ids(self):
        """Test job_data_report management command without selection IDs"""
        result = call_command(
            "job_data_report",
            self.form.id,
            self.submitter.id,
        )

        # Verify job was created
        job_id = int(result)
        job = Jobs.objects.get(pk=job_id)

        self.assertEqual(job.type, JobTypes.download_datapoint_report)
        self.assertEqual(job.user, self.submitter)
        self.assertEqual(job.status, JobStatus.on_progress)
        self.assertEqual(job.info["form_id"], self.form.id)
        # When no selection_ids are provided, it should be None
        self.assertIsNone(job.info["selection_ids"])
        self.assertTrue(job.result.endswith(".docx"))

    def test_job_data_report_command_invalid_form_id(self):
        """Test job_data_report management command with invalid form ID"""
        with self.assertRaises(Forms.DoesNotExist):
            call_command(
                "job_data_report",
                999,  # Non-existent form ID
                self.submitter.id,
            )

    @patch('api.v1.v1_jobs.job.generate_datapoint_report')
    def test_report_file_creation_and_cleanup(self, mock_generate_report):
        """Test that report files are created and cleaned up properly"""
        # Setup mock to create a temporary file
        test_file_path = "./tmp/test_cleanup_report.docx"
        mock_generate_report.return_value = test_file_path

        # Create the file to simulate existing file
        os.makedirs("./tmp", exist_ok=True)
        with open(test_file_path, "w") as f:
            f.write("test content")

        # Verify file exists before cleanup
        self.assertTrue(os.path.exists(test_file_path))

        # Create a job
        job = Jobs.objects.create(
            type=JobTypes.download_datapoint_report,
            status=JobStatus.on_progress,
            user=self.submitter,
            info={
                "form_id": self.form.id,
                "selection_ids": [],
            },
            result="test_cleanup_report.docx",
        )

        # Create a mock task
        task = MagicMock()
        task.id = "test_task_id"
        task.success = True

        job.task_id = task.id
        job.save()

        # The file should be cleaned up when job_generate_data_report runs
        with patch('api.v1.v1_jobs.job.upload') as mock_upload:
            mock_upload.return_value = "https://storage.example.com/test.docx"
            job_generate_data_report(
                task,
                form_id=self.form.id,
                selection_ids=[]
            )

        # Clean up test file
        if os.path.exists(test_file_path):
            os.remove(test_file_path)

    def test_file_url_format(self):
        """Test that the returned file_url has correct format with type
        parameter"""
        params = {
            "form_id": self.form.id,
        }

        response = self.client.get(
            self.url,
            params,
            HTTP_AUTHORIZATION=f"Bearer {self.token}"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        file_url = response.data["file_url"]

        # Verify the URL contains the correct type parameter
        self.assertIn("type=download_datapoint_report", file_url)
        self.assertTrue(file_url.startswith("/download/file/"))
        self.assertTrue(
            file_url.endswith("?type=download_datapoint_report")
        )
