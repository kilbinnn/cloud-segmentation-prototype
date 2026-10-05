"use strict";

(() => {
  const get = id => document.getElementById(id);
  const container = get("locationMap");

  if (!container || !window.L) return;

  const latitudeInput = get("latitude");
  const longitudeInput = get("longitude");
  const coordinateButton = get("coordinateButton");
  const message = get("mapMessage");
  const locationLabel = get("mapSelectedLocation");

  const map = L.map(container).setView([12.8797, 121.774], 6);

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors"
    }
  ).addTo(map);

  let marker = null;
  let revision = 0;

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\b(city of|municipality of|province of)\b/g, "")
      .replace(/\b(city|municipality|province)\b/g, "")
      .replace(/[().]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function disableSelection() {
    window.selectedMapPoint = null;
    get("mapWeatherButton").disabled = true;
    get("continueWeather").disabled = true;
  }

  function valid(latitude, longitude) {
    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    );
  }

  function updateCoordinateButton() {
    coordinateButton.disabled =
      !window.selectedMunicipality ||
      !latitudeInput.value.trim() ||
      !longitudeInput.value.trim() ||
      !valid(
        Number(latitudeInput.value),
        Number(longitudeInput.value)
      );
  }

  function refresh() {
    if (container.clientWidth) map.invalidateSize();
  }

  new ResizeObserver(refresh).observe(container);
  window.addEventListener("resize", refresh);

  window.addEventListener("municipality-cleared", () => {
    revision++;

    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }

    latitudeInput.value = "";
    longitudeInput.value = "";
    updateCoordinateButton();
  });

  function confirm(latitude, longitude, municipality, reference) {
    const label = [
      municipality.municipality,
      municipality.province,
      municipality.region,
      "Philippines"
    ].filter(Boolean).join(", ");

    window.selectedMapPoint = {
      latitude: latitude,
      longitude: longitude,
      countryVerified: true,
      approximate: true,
      label: label,
      municipality: municipality.municipality
    };

    locationLabel.textContent =
      label + (reference ? " — municipality reference point" : " — selected map point");

    message.textContent =
      "Coordinates: " + latitude.toFixed(6) + ", " +
      longitude.toFixed(6) + ". " +
      (reference
        ? "Approximate municipality reference, not its boundary."
        : "Address-service municipality match; boundary containment is not verified.");

    get("mapWeatherButton").disabled = false;
    get("continueWeather").disabled = false;
  }

  async function selectPoint(
    latitude,
    longitude,
    moveMap = false,
    municipalityReference = false
  ) {
    const municipality = window.selectedMunicipality;

    if (!municipality) {
      message.textContent = "Find and select a municipality first.";
      return;
    }

    latitude = Number(latitude);
    longitude = Number(longitude);

    if (!valid(latitude, longitude)) {
      message.textContent = "Enter valid coordinates.";
      return;
    }

    const current = ++revision;
    disableSelection();

    latitudeInput.value = latitude.toFixed(6);
    longitudeInput.value = longitude.toFixed(6);
    updateCoordinateButton();

    if (!marker) {
      marker = L.marker([latitude, longitude], {
        draggable: true
      }).addTo(map);

      marker.on("dragend", () => {
        const point = marker.getLatLng();
        selectPoint(point.lat, point.lng);
      });
    } else {
      marker.setLatLng([latitude, longitude]);
    }

    if (moveMap) map.setView([latitude, longitude], 12);

    if (municipalityReference) {
      confirm(latitude, longitude, municipality, true);
      return;
    }

    locationLabel.textContent = "Checking the selected municipality...";
    message.textContent = "Checking the pin's approximate address...";

    try {
      const url = new URL("https://photon.komoot.io/reverse");
      url.searchParams.set("lat", latitude);
      url.searchParams.set("lon", longitude);
      url.searchParams.set("limit", "1");
      url.searchParams.set("lang", "en");

      const response = await fetch(url, {
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) throw new Error("Address checking failed.");

      const data = await response.json();

      if (
        current !== revision ||
        municipality !== window.selectedMunicipality
      ) return;

      const p = data.features?.[0]?.properties || {};

      const names = [p.city, p.county];

      if (p.osm_key === "place") names.push(p.name);

      const sameMunicipality = names.some(
        value => normalize(value) === normalize(municipality.municipality)
      );

      const sameProvince = !municipality.province ||
        [p.state, p.county].some(
          value => normalize(value) === normalize(municipality.province)
        );

      if (
        String(p.countrycode || "").toUpperCase() !== "PH" ||
        !sameMunicipality ||
        !sameProvince
      ) {
        throw new Error(
          "This pin could not be matched to " +
          municipality.municipality +
          ". Choose another point or use the municipality reference."
        );
      }

      confirm(latitude, longitude, municipality, false);
    } catch (error) {
      if (current !== revision) return;

      locationLabel.textContent = "Map point not confirmed.";
      message.textContent = error.message;
    }
  }

  window.selectMapPoint = selectPoint;

  map.on("click", event => {
    selectPoint(event.latlng.lat, event.latlng.lng);
  });

  get("coordinateForm").addEventListener("submit", event => {
    event.preventDefault();

    if (!coordinateButton.disabled) {
      selectPoint(
        Number(latitudeInput.value),
        Number(longitudeInput.value),
        true
      );
    }
  });

  function coordinatesEdited() {
    revision++;
    disableSelection();
    locationLabel.textContent =
      "Coordinates edited. Click Use These Coordinates.";
    updateCoordinateButton();
  }

  latitudeInput.addEventListener("input", coordinatesEdited);
  longitudeInput.addEventListener("input", coordinatesEdited);

  updateCoordinateButton();
})();
