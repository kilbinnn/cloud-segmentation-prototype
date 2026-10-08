
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ============================================================
  // CONFIGURATION
  // ============================================================

  const PSGC_API = "https://psgc.cloud/api";
  const PHOTON_API = "https://photon.komoot.io/api/";
  const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
  const JMA_BASE =
    "https://www.data.jma.go.jp/mscweb/data/himawari/img/se2/";

  // ============================================================
  // ELEMENTS
  // ============================================================

  const $ = id => document.getElementById(id);

  const regionSelect = $("regionSelect");
  const provinceSelect = $("provinceSelect");
  const municipalitySelect = $("municipalitySelect");
  const confirmLocationButton = $("confirmLocationButton");
  const locationMessage = $("locationMessage");
  const selectedLocationLabel = $("selectedLocationLabel");
  const locationCoordinates = $("locationCoordinates");
  const toWeatherButton = $("toWeatherButton");

  const weatherLocation = $("weatherLocation");
  const precipitationValue = $("precipitationValue");
  const cloudCoverValue = $("cloudCoverValue");
  const weatherTimeValue = $("weatherTimeValue");
  const weatherMessage = $("weatherMessage");
  const weatherConditionCard = $("weatherConditionCard");
  const weatherCondition = $("weatherCondition");
  const weatherConditionDescription =
    $("weatherConditionDescription");
  const toSatelliteButton = $("toSatelliteButton");

  const satelliteLocation = $("satelliteLocation");
  const loadSatelliteButton = $("loadSatelliteButton");
  const satelliteStatus = $("satelliteStatus");
  const satelliteObservationTime =
    $("satelliteObservationTime");
  const himawariImage = $("himawariImage");
  const satellitePlaceholder = $("satellitePlaceholder");
  const toMatlabButton = $("toMatlabButton");

  const matlabPatchNumber = $("matlabPatchNumber");
  const matlabAccuracy = $("matlabAccuracy");
  const matlabIoU = $("matlabIoU");
  const matlabCoverage = $("matlabCoverage");
  const matlabConditionCard = $("matlabConditionCard");
  const matlabCondition = $("matlabCondition");
  const matlabConditionNote = $("matlabConditionNote");
  const matlabSatelliteImage = $("matlabSatelliteImage");
  const matlabActualMask = $("matlabActualMask");
  const matlabPredictedMask = $("matlabPredictedMask");
  const matlabOverlayImage = $("matlabOverlayImage");
  const matlabActualCoverage = $("matlabActualCoverage");
  const matlabPredictedCoverage =
    $("matlabPredictedCoverage");
  const toLinkButton = $("toLinkButton");

  const linkLocation = $("linkLocation");
  const linkRainDisplay = $("linkRainDisplay");
  const linkCloudDisplay = $("linkCloudDisplay");
  const frequencyBand = $("frequencyBand");
  const frequencyInput = $("frequency");
  const polarization = $("polarization");
  const elevationAngle = $("elevationAngle");
  const rainRate = $("rainRate");
  const calculateAttenuationButton =
    $("calculateAttenuationButton");
  const specificAttenuation = $("specificAttenuation");
  const coefficientK = $("coefficientK");
  const coefficientAlpha = $("coefficientAlpha");
  const linkImpact = $("linkImpact");
  const linkImpactBadge = $("linkImpactBadge");
  const linkResultExplanation = $("linkResultExplanation");
  const restartButton = $("restartButton");

  // ============================================================
  // STATE
  // ============================================================

  let selectedLocation = null;
  let currentWeather = null;
  let satelliteLoaded = false;
  let satelliteLoading = false;
  let currentMatlabPatch = null;

  const cache = new Map();

  // ============================================================
  // GENERAL HELPERS
  // ============================================================

  function setText(element, value) {
    if (element) {
      element.textContent = value;
    }
  }

  function setDisabled(element, disabled) {
    if (element) {
      element.disabled = disabled;
    }
  }

  function optionName(select) {
    if (!select || !select.value) {
      return "";
    }

    return select.selectedOptions[0]
      ?.textContent?.trim() || "";
  }

  function resetSelect(select, placeholder) {
    if (!select) return;

    select.replaceChildren(
      new Option(placeholder, "")
    );

    select.disabled = true;
  }

  function populateSelect(select, items, placeholder) {
    if (!select) return;

    resetSelect(select, placeholder);

    const sorted = [...items].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    for (const item of sorted) {
      select.add(
        new Option(item.name, String(item.code))
      );
    }

    select.disabled = sorted.length === 0;
  }

  async function getJSON(url) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      20000
    );

    try {
      const response = await fetch(url, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(
          "Request failed with HTTP " + response.status
        );
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getPSGC(path) {
    if (cache.has(path)) {
      return cache.get(path);
    }

    const data = await getJSON(PSGC_API + path);

    if (!Array.isArray(data)) {
      throw new Error("Unexpected PSGC response.");
    }

    cache.set(path, data);

    return data;
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(
        /\b(city of|municipality of|province of)\b/g,
        ""
      )
      .replace(
        /\b(city|municipality|province)\b/g,
        ""
      )
      .replace(/[().]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function fullLocationName() {
    if (!selectedLocation) {
      return "Selected location";
    }

    return [
      selectedLocation.municipality,
      selectedLocation.province,
      selectedLocation.region,
      "Philippines"
    ]
      .filter(Boolean)
      .join(", ");
  }

  function formatPercent(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number.toFixed(2) + "%"
      : "—";
  }

  // ============================================================
  // PAGE NAVIGATION
  // ============================================================

  function showStep(number) {
    for (let index = 1; index <= 5; index++) {
      const section = $("step" + index);

      if (section) {
        section.hidden = index !== number;
      }
    }

    document
      .querySelectorAll("[data-progress]")
      .forEach(step => {
        step.classList.toggle(
          "active",
          Number(step.dataset.progress) === number
        );
      });

    // Stage 3: Load Himawari automatically.
    if (
      number === 3 &&
      selectedLocation &&
      !satelliteLoaded &&
      !satelliteLoading
    ) {
      loadHimawari();
    }

    // Stage 4: Select a RANDOM real MATLAB patch.
    if (number === 4) {
      loadRandomMatlabDemo();
    }

    // Stage 5: Synchronize weather information.
    if (number === 5) {
      synchronizeLinkAssessment();
    }

    const target = $("step" + number);

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  document
    .querySelectorAll("[data-back]")
    .forEach(button => {
      button.addEventListener("click", () => {
        showStep(Number(button.dataset.back));
      });
    });

  if (toWeatherButton) {
    toWeatherButton.addEventListener(
      "click",
      async () => {
        showStep(2);
        await loadWeather();
      }
    );
  }

  if (toSatelliteButton) {
    toSatelliteButton.addEventListener(
      "click",
      () => showStep(3)
    );
  }

  if (toMatlabButton) {
    toMatlabButton.addEventListener(
      "click",
      () => showStep(4)
    );
  }

  if (toLinkButton) {
    toLinkButton.addEventListener(
      "click",
      () => showStep(5)
    );
  }

  if (restartButton) {
    restartButton.addEventListener(
      "click",
      () => showStep(1)
    );
  }

  // ============================================================
  // STAGE 1: LOCATION
  // ============================================================

  function updateConfirmButton() {
    if (!confirmLocationButton) return;

    confirmLocationButton.disabled =
      !regionSelect?.value ||
      !provinceSelect?.value ||
      !municipalitySelect?.value;
  }

  function clearLocationConfirmation() {
    selectedLocation = null;
    currentWeather = null;
    satelliteLoaded = false;
    satelliteLoading = false;

    setText(
      selectedLocationLabel,
      "No location selected"
    );

    setText(
      locationCoordinates,
      "Coordinates will appear after confirmation."
    );

    setDisabled(toWeatherButton, true);

    if (himawariImage) {
      himawariImage.hidden = true;
    }

    if (satellitePlaceholder) {
      satellitePlaceholder.hidden = false;
    }

    setText(
      satellitePlaceholder,
      "Satellite imagery will load automatically when Stage 3 is opened."
    );

    setText(
      satelliteStatus,
      "Satellite imagery has not been loaded."
    );

    setText(satelliteObservationTime, "—");

    updateConfirmButton();
  }

  if (regionSelect) {
    regionSelect.addEventListener(
      "change",
      async () => {
        clearLocationConfirmation();

        resetSelect(
          provinceSelect,
          "Loading provinces..."
        );

        resetSelect(
          municipalitySelect,
          "Select a province first"
        );

        if (!regionSelect.value) {
          resetSelect(
            provinceSelect,
            "Select a region first"
          );

          setText(
            locationMessage,
            "Select a region."
          );

          return;
        }

        setText(
          locationMessage,
          "Loading provinces..."
        );

        try {
          const provinces = await getPSGC(
            "/regions/" +
            encodeURIComponent(regionSelect.value) +
            "/provinces"
          );

          if (provinces.length > 0) {
            populateSelect(
              provinceSelect,
              provinces,
              "Select Province"
            );
          } else {
            provinceSelect.replaceChildren(
              new Option(
                "No province layer",
                "__NO_PROVINCE__"
              )
            );

            provinceSelect.disabled = false;
          }

          setText(
            locationMessage,
            "Select a province or administrative option."
          );
        } catch (error) {
          setText(
            locationMessage,
            "Provinces could not load: " +
              error.message
          );
        }

        updateConfirmButton();
      }
    );
  }

  if (provinceSelect) {
    provinceSelect.addEventListener(
      "change",
      async () => {
        clearLocationConfirmation();

        resetSelect(
          municipalitySelect,
          "Loading municipalities..."
        );

        if (!provinceSelect.value) {
          resetSelect(
            municipalitySelect,
            "Select a province first"
          );

          return;
        }

        setText(
          locationMessage,
          "Loading municipalities and cities..."
        );

        try {
          let path;

          if (
            provinceSelect.value ===
            "__NO_PROVINCE__"
          ) {
            path =
              "/regions/" +
              encodeURIComponent(regionSelect.value) +
              "/cities-municipalities";
          } else {
            path =
              "/provinces/" +
              encodeURIComponent(provinceSelect.value) +
              "/cities-municipalities";
          }

          const municipalities =
            await getPSGC(path);

          populateSelect(
            municipalitySelect,
            municipalities,
            "Select Municipality / City"
          );

          setText(
            locationMessage,
            "Select a municipality or city."
          );
        } catch (error) {
          setText(
            locationMessage,
            "Municipalities could not load: " +
              error.message
          );
        }

        updateConfirmButton();
      }
    );
  }

  if (municipalitySelect) {
    municipalitySelect.addEventListener(
      "change",
      () => {
        clearLocationConfirmation();

        setText(
          locationMessage,
          municipalitySelect.value
            ? "Click Confirm Location."
            : "Select a municipality or city."
        );

        updateConfirmButton();
      }
    );
  }

  // ============================================================
  // GEOCODING
  // ============================================================

  async function findMunicipalityCoordinates(
    municipality,
    province
  ) {
    const query = [
      municipality,
      province,
      "Philippines"
    ]
      .filter(Boolean)
      .join(", ");

    const url = new URL(PHOTON_API);

    url.searchParams.set("q", query);
    url.searchParams.set("limit", "10");
    url.searchParams.set("lang", "en");

    const data = await getJSON(url);

    if (!Array.isArray(data.features)) {
      throw new Error(
        "Unexpected geocoding response."
      );
    }

    const candidates = data.features.filter(
      feature => {
        const properties =
          feature.properties || {};

        const coordinates =
          feature.geometry?.coordinates;

        return (
          String(
            properties.countrycode || ""
          ).toUpperCase() === "PH" &&
          feature.geometry?.type === "Point" &&
          Array.isArray(coordinates) &&
          coordinates.length >= 2 &&
          Number.isFinite(coordinates[0]) &&
          Number.isFinite(coordinates[1])
        );
      }
    );

    if (!candidates.length) {
      throw new Error(
        "No Philippine map reference was found."
      );
    }

    const exact = candidates.find(feature => {
      return (
        normalize(feature.properties?.name) ===
        normalize(municipality)
      );
    });

    return exact || candidates[0];
  }

  if (confirmLocationButton) {
    confirmLocationButton.addEventListener(
      "click",
      async () => {
        if (confirmLocationButton.disabled) {
          return;
        }

        const municipality =
          optionName(municipalitySelect);

        const province =
          provinceSelect.value ===
          "__NO_PROVINCE__"
            ? ""
            : optionName(provinceSelect);

        const region =
          optionName(regionSelect);

        confirmLocationButton.disabled = true;

        setText(
          confirmLocationButton,
          "Confirming..."
        );

        setText(
          locationMessage,
          "Finding the municipality reference point..."
        );

        try {
          const feature =
            await findMunicipalityCoordinates(
              municipality,
              province
            );

          const [
            longitude,
            latitude
          ] = feature.geometry.coordinates;

          selectedLocation = {
            municipality,
            province,
            region,
            latitude,
            longitude
          };

          setText(
            selectedLocationLabel,
            fullLocationName()
          );

          setText(
            locationCoordinates,
            "Approximate municipality reference: " +
              latitude.toFixed(6) +
              ", " +
              longitude.toFixed(6)
          );

          setText(
            locationMessage,
            "Location confirmed successfully."
          );

          setDisabled(toWeatherButton, false);

          satelliteLoaded = false;
        } catch (error) {
          selectedLocation = null;

          setText(
            selectedLocationLabel,
            "Location could not be confirmed"
          );

          setText(
            locationCoordinates,
            "No coordinates available."
          );

          setText(
            locationMessage,
            "Location confirmation failed: " +
              error.message
          );

          setDisabled(toWeatherButton, true);
        } finally {
          setText(
            confirmLocationButton,
            "Confirm Location"
          );

          updateConfirmButton();
        }
      }
    );
  }

  // ============================================================
  // STAGE 2: WEATHER
  // ============================================================

  function clearWeather() {
    currentWeather = null;

    setText(precipitationValue, "—");
    setText(cloudCoverValue, "—");
    setText(weatherTimeValue, "—");

    setText(
      weatherCondition,
      "Waiting for weather data"
    );

    setText(
      weatherConditionDescription,
      "Weather information will appear after the selected location is processed."
    );

    if (weatherConditionCard) {
      weatherConditionCard.classList.remove(
        "good",
        "fair",
        "warning",
        "severe"
      );
    }

    setText(
      weatherMessage,
      "Waiting for weather request."
    );
  }

  function updateWeatherCondition(
    precipitation,
    cloudCover
  ) {
    if (!weatherConditionCard) return;

    weatherConditionCard.classList.remove(
      "good",
      "fair",
      "warning",
      "severe"
    );

    let label;
    let description;
    let className;

    if (precipitation >= 7.5) {
      label = "Heavy Rain";
      description =
        "Heavy modeled precipitation is present at the selected location.";
      className = "severe";
    } else if (precipitation >= 2.5) {
      label = "Moderate Rain";
      description =
        "Moderate modeled precipitation is present at the selected location.";
      className = "warning";
    } else if (precipitation > 0) {
      label = "Light Rain";
      description =
        "Light modeled precipitation is present at the selected location.";
      className = "fair";
    } else if (cloudCover >= 70) {
      label = "Cloudy";
      description =
        "High modeled cloud cover is present, but current precipitation is zero.";
      className = "fair";
    } else if (cloudCover >= 30) {
      label = "Partly Cloudy";
      description =
        "Moderate modeled cloud cover is present at the selected location.";
      className = "fair";
    } else {
      label = "Low Cloud Cover";
      description =
        "Current modeled cloud cover is relatively low.";
      className = "good";
    }

    setText(weatherCondition, label);

    setText(
      weatherConditionDescription,
      description
    );

    weatherConditionCard.classList.add(
      className
    );
  }

  async function loadWeather() {
    clearWeather();

    if (!selectedLocation) {
      setText(
        weatherMessage,
        "No location has been selected."
      );
      return;
    }

    setText(
      weatherLocation,
      fullLocationName()
    );

    setText(precipitationValue, "Loading...");
    setText(cloudCoverValue, "Loading...");
    setText(weatherTimeValue, "Loading...");

    setText(
      weatherMessage,
      "Retrieving current weather..."
    );

    try {
      const url = new URL(WEATHER_API);

      url.search = new URLSearchParams({
        latitude:
          String(selectedLocation.latitude),
        longitude:
          String(selectedLocation.longitude),
        current:
          "precipitation,cloud_cover",
        timezone:
          "Asia/Manila",
        forecast_days:
          "1"
      }).toString();

      const weather = await getJSON(url);

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
        !current.time
      ) {
        throw new Error(
          "Weather response is incomplete."
        );
      }

      currentWeather = {
        precipitation:
          current.precipitation,
        cloudCover:
          current.cloud_cover,
        time:
          current.time,
        precipitationUnit:
          units.precipitation || "mm"
      };

      setText(
        precipitationValue,
        current.precipitation.toFixed(2) +
          " " +
          (units.precipitation || "mm")
      );

      setText(
        cloudCoverValue,
        Math.round(current.cloud_cover) + "%"
      );

      setText(
        weatherTimeValue,
        current.time.replace("T", " ") +
          " PHT"
      );

      updateWeatherCondition(
        current.precipitation,
        current.cloud_cover
      );

      setText(
        weatherMessage,
        "Current weather loaded successfully."
      );

      setDisabled(toSatelliteButton, false);
    } catch (error) {
      clearWeather();

      setText(
        weatherMessage,
        "Weather could not load: " +
          error.message
      );
    }
  }

  // ============================================================
  // STAGE 3: HIMAWARI SOUTHEAST ASIA 2
  // ============================================================

  function roundToTenMinutes(date) {
    const result = new Date(date.getTime());

    result.setUTCMinutes(
      Math.floor(
        result.getUTCMinutes() / 10
      ) * 10,
      0,
      0
    );

    return result;
  }

  function slotCode(date) {
    return (
      String(date.getUTCHours())
        .padStart(2, "0") +
      String(date.getUTCMinutes())
        .padStart(2, "0")
    );
  }

  function formatSatelliteTime(date) {
    const options = {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    };

    const utc = new Intl.DateTimeFormat(
      "en-PH",
      {
        ...options,
        timeZone: "UTC"
      }
    ).format(date);

    const pht = new Intl.DateTimeFormat(
      "en-PH",
      {
        ...options,
        timeZone: "Asia/Manila"
      }
    ).format(date);

    return utc + " UTC / " + pht + " PHT";
  }

  function testImage(url) {
    return new Promise((resolve, reject) => {
      const tester = new Image();

      tester.onload = () => resolve(url);

      tester.onerror = () => reject(
        new Error("Image unavailable")
      );

      tester.src =
        url + "?test=" + Date.now();
    });
  }

  function displaySatelliteImage(url) {
    return new Promise((resolve, reject) => {
      if (!himawariImage) {
        reject(
          new Error("Satellite image element missing.")
        );
        return;
      }

      himawariImage.onload = () => resolve();

      himawariImage.onerror = () => reject(
        new Error(
          "The JMA image was found but could not be displayed."
        )
      );

      himawariImage.src =
        url + "?display=" + Date.now();
    });
  }

  async function loadHimawari() {
    if (satelliteLoading) return;

    if (!selectedLocation) {
      setText(
        satelliteStatus,
        "No location selected."
      );
      return;
    }

    satelliteLoading = true;
    satelliteLoaded = false;

    setText(
      satelliteLocation,
      fullLocationName()
    );

    if (himawariImage) {
      himawariImage.hidden = true;
    }

    if (satellitePlaceholder) {
      satellitePlaceholder.hidden = false;
    }

    setText(
      satellitePlaceholder,
      "Loading latest Himawari B07 imagery..."
    );

    setText(
      satelliteStatus,
      "Searching recent Himawari B07 image slots..."
    );

    setText(
      satelliteObservationTime,
      "Checking..."
    );

    setDisabled(loadSatelliteButton, true);

    setText(
      loadSatelliteButton,
      "Loading B07..."
    );

    const initial = roundToTenMinutes(
      new Date(
        Date.now() - 20 * 60 * 1000
      )
    );

    try {
      let found = false;

      for (
        let offset = 0;
        offset < 18;
        offset++
      ) {
        const candidate = new Date(
          initial.getTime() -
            offset * 10 * 60 * 1000
        );

        const code = slotCode(candidate);

        const possibleNames = [
          "se2_b07_" + code + ".jpg",
          "se2_b07_" + code + ".png",
          "se2_b07_" + code + ".gif"
        ];

        for (const filename of possibleNames) {
          const imageURL =
            JMA_BASE + filename;

          try {
            await testImage(imageURL);
            await displaySatelliteImage(imageURL);

            if (himawariImage) {
              himawariImage.hidden = false;
            }

            if (satellitePlaceholder) {
              satellitePlaceholder.hidden = true;
            }

            setText(
              satelliteObservationTime,
              formatSatelliteTime(candidate)
            );

            setText(
              satelliteStatus,
              "Latest available Himawari B07 imagery loaded successfully."
            );

            satelliteLoaded = true;
            found = true;
            break;
          } catch (error) {
            // Try the next image.
          }
        }

        if (found) break;
      }

      if (!found) {
        throw new Error(
          "No recent Himawari B07 image could be loaded."
        );
      }
    } catch (error) {
      if (himawariImage) {
        himawariImage.hidden = true;
      }

      if (satellitePlaceholder) {
        satellitePlaceholder.hidden = false;
      }

      setText(
        satellitePlaceholder,
        "Himawari B07 imagery is temporarily unavailable."
      );

      setText(
        satelliteStatus,
        "Satellite image could not load: " +
          error.message
      );

      setText(
        satelliteObservationTime,
        "Unavailable"
      );

      satelliteLoaded = false;
    } finally {
      satelliteLoading = false;

      setDisabled(loadSatelliteButton, false);

      setText(
        loadSatelliteButton,
        "Load Latest Himawari B07"
      );
    }
  }

  if (loadSatelliteButton) {
    loadSatelliteButton.addEventListener(
      "click",
      loadHimawari
    );
  }

  // ============================================================
  // STAGE 4: MATLAB U-NET
  // ============================================================

  // This section uses REAL MATLAB-exported results.
  // It never generates fake accuracy or IoU values.

  function getAvailableMatlabPatches() {
    const results = window.demoResults || {};

    return Object.keys(results)
      .map(Number)
      .filter(patchNumber =>
        Number.isInteger(patchNumber) &&
        patchNumber >= 1 &&
        patchNumber <= 800 &&
        results[patchNumber]
      )
      .sort((a, b) => a - b);
  }

  function getCloudCondition(cloudPercent) {
    if (cloudPercent < 20) {
      return {
        label: "GOOD",
        className: "good",
        note:
          "Low predicted cloud coverage. Actual weather and link measurements are still required."
      };
    }

    if (cloudPercent < 40) {
      return {
        label: "FAIR",
        className: "fair",
        note:
          "Moderate predicted cloud coverage. Weather measurements are needed to assess possible signal loss."
      };
    }

    if (cloudPercent < 70) {
      return {
        label: "CLOUDY",
        className: "warning",
        note:
          "High predicted cloud coverage is present. Additional weather and link measurements are needed."
      };
    }

    return {
      label: "VERY CLOUDY",
      className: "severe",
      note:
        "Very high predicted cloud coverage is present. Rain and satellite-link measurements are required for reliability assessment."
    };
  }

  function loadMatlabDemo(patchNumber) {
    const results = window.demoResults;

    if (!results) {
      console.error(
        "demo-results.js has not been loaded."
      );

      setText(
        matlabConditionNote,
        "MATLAB results are unavailable. Check that demo-results.js loads before script.js."
      );

      return;
    }

    const numericPatch = Number(patchNumber);

    if (
      !Number.isInteger(numericPatch) ||
      !results[numericPatch]
    ) {
      console.warn(
        "MATLAB result for patch " +
          patchNumber +
          " is unavailable."
      );

      return;
    }

    const result = results[numericPatch];

    currentMatlabPatch = numericPatch;

    const accuracy =
      Number(result.pixelAccuracyPercent);

    const iou =
      Number(result.cloudIoUPercent);

    const predictedCoverage =
      Number(result.predictedCloudPercent);

    const actualCoverage =
      Number(result.actualCloudPercent);

    // PATCH NUMBER
    setText(
      matlabPatchNumber,
      String(numericPatch)
    );

    // ACCURACY
    setText(
      matlabAccuracy,
      Number.isFinite(accuracy)
        ? accuracy.toFixed(2) + "%"
        : "—"
    );

    // CLOUD IoU
    setText(
      matlabIoU,
      Number.isFinite(iou)
        ? iou.toFixed(2) + "%"
        : "—"
    );

    // CLOUD COVERAGE
    setText(
      matlabCoverage,
      formatPercent(predictedCoverage)
    );

    // ACTUAL CLOUD COVERAGE
    setText(
      matlabActualCoverage,
      Number.isFinite(actualCoverage)
        ? actualCoverage.toFixed(2) +
            "% coverage"
        : "Coverage unavailable"
    );

    // PREDICTED CLOUD COVERAGE
    setText(
      matlabPredictedCoverage,
      Number.isFinite(predictedCoverage)
        ? predictedCoverage.toFixed(2) +
            "% coverage"
        : "Coverage unavailable"
    );

    // FOUR MATLAB-GENERATED IMAGES
    if (
      matlabSatelliteImage &&
      result.satelliteImage
    ) {
      matlabSatelliteImage.src =
        result.satelliteImage;

      matlabSatelliteImage.alt =
        "Satellite RGB preview for test patch " +
        numericPatch;
    }

    if (
      matlabActualMask &&
      result.actualMask
    ) {
      matlabActualMask.src =
        result.actualMask;

      matlabActualMask.alt =
        "Actual cloud mask for test patch " +
        numericPatch;
    }

    if (
      matlabPredictedMask &&
      result.predictedMask
    ) {
      matlabPredictedMask.src =
        result.predictedMask;

      matlabPredictedMask.alt =
        "Predicted cloud mask for test patch " +
        numericPatch;
    }

    if (
      matlabOverlayImage &&
      result.overlayImage
    ) {
      matlabOverlayImage.src =
        result.overlayImage;

      matlabOverlayImage.alt =
        "Predicted clouds highlighted in red for test patch " +
        numericPatch;
    }

    // CONDITION
    if (Number.isFinite(predictedCoverage)) {
      const fallback =
        getCloudCondition(predictedCoverage);

      const exportedLabel =
        typeof result.condition === "string"
          ? result.condition.trim().toUpperCase()
          : "";

      const label =
        exportedLabel || fallback.label;

      let className = "fair";

      if (label === "GOOD") {
        className = "good";
      } else if (label === "CLOUDY") {
        className = "warning";
      } else if (label === "VERY CLOUDY") {
        className = "severe";
      }

      const note =
        typeof result.conditionNote === "string" &&
        result.conditionNote.trim()
          ? result.conditionNote
          : fallback.note;

      setText(matlabCondition, label);
      setText(matlabConditionNote, note);

      if (matlabConditionCard) {
        matlabConditionCard.classList.remove(
          "good",
          "fair",
          "warning",
          "severe"
        );

        matlabConditionCard.classList.add(
          className
        );
      }
    }

    console.log(
      "MATLAB test patch loaded:",
      numericPatch
    );
  }

  // ============================================================
  // RANDOM MATLAB PATCH SELECTION
  // ============================================================

  function loadRandomMatlabDemo() {
    const availablePatches =
      getAvailableMatlabPatches();

    if (availablePatches.length === 0) {
      console.error(
        "No MATLAB test patches are available."
      );

      setText(
        matlabConditionNote,
        "No MATLAB results were loaded. Verify demo-results.js."
      );

      return;
    }

    // Exclude the currently displayed patch,
    // preventing immediate repetition.
    let choices = availablePatches.filter(
      patchNumber =>
        patchNumber !== currentMatlabPatch
    );

    if (choices.length === 0) {
      choices = availablePatches;
    }

    const randomIndex = Math.floor(
      Math.random() * choices.length
    );

    const selectedPatch =
      choices[randomIndex];

    loadMatlabDemo(selectedPatch);
  }

  // ============================================================
  // STAGE 5: SATELLITE-LINK ASSESSMENT
  // ============================================================

  const coefficientTable = [
    {
      f: 4,
      kH: 0.0001071,
      aH: 1.6009,
      kV: 0.0002461,
      aV: 1.2476
    },
    {
      f: 5,
      kH: 0.0002162,
      aH: 1.6969,
      kV: 0.0002428,
      aV: 1.5317
    },
    {
      f: 6,
      kH: 0.0007056,
      aH: 1.5900,
      kV: 0.0004878,
      aV: 1.5728
    },
    {
      f: 7,
      kH: 0.001915,
      aH: 1.4810,
      kV: 0.001425,
      aV: 1.4745
    },
    {
      f: 8,
      kH: 0.004115,
      aH: 1.3905,
      kV: 0.003450,
      aV: 1.3797
    },
    {
      f: 9,
      kH: 0.007535,
      aH: 1.3155,
      kV: 0.006691,
      aV: 1.2895
    },
    {
      f: 10,
      kH: 0.01217,
      aH: 1.2571,
      kV: 0.01129,
      aV: 1.2156
    },
    {
      f: 12,
      kH: 0.02455,
      aH: 1.1216,
      kV: 0.02204,
      aV: 1.1195
    },
    {
      f: 15,
      kH: 0.04481,
      aH: 1.1233,
      kV: 0.05008,
      aV: 1.0440
    },
    {
      f: 20,
      kH: 0.09164,
      aH: 1.0568,
      kV: 0.09611,
      aV: 0.9847
    }
  ];

  function interpolateCoefficient(
    frequency,
    property
  ) {
    const first = coefficientTable[0];

    const last =
      coefficientTable[
        coefficientTable.length - 1
      ];

    if (
      frequency < first.f ||
      frequency > last.f
    ) {
      throw new Error(
        "Use a frequency between 4 and 20 GHz."
      );
    }

    const exact = coefficientTable.find(
      row => row.f === frequency
    );

    if (exact) {
      return exact[property];
    }

    for (
      let index = 0;
      index < coefficientTable.length - 1;
      index++
    ) {
      const lower =
        coefficientTable[index];

      const upper =
        coefficientTable[index + 1];

      if (
        frequency > lower.f &&
        frequency < upper.f
      ) {
        const ratio =
          (
            Math.log10(frequency) -
            Math.log10(lower.f)
          ) /
          (
            Math.log10(upper.f) -
            Math.log10(lower.f)
          );

        if (
          property === "kH" ||
          property === "kV"
        ) {
          const logLower =
            Math.log10(lower[property]);

          const logUpper =
            Math.log10(upper[property]);

          return Math.pow(
            10,
            logLower +
              ratio * (logUpper - logLower)
          );
        }

        return (
          lower[property] +
          ratio *
            (
              upper[property] -
              lower[property]
            )
        );
      }
    }

    throw new Error(
      "Coefficient interpolation failed."
    );
  }

  function calculateCoefficients(
    frequency,
    polarizationType,
    elevationDegrees
  ) {
    const kH = interpolateCoefficient(
      frequency,
      "kH"
    );

    const kV = interpolateCoefficient(
      frequency,
      "kV"
    );

    const alphaH = interpolateCoefficient(
      frequency,
      "aH"
    );

    const alphaV = interpolateCoefficient(
      frequency,
      "aV"
    );

    let tauDegrees = 0;

    if (polarizationType === "vertical") {
      tauDegrees = 90;
    }

    if (polarizationType === "circular") {
      tauDegrees = 45;
    }

    const theta =
      elevationDegrees * Math.PI / 180;

    const tau =
      tauDegrees * Math.PI / 180;

    const geometryTerm =
      Math.pow(Math.cos(theta), 2) *
      Math.cos(2 * tau);

    const k =
      (
        kH +
        kV +
        (kH - kV) * geometryTerm
      ) / 2;

    if (
      !Number.isFinite(k) ||
      k <= 0
    ) {
      throw new Error(
        "Invalid attenuation coefficient."
      );
    }

    const alpha =
      (
        kH * alphaH +
        kV * alphaV +
        (
          kH * alphaH -
          kV * alphaV
        ) * geometryTerm
      ) /
      (2 * k);

    if (!Number.isFinite(alpha)) {
      throw new Error(
        "Invalid attenuation exponent."
      );
    }

    return {
      k,
      alpha
    };
  }

  function getImpactCategory(attenuation) {
    if (attenuation < 0.01) {
      return {
        label: "Minimal",
        explanation:
          "The calculated rain-specific attenuation is currently very small."
      };
    }

    if (attenuation < 0.10) {
      return {
        label: "Low",
        explanation:
          "The current rain rate introduces a relatively small propagation loss per kilometre."
      };
    }

    if (attenuation < 0.50) {
      return {
        label: "Moderate",
        explanation:
          "Rain attenuation is becoming significant and may affect the satellite link."
      };
    }

    if (attenuation < 1.00) {
      return {
        label: "High",
        explanation:
          "The calculated rain-specific attenuation indicates substantial rain-related propagation loss."
      };
    }

    return {
      label: "Very High",
      explanation:
        "The calculated rain-specific attenuation indicates severe rain-related propagation loss per kilometre."
    };
  }

  function synchronizeLinkAssessment() {
    setText(
      linkLocation,
      fullLocationName()
    );

    if (currentWeather) {
      setText(
        linkRainDisplay,
        currentWeather.precipitation.toFixed(2) +
          " " +
          currentWeather.precipitationUnit
      );

      setText(
        linkCloudDisplay,
        Math.round(currentWeather.cloudCover) +
          "%"
      );

      if (rainRate) {
        rainRate.value =
          currentWeather.precipitation;
      }
    } else {
      setText(linkRainDisplay, "—");
      setText(linkCloudDisplay, "—");
    }
  }

  function updateFrequencyFromBand() {
    if (!frequencyBand || !frequencyInput) {
      return;
    }

    const selectedBand =
      frequencyBand.value.toLowerCase();

    if (selectedBand === "c") {
      frequencyInput.value = "6";
    } else if (selectedBand === "ku") {
      frequencyInput.value = "12";
    }
  }

  if (frequencyBand) {
    frequencyBand.addEventListener(
      "change",
      updateFrequencyFromBand
    );
  }

  function calculateRainAttenuation() {
    const frequency =
      Number(frequencyInput?.value);

    const elevation =
      Number(elevationAngle?.value);

    const rainfall =
      Number(rainRate?.value);

    const polarizationType =
      polarization?.value || "horizontal";

    if (
      !Number.isFinite(frequency) ||
      frequency < 4 ||
      frequency > 20
    ) {
      setText(
        linkResultExplanation,
        "Enter a valid frequency between 4 and 20 GHz."
      );
      return;
    }

    if (
      !Number.isFinite(elevation) ||
      elevation < 0 ||
      elevation > 90
    ) {
      setText(
        linkResultExplanation,
        "Enter a valid elevation angle from 0 to 90 degrees."
      );
      return;
    }

    if (
      !Number.isFinite(rainfall) ||
      rainfall < 0
    ) {
      setText(
        linkResultExplanation,
        "Enter a valid nonnegative rain rate."
      );
      return;
    }

    try {
      const { k, alpha } =
        calculateCoefficients(
          frequency,
          polarizationType,
          elevation
        );

      // ITU-R P.838 rain-specific attenuation:
      // gamma_R = k * R^alpha
      const gammaR =
        k * Math.pow(rainfall, alpha);

      const impact =
        getImpactCategory(gammaR);

      setText(
        specificAttenuation,
        gammaR.toFixed(4) + " dB/km"
      );

      setText(
        coefficientK,
        k.toFixed(6)
      );

      setText(
        coefficientAlpha,
        alpha.toFixed(4)
      );

      setText(
        linkImpact,
        impact.label
      );

      setText(
        linkImpactBadge,
        impact.label
      );

      setText(
        linkResultExplanation,
        impact.explanation +
          " This result is specific attenuation in dB/km, not total satellite-link loss or link availability."
      );
    } catch (error) {
      setText(
        linkResultExplanation,
        "Calculation failed: " +
          error.message
      );
    }
  }

  if (calculateAttenuationButton) {
    calculateAttenuationButton.addEventListener(
      "click",
      calculateRainAttenuation
    );
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  async function initialize() {
    console.log(
      "Initializing Cloud Segmentation Prototype..."
    );

    // Load MATLAB result metadata.
    const availablePatches =
      getAvailableMatlabPatches();

    console.log(
      "Available MATLAB test patches:",
      availablePatches.length
    );

    if (availablePatches.length > 0) {
      console.log(
        "MATLAB patch range:",
        availablePatches[0],
        "to",
        availablePatches[
          availablePatches.length - 1
        ]
      );
    } else {
      console.warn(
        "No MATLAB results detected. Check demo-results.js."
      );
    }

    resetSelect(
      regionSelect,
      "Loading regions..."
    );

    resetSelect(
      provinceSelect,
      "Select a region first"
    );

    resetSelect(
      municipalitySelect,
      "Select a province first"
    );

    setDisabled(toWeatherButton, true);
    setDisabled(toSatelliteButton, true);

    try {
      const regions =
        await getPSGC("/regions");

      populateSelect(
        regionSelect,
        regions,
        "Select Region"
      );

      setText(
        locationMessage,
        "Select a Philippine region."
      );
    } catch (error) {
      setText(
        locationMessage,
        "Regions could not load: " +
          error.message
      );
    }

    // Begin at Stage 1.
    // Do NOT force any specific MATLAB patch.
    showStep(1);

    console.log(
      "Prototype initialization complete."
    );
  }

  initialize();
});
