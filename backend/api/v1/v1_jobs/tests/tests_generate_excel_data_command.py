from io import StringIO
from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings
from api.v1.v1_forms.models import Forms
from api.v1.v1_jobs.management.commands.generate_excel_data import (
    CRONJOB_RESULT_DIR,
)
from utils import storage


@override_settings(USE_TZ=False)
class JobGenerateExcelDataCommand(TestCase):
    def call_command(self, *args, **kwargs):
        out = StringIO()
        call_command(
            "fake_complete_data_seeder",
            "--test=true",
            *args,
            stdout=out,
            stderr=StringIO(),
            **kwargs,
        )
        return out.getvalue()

    def setUp(self):
        call_command("administration_seeder", "--test")
        call_command("form_seeder", "--test")
        call_command("default_roles_seeder", "--test", 1)
        user = {"email": "admin@akvo.org", "password": "Test105*"}
        user = self.client.post(
            "/api/v1/login", user, content_type="application/json"
        )
        self.call_command("-r", 2)

    def test_download_all_data(self):
        form = Forms.objects.get(pk=1)

        output = StringIO()
        # Test download all data
        call_command(
            "generate_excel_data",
            form.id,
            stdout=output,
            stderr=StringIO(),
        )
        self.assertIn("File uploaded to", output.getvalue())

        form_name = form.name.replace(" ", "_").lower()
        result_file = f"{CRONJOB_RESULT_DIR}/{form_name}.xlsx"
        self.assertTrue(storage.check(result_file))
        storage.delete(result_file)

    def test_download_with_child_form(self):
        form = Forms.objects.get(pk=1)
        child_form = form.children.first()
        output = StringIO()
        # Test download all data
        call_command(
            "generate_excel_data",
            child_form.id,
            stdout=output,
            stderr=StringIO(),
        )
        self.assertIn("Please use form registration id", output.getvalue())

    def test_download_with_invalid_form_id(self):
        with self.assertRaisesMessage(
            Forms.DoesNotExist,
            "Forms matching query does not exist"
        ):
            output = StringIO()
            call_command(
                "generate_excel_data",
                form_id=999,
                stdout=output,
                stderr=StringIO(),
            )
            self.assertIn("Form id is required", output.getvalue())

    def test_download_with_no_form_id(self):
        output = StringIO()
        call_command(
            "generate_excel_data",
            stdout=output,
            stderr=StringIO(),
        )
        self.assertIn("Form id is required", output.getvalue())
