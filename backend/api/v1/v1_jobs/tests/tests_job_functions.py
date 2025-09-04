import numpy as np
from unittest.mock import patch, MagicMock
from django.core.management import call_command
from django.test import TestCase, override_settings
from api.v1.v1_forms.models import Forms, QuestionTypes
from api.v1.v1_jobs.job import (
    get_answer_label,
    job_generate_data_download,
    job_generate_data_download_result,
)
from api.v1.v1_jobs.models import Jobs
from api.v1.v1_jobs.constants import JobStatus, JobTypes
from api.v1.v1_profile.models import Administration
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin


@override_settings(USE_TZ=False)
class TestJobsFunctions(TestCase, ProfileTestHelperMixin):
    def setUp(self):
        self.test_folder = "api/v1/v1_jobs/tests/fixtures"
        call_command("form_seeder", "--test", 1)
        call_command("administration_seeder", "--test")
        call_command("default_roles_seeder", "--test", 1)
        self.form = Forms.objects.get(pk=1)
        self.administration = Administration.objects\
            .filter(level__level=3).order_by('?').first()
        self.user = self.create_user(
            email="user@example.com",
            role_level=self.IS_ADMIN,
            administration=self.administration,
            form=self.form,
        )

    def test_get_answer_label(self):
        option_q = self.form.form_questions.filter(
            type=QuestionTypes.option
        ).first()
        answer_values = "male"
        expected_label = "Male"
        result = get_answer_label(
            answer_values=answer_values, question_id=option_q.id
        )
        self.assertEqual(result, expected_label)

        multiple_q = self.form.form_questions.filter(
            type=QuestionTypes.multiple_option
        ).first()

        answer_values = "wife__husband__partner|children"
        expected_label = "Wife / Husband / Partner|Children"
        result = get_answer_label(
            answer_values=answer_values, question_id=multiple_q.id
        )
        self.assertEqual(result, expected_label)

    def test_get_answer_label_is_none_or_NAN(self):
        option_q = self.form.form_questions.filter(
            type=QuestionTypes.option
        ).first()
        answer_values = None
        result = get_answer_label(
            answer_values=answer_values, question_id=option_q.id
        )
        self.assertEqual(result, answer_values)

        answer_values = np.nan
        result = get_answer_label(
            answer_values=answer_values, question_id=option_q.id
        )
        self.assertTrue(np.isnan(result))

    def test_job_generate_data_download(self):
        """Test job_generate_data_download function with proper job setup"""
        # Create a job first
        child_forms = self.form.children.all()[:1]
        job = Jobs.objects.create(
            type=JobTypes.download,
            status=JobStatus.on_progress,
            user=self.user,
            info={
                "form_id": self.form.id,
                "child_form_ids": list(
                    child_forms.values_list("id", flat=True)
                ),
            },
            result="test-download.xlsx",
        )

        # Mock the file operations and upload function
        with patch(
            "api.v1.v1_jobs.job.os.path.exists", return_value=False
        ), patch("api.v1.v1_jobs.job.upload") as mock_upload:

            expected_url = "https://storage.example.com/test-download.xlsx"
            mock_upload.return_value = expected_url

            # Call the function with job ID and kwargs
            result_url = job_generate_data_download(
                job_id=job.id
            )

            # Verify the result
            self.assertIsNotNone(result_url)
            self.assertEqual(result_url, expected_url)
            mock_upload.assert_called_once()

    def test_job_generate_data_download_with_administration(self):
        """Test job_generate_data_download with administration filter"""
        # Create a job with administration filter
        child_forms = self.form.children.all()[:1]
        job = Jobs.objects.create(
            type=JobTypes.download,
            status=JobStatus.on_progress,
            user=self.user,
            info={
                "form_id": self.form.id,
                "administration": self.administration.id,
                "child_form_ids": list(
                    child_forms.values_list("id", flat=True)
                ),
            },
            result="test-download-admin.xlsx",
        )

        # Mock the dependencies
        with patch(
            "api.v1.v1_jobs.job.os.path.exists", return_value=False
        ), patch("api.v1.v1_jobs.job.upload") as mock_upload, patch(
            "api.v1.v1_profile.models.Administration.objects.get"
        ) as mock_admin_get, patch(
            "api.v1.v1_profile.models.Administration.objects.filter"
        ) as mock_admin_filter:

            # Setup mocks
            mock_admin = MagicMock()
            mock_admin.id = 1
            mock_admin.path = "1."
            mock_admin_get.return_value = mock_admin

            # Setup the filter mock to return proper values
            # First call returns IDs, second call returns names
            mock_admin_filter.return_value.values_list.side_effect = [
                [1, 2, 3],  # For IDs
                ["Admin 1", "Admin 2", "Admin 3"],  # For names
            ]

            expected_url = "https://storage.example.com/test-admin.xlsx"
            mock_upload.return_value = expected_url

            # Call the function with administration
            result_url = job_generate_data_download(
                job_id=job.id, administration=1
            )

            # Verify the result
            self.assertIsNotNone(result_url)
            self.assertEqual(result_url, expected_url)

    def test_job_generate_data_download_result_success(self):
        """Test job_generate_data_download_result with successful task"""
        # Create a job
        job = Jobs.objects.create(
            type=JobTypes.download,
            status=JobStatus.on_progress,
            user=self.user,
            info={"form_id": self.form.id},
            result="test-result.xlsx",
            task_id="test-task-123",
            attempt=0,
        )

        # Create a mock successful task
        task = MagicMock()
        task.id = "test-task-123"
        task.success = True

        # Call the result function
        job_generate_data_download_result(task)

        # Refresh job from database
        job.refresh_from_db()

        # Verify the job status was updated
        self.assertEqual(job.status, JobStatus.done)
        self.assertEqual(job.attempt, 1)
        self.assertIsNotNone(job.available)

    def test_job_generate_data_download_result_failure(self):
        """Test job_generate_data_download_result with failed task"""
        # Create a job
        job = Jobs.objects.create(
            type=JobTypes.download,
            status=JobStatus.on_progress,
            user=self.user,
            info={"form_id": self.form.id},
            result="test-result-fail.xlsx",
            task_id="test-task-456",
            attempt=1,
        )

        # Create a mock failed task
        task = MagicMock()
        task.id = "test-task-456"
        task.success = False

        # Call the result function
        job_generate_data_download_result(task)

        # Refresh job from database
        job.refresh_from_db()

        # Verify the job status was updated
        self.assertEqual(job.status, JobStatus.failed)
        self.assertEqual(job.attempt, 2)
        self.assertIsNone(job.available)
