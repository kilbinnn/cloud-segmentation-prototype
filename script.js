"use strict";

document.addEventListener("DOMContentLoaded", () => {

  /* =========================================================
     ELEMENTS
  ========================================================= */

  const regionSelect =
    document.getElementById("regionSelect");

  const provinceSelect =
    document.getElementById("provinceSelect");

  const municipalitySelect =
    document.getElementById("municipalitySelect");

  const confirmLocationButton =
    document.getElementById("confirmLocationButton");

  const locationMessage =
    document.getElementById("locationMessage");

  const selectedLocationLabel =
    document.getElementById("selectedLocationLabel");

  const locationCoordinates =
    document.getElementById("locationCoordinates");

  const toWeatherButton =
    document.getElementById("toWeatherButton");


  const weatherLocation =
    document.getElementById("weatherLocation");

  const precipitationValue =
    document.getElementById("precipitationValue");

  const cloudCoverValue =
    document.getElementById("cloudCoverValue");

  const weatherTimeValue =
    document.getElementById("weatherTimeValue");

  const weatherMessage =
    document.getElementById("weatherMessage");

  const weatherConditionCard =
    document.getElementById("weatherConditionCard");

  const weatherCondition =
    document.getElementById("weatherCondition");

  const weatherConditionDescription =
    document.getElementById("weatherConditionDescription");

  const toSatelliteButton =
    document.getElementById("toSatelliteButton");


  const satelliteLocation =
    document.getElementById("satelliteLocation");

  const loadSatelliteButton =
    document.getElementById("loadSatelliteButton");

  const satelliteStatus =
    document.getElementById("satelliteStatus");

  const satelliteObservationTime =
    document.getElementById("satelliteObservationTime");

  const himawariImage =
    document.getElementById("himawariImage");

  const satellitePlaceholder =
    document.getElementById("satellitePlaceholder");

  const toMatlabButton =
    document.getElementById("toMatlabButton");


  const toLinkButton =
    document.getElementById("toLinkButton");

  const restartButton =
    document.getElementById("restartButton");


  /* =========================================================
     STAGE 5 ELEMENTS
  ========================================================= */

  const linkLocation =
    document.getElementById("linkLocation");

  const linkRainDisplay =
    document.getElementById("linkRainDisplay");

  const linkCloudDisplay =
    document.getElementById("linkCloudDisplay");

  const frequencyBand =
    document.getElementById("frequencyBand");

  const frequencyInput =
    document.getElementById("frequency");

  const polarization =
    document.getElementById("polarization");

  const elevationAngle =
    document.getElementById("elevationAngle");

  const rainRate =
    document.getElementById("rainRate");

  const calculateAttenuationButton =
    document.getElementById("calculateAttenuationButton");

  const specificAttenuation =
    document.getElementById("specificAttenuation");

  const coefficientK =
    document.getElementById("coefficientK");

  const coefficientAlpha =
    document.getElementById("coefficientAlpha");

  const linkImpact =
    document.getElementById("linkImpact");

  const linkImpactBadge =
    document.getElementById("linkImpactBadge");

  const linkResultExplanation =
    document.getElementById("linkResultExplanation");


  /* =========================================================
     CONFIGURATION
  ========================================================= */

  const PSGC_API =
    "https://psgc.cloud/api";

  const PHOTON_API =
    "https://photon.komoot.io/api/";

  const WEATHER_API =
    "https://api.open-meteo.com/v1/forecast";

  const JMA_BASE =
    "https://www.data.jma.go.jp/mscweb/data/himawari/img/se2/";


  /* =========================================================
     STATE
  ========================================================= */

  let selectedLocation = null;

  let currentWeather = null;

  let satelliteLoaded = false;

  const cache = new Map();


  /* =========================================================
     GENERAL HELPERS
  ========================================================= */

  function optionName(select) {

    if (!select || !select.value) {
      return "";
    }

    return select
      .selectedOptions[0]
      .textContent
      .trim();
  }


  function resetSelect(
    select,
    placeholder
  ) {

    select.replaceChildren(
      new Option(
        placeholder,
        ""
      )
    );

    select.disabled = true;
  }


  function populateSelect(
    select,
    items,
    placeholder
  ) {

    resetSelect(
      select,
      placeholder
    );

    const sorted =
      [...items].sort(
        (a, b) =>
          a.name.localeCompare(b.name)
      );

    for (const item of sorted) {

      select.add(
        new Option(
          item.name,
          String(item.code)
        )
      );
    }

    select.disabled =
      sorted.length === 0;
  }


  async function getJSON(url) {

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        20000
      );

    try {

      const response =
        await fetch(
          url,
          {
            signal:
              controller.signal
          }
        );

      if (!response.ok) {

        throw new Error(
          "Request failed with HTTP " +
          response.status
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

    const data =
      await getJSON(
        PSGC_API + path
      );

    if (!Array.isArray(data)) {

      throw new Error(
        "Unexpected PSGC response."
      );
    }

    cache.set(
      path,
      data
    );

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


  /* =========================================================
     PAGE NAVIGATION
  ========================================================= */

  function showStep(number) {

    for (
      let index = 1;
      index <= 5;
      index++
    ) {

      const section =
        document.getElementById(
          "step" + index
        );

      if (section) {

        section.hidden =
          index !== number;
      }
    }


    document
      .querySelectorAll(
        "[data-progress]"
      )
      .forEach(step => {

        step.classList.toggle(
          "active",
          Number(
            step.dataset.progress
          ) === number
        );
      });


    if (number === 5) {

      synchronizeLinkAssessment();
    }


    const target =
      document.getElementById(
        "step" + number
      );

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

      button.addEventListener(
        "click",
        () => {

          showStep(
            Number(
              button.dataset.back
            )
          );
        }
      );
    });


  toWeatherButton.addEventListener(
    "click",
    async () => {

      showStep(2);

      await loadWeather();
    }
  );


  toSatelliteButton.addEventListener(
    "click",
    () => {

      showStep(3);
    }
  );


  toMatlabButton.addEventListener(
    "click",
    () => {

      showStep(4);
    }
  );


  toLinkButton.addEventListener(
    "click",
    () => {

      showStep(5);
    }
  );


  restartButton.addEventListener(
    "click",
    () => {

      showStep(1);
    }
  );


  /* =========================================================
     LOCATION
  ========================================================= */

  function clearLocationConfirmation() {

    selectedLocation = null;

    currentWeather = null;

    selectedLocationLabel.textContent =
      "No location selected";

    locationCoordinates.textContent =
      "Coordinates will appear after confirmation.";

    toWeatherButton.disabled =
      true;

    satelliteLoaded =
      false;

    himawariImage.hidden =
      true;

    satellitePlaceholder.hidden =
      false;

    satelliteStatus.textContent =
      "Satellite imagery has not been loaded.";

    satelliteObservationTime.textContent =
      "—";

    updateConfirmButton();
  }


  function updateConfirmButton() {

    confirmLocationButton.disabled =
      !regionSelect.value ||
      !provinceSelect.value ||
      !municipalitySelect.value;
  }


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

        locationMessage.textContent =
          "Select a region.";

        return;
      }


      locationMessage.textContent =
        "Loading provinces...";


      try {

        const provinces =
          await getPSGC(
            "/regions/" +
            encodeURIComponent(
              regionSelect.value
            ) +
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

          provinceSelect.disabled =
            false;
        }


        locationMessage.textContent =
          "Select a province or administrative option.";

      } catch (error) {

        locationMessage.textContent =
          "Provinces could not load: " +
          error.message;
      }


      updateConfirmButton();
    }
  );


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


      locationMessage.textContent =
        "Loading municipalities and cities...";


      try {

        let path;


        if (
          provinceSelect.value ===
          "__NO_PROVINCE__"
        ) {

          path =
            "/regions/" +
            encodeURIComponent(
              regionSelect.value
            ) +
            "/cities-municipalities";

        } else {

          path =
            "/provinces/" +
            encodeURIComponent(
              provinceSelect.value
            ) +
            "/cities-municipalities";
        }


        const municipalities =
          await getPSGC(path);


        populateSelect(
          municipalitySelect,
          municipalities,
          "Select Municipality / City"
        );


        locationMessage.textContent =
          "Select a municipality or city.";

      } catch (error) {

        locationMessage.textContent =
          "Municipalities could not load: " +
          error.message;
      }


      updateConfirmButton();
    }
  );


  municipalitySelect.addEventListener(
    "change",
    () => {

      clearLocationConfirmation();

      locationMessage.textContent =
        municipalitySelect.value
          ? "Click Confirm Location."
          : "Select a municipality or city.";

      updateConfirmButton();
    }
  );


  /* =========================================================
     GEOCODING
  ========================================================= */

  async function findMunicipalityCoordinates(
    municipality,
    province
  ) {

    const query =
      [
        municipality,
        province,
        "Philippines"
      ]
        .filter(Boolean)
        .join(", ");


    const url =
      new URL(PHOTON_API);


    url.searchParams.set(
      "q",
      query
    );

    url.searchParams.set(
      "limit",
      "10"
    );

    url.searchParams.set(
      "lang",
      "en"
    );


    const data =
      await getJSON(url);


    if (!Array.isArray(data.features)) {

      throw new Error(
        "Unexpected geocoding response."
      );
    }


    const candidates =
      data.features.filter(
        feature => {

          const properties =
            feature.properties || {};

          const coordinates =
            feature.geometry?.coordinates;


          if (
            String(
              properties.countrycode || ""
            ).toUpperCase() !== "PH"
          ) {

            return false;
          }


          if (
            feature.geometry?.type !==
            "Point"
          ) {

            return false;
          }


          if (
            !Array.isArray(
              coordinates
            ) ||
            coordinates.length < 2
          ) {

            return false;
          }


          if (
            !Number.isFinite(
              coordinates[0]
            ) ||
            !Number.isFinite(
              coordinates[1]
            )
          ) {

            return false;
          }


          return true;
        }
      );


    if (!candidates.length) {

      throw new Error(
        "No Philippine map reference was found."
      );
    }


    const exact =
      candidates.find(
        feature => {

          const properties =
            feature.properties || {};


          return (
            normalize(
              properties.name
            ) ===
            normalize(
              municipality
            )
          );
        }
      );


    return exact ||
      candidates[0];
  }


  confirmLocationButton.addEventListener(
    "click",
    async () => {

      if (
        confirmLocationButton.disabled
      ) {

        return;
      }


      const municipality =
        optionName(
          municipalitySelect
        );


      const province =
        provinceSelect.value ===
        "__NO_PROVINCE__"
          ? ""
          : optionName(
              provinceSelect
            );


      const region =
        optionName(
          regionSelect
        );


      confirmLocationButton.disabled =
        true;

      confirmLocationButton.textContent =
        "Confirming...";

      locationMessage.textContent =
        "Finding the municipality reference point...";


      try {

        const feature =
          await findMunicipalityCoordinates(
            municipality,
            province
          );


        const [
          longitude,
          latitude
        ] =
          feature.geometry.coordinates;


        selectedLocation = {

          municipality,
          province,
          region,
          latitude,
          longitude
        };


        selectedLocationLabel.textContent =
          fullLocationName();


        locationCoordinates.textContent =
          "Approximate municipality reference: " +
          latitude.toFixed(6) +
          ", " +
          longitude.toFixed(6);


        locationMessage.textContent =
          "Location confirmed successfully.";


        toWeatherButton.disabled =
          false;


        satelliteLoaded =
          false;


      } catch (error) {

        selectedLocation =
          null;


        selectedLocationLabel.textContent =
          "Location could not be confirmed";


        locationCoordinates.textContent =
          "No coordinates available.";


        locationMessage.textContent =
          "Location confirmation failed: " +
          error.message;


        toWeatherButton.disabled =
          true;

      } finally {

        confirmLocationButton.textContent =
          "Confirm Location";

        updateConfirmButton();
      }
    }
  );


  /* =========================================================
     WEATHER
  ========================================================= */

  function clearWeather() {

    currentWeather =
      null;


    precipitationValue.textContent =
      "—";


    cloudCoverValue.textContent =
      "—";


    weatherTimeValue.textContent =
      "—";


    weatherCondition.textContent =
      "Waiting for weather data";


    weatherConditionDescription.textContent =
      "Weather information will appear after the selected location is processed.";


    weatherConditionCard.classList.remove(
      "good",
      "fair",
      "warning"
    );


    weatherMessage.textContent =
      "Weather has not been loaded.";


    toSatelliteButton.disabled =
      true;
  }


  function updateWeatherCondition(
    precipitation,
    cloudCover
  ) {

    weatherConditionCard.classList.remove(
      "good",
      "fair",
      "warning"
    );


    if (precipitation > 0) {

      weatherCondition.textContent =
        "Precipitation Detected";

      weatherConditionDescription.textContent =
        "Current modeled precipitation is present at the selected location.";

      weatherConditionCard.classList.add(
        "warning"
      );

      return;
    }


    if (cloudCover >= 70) {

      weatherCondition.textContent =
        "Cloudy";

      weatherConditionDescription.textContent =
        "High modeled cloud cover is present, but current precipitation is zero.";

      weatherConditionCard.classList.add(
        "fair"
      );

      return;
    }


    if (cloudCover >= 30) {

      weatherCondition.textContent =
        "Partly Cloudy";

      weatherConditionDescription.textContent =
        "Moderate modeled cloud cover is present at the selected location.";

      weatherConditionCard.classList.add(
        "fair"
      );

      return;
    }


    weatherCondition.textContent =
      "Low Cloud Cover";

    weatherConditionDescription.textContent =
      "Current modeled cloud cover is relatively low.";

    weatherConditionCard.classList.add(
      "good"
    );
  }


  async function loadWeather() {

    clearWeather();


    if (!selectedLocation) {

      weatherMessage.textContent =
        "No location has been selected.";

      return;
    }


    weatherLocation.textContent =
      fullLocationName();


    precipitationValue.textContent =
      "Loading...";


    cloudCoverValue.textContent =
      "Loading...";


    weatherTimeValue.textContent =
      "Loading...";


    weatherMessage.textContent =
      "Retrieving current weather...";


    try {

      const url =
        new URL(
          WEATHER_API
        );


      url.search =
        new URLSearchParams({

          latitude:
            String(
              selectedLocation.latitude
            ),

          longitude:
            String(
              selectedLocation.longitude
            ),

          current:
            "precipitation,cloud_cover",

          timezone:
            "Asia/Manila",

          forecast_days:
            "1"

        }).toString();


      const weather =
        await getJSON(url);


      const current =
        weather.current;


      const units =
        weather.current_units;


      if (
        !current ||
        !units ||
        !Number.isFinite(
          current.precipitation
        ) ||
        current.precipitation < 0 ||
        !Number.isFinite(
          current.cloud_cover
        ) ||
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
          units.precipitation ||
          "mm"
      };


      precipitationValue.textContent =
        current.precipitation.toFixed(2) +
        " " +
        (
          units.precipitation ||
          "mm"
        );


      cloudCoverValue.textContent =
        Math.round(
          current.cloud_cover
        ) +
        "%";


      weatherTimeValue.textContent =
        current.time
          .replace("T", " ") +
        " PHT";


      updateWeatherCondition(
        current.precipitation,
        current.cloud_cover
      );


      weatherMessage.textContent =
        "Current modeled weather loaded successfully. Source: Open-Meteo.";


      toSatelliteButton.disabled =
        false;


    } catch (error) {

      clearWeather();


      weatherMessage.textContent =
        "Weather could not load: " +
        error.message;
    }
  }


  /* =========================================================
     JMA HIMAWARI — SOUTHEAST ASIA 2
     B07 SHORT WAVE INFRARED
  ========================================================= */

  function roundToTenMinutes(
    date
  ) {

    const result =
      new Date(
        date.getTime()
      );


    result.setUTCMinutes(
      Math.floor(
        result.getUTCMinutes() /
        10
      ) * 10,
      0,
      0
    );


    return result;
  }


  function slotCode(date) {

    return (
      String(
        date.getUTCHours()
      ).padStart(2, "0") +

      String(
        date.getUTCMinutes()
      ).padStart(2, "0")
    );
  }


  function formatSatelliteTime(
    date
  ) {

    const utc =
      new Intl.DateTimeFormat(
        "en-PH",
        {
          timeZone:
            "UTC",

          year:
            "numeric",

          month:
            "short",

          day:
            "2-digit",

          hour:
            "2-digit",

          minute:
            "2-digit",

          hour12:
            false
        }
      ).format(date);


    const pht =
      new Intl.DateTimeFormat(
        "en-PH",
        {
          timeZone:
            "Asia/Manila",

          year:
            "numeric",

          month:
            "short",

          day:
            "2-digit",

          hour:
            "2-digit",

          minute:
            "2-digit",

          hour12:
            false
        }
      ).format(date);


    return (
      utc +
      " UTC / " +
      pht +
      " PHT"
    );
  }


  function testImage(url) {

    return new Promise(
      (resolve, reject) => {

        const tester =
          new Image();


        tester.onload =
          () => resolve(url);


        tester.onerror =
          () => reject(
            new Error(
              "Image unavailable"
            )
          );


        tester.src =
          url +
          "?test=" +
          Date.now();
      }
    );
  }


  async function loadHimawari() {

    if (!selectedLocation) {

      satelliteStatus.textContent =
        "No location selected.";

      return;
    }


    satelliteLocation.textContent =
      fullLocationName();


    satelliteLoaded =
      false;


    himawariImage.hidden =
      true;


    satellitePlaceholder.hidden =
      false;


    satellitePlaceholder.textContent =
      "Retrieving recent JMA Himawari Southeast Asia 2 B07 imagery...";


    satelliteStatus.textContent =
      "Searching recent B07 image slots...";


    satelliteObservationTime.textContent =
      "Checking...";


    loadSatelliteButton.disabled =
      true;


    loadSatelliteButton.textContent =
      "Loading B07...";


    /*
      JMA imagery may become available after
      the nominal observation time.

      Start 20 minutes behind current UTC.
    */

    const initial =
      roundToTenMinutes(
        new Date(
          Date.now() -
          20 * 60 * 1000
        )
      );


    try {

      /*
        Search recent 10-minute image slots.
      */

      for (
        let offset = 0;
        offset < 18;
        offset++
      ) {

        const candidate =
          new Date(
            initial.getTime() -
            offset *
            10 *
            60 *
            1000
          );


        const code =
          slotCode(
            candidate
          );


        /*
          JMA Southeast Asia 2 B07
          Short Wave Infrared.

          The product filename is based on
          the B07 image used in the prototype.
        */

        const possibleNames = [

          "se2_b07_" +
          code +
          ".jpg",

          "se2_b07_" +
          code +
          ".png",

          "se2_b07_" +
          code +
          ".gif"

        ];


        for (
          const filename
          of possibleNames
        ) {

          const imageURL =
            JMA_BASE +
            filename;


          try {

            await testImage(
              imageURL
            );


            await new Promise(
              (resolve, reject) => {

                himawariImage.onload =
                  () => resolve();


                himawariImage.onerror =
                  () => reject(
                    new Error(
                      "The JMA B07 image was found but could not be displayed."
                    )
                  );


                himawariImage.src =
                  imageURL +
                  "?display=" +
                  Date.now();
              }
            );


            himawariImage.hidden =
              false;


            satellitePlaceholder.hidden =
              true;


            satelliteStatus.textContent =
              "B07 imagery available.";


            satelliteObservationTime.textContent =
              formatSatelliteTime(
                candidate
              );


            satelliteLoaded =
              true;


            return;

          } catch (error) {

            /*
              Try the next filename or
              previous time slot.
            */
          }
        }
      }


      throw new Error(
        "No recent JMA B07 image could be retrieved."
      );


    } catch (error) {

      himawariImage.hidden =
        true;


      satellitePlaceholder.hidden =
        false;


      satellitePlaceholder.textContent =
        "Recent JMA Himawari Southeast Asia 2 B07 imagery could not be retrieved.";


      satelliteStatus.textContent =
        error.message;


      satelliteObservationTime.textContent =
        "Unavailable";


    } finally {

      loadSatelliteButton.disabled =
        false;


      loadSatelliteButton.textContent =
        "Load Latest Himawari B07";
    }
  }


  loadSatelliteButton.addEventListener(
    "click",
    loadHimawari
  );


  /* =========================================================
     STAGE 5
     CURRENT RAIN-SPECIFIC ATTENUATION

     gamma_R = k * R^alpha

     This prototype calculates specific attenuation
     only. It does NOT calculate a long-term
     satellite-link availability percentage.
  ========================================================= */


  /*
    Coefficients used for the supported
    C/Ku prototype range.

    Horizontal and vertical coefficient values
    are provided at discrete frequencies.

    Interpolation is performed between points.
  */

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

    const first =
      coefficientTable[0];

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


    const exact =
      coefficientTable.find(
        row =>
          row.f === frequency
      );


    if (exact) {

      return exact[property];
    }


    for (
      let index = 0;
      index <
      coefficientTable.length - 1;
      index++
    ) {

      const lower =
        coefficientTable[index];

      const upper =
        coefficientTable[
          index + 1
        ];


      if (
        frequency > lower.f &&
        frequency < upper.f
      ) {

        const ratio =
          (
            Math.log10(
              frequency
            ) -
            Math.log10(
              lower.f
            )
          ) /
          (
            Math.log10(
              upper.f
            ) -
            Math.log10(
              lower.f
            )
          );


        /*
          k is interpolated logarithmically.
        */

        if (
          property === "kH" ||
          property === "kV"
        ) {

          const logLower =
            Math.log10(
              lower[property]
            );


          const logUpper =
            Math.log10(
              upper[property]
            );


          return Math.pow(
            10,
            logLower +
            ratio *
            (
              logUpper -
              logLower
            )
          );
        }


        /*
          alpha is interpolated between
          adjacent values.
        */

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

    const kH =
      interpolateCoefficient(
        frequency,
        "kH"
      );


    const kV =
      interpolateCoefficient(
        frequency,
        "kV"
      );


    const alphaH =
      interpolateCoefficient(
        frequency,
        "aH"
      );


    const alphaV =
      interpolateCoefficient(
        frequency,
        "aV"
      );


    /*
      Polarization tilt angle tau:

      Horizontal = 0 degrees
      Vertical   = 90 degrees
      Circular   = 45 degrees
    */

    let tauDegrees = 0;


    if (
      polarizationType ===
      "vertical"
    ) {

      tauDegrees =
        90;
    }


    if (
      polarizationType ===
      "circular"
    ) {

      tauDegrees =
        45;
    }


    const theta =
      elevationDegrees *
      Math.PI /
      180;


    const tau =
      tauDegrees *
      Math.PI /
      180;


    const geometryTerm =
      Math.pow(
        Math.cos(theta),
        2
      ) *
      Math.cos(
        2 * tau
      );


    const k =
      (
        kH +
        kV +
        (
          kH -
          kV
        ) *
        geometryTerm
      ) /
      2;


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
        ) *
        geometryTerm
      ) /
      (
        2 * k
      );


    if (
      !Number.isFinite(alpha)
    ) {

      throw new Error(
        "Invalid attenuation exponent."
      );
    }


    return {
      k,
      alpha
    };
  }


  function getImpactCategory(
    attenuation
  ) {

    /*
      These categories are a prototype
      interpretation only.

      They are NOT ITU-R-defined
      reliability thresholds.
    */

    if (
      attenuation < 0.01
    ) {

      return {

        label:
          "Minimal",

        explanation:
          "The calculated rain-specific attenuation is currently very small."
      };
    }


    if (
      attenuation < 0.10
    ) {

      return {

        label:
          "Low",

        explanation:
          "The current rain rate introduces a relatively small propagation loss per kilometre."
      };
    }


    if (
      attenuation < 0.50
    ) {

      return {

        label:
          "Moderate",

        explanation:
          "Rain attenuation is becoming significant and may affect a satellite link depending on the effective rain path and available link margin."
      };
    }


    if (
      attenuation < 1.00
    ) {

      return {

        label:
          "High",

        explanation:
          "The calculated rain-specific attenuation indicates substantial rain-related propagation loss."
      };
    }


    return {

      label:
        "Severe",

      explanation:
        "The selected rain rate and operating parameters produce strong rain-specific attenuation."
    };
  }


  function resetLinkResult() {

    specificAttenuation.textContent =
      "—";


    coefficientK.textContent =
      "—";


    coefficientAlpha.textContent =
      "—";


    linkImpact.textContent =
      "—";


    linkImpactBadge.textContent =
      "Awaiting Calculation";


    linkResultExplanation.textContent =
      "Select the link parameters and calculate the current rain-specific attenuation.";
  }


  function synchronizeLinkAssessment() {

    linkLocation.textContent =
      fullLocationName();


    if (
      currentWeather &&
      Number.isFinite(
        currentWeather.precipitation
      )
    ) {

      const value =
        currentWeather.precipitation;


      linkRainDisplay.textContent =
        value.toFixed(2) +
        " mm";


      rainRate.value =
        value.toFixed(2);

    } else {

      linkRainDisplay.textContent =
        "Not available";


      rainRate.value =
        "0";
    }


    if (
      currentWeather &&
      Number.isFinite(
        currentWeather.cloudCover
      )
    ) {

      linkCloudDisplay.textContent =
        Math.round(
          currentWeather.cloudCover
        ) +
        "%";

    } else {

      linkCloudDisplay.textContent =
        "Not available";
    }


    resetLinkResult();
  }


  function updateFrequencyFromBand() {

    if (
      frequencyBand.value ===
      "C"
    ) {

      frequencyInput.min =
        "4";

      frequencyInput.max =
        "8";


      const current =
        Number(
          frequencyInput.value
        );


      if (
        !Number.isFinite(current) ||
        current < 4 ||
        current > 8
      ) {

        frequencyInput.value =
          "6.0";
      }


      frequencyInput.placeholder =
        "Example: 6.0";

    } else if (
      frequencyBand.value ===
      "Ku"
    ) {

      frequencyInput.min =
        "10";

      frequencyInput.max =
        "18";


      const current =
        Number(
          frequencyInput.value
        );


      if (
        !Number.isFinite(current) ||
        current < 10 ||
        current > 18
      ) {

        frequencyInput.value =
          "12.0";
      }


      frequencyInput.placeholder =
        "Example: 12.0";

    } else {

      frequencyInput.min =
        "4";

      frequencyInput.max =
        "20";


      frequencyInput.value =
        "";
    }


    resetLinkResult();
  }


  frequencyBand.addEventListener(
    "change",
    updateFrequencyFromBand
  );


  [
    frequencyInput,
    polarization,
    elevationAngle,
    rainRate
  ].forEach(element => {

    element.addEventListener(
      "input",
      resetLinkResult
    );

    element.addEventListener(
      "change",
      resetLinkResult
    );
  });


  calculateAttenuationButton.addEventListener(
    "click",
    () => {

      try {

        const band =
          frequencyBand.value;


        const frequency =
          Number(
            frequencyInput.value
          );


        const rain =
          Number(
            rainRate.value
          );


        const elevation =
          Number(
            elevationAngle.value
          );


        const polarizationType =
          polarization.value;


        if (!band) {

          throw new Error(
            "Select C-band or Ku-band."
          );
        }


        if (
          !Number.isFinite(
            frequency
          )
        ) {

          throw new Error(
            "Enter an operating frequency."
          );
        }


        if (
          frequency < 4 ||
          frequency > 20
        ) {

          throw new Error(
            "Enter a frequency between 4 and 20 GHz."
          );
        }


        if (
          band === "C" &&
          (
            frequency < 4 ||
            frequency > 8
          )
        ) {

          throw new Error(
            "For this prototype, C-band must be between 4 and 8 GHz."
          );
        }


        if (
          band === "Ku" &&
          (
            frequency < 10 ||
            frequency > 18
          )
        ) {

          throw new Error(
            "For this prototype, Ku-band must be between 10 and 18 GHz."
          );
        }


        if (
          !Number.isFinite(rain) ||
          rain < 0
        ) {

          throw new Error(
            "Rain rate must be zero or greater."
          );
        }


        if (
          !Number.isFinite(
            elevation
          ) ||
          elevation < 0 ||
          elevation > 90
        ) {

          throw new Error(
            "Elevation angle must be between 0 and 90 degrees."
          );
        }


        const coefficients =
          calculateCoefficients(
            frequency,
            polarizationType,
            elevation
          );


        let attenuation =
          0;


        if (rain > 0) {

          attenuation =
            coefficients.k *
            Math.pow(
              rain,
              coefficients.alpha
            );
        }


        if (
          !Number.isFinite(
            attenuation
          )
        ) {

          throw new Error(
            "The attenuation calculation did not produce a valid result."
          );
        }


        const impact =
          getImpactCategory(
            attenuation
          );


        specificAttenuation.textContent =
          attenuation.toFixed(4) +
          " dB/km";


        coefficientK.textContent =
          coefficients.k.toFixed(6);


        coefficientAlpha.textContent =
          coefficients.alpha.toFixed(4);


        linkImpact.textContent =
          impact.label;


        linkImpactBadge.textContent =
          impact.label +
          " Rain Impact";


        if (rain === 0) {

          linkResultExplanation.textContent =
            "The rain rate used in the calculation is 0.00 mm/h, so the calculated rain-specific attenuation is 0.0000 dB/km. This does not mean that the complete satellite link has zero propagation loss; it only means that this calculation contributes no rain-specific attenuation for the selected condition.";

        } else {

          linkResultExplanation.textContent =
            impact.explanation +
            " At " +
            frequency.toFixed(1) +
            " GHz with a rain rate of " +
            rain.toFixed(2) +
            " mm/h, the calculated specific rain attenuation is " +
            attenuation.toFixed(4) +
            " dB/km.";
        }


      } catch (error) {

        specificAttenuation.textContent =
          "—";


        coefficientK.textContent =
          "—";


        coefficientAlpha.textContent =
          "—";


        linkImpact.textContent =
          "—";


        linkImpactBadge.textContent =
          "Input Required";


        linkResultExplanation.textContent =
          error.message;
      }
    }
  );


  /* =========================================================
     INITIALIZE LOCATION LISTS
  ========================================================= */

  async function initialize() {

    resetSelect(
      regionSelect,
      "Loading Philippine regions..."
    );


    resetSelect(
      provinceSelect,
      "Select a region first"
    );


    resetSelect(
      municipalitySelect,
      "Select a province first"
    );


    clearWeather();

    resetLinkResult();


    try {

      const regions =
        await getPSGC(
          "/regions"
        );


      populateSelect(
        regionSelect,
        regions,
        "Select Region"
      );


      locationMessage.textContent =
        "Select a region, province, and municipality or city.";


    } catch (error) {

      locationMessage.textContent =
        "Philippine location lists could not load: " +
        error.message;
    }


    updateConfirmButton();
  }


  initialize();

});