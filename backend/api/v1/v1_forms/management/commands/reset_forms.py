from django.core.management import call_command
from django.core.management import BaseCommand
from api.v1.v1_forms.models import Forms
from api.v1.v1_users.models import SystemUser


class Command(BaseCommand):
    help = (
        "Reset all forms to their initial state by truncating and"
        "repopulating them."
    )
    # Add a test parameter to the command

    def add_arguments(self, parser):
        parser.add_argument(
            "--test",
            nargs="?",
            const=1,
            default=False,
            type=int
        )

    def handle(self, *args, **options):
        # Get all non-test users
        users = SystemUser.objects.exclude(
            email__contains="@test.com"
        ).all()
        user_forms = {}
        for user in users:
            user_forms[user.id] = [
                uf.form for uf in user.user_form.all()
            ]
        # truncate all forms and related data
        forms = Forms.objects.all()
        for form in forms:
            form.delete()
        # Call form_seeder command to repopulate the forms
        test = options.get("test", False)
        if test:
            call_command(
                "form_seeder",
                "--test",
                stdout=self.stdout,
                stderr=self.stderr,
            )
        else:
            call_command(
                "form_seeder",
                stdout=self.stdout,
                stderr=self.stderr,
            )
        # Reset user form assignments
        SystemUser.objects.filter(
            email__contains="@test.com"
        ).delete(hard=True)

        # Re-assign forms to users
        for user in SystemUser.objects.all():
            # restore the user's forms
            if user.id in user_forms:
                # filter Forms that were assigned to the user
                forms = Forms.objects.filter(
                    id__in=[uf.id for uf in user_forms[user.id]]
                ).all()
                for form in forms:
                    user.user_form.create(
                        form=form,
                    )
        # Output success message
        self.stdout.write(self.style.SUCCESS("Successfully reset all forms."))
