"use strict";

(() => {
  const button = document.getElementById("mapWeatherButton");
  const municipalityButton = document.getElementById("weatherButton");
  const locationForm = document.getElementById("locationForm");
  const selectedLabel = document.getElementById("mapSelectedLocation");
  const message = document.getElementById("weatherMessage");

  let busy = false;

  function validPoint(point) {
    return (
      point &&
      point.countryVerified === true &&
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      point.latitude >= -90 &&
      point.latitude <= 90 &&
      point.longitude >= -180 &&
      point.longitude <= 180
    );
  }

  function updateButton() {
    button.disabled =
      busy ||
      municipalityButton.disabled ||
      !validPoint(window.selectedMapPoint);
  }

  function clearWeather() {
    document.getElementById("rainfallValue").textContent = "Not loaded";
    document.getElementById("weatherCloudValue").textContent = "Not loaded";
    document.getElementById("weatherTime").textContent = "Not loaded";

    updateWeatherCondition(null, "");
  }

  // Update availability when map/address selection changes.
  const selectionObserver = new MutationObserver(function () {
    updateButton();

    // Clear results previously fetched using a map point.
    if (message.dataset.lookupMode === "map") {
      clearWeather();

      document.getElementById("selectedLocation").textContent =
        "Map selection changed. Load weather for the new point.";

      message.textContent =
        "Previous map-weather results have been cleared.";

      delete message.dataset.lookupMode;
    }
  });

  selectionObserver.observe(selectedLabel, {
    childList: true,
    characterData: true,
    subtree: true
  });

  // Watch the existing municipality lookup so requests do not overlap.
  const municipalityObserver = new MutationObserver(updateButton);

  municipalityObserver.observe(municipalityButton, {
    attributes: true,
    attributeFilter: ["disabled"]
  });

  locationForm.addEventListener("submit", function () {
    delete message.dataset.lookupMode;
  });

  button.addEventListener("click", async function () {
    const point = window.selectedMapPoint;

    if (busy || !validPoint(point) || municipalityButton.disabled) {
      return;
    }

    busy = true;
    updateButton();

    municipalityButton.disabled = true;
    button.textContent = "Loading Point Weather...";

    clearWeather();

    const locationName = point.label || "Selected map point";

    document.getElementById("selectedLocation").textContent =
      `${locationName} | ${point.latitude.toFixed(6)}, ` +
      `${point.longitude.toFixed(6)}`;

    message.textContent = "Retrieving weather for the selected coordinates...";

    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");

      url.search = new URLSearchParams({
        latitude: String(point.latitude),
        longitude: String(point.longitude),
        current: "precipitation,cloud_cover",
        timezone: "Asia/Manila",
        forecast_days: "1"
      }).toString();

      // Reuse the helper already provided in script.js.
      const weather = await getWeatherJSON(url);

      // Ignore results if the marker changed during the request.
      if (window.selectedMapPoint !== point) {
        message.textContent =
          "The selected point changed. Load weather for the new point.";
        return;
      }

      const current = weather.current;
      const units = weather.current_units;

      if (
        !current ||
        !units ||
        !Number.isFinite(current.precipitation) ||
        current.precipitation < 0 ||
        !Number.isFinite(current.cloud_cover) ||
        current.cloud_cover < 0 ||
        current.cloud_cover > 100 ||
        !Number.isFinite(current.interval) ||
        current.interval <= 0 ||
        !current.time ||
        !Number.isFinite(weather.latitude) ||
        !Number.isFinite(weather.longitude)
      ) {
        throw new Error("The weather response is incomplete or invalid.");
      }

      const minutes = current.interval / 60;

      document.getElementById("rainfallValue").textContent =
        `${current.precipitation.toFixed(2)} ${units.precipitation}` +
        ` / ${minutes} min`;

      document.getElementById("weatherCloudValue").textContent =
        `${current.cloud_cover.toFixed(0)}%`;

      document.getElementById("weatherTime").textContent =
        `${current.time.replace("T", " ")} PHT`;

      updateWeatherCondition(current.cloud_cover, locationName);

      message.replaceChildren(
        document.createTextNode(
          "Modeled weather for the selected coordinates. " +
          `Weather grid: ${weather.latitude.toFixed(4)}, ` +
          `${weather.longitude.toFixed(4)}. Source: `
        )
      );

      const link = document.createElement("a");
      link.href = "https://open-meteo.com/";
      link.textContent = "Open-Meteo";
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      message.append(link);
      message.dataset.lookupMode = "map";

    } catch (error) {
      if (window.selectedMapPoint === point) {
        clearWeather();

        message.textContent =
          `Point weather could not load: ${error.message}`;
      }
    } finally {
      busy = false;
      municipalityButton.disabled = false;
      button.textContent = "Get Weather at Selected Point";
      updateButton();
    }
  });

  updateButton();
})();