from pyproj import Transformer
from shapely.geometry import Point, Polygon

transformer = Transformer.from_crs("EPSG:4326", "EPSG:32643", always_xy=True)


def gps_to_utm(lat, lng):
    return transformer.transform(lng, lat)


def create_polygon(gps_points):
    utm_points = [gps_to_utm(p["lat"], p["lng"]) for p in gps_points]
    return Polygon(utm_points)


def is_pip(lat, lng, gps_points, buffer_m=2):
    polygon = create_polygon(gps_points)

    x, y = gps_to_utm(lat,lng)
    point = Point(x, y)

    return polygon.buffer(buffer_m).contains(point)