// ✅ FINAL + FIXED + NO-FLICKER + CLEANUP + INPUT RESET script.js

let map, userMarker, directionsService, directionsRenderer;
let markers = [], markerCluster;
let liveRouteInterval = null;
let routeDestination = null, trackingRoute = false, forceCenter = false;
let currentCenter = null, currentRadius = null;
let lastUserPosition = null, selectedCategory = "ALL", isMapLocked = true;
let fromPosition = null, toPosition = null;

function positionsEqual(pos1, pos2) {
    if (!pos1 || !pos2) return false;
    return Math.abs(pos1.lat - pos2.lat) < 0.00001 && Math.abs(pos1.lng - pos2.lng) < 0.00001;
}

window.initMap = () => {
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            lastUserPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            initializeMap(lastUserPosition);
        },
        () => {
            alert("User location not available.");
            initializeMap({ lat: 40.9928, lng: 29.1202 });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
};

function initializeMap(center) {
    map = new google.maps.Map(document.getElementById("map"), { center, zoom: 15 });

    userMarker = new google.maps.Marker({
        position: center,
        map,
        title: "Your Location",
        icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            scaledSize: new google.maps.Size(40, 40)
        }
    });

    directionsRenderer.setMap(map);
    setupControls();
    setupAutocomplete();
    setupSearchInput();
    updateVisiblePlaces();

    map.addListener("idle", () => {
        if (trackingRoute && forceCenter && isMapLocked) {
            map.setCenter(fromPosition);
            map.setZoom(18);
        }
        updateVisiblePlaces();
    });

    navigator.geolocation.watchPosition(pos => {
        lastUserPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userMarker.setPosition(lastUserPosition);
        if (trackingRoute && forceCenter && isMapLocked) {
            map.setCenter(fromPosition);
            map.setZoom(18);
        }
        updateLiveRoute();
    });
}

function setupControls() {
    document.getElementById("go-to-user").addEventListener("click", () => {
        if (lastUserPosition) {
            map.setCenter(lastUserPosition);
            map.setZoom(18);
        } else {
            alert("User location not available.");
        }
    });

    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedCategory = btn.dataset.type;
            updateVisiblePlaces();
        });
    });

    const lockBtn = document.createElement("button");
    lockBtn.id = "lock-map";
    lockBtn.innerHTML = isMapLocked ? "🔒" : "🔓";
    lockBtn.style.cssText = `
        position: absolute; bottom: 25px; right: 120px; z-index: 1000;
        background-color: ${isMapLocked ? "#ffc107" : "green"}; color: black; border: none;
        padding: 10px 14px; border-radius: 8px; cursor: pointer;
        font-size: 14px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `;
    lockBtn.addEventListener("click", () => {
        isMapLocked = !isMapLocked;
        lockBtn.innerHTML = isMapLocked ? "🔒" : "🔓";
        lockBtn.style.backgroundColor = isMapLocked ? "#ffc107" : "green";
    });
    document.body.appendChild(lockBtn);
}

function updateVisiblePlaces() {
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;

    const center = map.getCenter();
    const radius = haversineDistance(
        bounds.getNorthEast().lat(), bounds.getNorthEast().lng(),
        bounds.getSouthWest().lat(), bounds.getSouthWest().lng()
    ) / 2;

    currentCenter = { lat: center.lat(), lng: center.lng() };
    currentRadius = radius;

    if (map.getZoom() < 12) {
        markers.forEach(m => m.setMap(null));
        if (markerCluster) markerCluster.clearMarkers();
        return;
    }

    fetch(`/api/cafe/nearby?lat=${center.lat()}&lng=${center.lng()}&radius=${radius}`)
        .then(res => res.json())
        .then(data => {
            markers.forEach(m => m.setMap(null));
            markers = [];
            if (markerCluster) markerCluster.clearMarkers();

            data.forEach(place => {
                if (selectedCategory !== "ALL" && place.type.toLowerCase() !== selectedCategory.toLowerCase()) return;
                const [lng, lat] = place.location.coordinates;
                createMarker(place, { lat, lng }, getMarkerColor(place.type));
            });

            markerCluster = new window.markerClusterer.MarkerClusterer({ map, markers });
        });
}

function createMarker(place, position, color) {
    const marker = new google.maps.Marker({
        position,
        title: place.name,
        icon: {
            url: `http://maps.google.com/mapfiles/ms/icons/${color}-dot.png`,
            scaledSize: new google.maps.Size(40, 40)
        },
        map
    });
    marker.addListener("click", () => showCafeDetails(place, position));
    markers.push(marker);
    return marker;
}

function getMarkerColor(type) {
    switch (type.toLowerCase()) {
        case "cafe": return "red";
        case "market": return "green";
        case "hairdresser": return "purple";
        default: return "gray";
    }
}

function showCafeDetails(cafe, destination) {
    document.getElementById("cafe-detail-panel").style.display = "block";
    document.getElementById("cafe-detail-name").textContent = cafe.name;
    document.getElementById("cafe-detail-address").textContent = cafe.location?.address || "Address not available.";

    const imageEl = document.getElementById("cafe-detail-image");
    imageEl.src = cafe.image || "";
    imageEl.style.display = cafe.image ? "block" : "none";

    document.getElementById("cafe-directions-btn").onclick = () => {
        document.getElementById("cafe-detail-panel").style.display = "none";
        openRoutePanel(cafe, destination);
    };
}

function openRoutePanel(cafe, destination) {
    document.getElementById("route-panel").style.display = "block";
    document.getElementById("route-reset").style.display = "none";

    toPosition = destination;
    routeDestination = destination;

    document.getElementById("to-input").value = cafe.name;

    if (lastUserPosition) {
        fromPosition = lastUserPosition;
        document.getElementById("from-input").value = "📍 Your Location";
    }

    updateRoutePreview();
}

function buildRoute() {
    const travelMode = document.getElementById("travel-mode").value;
    if (!fromPosition || !toPosition) return;

    directionsService.route({ origin: fromPosition, destination: toPosition, travelMode }, (result, status) => {
        if (status === "OK") {
            directionsRenderer.setDirections(result);

            markers.forEach(marker => {
                const pos = marker.getPosition();
                if (!positionsEqual(pos.toJSON(), fromPosition) && !positionsEqual(pos.toJSON(), toPosition)) {
                    marker.setMap(null);
                }
            });

            const route = result.routes[0].legs[0];
            document.getElementById("route-panel").style.display = "none";
            document.getElementById("route-reset").style.display = "block";
            document.getElementById("remaining-duration").textContent = route.duration.text;
            document.getElementById("remaining-distance").textContent = route.distance.text;
            document.getElementById("total-distance").textContent = route.distance.text;

            trackingRoute = true;
            forceCenter = true;

            const isUserLocation = positionsEqual(fromPosition, lastUserPosition);

            if (isMapLocked) {
                map.setCenter(isUserLocation ? lastUserPosition : fromPosition);
                map.setZoom(18);
            }

            if (liveRouteInterval) clearInterval(liveRouteInterval);
            liveRouteInterval = setInterval(updateLiveRoute, 5000);
        }
    });
}

function updateRoutePreview() {
    const travelMode = document.getElementById("travel-mode").value;
    if (!fromPosition || !toPosition) return;

    directionsService.route({ origin: fromPosition, destination: toPosition, travelMode }, (result, status) => {
        if (status === "OK") {
            const route = result.routes[0].legs[0];
            document.getElementById("route-distance").textContent = `Distance: ${route.distance.text}`;
            document.getElementById("route-duration").textContent = `Duration: ${route.duration.text}`;
        }
    });
}

function updateLiveRoute() {
    if (!routeDestination || !trackingRoute) return;
    const travelMode = document.getElementById("travel-mode").value;
    const origin = userMarker.getPosition();

    directionsService.route({ origin, destination: routeDestination, travelMode }, (result, status) => {
        if (status === "OK") {
            const route = result.routes[0].legs[0];
            document.getElementById("remaining-duration").textContent = route.duration.text;
            document.getElementById("remaining-distance").textContent = route.distance.text;
        }
    });
}

function setupAutocomplete() {
    const inputs = [
        { inputId: "from-input", listId: "from-results", isFrom: true },
        { inputId: "to-input", listId: "to-results", isFrom: false }
    ];

    inputs.forEach(({ inputId, listId, isFrom }) => {
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);

        input.addEventListener("input", async () => {
            const q = input.value.trim();
            if (!q) return list.innerHTML = "";

            const res = await fetch(`/api/cafe/search?q=${q}`);
            const results = await res.json();

            list.innerHTML = `<li data-your-location="true">📍 Your Location</li>` +
                results.map(cafe => `<li data-cafe='${JSON.stringify(cafe)}'>${cafe.name}</li>`).join("");
        });

        list.addEventListener("click", (e) => {
            if (e.target.tagName !== "LI") return;

            if (e.target.dataset.yourLocation) {
                if (lastUserPosition) {
                    if (isFrom) fromPosition = lastUserPosition;
                    else toPosition = lastUserPosition;
                    input.value = "📍 Your Location";
                    map.setCenter(lastUserPosition);
                }
            } else {
                const cafe = JSON.parse(e.target.dataset.cafe);
                const [lng, lat] = cafe.location.coordinates;
                const pos = { lat, lng };
                if (isFrom) fromPosition = pos;
                else toPosition = pos;
                input.value = cafe.name;
                map.setCenter(pos);
                map.setZoom(17);
                if (!isFrom) showCafeDetails(cafe, pos);
            }
            list.innerHTML = "";
            updateRoutePreview();
        });
    });

    document.getElementById("build-route").addEventListener("click", buildRoute);
    document.getElementById("clear-route").addEventListener("click", () => {
        document.getElementById("route-panel").style.display = "none";
        routeDestination = null;
        fromPosition = null;
        toPosition = null;
        document.getElementById("from-input").value = "";
        document.getElementById("to-input").value = "";
    });
    document.getElementById("cancel-route").addEventListener("click", () => {
        directionsRenderer.set("directions", null);
        document.getElementById("route-reset").style.display = "none";
        trackingRoute = false;
        forceCenter = false;
        routeDestination = null;
        fromPosition = null;
        toPosition = null;
        document.getElementById("from-input").value = "";
        document.getElementById("to-input").value = "";
        if (liveRouteInterval) clearInterval(liveRouteInterval);
        updateVisiblePlaces();
    });

    document.getElementById("travel-mode").addEventListener("change", updateRoutePreview);
}

function setupSearchInput() {
    const searchInput = document.getElementById("search-input");
    const searchResults = document.getElementById("search-results");

    searchInput.addEventListener("input", async () => {
        const query = searchInput.value.trim();
        if (!query) return searchResults.innerHTML = "";

        const res = await fetch(`/api/cafe/search?q=${query}`);
        const results = await res.json();

        searchResults.innerHTML = `<li data-your-location="true">📍 Your Location</li>` +
            results.map(cafe => `<li data-cafe='${JSON.stringify(cafe)}'>${cafe.name}</li>`).join("");
    });

    searchResults.addEventListener("click", (e) => {
        if (e.target.tagName !== "LI") return;

        if (e.target.dataset.yourLocation) {
            if (lastUserPosition) {
                map.setCenter(lastUserPosition);
                map.setZoom(18);
            }
        } else {
            const cafe = JSON.parse(e.target.dataset.cafe);
            const [lng, lat] = cafe.location.coordinates;
            map.setCenter({ lat, lng });
            map.setZoom(18);
            showCafeDetails(cafe, { lat, lng });
        }

        searchInput.value = "";
        searchResults.innerHTML = "";
    });
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
