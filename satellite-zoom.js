"use strict";

(() => {
  function initializeSatelliteZoom() {
    const sourceImage = document.getElementById("himawariImage");

    if (!sourceImage) {
      return;
    }

    const panel = document.createElement("div");
    panel.style.marginTop = "24px";

    const heading = document.createElement("h3");
    heading.textContent = "Zoomed Himawari View";

    const instructions = document.createElement("p");
    instructions.textContent =
      "Adjust the zoom, then scroll inside the image to inspect an area.";

    const label = document.createElement("label");
    label.htmlFor = "satelliteZoomSlider";
    label.textContent = "Zoom: 1×";

    const slider = document.createElement("input");
    slider.id = "satelliteZoomSlider";
    slider.type = "range";
    slider.min = "1";
    slider.max = "8";
    slider.step = "0.25";
    slider.value = "1";
    slider.style.width = "100%";
    slider.style.accentColor = "#a82d62";

    const viewport = document.createElement("div");
    viewport.tabIndex = 0;
    viewport.setAttribute(
      "aria-label",
      "Scrollable enlarged Himawari satellite image"
    );

    Object.assign(viewport.style, {
      width: "100%",
      height: "420px",
      overflow: "auto",
      border: "1px solid #ddb5c7",
      borderRadius: "12px",
      background: "#251522",
      marginTop: "12px"
    });

    const zoomImage = document.createElement("img");
    zoomImage.alt = "Enlarged regional Himawari satellite image";
    zoomImage.draggable = false;

    Object.assign(zoomImage.style, {
      display: "block",
      maxWidth: "none",
      height: "auto"
    });

    viewport.appendChild(zoomImage);

    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = "Waiting for the regional satellite image.";

    const note = document.createElement("p");
    note.className = "note";
    note.textContent =
      "This enlarges the regional image without adding detail. " +
      "It is not automatically centered on your selected address " +
      "and has not been processed by the MATLAB model.";

    panel.append(
      heading,
      instructions,
      label,
      slider,
      viewport,
      status,
      note
    );

    sourceImage.parentElement.appendChild(panel);

    function updateZoom() {
      const zoom = Number(slider.value);

      label.textContent =
        "Zoom: " + zoom.toFixed(2).replace(/\.?0+$/, "") + "×";

      const width = viewport.clientWidth;

      if (width > 0) {
        zoomImage.style.width = width * zoom + "px";
      }
    }

    function synchronizeImage() {
      if (!sourceImage.complete || sourceImage.naturalWidth === 0) {
        return;
      }

      const source = sourceImage.currentSrc || sourceImage.src;

      if (zoomImage.getAttribute("src") !== source) {
        zoomImage.src = source;
      }

      updateZoom();
    }

    sourceImage.addEventListener("load", synchronizeImage);

    sourceImage.addEventListener("error", function () {
      zoomImage.removeAttribute("src");
      status.textContent =
        "Satellite imagery is unavailable. Use the PAGASA source link.";
    });

    zoomImage.addEventListener("load", function () {
      updateZoom();

      status.textContent =
        "Zoomed regional image loaded. Check the observation " +
        "timestamp on the original image.";
    });

    zoomImage.addEventListener("error", function () {
      status.textContent = "The enlarged image could not load.";
    });

    slider.addEventListener("input", updateZoom);

    const resizeObserver = new ResizeObserver(updateZoom);
    resizeObserver.observe(viewport);

    synchronizeImage();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeSatelliteZoom,
      { once: true }
    );
  } else {
    initializeSatelliteZoom();
  }
})();
