// === DOM ELEMENTS ===
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const pickupInput = document.getElementById('pickup-input');
const dropoffInput = document.getElementById('dropoff-input');
const pickupSuggestions = document.getElementById('pickup-suggestions');
const dropoffSuggestions = document.getElementById('dropoff-suggestions');
const clearPickupBtn = document.getElementById('clear-pickup');
const clearDropoffBtn = document.getElementById('clear-dropoff');
const btnFindRides = document.getElementById('btn-find-rides');
const rideOptionsSection = document.getElementById('ride-options');
const rideCards = document.querySelectorAll('.ride-card');
const btnConfirm = document.getElementById('btn-confirm');
const paymentSelect = document.getElementById('payment-method');

// Auth Modal Elements
const authModal = document.getElementById('auth-modal');
const btnLogin = document.querySelector('.btn-login');
const btnSignup = document.querySelector('.btn-signup');
const closeModal = document.querySelector('.close-modal');
const modalTitle = document.getElementById('modal-title');
const authForm = document.getElementById('auth-form');

// === STATE ===
let map, routingControl;
let pickupCoords = null;
let dropoffCoords = null;
let routeCoordinates = []; // Stores the computed geographical path
let carMarker = null; // Reference to the animated trip vehicle
let selectedRideIndex = 1; // Default to Smart Sedan

// === MAP INITIALIZATION (Leaflet.js) ===
function initMap() {
    // Default to a central location (e.g., India or US, setting to New York for demo)
    map = L.map('map', {
        zoomControl: false // Move zoom control if needed, or hide it
    }).setView([40.7128, -74.0060], 13);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19,
    }).addTo(map);
}

// === LOCATION AUTOSUGGEST (Nominatim API) ===
let debounceTimer;

async function fetchSuggestions(query, limit = 5) {
    if (!query || query.length < 3) return [];
    
    // REST API call to OpenStreetMap Nominatim
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}`;
    
    try {
        const response = await fetch(url, {
            headers: { 'Accept-Language': 'en-US,en;q=0.9' }
        });
        return await response.json();
    } catch (e) {
        console.error('Error fetching locations', e);
        return [];
    }
}

function handleInput(e, suggestionsList, type) {
    const query = e.target.value;
    clearTimeout(debounceTimer);
    
    // Check form validity on every input
    validateForm();
    
    // Debounce API calls to prevent spamming
    debounceTimer = setTimeout(async () => {
        if (query.length < 3) {
            suggestionsList.style.display = 'none';
            return;
        }

        const results = await fetchSuggestions(query);
        suggestionsList.innerHTML = '';
        
        if (results.length > 0) {
            results.forEach(place => {
                const li = document.createElement('li');
                li.innerHTML = `<i class="ph ph-map-pin"></i> <span>${place.display_name}</span>`;
                
                li.addEventListener('click', () => {
                    e.target.value = place.display_name.split(',')[0]; // Simplify name in input
                    suggestionsList.style.display = 'none';
                    
                    // Save Coordinates
                    if (type === 'pickup') {
                        pickupCoords = L.latLng(place.lat, place.lon);
                    } else {
                        dropoffCoords = L.latLng(place.lat, place.lon);
                    }
                    
                    validateForm();
                    drawRouteIfReady();
                });
                
                suggestionsList.appendChild(li);
            });
            suggestionsList.style.display = 'block';
        } else {
            suggestionsList.style.display = 'none';
        }
    }, 400); // 400ms debounce
}

function closeAllSuggestions() {
    pickupSuggestions.style.display = 'none';
    dropoffSuggestions.style.display = 'none';
}

// === ROUTING LOGIC ===
function drawRouteIfReady() {
    if (pickupCoords && dropoffCoords) {
        if (routingControl) {
            map.removeControl(routingControl);
        }

        // Custom markers
        const pickupIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color:black;width:12px;height:12px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const dropoffIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color:#276ef1;width:12px;height:12px;border-radius:0%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        routingControl = L.Routing.control({
            waypoints: [pickupCoords, dropoffCoords],
            routeWhileDragging: false,
            showAlternatives: false,
            fitSelectedRoutes: true,
            lineOptions: {
                styles: [{ color: '#000000', opacity: 0.8, weight: 4 }]
            },
            createMarker: function(i, waypoint, n) {
                const marker_icon = i === 0 ? pickupIcon : dropoffIcon;
                return L.marker(waypoint.latLng, { icon: marker_icon });
            }
        }).addTo(map);

        // Hide string instructions (handled by CSS, but good measure)
        routingControl.on('routesfound', function(e) {
            const routes = e.routes;
            const route = routes[0];
            const distance = route.summary.totalDistance / 1000; // km
            
            // Save coordinates to animate the vehicle trip
            routeCoordinates = route.coordinates;
            
            // Dynamically price the rides based on distance
            document.getElementById('price-mini').innerText = `₹${Math.round(distance * 12)}`;
            document.getElementById('price-sedan').innerText = `₹${Math.round(distance * 18)}`;
            document.getElementById('price-suv').innerText = `₹${Math.round(distance * 25)}`;
        });
    }
}

// === PREMIUM CAR DRIVING ANIMATION ===
function simulateTripAnimation(coords, durationMs, callback) {
    if(!coords || coords.length === 0) {
        if(callback) callback();
        return;
    }
    
    // Create the digital representation of the user vehicle on the map
    const carIcon = L.divIcon({
        className: 'animated-car-icon',
        html: `<div style="background-color: var(--primary-color); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.4); z-index: 1000;"><i class="ph-fill ph-car-profile" style="font-size: 16px;"></i></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });
    
    // Hide original routing line and markers to draw our custom animated state
    if(routingControl) {
        map.removeControl(routingControl);
    }
    
    // Dropoff pin
    const dropoffIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:var(--accent-color);width:14px;height:14px;border-radius:0%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    L.marker(coords[coords.length - 1], { icon: dropoffIcon }).addTo(map);

    // The shrinking path line
    const activePath = L.polyline(coords, { color: '#000000', weight: 5, opacity: 0.8 }).addTo(map);

    if (carMarker) {
        map.removeLayer(carMarker);
    }
    
    carMarker = L.marker(coords[0], {icon: carIcon, zIndexOffset: 1000 }).addTo(map);
    
    let startTime = null;
    
    function animateFrame(currentTime) {
        if(!startTime) startTime = currentTime;
        
        const elapsed = currentTime - startTime;
        let progress = Math.min(elapsed / durationMs, 1);
        
        // Find exact interpolation between two index nodes
        const exactIndex = progress * (coords.length - 1);
        const lowerIndex = Math.floor(exactIndex);
        const upperIndex = Math.ceil(exactIndex);
        
        if (lowerIndex === upperIndex) {
            carMarker.setLatLng(coords[lowerIndex]);
            activePath.setLatLngs(coords.slice(lowerIndex));
        } else {
            const fraction = exactIndex - lowerIndex;
            const interpolationLat = coords[lowerIndex].lat + fraction * (coords[upperIndex].lat - coords[lowerIndex].lat);
            const interpolationLng = coords[lowerIndex].lng + fraction * (coords[upperIndex].lng - coords[lowerIndex].lng);
            
            const currentLatLng = L.latLng(interpolationLat, interpolationLng);
            carMarker.setLatLng(currentLatLng);
            
            // Rebuild string excluding passed nodes
            const remainingCoords = [currentLatLng, ...coords.slice(upperIndex)];
            activePath.setLatLngs(remainingCoords);
        }
        
        if (progress < 1) {
            requestAnimationFrame(animateFrame);
        } else {
            if (callback) callback();
        }
    }
    
    requestAnimationFrame(animateFrame);
}

// === FORM LOGIC & EVENT LISTENERS ===

// Toggle Mobile Menu
menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('show');
});

// Fix Navbar Links Action (Switching Pages)
const navItems = document.querySelectorAll('.nav-links a:not(.btn-login):not(.btn-signup)');
const sections = {
    'ride': document.querySelector('.booking-layout'),
    'drive': document.getElementById('drive'),
    'business': document.getElementById('business'),
    'about': document.getElementById('about')
};

// Hide all non-ride sections initially
Object.keys(sections).forEach(k => {
    if(k !== 'ride' && sections[k]) sections[k].style.display = 'none';
});

navItems.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault(); 
        
        // Update active class
        navItems.forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');
        
        // Switch Layout
        const targetId = e.target.getAttribute('href').replace('#', '');
        
        Object.keys(sections).forEach(k => {
            if(sections[k]) {
                if (k === targetId) {
                    sections[k].style.display = (k === 'ride') ? 'grid' : 'flex';
                } else {
                    sections[k].style.display = 'none';
                }
            }
        });
        
        // Close mobile menu if open
        navLinks.classList.remove('show');
    });
});

// Clear buttons logic
clearPickupBtn.addEventListener('click', () => {
    pickupInput.value = '';
    pickupCoords = null;
    pickupInput.focus();
    validateForm();
    if (routingControl) map.removeControl(routingControl);
    if (carMarker) map.removeLayer(carMarker);
    rideOptionsSection.style.display = 'none';
});

clearDropoffBtn.addEventListener('click', () => {
    dropoffInput.value = '';
    dropoffCoords = null;
    dropoffInput.focus();
    validateForm();
    if (routingControl) map.removeControl(routingControl);
    if (carMarker) map.removeLayer(carMarker);
    rideOptionsSection.style.display = 'none';
});

// Input Listeners
pickupInput.addEventListener('input', (e) => handleInput(e, pickupSuggestions, 'pickup'));
dropoffInput.addEventListener('input', (e) => handleInput(e, dropoffSuggestions, 'dropoff'));

// Close suggestions on outside click
document.addEventListener('click', (e) => {
    if (!pickupInput.contains(e.target) && !pickupSuggestions.contains(e.target)) {
        pickupSuggestions.style.display = 'none';
    }
    if (!dropoffInput.contains(e.target) && !dropoffSuggestions.contains(e.target)) {
        dropoffSuggestions.style.display = 'none';
    }
});

// Form Validation
function validateForm() {
    // If both inputs have text, enable the button
    if (pickupInput.value.trim().length > 0 && dropoffInput.value.trim().length > 0) {
        btnFindRides.disabled = false;
    } else {
        btnFindRides.disabled = true;
    }
}

// Simulation of finding a ride API loading moving car
const searchAnimation = document.getElementById('search-animation');

btnFindRides.addEventListener('click', () => {
    btnFindRides.style.display = 'none'; // hide the button immediately
    searchAnimation.style.display = 'flex'; // show the car driving animation

    // Simulate network delay searching for cars
    setTimeout(() => {
        searchAnimation.style.display = 'none'; // hide animation
        rideOptionsSection.style.display = 'block'; // show ride selection
        
        // Force the map to fit the bounds if drawn
        if (pickupCoords && dropoffCoords) {
           const bounds = L.latLngBounds(pickupCoords, dropoffCoords);
           map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, 2500); // 2.5 second delay matching the animation logic
});

// Ride selection mechanic
rideCards.forEach((card, index) => {
    card.addEventListener('click', () => {
        // Remove selection from all
        rideCards.forEach(c => c.classList.remove('selected'));
        // Add to clicked
        card.classList.add('selected');
        selectedRideIndex = index;
    });
});

// Final confirm button logic with extended Trip Flow
btnConfirm.addEventListener('click', () => {
    btnConfirm.innerHTML = 'Connecting to Driver...';
    btnConfirm.disabled = true;
    btnConfirm.style.opacity = '1';
    
    // Simulate Driver Connection
    setTimeout(() => {
        btnConfirm.innerHTML = '<i class="ph-bold ph-check-circle"></i> Driver on the way';
        btnConfirm.style.background = '#10b981'; // vibrant green
        
        // Simulate Driver Arrival
        setTimeout(() => {
            btnConfirm.innerHTML = '<i class="ph-bold ph-car-profile"></i> Driver Arrived!';
            btnConfirm.style.background = 'var(--primary-color)';
            btnConfirm.style.transform = 'scale(1.02)';
            
            // Simulate Trip Started (Animated Map Flow)
            setTimeout(() => {
                btnConfirm.innerHTML = '<i class="ph-bold ph-navigation-arrow"></i> Trip Started';
                btnConfirm.style.background = 'var(--accent-color)'; // Electric blue
                
                // Animate vehicle tracking across map 
                const TRIP_DURATION_MS = 6000; // 6 second demo ride simulation
                
                // Focus map to whole route
                map.fitBounds(L.latLngBounds(pickupCoords, dropoffCoords), { padding: [50, 50] });

                simulateTripAnimation(routeCoordinates, TRIP_DURATION_MS, () => {
                    // Simulate Destination Reached Callback
                    const method = paymentSelect.options[paymentSelect.selectedIndex].text;
                    btnConfirm.innerHTML = `<i class="ph-bold ph-flag-checkered"></i> Reached Destination (Paid via ${method})`;
                    btnConfirm.style.background = '#000000';
                    btnConfirm.style.transform = 'scale(1)';
                    
                    setTimeout(()=> {
                       btnConfirm.innerHTML = '<i class="ph-bold ph-arrow-counter-clockwise"></i> Book New Ride';
                       btnConfirm.addEventListener('click', () => window.location.reload(), {once: true});
                    }, 1500);
                });
                
            }, 3000);
        }, 3500);
    }, 2000);
});

// === AUTH MODAL LOGIC ===
function openModal(title) {
    modalTitle.textContent = title;
    authModal.style.display = 'flex';
}

btnLogin.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('Log In');
});

btnSignup.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('Sign Up');
});

closeModal.addEventListener('click', () => {
    authModal.style.display = 'none';
});

// Close modal if clicked outside content
window.addEventListener('click', (e) => {
    if (e.target === authModal) {
        authModal.style.display = 'none';
    }
});

// Prevent form submission redirect
authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = authForm.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Authenticating...';
    setTimeout(() => {
        authModal.style.display = 'none';
        btn.innerHTML = originalText;
        authForm.reset();
        // Give feedback
        btnLogin.textContent = 'My Account';
        btnSignup.style.display = 'none';
    }, 1500);
});

// Init Mapping on Load
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    validateForm(); // Init state of button
});
