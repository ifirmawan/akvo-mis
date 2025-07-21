from django.urls import re_path
from api.v1.v1_visualization.views import (
    formdata_stats,
    GeolocationListView,
)

urlpatterns = [
    re_path(
        r"^(?P<version>(v1))/visualization/formdata-stats",
        formdata_stats,
    ),
    re_path(
        r"^(?P<version>(v1))/maps/geolocation/(?P<form_id>[0-9]+)",
        GeolocationListView.as_view(),
    ),
]
