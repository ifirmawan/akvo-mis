# import pandas as pd
from django.core.management import BaseCommand, call_command
from faker import Faker

from api.v1.v1_data.models import FormData
from api.v1.v1_data.functions import add_fake_answers
from api.v1.v1_approval.functions import create_batch_with_approvals

fake = Faker()


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument(
            "-r", "--repeat", nargs="?", const=20, default=20, type=int
        )
        parser.add_argument(
            "-t", "--test", nargs="?", const=False, default=False, type=bool
        )
        parser.add_argument(
            "-a",
            "--approved",
            nargs="?",
            const=False,
            default=False,
            type=bool,
        )

    def handle(self, *args, **options):
        test = options.get("test")
        repeat = options.get("repeat")
        approved = options.get("approved")
        is_pending = not approved

        if test:
            # Call fake_data_seeder with test=True
            call_command(
                "fake_data_seeder",
                repeat=repeat,
                test=True,
                approved=True,
            )

        data = FormData.objects.filter(
            is_pending=False,
            form__parent__isnull=True,
        ).all()[:repeat]

        for d in data:
            items = []
            for f in d.form.children.all():
                # random date
                created = fake.date_time_this_decade()
                # format Y-m-d H:M:S
                created = created.strftime("%Y-%m-%d %H:%M:%S")
                monitoring_data = FormData.objects.create(
                    parent=d,
                    name=f"{created} - {d.name}",
                    form=f,
                    created=created,
                    created_by=d.created_by,
                    administration=d.administration,
                    geo=d.geo,
                    uuid=d.uuid,
                    is_pending=is_pending,
                )
                add_fake_answers(monitoring_data)
                items.append(monitoring_data)

            if (
                d.has_approval and
                not approved
            ):
                for i in items:
                    i.is_pending = True
                    i.save()

            if d.has_approval and items and not is_pending:
                # Create batch with approvals for monitoring data
                create_batch_with_approvals(
                    data_items=items,
                    user=d.created_by,
                    administration=d.administration,
                    approved_flag=approved,
                    batch_size=len(items)
                )
