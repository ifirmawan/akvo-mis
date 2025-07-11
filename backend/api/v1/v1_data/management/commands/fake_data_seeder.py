import pandas as pd
from datetime import datetime, timedelta, time

from django.core.management import call_command, BaseCommand
from django.utils.timezone import make_aware
from django.db.models import Q
from faker import Faker

from mis.settings import COUNTRY_NAME
from api.v1.v1_data.models import FormData
from api.v1.v1_data.functions import add_fake_answers
from api.v1.v1_approval.functions import create_batch_with_approvals
from api.v1.v1_forms.models import Forms
from api.v1.v1_profile.models import Administration, DataAccessTypes
from api.v1.v1_users.models import SystemUser

fake = Faker()


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument(
            "-r", "--repeat", nargs="?", const=5, default=5, type=int
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
        parser.add_argument(
            "-d",
            "--draft",
            nargs="?",
            const=False,
            default=False,
            type=bool,
        )

    def handle(self, *args, **options):
        test = options.get("test")
        repeat = options.get("repeat")
        approved = options.get("approved")
        draft = options.get("draft")
        if test:
            # Clear existing data
            FormData.objects.all().delete(hard=True)
            # Seed users
            call_command("fake_user_seeder", "--repeat", repeat, "--test", 1)

        fake_geo = pd.read_csv(
            f"./source/{COUNTRY_NAME}_random_points.csv"
        )
        fake_geo = fake_geo.sample(frac=1).reset_index(drop=True)
        now_date = datetime.now()
        start_date = now_date - timedelta(days=5 * 365)
        created = fake.date_between(start_date, now_date)
        created = datetime.combine(created, time.min)

        users = SystemUser.objects.filter(
            Q(is_superuser=True) |
            Q(
                user_user_role__role__role_role_access__data_access=(
                    DataAccessTypes.submit
                ),
                user_form__isnull=False  # Check that user has forms assigned
            )
        ).distinct().all()[:repeat]
        for user in users:
            forms = Forms.objects.filter(
                parent__isnull=True
            ).all()
            administration = Administration.objects \
                .order_by("?").first()
            if not user.is_superuser:
                user_role = user.user_user_role.filter(
                    role__role_role_access__data_access=DataAccessTypes.submit
                ).first()
                administration = user_role.administration
                forms = [
                    uf.form for uf in user.user_form.all()
                ]
            pending = []
            for i, form in enumerate(forms):
                # Check if the administration has a approver
                geo = fake_geo.iloc[i].to_dict()
                geo_value = [geo["X"], geo["Y"]]
                data = FormData.objects.create(
                    name=fake.pystr_format(),
                    geo=geo_value,
                    form=form,
                    administration=administration,
                    created_by=user,
                )
                data.created = make_aware(created)
                data.save()
                add_fake_answers(data)
                if data.has_approval:
                    data.is_pending = True
                    data.save()
                    pending.append(data)
                if not draft and not data.has_approval:
                    data.save_to_file
                if draft:
                    data.mark_as_draft()
            # Create batches for pending data using unified function
            if pending and approved:
                create_batch_with_approvals(
                    data_items=pending,
                    user=user,
                    administration=administration,
                    approved_flag=approved,
                    batch_size=5
                )
