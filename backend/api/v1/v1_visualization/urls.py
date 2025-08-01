from django.urls import re_path
from api.v1.v1_visualization.views import (
    formdata_stats,
    monitoring_stats,
    GeolocationListView,
)

urlpatterns = [
    re_path(
        r"^(?P<version>(v1))/visualization/monitoring-stats",
        monitoring_stats,
    ),
    re_path(
        r"^(?P<version>(v1))/visualization/formdata-stats/(?P<form_id>[0-9]+)",
        formdata_stats,
    ),
    re_path(
        r"^(?P<version>(v1))/maps/geolocation/(?P<form_id>[0-9]+)",
        GeolocationListView.as_view(),
    ),
]
