from pathlib import Path
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from io import BytesIO
import base64
import math
import threading
import time

import requests
import numpy as np
from PIL import Image
from flask import Flask, jsonify, request, send_from_directory

PROJECT_FOLDER = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=None)

CACHE = {}
CACHE_LOCK = threading.Lock()

# Prototype mapping assumption: requires geographic validation.
WEST = 105.0
EAST = 140.0
NORTH = 30.0
SOUTH = 0.0

# Experimental brightness threshold, not a trained cloud classifier.
BRIGHTNESS_THRESHOLD = 180


def image_data_url(image):
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return "data:image/png;base64," + encoded


def fetch_recent_image():
    with CACHE_LOCK:
        if CACHE and time.monotonic() - CACHE["cached_at"] < 300:
            return CACHE["data"]

        now = datetime.now(timezone.utc)
        start = now - timedelta(minutes=20)
        start = start.replace(
            minute=(start.minute // 10) * 10,
            second=0,
            microsecond=0
        )

        errors = []

        for offset in range(6):
            candidate = start - timedelta(minutes=10 * offset)

            url = (
                "https://www.data.jma.go.jp/mscweb/data/himawari/"
                f"img/se2/se2_trm_{candidate:%H%M}.jpg"
            )

            try:
                response = requests.get(url, timeout=(10, 20))
                response.raise_for_status()

                modified_text = response.headers.get("Last-Modified")

                if not modified_text:
                    raise ValueError("Source file timestamp is unavailable.")

                modified = parsedate_to_datetime(modified_text)

                if modified.tzinfo is None:
                    modified = modified.replace(tzinfo=timezone.utc)

                modified = modified.astimezone(timezone.utc)

                age = (now - modified).total_seconds()
                delay = (modified - candidate).total_seconds()

                if age < -300 or age > 5400:
                    raise ValueError("Source image is not recent.")

                if delay < 0 or delay > 3600:
                    raise ValueError(
                        "Source timestamp does not match the requested slot."
                    )

                image = Image.open(BytesIO(response.content))
                image.load()
                image = image.convert("RGB")

                if image.size != (701, 601):
                    raise ValueError(
                        "Source dimensions changed; mapping needs review."
                    )

                if np.asarray(image.convert("L")).mean() < 8:
                    raise ValueError(
                        "True-color imagery is too dark for this method."
                    )

                data = {
                    "image": image,
                    "url": url,
                    "slot": candidate,
                    "modified": modified,
                    "downloaded": now
                }

                CACHE.clear()
                CACHE["cached_at"] = time.monotonic()
                CACHE["data"] = data

                return data

            except (
                requests.RequestException,
                ValueError,
                OSError
            ) as error:
                errors.append(str(error))

        raise ValueError(
            "No suitable recent daytime image was retrieved. "
            "Last issue: " + errors[-1]
        )


@app.get("/")
def website():
    return send_from_directory(PROJECT_FOLDER, "index.html")


@app.get("/api/health")
def health():
    return jsonify(
        status="ok",
        message="Himawari experimental mask backend is running.",
        version="brightness-mask-1"
    )


@app.get("/api/satellite")
def satellite():
    try:
        latitude = float(request.args.get("lat", ""))
        longitude = float(request.args.get("lon", ""))
        width_km = float(request.args.get("width_km", "120"))

        if not all(
            math.isfinite(value)
            for value in [latitude, longitude, width_km]
        ):
            raise ValueError("Enter finite coordinates and crop width.")

        if not (
            SOUTH < latitude < NORTH and
            WEST < longitude < EAST
        ):
            raise ValueError("Selected point is outside image coverage.")

        if not 40 <= width_km <= 400:
            raise ValueError("Crop width must be between 40 and 400 km.")

        data = fetch_recent_image()
        image = data["image"]

        # Approximate linear mapping; not validated georeferencing.
        x = (
            (longitude - WEST) / (EAST - WEST)
            * (image.width - 1)
        )

        y = (
            (NORTH - latitude) / (NORTH - SOUTH)
            * (image.height - 1)
        )

        half_lat = width_km / (2 * 111.32)

        half_lon = width_km / (
            2 * 111.32 * math.cos(math.radians(latitude))
        )

        half_x = half_lon / (EAST - WEST) * (image.width - 1)
        half_y = half_lat / (NORTH - SOUTH) * (image.height - 1)

        left = round(x - half_x)
        right = round(x + half_x)
        top = round(y - half_y)
        bottom = round(y + half_y)

        if (
            left < 0 or top < 0 or
            right > image.width or bottom > image.height
        ):
            raise ValueError("Requested crop extends beyond the image.")

        crop = image.crop((left, top, right, bottom))
        gray = crop.convert("L")
        gray_array = np.asarray(gray)

        if gray_array.mean() < 8:
            raise ValueError(
                "The selected area is too dark for daytime brightness masking."
            )

        # Calculate on original pixels, before display enlargement.
        candidate_pixels = gray_array >= BRIGHTNESS_THRESHOLD

        candidate_percent = float(
            100 * candidate_pixels.mean()
        )

        mask = Image.fromarray(
            candidate_pixels.astype(np.uint8) * 255
        )

        # Overlay the mask on the same source crop.
        original_rgb = np.asarray(crop, dtype=np.float32)
        overlay_rgb = original_rgb.copy()

        pink = np.array([255, 50, 130], dtype=np.float32)

        overlay_rgb[candidate_pixels] = (
            0.55 * original_rgb[candidate_pixels] +
            0.45 * pink
        )

        overlay = Image.fromarray(
            np.clip(overlay_rgb, 0, 255).astype(np.uint8)
        )

        display_size = (256, 256)

        color_display = crop.resize(
            display_size,
            Image.Resampling.BILINEAR
        )

        gray_display = gray.resize(
            display_size,
            Image.Resampling.BILINEAR
        )

        mask_display = mask.resize(
            display_size,
            Image.Resampling.NEAREST
        )

        overlay_display = overlay.resize(
            display_size,
            Image.Resampling.NEAREST
        )

        return jsonify(
            status="ok",
            latitude=latitude,
            longitude=longitude,
            crop_width_km=width_km,
            native_crop_pixels=list(crop.size),
            color_image=image_data_url(color_display),
            grayscale_image=image_data_url(gray_display),
            candidate_mask_image=image_data_url(mask_display),
            candidate_overlay_image=image_data_url(overlay_display),
            cloud_candidate_percent=candidate_percent,
            brightness_threshold=BRIGHTNESS_THRESHOLD,
            method="Experimental brightness-based estimate",
            source_url=data["url"],
            source="JMA Himawari Southeast Asia 2",
            observation_time_utc_inferred=data["slot"].isoformat(),
            source_file_modified_utc=data["modified"].isoformat(),
            downloaded_at_utc=data["downloaded"].isoformat(),
            georeferencing="approximate_linear_mapping",
            note=(
                "Bright pixels are cloud candidates, not confirmed clouds "
                "or rain clouds. Bright land and image rendering can affect "
                "the result. No reference mask is available, so accuracy "
                "and IoU are not calculated. Geographic mapping is approximate. "
                "Observation date is inferred from the time slot and file timestamp."
            )
        )

    except (ValueError, TypeError) as error:
        return jsonify(
            status="error",
            message=str(error)
        ), 400

    except Exception:
        app.logger.exception("Satellite processing failed")

        return jsonify(
            status="error",
            message="Satellite processing failed. Check the server terminal."
        ), 502


@app.get("/images/<path:filename>")
def images(filename):
    return send_from_directory(PROJECT_FOLDER / "images", filename)


@app.get("/<filename>")
def website_asset(filename):
    if Path(filename).suffix.lower() not in {".js", ".css", ".ico"}:
        return "File not available.", 404

    return send_from_directory(PROJECT_FOLDER, filename)


if __name__ == "__main__":
    print("\nWebsite: http://127.0.0.1:5001")
    print("Backend: http://127.0.0.1:5001/api/health\n")

    app.run(
        host="127.0.0.1",
        port=5001,
        debug=False
    )