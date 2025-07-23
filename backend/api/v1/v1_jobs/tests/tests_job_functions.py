import unittest
import numpy as np
from django.core.management import call_command
from api.v1.v1_forms.models import Forms, QuestionTypes
from api.v1.v1_jobs.job import get_answer_label


class TestJobsFunctions(unittest.TestCase):
    def setUp(self):
        self.test_folder = "api/v1/v1_jobs/tests/fixtures"
        call_command("form_seeder", "--test", 1)
        self.form = Forms.objects.get(pk=1)

    def test_get_answer_label(self):
        option_q = self.form.form_questions.filter(
            type=QuestionTypes.option
        ).first()
        answer_values = "male"
        expected_label = "Male"
        result = get_answer_label(
            answer_values=answer_values,
            question_id=option_q.id
        )
        self.assertEqual(result, expected_label)

        multiple_q = self.form.form_questions.filter(
            type=QuestionTypes.multiple_option
        ).first()

        answer_values = "wife__husband__partner|children"
        expected_label = "Wife / Husband / Partner|Children"
        result = get_answer_label(
            answer_values=answer_values,
            question_id=multiple_q.id
        )
        self.assertEqual(result, expected_label)

    def test_get_answer_label_is_none_or_NAN(self):
        option_q = self.form.form_questions.filter(
            type=QuestionTypes.option
        ).first()
        answer_values = None
        result = get_answer_label(
            answer_values=answer_values,
            question_id=option_q.id
        )
        self.assertEqual(result, answer_values)

        answer_values = np.nan
        result = get_answer_label(
            answer_values=answer_values,
            question_id=option_q.id
        )
        self.assertTrue(np.isnan(result))
