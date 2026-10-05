"use strict";

(() => {
  const get = id => document.getElementById(id);
  const region = get("addressRegion");
  const province = get("addressProvince");
  const city = get("addressCity");
  const form = get("addressForm");
  const button = get("findAddressButton");
  const message = get("addressMessage");
  const results = get("municipalityResults");

  const API = "https://psgc.cloud/api";
  const cache = new Map();

  let version = 0;
  let busy = false;

  const nameOf = select =>
    select.value ? select.selectedOptions[0].textContent.trim() : "";

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\b(city of|municipality of|province of)\b/g, "")
      .replace(/\b(city|municipality|province)\b/g, "")
      .replace(/[().]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function reset(select, text) {
    select.replaceChildren(new Option(text, ""));
    select.disabled = true;
  }

  function populate(select, items, text) {
    reset(select, text);

    [...items]
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(item => {
        select.add(new Option(item.name, String(item.code)));
      });

    select.disabled = !items.length;
  }

  async function json(url) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      throw new Error("Service returned HTTP " + response.status);
    }

    return response.json();
  }

  async function list(path) {
    if (cache.has(path)) return cache.get(path);

    const data = await json(API + path);
    if (!Array.isArray(data)) throw new Error("Invalid address list.");

    cache.set(path, data);
    return data;
  }

  function updateButton() {
    button.disabled =
      busy || !region.value || !province.value || !city.value;
  }

  function clearSelection() {
    window.selectedManualAddress = null;
    window.selectedMunicipality = null;
    window.selectedMapPoint = null;

    results.replaceChildren();
    get("mapWeatherButton").disabled = true;
    get("continueWeather").disabled = true;
    get("mapSelectedLocation").textContent = "No municipality confirmed.";
    get("mapMessage").textContent = "";

    window.dispatchEvent(new Event("municipality-cleared"));
    updateButton();
  }

  region.addEventListener("change", async () => {
    const current = ++version;
    clearSelection();

    reset(province, "Select a province");
    reset(city, "Select a province first");

    if (!region.value) return;

    message.textContent = "Loading provinces...";

    try {
      const items = await list(
        "/regions/" + encodeURIComponent(region.value) + "/provinces"
      );

      if (current !== version) return;

      if (items.length) {
        populate(province, items, "Select Province");
      } else {
        populate(
          province,
          [{ code: "__NO_PROVINCE__", name: "No province layer" }],
          "Select administrative option"
        );
      }

      message.textContent = "Select a province or administrative option.";
    } catch (error) {
      if (current === version) message.textContent = error.message;
    }

    updateButton();
  });

  province.addEventListener("change", async () => {
    const current = ++version;
    clearSelection();
    reset(city, "Select Municipality / City");

    if (!province.value) return;

    const path = province.value === "__NO_PROVINCE__"
      ? "/regions/" + encodeURIComponent(region.value) + "/cities-municipalities"
      : "/provinces/" + encodeURIComponent(province.value) + "/cities-municipalities";

    message.textContent = "Loading municipalities and cities...";

    try {
      const items = await list(path);

      if (current !== version) return;

      populate(city, items, "Select Municipality / City");
      message.textContent = "Select a municipality / city.";
    } catch (error) {
      if (current === version) message.textContent = error.message;
    }

    updateButton();
  });

  city.addEventListener("change", () => {
    version++;
    clearSelection();

    message.textContent = city.value
      ? "Click Find Municipality."
      : "Select a municipality / city.";

    updateButton();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (busy || !form.reportValidity()) return;

    const current = version;
    const municipality = nameOf(city);
    const provinceName = province.value === "__NO_PROVINCE__"
      ? ""
      : nameOf(province);

    const selection = {
      country: "Philippines",
      region: nameOf(region),
      province: provinceName,
      municipality: municipality,
      code: city.value
    };

    busy = true;
    updateButton();
    results.replaceChildren();
    message.textContent = "Searching municipality references...";

    try {
      const url = new URL("https://photon.komoot.io/api/");

      url.searchParams.set(
        "q",
        [municipality, provinceName, "Philippines"].filter(Boolean).join(", ")
      );

      url.searchParams.set("limit", "10");
      url.searchParams.set("lang", "en");

      const data = await json(url);

      if (current !== version) return;
      if (!Array.isArray(data.features)) throw new Error("Invalid search result.");

      const matches = data.features.filter(feature => {
        const p = feature.properties || {};
        const coordinates = feature.geometry?.coordinates;

        const matchesProvince = !provinceName ||
          [p.state, p.county].some(
            value => normalize(value) === normalize(provinceName)
          );

        return (
          String(p.countrycode || "").toUpperCase() === "PH" &&
          normalize(p.name) === normalize(municipality) &&
          p.osm_key === "place" &&
          matchesProvince &&
          feature.geometry?.type === "Point" &&
          Array.isArray(coordinates) &&
          coordinates.every(Number.isFinite)
        );
      });

      if (!matches.length) {
        throw new Error(
          "No matching municipality reference found. " +
          "The address service may lack this locality or its province information."
        );
      }

      message.textContent =
        "Select the matching municipality reference. Source: Photon / OpenStreetMap.";

      matches.forEach(feature => {
        const p = feature.properties;
        const label = [...new Set(
          [p.name, p.city, p.county, p.state, p.country].filter(Boolean)
        )].join(", ");

        const option = document.createElement("button");
        option.type = "button";
        option.textContent = label;

        option.onclick = () => {
          if (current !== version) return;

          if (typeof window.selectMapPoint !== "function") {
            message.textContent = "Map is not ready. Refresh the page.";
            return;
          }

          window.selectedManualAddress = selection;
          window.selectedMunicipality = selection;

          const [longitude, latitude] = feature.geometry.coordinates;

          window.selectMapPoint(
            latitude,
            longitude,
            true,
            true
          );

          message.textContent =
            "Municipality selected. Continue with its reference point, " +
            "or choose a point on the map.";
        };

        results.appendChild(option);
      });
    } catch (error) {
      if (current === version) message.textContent = error.message;
    } finally {
      busy = false;
      updateButton();
    }
  });

  async function initialize() {
    reset(region, "Loading regions...");
    reset(province, "Select a region first");
    reset(city, "Select a province first");

    try {
      populate(region, await list("/regions"), "Select Region");
      message.textContent =
        "Select region, province, and municipality / city. Address lists: PSGC Cloud.";
    } catch (error) {
      message.textContent = "Address lists could not load: " + error.message;
    }

    updateButton();
  }

  initialize();
})();
