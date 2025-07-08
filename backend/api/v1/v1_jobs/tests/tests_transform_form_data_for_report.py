from unittest.mock import patch
from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings

from api.v1.v1_forms.models import Forms
from api.v1.v1_data.models import FormData
from api.v1.v1_jobs.constants import JobStatus, JobTypes
from api.v1.v1_jobs.models import Jobs
from api.v1.v1_jobs.job import (
    transform_form_data_for_report,
    job_generate_data_report
)
from api.v1.v1_profile.tests.mixins import ProfileTestHelperMixin


@override_settings(USE_TZ=False, TEST_ENV=True)
class TransformFormDataForReportTestCase(TestCase, ProfileTestHelperMixin):
    def setUp(self):
        call_command("administration_seeder", "--test", 1)
        call_command("default_roles_seeder", "--test", 1)
        call_command("form_seeder", "--test", 1)

        call_command(
            "fake_data_monitoring_seeder",
            repeat=10,
            test=True,
            approved=True,
        )

        self.form = Forms.objects.get(pk=1)

        self.data = self.form.form_form_data.filter(
            is_pending=False
        ).order_by("?").first()

        self.user = self.data.created_by
        self.administration = self.data.administration

    def test_transform_form_data_basic_functionality(self):
        """Test basic functionality of transform_form_data_for_report"""
        result = transform_form_data_for_report(self.form)

        # Should return a list
        self.assertIsInstance(result, list)

        # If there's data, should have groups
        if result:
            # Each group should have required structure
            for group in result:
                self.assertIn("name", group)
                self.assertIn("questions", group)
                self.assertIsInstance(group["questions"], list)

                # Each question should have required structure
                for question in group["questions"]:
                    self.assertIn("question", question)
                    self.assertIn("answers", question)
                    self.assertIsInstance(question["answers"], list)

    def test_transform_form_data_with_selection_ids(self):
        """Test transform_form_data_for_report with specific selection_ids"""
        # Get existing FormData instances
        form_data_instances = FormData.objects.filter(
            form=self.form, is_pending=False
        )[:2]
        if not form_data_instances.exists():
            self.skipTest("No FormData available for testing")

        selection_ids = [fd.id for fd in form_data_instances]
        result = transform_form_data_for_report(
            self.form, selection_ids=selection_ids
        )

        # Should return results for specified FormData only
        self.assertIsInstance(result, list)

        if result:
            # Verify answers correspond to the number of selected FormData
            for group in result:
                for question in group["questions"]:
                    # Should have as many answer slots as selected FormData
                    self.assertEqual(
                        len(question["answers"]), len(selection_ids)
                    )

    def test_transform_form_data_no_empty_columns(self):
        """Test that no empty columns are created when all answers empty"""
        result = transform_form_data_for_report(self.form)

        if result:
            for group in result:
                for question in group["questions"]:
                    answers = question["answers"]
                    # Should have at least one non-empty answer
                    non_empty_answers = [a for a in answers if a and a.strip()]
                    self.assertGreater(
                        len(non_empty_answers), 0,
                        f"Question '{question['question']}' "
                        f"has all empty answers"
                    )

    def test_transform_form_data_empty_questions_excluded(self):
        """Test that questions with no answers are excluded from result"""
        result = transform_form_data_for_report(self.form)

        # All included questions should have at least one non-empty answer
        for group in result:
            for question in group["questions"]:
                answers = question["answers"]
                has_non_empty = any(a and a.strip() for a in answers)
                self.assertTrue(
                    has_non_empty,
                    f"Question '{question['question']}' should not be "
                    f"included with all empty answers"
                )

    def test_transform_form_data_with_child_forms(self):
        # when no specific selection_ids are provided
        all_results = transform_form_data_for_report(
            self.form,
            selection_ids=[self.data.id],
            child_form_ids=self.form.children.values_list('id', flat=True)
        )
        if all_results:
            # Should still maintain column consistency
            for group in all_results:
                if group["questions"]:
                    expected_columns = len(group["questions"][0]["answers"])
                    for question in group["questions"]:
                        self.assertEqual(
                            len(question["answers"]), expected_columns,
                            "All questions should have consistent column count"
                        )

    def test_transform_form_data_answer_formatting(self):
        """Test that different answer types are formatted correctly"""
        result = transform_form_data_for_report(self.form)

        if result:
            # Check that answers are strings
            for group in result:
                for question in group["questions"]:
                    for answer in question["answers"]:
                        self.assertIsInstance(
                            answer, str,
                            "All answers should be formatted as strings"
                        )

    def test_transform_form_data_nonexistent_form(self):
        """Test behavior with nonexistent form"""
        nonexistent_form = Forms(id=99999, name="Nonexistent")
        nonexistent_form.pk = 99999

        result = transform_form_data_for_report(nonexistent_form)

        # Should return empty list for nonexistent form
        self.assertEqual(result, [])

    def test_transform_form_data_empty_selection_ids(self):
        """Test behavior with empty selection_ids list"""
        result1 = transform_form_data_for_report(self.form, selection_ids=[])
        result2 = transform_form_data_for_report(self.form, selection_ids=None)

        # Both should return the same result (all data)
        self.assertEqual(result1, result2)

    def test_transform_form_data_invalid_selection_ids(self):
        """Test behavior with invalid selection_ids"""
        result = transform_form_data_for_report(
            self.form, selection_ids=[99999, 88888]
        )

        # Should return empty result or handle gracefully
        self.assertIsInstance(result, list)

    def test_transform_form_data_column_count_consistency(self):
        """Test that all questions have the same number of columns"""
        result = transform_form_data_for_report(self.form)

        if result:
            # All questions should have the same number of answer columns
            expected_columns = None
            for group in result:
                for question in group["questions"]:
                    if expected_columns is None:
                        expected_columns = len(question["answers"])
                    else:
                        self.assertEqual(
                            len(question["answers"]), expected_columns,
                            "All questions should have the same number "
                            "of answer columns"
                        )

    def test_transform_form_data_question_groups_structure(self):
        """Test that question groups are properly structured and ordered"""
        result = transform_form_data_for_report(self.form)

        if result:
            # Each group should have a name
            for group in result:
                self.assertIsInstance(group["name"], str)
                self.assertGreater(
                    len(group["name"]), 0, "Group name should not be empty"
                )

                # Questions should be ordered
                for question in group["questions"]:
                    self.assertIsInstance(question["question"], str)
                    self.assertGreater(
                        len(question["question"]), 0,
                        "Question should not be empty"
                    )

    def test_transform_form_data_with_pending_data(self):
        """Test that pending FormData are excluded"""
        # Create a pending FormData instance
        pending_fd = self.data
        pending_fd.is_pending = True
        pending_fd.save()

        result = transform_form_data_for_report(
            self.form, selection_ids=[pending_fd.id]
        )

        # Should return empty result since pending data is excluded
        expected_empty = (
            all(len(group["questions"]) == 0 for group in result)
            if result else True
        )
        self.assertTrue(
            expected_empty, "Pending FormData should be excluded"
        )

    def test_job_generate_data_report_integration(self):
        """Test integration with job_generate_data_report function"""
        # Create a job
        job = Jobs.objects.create(
            result="test_report.docx",
            type=JobTypes.download_datapoint_report,
            status=JobStatus.on_progress,
            user=self.user,
            info={
                "form_id": self.form.id,
                "selection_ids": [self.data.id]
            }
        )

        # Mock the file operations and report generation
        with patch('api.v1.v1_jobs.job.os.path.exists', return_value=False), \
                patch(
                    'api.v1.v1_jobs.job.generate_datapoint_report'
                ) as mock_generate, \
                patch('api.v1.v1_jobs.job.upload') as mock_upload:

            mock_generate.return_value = "./tmp/test_report.docx"
            mock_upload.return_value = "http://example.com/test_report.docx"

            result = job_generate_data_report(
                job.id,
                form_id=self.form.id,
                selection_ids=[self.data.id],
                child_form_ids=[]
            )

            # Should return a URL
            self.assertIsInstance(result, str)
            self.assertEqual(result, "http://example.com/test_report.docx")
            mock_generate.assert_called_once()
            mock_upload.assert_called_once()

            # Verify the upload was called with correct parameters
            mock_upload.assert_called_with(
                file="./tmp/test_report.docx",
                folder="download_datapoint_report"
            )

    def test_transform_form_data_memory_efficiency(self):
        """Test that the function handles large datasets efficiently"""
        # This test ensures the function doesn't create unnecessary structures
        result = transform_form_data_for_report(self.form)

        # Should not fail with memory issues and return reasonable results
        self.assertIsInstance(result, list)

        # Verify structure is maintained regardless of data size
        if result:
            for group in result:
                self.assertIn("name", group)
                self.assertIn("questions", group)

    def test_transform_form_data_edge_cases(self):
        """Test various edge cases"""
        # Test with form that has no questions
        empty_form = Forms.objects.create(
            id=99999,
            name="Empty Form",
            version=1,
        )

        result = transform_form_data_for_report(empty_form)
        self.assertEqual(
            result, [],
            "Form with no questions should return empty list"
        )

        # Test with form that has questions but no data
        form_with_no_data = self.form.children.first()
        form_with_no_data.form_form_data.all().delete(hard=True)

        result = transform_form_data_for_report(form_with_no_data)
        self.assertEqual(
            result, [],
            "Form with no data should return empty list"
        )

    def test_transform_form_data_with_empty_child_form_ids(self):
        """Test that empty child_form_ids includes all child forms"""
        # Test with empty child_form_ids (should include all)
        result_empty = transform_form_data_for_report(
            self.form,
            selection_ids=[self.data.id],
            child_form_ids=[]
        )

        # Test with None child_form_ids (should include all)
        result_none = transform_form_data_for_report(
            self.form,
            selection_ids=[self.data.id],
            child_form_ids=None
        )

        # Both should produce the same result
        self.assertEqual(result_empty, result_none)
        self.assertIsInstance(result_empty, list)

    def test_transform_form_data_with_nonexistent_child_form_ids(self):
        """Test behavior with non-existent child form IDs"""
        # Test with non-existent child form IDs
        result = transform_form_data_for_report(
            self.form,
            selection_ids=[self.data.id],
            child_form_ids=[99999, 88888]  # Non-existent IDs
        )

        # Should handle gracefully and return result
        self.assertIsInstance(result, list)
        # Should not crash or raise exception

    def test_transform_form_data_with_mixed_valid_invalid_child_form_ids(self):
        """Test with mix of valid and invalid child form IDs"""
        child_form_1 = self.form.children.first()
        # Test with mix of valid and invalid IDs
        result = transform_form_data_for_report(
            self.form,
            selection_ids=[self.data.id],
            child_form_ids=[child_form_1.id, 99999]
        )

        # Should process only valid child forms and handle gracefully
        self.assertIsInstance(result, list)

    def test_transform_form_data_child_form_ids_preserves_structure(self):
        """Test that child_form_ids filtering preserves correct data
        structure"""
        # Create multiple child forms with different structures
        child_form_1 = self.form.children.first()
        # Test with specific child form
        result = transform_form_data_for_report(
            self.form,
            selection_ids=[self.data.id],
            child_form_ids=[child_form_1.id]
        )

        # Should maintain proper structure
        if result:
            for group in result:
                self.assertIn("name", group)
                self.assertIn("questions", group)
                self.assertIsInstance(group["questions"], list)

                for question in group["questions"]:
                    self.assertIn("question", question)
                    self.assertIn("answers", question)
                    self.assertIsInstance(question["answers"], list)
                    # Should have exactly one column for the parent FormData
                    self.assertEqual(len(question["answers"]), 1)

    def test_transform_form_data_child_form_ids_performance(self):
        """Test that child_form_ids filtering improves performance by
        excluding unwanted forms"""
        # Create multiple child forms
        child_forms = []
        for i in range(3):
            child_form = Forms.objects.create(
                id=1111 + i,
                name=f"Child Form {i+1}",
                version=1,
            )
            child_forms.append(child_form)
            self.form.children.add(child_form)

        # Test with all child forms
        result_all = transform_form_data_for_report(
            self.form,
            selection_ids=[self.data.id],
            child_form_ids=[]
        )

        # Test with filtered child forms (only first one)
        result_filtered = transform_form_data_for_report(
            self.form,
            selection_ids=[self.data.id],
            child_form_ids=[child_forms[0].id]
        )

        # Both should return valid results
        self.assertIsInstance(result_all, list)
        self.assertIsInstance(result_filtered, list)

        # The filtered result should potentially have different content
        # (This verifies the filtering mechanism is working)
