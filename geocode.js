"use strict";

(() => {
  const form = document.getElementById("addressForm");
  const button = document.getElementById("findAddressButton");
  const message = document.getElementById("addressMessage");

  const region = document.getElementById("addressRegion");
  const province = document.getElementById("addressProvince");
  const city = document.getElementById("addressCity");
  const barangay = document.getElementById("addressBarangay");

  const selectedLocation =
    document.getElementById("mapSelectedLocation");

  const mapMessage =
    document.getElementById("mapMessage");

  const weatherButton =
    document.getElementById("mapWeatherButton");

  const continueButton =
    document.getElementById("continueWeather");

  if (!form || !button || !message) {
    return;
  }

  const SEARCH_URL = "https://photon.komoot.io/api/";
  const cache = new Map();

  let busy = false;
  let revision = 0;
  let activeController = null;

  // Search results appear below the address form.
  const results = document.createElement("div");
  results.id = "addressLookupResults";
  results.style.display = "grid";
  results.style.gap = "10px";

  message.after(results);

  const credit = document.createElement("p");
  credit.className = "note";

  const sourceLink = document.createElement("a");
  sourceLink.href = "https://www.openstreetmap.org/copyright";
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener noreferrer";
  sourceLink.textContent = "OpenStreetMap contributors";

  credit.append(
    "Address search: Photon. Location data © ",
    sourceLink,
    ". Search results are approximate map reference points. ",
    "Confirm your intended location on the map."
  );

  results.after(credit);

  function nameOf(select) {
    if (!select || !select.value) {
      return "";
    }

    return select.selectedOptions[0].textContent.trim();
  }

  function updateButton() {
    button.disabled =
      busy ||
      !region.value ||
      !province.value ||
      !city.value ||
      !barangay.value;
  }

  function disableContinue() {
    weatherButton.disabled = true;

    if (continueButton) {
      continueButton.disabled = true;
    }
  }

  function addressChanged() {
    revision += 1;
    results.replaceChildren();

    if (activeController) {
      activeController.abort();
    }

    window.selectedMapPoint = null;
    disableContinue();

    selectedLocation.textContent =
      "Address changed. Click Find Address on Map.";

    updateButton();
  }

  form.addEventListener("input", addressChanged);
  form.addEventListener("change", addressChanged);

  function isPhilippinePoint(feature) {
    const properties = feature.properties || {};
    const geometry = feature.geometry || {};
    const coordinates = geometry.coordinates;

    return (
      String(properties.countrycode || "").toUpperCase() === "PH" &&
      geometry.type === "Point" &&
      Array.isArray(coordinates) &&
      coordinates.length >= 2 &&
      Number.isFinite(coordinates[0]) &&
      Number.isFinite(coordinates[1])
    );
  }

  function resultLabel(feature) {
    const p = feature.properties || {};

    const parts = [
      p.name,
      p.street,
      p.district,
      p.locality,
      p.city,
      p.county,
      p.state,
      p.country
    ].filter(Boolean);

    return [...new Set(parts)].join(", ") ||
      "Philippine map reference";
  }

  async function searchAddress(query) {
    const cacheKey = query.toLowerCase();

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const controller = new AbortController();
    activeController = controller;

    const timeout = setTimeout(() => {
      controller.abort();
    }, 20000);

    try {
      const url = new URL(SEARCH_URL);

      url.searchParams.set("q", query);
      url.searchParams.set("limit", "10");
      url.searchParams.set("lang", "en");

      const response = await fetch(url, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(
          "Address service returned HTTP " + response.status + "."
        );
      }

      const data = await response.json();

      if (!Array.isArray(data.features)) {
        throw new Error("Unexpected address-search response.");
      }

      const matches = data.features.filter(isPhilippinePoint);

      cache.set(cacheKey, matches);

      return matches;
    } finally {
      clearTimeout(timeout);

      if (activeController === controller) {
        activeController = null;
      }
    }
  }

  function displayResults(features, requestRevision, broaderSearch) {
    results.replaceChildren();

    features.forEach((feature) => {
      const label = resultLabel(feature);
      const [longitude, latitude] = feature.geometry.coordinates;

      const resultButton = document.createElement("button");
      resultButton.type = "button";
      resultButton.textContent = label;
      resultButton.style.textAlign = "left";
      resultButton.style.marginTop = "0";

      resultButton.addEventListener("click", () => {
        if (revision !== requestRevision) {
          message.textContent =
            "The address changed. Search again.";
          return;
        }

        if (typeof window.selectMapPoint !== "function") {
          message.textContent =
            "The map is not ready. Refresh the website.";
          return;
        }

        // Move the map. map.js checks the selected coordinates.
        window.selectMapPoint(latitude, longitude, true);

        message.textContent = broaderSearch
          ? "Map moved to the reference you selected. " +
            "This is a broader search result, not a confirmed barangay point. " +
            "Zoom in and click your intended location."
          : "Map moved to the search result you selected. " +
            "Check the marker and click your intended location if needed.";

        results.querySelectorAll("button").forEach((item) => {
          item.style.outline = "";
        });

        resultButton.style.outline = "3px solid #e895bc";
      });

      results.appendChild(resultButton);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy || !form.reportValidity()) {
      return;
    }

    if (typeof window.selectMapPoint !== "function") {
      message.textContent =
        "The map is not ready. Refresh the website.";
      return;
    }

    const requestRevision = revision;

    const cityName = nameOf(city);
    const barangayName = nameOf(barangay);

    const provinceName =
      province.value === "__NO_PROVINCE__"
        ? ""
        : nameOf(province);

    const query = [
      barangayName,
      cityName,
      provinceName,
      "Philippines"
    ].filter(Boolean).join(", ");

    busy = true;
    updateButton();

    button.textContent = "Searching...";
    results.replaceChildren();

    window.selectedMapPoint = null;
    disableContinue();

    selectedLocation.textContent =
      "Searching the selected address...";

    message.textContent = "Searching for " + query + "...";

    try {
      let matches = await searchAddress(query);
      let broaderSearch = false;

      if (revision !== requestRevision) {
        return;
      }

      // If there are no results, offer a clearly labeled broader
      // search. Do not automatically use a municipality center.
      if (matches.length === 0) {
        broaderSearch = true;

        const broaderQuery = [
          cityName,
          provinceName,
          "Philippines"
        ].filter(Boolean).join(", ");

        message.textContent =
          "No barangay results found. Searching nearby map references...";

        matches = await searchAddress(broaderQuery);
      }

      if (revision !== requestRevision) {
        return;
      }

      if (matches.length === 0) {
        selectedLocation.textContent =
          "No address reference selected.";

        message.textContent =
          "No search results found. Zoom and click your intended " +
          "location directly on the map.";
        return;
      }

      displayResults(
        matches,
        requestRevision,
        broaderSearch
      );

      selectedLocation.textContent =
        "Select a search result below the address form.";

      mapMessage.textContent =
        "The dropdown address has not yet confirmed a map point.";

      message.textContent = broaderSearch
        ? "No barangay result was found. These are broader search " +
          "references. Select one to navigate the map, then click " +
          "your intended point."
        : "Select the result matching your address. Check its " +
          "municipality and province before selecting.";
    } catch (error) {
      if (revision !== requestRevision) {
        return;
      }

      selectedLocation.textContent =
        "Address lookup did not complete.";

      message.textContent =
        error.name === "AbortError"
          ? "The search timed out. Try again or choose a point directly on the map."
          : "Address lookup failed: " + error.message;
    } finally {
      busy = false;
      button.textContent = "Find Address on Map";
      updateButton();
    }
  });

  updateButton();
})();
