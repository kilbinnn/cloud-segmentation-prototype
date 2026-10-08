"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const get = id => document.getElementById(id);
  const section = get("stepDemo");
  const demoForm = get("demoForm");

  if (!section || !demoForm) {
    return;
  }

  // The historical-patch form is no longer used in this view.
  demoForm.hidden = true;

  const heading = section.querySelector("h2");

  if (heading) {
    heading.textContent = "Himawari Cloud-Candidate View";
  }

  // Replace the old historical demonstration explanation.
  const introductoryNote = section.querySelector(".note");

  if (introductoryNote) {
    introductoryNote.textContent =
      "These images come from the same recent Himawari crop. " +
      "The mask is an experimental brightness-based estimate, " +
      "not a prediction from your trained MATLAB U-Net.";
  }

  const captions = [
    ["satelliteSlot", "Recent Himawari Color Crop"],
    ["actualMaskSlot", "Grayscale Crop"],
    ["predictionSlot", "Experimental Cloud-Candidate Mask"],
    ["overlaySlot", "Cloud Candidates Highlighted in Pink"]
  ];

  for (const [slotId, title] of captions) {
    const figure = get(slotId)?.closest("figure");
    const caption = figure?.querySelector("figcaption");

    if (caption) {
      caption.textContent = title;
    }
  }

  function renameMetric(valueId, title) {
    const metric = get(valueId)?.closest(".metric");
    const label = metric?.querySelector("h3");

    if (label) {
      label.textContent = title;
    }
  }

  renameMetric("coverageValue", "Bright Cloud-Candidate Pixels");
  renameMetric("accuracyValue", "Pixel Accuracy");
  renameMetric("iouValue", "Cloud IoU");

  const details = document.createElement("p");
  details.className = "note";
  details.id = "himawariCropDetails";
  demoForm.before(details);

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.textContent = "Refresh Himawari Observation";
  demoForm.before(refreshButton);

  // Remove the old cloud-coverage GOOD / FAIR / WARNING interpretation.
  const conditionCard = get("conditionCard");

  if (conditionCard) {
    conditionCard.className = "condition-card";
    get("conditionLabel").textContent = "Experimental Estimate";

    get("conditionDescription").textContent =
      "Bright pixels can include clouds and bright land. " +
      "This method does not identify rain clouds or estimate signal strength.";
  }

  // Replace the remaining old demonstration notes.
  section.querySelectorAll(".note").forEach(function (note) {
    if (note === introductoryNote || note === details) {
      return;
    }

    note.textContent =
      "No reference mask is available for this observation. " +
      "Accuracy and IoU cannot be calculated. " +
      "Coordinate mapping remains approximate.";
  });

  let revision = 0;
  let controller = null;
  let timer = null;
  let activeKey = "";
  let completedKey = "";
  let completedAt = 0;

  function selectedPoint() {
    const point = window.selectedMapPoint;

    if (
      !point ||
      point.countryVerified !== true ||
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude)
    ) {
      return null;
    }

    return point;
  }

  function keyOf(point) {
    return point.latitude + "," + point.longitude;
  }

  function formatTime(value) {
    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return "Unavailable";
    }

    return date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      dateStyle: "medium",
      timeStyle: "short"
    }) + " PHT";
  }

  function clearView() {
    for (const [slotId] of captions) {
      const slot = get(slotId);

      if (slot) {
        slot.classList.remove("has-image");
        slot.textContent = "Waiting for the Himawari observation.";
      }
    }

    get("coverageValue").textContent = "Not loaded";
    get("accuracyValue").textContent = "Not available";
    get("iouValue").textContent = "Not available";
    details.textContent = "";

    if (conditionCard) {
      conditionCard.className = "condition-card";
      get("conditionLabel").textContent = "Experimental Estimate";

      get("conditionDescription").textContent =
        "Awaiting the selected location's satellite crop.";
    }
  }

  function loadImage(path) {
    return new Promise(function (resolve, reject) {
      const image = new Image();

      const timeout = setTimeout(function () {
        reject(new Error("An output image did not load."));
      }, 15000);

      image.onload = function () {
        clearTimeout(timeout);
        resolve(image);
      };

      image.onerror = function () {
        clearTimeout(timeout);
        reject(new Error("An output image could not be displayed."));
      };

      image.src = path;
    });
  }

  async function updateView(force = false) {
    const point = selectedPoint();

    if (!point) {
      get("demoMessage").textContent =
        "Select and confirm a Philippine location first.";
      return;
    }

    if (section.hidden) {
      return;
    }

    const key = keyOf(point);

    if (
      activeKey === key ||
      (
        !force &&
        completedKey === key &&
        Date.now() - completedAt < 600000
      )
    ) {
      return;
    }

    const thisRevision = ++revision;
    activeKey = key;

    if (controller) {
      controller.abort();
    }

    controller = new AbortController();
    const requestController = controller;

    refreshButton.disabled = true;
    clearView();

    get("demoMessage").textContent =
      "Retrieving a recent daytime Himawari image and generating the mask...";

    const timeout = setTimeout(function () {
      requestController.abort();
    }, 180000);

    try {
      const url = new URL("/api/satellite", window.location.origin);

      url.searchParams.set("lat", point.latitude);
      url.searchParams.set("lon", point.longitude);
      url.searchParams.set("width_km", "120");

      let data;

      try {
        const response = await fetch(url, {
          signal: requestController.signal,
          cache: "no-store"
        });

        data = await response.json();

        if (!response.ok || data.status !== "ok") {
          throw new Error(
            data.message || "Satellite processing failed."
          );
        }
      } finally {
        clearTimeout(timeout);
      }

      if (thisRevision !== revision) {
        return;
      }

      const coverage = data.cloud_candidate_percent;

      if (
        !Number.isFinite(coverage) ||
        coverage < 0 ||
        coverage > 100 ||
        !Array.isArray(data.native_crop_pixels)
      ) {
        throw new Error("The backend returned invalid measurements.");
      }

      const outputs = [
        ["satelliteSlot", data.color_image, "Himawari color crop"],
        ["actualMaskSlot", data.grayscale_image, "Grayscale crop"],
        [
          "predictionSlot",
          data.candidate_mask_image,
          "Experimental brightness-based cloud-candidate mask"
        ],
        [
          "overlaySlot",
          data.candidate_overlay_image,
          "Cloud-candidate mask overlaid on the same Himawari crop"
        ]
      ];

      // Load all four before showing the result together.
      const images = await Promise.all(
        outputs.map(output => loadImage(output[1]))
      );

      if (thisRevision !== revision) {
        return;
      }

      outputs.forEach(function (output, index) {
        const [slotId, , description] = output;
        const slot = get(slotId);
        const image = images[index];

        image.alt = description;
        slot.replaceChildren(image);
        slot.classList.add("has-image");
      });

      get("coverageValue").textContent =
        coverage.toFixed(2) + "%";

      get("accuracyValue").textContent = "No reference mask";
      get("iouValue").textContent = "No reference mask";

      details.textContent =
        "Estimated observation: " +
        formatTime(data.observation_time_utc_inferred) +
        ". Pin: " + point.latitude.toFixed(5) +
        ", " + point.longitude.toFixed(5) +
        ". Approximate crop width: " + data.crop_width_km +
        " km. Original pixels: " +
        data.native_crop_pixels.join(" × ") +
        ". Brightness threshold: " +
        data.brightness_threshold + " / 255. " +
        "Source: JMA / NOAA-NESDIS / CSU-CIRA. " +
        "Observation date is inferred; crop positioning requires validation.";

      get("conditionLabel").textContent =
        "Experimental Brightness-Based Estimate";

      get("conditionDescription").textContent =
        coverage.toFixed(2) +
        "% of original crop pixels exceeded the brightness threshold. " +
        "These are cloud candidates, not confirmed clouds or rain clouds. " +
        "Bright land may also be included. Signal strength is not estimated.";

      get("demoMessage").textContent =
        "All four images use the same Himawari crop. " +
        "No historical patch was substituted. " +
        "Automatic refresh checks run every 10 minutes while this section is open.";

      completedKey = key;
      completedAt = Date.now();
    } catch (error) {
      if (thisRevision !== revision) {
        return;
      }

      clearView();

      get("demoMessage").textContent =
        error.name === "AbortError"
          ? "The request timed out. Try Refresh Himawari Observation."
          : "Could not update the Himawari view: " + error.message;
    } finally {
      clearTimeout(timeout);

      if (thisRevision === revision) {
        activeKey = "";
        refreshButton.disabled = false;
      }
    }
  }

  function locationChanged() {
    revision += 1;
    activeKey = "";
    completedKey = "";

    if (controller) {
      controller.abort();
    }

    clearView();
    refreshButton.disabled = false;

    clearTimeout(timer);
    timer = setTimeout(function () {
      updateView();
    }, 800);
  }

  refreshButton.addEventListener("click", function () {
    updateView(true);
  });

  const locationElement = get("mapSelectedLocation");

  if (locationElement) {
    new MutationObserver(locationChanged).observe(
      locationElement,
      { childList: true, subtree: true }
    );
  }

  new MutationObserver(function () {
    if (!section.hidden) {
      updateView();
    }
  }).observe(section, {
    attributes: true,
    attributeFilter: ["hidden"]
  });

  setInterval(function () {
    if (!section.hidden && !document.hidden) {
      updateView();
    }
  }, 600000);

  clearView();
  updateView();
});