import { translations } from './translations.js';

// State Management
const appState = {
  currentLanguage: 'en',
  currentScreen: 'home',
  globalWaterStatus: 'safe', // 'safe', 'careful', 'risk'
  
  // Sources data
  sources: {
    ro: { nameKey: 'panchayatRO', status: 'safe', trust: 5, type: 'RO Plant', distance: 150, time: 2, complaints: [] },
    tank: { nameKey: 'villageTank', status: 'safe', trust: 4, type: 'Water Tank', distance: 400, time: 5, complaints: [] },
    school: { nameKey: 'schoolPump', status: 'careful', trust: 3, type: 'Handpump', distance: 280, time: 4, complaints: ['Bad Taste'] },
    temple: { nameKey: 'templeWell', status: 'risk', trust: 1, type: 'Open Well', distance: 650, time: 9, complaints: ['Dirty Color', 'Family Sick'] }
  },

  // ASHA Sickness Reports
  sicknessCases: {
    diarrhea: 0,
    vomiting: 0,
    fever: 0
  },

  // Voice Assistant state
  isListening: false,
  activeSpeech: null,

  // Selected map source details
  selectedSourceId: 'ro',
  userCoords: [17.4483, 78.3488],

  // Current Story page
  currentStoryIndex: 0
};

// DOM Elements
const dom = {
  screens: {},
  langBtns: document.querySelectorAll('.lang-btn'),
  audioHelperBtn: document.getElementById('audio-helper'),
  
  // Home Status Card
  homeStatusCard: document.getElementById('home-status-card'),
  homeStatusIconBox: document.getElementById('home-status-icon-box'),
  homeStatusText: document.getElementById('home-status-text'),
  homeStatusBadge: document.getElementById('home-status-badge'),
  homeFeedList: document.getElementById('home-feed-list'),

  // Report Form
  reportGrid: document.getElementById('report-grid-options'),
  submitReportBtn: document.getElementById('submit-report-btn'),
  successToast: document.getElementById('success-toast'),
  
  // Map Screen
  mapMarkers: null,
  detailCard: document.getElementById('map-detail-card'),
  detailName: document.getElementById('detail-name'),
  detailStatus: document.getElementById('detail-status'),
  detailTrust: document.getElementById('detail-trust'),
  detailComplaints: document.getElementById('detail-complaints'),
  
  // Finder Screen
  finderContainer: document.getElementById('finder-items-list'),
  directionsOverlay: document.getElementById('directions-overlay'),
  directionsProgress: document.getElementById('directions-progress'),
  directionsTitle: document.getElementById('directions-title'),
  directionsCloseBtn: document.getElementById('directions-close'),

  // ASHA
  ashaRiskBar: document.getElementById('asha-risk-bar'),
  ashaRiskLabel: document.getElementById('asha-risk-label'),
  ashaDiarrheaVal: document.getElementById('asha-diarrhea-val'),
  ashaVomitingVal: document.getElementById('asha-vomiting-val'),
  ashaFeverVal: document.getElementById('asha-fever-val'),
  ashaTotalCasesVal: document.getElementById('asha-total-cases-val'),

  // Reputation List
  reputationList: document.getElementById('reputation-items-list'),

  // Story UI
  storyTitle: document.getElementById('story-card-title'),
  storyText: document.getElementById('story-card-text'),
  storyArt: document.getElementById('story-card-art'),
  storyPrevBtn: document.getElementById('story-prev'),
  storyNextBtn: document.getElementById('story-next'),

  // Voice UI
  voiceGreeting: document.getElementById('voice-greeting-bubble'),
  micBtn: document.getElementById('mic-button'),
  audioWave: document.getElementById('audio-wave'),
  voiceSuggestions: document.getElementById('voice-suggestions-list'),

  // Emergency Alert
  emergencyAlert: document.getElementById('emergency-alert'),
  emergencyClose: document.getElementById('emergency-close'),
  emergencyFinderBtn: document.getElementById('emergency-finder-btn'),

  // Audio playing feedback
  audioFeedback: document.getElementById('audio-feedback-banner'),
  audioFeedbackText: document.getElementById('audio-feedback-text'),
  audioStopBtn: document.getElementById('audio-stop-btn')
};

// Initialize screen elements dynamically
document.querySelectorAll('.screen').forEach(scr => {
  dom.screens[scr.id.replace('-screen', '')] = scr;
});

// Fonts Dictionary
const langFonts = {
  en: "var(--font-en)",
  hi: "var(--font-hi)",
  te: "var(--font-te)"
};

// Helper: Merge API state into appState
function mergeState(apiData) {
  if (!apiData) return;
  appState.globalWaterStatus = apiData.globalWaterStatus;
  appState.sicknessCases = apiData.sicknessCases;
  
  if (apiData.sources) {
    Object.keys(apiData.sources).forEach(key => {
      if (appState.sources[key]) {
        appState.sources[key].status = apiData.sources[key].status;
        appState.sources[key].trust = apiData.sources[key].trust;
        appState.sources[key].complaints = apiData.sources[key].complaints;
      }
    });
  }
}

// Helper: Refresh all UI components based on the latest state
function refreshAllUI() {
  updateGlobalWaterUI();
  updateFeedUI();
  updateAshaScreenVals();
  updateMapMarkers();
  if (appState.currentScreen === 'finder') {
    renderFinderList();
  }
  if (appState.currentScreen === 'reputation') {
    renderReputationList();
  }
}

// API: Fetch state from backend
async function fetchState() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Failed to fetch state');
    const apiData = await res.json();
    mergeState(apiData);
    refreshAllUI();
  } catch (err) {
    console.error('Error fetching state:', err);
  }
}

// API: Send report action to backend
async function sendReportAction(problems, targetSource) {
  try {
    const res = await fetch('/api/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'report',
        payload: { problems, targetSource }
      })
    });
    if (!res.ok) throw new Error('Report submission failed');
    const data = await res.json();
    mergeState(data.state);
    refreshAllUI();
  } catch (err) {
    console.error('Error submitting report:', err);
  }
}

// API: Send sickness log action to backend
async function sendSicknessAction(type, count) {
  try {
    const res = await fetch('/api/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'sickness',
        payload: { type, count }
      })
    });
    if (!res.ok) throw new Error('Sickness log failed');
    const data = await res.json();
    mergeState(data.state);
    refreshAllUI();
  } catch (err) {
    console.error('Error logging sickness case:', err);
  }
}

// API: Reset database state on backend
async function resetAPIState() {
  try {
    const res = await fetch('/api/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'reset' })
    });
    if (!res.ok) throw new Error('Reset failed');
    const data = await res.json();
    mergeState(data.state);
    refreshAllUI();
  } catch (err) {
    console.error('Error resetting state:', err);
  }
}

// Helper: update ASHA UI counter values
function updateAshaScreenVals() {
  if (dom.ashaDiarrheaVal) dom.ashaDiarrheaVal.textContent = appState.sicknessCases.diarrhea;
  if (dom.ashaVomitingVal) dom.ashaVomitingVal.textContent = appState.sicknessCases.vomiting;
  if (dom.ashaFeverVal) dom.ashaFeverVal.textContent = appState.sicknessCases.fever;
  
  const total = appState.sicknessCases.diarrhea + appState.sicknessCases.vomiting + appState.sicknessCases.fever;
  if (dom.ashaTotalCasesVal) dom.ashaTotalCasesVal.textContent = total;

  const dict = translations[appState.currentLanguage];
  let riskPercentage = Math.min(100, (total / 10) * 100);
  if (dom.ashaRiskBar) dom.ashaRiskBar.style.width = `${riskPercentage}%`;

  if (dom.ashaRiskLabel) {
    if (total <= 2) {
      if (dom.ashaRiskBar) dom.ashaRiskBar.style.background = 'var(--green-safe)';
      dom.ashaRiskLabel.textContent = `${dict.low || 'Low'} (${total} cases)`;
    } else if (total <= 5) {
      if (dom.ashaRiskBar) dom.ashaRiskBar.style.background = 'var(--orange-warning)';
      dom.ashaRiskLabel.textContent = `${dict.medium || 'Medium'} (${total} cases)`;
    } else {
      if (dom.ashaRiskBar) dom.ashaRiskBar.style.background = 'var(--red-danger)';
      dom.ashaRiskLabel.textContent = `${dict.high || 'High'} (${total} cases)`;
    }
  }
}

// App Initialization
window.addEventListener('DOMContentLoaded', async () => {
  setupLanguageSwitcher();
  setupReportScreen();
  setupMapScreen();
  setupFinderScreen();
  setupAshaScreen();
  setupReputationScreen();
  setupStoriesScreen();
  setupVoiceScreen();
  setupEmergencyAlert();
  
  // Load initial backend database state
  await fetchState();
  
  // Initial render
  updateLanguage('en');
  navigateTo('home');
  updateGlobalWaterUI();
  updateFeedUI();

  // Hide splash screen after logo animation completes
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.classList.add('fade-out');
      // Fully hide layout after opacity transition ends
      setTimeout(() => {
        splash.style.display = 'none';
      }, 500);
    }
  }, 2600); // 2.6 seconds allows animations to play fully
});

// Navigation Controller (Hub and Spoke)
window.navigateTo = function(screenId) {
  // Hide current active screen
  Object.keys(dom.screens).forEach(id => {
    dom.screens[id].classList.remove('active');
  });

  // Show selected screen
  if (dom.screens[screenId]) {
    dom.screens[screenId].classList.add('active');
    appState.currentScreen = screenId;
  }

  // Scroll to top of the viewport
  document.getElementById('screens-viewport').scrollTop = 0;

  // Screen specific rendering/triggers
  if (screenId === 'map') {
    selectMapSource(appState.selectedSourceId);
    setTimeout(() => {
      if (map) {
        map.invalidateSize();
        const selected = markers[appState.selectedSourceId];
        if (selected) {
          map.panTo(selected.coords);
        }
      }
    }, 200);
  }
  if (screenId === 'finder') {
    renderFinderList();
  }
  if (screenId === 'reputation') {
    renderReputationList();
  }
  if (screenId === 'stories') {
    appState.currentStoryIndex = 0;
    renderStory();
  }
  if (screenId === 'voice') {
    renderVoiceSuggestions();
  }
  if (screenId === 'asha') {
    updateAshaScreenVals();
  }

  // Clear routing lines if navigating away from map screen
  if (screenId !== 'map' && map && activeRoutePolyline) {
    map.removeLayer(activeRoutePolyline);
    activeRoutePolyline = null;
  }

  // Stop any reading TTS from previous screen
  stopTTS();
};

// Localization Handler
function setupLanguageSwitcher() {
  dom.langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.langBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const lang = btn.dataset.lang;
      updateLanguage(lang);
    });
  });

  // Audio helper (readout entire page text in the current language)
  dom.audioHelperBtn.addEventListener('click', () => {
    const activeText = getScreenSpeechText();
    speakText(activeText);
  });

  dom.audioStopBtn.addEventListener('click', () => {
    stopTTS();
  });
}

function updateLanguage(lang) {
  appState.currentLanguage = lang;
  
  // Set active font family
  document.body.style.setProperty('--font-active', langFonts[lang]);
  
  // Update translation attributes
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (translations[lang] && translations[lang][key]) {
      if (el.tagName === 'INPUT' && el.type === 'button') {
        el.value = translations[lang][key];
      } else {
        el.textContent = translations[lang][key];
      }
    }
  });

  // Update source text titles
  updateGlobalWaterUI();
  
  if (appState.currentScreen === 'finder') {
    renderFinderList();
  }
  if (appState.currentScreen === 'reputation') {
    renderReputationList();
  }
  if (appState.currentScreen === 'map') {
    selectMapSource(appState.selectedSourceId);
  }
  if (appState.currentScreen === 'stories') {
    renderStory();
  }
  if (appState.currentScreen === 'voice') {
    renderVoiceSuggestions();
  }
  if (appState.currentScreen === 'asha') {
    updateAshaScreenVals();
  }
}

// Text to Speech logic
function speakText(text) {
  stopTTS();
  
  if (!text) return;
  
  // Show UI feedback banner
  dom.audioFeedbackText.textContent = `${translations[appState.currentLanguage].speakingText} "${text.substring(0, 35)}..."`;
  dom.audioFeedback.classList.add('active');

  // Fallback indicator
  console.log(`TTS Output (${appState.currentLanguage}):`, text);

  if ('speechSynthesis' in window) {
    appState.activeSpeech = new SpeechSynthesisUtterance(text);
    
    // Choose appropriate voice/locale
    if (appState.currentLanguage === 'hi') {
      appState.activeSpeech.lang = 'hi-IN';
    } else if (appState.currentLanguage === 'te') {
      appState.activeSpeech.lang = 'te-IN';
    } else {
      appState.activeSpeech.lang = 'en-US';
    }

    appState.activeSpeech.rate = 0.9; // speak slightly slower for clarity
    
    appState.activeSpeech.onstart = () => {
      const avatar = document.getElementById('bot-avatar-container');
      if (avatar) avatar.classList.add('responding');
    };

    appState.activeSpeech.onend = () => {
      dom.audioFeedback.classList.remove('active');
      const avatar = document.getElementById('bot-avatar-container');
      if (avatar) avatar.classList.remove('responding');
    };

    appState.activeSpeech.onerror = () => {
      dom.audioFeedback.classList.remove('active');
      const avatar = document.getElementById('bot-avatar-container');
      if (avatar) avatar.classList.remove('responding');
    };

    window.speechSynthesis.speak(appState.activeSpeech);
    
    // Make sure responding starts immediately
    const avatar = document.getElementById('bot-avatar-container');
    if (avatar) avatar.classList.add('responding');
  } else {
    // Simulated speech timeout for browsers without TTS support
    const avatar = document.getElementById('bot-avatar-container');
    if (avatar) avatar.classList.add('responding');
    setTimeout(() => {
      dom.audioFeedback.classList.remove('active');
      if (avatar) avatar.classList.remove('responding');
    }, 4000);
  }
}

// Cancel Active voice speech
function stopTTS() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  dom.audioFeedback.classList.remove('active');
  const avatar = document.getElementById('bot-avatar-container');
  if (avatar) avatar.classList.remove('responding');
}

// Get text content of active screen to read out loud
function getScreenSpeechText() {
  const dict = translations[appState.currentLanguage];
  switch (appState.currentScreen) {
    case 'home':
      const riskMsg = appState.globalWaterStatus === 'safe' ? dict.normalStatus : 
                      appState.globalWaterStatus === 'careful' ? dict.warningStatus : dict.alertStatus;
      return `${dict.appName}. ${dict.villageName}. ${dict.howIsWater} ${dict.lastReport}: ${riskMsg}`;
    case 'report':
      return `${dict.reportTitle}. ${dict.oneTapReport}`;
    case 'map':
      const s = appState.sources[appState.selectedSourceId];
      const sName = dict[s.nameKey] || s.nameKey;
      return `${dict.mapTitle}. ${sName}. ${dict.sourceStatus}: ${s.status === 'safe' ? dict.looksSafe : s.status === 'careful' ? dict.beCareful : dict.highRisk}. ${dict.trustScore}: ${s.trust} stars.`;
    case 'finder':
      return `${dict.finderTitle}. ${dict.needSafeWater}`;
    case 'warning':
      return `${dict.healthWarningTitle}. ${dict.complaintsIncreasing}. ${dict.guidanceBoil}. ${dict.guidanceFilter}. ${dict.guidanceAvoid}.`;
    case 'asha':
      return `${dict.ashaTitle}. ${dict.villageRiskStatus}. ${dict.reportSickness}`;
    case 'reputation':
      return `${dict.reputationTitle}`;
    case 'stories':
      const activeStory = getActiveStoryData();
      return `${activeStory.title}. ${activeStory.text}`;
    case 'voice':
      return `${dict.voiceTitle}. ${dict.voiceInstruction}`;
    default:
      return dict.appName;
  }
}

// Global Water Safety State Updater
function updateGlobalWaterUI() {
  const dict = translations[appState.currentLanguage];
  
  // Reset classes
  dom.homeStatusCard.className = 'status-indicator-card';
  dom.homeStatusBadge.className = 'status-badge';
  
  if (appState.globalWaterStatus === 'safe') {
    dom.homeStatusCard.classList.add('safe');
    dom.homeStatusBadge.className = 'status-badge safe';
    dom.homeStatusText.textContent = dict.normalStatus;
    dom.homeStatusBadge.textContent = dict.looksSafe;
    
    // Green check shield SVG
    dom.homeStatusIconBox.innerHTML = `
      <svg class="status-glow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <polyline points="9 11 11 13 15 9"/>
      </svg>
    `;
  } else if (appState.globalWaterStatus === 'careful') {
    dom.homeStatusCard.classList.add('careful');
    dom.homeStatusBadge.className = 'status-badge careful';
    dom.homeStatusText.textContent = dict.warningStatus;
    dom.homeStatusBadge.textContent = dict.beCareful;
    
    // Orange warning triangle SVG
    dom.homeStatusIconBox.innerHTML = `
      <svg class="status-glow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    `;
  } else {
    dom.homeStatusCard.classList.add('risk');
    dom.homeStatusBadge.className = 'status-badge risk';
    dom.homeStatusText.textContent = dict.alertStatus;
    dom.homeStatusBadge.textContent = dict.highRisk;
    
    // Red emergency octagon SVG
    dom.homeStatusIconBox.innerHTML = `
      <svg class="status-glow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    `;
    
    // Auto-trigger full screen Emergency Alert
    showEmergencyAlert();
  }
}

// Feed Rendering
function updateFeedUI() {
  dom.homeFeedList.innerHTML = '';
  
  // Construct logs list from states of all sources
  const feedItems = [];
  Object.keys(appState.sources).forEach(key => {
    const s = appState.sources[key];
    if (s.complaints.length > 0) {
      s.complaints.forEach(complaint => {
        feedItems.push({
          sourceKey: s.nameKey,
          status: s.status,
          textKey: getComplaintKey(complaint),
          time: '30m'
        });
      });
    }
  });

  // Default entries if no complaints
  if (feedItems.length === 0) {
    feedItems.push({
      sourceKey: 'panchayatRO',
      status: 'safe',
      textKey: 'looksSafe',
      time: '2h'
    });
    feedItems.push({
      sourceKey: 'villageTank',
      status: 'safe',
      textKey: 'looksSafe',
      time: '4h'
    });
  }

  feedItems.forEach(item => {
    const dict = translations[appState.currentLanguage];
    const sourceName = dict[item.sourceKey] || item.sourceKey;
    const descText = dict[item.textKey] || item.textKey;

    const li = document.createElement('div');
    li.className = `feed-card ${item.status}`;
    
    // Choose mini status icon symbol
    let statusIcon = '🟢';
    if (item.status === 'careful') statusIcon = '⚠️';
    else if (item.status === 'risk') statusIcon = '🚨';

    li.innerHTML = `
      <div class="feed-status-badge-mini ${item.status}">${statusIcon}</div>
      <div class="feed-details">
        <div class="feed-row-top">
          <span class="feed-source-name">${sourceName}</span>
          <span class="feed-time-badge">${item.time} ${dict.ago}</span>
        </div>
        <p class="feed-desc">${descText}</p>
      </div>
    `;
    dom.homeFeedList.appendChild(li);
  });
}

function getComplaintKey(complaint) {
  const map = {
    'Bad Taste': 'tasteBad',
    'Bad Smell': 'smellBad',
    'Dirty Color': 'dirtyColor',
    'No Supply': 'noSupply',
    'Family Sick': 'familySick'
  };
  return map[complaint] || 'tasteBad';
}

// Screen 2: Report Water Problem Logic
let selectedProblems = [];
function setupReportScreen() {
  const problemOptions = [
    { key: 'tasteBad', label: '💧 Bad Taste', val: 'Bad Taste' },
    { key: 'smellBad', label: '👃 Bad Smell', val: 'Bad Smell' },
    { key: 'dirtyColor', label: '🟤 Dirty Color', val: 'Dirty Color' },
    { key: 'noSupply', label: '🚱 No Supply', val: 'No Supply' },
    { key: 'familySick', label: '😷 Family Sick', val: 'Family Sick' }
  ];

  // Render grid dynamically
  dom.reportGrid.innerHTML = '';
  problemOptions.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'report-button';
    btn.dataset.problem = opt.val;
    btn.dataset.i18n = opt.key;
    
    // Split into Icon and Text
    const icon = opt.label.split(' ')[0];
    btn.innerHTML = `
      <span class="report-button-icon">${icon}</span>
      <span class="report-button-label" data-i18n="${opt.key}"></span>
    `;

    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      const val = btn.dataset.problem;
      if (selectedProblems.includes(val)) {
        selectedProblems = selectedProblems.filter(p => p !== val);
      } else {
        selectedProblems.push(val);
      }
    });

    dom.reportGrid.appendChild(btn);
  });

  // Submit Report Trigger
  dom.submitReportBtn.addEventListener('click', async () => {
    if (selectedProblems.length === 0) {
      alert("Please select at least one problem to submit.");
      return;
    }

    // Process submission: assign complaints to the active source
    let targetSource = 'school';
    if (selectedProblems.includes('Family Sick')) {
      targetSource = 'temple';
    }

    // Submit report to database on backend API
    await sendReportAction(selectedProblems, targetSource);

    // Show Success Alert
    dom.successToast.classList.add('active');
    speakText(translations[appState.currentLanguage].reportSuccess);

    setTimeout(() => {
      dom.successToast.classList.remove('active');
      
      // Reset report screen selections
      selectedProblems = [];
      document.querySelectorAll('.report-button').forEach(b => b.classList.remove('selected'));
      
      // Route back to Hub (Home)
      navigateTo('home');
    }, 2800);
  });
}

// Screen 3: Village Water Map Logic
let map = null;
let markers = {};

function createCustomMarkerHTML(id, source) {
  const isSelected = appState.selectedSourceId === id ? 'active-selected' : '';
  const emoji = id === 'ro' ? '🧪' : id === 'tank' ? '🚰' : id === 'school' ? '🏫' : '🛕';
  const dict = translations[appState.currentLanguage];
  const labelText = dict[source.nameKey] || source.nameKey;
  
  return `
    <div class="custom-map-marker ${source.status} ${isSelected}" data-source="${id}">
      <span class="marker-emoji">${emoji}</span>
      <span class="marker-label">${labelText}</span>
    </div>
  `;
}

// Calculate distance in meters between two lat/lng pairs
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI/180;
  const phi2 = lat2 * Math.PI/180;
  const deltaPhi = (lat2-lat1) * Math.PI/180;
  const deltaLambda = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return Math.round(R * c); // in meters
}

// Reverse geocode lat/lon to town/village/city name using free OSM Nominatim API
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`, {
      headers: {
        'Accept-Language': appState.currentLanguage
      }
    });
    if (!res.ok) throw new Error('Nominatim reverse geocode failed');
    const data = await res.json();
    const address = data.address || {};
    
    // Pick the most granular name available
    const locationName = address.village || address.suburb || address.town || address.city || address.hamlet || address.neighbourhood || address.county || "Tirupati";
    return locationName;
  } catch (err) {
    console.error('Error reverse geocoding coordinate:', err);
    return null;
  }
}

// Dynamically update the village name in translations dictionary and UI header
function updateVillageName(locationName) {
  // Update translation dictionaries
  translations.en.villageName = `${locationName}`;
  translations.hi.villageName = `${locationName}`;
  translations.te.villageName = `${locationName}`;

  // Find the header element and update it directly
  const el = document.querySelector('[data-i18n="villageName"]');
  if (el) {
    el.textContent = locationName;
  }
}

function setupMapScreen() {
  const villageCenter = [17.4483, 78.3488];
  
  map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView(villageCenter, 15);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);

  L.control.zoom({
    position: 'bottomright'
  }).addTo(map);

  // Helper to initialize markers centered near a coordinate
  const initializeMarkersWithCenter = (centerCoords) => {
    // Clear old markers if any exist
    Object.keys(markers).forEach(id => {
      if (markers[id] && markers[id].marker) {
        map.removeLayer(markers[id].marker);
      }
    });
    markers = {};

    // Offset water sources dynamically near the current center
    const locations = {
      ro: { coords: [centerCoords[0] + 0.0008, centerCoords[1] - 0.0009], emoji: '🧪' },
      tank: { coords: [centerCoords[0] - 0.0008, centerCoords[1] + 0.0024], emoji: '🚰' },
      school: { coords: [centerCoords[0] + 0.0019, centerCoords[1] + 0.0007], emoji: '🏫' },
      temple: { coords: [centerCoords[0] - 0.0021, centerCoords[1] - 0.0023], emoji: '🛕' }
    };

    // Calculate real-time distances & travel times relative to the user/center coords
    Object.keys(appState.sources).forEach(id => {
      const s = appState.sources[id];
      const loc = locations[id] || { coords: centerCoords, emoji: '💧' };
      
      const dist = getDistanceMeters(centerCoords[0], centerCoords[1], loc.coords[0], loc.coords[1]);
      s.distance = dist;
      // Walking speed ~ 80 meters per minute
      s.time = Math.max(1, Math.round(dist / 80));

      const markerIcon = L.divIcon({
        html: createCustomMarkerHTML(id, s),
        className: 'custom-map-icon',
        iconSize: [50, 50],
        iconAnchor: [25, 25]
      });

      const marker = L.marker(loc.coords, { icon: markerIcon }).addTo(map);
      marker.on('click', () => {
        selectMapSource(id);
      });

      markers[id] = { marker, coords: loc.coords, emoji: loc.emoji };
    });

    // Refresh Safe Water Finder list with real calculated distances
    renderFinderList();
  };

  // Attempt real-time geolocation with fallback
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userCoords = [position.coords.latitude, position.coords.longitude];
        appState.userCoords = userCoords;
        map.setView(userCoords, 15);
        
        // Add User actual location marker
        L.marker(userCoords, {
          icon: L.divIcon({
            html: '<div class="user-location-marker">👤</div>',
            className: 'user-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        }).addTo(map);

        initializeMarkersWithCenter(userCoords);

        // Fetch location name and update village indicator header dynamically
        reverseGeocode(position.coords.latitude, position.coords.longitude).then(locationName => {
          if (locationName) {
            updateVillageName(locationName);
          }
        });
      },
      (error) => {
        console.warn("Geolocation permission denied or failed, using village center fallback:", error);
        initializeMarkersWithCenter(villageCenter);
      }
    );
  } else {
    initializeMarkersWithCenter(villageCenter);
  }
}

function selectMapSource(sourceId) {
  appState.selectedSourceId = sourceId;
  updateMapMarkers();

  if (map && markers[sourceId]) {
    map.panTo(markers[sourceId].coords);
  }

  const s = appState.sources[sourceId];
  const dict = translations[appState.currentLanguage];
  const name = dict[s.nameKey] || s.nameKey;

  // Render info details
  dom.detailCard.classList.add('active');
  dom.detailName.textContent = name;
  
  dom.detailStatus.className = `status-badge ${s.status}`;
  dom.detailStatus.textContent = s.status === 'safe' ? dict.looksSafe : s.status === 'careful' ? dict.beCareful : dict.highRisk;

  // Trust stars rendering
  dom.detailTrust.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    star.textContent = i <= s.trust ? '★' : '☆';
    dom.detailTrust.appendChild(star);
  }

  // Display active complaints lists
  if (s.complaints.length > 0) {
    dom.detailComplaints.innerHTML = s.complaints.map(c => `<li>${dict[getComplaintKey(c)] || c}</li>`).join('');
  } else {
    dom.detailComplaints.innerHTML = `<li>${dict.none}</li>`;
  }
}

function updateMapMarkers() {
  if (!map) return;
  
  Object.keys(markers).forEach(id => {
    const s = appState.sources[id];
    const markerInfo = markers[id];
    
    if (markerInfo && markerInfo.marker) {
      const newIcon = L.divIcon({
        html: createCustomMarkerHTML(id, s),
        className: 'custom-map-icon',
        iconSize: [50, 50],
        iconAnchor: [25, 25]
      });
      markerInfo.marker.setIcon(newIcon);
    }
  });
}

// Screen 4: Safe Water Finder
function setupFinderScreen() {
  // Navigation back button inside direction popup
  dom.directionsCloseBtn.addEventListener('click', () => {
    dom.directionsOverlay.classList.remove('active');
    dom.directionsProgress.style.width = '0';
  });
}

function renderFinderList() {
  dom.finderContainer.innerHTML = '';
  
  // Convert source dictionary into array, sorted by distance
  const sortedSources = Object.keys(appState.sources).map(id => ({
    id,
    ...appState.sources[id]
  })).sort((a, b) => a.distance - b.distance);

  sortedSources.forEach(s => {
    // Only display if the source isn't High Risk
    if (s.status === 'risk') return;

    const dict = translations[appState.currentLanguage];
    const name = dict[s.nameKey] || s.nameKey;

    const div = document.createElement('div');
    div.className = 'finder-item';
    div.innerHTML = `
      <div class="finder-left">
        <div class="finder-icon">${s.id === 'ro' ? '🧪' : s.id === 'tank' ? '🚰' : '💧'}</div>
        <div class="finder-info">
          <h3>${name}</h3>
          <p>${s.status === 'safe' ? dict.looksSafe : dict.beCareful}</p>
        </div>
      </div>
      <div class="finder-right">
        <div class="finder-metric">${s.distance}m (${s.time} ${dict.mins})</div>
        <button class="direction-btn" onclick="startSimulatingDirections('${s.id}')">${dict.showWay}</button>
      </div>
    `;
    dom.finderContainer.appendChild(div);
  });
}

// Map route path loader (draw path only)
let activeRoutePolyline = null;

window.startSimulatingDirections = function(sourceId) {
  // Navigate to map screen
  navigateTo('map');

  // Highlight the target source card detail
  selectMapSource(sourceId);

  const startCoords = appState.userCoords || [17.4483, 78.3488];
  const endCoords = markers[sourceId] ? markers[sourceId].coords : startCoords;

  // Clear any existing active route layers
  if (map && activeRoutePolyline) {
    map.removeLayer(activeRoutePolyline);
  }

  // Draw path polyline
  activeRoutePolyline = L.polyline([startCoords, endCoords], {
    color: 'var(--blue-primary)',
    weight: 5,
    opacity: 0.8,
    dashArray: '10, 10',
    lineCap: 'round'
  }).addTo(map);

  // Pan map to bounds to view entire route
  const bounds = L.latLngBounds([startCoords, endCoords]);
  map.fitBounds(bounds, { padding: [50, 50] });
};

// Screen 6: ASHA Worker Dashboard
function setupAshaScreen() {
  // Event listeners for ASHA sickness case counter buttons
  setupAshaCounter('diarrhea', dom.ashaDiarrheaVal);
  setupAshaCounter('vomiting', dom.ashaVomitingVal);
  setupAshaCounter('fever', dom.ashaFeverVal);
}

function setupAshaCounter(type, displayEl) {
  const plusBtn = document.querySelector(`.asha-btn-count.plus[data-type="${type}"]`);
  const minusBtn = document.querySelector(`.asha-btn-count.minus[data-type="${type}"]`);

  plusBtn.addEventListener('click', async () => {
    await sendSicknessAction(type, 1);
  });

  minusBtn.addEventListener('click', async () => {
    if (appState.sicknessCases[type] > 0) {
      await sendSicknessAction(type, -1);
    }
  });
}

// Screen 7: Reputation Screen Rating list
function setupReputationScreen() {}

function renderReputationList() {
  dom.reputationList.innerHTML = '';
  const dict = translations[appState.currentLanguage];
  
  Object.keys(appState.sources).forEach(id => {
    const s = appState.sources[id];
    const name = dict[s.nameKey] || s.nameKey;
    
    // Simple trends mapping
    let trendClass = 'stable';
    let trendLabel = dict.stable;
    let trendIcon = '➔';

    if (s.status === 'safe') {
      trendClass = 'up';
      trendLabel = dict.improving;
      trendIcon = '▲';
    } else if (s.status === 'risk') {
      trendClass = 'down';
      trendLabel = dict.declining;
      trendIcon = '▼';
    }

    // Stars construct
    let starsStr = '';
    for (let i = 1; i <= 5; i++) {
      starsStr += i <= s.trust ? '★' : '☆';
    }

    const div = document.createElement('div');
    div.className = 'reputation-item';
    div.innerHTML = `
      <div class="reputation-left">
        <div class="reputation-name">${name}</div>
        <div class="stars-row">${starsStr}</div>
      </div>
      <div class="reputation-right">
        <div class="reputation-trend ${trendClass}">
          <span>${trendIcon}</span> ${trendLabel}
        </div>
      </div>
    `;
    dom.reputationList.appendChild(div);
  });
}

// Screen 8: Awareness Stories
const storiesData = [
  {
    titleKey: 'story1Title',
    textKey: 'story1Text',
    emoji: '🦴☠️🧪'
  },
  {
    titleKey: 'story2Title',
    textKey: 'story2Text',
    emoji: '🦠🦠🔬'
  },
  {
    titleKey: 'story3Title',
    textKey: 'story3Text',
    emoji: '🥛🧺🪰'
  },
  {
    titleKey: 'story4Title',
    textKey: 'story4Text',
    emoji: '🧼🤕☠️'
  },
  {
    titleKey: 'story5Title',
    textKey: 'story5Text',
    emoji: '🚽🚯🕳️'
  },
  {
    titleKey: 'story6Title',
    textKey: 'story6Text',
    emoji: '🧼🙌🚰'
  },
  {
    titleKey: 'story7Title',
    textKey: 'story7Text',
    emoji: '🏺🧼🧽'
  },
  {
    titleKey: 'story8Title',
    textKey: 'story8Text',
    emoji: '🧪💦🛡️'
  },
  {
    titleKey: 'story9Title',
    textKey: 'story9Text',
    emoji: '🥛🧪🧒'
  },
  {
    titleKey: 'story10Title',
    textKey: 'story10Text',
    emoji: '📢👩‍⚕️🏡'
  }
];

function setupStoriesScreen() {
  dom.storyPrevBtn.addEventListener('click', () => {
    if (appState.currentStoryIndex > 0) {
      appState.currentStoryIndex--;
      renderStory();
    }
  });

  dom.storyNextBtn.addEventListener('click', () => {
    if (appState.currentStoryIndex === storiesData.length - 1) {
      navigateTo('home');
    } else if (appState.currentStoryIndex < storiesData.length - 1) {
      appState.currentStoryIndex++;
      renderStory();
    }
  });
}

function getActiveStoryData() {
  const index = appState.currentStoryIndex;
  const story = storiesData[index];
  const dict = translations[appState.currentLanguage];
  return {
    title: dict[story.titleKey] || story.titleKey,
    text: dict[story.textKey] || story.textKey,
    emoji: story.emoji
  };
}

function renderStory() {
  const activeStory = getActiveStoryData();
  const dict = translations[appState.currentLanguage];

  dom.storyTitle.textContent = activeStory.title;
  dom.storyText.textContent = activeStory.text;
  
  // Render high-quality generated village illustration
  dom.storyArt.innerHTML = `<img src="./story${appState.currentStoryIndex + 1}.png" class="story-art-img" alt="${activeStory.title}">`;
  
  // Enable/disable buttons
  dom.storyPrevBtn.style.visibility = appState.currentStoryIndex === 0 ? 'hidden' : 'visible';
  dom.storyNextBtn.textContent = appState.currentStoryIndex === storiesData.length - 1 ? dict.home : dict.nextStory;
}

// Screen 9: Voice Assistant UI
function setupVoiceScreen() {
  dom.micBtn.addEventListener('click', () => {
    if (appState.isListening) {
      stopListening();
    } else {
      startListening();
    }
  });
}

function renderVoiceSuggestions() {
  const dict = translations[appState.currentLanguage];
  dom.voiceSuggestions.innerHTML = '';
  
  const questions = [
    { text: dict.voiceQ1, ans: dict.voiceA1 },
    { text: dict.voiceQ2, ans: dict.voiceA2 },
    { text: dict.voiceQ3, ans: dict.voiceA3 }
  ];

  questions.forEach(q => {
    const chip = document.createElement('button');
    chip.className = 'voice-chip-btn';
    chip.textContent = q.text;
    chip.addEventListener('click', () => {
      triggerVoiceExchange(q.text, q.ans);
    });
    dom.voiceSuggestions.appendChild(chip);
  });
}

function startListening() {
  appState.isListening = true;
  dom.micBtn.classList.add('listening');
  dom.audioWave.classList.add('active');
  
  const dict = translations[appState.currentLanguage];
  
  // Update greeting bubble with listening message
  if (dom.voiceGreeting) {
    dom.voiceGreeting.innerHTML = `<span>🎙️ ${dict.listening}</span>`;
    dom.voiceGreeting.classList.add('bubble-flash');
    setTimeout(() => dom.voiceGreeting.classList.remove('bubble-flash'), 600);
  }

  // Auto input a mock question after 2.5 seconds
  setTimeout(() => {
    if (appState.isListening) {
      stopListening();
      
      // Auto pick a random question
      const questions = [
        { text: dict.voiceQ1, ans: dict.voiceA1 },
        { text: dict.voiceQ2, ans: dict.voiceA2 },
        { text: dict.voiceQ3, ans: dict.voiceA3 }
      ];
      const selected = questions[Math.floor(Math.random() * questions.length)];
      
      triggerVoiceExchange(selected.text, selected.ans);
    }
  }, 2500);
}

function stopListening() {
  appState.isListening = false;
  dom.micBtn.classList.remove('listening');
  dom.audioWave.classList.remove('active');
}

function addChatBubble(text, sender) {
  // Update the greeting bubble text with the latest message
  if (dom.voiceGreeting) {
    dom.voiceGreeting.innerHTML = `<span>${sender === 'user' ? '🙂' : '🤖'} ${text}</span>`;
    // Add a brief highlight animation
    dom.voiceGreeting.classList.add('bubble-flash');
    setTimeout(() => dom.voiceGreeting.classList.remove('bubble-flash'), 600);
  }
}

function triggerVoiceExchange(question, answer) {
  addChatBubble(question, 'user');
  
  setTimeout(() => {
    addChatBubble(answer, 'bot');
    speakText(answer);
  }, 600);
}

// Screen 10: Emergency Alert logic
function setupEmergencyAlert() {
  dom.emergencyClose.addEventListener('click', () => {
    dismissEmergencyAlert();
  });

  dom.emergencyFinderBtn.addEventListener('click', () => {
    dismissEmergencyAlert();
    navigateTo('finder');
  });
}

function showEmergencyAlert() {
  dom.emergencyAlert.classList.add('active');
  
  // Speak emergency text out loud for safety awareness
  if ('speechSynthesis' in window) {
    const dict = translations[appState.currentLanguage];
    speakText(`${dict.emergencyTitle}. ${dict.emergencyWarning}. ${dict.emergencyDesc}`);
  }
}

function dismissEmergencyAlert() {
  dom.emergencyAlert.classList.remove('active');
  stopTTS();
  
  // Demote state back to warning (careful) so it doesn't loop infinitely
  if (appState.globalWaterStatus === 'risk') {
    appState.globalWaterStatus = 'careful';
    updateGlobalWaterUI();
  }
}

// Presentation Demo Tools Helper (Sidebar Controls)
window.demoSetStatus = async function(status) {
  // Always reset database first to get a clean slate
  await resetAPIState();
  
  if (status === 'careful') {
    await sendReportAction(['Bad Taste'], 'school');
  } else if (status === 'risk') {
    await sendReportAction(['Family Sick'], 'temple');
    await sendSicknessAction('diarrhea', 4);
    await sendSicknessAction('vomiting', 3);
  }
};
