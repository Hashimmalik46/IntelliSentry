try:
    from pyproj import Transformer
    from shapely.geometry import Point, Polygon
    HAS_GEO_LIBS = True
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:32643", always_xy=True)
except Exception as e:
    print(f"Geo libraries warning: {e}")
    HAS_GEO_LIBS = False


def gps_to_utm(lat, lng):
    if HAS_GEO_LIBS:
        return transformer.transform(lng, lat)
    return lng, lat


def create_polygon(gps_points):
    if HAS_GEO_LIBS:
        utm_points = [gps_to_utm(p["lat"], p["lng"]) for p in gps_points]
        return Polygon(utm_points)
    return None


def is_pip(lat, lng, gps_points, buffer_m=2):
    if not HAS_GEO_LIBS:
        return True
    try:
        polygon = create_polygon(gps_points)
        x, y = gps_to_utm(lat, lng)
        point = Point(x, y)
        return polygon.buffer(buffer_m).contains(point)
    except Exception as err:
        print(f"PIP check error: {err}")
        return True