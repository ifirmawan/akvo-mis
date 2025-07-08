import uuid

from django.core.management import BaseCommand
from django.utils import timezone
from django_q.tasks import async_task

from api.v1.v1_forms.models import Forms
from api.v1.v1_jobs.constants import JobTypes, JobStatus
from api.v1.v1_jobs.models import Jobs


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument("form", nargs="+", type=int)
        parser.add_argument("user", nargs="+", type=int)
        parser.add_argument(
            "-s", "--selection_ids", nargs="*", default=[], type=int
        )
        parser.add_argument(
            "-c", "--child_form_ids", nargs="*", default=[], type=int
        )

    def handle(self, *args, **options):
        selection_ids = options.get("selection_ids", [])
        info = {
            "form_id": options.get("form")[0],
            "selection_ids": selection_ids if selection_ids else None,
            "child_form_ids": options.get("child_form_ids", []),
        }
        form = Forms.objects.get(pk=options.get("form")[0])
        form_name = form.name.replace(" ", "_").lower()
        today = timezone.datetime.today().strftime("%y%m%d")
        out_file = "datapoint-report-{0}-{1}-{2}.docx".format(
            form_name, today, uuid.uuid4()
        )
        job = Jobs.objects.create(
            type=JobTypes.download_datapoint_report,
            user_id=options.get("user")[0],
            status=JobStatus.on_progress,
            info=info,
            result=out_file,
        )
        task_id = async_task(
            "api.v1.v1_jobs.job.job_generate_data_report",
            job.id,
            **info,
            task_name="datapoint_report_generation",
            hook="api.v1.v1_jobs.job.job_generate_data_download_result"
        )
        job.task_id = task_id
        job.save()
        return str(job.id)
