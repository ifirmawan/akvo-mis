import logging
import os
from dateutil import parser
from django_q.models import Task

import pandas as pd
from django.utils import timezone
from django_q.tasks import async_task
from django.db.models import Subquery, Max
from api.v1.v1_jobs.administrations_bulk_upload import (
    seed_administration_data,
    validate_administrations_bulk_upload,
)
from utils.upload_entities import (
    validate_entity_file,
    validate_entity_data,
)
from api.v1.v1_forms.models import (
    Forms,
    QuestionOptions,
)
from api.v1.v1_forms.constants import QuestionTypes
from api.v1.v1_data.models import FormData
from api.v1.v1_jobs.constants import JobStatus, JobTypes

from api.v1.v1_jobs.models import Jobs
from api.v1.v1_jobs.seed_data import seed_excel_data
from api.v1.v1_jobs.validate_upload import validate
from api.v1.v1_profile.models import Administration, EntityData
from api.v1.v1_users.models import SystemUser
from utils import storage
from utils.email_helper import send_email, EmailTypes
from utils.export_form import (
    generate_definition_sheet,
    get_question_names,
    blank_data_template,
    meta_columns,
)
from utils.functions import update_date_time_format
from utils.storage import upload
from utils.custom_generator import generate_sqlite
from utils.report_generator import generate_datapoint_report

logger = logging.getLogger(__name__)


def download_data(form: Forms, administration_ids, download_type="all"):
    filter_data = {}
    if administration_ids:
        filter_data["administration_id__in"] = administration_ids
    data = form.form_form_data.filter(**filter_data)
    if download_type == "recent":
        latest_per_uuid = (
            data.values("uuid")
            .annotate(latest_created=Max("created"))
            .values("latest_created")
        )
        data = data.filter(created__in=Subquery(latest_per_uuid))
    return [d.to_data_frame for d in data.order_by("id")]


def get_answer_label(answer_values, question_id):
    if answer_values is None or answer_values != answer_values:
        return answer_values
    answer_value = answer_values.split("|")
    answer_label = []
    for value in answer_value:
        options = QuestionOptions.objects.filter(
            question_id=question_id, value=value
        ).first()
        if options:
            answer_label.append(options.label)
    return "|".join(answer_label)


def generate_data_sheet(
    writer: pd.ExcelWriter,
    form: Forms,
    administration_ids=None,
    download_type: str = "all",
    use_label: bool = False,
) -> None:
    questions = get_question_names(form=form)
    data = download_data(
        form=form,
        administration_ids=administration_ids,
        download_type=download_type,
    )
    if len(data):
        df = pd.DataFrame(data)
        new_columns = {}
        for question in questions:
            question_id, question_name, question_type = question
            if question_name not in df:
                df[question_name] = None
            if use_label:
                if question_type in [
                    QuestionTypes.option,
                    QuestionTypes.multiple_option,
                ]:
                    new_columns[question_name] = df[question_name].apply(
                        lambda x: get_answer_label(x, question_id)
                    )
        question_names = [question[1] for question in questions]
        if use_label:
            new_df = pd.DataFrame(new_columns)
            df.drop(columns=list(new_df), inplace=True)
            df = pd.concat([df, new_df], axis=1)
        # Reorder columns
        df = df[meta_columns + question_names]
        df.to_excel(writer, sheet_name="data", index=False)
        generate_definition_sheet(form=form, writer=writer)
    else:
        blank_data_template(form=form, writer=writer)


def job_generate_data_download(job_id, **kwargs):
    job = Jobs.objects.get(pk=job_id)
    file_path = "./tmp/{0}".format(job.result)
    if os.path.exists(file_path):
        os.remove(file_path)
    administration_ids = False
    administration_name = "All Administration Level"
    if kwargs.get("administration"):
        administration = Administration.objects.get(
            pk=kwargs.get("administration")
        )
        if administration.path:
            filter_path = "{0}{1}.".format(
                administration.path, administration.id
            )
        else:
            filter_path = f"{administration.id}."
        administration_ids = list(
            Administration.objects.filter(
                path__startswith=filter_path
            ).values_list("id", flat=True)
        )
        administration_ids.append(administration.id)

        administration_name = list(
            Administration.objects.filter(
                path__startswith=filter_path
            ).values_list("name", flat=True)
        )
    form = Forms.objects.get(pk=job.info.get("form_id"))
    download_type = kwargs.get("download_type")
    writer = pd.ExcelWriter(file_path, engine="xlsxwriter")

    generate_data_sheet(
        writer=writer,
        form=form,
        administration_ids=administration_ids,
        download_type=download_type,
        use_label=job.info.get("use_label"),
    )

    context = [
        {"context": "Form Name", "value": form.name},
        {
            "context": "Download Date",
            "value": update_date_time_format(job.created),
        },
        {
            "context": "Administration",
            "value": (
                ",".join(administration_name)
                if isinstance(administration_name, list)
                else administration_name
            ),
        },
    ]

    context = (
        pd.DataFrame(context).groupby(["context", "value"], sort=False).first()
    )
    context.to_excel(writer, sheet_name="context", startrow=0, header=False)
    workbook = writer.book
    worksheet = writer.sheets["context"]
    f = workbook.add_format(
        {
            "align": "left",
            "bold": False,
            "border": 0,
        }
    )
    worksheet.set_column("A:A", 20, f)
    worksheet.set_column("B:B", 30, f)
    merge_format = workbook.add_format(
        {
            "bold": True,
            "border": 1,
            "align": "center",
            "valign": "vcenter",
            "fg_color": "#45add9",
            "color": "#ffffff",
        }
    )
    worksheet.merge_range("A1:B1", "Context", merge_format)
    writer.save()
    url = upload(file=file_path, folder="download")
    return url


def transform_form_data_for_report(
    form: Forms, selection_ids: list = None, child_form_ids: list = []
):
    """
    Transform form data from database into the format expected by the
    report generator, supporting repeatable question groups by cloning
    the group for each repeat instance and mapping answers by index.
    """
    try:
        forms = [form]
        child_forms = list(form.children.all())
        if child_form_ids and len(child_form_ids):
            child_forms = [f for f in child_forms if f.id in child_form_ids]
        forms.extend(child_forms)

        main_form_data_queryset = FormData.objects.filter(
            form=form, is_pending=False
        )
        if selection_ids and len(selection_ids):
            main_form_data_queryset = main_form_data_queryset.filter(
                id__in=selection_ids
            )
        main_form_data = main_form_data_queryset.order_by("id").all()
        form_data_instances = list(main_form_data)

        question_groups = []
        for f in forms:
            form_question_groups = f.form_question_group.order_by(
                "order"
            ).all()
            question_groups.extend(form_question_groups)

        result = []

        for question_group in question_groups:
            questions = question_group.question_group_question.order_by(
                "order"
            ).all()
            is_repeatable = getattr(question_group, "repeatable", False)

            if is_repeatable:
                # For each parent FormData,
                # find max repeat index for this group
                max_repeats = 0
                # Map: parent_form_data_id -> max index for this group
                parent_max_index = {}
                for idx, main_fd in enumerate(form_data_instances):
                    # Get all answers for this group and parent
                    answers = []
                    for q in questions:
                        answers.extend(
                            q.question_answer.filter(data=main_fd).all()
                        )
                        # Also check child FormData for this group
                        for child_form in child_forms:
                            child_fd = main_fd.children.filter(
                                form=child_form, is_pending=False
                            ).last()
                            if child_fd:
                                answers.extend(
                                    q.question_answer.filter(
                                        data=child_fd
                                    ).all()
                                )
                    # Find max index for this parent
                    indices = [
                        a.index
                        for a in answers
                        if hasattr(a, "index") and a.index is not None
                    ]
                    max_idx = max(indices) if indices else 0
                    parent_max_index[main_fd.id] = max_idx
                    if max_idx > max_repeats:
                        max_repeats = max_idx
                # For each repeat index, clone the group
                for repeat_idx in range(max_repeats + 1):
                    group_data = {
                        "name": (
                            f"{question_group.label or question_group.name} "
                            f"[{repeat_idx + 1}]"
                        ),
                        "questions": [],
                    }
                    for question in questions:
                        answer_values = [""] * len(form_data_instances)
                        # For each parent FormData,
                        # get answer for this repeat index
                        for fd_idx, main_fd in enumerate(form_data_instances):
                            # Check parent and children
                            answer = question.question_answer.filter(
                                data=main_fd, index=repeat_idx
                            ).first()
                            if not answer:
                                for child_form in child_forms:
                                    child_fd = main_fd.children.filter(
                                        form=child_form, is_pending=False
                                    ).last()
                                    if child_fd:
                                        answer = (
                                            question.question_answer.filter(
                                                data=child_fd, index=repeat_idx
                                            ).first()
                                        )
                                        if answer:
                                            break
                            if answer:
                                # Format answer as before
                                if question.type == QuestionTypes.geo:
                                    value = ",".join(map(str, answer.options))
                                elif question.type in [
                                    QuestionTypes.option,
                                    QuestionTypes.multiple_option,
                                ]:
                                    options = answer.question.options.filter(
                                        value__in=answer.options
                                    ).all()
                                    value = (
                                        "|".join(
                                            [opt.label for opt in options]
                                        )
                                        if options
                                        else ""
                                    )
                                elif question.type == QuestionTypes.date:
                                    value = ""
                                    if (
                                        isinstance(answer.name, str)
                                        and answer.name
                                    ):
                                        try:
                                            date_obj = parser.parse(
                                                answer.name
                                            )
                                            value = date_obj.strftime(
                                                "%B %d, %Y"
                                            )
                                        except (
                                            ImportError,
                                            ValueError,
                                            TypeError,
                                        ):
                                            value = str(answer.name)
                                elif question.type in [
                                    QuestionTypes.text,
                                    QuestionTypes.photo,
                                    QuestionTypes.autofield,
                                    QuestionTypes.cascade,
                                    QuestionTypes.attachment,
                                    QuestionTypes.signature,
                                ]:
                                    value = answer.name or ""
                                elif (
                                    question.type
                                    == QuestionTypes.administration
                                ):
                                    if answer.value:
                                        admin = Administration.objects.filter(
                                            pk=answer.value
                                        ).first()
                                        value = (
                                            admin.name
                                            if admin
                                            else str(answer.value)
                                        )
                                    else:
                                        value = ""
                                else:
                                    value = (
                                        answer.value
                                        if answer.value is not None
                                        else ""
                                    )
                                answer_values[fd_idx] = str(value)
                        if any(
                            value.strip() for value in answer_values if value
                        ):
                            question_data = {
                                "question": question.label,
                                "answers": answer_values,
                            }
                            group_data["questions"].append(question_data)
                    if group_data["questions"]:
                        result.append(group_data)
            else:
                # Non-repeatable group: original logic
                group_data = {
                    "name": question_group.label or question_group.name,
                    "questions": [],
                }
                for question in questions:
                    answer_values = [""] * len(form_data_instances)
                    all_form_data_ids = []
                    for main_fd in main_form_data:
                        all_form_data_ids.append(main_fd.id)
                        for child_form in child_forms:
                            child_fd = main_fd.children.filter(
                                form=child_form, is_pending=False
                            ).last()
                            if child_fd:
                                all_form_data_ids.append(child_fd.id)
                    answers = question.question_answer.filter(
                        data__id__in=all_form_data_ids
                    ).select_related("data")
                    parent_id_to_index = {
                        fd.id: idx
                        for idx, fd in enumerate(form_data_instances)
                    }
                    for answer in answers:
                        if answer.data.parent:
                            parent_id = answer.data.parent.id
                        else:
                            parent_id = answer.data.id
                        form_data_index = parent_id_to_index.get(parent_id)
                        if form_data_index is None:
                            continue
                        if question.type == QuestionTypes.geo:
                            value = ",".join(map(str, answer.options))
                        elif question.type in [
                            QuestionTypes.option,
                            QuestionTypes.multiple_option,
                        ]:
                            options = answer.question.options.filter(
                                value__in=answer.options
                            ).all()
                            value = (
                                "|".join([opt.label for opt in options])
                                if options
                                else ""
                            )
                        elif question.type == QuestionTypes.date:
                            value = ""
                            if isinstance(answer.name, str) and answer.name:
                                try:
                                    date_obj = parser.parse(answer.name)
                                    value = date_obj.strftime("%B %d, %Y")
                                except (ImportError, ValueError, TypeError):
                                    value = str(answer.name)
                        elif question.type in [
                            QuestionTypes.text,
                            QuestionTypes.photo,
                            QuestionTypes.autofield,
                            QuestionTypes.cascade,
                            QuestionTypes.attachment,
                            QuestionTypes.signature,
                        ]:
                            value = answer.name or ""
                        elif question.type == QuestionTypes.administration:
                            if answer.value:
                                admin = Administration.objects.filter(
                                    pk=answer.value
                                ).first()
                                value = (
                                    admin.name if admin else str(answer.value)
                                )
                            else:
                                value = ""
                        else:
                            value = (
                                answer.value
                                if answer.value is not None
                                else ""
                            )
                        answer_values[form_data_index] = str(value)
                    if any(value.strip() for value in answer_values if value):
                        question_data = {
                            "question": question.label,
                            "answers": answer_values,
                        }
                        group_data["questions"].append(question_data)
                if group_data["questions"]:
                    result.append(group_data)
        return result
    except Exception as e:
        logger.error(f"Error transforming form data: {str(e)}")
        return []


def job_generate_data_report(job_id: int, **kwargs):
    try:
        job = Jobs.objects.get(pk=job_id)
        form_id = kwargs.get("form_id")
        selection_ids = kwargs.get("selection_ids", [])  # noqa: F841
        child_form_ids = kwargs.get("child_form_ids", [])

        # Get the form
        form = Forms.objects.get(pk=form_id)
        form_data = form.form_form_data.filter(
            is_pending=False,
            pk__in=selection_ids
        ).order_by("id").all()

        display_names = [
            fd.name for fd in form_data
        ]
        device_identifiers = [
            "Mobile Device" if fd.submitter else "Webform"
            for fd in form_data
        ]
        submission_dates = [
            update_date_time_format(fd.created) for fd in form_data
        ]
        submitters = [
            fd.submitter if fd.submitter else fd.created_by.get_full_name()
            for fd in form_data
        ]
        # form_version is an array of form.version based on number of form_data
        form_versions = [form.version] * len(form_data)

        # Clean up any existing file
        temp_file_path = f"./tmp/{job.result}"
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

        # Generate dynamic data from database
        form_data = transform_form_data_for_report(
            form=form,
            selection_ids=selection_ids,
            child_form_ids=child_form_ids,
        )

        # Fallback to empty list if no data found
        if not form_data:
            logger.warning(f"No data found for form_id {form_id}")
            form_data = []
        # Add Datapoint information
        datapoint_info = {
            "questions": [
                {"question": "Display Name", "answers": display_names},
                {
                    "question": "Device identifier",
                    "answers": device_identifiers
                },
                {
                    "question": "Submission Date",
                    "answers": submission_dates,
                },
                {"question": "Submitter", "answers": submitters},
                {"question": "Form version", "answers": form_versions},
            ],
        }
        form_data.insert(0, datapoint_info)

        # Generate the report file
        file_path = generate_datapoint_report(
            form_data,
            file_path=temp_file_path,
            form_name=form.name,
            display_names=display_names,
        )
        url = upload(file=file_path, folder="download_datapoint_report")
        return url
    except Forms.DoesNotExist:
        logger.error(f"Form with ID {form_id} not found")
        return []


def job_generate_data_download_result(task):
    job = Jobs.objects.get(task_id=task.id)
    job.attempt = job.attempt + 1
    if task.success:
        job.status = JobStatus.done
        job.available = timezone.now()
    else:
        job.status = JobStatus.failed
    job.save()


def seed_data_job(job_id):
    try:
        job = Jobs.objects.get(pk=job_id)
        seed_excel_data(job)
    except (ValueError, OSError, NameError, TypeError):
        print("Error seed data job")
        return False
    except Exception as unknown_error:
        print("Unknown error seed data job", unknown_error)
        return False
    return True


def seed_data_job_result(task):
    job = Jobs.objects.get(task_id=task.id)
    job.attempt = job.attempt + 1
    is_super_admin = job.user.is_superuser
    if task.result:
        job.status = JobStatus.done
        job.available = timezone.now()
        form_id = job.info.get("form")
        form = Forms.objects.filter(pk=int(form_id)).first()
        file = job.info.get("file")
        storage.download(f"upload/{file}")
        df = pd.read_excel(f"./tmp/{file}", sheet_name="data")
        subject = (
            "New Data Uploaded"
            if is_super_admin
            else "New Request @{0}".format(job.user.get_full_name())
        )
        data = {
            "subject": subject,
            "title": "New Data Submission",
            "send_to": [job.user.email],
            "listing": [
                {
                    "name": "Upload Date",
                    "value": job.created.strftime("%m-%d-%Y, %H:%M:%S"),
                },
                {"name": "Questionnaire", "value": form.name},
                {"name": "Number of Records", "value": df.shape[0]},
            ],
            "is_super_admin": is_super_admin,
        }
        send_email(context=data, type=EmailTypes.new_request)
    else:
        job.status = JobStatus.failed
    job.save()


def validate_excel(job_id):
    job = Jobs.objects.get(pk=job_id)
    storage.download(f"upload/{job.info.get('file')}")
    data = validate(
        job.info.get("form"),
        job.info.get("administration"),
        f"./tmp/{job.info.get('file')}",
    )

    if len(data):
        form_id = job.info.get("form")
        form = Forms.objects.filter(pk=int(form_id)).first()
        file = job.info.get("file")
        df = pd.read_excel(f"./tmp/{file}", sheet_name="data")
        error_list = pd.DataFrame(data)
        error_list = error_list[
            list(filter(lambda x: x != "error", list(error_list)))
        ]
        error_file = f"./tmp/error-{job_id}.csv"
        error_list.to_csv(error_file, index=False)
        data = {
            "send_to": [job.user.email],
            "listing": [
                {
                    "name": "Upload Date",
                    "value": job.created.strftime("%m-%d-%Y, %H:%M:%S"),
                },
                {"name": "Questionnaire", "value": form.name},
                {"name": "Number of Records", "value": df.shape[0]},
            ],
        }
        send_email(
            context=data,
            type=EmailTypes.upload_error,
            path=error_file,
            content_type="text/csv",
        )
        return False
    return True


def validate_excel_result(task):
    job = Jobs.objects.get(task_id=task.id)
    job.attempt = job.attempt + 1
    job_info = job.info
    if task.result:
        job.status = JobStatus.done
        job.available = timezone.now()
        job.save()
        job_info.update({"ref_job_id": job.id})
        new_job = Jobs.objects.create(
            result=job.info.get("file"),
            type=JobTypes.seed_data,
            status=JobStatus.on_progress,
            user=job.user,
            info=job_info,
        )
        task_id = async_task(
            "api.v1.v1_jobs.job.seed_data_job",
            new_job.id,
            hook="api.v1.v1_jobs.job.seed_data_job_result",
        )
        new_job.task_id = task_id
        new_job.save()
    else:
        job.status = JobStatus.failed
        job.save()


def handle_administrations_bulk_upload(filename, user_id, upload_time):
    user = SystemUser.objects.get(id=user_id)
    storage.download(f"upload/{filename}")
    file_path = f"./tmp/{filename}"
    errors = validate_administrations_bulk_upload(file_path)
    xlsx = pd.ExcelFile(file_path)
    if "data" not in xlsx.sheet_names:
        logger.error(f"Sheet 'data' not found in {filename}")
        send_email(
            context={
                "send_to": [user.email],
                "listing": [
                    {
                        "name": "Upload Date",
                        "value": upload_time.strftime("%m-%d-%Y, %H:%M:%S"),
                    },
                    {
                        "name": "Questionnaire",
                        "value": "Administrative List",
                    },
                    {
                        "name": "Error",
                        "value": 'Sheet "data" not found',
                    },
                ],
            },
            type=EmailTypes.upload_error,
        )
        return
    df = pd.read_excel(file_path, sheet_name="data")
    email_context = {
        "send_to": [user.email],
        "listing": [
            {
                "name": "Upload Date",
                "value": upload_time.strftime("%m-%d-%Y, %H:%M:%S"),
            },
            {
                "name": "Questionnaire",
                "value": "Administrative List",
            },
            {"name": "Number of Records", "value": df.shape[0]},
        ],
    }
    if len(errors):
        logger.error(errors)
        error_file = (
            "./tmp/administration-error-"
            f"{upload_time.strftime('%Y%m%d%H%M%S')}-{user.id}.csv"
        )
        error_list = pd.DataFrame(errors)
        error_list.to_csv(error_file, index=False)
        send_email(
            context=email_context,
            type=EmailTypes.upload_error,
            path=error_file,
            content_type="text/csv",
        )
        return
    seed_administration_data(file_path)
    generate_sqlite(Administration)
    send_email(context=email_context, type=EmailTypes.administration_upload)


def handle_master_data_bulk_upload_failure(task: Task):
    if task.success:
        return
    logger.error(
        {
            "error": "Failed running background job",
            "id": task.id,
            "name": task.name,
            "started": task.started,
            "stopped": task.stopped,
            "args": task.args,
            "kwargs": task.kwargs,
            "body": task.result,
        }
    )


def handle_entities_error_upload(
    errors: list,
    email_context: dict,
    user: SystemUser,
    upload_time: timezone.datetime,
):
    logger.error(errors)
    error_file = (
        "./tmp/entity-error-"
        f"{upload_time.strftime('%Y%m%d%H%M%S')}-{user.id}.csv"
    )
    error_list = pd.DataFrame(errors)
    error_list.to_csv(error_file, index=False)
    send_email(
        context=email_context,
        type=EmailTypes.upload_error,
        path=error_file,
        content_type="text/csv",
    )


def handle_entities_bulk_upload(filename, user_id, upload_time):
    user = SystemUser.objects.get(id=user_id)
    storage.download(f"upload/{filename}")
    file_path = f"./tmp/{filename}"
    errors = validate_entity_file(file_path)
    email_context = {
        "send_to": [user.email],
        "listing": [
            {
                "name": "Upload Date",
                "value": upload_time.strftime("%m-%d-%Y, %H:%M:%S"),
            },
            {
                "name": "Questionnaire",
                "value": "Entity List",
            },
        ],
    }
    if len(errors):
        handle_entities_error_upload(errors, email_context, user, upload_time)
        return
    errors = validate_entity_data(file_path)
    if len(errors):
        handle_entities_error_upload(errors, email_context, user, upload_time)
        return
    generate_sqlite(EntityData)
