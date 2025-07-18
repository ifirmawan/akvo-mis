from rest_framework import serializers
from api.v1.v1_data.models import FormData, Administration
from utils.custom_serializer_fields import CustomPrimaryKeyRelatedField


class FormDataStatSerializer(serializers.Serializer):
    date = serializers.DateField()
    value = serializers.FloatField()


class GeoLocationListSerializer(serializers.ModelSerializer):

    class Meta:
        model = FormData
        fields = ["id", "name", "geo", "administration_id"]


class GeoLocationFilterSerializer(serializers.Serializer):
    administration = CustomPrimaryKeyRelatedField(
        queryset=Administration.objects.none(), required=False
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.fields.get(
            "administration"
        ).queryset = Administration.objects.all()

    class Meta:
        fields = ["administration"]
