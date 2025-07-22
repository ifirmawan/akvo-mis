from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from datetime import datetime
from django.db.models import Q
from api.v1.v1_data.models import FormData, Answers
from api.v1.v1_forms.models import Forms
from api.v1.v1_visualization.serializers import (
    FormDataStatSerializer,
    GeoLocationListSerializer,
    GeoLocationFilterSerializer,
)
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from rest_framework.generics import get_object_or_404
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from dateutil.parser import parse


@extend_schema(
    description="Get the statistic of on monitoring data",
    tags=["Visualization"],
    responses=FormDataStatSerializer(many=True),
    parameters=[
        OpenApiParameter(
            name="parent_id",
            required=True,
            type=OpenApiTypes.NUMBER,
            location=OpenApiParameter.QUERY,
            description="The parent ID to filter FormData",
        ),
        OpenApiParameter(
            name="question_id",
            required=True,
            type=OpenApiTypes.NUMBER,
            location=OpenApiParameter.QUERY,
            description="The question ID to extract the value from",
        ),
        OpenApiParameter(
            name="question_date",
            required=False,
            type=OpenApiTypes.NUMBER,
            location=OpenApiParameter.QUERY,
            description="the question to extract the date from (optional)",
        ),
    ],
)
@api_view(["GET"])
def formdata_stats(request, version):
    parent_id = request.query_params.get("parent_id")
    question_id = request.query_params.get("question_id")
    question_date_key = request.query_params.get("question_date")

    if not parent_id or not question_id:
        return Response(
            {"detail": "Missing required parameters."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        formdata_qs = FormData.objects.filter(parent_id=parent_id)
        stats = []

        for formdata in formdata_qs:
            answer = Answers.objects.filter(
                data=formdata, question_id=question_id
            ).first()
            if not answer:
                continue

            # Default date
            date = formdata.created

            # Optional override from another question
            if question_date_key:
                date_answer = Answers.objects.filter(
                    data=formdata, question_id=question_date_key
                ).first()
                if date_answer and date_answer.name:
                    parsed_date_raw = parse(date_answer.name)
                    reformatted = parsed_date_raw.strftime(
                        "%Y-%m-%dT%H:%M:%S.%fZ"
                    )
                    parsed_date = datetime.strptime(
                        reformatted,
                        "%Y-%m-%dT%H:%M:%S.%fZ"
                    )
                    if parsed_date:
                        date = parsed_date

            stats.append(
                {
                    "date": date.date(),
                    "value": answer.name or answer.value or answer.options,
                }
            )

        serializer = FormDataStatSerializer(stats, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class GeolocationListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses=GeoLocationListSerializer,
        parameters=[
            OpenApiParameter(
                name="administration",
                required=False,
                type=OpenApiTypes.NUMBER,
                location=OpenApiParameter.QUERY,
            ),
        ],
        tags=["Maps"],
        summary="To get list of geolocations for a form",
    )
    def get(self, request, form_id, version):
        serializer = GeoLocationFilterSerializer(
            data=request.GET, context={"form_id": form_id}
        )
        if not serializer.is_valid():
            # Return empty list if serializer is not valid
            return Response(
                data=[],
                status=status.HTTP_200_OK,
            )
        form = get_object_or_404(Forms, pk=form_id)
        queryset = form.form_form_data.filter(
            is_pending=False,
            is_draft=False,
            geo__isnull=False
        )
        if serializer.validated_data.get("administration"):
            adm = serializer.validated_data.get("administration")
            adm_path = f"{adm.id}."
            if adm.path:
                adm_path = f"{adm.path}{adm.id}."
            queryset = queryset.filter(
                Q(administration=adm) |
                Q(administration__path__startswith=adm_path)
            )
        queryset = queryset.values(
            "id", "name", "geo", "administration_id"
        )
        serializer = GeoLocationListSerializer(queryset, many=True)
        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )
