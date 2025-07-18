import pandas as pd
from datetime import datetime, timedelta, time

from django.core.management import BaseCommand
from django.utils.timezone import make_aware
from django.db import transaction
from django.db.models import Max
from faker import Faker

from mis.settings import COUNTRY_NAME
from api.v1.v1_data.models import FormData
from api.v1.v1_data.functions import add_fake_answers
from api.v1.v1_forms.models import Forms
from api.v1.v1_profile.models import (
    Administration,
    DataAccessTypes,
    Levels,
    Role,
)
from api.v1.v1_users.models import SystemUser, Organisation
from api.v1.v1_mobile.models import MobileAssignment
from api.v1.v1_profile.constants import TEST_GEO_DATA

fake = Faker()

DEFAULT_PASSWORD = "Test#123"


def find_administration(name, level):
    if level < 0:
        return None
    adm = Administration.objects.filter(name=name, level__level=level).first()
    if adm is None:
        adm = find_administration(name, level - 1)
    return adm


def create_approver_user(
    administration: Administration,
    org: Organisation,
):
    da = DataAccessTypes.approve
    """Create a new approver user for the given administration."""
    adm_name = administration.name.lower().replace(" ", ".")
    fake_digit = fake.random_digit_not_null()
    approver = SystemUser.objects.create_user(
        email="approver.{0}{1}@test.com".format(
            adm_name, fake_digit
        ),
        first_name=fake.first_name(),
        last_name=fake.last_name(),
        phone_number=fake.phone_number()[:15],
        organisation=org,
    )
    approver.set_password(DEFAULT_PASSWORD)
    approver.save()
    # Assign all forms to the approver
    forms = Forms.objects.filter(parent__isnull=True).all()
    for form in forms:
        approver.user_form.create(form=form)
    approver.save()

    # Assign the approver to the administration
    role = Role.objects.filter(
        role_role_access__data_access=da,
        administration_level=administration.level,
    ).order_by("?").first()
    approver.user_user_role.create(
        role=role,
        administration=administration,
    )


def create_approvers_recursively(
    administration: Administration,
    org: Organisation,
    max_depth: int = 3,
    current_depth: int = 0,
):
    """
    Recursively create approver users for the given administration
    and its child administrations up to max_depth levels.
    """
    if current_depth >= max_depth:
        return
    # Create approver for current administration
    create_approver_user(administration=administration, org=org)
    # Recursively create approvers for child administrations
    if administration.parent_administration.exists():
        child_admin = administration.parent_administration\
            .order_by("?").first()
        create_approvers_recursively(
            administration=child_admin,
            org=org,
            max_depth=max_depth,
            current_depth=current_depth + 1,
        )


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument(
            "-r", "--repeat", nargs="?", const=5, default=5, type=int
        )
        parser.add_argument(
            "-m", "--monitoring", nargs="?", const=2, default=2, type=int
        )
        parser.add_argument(
            "--approved",
            type=lambda x: x.lower() in ('true', '1', 'yes', 'on'),
            default=True,
            help="Create approved data (true/false)",
        )
        parser.add_argument(
            "--draft",
            type=lambda x: x.lower() in ('true', '1', 'yes', 'on'),
            default=False,
            help="Create draft data (true/false)",
        )
        parser.add_argument(
            "--test",
            type=lambda x: x.lower() in ('true', '1', 'yes', 'on'),
            default=False,
            help="Use test data instead of CSV file (true/false)",
        )

    def handle(self, *args, **options):
        repeat = options.get("repeat")
        monitoring = options.get("monitoring", 1)
        is_approved = options.get("approved", True)
        is_draft = options.get("draft", False)
        is_test = options.get("test", False)
        csv_path = f"./source/{COUNTRY_NAME}_random_points.csv"
        fake_geo = pd.read_csv(csv_path)
        fake_geo = fake_geo.sample(frac=1).reset_index(drop=True)
        fake_geo_data = fake_geo.to_dict('records')
        if is_test:
            # Use static test data instead of CSV
            fake_geo_data = TEST_GEO_DATA
        now_date = datetime.now()
        start_date = now_date - timedelta(days=5 * 365)
        created = fake.date_between(start_date, now_date)
        created = datetime.combine(created, time.min)
        # total number of fake_geo points
        total_points = len(fake_geo_data)
        index = 0
        last_level_obj = Levels.objects.order_by("-level").first()
        last_level = last_level_obj.level if last_level_obj else 0

        da = DataAccessTypes.approve
        ds = DataAccessTypes.submit
        filter_submitter = {
            "user_user_role__role__role_role_access__data_access": ds,
        }
        filter_approver = {
            "user_user_role__role__role_role_access__data_access": da,
        }

        # Initialize counters for output messages
        form_data_counts = {}
        form_monitoring_counts = {}
        form_pending_counts = {}
        form_draft_counts = {}

        try:
            with transaction.atomic():
                for r in range(repeat):
                    if index >= total_points:
                        # reset the index if we run out of points
                        index = 0
                    geo = fake_geo_data[index]
                    geo_value = [geo["Y"], geo["X"]]
                    adm = find_administration(geo["name"], last_level)
                    # find or create a user
                    st = DataAccessTypes.submit
                    parent_adm = adm.ancestors.exclude(
                        parent__isnull=True
                    ).first()

                    # If no parent administration found, use the current one
                    if not parent_adm:
                        parent_adm = adm
                    org = Organisation.objects.order_by("?").first()
                    user = SystemUser.objects.filter(
                        **filter_submitter,
                        user_user_role__administration=parent_adm,
                    ).order_by("?").first()
                    if not user:
                        # create a new user
                        user = SystemUser.objects.create_user(
                            email=f"{fake.user_name()}@test.com",
                            first_name=fake.first_name(),
                            last_name=fake.last_name(),
                            phone_number=fake.phone_number()[:15],
                            organisation=org,
                        )
                        user.set_password(DEFAULT_PASSWORD)

                        role = Role.objects.filter(
                            role_role_access__data_access=st,
                        ).order_by("?").first()
                        user.user_user_role.create(
                            role=role,
                            administration=parent_adm,
                        )

                    if not user.user_form.exists():
                        # Assign all forms to the user
                        forms = Forms.objects.filter(
                            parent__isnull=True
                        ).all()
                        for form in forms:
                            user.user_form.create(form=form)
                        user.save()
                    # Submitter
                    p = f"{parent_adm.path}{parent_adm.id}."
                    mobile_user = user.mobile_assignments \
                        .filter(
                            administrations__path__startswith=p
                        ) \
                        .order_by("?").first()
                    if not mobile_user:
                        uname = f"{adm.name.lower()}.{fake.user_name()}"
                        mobile_user = MobileAssignment.objects \
                            .create_assignment(
                                user=user,
                                name=uname,
                                passcode=fake.lexify('????????'),
                            )
                    # Assign child administrations to the mobile assignment
                    adm_children = parent_adm.parent_administration \
                        .order_by("?").first()
                    mobile_user.administrations.set(
                        adm_children.parent_administration.all()
                    )
                    # Assign form to the mobile assignment
                    mobile_user.forms.set(
                        [
                            uf.form
                            for uf in user.user_form.all()
                        ]
                    )
                    mobile_user.save()

                    if not is_approved:
                        # find approver user
                        approver = SystemUser.objects.filter(
                            **filter_approver,
                            user_user_role__administration=parent_adm,
                        ).order_by("?").first()
                        if not approver:
                            # Create approvers recursively
                            create_approvers_recursively(
                                administration=parent_adm,
                                org=org,
                                max_depth=3,
                                current_depth=0,
                            )

                    for f in Forms.objects.filter(parent__isnull=True).all():
                        # check if the user have access to the form
                        if not user.user_form.filter(form=f).exists():
                            continue

                        # Initialize counters for this form
                        if f.name not in form_data_counts:
                            form_data_counts[f.name] = 0
                            form_monitoring_counts[f.name] = 0
                            form_pending_counts[f.name] = 0
                            form_draft_counts[f.name] = 0

                        name = f"{adm.full_name} - {fake.sentence(nb_words=3)}"
                        # Determine draft/pending status
                        data_is_draft = is_draft and (
                            form_data_counts[f.name] % 2 == 1
                        )
                        data_is_pending = (
                            not is_approved and
                            not data_is_draft and
                            (form_data_counts[f.name] % 2 == 1)
                        )

                        form_data = FormData.objects.create(
                            uuid=fake.uuid4(),
                            name=name,
                            form=f,
                            administration=adm,
                            created_by=user,
                            created=make_aware(created),
                            geo=geo_value,
                            is_pending=data_is_pending,
                            is_draft=data_is_draft,
                        )
                        add_fake_answers(form_data)

                        # Update counters
                        form_data_counts[f.name] += 1
                        if data_is_pending:
                            form_pending_counts[f.name] += 1
                        if data_is_draft:
                            form_draft_counts[f.name] += 1

                        # Save the form data
                        if (
                            not is_test and
                            not form_data.is_draft and
                            not form_data.is_pending
                        ):
                            form_data.save_to_file

                        # Create monitoring data if not draft
                        if not form_data.is_draft:
                            submitter = None
                            if mobile_user.name and r % 2 == 0:
                                submitter = mobile_user.name
                            for child_form in f.children.all():
                                last_date = form_data.children.aggregate(
                                    max_created=Max('created')
                                )['max_created']
                                if not last_date:
                                    last_date = form_data.created
                                for _ in range(monitoring):
                                    ld_f1 = last_date.strftime('%Y-%m-%d')
                                    ld_f2 = last_date.strftime(
                                        '%a %b %d %Y %H:%M:%S'
                                    )
                                    curr_time = (f"{ld_f1} - {ld_f2} GMT+0700")
                                    child_data = form_data.children.create(
                                        name=curr_time,
                                        uuid=form_data.uuid,
                                        administration=(
                                            form_data.administration
                                        ),
                                        geo=form_data.geo,
                                        form=child_form,
                                        created_by=user,
                                        created=last_date,
                                        is_pending=False,
                                        is_draft=False,
                                        submitter=submitter,
                                    )
                                    add_fake_answers(child_data)
                                    form_monitoring_counts[f.name] += 1
                                    last_date += timedelta(days=1)
                    index += 1
                # Output success messages
                for form_name, count in form_data_counts.items():
                    self.stdout.write(
                        f"Created {count} data entries for form {form_name}"
                    )
                for form_name, count in form_monitoring_counts.items():
                    if count > 0:
                        self.stdout.write(
                            f"Created {count} monitoring data entries "
                            f"for form {form_name}"
                        )
                for form_name, count in form_pending_counts.items():
                    if count > 0:
                        self.stdout.write(
                            f"Created {count} pending data entries "
                            f"for form {form_name}"
                        )
                for form_name, count in form_draft_counts.items():
                    if count > 0:
                        self.stdout.write(
                            f"Created {count} draft data entries "
                            f"for form {form_name}"
                        )
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully created {repeat} fake data entries'
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(
                    f'Error occurred: {str(e)}.'
                    'All changes have been rolled back.'
                )
            )
            raise
