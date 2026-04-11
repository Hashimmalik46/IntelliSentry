import math

def radian_conversion(lat, lng):
    return math.radians(lat), math.radians(lng)


def haversine(lat1, lng1, lat2, lng2):
    lat1, lng1 = radian_conversion(lat1, lng1)
    lat2, lng2 = radian_conversion(lat2, lng2)

    dlat = lat2 - lat1
    dlng = lng2 - lng1

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    R = 6371000
    return R * c


def haversine_check(lat, lng, home_lat, home_lng):
    distance = haversine(lat, lng, home_lat, home_lng)

    return distance