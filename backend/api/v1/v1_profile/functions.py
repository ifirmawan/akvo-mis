from api.v1.v1_profile.models import Levels


def get_max_administration_level():
    max_level = Levels.objects.order_by("-level").first()
    return max_level.level if max_level else 0
