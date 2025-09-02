import os
import pandas as pd
from django.core.management.base import BaseCommand

from api.v1.v1_forms.models import Forms
from api.v1.v1_jobs.job import generate_data_sheet
from utils.storage import upload

CRONJOB_RESULT_DIR = "cronjob_results"


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument("form_id", nargs="?", type=int)

    def handle(self, *args, **options):
        form_id = options.get("form_id")
        if not form_id:
            self.stdout.write(
                self.style.ERROR("Form id is required")
            )
            return
        form = Forms.objects.get(pk=form_id)
        if form.parent:
            self.stdout.write(
                self.style.ERROR("Please use form registration id")
            )
            return
        form_name = form.name.replace(" ", "_").lower()
        process_file = f"process-{form_name}.xlsx"
        writer = pd.ExcelWriter(process_file, engine="xlsxwriter")
        generate_data_sheet(
            writer=writer,
            form=form,
            child_form_ids=list(form.children.values_list("id", flat=True)),
        )
        writer.save()

        out_file = f"{form_name}.xlsx"

        url = upload(
            file=process_file, folder=CRONJOB_RESULT_DIR, filename=out_file
        )
        self.stdout.write(self.style.SUCCESS(f"File uploaded to {url}"))
        os.remove(process_file)
