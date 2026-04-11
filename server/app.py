from flask import Flask, jsonify, request
from flask_cors import CORS
from haversine_check import haversine_check
from pip_check import is_pip

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return "Server running ✅"


@app.route("/location-status", methods=["POST"])
def location_status():
    data = request.get_json()

    lat = data["lat"]
    lng = data["lng"]

    # Home center
    home_lat = 34.056423
    home_lng = 74.948681
    HOME_RADIUS = 50

    # Polygon
    gps_points = [
        {"lat": 34.056465, "lng": 74.948610},
        {"lat": 34.056485, "lng": 74.948757},
        {"lat": 34.056353, "lng": 74.948636},
        {"lat": 34.056423, "lng": 74.948681},
    ]

    # 🔥 Processing
    distance = haversine_check(lat, lng, home_lat, home_lng)
    is_inside = is_pip(lat, lng, gps_points)

    status = distance <= HOME_RADIUS and is_inside

    return jsonify({
        "inside": status,
        "distance": distance
    })


if __name__ == "__main__":
    app.run(debug=True)