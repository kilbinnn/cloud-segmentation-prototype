"use strict";

(() => {
  const main = document.querySelector("main");
  const get = id => document.getElementById(id);
  const panelOf = id => get(id).closest("section.panel");

  // Reuse existing sections and controls.
  const addressPanel = panelOf("addressForm");
  const searchPanel = panelOf("searchForm");
  const mapPanel = panelOf("locationMap");
  const municipalityPanel = panelOf("locationForm");
  const weatherPanel = panelOf("weatherMessage");
  const satellitePanel = panelOf("himawariImage");
  const demoPanel = panelOf("demoForm");

  const linkPanel = [...main.querySelectorAll("section.panel")]
    .find(panel =>
      panel.querySelector("h2")?.textContent.trim() ===
      "Satellite Link Assessment"
    );

  if (!linkPanel) {
    console.error("Satellite Link Assessment section is missing.");
    return;
  }

  // Add styles for the navigation.
  const style = document.createElement("style");

  style.textContent = `
    [hidden] {
      display: none !important;
    }

    .flow-progress {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 22px;
    }

    .flow-progress span {
      padding: 8px 14px;
      border-radius: 24px;
      background: #f5dfe9;
      color: #70435a;
      font-size: 14px;
      font-weight: 600;
    }

    .flow-progress span.active {
      background: #a82d62;
      color: white;
    }

    .flow-tabs,
    .flow-actions {
      display: flex;
      gap: 12px;
      margin: 18px 0;
    }

    .flow-tabs button {
      background: #f5dfe9;
      color: #59243e;
      border: 1px solid #dbadc2;
    }

    .flow-tabs button.active {
      background: #a82d62;
      color: white;
    }

    .flow-actions .back-button {
      background: white;
      border: 1px solid #a82d62;
      color: #a82d62;
    }

    .flow-search-result {
      background: #fff0f6;
      color: #59243e;
      border: 1px solid #dbadc2;
      text-align: left;
    }

    @media (max-width: 600px) {
      .flow-tabs,
      .flow-actions {
        flex-direction: column;
      }
    }
  `;

  document.head.append(style);

  function makeButton(text, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", action);
    return button;
  }

  // Four separate views on the same webpage.
  const views = [];

  for (let index = 0; index < 4; index++) {
    const view = document.createElement("div");
    view.hidden = true;
    views.push(view);
  }

  const progress = document.createElement("nav");
  progress.className = "flow-progress";
  progress.setAttribute("aria-label", "Analysis progress");

  const names = [
    "1. Location",
    "2. Weather",
    "3. Segmentation Demo",
    "4. Link Assessment"
  ];

  const progressItems = names.map(name => {
    const item = document.createElement("span");
    item.textContent = name;
    progress.append(item);
    return item;
  });

  // First view: input choices.
  const choicePanel = document.createElement("section");
  choicePanel.className = "panel";

  const choiceTitle = document.createElement("h2");
  choiceTitle.textContent = "Choose Your Location";

  const tabs = document.createElement("div");
  tabs.className = "flow-tabs";

  const searchTab = makeButton("Enter Address", () => setMode("search"));
  const mapTab = makeButton("Choose Point on Map", () => setMode("map"));

  searchTab.setAttribute("aria-controls", "searchMode");
  mapTab.setAttribute("aria-controls", "mapMode");

  tabs.append(searchTab, mapTab);
  choicePanel.append(choiceTitle, tabs);

  const searchMode = document.createElement("div");
  searchMode.id = "searchMode";
  searchMode.append(searchPanel);

  const mapMode = document.createElement("div");
  mapMode.id = "mapMode";
  mapMode.append(addressPanel, mapPanel);

  // Show selected location below either input method.
  const sharedSelection = document.createElement("section");
  sharedSelection.className = "panel";

  const selectedHeading = document.createElement("h2");
  selectedHeading.textContent = "Selected Location";

  const originalSelectedHeading = get("mapSelectedLocation")
    .previousElementSibling;

  if (originalSelectedHeading?.tagName === "H3") {
    originalSelectedHeading.remove();
  }

  sharedSelection.append(
    selectedHeading,
    get("mapSelectedLocation"),
    get("mapMessage"),
    get("mapWeatherButton")
  );

  // Continue uses this existing weather button programmatically.
  get("mapWeatherButton").hidden = true;

  const firstActions = document.createElement("div");
  firstActions.className = "flow-actions";

  const continueWeather = makeButton("Continue to Weather", () => {
    if (!validSelectedPoint() || get("mapWeatherButton").disabled) {
      return;
    }

    showStep(1);
    get("mapWeatherButton").click();
  });

  continueWeather.disabled = true;
  firstActions.append(continueWeather);

  views[0].append(
    choicePanel,
    searchMode,
    mapMode,
    sharedSelection,
    satellitePanel,
    firstActions
  );

  views[1].append(weatherPanel);
  views[2].append(demoPanel);
  views[3].append(linkPanel);

  // Keep the old municipality form available to existing scripts,
  // but hide it from the new user flow.
  municipalityPanel.hidden = true;

  main.append(progress, ...views);

  function addActions(view, backAction, nextText, nextAction) {
    const actions = document.createElement("div");
    actions.className = "flow-actions";

    const back = makeButton("Back", backAction);
    back.className = "back-button";

    const next = makeButton(nextText, nextAction);

    actions.append(back, next);
    view.append(actions);

    return next;
  }

  const continueDemo = addActions(
    views[1],
    () => showStep(0),
    "Continue to Cloud Segmentation Demo",
    () => showStep(2)
  );

  continueDemo.disabled = true;

  addActions(
    views[2],
    () => showStep(1),
    "Continue to Link Assessment",
    () => showStep(3)
  );

  addActions(
    views[3],
    () => showStep(2),
    "Start New Analysis",
    () => {
      window.selectedMapPoint = null;

      get("mapSelectedLocation").textContent =
        "Choose an address or a map point for the new analysis.";

      get("mapMessage").textContent =
        "The previous location is no longer confirmed.";

      get("selectedLocation").textContent = "No location loaded.";
      get("rainfallValue").textContent = "Not loaded";
      get("weatherCloudValue").textContent = "Not loaded";
      get("weatherTime").textContent = "Not loaded";

      get("weatherMessage").textContent =
        "Select a location to load new weather.";

      delete get("weatherMessage").dataset.lookupMode;

      updateWeatherCondition(null, "");
      clearDemo();

      get("demoMessage").textContent =
        "Choose a historical dataset patch to load its demo results.";

      showStep(0);
    }
  );

  function setMode(mode) {
    const usingSearch = mode === "search";

    searchMode.hidden = !usingSearch;
    mapMode.hidden = usingSearch;

    searchTab.classList.toggle("active", usingSearch);
    mapTab.classList.toggle("active", !usingSearch);

    searchTab.setAttribute("aria-pressed", String(usingSearch));
    mapTab.setAttribute("aria-pressed", String(!usingSearch));

    // Let Leaflet recalculate its size after becoming visible.
    if (!usingSearch) {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    }
  }

  function showStep(index) {
    views.forEach((view, position) => {
      view.hidden = position !== index;

      progressItems[position].classList.toggle(
        "active",
        position === index
      );

      if (position === index) {
        progressItems[position].setAttribute("aria-current", "step");
      } else {
        progressItems[position].removeAttribute("aria-current");
      }
    });

    window.scrollTo({ top: 0, behavior: "smooth" });

    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
  }

  function validSelectedPoint() {
    const point = window.selectedMapPoint;

    return (
      point &&
      point.countryVerified === true &&
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude)
    );
  }

  function updateFlowButtons() {
    continueWeather.disabled =
      !validSelectedPoint() ||
      get("mapWeatherButton").disabled;

    const cloudText = get("weatherCloudValue").textContent.trim();

    continueDemo.disabled =
      !/^\d+(\.\d+)?%$/.test(cloudText);
  }

  const flowObserver = new MutationObserver(updateFlowButtons);

  flowObserver.observe(get("mapSelectedLocation"), {
    childList: true,
    characterData: true,
    subtree: true
  });

  flowObserver.observe(get("mapWeatherButton"), {
    attributes: true,
    attributeFilter: ["disabled"]
  });

  flowObserver.observe(get("weatherCloudValue"), {
    childList: true,
    characterData: true,
    subtree: true
  });

  // Address-search option.
  const searchForm = get("searchForm");
  const searchButton = get("searchAddressButton");
  const searchMessage = get("searchMessage");
  const searchResults = get("searchResults");

  const searchCache = new Map();
  let searching = false;

  searchButton.disabled = false;

  searchMessage.textContent =
    "Enter a Philippine location, then select a returned result.";

  searchForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (searching) return;

    const query = get("addressSearch").value.trim();

    if (query.length < 3) {
      searchMessage.textContent = "Enter at least three characters.";
      return;
    }

    searching = true;
    searchButton.disabled = true;
    searchButton.textContent = "Searching...";
    searchResults.replaceChildren();

    searchMessage.textContent = "Searching Philippine locations...";

    try {
      let data = searchCache.get(query);

      if (!data) {
        const url = new URL("https://photon.komoot.io/api/");

        url.search = new URLSearchParams({
          q: query + ", Philippines",
          limit: "10",
          lang: "en"
        }).toString();

        const response = await fetch(url, {
          signal: AbortSignal.timeout(20000)
        });

        if (!response.ok) {
          throw new Error(`Address service returned HTTP ${response.status}.`);
        }

        data = await response.json();

        if (!Array.isArray(data.features)) {
          throw new Error("Unexpected search response.");
        }

        searchCache.set(query, data);
      }

      const results = data.features.filter(feature => {
        const coordinates = feature.geometry?.coordinates;

        return (
          String(feature.properties?.countrycode).toUpperCase() === "PH" &&
          feature.geometry?.type === "Point" &&
          Array.isArray(coordinates) &&
          Number.isFinite(coordinates[0]) &&
          Number.isFinite(coordinates[1])
        );
      });

      if (!results.length) {
        searchMessage.textContent =
          "No Philippine matches found. Try including the municipality " +
          "and province, or use the map option.";
        return;
      }

      searchMessage.textContent =
        "Select the result that matches your intended location. " +
        "Search data: Photon / OpenStreetMap.";

      for (const feature of results) {
        const p = feature.properties;

        const label = [
          p.name,
          p.street,
          p.district,
          p.city,
          p.county,
          p.state,
          p.country
        ].filter(Boolean);

        const displayName = [...new Set(label)].join(", ");

        const resultButton = makeButton(displayName, () => {
          const [longitude, latitude] = feature.geometry.coordinates;

          if (typeof window.selectMapPoint !== "function") {
            searchMessage.textContent = "The map is unavailable.";
            return;
          }

          window.selectMapPoint(latitude, longitude, true);

          window.selectedMapPoint = {
            latitude,
            longitude,
            countryVerified: true,
            approximate: true,
            source: "Photon / OpenStreetMap",
            label: displayName
          };

          get("mapSelectedLocation").textContent =
            displayName + " — approximate mapped reference point";

          get("mapMessage").textContent =
            `Coordinates: ${latitude.toFixed(6)}, ` +
            `${longitude.toFixed(6)}. Confirm that this is your intended place.`;

          searchMessage.textContent = "Location selected.";
        });

        resultButton.className = "flow-search-result";
        searchResults.append(resultButton);
      }

    } catch (error) {
      searchMessage.textContent =
        `Address search could not complete: ${error.message}`;
    } finally {
      searching = false;
      searchButton.disabled = false;
      searchButton.textContent = "Search";
    }
  });

  setMode("search");
  showStep(0);
  updateFlowButtons();
})();
