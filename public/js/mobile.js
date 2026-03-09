/*-----MOBILE CSV UPLOADS-----*/

let eventScoutingData = [];
let pitScoutingData = [];
let matchScheduleData = [];
let oprData = [];

let mobileCharts = {
    epaChart: null,
    fuelShotChart: null,
    fuelFerriedChart: null,
    autoClimb: null,
    teleClimb: null,
    teleFuelShot: null,
    teleFuelFerried: null,
    autoFuelShot: null,
    autoFuelFerried: null,
    weightedTeleFuel: null  // Add this line
};

if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined' && Chart.register) {
    Chart.register(ChartDataLabels);
}

let highlightedTeam = null;

const statusData = document.getElementById('statusData');
const statusPit = document.getElementById('statusPit');
const statusSchedule = document.getElementById('statusSchedule');
const statusOPR = document.getElementById('statusOPR');

const dataFileInput = document.getElementById('dataFile');
const pitFileInput = document.getElementById('pitFile');
const scheduleFileInput = document.getElementById('scheduleFile');
const oprFileInput = document.getElementById('oprFile');

const submitData = document.getElementById('submitData');
const submitPit = document.getElementById('submitPit');
const submitSchedule = document.getElementById('submitSchedule');
const submitOPR = document.getElementById('submitOPR');

document.addEventListener('DOMContentLoaded', function () {
    console.log('Mobile.js initialized');

    if (typeof Papa === 'undefined' && typeof window.Papa !== 'undefined') {
        window.Papa = window.Papa;
    }

    initMenu();

    if (submitData) {
        submitData.addEventListener('click', () => {
            handleFileUpload('dataFile', 'eventScouting', statusData);
        });
    }

    if (submitPit) {
        submitPit.addEventListener('click', () => {
            handleFileUpload('pitFile', 'pitScouting', statusPit);
        });
    }

    if (submitSchedule) {
        submitSchedule.addEventListener('click', () => {
            handleFileUpload('scheduleFile', 'matchSchedule', statusSchedule);
        });
    }

    if (submitOPR) {
        submitOPR.addEventListener('click', () => {
            handleFileUpload('oprFile', 'opr', statusOPR);
        });
    }

    loadSavedFiles();

    setupMobileEventListeners();

    setTimeout(() => {
        loadOverviewData();
    }, 100);

    window.deleteFile = deleteFile;

    loadGlobalHiddenTeams();

    initMobileFilterView();
    initMobileRankings();
});


function initMenu() {
    const menuButton = document.getElementById('menuButton');
    const menuPanel = document.getElementById('menuPanel');
    const menuOverlay = document.getElementById('menuOverlay');
    const closeMenu = document.getElementById('closeMenu');

    console.log('Menu button found:', menuButton);
    console.log('Menu panel found:', menuPanel);
    console.log('Menu overlay found:', menuOverlay);
    console.log('Close menu found:', closeMenu);

    if (!menuButton) {
        console.error('Menu button not found!');
        return;
    }

    if (!menuPanel) {
        console.error('Menu panel not found!');
        return;
    }

    if (!menuOverlay) {
        console.error('Menu overlay not found!');
        return;
    }

    if (!closeMenu) {
        console.error('Close menu button not found!');
        return;
    }

    menuButton.onclick = function (e) {
        e.preventDefault();
        console.log('Menu button clicked - opening menu');
        menuPanel.classList.add('open');
        menuOverlay.classList.add('active');
        document.body.classList.add('menu-open');
    };

    closeMenu.onclick = function (e) {
        e.preventDefault();
        console.log('Close button clicked - closing menu');
        menuPanel.classList.remove('open');
        menuOverlay.classList.remove('active');
        document.body.classList.remove('menu-open');
    };

    menuOverlay.onclick = function (e) {
        e.preventDefault();
        console.log('Overlay clicked - closing menu');
        menuPanel.classList.remove('open');
        menuOverlay.classList.remove('active');
        document.body.classList.remove('menu-open');
    };

    window.closeMenu = function () {
        console.log('Closing menu via global function');
        menuPanel.classList.remove('open');
        menuOverlay.classList.remove('active');
        document.body.classList.remove('menu-open');
    };

    console.log('Menu initialized successfully');
}

function setupMobileEventListeners() {
    const overviewSearchBtn = document.getElementById('overviewSearchBtn');
    const overviewClearBtn = document.getElementById('overviewClearBtn');
    const overviewSearchInput = document.getElementById('overviewSearchMobile');

    if (overviewSearchBtn) {
        overviewSearchBtn.addEventListener('click', handleMobileOverviewSearch);
    }

    if (overviewClearBtn) {
        overviewClearBtn.addEventListener('click', clearMobileOverviewSearch);
    }

    if (overviewSearchInput) {
        overviewSearchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                handleMobileOverviewSearch();
            }
        });
    }

    const individualSearchBtn = document.getElementById('individualSearchBtn');
    const individualSearchInput = document.getElementById('individualSearchMobile');

    if (individualSearchBtn) {
        individualSearchBtn.addEventListener('click', handleMobileIndividualSearch);
    }

    if (individualSearchInput) {
        individualSearchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                handleMobileIndividualSearch();
            }
        });
    }

    const comparisonSearchBtn = document.getElementById('comparisonSearchBtn');

    if (comparisonSearchBtn) {
        comparisonSearchBtn.addEventListener('click', handleMobileComparison);
    }

    const predictMatchBtn = document.getElementById('predictMatchBtn');

    if (predictMatchBtn) {
        predictMatchBtn.addEventListener('click', handleMobileMatchPrediction);
    }
}

function handleFileUpload(inputId, dataKey, statusDiv) {
    const fileInput = document.getElementById(inputId);
    const file = fileInput.files[0];

    if (!file) {
        updateStatus(statusDiv, "Please select a file.", false);
        return;
    }

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
        updateStatus(statusDiv, "Invalid file type. Please upload a CSV.", false);
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        const text = e.target.result;

        switch (dataKey) {
            case 'eventScouting':
                parseEventScoutingCSV(text, file.name);
                break;
            case 'pitScouting':
                parsePitScoutingCSV(text, file.name);
                break;
            case 'matchSchedule':
                parseMatchScheduleCSV(text, file.name);
                break;
            case 'opr':
                parseOPRCSV(text, file.name);
                break;
        }

        localStorage.setItem(`${dataKey}CSV`, text);
        localStorage.setItem(`${dataKey}FileName`, file.name);

        updateStatus(statusDiv, file.name, true);

        fileInput.value = '';

        const activeTab = document.querySelector('.mobile-tab-content.active-tab');
        if (activeTab && activeTab.id === 'overview-tab') {
            loadOverviewData();
        }
    };
    reader.readAsText(file);
}

function parseEventScoutingCSV(csvText, fileName) {
    if (typeof Papa === 'undefined') {
        console.error('PapaParse library not loaded');
        updateStatus(statusData, "Error: PapaParse not loaded", false);
        return;
    }

    try {
        const result = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false
        });

        if (result.errors && result.errors.length > 0) {
            console.warn('Parse errors:', result.errors);
        }

        eventScoutingData = result.data;
        console.log("Event Scouting Data loaded:", eventScoutingData.length, "rows");

        window.csvText = csvText;
    } catch (err) {
        console.error('Error parsing event CSV:', err);
        updateStatus(statusData, "Error parsing CSV", false);
    }
}

function parsePitScoutingCSV(csvText, fileName) {
    if (typeof Papa === 'undefined') {
        console.error('PapaParse library not loaded');
        updateStatus(statusPit, "Error: PapaParse not loaded", false);
        return;
    }

    try {
        const result = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false
        });

        if (result.errors && result.errors.length > 0) {
            console.warn('Parse errors:', result.errors);
        }

        const firstRow = result.data[0] || {};
        const hasTeamNumber = firstRow.hasOwnProperty('Team Number');
        const hasTrench = firstRow.hasOwnProperty('Trench');
        const hasGroundIntake = firstRow.hasOwnProperty('Ground Intake');
        const hasShootOnFly = firstRow.hasOwnProperty('Shoot on Fly');

        if (!hasTeamNumber || !hasTrench || !hasGroundIntake || !hasShootOnFly) {
            updateStatus(statusPit, "Missing required columns", false);
            console.log('Expected headers: "Team Number", "Trench", "Ground Intake", "Shoot on Fly"');
            return;
        }

        pitScoutingData = result.data;
        console.log("Pit Scouting Data loaded:", pitScoutingData.length, "rows");

        window.pitCsvText = csvText;
    } catch (err) {
        console.error('Error parsing pit CSV:', err);
        updateStatus(statusPit, "Error parsing CSV", false);
    }
}

function parseMatchScheduleCSV(csvText, fileName) {
    if (typeof Papa === 'undefined') {
        console.error('PapaParse library not loaded');
        updateStatus(statusSchedule, "Error: PapaParse not loaded", false);
        return;
    }

    try {
        const result = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false
        });

        if (result.errors && result.errors.length > 0) {
            console.warn('Parse errors:', result.errors);
        }

        const requiredHeaders = ['Match Number', 'Red 1', 'Red 2', 'Red 3', 'Blue 1', 'Blue 2', 'Blue 3'];
        const firstRow = result.data[0] || {};
        const missingHeaders = requiredHeaders.filter(h => !firstRow.hasOwnProperty(h));

        if (missingHeaders.length > 0) {
            updateStatus(statusSchedule, `Missing: ${missingHeaders.join(', ')}`, false);
            return;
        }

        matchScheduleData = result.data;
        console.log("Match Schedule loaded:", matchScheduleData.length, "matches");

        window.scheduleCsvText = csvText;
    } catch (err) {
        console.error('Error parsing schedule CSV:', err);
        updateStatus(statusSchedule, "Error parsing CSV", false);
    }
}

function parseOPRCSV(csvText, fileName) {
    if (typeof Papa === 'undefined') {
        console.error('PapaParse library not loaded');
        updateStatus(statusOPR, "Error: PapaParse not loaded", false);
        return;
    }

    try {
        const result = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false
        });

        if (result.errors && result.errors.length > 0) {
            console.warn('Parse errors:', result.errors);
        }

        const firstRow = result.data[0] || {};
        const hasTeamNumber = firstRow.hasOwnProperty('Team Number');
        const hasAutoOPR = firstRow.hasOwnProperty('Auto OPR');
        const hasTeleOPR = firstRow.hasOwnProperty('Tele OPR');
        const hasTotalOPR = firstRow.hasOwnProperty('Total OPR');

        if (!hasTeamNumber || !hasAutoOPR || !hasTeleOPR || !hasTotalOPR) {
            updateStatus(statusOPR, "Missing required columns", false);
            console.log('Expected headers: "Team Number", "Auto OPR", "Tele OPR", "Total OPR"');
            return;
        }

        oprData = result.data;
        console.log("OPR Data loaded:", oprData.length, "rows");

        window.oprCsvText = csvText;
    } catch (err) {
        console.error('Error parsing OPR CSV:', err);
        updateStatus(statusOPR, "Error parsing CSV", false);
    }
}

function deleteFile(inputId) {
    let dataKey, statusDiv, confirmMessage;

    switch (inputId) {
        case 'dataFile':
            dataKey = 'eventScouting';
            statusDiv = statusData;
            confirmMessage = "Are you sure you want to delete the event scouting data?";
            break;
        case 'pitFile':
            dataKey = 'pitScouting';
            statusDiv = statusPit;
            confirmMessage = "Are you sure you want to delete the pit scouting data?";
            break;
        case 'scheduleFile':
            dataKey = 'matchSchedule';
            statusDiv = statusSchedule;
            confirmMessage = "Are you sure you want to delete the match schedule?";
            break;
        case 'oprFile':
            dataKey = 'opr';
            statusDiv = statusOPR;
            confirmMessage = "Are you sure you want to delete the OPR data?";
            break;
        default:
            return;
    }

    if (!localStorage.getItem(`${dataKey}CSV`)) {
        alert("No file uploaded to delete.");
        return;
    }

    if (confirm(confirmMessage)) {
        if (dataKey === 'eventScouting') {
            eventScoutingData = [];
            window.csvText = '';
        }
        if (dataKey === 'pitScouting') {
            pitScoutingData = [];
            window.pitCsvText = '';
        }
        if (dataKey === 'matchSchedule') {
            matchScheduleData = [];
            window.scheduleCsvText = '';
        }
        if (dataKey === 'opr') {
            oprData = [];
            window.oprCsvText = '';
        }

        localStorage.removeItem(`${dataKey}CSV`);
        localStorage.removeItem(`${dataKey}FileName`);

        document.getElementById(inputId).value = '';

        updateStatusNeutral(statusDiv, "No file uploaded.");

        const activeTab = document.querySelector('.mobile-tab-content.active-tab');
        if (activeTab && activeTab.id === 'overview-tab') {
            loadOverviewData();
        }

        alert("File deleted successfully!");
    }
}

function updateStatus(statusDiv, message, success) {
    if (!statusDiv) return;

    statusDiv.classList.remove('uploaded', 'error');

    if (success) {
        statusDiv.classList.add('uploaded');
        const displayMessage = message.length > 30 ? message.substring(0, 27) + '...' : message;
        statusDiv.innerHTML = `<p style="text-align:center; font-size:1rem; margin:0; word-break:break-word;">✓ ${displayMessage}</p>`;
    } else {
        statusDiv.classList.add('error');
        statusDiv.innerHTML = `<p style="text-align:center; font-size:1rem; margin:0;">⚠ ${message}</p>`;
    }
}

function updateStatusNeutral(statusDiv, message) {
    if (!statusDiv) return;

    statusDiv.classList.remove('uploaded', 'error');
    statusDiv.style.background = "#1a1c1f";
    statusDiv.style.border = "2px solid #2a2d31";
    statusDiv.style.color = "#ffffff";
    statusDiv.innerHTML = `<p style="text-align:center; font-size:1rem; margin:0; color:#ccc;">📁 ${message}</p>`;
}

function loadSavedFiles() {
    const savedEventCSV = localStorage.getItem('eventScoutingCSV');
    const savedEventFileName = localStorage.getItem('eventScoutingFileName');
    if (savedEventCSV && savedEventFileName) {
        parseEventScoutingCSV(savedEventCSV, savedEventFileName);
        updateStatus(statusData, savedEventFileName, true);
    } else {
        updateStatusNeutral(statusData, "No file uploaded.");
    }

    const savedPitCSV = localStorage.getItem('pitScoutingCSV');
    const savedPitFileName = localStorage.getItem('pitScoutingFileName');
    if (savedPitCSV && savedPitFileName) {
        parsePitScoutingCSV(savedPitCSV, savedPitFileName);
        updateStatus(statusPit, savedPitFileName, true);
    } else {
        updateStatusNeutral(statusPit, "No file uploaded.");
    }

    const savedScheduleCSV = localStorage.getItem('matchScheduleCSV');
    const savedScheduleFileName = localStorage.getItem('matchScheduleFileName');
    if (savedScheduleCSV && savedScheduleFileName) {
        parseMatchScheduleCSV(savedScheduleCSV, savedScheduleFileName);
        updateStatus(statusSchedule, savedScheduleFileName, true);
    } else {
        updateStatusNeutral(statusSchedule, "No file uploaded.");
    }

    const savedOPRCSV = localStorage.getItem('oprCSV');
    const savedOPRFileName = localStorage.getItem('oprFileName');
    if (savedOPRCSV && savedOPRFileName) {
        parseOPRCSV(savedOPRCSV, savedOPRFileName);
        updateStatus(statusOPR, savedOPRFileName, true);
    } else {
        updateStatusNeutral(statusOPR, "No file uploaded.");
    }
}

function parseCSV() {
    if (typeof Papa === 'undefined') {
        console.error('PapaParse not loaded');
        return { data: [] };
    }

    const csvText = window.csvText || localStorage.getItem('eventScoutingCSV') || '';
    if (!csvText) return { data: [] };

    try {
        return Papa.parse(csvText, { header: true, skipEmptyLines: true });
    } catch (e) {
        console.error('Error parsing CSV:', e);
        return { data: [] };
    }
}

/*-----MOBILE OVERVIEW FUNCTIONS-----*/

/*-----MOBILE OVERVIEW FUNCTIONS-----*/

/*-----MOBILE OVERVIEW FUNCTIONS-----*/

function loadOverviewData() {
    console.log('Loading overview data...');

    const eventCSV = localStorage.getItem('eventScoutingCSV') || '';

    console.log('Event CSV exists:', !!eventCSV);

    renderMobileEpaChart(eventCSV);
    renderMobileFuelShotChart(eventCSV);  // Add this
    renderMobileFuelFerriedChart(eventCSV); // Add this
}

/*-----MOBILE OVERVIEW FUNCTIONS-----*/

function renderMobileEpaChart(eventCSV) {
    const container = document.getElementById('mobileEpaChartWrapper');
    if (!container) {
        console.error('EPA chart container not found');
        return;
    }

    const existingCanvas = container.querySelector('canvas');
    if (existingCanvas) {
        existingCanvas.remove();
    }

    console.log('Rendering EPA chart...');

    if (mobileCharts.epaChart) {
        mobileCharts.epaChart.destroy();
        mobileCharts.epaChart = null;
    }

    container.innerHTML = '';

    let eventData = [];
    if (eventCSV) {
        try {
            const parsed = Papa.parse(eventCSV, { header: true, skipEmptyLines: true });
            eventData = parsed.data || [];
            console.log('Parsed event data rows:', eventData.length);
        } catch (e) {
            console.error('Error parsing event CSV:', e);
        }
    }

    const teamStats = {};
    eventData.forEach(row => {
        const team = row['Team Number']?.toString().trim();
        if (!team) return;

        const points = parseFloat(row['Total Points'] || row['Total Score'] || 0);
        if (isNaN(points)) return;

        if (!teamStats[team]) {
            teamStats[team] = { totalPoints: 0, matchCount: 0 };
        }

        teamStats[team].totalPoints += points;
        teamStats[team].matchCount += 1;
    });

    const teams = Object.keys(teamStats).map(team => {
        const avgPoints = teamStats[team].matchCount > 0
            ? teamStats[team].totalPoints / teamStats[team].matchCount
            : 0;
        return {
            team: team,
            epa: avgPoints
        };
    });

    console.log('Teams with EPA data:', teams.length);

    if (teams.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #aaa; padding: 50px; font-size: 16px;">No EPA data available<br><span style="font-size: 14px;">Upload event scouting CSV</span></div>';
        return;
    }

    teams.sort((a, b) => b.epa - a.epa);

    const displayTeams = teams;

    const labels = displayTeams.map(t => `${t.team}`);
    const epaValues = displayTeams.map(t => t.epa);
    const colors = displayTeams.map(t => {
        if (t.team === highlightedTeam) return '#FFC0CB'; // Changed to FFC0CB for searched team
        if (t.team === '226') return '#FE59D7';
        return '#3EDBF0';
    });

    console.log('Creating EPA chart with', displayTeams.length, 'teams');

    const barWidth = 75;
    const spacing = 20;
    const totalWidth = Math.max(400, displayTeams.length * (barWidth + spacing));

    const scrollWrapper = document.createElement('div');
    scrollWrapper.style.cssText = `
        width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        position: relative;
    `;

    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
        width: ${totalWidth}px;
        height: 280px;
        position: relative;
        min-width: 100%;
    `;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
        width: 100% !important;
        height: 100% !important;
        display: block;
    `;

    canvasContainer.appendChild(canvas);
    scrollWrapper.appendChild(canvasContainer);
    container.appendChild(scrollWrapper);

    const ctx = canvas.getContext('2d');

    try {
        mobileCharts.epaChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'EPA',
                    data: epaValues,
                    backgroundColor: colors,
                    borderWidth: 0,
                    borderRadius: 6,
                    barThickness: 75,
                    hoverBackgroundColor: colors.map(color => color + '80')
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: 2,
                layout: {
                    padding: {
                        top: 20,
                        bottom: 10,
                        left: 10,
                        right: 10
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        events: ['click'],
                        callbacks: {
                            title: function (context) {
                                const idx = context[0].dataIndex;
                                const team = displayTeams[idx];
                                return `Team ${team.team}`;
                            },
                            label: function (context) {
                                const idx = context.dataIndex;
                                const team = displayTeams[idx];
                                const rank = idx + 1;
                                return [
                                    `Rank: ${rank}`,
                                    `EPA: ${Math.round(team.epa)}`  // Changed to Math.round()
                                ];
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        color: 'white',
                        anchor: 'end',
                        align: 'top',
                        offset: 4,
                        font: {
                            family: 'Lato',
                            size: 11,
                            weight: 'bold'
                        },
                        formatter: function (value) {
                            return Math.round(value);
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: 'white',
                            font: {
                                family: 'Lato',
                                size: displayTeams.length > 50 ? 10 : 12,
                                weight: 'bold'
                            },
                            autoSkip: true,
                            maxTicksLimit: displayTeams.length > 50 ? 30 : 40
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'white',
                            font: {
                                family: 'Lato',
                                size: 14,
                                weight: 'bold'
                            },
                            maxTicksLimit: 10,
                            callback: function (value) {
                                return Math.round(value);
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        console.log('EPA chart created successfully');
    } catch (e) {
        console.error('Error creating EPA chart:', e);
    }
}

function renderMobileFuelShotChart(eventCSV) {
    const container = document.getElementById('mobileFuelShotChartWrapper');
    if (!container) {
        console.error('Fuel Shot chart container not found');
        return;
    }

    const existingCanvas = container.querySelector('canvas');
    if (existingCanvas) {
        existingCanvas.remove();
    }

    console.log('Rendering Fuel Shot chart...');

    if (mobileCharts.fuelShotChart) {
        mobileCharts.fuelShotChart.destroy();
        mobileCharts.fuelShotChart = null;
    }

    container.innerHTML = '';

    let eventData = [];
    if (eventCSV) {
        try {
            const parsed = Papa.parse(eventCSV, { header: true, skipEmptyLines: true });
            eventData = parsed.data || [];
        } catch (e) {
            console.error('Error parsing event CSV:', e);
        }
    }

    // Calculate average auto and tele fuel shots per team
    const teamStats = {};

    eventData.forEach(row => {
        const team = row['Team Number']?.toString().trim();
        if (!team) return;

        const autoShot = parseFloat(row['Auto Fuel Shot'] || 0);
        const teleShot = parseFloat(row['Tele Fuel Shot'] || 0);

        if (isNaN(autoShot) || isNaN(teleShot)) return;

        if (!teamStats[team]) {
            teamStats[team] = {
                autoSum: 0,
                teleSum: 0,
                matchCount: 0
            };
        }

        teamStats[team].autoSum += autoShot;
        teamStats[team].teleSum += teleShot;
        teamStats[team].matchCount += 1;
    });

    // Calculate averages and prepare data for chart
    const teams = Object.keys(teamStats).map(team => {
        const stats = teamStats[team];
        const avgAuto = stats.matchCount > 0 ? stats.autoSum / stats.matchCount : 0;
        const avgTele = stats.matchCount > 0 ? stats.teleSum / stats.matchCount : 0;
        return {
            team,
            auto: avgAuto,
            tele: avgTele,
            total: avgAuto + avgTele
        };
    });

    if (teams.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #aaa; padding: 50px; font-size: 16px;">No Fuel Shot data available</div>';
        return;
    }

    // Sort by total fuel shots
    teams.sort((a, b) => b.total - a.total);

    const barWidth = 75;
    const spacing = 20;
    const totalWidth = Math.max(400, teams.length * (barWidth + spacing));

    const scrollWrapper = document.createElement('div');
    scrollWrapper.style.cssText = `
        width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        position: relative;
    `;

    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
        width: ${totalWidth}px;
        height: 280px;
        position: relative;
        min-width: 100%;
    `;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
        width: 100% !important;
        height: 100% !important;
        display: block;
    `;

    canvasContainer.appendChild(canvas);
    scrollWrapper.appendChild(canvasContainer);
    container.appendChild(scrollWrapper);

    const ctx = canvas.getContext('2d');

    // Set colors based on team - updated for searched team
    const autoColors = teams.map(t => {
        if (t.team === '226') return '#7014c5';
        if (t.team === highlightedTeam) return '#FE59D7'; // Auto is FE59D7 for searched team
        return '#000bab';
    });

    const teleColors = teams.map(t => {
        if (t.team === '226') return '#FE59D7';
        if (t.team === highlightedTeam) return '#FFC0CB'; // Tele is FFC0CB for searched team
        return '#3EDBF0';
    });

    try {
        mobileCharts.fuelShotChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: teams.map(t => `${t.team}`),
                datasets: [
                    {
                        label: 'Auto Shot',
                        data: teams.map(t => t.auto),
                        backgroundColor: autoColors,
                        borderWidth: 0,
                        borderRadius: 6,
                        barPercentage: 1,
                        categoryPercentage: 0.9,
                        stack: 'fuel',
                        maxBarThickness: 75
                    },
                    {
                        label: 'Tele Shot',
                        data: teams.map(t => t.tele),
                        backgroundColor: teleColors,
                        borderWidth: 0,
                        borderRadius: 6,
                        barPercentage: 1,
                        categoryPercentage: 0.9,
                        stack: 'fuel',
                        maxBarThickness: 75
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: 2,
                layout: {
                    padding: {
                        top: 20,
                        bottom: 10,
                        left: 10,
                        right: 10
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            title: function () {
                                return '';
                            },
                            label: function (context) {
                                const idx = context.dataIndex;
                                const teamNumber = teams[idx].team;
                                const rank = idx + 1;
                                const total = Math.round(teams[idx].total);  // Changed to Math.round()

                                return [
                                    `Team ${teamNumber}`,
                                    `Rank: ${rank}`,
                                    `Total Fuel Shot: ${total}`
                                ];
                            }
                        },
                        backgroundColor: '#1C1E21',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#000',
                        borderWidth: 1
                    },
                    datalabels: {
                        display: true,
                        color: 'white',
                        anchor: 'end',
                        align: 'top',
                        offset: 4,
                        font: {
                            family: 'Lato',
                            size: 11,
                            weight: 'bold'
                        },
                        formatter: function (value, context) {
                            const datasetIndex = context.datasetIndex;
                            if (datasetIndex === 1) {
                                const dataIndex = context.dataIndex;
                                return Math.round(teams[dataIndex].total);  // Changed to Math.round()
                            }
                            return null;
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: {
                            color: 'white',
                            font: {
                                family: 'Lato',
                                size: teams.length > 50 ? 10 : 12,
                                weight: 'bold'
                            },
                            autoSkip: true,
                            maxTicksLimit: teams.length > 50 ? 30 : 40
                        },
                        grid: { display: false }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            color: 'white',
                            font: {
                                family: 'Lato',
                                size: 14,
                                weight: 'bold'
                            },
                            maxTicksLimit: 10,
                            callback: function (value) {
                                return Math.round(value);
                            }
                        },
                        grid: { display: false }
                    }
                }
            }
        });

        console.log('Fuel Shot chart created successfully');
    } catch (e) {
        console.error('Error creating Fuel Shot chart:', e);
    }
}

function renderMobileFuelFerriedChart(eventCSV) {
    const container = document.getElementById('mobileFuelFerriedChartWrapper');
    if (!container) {
        console.error('Fuel Ferried chart container not found');
        return;
    }

    const existingCanvas = container.querySelector('canvas');
    if (existingCanvas) {
        existingCanvas.remove();
    }

    console.log('Rendering Fuel Ferried chart...');

    if (mobileCharts.fuelFerriedChart) {
        mobileCharts.fuelFerriedChart.destroy();
        mobileCharts.fuelFerriedChart = null;
    }

    container.innerHTML = '';

    let eventData = [];
    if (eventCSV) {
        try {
            const parsed = Papa.parse(eventCSV, { header: true, skipEmptyLines: true });
            eventData = parsed.data || [];
        } catch (e) {
            console.error('Error parsing event CSV:', e);
        }
    }

    // Calculate average auto and tele fuel ferried per team
    const teamStats = {};

    eventData.forEach(row => {
        const team = row['Team Number']?.toString().trim();
        if (!team) return;

        const autoFerried = parseFloat(row['Auto Fuel Ferried'] || 0);
        const teleFerried = parseFloat(row['Tele Fuel Ferried'] || 0);

        if (isNaN(autoFerried) || isNaN(teleFerried)) return;

        if (!teamStats[team]) {
            teamStats[team] = {
                autoSum: 0,
                teleSum: 0,
                matchCount: 0
            };
        }

        teamStats[team].autoSum += autoFerried;
        teamStats[team].teleSum += teleFerried;
        teamStats[team].matchCount += 1;
    });

    // Calculate averages and prepare data for chart
    const teams = Object.keys(teamStats).map(team => {
        const stats = teamStats[team];
        const avgAuto = stats.matchCount > 0 ? stats.autoSum / stats.matchCount : 0;
        const avgTele = stats.matchCount > 0 ? stats.teleSum / stats.matchCount : 0;
        return {
            team,
            auto: avgAuto,
            tele: avgTele,
            total: avgAuto + avgTele
        };
    });

    if (teams.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #aaa; padding: 50px; font-size: 16px;">No Fuel Ferried data available</div>';
        return;
    }

    // Sort by total fuel ferried
    teams.sort((a, b) => b.total - a.total);

    const barWidth = 75;
    const spacing = 20;
    const totalWidth = Math.max(400, teams.length * (barWidth + spacing));

    const scrollWrapper = document.createElement('div');
    scrollWrapper.style.cssText = `
        width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        position: relative;
    `;

    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
        width: ${totalWidth}px;
        height: 280px;
        position: relative;
        min-width: 100%;
    `;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
        width: 100% !important;
        height: 100% !important;
        display: block;
    `;

    canvasContainer.appendChild(canvas);
    scrollWrapper.appendChild(canvasContainer);
    container.appendChild(scrollWrapper);

    const ctx = canvas.getContext('2d');

    // Set colors based on team - updated for searched team
    const autoColors = teams.map(t => {
        if (t.team === '226') return '#7014c5';
        if (t.team === highlightedTeam) return '#FE59D7'; // Auto is FE59D7 for searched team
        return '#000bab';
    });

    const teleColors = teams.map(t => {
        if (t.team === '226') return '#FE59D7';
        if (t.team === highlightedTeam) return '#FFC0CB'; // Tele is FFC0CB for searched team
        return '#3EDBF0';
    });

    try {
        mobileCharts.fuelFerriedChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: teams.map(t => `${t.team}`),
                datasets: [
                    {
                        label: 'Auto Ferried',
                        data: teams.map(t => t.auto),
                        backgroundColor: autoColors,
                        borderWidth: 0,
                        borderRadius: 6,
                        barPercentage: 1,
                        categoryPercentage: 0.9,
                        stack: 'fuel',
                        maxBarThickness: 75
                    },
                    {
                        label: 'Tele Ferried',
                        data: teams.map(t => t.tele),
                        backgroundColor: teleColors,
                        borderWidth: 0,
                        borderRadius: 6,
                        barPercentage: 1,
                        categoryPercentage: 0.9,
                        stack: 'fuel',
                        maxBarThickness: 75
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: 2,
                layout: {
                    padding: {
                        top: 20,
                        bottom: 10,
                        left: 10,
                        right: 10
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            title: function () {
                                return '';
                            },
                            label: function (context) {
                                const idx = context.dataIndex;
                                const teamNumber = teams[idx].team;
                                const rank = idx + 1;
                                const total = Math.round(teams[idx].total);  // Changed to Math.round()

                                return [
                                    `Team ${teamNumber}`,
                                    `Rank: ${rank}`,
                                    `Total Fuel Ferried: ${total}`
                                ];
                            }
                        },
                        backgroundColor: '#1C1E21',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#000',
                        borderWidth: 1
                    },
                    datalabels: {
                        display: true,
                        color: 'white',
                        anchor: 'end',
                        align: 'top',
                        offset: 4,
                        font: {
                            family: 'Lato',
                            size: 11,
                            weight: 'bold'
                        },
                        formatter: function (value, context) {
                            const datasetIndex = context.datasetIndex;
                            if (datasetIndex === 1) {
                                const dataIndex = context.dataIndex;
                                return Math.round(teams[dataIndex].total);  // Changed to Math.round()
                            }
                            return null;
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: {
                            color: 'white',
                            font: {
                                family: 'Lato',
                                size: teams.length > 50 ? 10 : 12,
                                weight: 'bold'
                            },
                            autoSkip: true,
                            maxTicksLimit: teams.length > 50 ? 30 : 40
                        },
                        grid: { display: false }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            color: 'white',
                            font: {
                                family: 'Lato',
                                size: 14,
                                weight: 'bold'
                            },
                            stepSize: 25,
                            callback: function (value) {
                                return Math.round(value);
                            }
                        },
                        grid: { display: false }
                    }
                }
            }
        });

        console.log('Fuel Ferried chart created successfully');
    } catch (e) {
        console.error('Error creating Fuel Ferried chart:', e);
    }
}

function handleMobileOverviewSearch() {
    const input = document.getElementById('overviewSearchMobile');
    const teamNumber = input.value.trim();

    if (!teamNumber) return;

    highlightedTeam = teamNumber;

    const eventCSV = localStorage.getItem('eventScoutingCSV') || '';

    renderMobileEpaChart(eventCSV);
    renderMobileFuelShotChart(eventCSV);
    renderMobileFuelFerriedChart(eventCSV);
}

function clearMobileOverviewSearch() {
    document.getElementById('overviewSearchMobile').value = '';

    highlightedTeam = null;

    const eventCSV = localStorage.getItem('eventScoutingCSV') || '';

    renderMobileEpaChart(eventCSV);
    renderMobileFuelShotChart(eventCSV);
    renderMobileFuelFerriedChart(eventCSV);
}

// Removed renderMobileFuelChart function entirely
/*-----TAB SWITCHING FUNCTIONS-----*/

function switchMobileTab(tabId) {
    document.querySelectorAll('.mobile-tab-content').forEach(tab => {
        tab.classList.remove('active-tab');
    });

    const selectedTab = document.getElementById(tabId + '-tab');
    if (selectedTab) {
        selectedTab.classList.add('active-tab');
    }

    document.querySelectorAll('.menu-items li').forEach(item => {
        item.classList.remove('active-menu-item');
    });

    const menuItems = document.querySelectorAll('.menu-items li');
    menuItems.forEach(item => {
        const itemText = item.textContent.trim().toLowerCase();
        const tabText = tabId === 'csvUpload' ? 'csv upload' : tabId;
        if (itemText.includes(tabText)) {
            item.classList.add('active-menu-item');
        }
    });

    if (typeof window.closeMenu === 'function') {
        window.closeMenu();
    }

    refreshMobileTabData(tabId);
}

function refreshMobileTabData(tabId) {
    switch (tabId) {
        case 'overview':
            loadOverviewData();
            break;
        case 'csvUpload':
            loadSavedFiles();
            break;

    }
}


/*-----MOBILE INDIVIDUAL VIEW FUNCTIONS-----*/

let mobileCurrentTeamData = [];

function handleMobileIndividualSearch() {
    const input = document.getElementById('individualSearchMobile');
    const teamNumber = input.value.trim();

    if (!teamNumber) {
        alert('Please enter a team number');
        return;
    }

    loadMobileIndividualView(teamNumber);
}

function loadMobileIndividualView(teamNumber) {
    const eventCSV = localStorage.getItem('eventScoutingCSV') || '';
    if (!eventCSV) {
        showMobileNoData('No event data available. Please upload CSV first.');
        return;
    }

    try {
        const parsed = Papa.parse(eventCSV, { header: true, skipEmptyLines: true });
        const allData = parsed.data || [];

        mobileCurrentTeamData = allData.filter(row =>
            row['Team Number']?.toString().trim() === teamNumber
        );

        if (mobileCurrentTeamData.length === 0) {
            showMobileNoData(`No data found for team ${teamNumber}`);
            return;
        }

        syncDropdowns = false;
        const autoPathFilter = document.getElementById('mobileAutoPathFilter');
        const autoClimbFilter = document.getElementById('mobileAutoClimbFilter');
        const teleClimbFilter = document.getElementById('mobileTeleClimbFilter');

        if (autoPathFilter) autoPathFilter.value = 'all';
        if (autoClimbFilter) autoClimbFilter.value = 'all';
        if (teleClimbFilter) teleClimbFilter.value = 'all';
        syncDropdowns = true;

        const pitCSV = localStorage.getItem('pitScoutingCSV') || '';
        let pitData = [];
        if (pitCSV) {
            const pitParsed = Papa.parse(pitCSV, { header: true, skipEmptyLines: true });
            pitData = pitParsed.data || [];
        }

        const oprCSV = localStorage.getItem('oprCSV') || localStorage.getItem('oprCsvText') || '';

        renderMobileTeamStats(mobileCurrentTeamData, pitData, oprCSV, teamNumber);
        renderMobileAutoPaths(mobileCurrentTeamData);
        renderMobileAutoClimb(mobileCurrentTeamData);
        renderMobileTeleClimb(mobileCurrentTeamData);
        renderMobileScouterComments(mobileCurrentTeamData);
        renderMobileFlaggedMatches(mobileCurrentTeamData);
        // Add these lines after renderMobileTeleClimb(mobileCurrentTeamData);
        renderMobileTeleFuelShotChart(mobileCurrentTeamData);
        renderMobileTeleFuelFerriedChart(mobileCurrentTeamData);
        renderMobileAutoFuelShotChart(mobileCurrentTeamData);
        renderMobileAutoFuelFerriedChart(mobileCurrentTeamData);
        renderMobileWeightedTeleFuelGraph(mobileCurrentTeamData);  // Add this line


        setupMobileIndividualFilters();

    } catch (e) {
        console.error('Error loading individual view:', e);
        showMobileNoData('Error loading data');
    }
}

function showMobileNoData(message) {
    document.getElementById('mobileAutoPaths').innerHTML = `<p class="no-data-message">${message}</p>`;
    document.getElementById('mobileScouterComments').innerHTML = `<p class="no-data-message">${message}</p>`;
    document.getElementById('mobileFlaggedMatches').innerHTML = `<p class="no-data-message">${message}</p>`;

    document.getElementById('mobileEPA').textContent = '0.00';
    document.getElementById('mobileAvgShot').textContent = '0.00';
    document.getElementById('mobileAvgFerried').textContent = '0.00';
    document.getElementById('mobileShootingAcc').textContent = '0.00';
    document.getElementById('mobileClimbRate').textContent = '0.0%';
    document.getElementById('mobileDiedRate').textContent = '0.0%';
    document.getElementById('mobileTrench').textContent = '❌';
    document.getElementById('mobileGroundIntake').textContent = '❌';
    document.getElementById('mobileShootOnFly').textContent = '❌';
    document.getElementById('mobileWeightedTeleFuelAmount').textContent = '0.00';  // Add this line

    const autoCtx = document.getElementById('mobileAutoClimbChart')?.getContext('2d');
    const teleCtx = document.getElementById('mobileTeleClimbChart')?.getContext('2d');
    const weightedCtx = document.getElementById('mobileWeightedTeleFuelGraph')?.getContext('2d');  // Add this line

    if (autoCtx) autoCtx.clearRect(0, 0, autoCtx.canvas.width, autoCtx.canvas.height);
    if (teleCtx) teleCtx.clearRect(0, 0, teleCtx.canvas.width, teleCtx.canvas.height);
    if (weightedCtx) weightedCtx.clearRect(0, 0, weightedCtx.canvas.width, weightedCtx.canvas.height);  // Add this line
}

function renderMobileTeamStats(teamData, pitData, oprCSV, teamNumber) {
    const pitTeam = pitData.find(row => row['Team Number']?.toString().trim() === teamNumber);

    // Robot stats
    document.getElementById('mobileTrench').textContent = pitTeam && (pitTeam['Trench'] === '1' || pitTeam['Trench'] === 1 || pitTeam['Trench'] === true) ? '✅' : '❌';
    document.getElementById('mobileGroundIntake').textContent = pitTeam && (pitTeam['Ground Intake'] === '1' || pitTeam['Ground Intake'] === 1 || pitTeam['Ground Intake'] === true) ? '✅' : '❌';
    document.getElementById('mobileShootOnFly').textContent = pitTeam && (pitTeam['Shoot on Fly'] === '1' || pitTeam['Shoot on Fly'] === 1 || pitTeam['Shoot on Fly'] === true) ? '✅' : '❌';

    // Calculate Average Shot (combining auto and tele fuel shots)
    const autoFuelShots = teamData.map(row => parseFloat(row['Auto Fuel Shot'] || 0)).filter(v => !isNaN(v));
    const teleFuelShots = teamData.map(row => parseFloat(row['Tele Fuel Shot'] || 0)).filter(v => !isNaN(v));
    const allShots = [...autoFuelShots, ...teleFuelShots];
    const avgShot = allShots.length > 0 ? allShots.reduce((a, b) => a + b, 0) / allShots.length : 0;
    document.getElementById('mobileAvgShot').textContent = avgShot.toFixed(2);

    // Calculate Average Ferried (combining auto and tele fuel ferried)
    const autoFuelFerried = teamData.map(row => parseFloat(row['Auto Fuel Ferried'] || 0)).filter(v => !isNaN(v));
    const teleFuelFerried = teamData.map(row => parseFloat(row['Tele Fuel Ferried'] || 0)).filter(v => !isNaN(v));
    const allFerried = [...autoFuelFerried, ...teleFuelFerried];
    const avgFerried = allFerried.length > 0 ? allFerried.reduce((a, b) => a + b, 0) / allFerried.length : 0;
    document.getElementById('mobileAvgFerried').textContent = avgFerried.toFixed(2);

    // Calculate EPA (average of total points only - no OPR)
    const totalPoints = teamData.map(row => parseFloat(row['Total Points'] || row['Total Score'] || 0)).filter(v => !isNaN(v));
    const epa = totalPoints.length > 0 ? totalPoints.reduce((a, b) => a + b, 0) / totalPoints.length : 0;
    document.getElementById('mobileEPA').textContent = epa.toFixed(2);

    // Calculate Shooting Accuracy
    const accuracyVals = teamData
        .map(row => parseFloat(row['Shooting Accuracy']))
        .filter(v => !isNaN(v));
    const shootingAcc = accuracyVals.length > 0
        ? (accuracyVals.reduce((a, b) => a + b, 0) / accuracyVals.length).toFixed(2)
        : '0.00';
    document.getElementById('mobileShootingAcc').textContent = shootingAcc;

    // Calculate Climb Success %
    const climbValues = teamData.map(row => row['Climb Teleop']?.toString().trim()).filter(v => v && v !== '');
    const successfulClimbs = climbValues.filter(v => ['1', '2', '3'].includes(v)).length;
    const totalClimbAttempts = climbValues.filter(v => ['1', '2', '3', 'F'].includes(v)).length;
    const climbRate = totalClimbAttempts > 0 ? ((successfulClimbs / totalClimbAttempts) * 100).toFixed(1) : "0.0";
    document.getElementById('mobileClimbRate').textContent = climbRate + '%';

    // Calculate Robot Died %
    const diedCount = teamData.filter(row => {
        const val = parseFloat(row['Robot Died'] || row['Died or Immobilized'] || 0);
        return val === 0.5 || val === 1;
    }).length;
    const diedRate = teamData.length ? ((diedCount / teamData.length) * 100).toFixed(1) : '0.0';
    document.getElementById('mobileDiedRate').textContent = diedRate + '%';
}

function renderMobileTeleFuelShotChart(teamData) {
    const canvas = document.getElementById('mobileTeleFuelShotChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart if it exists
    if (mobileCharts.teleFuelShot) {
        mobileCharts.teleFuelShot.destroy();
        mobileCharts.teleFuelShot = null;
    }

    // Set the container height to window.innerHeight - 90px
    const container = canvas.closest('.chart-container-mobile') || canvas.parentElement;
    if (container) {
        const chartHeight = window.innerHeight - 90;
        container.style.height = `${chartHeight}px`;
        container.style.minHeight = `${chartHeight}px`;
        container.style.maxHeight = `${chartHeight}px`;
    }

    if (!teamData || teamData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No tele fuel shot data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const sortedData = [...teamData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const fuelShotValues = [];
    const barColors = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const teleFuelShot = parseFloat(row['Tele Fuel Shot'] || 0);
        if (isNaN(teleFuelShot)) return;

        matches.push(`Q${matchNum}`);
        fuelShotValues.push(teleFuelShot);
        barColors.push('#3EDBF0');
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No tele fuel shot data', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Find max value for y-axis
    const maxValue = Math.max(...fuelShotValues);
    const yAxisMax = Math.ceil(maxValue / 3) * 3 || 27;

    mobileCharts.teleFuelShot = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matches,
            datasets: [{
                data: fuelShotValues,
                backgroundColor: barColors,
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.8,
                categoryPercentage: 0.9
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: (context) => context[0]?.label || '',
                        label: (context) => {
                            return [`Fuel Shots: ${context.raw}`];
                        }
                    }
                },
                datalabels: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white',
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Lato'
                        },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: true
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: yAxisMax,
                    ticks: {
                        color: 'white',
                        maxTicksLimit: 5,
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Lato'
                        },
                        callback: (value) => Math.round(value)
                    },
                    grid: { display: false }
                }
            },
            layout: {
                padding: {
                    bottom: 30,
                    left: 10,
                    right: 10
                }
            }
        }
    });
}
function renderMobileAutoFuelShotChart(teamData) {
    const canvas = document.getElementById('mobileAutoFuelShotChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart if it exists
    if (mobileCharts.autoFuelShot) {
        mobileCharts.autoFuelShot.destroy();
        mobileCharts.autoFuelShot = null;
    }

    // Set the container height to window.innerHeight - 90px
    const container = canvas.closest('.chart-container-mobile') || canvas.parentElement;
    if (container) {
        const chartHeight = window.innerHeight - 90;
        container.style.height = `${chartHeight}px`;
        container.style.minHeight = `${chartHeight}px`;
        container.style.maxHeight = `${chartHeight}px`;
    }

    // Get the current filter value (all dropdowns are synced, so any will work)
    const filter = document.getElementById('mobileAutoFuelShotFilter')?.value || 'all';

    let filteredData = teamData;
    if (filter !== 'all') {
        filteredData = teamData.filter(row => row['Starting Position']?.toString().trim() === filter);
    }

    if (!filteredData || filteredData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No auto fuel shot data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const sortedData = [...filteredData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const fuelShotValues = [];
    const barColors = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const autoFuelShot = parseFloat(row['Auto Fuel Shot'] || 0);
        if (isNaN(autoFuelShot)) return;

        matches.push(`Q${matchNum}`);
        fuelShotValues.push(autoFuelShot);
        barColors.push('#3EDBF0');
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No auto fuel shot data', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Find max value for y-axis
    const maxValue = Math.max(...fuelShotValues);
    const yAxisMax = Math.ceil(maxValue / 3) * 3 || 27;

    mobileCharts.autoFuelShot = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matches,
            datasets: [{
                data: fuelShotValues,
                backgroundColor: barColors,
                borderWidth: 0,
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.8,
                categoryPercentage: 0.9
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: (context) => context[0]?.label || '',
                        label: (context) => {
                            return [`Fuel Shots: ${context.raw}`];
                        }
                    }
                },
                datalabels: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white',
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Lato'
                        },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: true
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: yAxisMax,
                    ticks: {
                        color: 'white',
                        maxTicksLimit: 5,
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Lato'
                        },
                        callback: (value) => Math.round(value)
                    },
                    grid: { display: false }
                }
            },
            layout: {
                padding: {
                    bottom: 30,
                    left: 10,
                    right: 10
                }
            }
        }
    });
}

function renderMobileAutoFuelFerriedChart(teamData) {
    const canvas = document.getElementById('mobileAutoFuelFerriedChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart if it exists
    if (mobileCharts.autoFuelFerried) {
        mobileCharts.autoFuelFerried.destroy();
        mobileCharts.autoFuelFerried = null;
    }

    // Set the container height to window.innerHeight - 90px
    const container = canvas.closest('.chart-container-mobile') || canvas.parentElement;
    if (container) {
        const chartHeight = window.innerHeight - 90;
        container.style.height = `${chartHeight}px`;
        container.style.minHeight = `${chartHeight}px`;
        container.style.maxHeight = `${chartHeight}px`;
    }

    // Get the current filter value (all dropdowns are synced, so any will work)
    const filter = document.getElementById('mobileAutoFuelFerriedFilter')?.value || 'all';

    let filteredData = teamData;
    if (filter !== 'all') {
        filteredData = teamData.filter(row => row['Starting Position']?.toString().trim() === filter);
    }

    if (!filteredData || filteredData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No auto fuel ferried data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const sortedData = [...filteredData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const fuelFerriedValues = [];
    const barColors = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const autoFuelFerried = parseFloat(row['Auto Fuel Ferried'] || 0);
        if (isNaN(autoFuelFerried)) return;

        matches.push(`Q${matchNum}`);
        fuelFerriedValues.push(autoFuelFerried);
        barColors.push('rgb(0, 184, 148)');
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No auto fuel ferried data', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Find max value for y-axis
    const maxValue = Math.max(...fuelFerriedValues);
    const yAxisMax = Math.ceil(maxValue / 3) * 3 || 27;

    mobileCharts.autoFuelFerried = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matches,
            datasets: [{
                data: fuelFerriedValues,
                backgroundColor: barColors,
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.8,
                categoryPercentage: 0.9
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: (context) => context[0]?.label || '',
                        label: (context) => {
                            return [`Fuel Ferried: ${context.raw}`];
                        }
                    }
                },
                datalabels: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white',
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Lato'
                        },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: true
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: yAxisMax,
                    ticks: {
                        color: 'white',
                        maxTicksLimit: 5,
                                                font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Lato'
                        },
                        callback: (value) => Math.round(value)
                    },
                    grid: { display: false }
                }
            },
            layout: {
                padding: {
                    bottom: 30,
                    left: 10,
                    right: 10
                }
            }
        }
    });
}
// Add filter sync function
function syncAutoFuelDropdowns(sourceFilter, selectedValue) {
    if (!syncDropdowns) return;

    const autoFuelShotFilter = document.getElementById('mobileAutoFuelShotFilter');
    const autoFuelFerriedFilter = document.getElementById('mobileAutoFuelFerriedFilter');

    if (sourceFilter !== 'autoFuelShot' && autoFuelShotFilter && autoFuelShotFilter.value !== selectedValue) {
        autoFuelShotFilter.value = selectedValue;
    }

    if (sourceFilter !== 'autoFuelFerried' && autoFuelFerriedFilter && autoFuelFerriedFilter.value !== selectedValue) {
        autoFuelFerriedFilter.value = selectedValue;
    }
}



function renderMobileTeleFuelFerriedChart(teamData) {
    const canvas = document.getElementById('mobileTeleFuelFerriedChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart if it exists
    if (mobileCharts.teleFuelFerried) {
        mobileCharts.teleFuelFerried.destroy();
        mobileCharts.teleFuelFerried = null;
    }

    // Set the container height to window.innerHeight - 90px
    const container = canvas.closest('.chart-container-mobile') || canvas.parentElement;
    if (container) {
        const chartHeight = window.innerHeight - 90;
        container.style.height = `${chartHeight}px`;
        container.style.minHeight = `${chartHeight}px`;
        container.style.maxHeight = `${chartHeight}px`;
    }

    if (!teamData || teamData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No tele fuel ferried data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const sortedData = [...teamData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const fuelFerriedValues = [];
    const barColors = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const teleFuelFerried = parseFloat(row['Tele Fuel Ferried'] || 0);
        if (isNaN(teleFuelFerried)) return;

        matches.push(`Q${matchNum}`);
        fuelFerriedValues.push(teleFuelFerried);
        barColors.push('rgb(0, 184, 148)');
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No tele fuel ferried data', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Find max value for y-axis
    const maxValue = Math.max(...fuelFerriedValues);
    const yAxisMax = Math.ceil(maxValue / 3) * 3 || 27;

    mobileCharts.teleFuelFerried = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matches,
            datasets: [{
                data: fuelFerriedValues,
                backgroundColor: barColors,
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.8,
                categoryPercentage: 0.9
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: (context) => context[0]?.label || '',
                        label: (context) => {
                            return [`Fuel Ferried: ${context.raw}`];
                        }
                    }
                },
                datalabels: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white',
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Lato'
                        },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: true
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: yAxisMax,
                    ticks: {
                        color: 'white',
                        maxTicksLimit: 5,
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Lato'
                        },
                        callback: (value) => Math.round(value)
                    },
                    grid: { display: false }
                }
            },
            layout: {
                padding: {
                    bottom: 30,
                    left: 10,
                    right: 10
                }
            }
        }
    });
}

function getCurrentAutoFilter() {
    const autoClimbFilter = document.getElementById('mobileAutoClimbFilter');
    if (autoClimbFilter) {
        return autoClimbFilter.value;
    }

    const autoPathFilter = document.getElementById('mobileAutoPathFilter');
    if (autoPathFilter) {
        return autoPathFilter.value;
    }

    return 'all';
}

function getCurrentStartingPositionFilter() {
    const autoClimbFilter = document.getElementById('mobileAutoClimbFilter');
    if (autoClimbFilter) {
        return autoClimbFilter.value;
    }

    const autoPathFilter = document.getElementById('mobileAutoPathFilter');
    if (autoPathFilter) {
        return autoPathFilter.value;
    }

    const teleClimbFilter = document.getElementById('mobileTeleClimbFilter');
    if (teleClimbFilter) {
        return teleClimbFilter.value;
    }

    return 'all';
}

function getCurrentTeleFilter() {
    const teleClimbFilter = document.getElementById('mobileTeleClimbFilter');
    if (teleClimbFilter) {
        return teleClimbFilter.value;
    }
    return 'all';
}

function renderMobileAutoPaths(teamData) {
    const container = document.getElementById('mobileAutoPaths');
    if (!container) return;

    const filter = getCurrentAutoFilter();

    let filteredData = teamData;
    if (filter !== 'all') {
        filteredData = teamData.filter(row => row['Starting Position']?.toString().trim() === filter);
    }

    if (filteredData.length === 0) {
        container.innerHTML = '<p class="no-data-message" style="color: #aaa; text-align: center; padding: 20px;">No auto path data available</p>';
        return;
    }

    const sortedData = [...filteredData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    let html = '';
    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const travelString = row['Travel String']?.toString().trim() || '';
        const fuelString = row['Fuel Collection String']?.toString().trim() || '';

        const hasTravel = travelString && travelString !== '' && travelString !== '-';
        const hasFuel = fuelString && fuelString !== '' && fuelString !== '-';

        if (!hasTravel && !hasFuel) {
            html += `<div class="path-entry" style="padding: 8px 0; border-bottom: 1px solid #333;">
                       <span class="match-number" style="color: white; font-weight: bold; margin-right: 8px;">Q${matchNum}:</span> 
                       <span style="color: white;">N/A</span>
                   </div>`;
            return;
        }

        let sentence = '';
        if (travelString && fuelString) {
            sentence = travelString + ' and ' + fuelString;
        } else if (travelString) {
            sentence = travelString;
        } else if (fuelString) {
            sentence = fuelString;
        }

        if (sentence) {
            sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
            if (!sentence.endsWith('.')) sentence += '.';
            html += `<div class="path-entry" style="padding: 8px 0; border-bottom: 1px solid #333;">
                       <span class="match-number" style="color: white; font-weight: bold; margin-right: 8px;">Q${matchNum}:</span> 
                       <span style="color: white;">${escapeHtml(sentence)}</span>
                   </div>`;
        }
    });

    container.innerHTML = html || '<p class="no-data-message" style="color: #aaa; text-align: center; padding: 20px;">No auto path data available</p>';
}

function renderMobileAutoClimb(teamData) {
    const canvas = document.getElementById('mobileAutoClimbChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (mobileCharts.autoClimb) {
        mobileCharts.autoClimb.destroy();
        mobileCharts.autoClimb = null;
    }

    const filter = getCurrentAutoFilter();

    let filteredData = teamData;
    if (filter !== 'all') {
        filteredData = teamData.filter(row => row['Starting Position']?.toString().trim() === filter);
    }

    if (filteredData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No auto climb data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const sortedData = [...filteredData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const climbValues = [];
    const barColors = [];
    const tooltipLabels = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const climbAuto = row['Climb Auto']?.toString().trim();
        if (!climbAuto || climbAuto === '') return;

        matches.push(`Q${matchNum}`);

        if (climbAuto === '1') {
            climbValues.push(1);
            barColors.push('#3EDBF0');
            tooltipLabels.push('Level 1');
        } else if (climbAuto === 'F') {
            climbValues.push(0.5);
            barColors.push('#ff5c5c');
            tooltipLabels.push('Failed');
        } else {
            climbValues.push(0);
            barColors.push('#3EDBF0');
            tooltipLabels.push('Not Attempted');
        }
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No auto climb data', canvas.width / 2, canvas.height / 2);
        return;
    }

// Get the viewport height and calculate target height (100vh - 50px)
const viewportHeight = window.innerHeight;
const calculatedHeight = viewportHeight - 50;

const container = canvas.closest('.chart-container-mobile') || canvas.parentElement;
if (container) {
    container.style.height = `${calculatedHeight}px`;
    container.style.maxHeight = `${calculatedHeight}px`; // Set maxHeight to same value
}

canvas.height = calculatedHeight - 40;

    mobileCharts.autoClimb = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matches,
            datasets: [{
                data: climbValues,
                backgroundColor: barColors,
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.8,
                categoryPercentage: 0.9
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    events: ['click'],
                    callbacks: {
                        title: function (context) {
                            if (context.length > 0) {
                                const idx = context[0].dataIndex;
                                return `${matches[idx]}`;
                            }
                            return '';
                        },
                        label: function (context) {
                            const idx = context.dataIndex;
                            return [`Climb: ${tooltipLabels[idx]}`];
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white',
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Lato'
                        },
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        color: 'white',
                        stepSize: 0.5,
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Lato'
                        },
                        callback: (value) => value === 1 ? '1' : value === 0 ? '0' : ''
                    },
                    grid: { display: false }
                }
            },
            layout: {
                padding: {
                    bottom: 30
                }
            }
        }
    });
}

function renderMobileWeightedTeleFuelGraph(teamData) {
    const canvas = document.getElementById('mobileWeightedTeleFuelGraph');
    if (!canvas) {
        console.warn('mobileWeightedTeleFuelGraph canvas not found');
        return;
    }

    const ctx = canvas.getContext('2d');

    if (mobileCharts.weightedTeleFuel) {
        mobileCharts.weightedTeleFuel.destroy();
        mobileCharts.weightedTeleFuel = null;
    }

    if (!teamData || teamData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No tele fuel data', canvas.width / 2, canvas.height / 2);
        document.getElementById('mobileWeightedTeleFuelAmount').textContent = '0.00';
        return;
    }

    // Sort data by match number
    const sortedData = [...teamData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const teleFuelValues = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const teleFuel = parseFloat(row['Tele Fuel Shot'] || 0);
        if (isNaN(teleFuel)) return;

        matches.push(`Q${matchNum}`);
        teleFuelValues.push(teleFuel);
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No tele fuel data', canvas.width / 2, canvas.height / 2);
        document.getElementById('mobileWeightedTeleFuelAmount').textContent = '0.00';
        return;
    }

    // Calculate weighted tele fuel
    const weightedTeleFuel = (() => {
        const teleFuelWithMatches = sortedData.map(row => {
            const matchNum = parseInt(row['Match'] || row['Match Number'] || 0);
            const teleFuel = parseFloat(row['Tele Fuel Shot'] || 0);
            return { match: matchNum, value: teleFuel };
        }).filter(item => !isNaN(item.value) && item.match > 0);

        if (teleFuelWithMatches.length === 0) return 0;

        let totalWeightedValue = 0;
        let totalWeight = 0;

        teleFuelWithMatches.forEach(item => {
            let weight;
            if (item.match <= 2) {
                weight = 0.5;
            } else if (item.match <= 6) {
                weight = 1.0;
            } else if (item.match <= 8) {
                weight = 1.5;
            } else {
                weight = 2.0;
            }

            totalWeightedValue += item.value * weight;
            totalWeight += weight;
        });

        return totalWeight > 0 ? totalWeightedValue / totalWeight : 0;
    })();

    // Update the weighted tele fuel display
    const weightedTeleFuelDisplay = document.getElementById('mobileWeightedTeleFuelAmount');
    if (weightedTeleFuelDisplay) {
        weightedTeleFuelDisplay.textContent = weightedTeleFuel.toFixed(2);
    }

    // Calculate min width based on number of matches
    const matchesCount = matches.length;
    const pointWidth = 80; // Width per data point
    const minWidth = Math.max(300, matchesCount * pointWidth);

    // Create scrollable container
    const parent = canvas.parentNode;
    const containerId = 'mobileWeightedTeleFuelContainer';
    let container = document.getElementById(containerId);

    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = `
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            position: relative;
            padding-bottom: 10px;
        `;

        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = `
            width: ${minWidth}px;
            height: 250px;
            position: relative;
        `;

        parent.innerHTML = '';
        canvasContainer.appendChild(canvas);
        container.appendChild(canvasContainer);
        parent.appendChild(container);
    } else {
        const canvasContainer = container.firstChild;
        if (canvasContainer) {
            canvasContainer.style.width = `${minWidth}px`;
        }
    }

    // Create datasets
    const datasets = [
        {
            label: 'Tele Fuel Scored',
            data: teleFuelValues,
            borderColor: '#3EDBF0',
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0,
            pointBackgroundColor: '#3EDBF0',
            pointBorderColor: '#fff',
            pointBorderWidth: 1,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: false
        }
    ];

    // Add weighted average line if there's data
    if (weightedTeleFuel > 0) {
        const weightedLineData = Array(matches.length).fill(weightedTeleFuel);
        datasets.push({
            label: 'Weighted Tele Fuel',
            data: weightedLineData,
            borderColor: '#FFD700',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 3],
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false
        });
    }

    mobileCharts.weightedTeleFuel = new Chart(ctx, {
        type: 'line',
        data: {
            labels: matches,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1C1E21',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#000',
                    borderWidth: 1,
                    padding: 8,
                    titleFont: {
                        size: 14,
                        weight: 'bold',
                        family: 'Lato'
                    },
                    bodyFont: {
                        size: 14,
                        family: 'Lato'
                    },
                    callbacks: {
                        label: function (context) {
                            if (context.datasetIndex === 0) {
                                return `Tele Fuel: ${context.raw}`;
                            } else {
                                return `Weighted Avg: ${context.raw.toFixed(2)}`;
                            }
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            },
            scales: {
                x: {
                    position: 'bottom',
                    grid: {
                        display: false,
                        drawBorder: false,
                        drawOnChartArea: false,
                        drawTicks: false
                    },
                    ticks: {
                        color: 'white',
                        font: {
                            family: 'Lato',
                            size: 14,
                            weight: 'bold'
                        },
                        maxRotation: 45,
                        minRotation: 30,
                        autoSkip: true,
                        maxTicksLimit: 12,
                        padding: 8
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        display: false,
                        drawBorder: false,
                        drawOnChartArea: false,
                        drawTicks: false
                    },
                    ticks: {
                        color: 'white',
                        maxTicksLimit: 5,
                        font: {
                            family: 'Lato',
                            size: 14,
                            weight: 'bold'
                        },
                        stepSize: 5,
                        callback: function (value) {
                            return Math.round(value);
                        },
                        padding: 8
                    }
                }
            },
            layout: {
                padding: {
                    bottom: 40,
                    top: 20,
                    left: 10,
                    right: 10
                }
            }
        }
    });
}

function renderMobileTeleClimb(teamData) {
    const canvas = document.getElementById('mobileTeleClimbChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (mobileCharts.teleClimb) {
        mobileCharts.teleClimb.destroy();
        mobileCharts.teleClimb = null;
    }

    const filter = getCurrentTeleFilter();

    let filteredData = teamData;
    if (filter !== 'all') {
        filteredData = teamData.filter(row => row['Starting Position']?.toString().trim() === filter);
    }

    if (filteredData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No tele climb data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const sortedData = [...filteredData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const climbValues = [];
    const barColors = [];
    const tooltipData = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const climbTeleop = row['Climb Teleop']?.toString().trim();
        if (!climbTeleop || climbTeleop === '') return;

        matches.push(`Q${matchNum}`);

        const climbTime = parseFloat(row['Climb Time'] || row['Climb Time per Level'] || 0);
        const formattedClimbTime = !isNaN(climbTime) && climbTime > 0 ? climbTime.toFixed(1) + 's' : 'N/A';

        if (climbTeleop === '3') {
            climbValues.push(3);
            barColors.push('#3EDBF0');
            tooltipData.push({
                level: 'Level 3',
                time: formattedClimbTime,
                match: matchNum
            });
        } else if (climbTeleop === '2') {
            climbValues.push(2);
            barColors.push('#3EDBF0');
            tooltipData.push({
                level: 'Level 2',
                time: formattedClimbTime,
                match: matchNum
            });
        } else if (climbTeleop === '1') {
            climbValues.push(1);
            barColors.push('#3EDBF0');
            tooltipData.push({
                level: 'Level 1',
                time: formattedClimbTime,
                match: matchNum
            });
        } else if (climbTeleop === 'F') {
            climbValues.push(0.5);
            barColors.push('#ff5c5c');
            tooltipData.push({
                level: 'Failed',
                time: 'N/A',
                match: matchNum
            });
        } else {
            climbValues.push(0);
            barColors.push('#3EDBF0');
            tooltipData.push({
                level: 'Not Attempted',
                time: 'N/A',
                match: matchNum
            });
        }
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No tele climb data', canvas.width / 2, canvas.height / 2);
        return;
    }

// Get the viewport height and calculate target height (100vh - 50px)
const viewportHeight = window.innerHeight;
const calculatedHeight = viewportHeight - 50;

const container = canvas.closest('.chart-container-mobile') || canvas.parentElement;
if (container) {
    container.style.height = `${calculatedHeight}px`;
    container.style.maxHeight = `${calculatedHeight}px`; // Set maxHeight to same value
}

canvas.height = calculatedHeight - 40;

    mobileCharts.teleClimb = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matches,
            datasets: [{
                data: climbValues,
                backgroundColor: barColors,
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.8,
                categoryPercentage: 0.9
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    events: ['click'],
                    callbacks: {
                        title: function (context) {
                            if (context.length > 0) {
                                const idx = context[0].dataIndex;
                                return `${matches[idx]}`;
                            }
                            return '';
                        },
                        label: function (context) {
                            const idx = context.dataIndex;
                            if (tooltipData[idx]) {
                                const data = tooltipData[idx];
                                return [`Level: ${data.level}`, `Time: ${data.time}`];
                            }
                            return '';
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white',
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Lato'
                        },
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: 3,
                    ticks: {
                        color: 'white',
                        stepSize: 1,
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Lato'
                        },
                        callback: (value) => value === 1 ? '1' : value === 2 ? '2' : value === 3 ? '3' : ''
                    },
                    grid: { display: false }
                }
            },
            layout: {
                padding: {
                    bottom: 30
                }
            }
        }
    });
}

function renderMobileScouterComments(teamData) {
    const container = document.getElementById('mobileScouterComments');
    if (!container) return;

    const sortedData = [...teamData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    let html = '';
    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        const comment = (row['Comments'] || '').toString().trim();

        if (comment && comment !== '' && comment !== 'N/A' && comment !== 'NA' && comment !== 'none') {
            html += `<div class="comment-entry" style="padding: 8px 0; border-bottom: 1px solid #333;">
                 <span class="match-number" style="color: white; font-weight: bold; margin-right: 8px;">Q${matchNum}:</span> 
                 <span style="color: white;">${escapeHtml(comment)}</span>
               </div>`;
        }
    });

    container.innerHTML = html || '<p class="no-data-message" style="color: #aaa; text-align: center; padding: 20px;">No scouter comments available</p>';
}

function renderMobileFlaggedMatches(teamData) {
    const container = document.getElementById('mobileFlaggedMatches');
    if (!container) return;

    const sortedData = [...teamData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    let html = '';
    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const startingPosition = row['Starting Position']?.toString().trim();
        if (startingPosition === 'R') {
            html += `<div class="flagged-entry" style="padding: 8px 0; border-bottom: 1px solid #333;">
                 <span class="match-number" style="color: white; font-weight: bold; margin-right: 8px;">Q${matchNum}:</span> 
                 <span class="flagged-badge" style="color: #ff5c5c; font-weight: bold; text-transform: uppercase;">ROBOT MISSING</span>
               </div>`;
            return;
        }

        const reasons = [];
        const robotDied = parseFloat(row['Robot Died'] || row['Died or Immobilized'] || 0);
        if (robotDied > 0) reasons.push('Robot Died');

        const robotDefense = parseFloat(row['Robot Defense'] || row['Defense Rating'] || 0);
        if (robotDefense > 0) reasons.push('Played Defense');

        const defenseOnRobot = parseFloat(row['Defense On Robot'] || 0);
        if (defenseOnRobot > 0) reasons.push('Defended On');

        if (reasons.length > 0) {
            html += `<div class="flagged-entry" style="padding: 8px 0; border-bottom: 1px solid #333;">
                 <span class="match-number" style="color: white; font-weight: bold; margin-right: 8px;">Q${matchNum}:</span> 
                 <span class="flagged-reasons" style="color: white;">${reasons.join(', ')}</span>
               </div>`;
        }
    });

    container.innerHTML = html || '<p class="no-data-message" style="color: #aaa; text-align: center; padding: 20px;">No flagged matches</p>';
}

let syncDropdowns = true;

function syncAutoDropdowns(sourceFilter, selectedValue) {
    if (!syncDropdowns) return;

    const autoPathFilter = document.getElementById('mobileAutoPathFilter');
    const autoClimbFilter = document.getElementById('mobileAutoClimbFilter');
    const autoFuelShotFilter = document.getElementById('mobileAutoFuelShotFilter');
    const autoFuelFerriedFilter = document.getElementById('mobileAutoFuelFerriedFilter');

    // Update all dropdowns to the selected value
    if (autoPathFilter && autoPathFilter.value !== selectedValue) {
        autoPathFilter.value = selectedValue;
    }

    if (autoClimbFilter && autoClimbFilter.value !== selectedValue) {
        autoClimbFilter.value = selectedValue;
    }

    if (autoFuelShotFilter && autoFuelShotFilter.value !== selectedValue) {
        autoFuelShotFilter.value = selectedValue;
    }

    if (autoFuelFerriedFilter && autoFuelFerriedFilter.value !== selectedValue) {
        autoFuelFerriedFilter.value = selectedValue;
    }

    // Refresh all auto-related displays with the new filter
    if (mobileCurrentTeamData.length > 0) {
        renderMobileAutoPaths(mobileCurrentTeamData);
        renderMobileAutoClimb(mobileCurrentTeamData);
        renderMobileAutoFuelShotChart(mobileCurrentTeamData);
        renderMobileAutoFuelFerriedChart(mobileCurrentTeamData);
    }
}

function syncStartingPositionDropdowns(sourceFilter, selectedValue) {
    if (!syncDropdowns) return;

    const autoPathFilter = document.getElementById('mobileAutoPathFilter');
    const autoClimbFilter = document.getElementById('mobileAutoClimbFilter');
    const teleClimbFilter = document.getElementById('mobileTeleClimbFilter');

    if (sourceFilter !== 'autoPath' && autoPathFilter && autoPathFilter.value !== selectedValue) {
        autoPathFilter.value = selectedValue;
    }
    if (sourceFilter !== 'autoClimb' && autoClimbFilter && autoClimbFilter.value !== selectedValue) {
        autoClimbFilter.value = selectedValue;
    }
    if (sourceFilter !== 'teleClimb' && teleClimbFilter && teleClimbFilter.value !== selectedValue) {
        teleClimbFilter.value = selectedValue;
    }
}

function handleMobileAutoPathFilter() {
    const filter = document.getElementById('mobileAutoPathFilter');
    if (!filter) return;

    const selectedValue = filter.value;
    syncAutoDropdowns('autoPath', selectedValue);
}

function handleMobileAutoClimbFilter() {
    const filter = document.getElementById('mobileAutoClimbFilter');
    if (!filter) return;

    const selectedValue = filter.value;
    syncAutoDropdowns('autoClimb', selectedValue);
}

function handleMobileAutoFuelShotFilter() {
    const filter = document.getElementById('mobileAutoFuelShotFilter');
    if (!filter) return;

    const selectedValue = filter.value;
    syncAutoDropdowns('autoFuelShot', selectedValue);
}

function handleMobileAutoFuelFerriedFilter() {
    const filter = document.getElementById('mobileAutoFuelFerriedFilter');
    if (!filter) return;

    const selectedValue = filter.value;
    syncAutoDropdowns('autoFuelFerried', selectedValue);
}
function handleMobileTeleClimbFilter() {
    const filter = document.getElementById('mobileTeleClimbFilter');
    if (!filter) return;

    if (mobileCurrentTeamData.length > 0) {
        renderMobileTeleClimb(mobileCurrentTeamData);
    }
}
function setupMobileIndividualFilters() {
    const autoPathFilter = document.getElementById('mobileAutoPathFilter');
    const autoClimbFilter = document.getElementById('mobileAutoClimbFilter');
    const autoFuelShotFilter = document.getElementById('mobileAutoFuelShotFilter');
    const autoFuelFerriedFilter = document.getElementById('mobileAutoFuelFerriedFilter');
    const teleClimbFilter = document.getElementById('mobileTeleClimbFilter');

    if (autoPathFilter) {
        autoPathFilter.removeEventListener('change', handleMobileAutoPathFilter);
        autoPathFilter.addEventListener('change', handleMobileAutoPathFilter);
    }

    if (autoClimbFilter) {
        autoClimbFilter.removeEventListener('change', handleMobileAutoClimbFilter);
        autoClimbFilter.addEventListener('change', handleMobileAutoClimbFilter);
    }

    if (autoFuelShotFilter) {
        autoFuelShotFilter.removeEventListener('change', handleMobileAutoFuelShotFilter);
        autoFuelShotFilter.addEventListener('change', handleMobileAutoFuelShotFilter);
    }

    if (autoFuelFerriedFilter) {
        autoFuelFerriedFilter.removeEventListener('change', handleMobileAutoFuelFerriedFilter);
        autoFuelFerriedFilter.addEventListener('change', handleMobileAutoFuelFerriedFilter);
    }

    if (teleClimbFilter) {
        teleClimbFilter.removeEventListener('change', handleMobileTeleClimbFilter);
        teleClimbFilter.addEventListener('change', handleMobileTeleClimbFilter);
    }
}



function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/*-----MOBILE MATCH PREDICTOR FUNCTIONS-----*/

let mobileScheduleData = [];
let mobileOprData = {};
let mobileEventData = [];

function handleMobileMatchPrediction() {
    console.log('Match prediction triggered');
    const matchNumber = document.getElementById('matchNumberMobile').value.trim();

    const red1 = document.getElementById('predictionRed1').value.trim();
    const red2 = document.getElementById('predictionRed2').value.trim();
    const red3 = document.getElementById('predictionRed3').value.trim();
    const blue1 = document.getElementById('predictionBlue1').value.trim();
    const blue2 = document.getElementById('predictionBlue2').value.trim();
    const blue3 = document.getElementById('predictionBlue3').value.trim();

    const hasManualTeams = red1 || red2 || red3 || blue1 || blue2 || blue3;

    if (matchNumber) {
        const scheduleText = localStorage.getItem('matchScheduleCSV');

        if (scheduleText) {
            try {
                const parsed = Papa.parse(scheduleText, { header: true, skipEmptyLines: true });
                mobileScheduleData = parsed.data || [];

                const match = mobileScheduleData.find(row =>
                    row['Match Number']?.toString().trim() === matchNumber
                );

                if (match) {
                    document.getElementById('predictionRed1').value = match['Red 1']?.toString().trim() || '';
                    document.getElementById('predictionRed2').value = match['Red 2']?.toString().trim() || '';
                    document.getElementById('predictionRed3').value = match['Red 3']?.toString().trim() || '';
                    document.getElementById('predictionBlue1').value = match['Blue 1']?.toString().trim() || '';
                    document.getElementById('predictionBlue2').value = match['Blue 2']?.toString().trim() || '';
                    document.getElementById('predictionBlue3').value = match['Blue 3']?.toString().trim() || '';

                    const redTeams = [match['Red 1'], match['Red 2'], match['Red 3']].filter(t => t && t !== '');
                    const blueTeams = [match['Blue 1'], match['Blue 2'], match['Blue 3']].filter(t => t && t !== '');
                    const allTeams = [...redTeams, ...blueTeams];

                    loadMobileOPRData();
                    loadMobileEventData();
                    calculateMobileMatchPrediction(redTeams, blueTeams);
                    renderMobileMatchSummary(allTeams);
                    return;
                }
            } catch (err) {
                console.error('Error processing match schedule:', err);
            }
        }
    }

    if (hasManualTeams) {
        const redTeams = [red1, red2, red3].filter(t => t && t !== '');
        const blueTeams = [blue1, blue2, blue3].filter(t => t && t !== '');
        const allTeams = [...redTeams, ...blueTeams];

        if (redTeams.length === 0 || blueTeams.length === 0) {
            alert('Please enter at least one team for each alliance');
            return;
        }

        loadMobileOPRData();
        loadMobileEventData();
        calculateMobileMatchPrediction(redTeams, blueTeams);
        renderMobileMatchSummary(allTeams);
    } else if (!matchNumber) {
        alert('Please enter a match number or manually enter teams');
    }
}

function loadMobileOPRData() {
    mobileOprData = {};
    const oprText = localStorage.getItem('oprCSV') || localStorage.getItem('oprCsvText') || '';

    if (!oprText) return;

    try {
        const parsed = Papa.parse(oprText, { header: true, skipEmptyLines: true });
        parsed.data.forEach(row => {
            const team = row['Team Number']?.toString().trim();
            if (team) {
                mobileOprData[team] = {
                    auto: parseFloat((row['Auto OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0,
                    tele: parseFloat((row['Tele OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0,
                    total: parseFloat((row['Total OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0
                };
            }
        });
    } catch (e) {
        console.error('Error parsing OPR data:', e);
    }
}

function loadMobileEventData() {
    mobileEventData = [];
    const eventText = localStorage.getItem('eventScoutingCSV') || '';

    if (!eventText) return;

    try {
        const parsed = Papa.parse(eventText, { header: true, skipEmptyLines: true });
        mobileEventData = parsed.data || [];
    } catch (e) {
        console.error('Error parsing event data:', e);
    }
}
// Replace the calculateMobileMatchPrediction function in mobile.js with this updated version
// Replace the calculateMobileMatchPrediction function in mobile.js with this updated version

function calculateMobileMatchPrediction(redTeams, blueTeams) {
    // Calculate team EPA using average total points only (no OPR)
    const calculateTeamEPA = (team) => {
        if (!team) return 0;

        const teamMatches = mobileEventData.filter(row => {
            const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
            return teamNum === team;
        }).filter(row => {
            const startingPosition = row['Starting Position']?.toString().trim();
            return startingPosition !== 'R'; // Filter out matches where robot was missing
        });

        const totalPoints = teamMatches
            .map(row => parseFloat(row['Total Points'] || row['Total Score'] || 0))
            .filter(v => !isNaN(v));

        const avgTotalPoints = totalPoints.length > 0
            ? totalPoints.reduce((a, b) => a + b, 0) / totalPoints.length
            : 0;

        return avgTotalPoints;
    };

    // Calculate team auto fuel shots for alliance shift
    const calculateTeamAutoFuelShot = (team) => {
        if (!team) return 0;

        const teamMatches = mobileEventData.filter(row => {
            const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
            return teamNum === team;
        }).filter(row => {
            const startingPosition = row['Starting Position']?.toString().trim();
            return startingPosition !== 'R'; // Filter out matches where robot was missing
        });

        const autoFuelShots = teamMatches
            .map(row => parseFloat(row['Auto Fuel Shot'] || 0))
            .filter(v => !isNaN(v));

        const avgAutoFuelShot = autoFuelShots.length > 0
            ? autoFuelShots.reduce((a, b) => a + b, 0) / autoFuelShots.length
            : 0;

        return avgAutoFuelShot;
    };

    // Calculate total EPA for each alliance
    const redEPA = redTeams.reduce((sum, team) => sum + calculateTeamEPA(team), 0);
    const blueEPA = blueTeams.reduce((sum, team) => sum + calculateTeamEPA(team), 0);

    const totalEPA = redEPA + blueEPA;
    const redPercentage = totalEPA > 0 ? ((redEPA / totalEPA) * 100).toFixed(1) : "50.0";
    const bluePercentage = totalEPA > 0 ? ((blueEPA / totalEPA) * 100).toFixed(1) : "50.0";

    // Update display with rounded EPA values and labels
    document.getElementById('redWinPercentage').textContent = redPercentage + '%';
    document.getElementById('blueWinPercentage').textContent = bluePercentage + '%';

    // Update EPA totals with "EPA:" label
    const redEpaEl = document.getElementById('redEPATotal');
    const blueEpaEl = document.getElementById('blueEPATotal');
    redEpaEl.innerHTML = `EPA: ${Math.round(redEPA)}`;
    blueEpaEl.innerHTML = `EPA: ${Math.round(blueEPA)}`;

    // Calculate auto fuel shots for alliance shift
    const redAutoFuelShot = redTeams.reduce((sum, team) => sum + calculateTeamAutoFuelShot(team), 0);
    const blueAutoFuelShot = blueTeams.reduce((sum, team) => sum + calculateTeamAutoFuelShot(team), 0);
    const totalAutoFuelShot = redAutoFuelShot + blueAutoFuelShot;
    const redAutoPercentage = totalAutoFuelShot > 0 ? ((redAutoFuelShot / totalAutoFuelShot) * 100) : 50;
    const blueAutoPercentage = totalAutoFuelShot > 0 ? ((blueAutoFuelShot / totalAutoFuelShot) * 100) : 50;

    // Get DOM elements for alliance shift
    const firstShiftName = document.getElementById('firstShiftName');
    const secondShiftName = document.getElementById('secondShiftName');
    const firstShiftOrder = document.getElementById('firstShiftOrder');
    const secondShiftOrder = document.getElementById('secondShiftOrder');
    const firstShiftAuto = document.getElementById('firstShiftAuto');
    const secondShiftAuto = document.getElementById('secondShiftAuto');
    const firstProgress = document.getElementById('firstShiftProgress');
    const secondProgress = document.getElementById('secondShiftProgress');

    // Determine alliance shift order based on auto fuel shots (lower auto shots goes first)
    if (redAutoFuelShot < blueAutoFuelShot) {
        // Red has lower auto shots, so they go first
        firstShiftName.textContent = 'RED';
        firstShiftName.style.color = '#ff5c5c';
        firstShiftOrder.textContent = 'FIRST';
        firstShiftOrder.style.color = '#ff5c5c';
        firstShiftAuto.innerHTML = `Avg. Auto Shots: ${Math.round(redAutoFuelShot)}`;
        firstShiftAuto.style.color = 'white';

        secondShiftName.textContent = 'BLUE';
        secondShiftName.style.color = '#666';
        secondShiftOrder.textContent = 'SECOND';
        secondShiftOrder.style.color = '#666';
        secondShiftAuto.innerHTML = `Avg. Auto Shots: ${Math.round(blueAutoFuelShot)}`;
        secondShiftAuto.style.color = '#666';

        firstProgress.style.backgroundColor = '#ff5c5c';
        secondProgress.style.backgroundColor = '#666';

        firstProgress.style.width = redAutoPercentage + '%';
        secondProgress.style.width = blueAutoPercentage + '%';

    } else if (blueAutoFuelShot < redAutoFuelShot) {
        // Blue has lower auto shots, so they go first
        firstShiftName.textContent = 'BLUE';
        firstShiftName.style.color = '#3EDBF0';
        firstShiftOrder.textContent = 'FIRST';
        firstShiftOrder.style.color = '#3EDBF0';
        firstShiftAuto.innerHTML = `Avg. Auto Shots: ${Math.round(blueAutoFuelShot)}`;
        firstShiftAuto.style.color = 'white';

        secondShiftName.textContent = 'RED';
        secondShiftName.style.color = '#666';
        secondShiftOrder.textContent = 'SECOND';
        secondShiftOrder.style.color = '#666';
        secondShiftAuto.innerHTML = `Avg. Auto Shots: ${Math.round(redAutoFuelShot)}`;
        secondShiftAuto.style.color = '#666';

        firstProgress.style.backgroundColor = '#3EDBF0';
        secondProgress.style.backgroundColor = '#666';

        firstProgress.style.width = blueAutoPercentage + '%';
        secondProgress.style.width = redAutoPercentage + '%';

    } else {
        // Equal auto shots - default to Red first, Blue second
        firstShiftName.textContent = 'RED';
        firstShiftName.style.color = '#ff5c5c';
        firstShiftOrder.textContent = 'FIRST';
        firstShiftOrder.style.color = '#ff5c5c';
        firstShiftAuto.innerHTML = `Avg. Auto Shots: ${Math.round(redAutoFuelShot)}`;
        firstShiftAuto.style.color = 'white';

        secondShiftName.textContent = 'BLUE';
        secondShiftName.style.color = '#3EDBF0';
        secondShiftOrder.textContent = 'SECOND';
        secondShiftOrder.style.color = '#3EDBF0';
        secondShiftAuto.innerHTML = `Avg. Auto Shots: ${Math.round(blueAutoFuelShot)}`;
        secondShiftAuto.style.color = 'white';

        firstProgress.style.backgroundColor = '#ff5c5c';
        secondProgress.style.backgroundColor = '#3EDBF0';

        firstProgress.style.width = '50%';
        secondProgress.style.width = '50%';
    }

    // Style the match prediction based on winner
    const redProgressBar = document.getElementById('redProgressBar');
    const blueProgressBar = document.getElementById('blueProgressBar');
    const redAllianceColor = document.querySelector('#redPredictionBlock div:first-child');
    const blueAllianceColor = document.querySelector('#bluePredictionBlock div:first-child');
    const redPercentageEl = document.getElementById('redWinPercentage');
    const bluePercentageEl = document.getElementById('blueWinPercentage');

    if (redEPA > blueEPA) {
        redAllianceColor.style.color = '#ff5c5c';
        redPercentageEl.style.color = '#ff5c5c';
        redEpaEl.style.color = 'white';
        blueAllianceColor.style.color = '#666';
        bluePercentageEl.style.color = '#666';
        blueEpaEl.style.color = '#666';
        redProgressBar.style.backgroundColor = '#ff5c5c';
        blueProgressBar.style.backgroundColor = '#666';
    } else if (blueEPA > redEPA) {
        blueAllianceColor.style.color = '#3EDBF0';
        bluePercentageEl.style.color = '#3EDBF0';
        blueEpaEl.style.color = 'white';
        redAllianceColor.style.color = '#666';
        redPercentageEl.style.color = '#666';
        redEpaEl.style.color = '#666';
        redProgressBar.style.backgroundColor = '#666';
        blueProgressBar.style.backgroundColor = '#3EDBF0';
    } else {
        redAllianceColor.style.color = '#ff5c5c';
        redPercentageEl.style.color = '#ff5c5c';
        redEpaEl.style.color = 'white';
        blueAllianceColor.style.color = '#3EDBF0';
        bluePercentageEl.style.color = '#3EDBF0';
        blueEpaEl.style.color = 'white';
        redProgressBar.style.backgroundColor = '#ff5c5c';
        blueProgressBar.style.backgroundColor = '#3EDBF0';
    }

    redProgressBar.style.width = redPercentage + '%';
    blueProgressBar.style.width = bluePercentage + '%';
}

// Replace the renderMobileMatchSummary function in mobile.js with this updated version

function renderMobileMatchSummary(teams) {
    const summaryContainer = document.getElementById('mobileSummaryContent');

    if (!summaryContainer) return;

    if (teams.length === 0) {
        summaryContainer.innerHTML = '<p style="color: #aaa; text-align: center; padding: 20px;">No teams to display</p>';
        return;
    }

    const calculateTeamEPA = (team) => {
        if (!team) return 0;
        const teamMatches = mobileEventData.filter(row => {
            const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
            return teamNum === team;
        }).filter(row => {
            const startingPosition = row['Starting Position']?.toString().trim();
            return startingPosition !== 'R';
        });

        const totalPoints = teamMatches
            .map(row => parseFloat(row['Total Points'] || row['Total Score'] || 0))
            .filter(v => !isNaN(v));

        const avgTotalPoints = totalPoints.length > 0
            ? totalPoints.reduce((a, b) => a + b, 0) / totalPoints.length
            : 0;

        return Math.round(avgTotalPoints);
    };

    const calculateAutoShot = (team) => {
        if (!team) return 0;
        const teamMatches = mobileEventData.filter(row => {
            const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
            return teamNum === team;
        }).filter(row => {
            const startingPosition = row['Starting Position']?.toString().trim();
            return startingPosition !== 'R';
        });

        const autoShots = teamMatches
            .map(row => parseFloat(row['Auto Fuel Shot'] || 0))
            .filter(v => !isNaN(v));

        const avgAutoShot = autoShots.length > 0
            ? autoShots.reduce((a, b) => a + b, 0) / autoShots.length
            : 0;

        return Math.round(avgAutoShot);
    };

    const calculateTeleShot = (team) => {
        if (!team) return 0;
        const teamMatches = mobileEventData.filter(row => {
            const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
            return teamNum === team;
        }).filter(row => {
            const startingPosition = row['Starting Position']?.toString().trim();
            return startingPosition !== 'R';
        });

        const teleShots = teamMatches
            .map(row => parseFloat(row['Tele Fuel Shot'] || 0))
            .filter(v => !isNaN(v));

        const avgTeleShot = teleShots.length > 0
            ? teleShots.reduce((a, b) => a + b, 0) / teleShots.length
            : 0;

        return Math.round(avgTeleShot);
    };

    const calculateClimbRate = (team) => {
        if (!team) return '0.0%';
        const teamMatches = mobileEventData.filter(row => {
            const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
            return teamNum === team;
        }).filter(row => {
            const startingPosition = row['Starting Position']?.toString().trim();
            return startingPosition !== 'R';
        });

        const climbValues = teamMatches
            .map(row => row['Climb Teleop']?.toString().trim())
            .filter(v => v && v !== '');

        const successfulClimbs = climbValues.filter(v => ['1', '2', '3'].includes(v)).length;
        const totalClimbAttempts = climbValues.filter(v => ['1', '2', '3', 'F'].includes(v)).length;

        if (totalClimbAttempts === 0) return '0.0%';
        const rate = ((successfulClimbs / totalClimbAttempts) * 100).toFixed(1);
        return rate + '%';
    };

    const calculateShootingAccuracy = (team) => {
        if (!team) return '0.0';
        const teamMatches = mobileEventData.filter(row => {
            const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
            return teamNum === team;
        }).filter(row => {
            const startingPosition = row['Starting Position']?.toString().trim();
            return startingPosition !== 'R';
        });

        const shootingValues = teamMatches
            .map(row => parseFloat(row['Shooting Accuracy']))
            .filter(v => !isNaN(v) && [0, 1, 2, 3].includes(v));

        if (shootingValues.length === 0) return '0.0';
        const avgAccuracy = shootingValues.reduce((a, b) => a + b, 0) / shootingValues.length;
        return avgAccuracy.toFixed(1);
    };

    const getMostCommonClimb = (team) => {
        if (!team) return 'N/A';
        const teamMatches = mobileEventData.filter(row => {
            const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
            return teamNum === team;
        }).filter(row => {
            const startingPosition = row['Starting Position']?.toString().trim();
            return startingPosition !== 'R';
        });

        const climbValues = teamMatches
            .map(row => row['Climb Teleop']?.toString().trim())
            .filter(v => v && v !== '' && v !== '0' && v !== 'F');

        if (climbValues.length === 0) return 'N/A';

        const climbCounts = { '1': 0, '2': 0, '3': 0 };
        climbValues.forEach(value => {
            if (climbCounts.hasOwnProperty(value)) {
                climbCounts[value]++;
            }
        });

        let mostCommonLevel = '1';
        let maxCount = 0;

        ['3', '2', '1'].forEach(level => {
            if (climbCounts[level] >= maxCount) {
                maxCount = climbCounts[level];
                mostCommonLevel = level;
            }
        });

        switch (mostCommonLevel) {
            case '1': return 'L1';
            case '2': return 'L2';
            case '3': return 'L3';
            default: return 'N/A';
        }
    };

    const calculateAvgDefenseRating = (team) => {
        if (!team) return '0.0';
        const teamMatches = mobileEventData.filter(row => {
            const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
            return teamNum === team;
        }).filter(row => {
            const startingPosition = row['Starting Position']?.toString().trim();
            return startingPosition !== 'R';
        });

        const defenseRatings = teamMatches
            .map(row => {
                const defense = parseFloat(row['Robot Defense'] || row['Defense Rating'] || 0);
                return defense;
            })
            .filter(rating => !isNaN(rating) && rating > 0);

        if (defenseRatings.length === 0) return '0.0';

        const avg = defenseRatings.reduce((a, b) => a + b, 0) / defenseRatings.length;
        return avg.toFixed(1);
    };

    const calculateDiedAndMissing = (team) => {
        if (!team) return { diedMatches: [], missingMatches: [] };

        const teamMatches = mobileEventData.filter(row => {
            const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
            return teamNum === team;
        });

        const diedMatches = teamMatches
            .filter(row => {
                const died = row['Robot Died']?.toString().trim() || row['Died or Immobilized']?.toString().trim();
                const startingPosition = row['Starting Position']?.toString().trim();
                return (died === '1' || died === '0.5' || died === 'true') && startingPosition !== 'R';
            })
            .map(row => row['Match Number'] || row['Match No.'] || 'Unknown')
            .filter(m => m);

        const missingMatches = teamMatches
            .filter(row => {
                const startingPosition = row['Starting Position']?.toString().trim();
                return startingPosition === 'R';
            })
            .map(row => row['Match Number'] || row['Match No.'] || 'Unknown')
            .filter(m => m);

        return {
            diedMatches: diedMatches.sort((a, b) => {
                const numA = parseInt(a.toString().replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(b.toString().replace(/[^0-9]/g, '')) || 0;
                return numA - numB;
            }),
            missingMatches: missingMatches.sort((a, b) => {
                const numA = parseInt(a.toString().replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(b.toString().replace(/[^0-9]/g, '')) || 0;
                return numA - numB;
            })
        };
    };

    let summaryHTML = `
        <style>
            .mobile-summary-table {
                width: 100%;
                border-collapse: collapse;
                color: white;
                font-family: 'Lato', sans-serif;
                font-size: 14px;
            }
            .mobile-summary-table th {
                padding: 12px 8px;
                text-align: center;
                color: white;
                font-weight: bold;
                border-bottom: 2px solid white;
            }
            .mobile-summary-table td {
                padding: 10px 8px;
                text-align: center;
                color: white;
                border-bottom: 1px solid #333;
            }
            .team-cell-wrapper {
                position: relative;
                display: inline-block;
                cursor: pointer;
            }
            .team-cell-wrapper:hover .death-tooltip {
                display: block !important;
            }
            .death-tooltip {
                display: none;
                position: absolute;
                top: 50%;
                left: 100%;
                transform: translateY(-50%);
                margin-left: 12px;
                background-color: #23242a;
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-family: 'Lato', sans-serif;
                white-space: nowrap;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
                border: 1px solid;
            }
            .death-tooltip-row {
                display: flex;
                gap: 12px;
                margin-bottom: 4px;
            }
            .death-tooltip-row:last-child {
                margin-bottom: 0;
            }
            .death-tooltip-label {
                font-weight: bold;
                min-width: 70px;
            }
            .death-tooltip-value {
                font-weight: bold;
                color: white;
            }
            .death-tooltip-team {
                font-weight: bold;
                margin-bottom: 8px;
                font-size: 14px;
                text-align: center;
            }
        </style>
        <div style="background-color: #1C1E21; border-radius: 12px; padding: 20px; margin-top: 20px; overflow-x: auto; width: 100%; max-width: 100%; box-sizing: border-box;">
            <table class="mobile-summary-table">
                <thead>
                    <tr>
                        <th>Team</th>
                        <th>EPA</th>
                        <th>Auto Shot</th>
                        <th>Tele Shot</th>
                        <th>Shooting Acc</th>
                        <th>Most Common</th>
                        <th>Climb Rate</th>
                        <th>Defense</th>
                    </tr>
                </thead>
                <tbody>
    `;

    teams.forEach((team, index) => {
        if (!team) return;

        const alliance = index < 3 ? 'Red' : 'Blue';
        const allianceColor = alliance === 'Red' ? '#ff5c5c' : '#3EDBF0';
        const bgColor = alliance === 'Red' ? '#ff5c5c30' : '#3EDBF030';
        const epa = calculateTeamEPA(team);
        const autoShot = calculateAutoShot(team);
        const teleShot = calculateTeleShot(team);
        const shootingAccuracy = calculateShootingAccuracy(team);
        const mostCommonClimb = getMostCommonClimb(team);
        const climbRate = calculateClimbRate(team);
        const defenseRating = calculateAvgDefenseRating(team);
        const { diedMatches, missingMatches } = calculateDiedAndMissing(team);

        let teamDisplay = team;
        let tooltipHTML = '';

        const hasIssues = diedMatches.length > 0 || missingMatches.length > 0;

        if (hasIssues) {
            teamDisplay = `⚠️${team}`;

            tooltipHTML = `<div class="death-tooltip" style="border-color: ${allianceColor};">`;
            tooltipHTML += `<div class="death-tooltip-team" style="color: ${allianceColor};">${team}</div>`;

            if (diedMatches.length > 0) {
                const matchesStr = diedMatches.join(', ');
                tooltipHTML += `
                    <div class="death-tooltip-row">
                        <span class="death-tooltip-label" style="color: ${allianceColor};">Died:</span>
                        <span class="death-tooltip-value">${matchesStr}</span>
                    </div>
                `;
            } else {
                tooltipHTML += `
                    <div class="death-tooltip-row">
                        <span class="death-tooltip-label" style="color: ${allianceColor};">Died:</span>
                        <span class="death-tooltip-value">None</span>
                    </div>
                `;
            }

            if (missingMatches.length > 0) {
                const matchesStr = missingMatches.join(', ');
                tooltipHTML += `
                    <div class="death-tooltip-row">
                        <span class="death-tooltip-label" style="color: ${allianceColor};">Missing:</span>
                        <span class="death-tooltip-value">${matchesStr}</span>
                    </div>
                `;
            }

            tooltipHTML += `</div>`;
        }

        summaryHTML += `
            <tr>
                <td style="background-color: ${bgColor};">
                    <span class="team-cell-wrapper">
                        ${teamDisplay}
                        ${tooltipHTML}
                    </span>
                </td>
                <td>${epa}</td>
                <td>${autoShot}</td>
                <td>${teleShot}</td>
                <td>${shootingAccuracy}</td>
                <td>${mostCommonClimb}</td>
                <td>${climbRate}</td>
                <td>${defenseRating}</td>
            </tr>
        `;
    });

    summaryHTML += `
                </tbody>
            </table>
        </div>
    `;

    summaryContainer.innerHTML = summaryHTML;
}
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.red-alliance').forEach(input => {
        input.addEventListener('focus', function () {
            this.style.borderColor = '#ff5c5c';
        });
        input.addEventListener('blur', function () {
            this.style.borderColor = '#444';
        });
    });

    document.querySelectorAll('.blue-alliance').forEach(input => {
        input.addEventListener('focus', function () {
            this.style.borderColor = '#3EDBF0';
        });
        input.addEventListener('blur', function () {
            this.style.borderColor = '#444';
        });
    });
});

/*----- FILTER TEAMS -----*/

let mobileHiddenTeams = JSON.parse(localStorage.getItem('mobileHiddenTeams') || '[]');
let mobileShowHiddenTeamsInFilter = false;
let mobileFilterInitialized = false;
let mobilePitData = [];
let mobileOprMap = {};

function initMobileFilterView() {

    mobileHiddenTeams = JSON.parse(localStorage.getItem('mobileHiddenTeams') || '[]');

    loadMobileData();

    loadMobileFilterState();

    renderMobileHideTeamsList();

    setupMobileFilterListeners();

    applyMobileFilters();

    mobileFilterInitialized = true;
}

function loadMobileData() {
    console.log('Loading mobile data from localStorage...');

    const eventCSV = localStorage.getItem('eventScoutingCSV') || '';
    console.log('Event CSV exists:', !!eventCSV);

    if (eventCSV) {
        try {
            const parsed = Papa.parse(eventCSV, {
                header: true,
                skipEmptyLines: true,
                transform: function (value) {
                    if (typeof value === 'string') {
                        return value.replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"').trim();
                    }
                    return value;
                }
            });
            mobileEventData = parsed.data || [];
            console.log(`Loaded ${mobileEventData.length} event rows`);
        } catch (e) {
            console.error('Error parsing event CSV:', e);
            mobileEventData = [];
        }
    } else {
        mobileEventData = [];
    }

    const pitCSV = localStorage.getItem('pitScoutingCSV') || '';
    console.log('Pit CSV exists:', !!pitCSV);

    if (pitCSV) {
        try {
            const parsed = Papa.parse(pitCSV, {
                header: true,
                skipEmptyLines: true,
                transform: function (value) {
                    if (typeof value === 'string') {
                        return value.replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"').trim();
                    }
                    return value;
                }
            });
            mobilePitData = parsed.data.filter(row => {
                return row['Team Number'] &&
                    row['Trench'] !== undefined &&
                    row['Ground Intake'] !== undefined &&
                    row['Shoot on Fly'] !== undefined;
            });
            console.log(`Loaded ${mobilePitData.length} pit rows`);
        } catch (e) {
            console.error('Error parsing pit CSV:', e);
            mobilePitData = [];
        }
    } else {
        mobilePitData = [];
    }

    const oprCSV = localStorage.getItem('oprCSV') || localStorage.getItem('oprCsvText') || '';
    console.log('OPR CSV exists:', !!oprCSV);

    mobileOprMap = {};
    if (oprCSV) {
        try {
            const parsed = Papa.parse(oprCSV, {
                header: true,
                skipEmptyLines: true,
                transform: function (value) {
                    if (typeof value === 'string') {
                        const cleaned = value.replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"').trim();
                        if (!isNaN(parseFloat(cleaned)) && isFinite(cleaned)) {
                            return cleaned;
                        }
                        return cleaned;
                    }
                    return value;
                }
            });

            parsed.data.forEach(row => {
                const team = row['Team Number']?.toString().trim();
                if (team) {
                    mobileOprMap[team] = parseFloat((row['Total OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0;
                }
            });
            console.log(`Loaded OPR data for ${Object.keys(mobileOprMap).length} teams`);
        } catch (e) {
            console.error('Error parsing OPR CSV:', e);
        }
    }
}

function setupMobileFilterListeners() {
    console.log('Setting up mobile filter listeners...');

    document.querySelectorAll('#filterTeams-tab input[type="checkbox"]').forEach(checkbox => {
        checkbox.removeEventListener('change', handleMobileFilterChange);
        checkbox.addEventListener('change', handleMobileFilterChange);
    });

    const dropdown = document.getElementById('filterTeamsDropdownMobile');
    if (dropdown) {
        dropdown.removeEventListener('change', handleMobileFilterChange);
        dropdown.addEventListener('change', handleMobileFilterChange);
    }

    const addBtn = document.getElementById('addHideTeamButtonMobile');
    if (addBtn) {
        addBtn.removeEventListener('click', addMobileHiddenTeam);
        addBtn.addEventListener('click', addMobileHiddenTeam);
    }

    const resetBtn = document.getElementById('resetHideTeamButtonMobile');
    if (resetBtn) {
        resetBtn.removeEventListener('click', resetMobileHiddenTeams);
        resetBtn.addEventListener('click', resetMobileHiddenTeams);
    }

    const toggleBtn = document.getElementById('toggleHiddenTeamsButtonMobile');
    if (toggleBtn) {
        toggleBtn.removeEventListener('click', toggleMobileHiddenTeams);
        toggleBtn.addEventListener('click', toggleMobileHiddenTeams);
    }

    const input = document.getElementById('hideTeamInputMobile');
    if (input) {
        input.removeEventListener('keydown', handleMobileHideTeamKeydown);
        input.addEventListener('keydown', handleMobileHideTeamKeydown);
    }

    console.log('Mobile filter listeners setup complete');
}

function handleMobileFilterChange() {
    console.log('Filter changed, applying...');
    saveMobileFilterState();
    applyMobileFilters();
}

function handleMobileHideTeamKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        addMobileHiddenTeam();
    }
}

function addMobileHiddenTeam() {
    const input = document.getElementById('hideTeamInputMobile');
    const teamNumber = input.value.trim();

    if (!teamNumber) {
        alert('Please enter a team number');
        return;
    }

    const teamExists = mobileEventData.some(row =>
        row['Team Number']?.toString().trim() === teamNumber
    );

    if (!teamExists) {
        alert(`No data found for team ${teamNumber}`);
        return;
    }

    if (!mobileHiddenTeams.includes(teamNumber)) {
        mobileHiddenTeams.push(teamNumber);
        mobileHiddenTeams.sort((a, b) => parseInt(a) - parseInt(b));
        saveMobileHiddenTeams();
        renderMobileHideTeamsList();
        applyMobileFilters();
        input.value = '';
    } else {
        alert(`Team ${teamNumber} is already in the list.`);
    }
}

function resetMobileHiddenTeams() {
    if (confirm('Are you sure you want to reset all hidden teams?')) {
        mobileHiddenTeams = [];
        saveMobileHiddenTeams();
        renderMobileHideTeamsList();
        applyMobileFilters();
    }
}

function toggleMobileHiddenTeams() {
    mobileShowHiddenTeamsInFilter = !mobileShowHiddenTeamsInFilter;
    const btn = document.getElementById('toggleHiddenTeamsButtonMobile');
    if (btn) {
        btn.textContent = mobileShowHiddenTeamsInFilter ? 'Hide Hidden Teams' : 'Show Hidden Teams';
    }
    applyMobileFilters();
    saveMobileFilterState();
}

function renderMobileHideTeamsList() {
    const list = document.getElementById('hideTeamListMobile');
    const container = document.getElementById('hideTeamListContainerMobile');
    if (!list || !container) return;

    list.innerHTML = '';

    if (mobileHiddenTeams.length === 0) {
        container.style.maxHeight = '0px';
        container.style.overflowY = 'hidden';
        return;
    }

    mobileHiddenTeams.forEach(team => {
        const listItem = document.createElement('li');
        listItem.style.display = 'flex';
        listItem.style.justifyContent = 'space-between';
        listItem.style.alignItems = 'center';
        listItem.style.marginBottom = '8px';
        listItem.style.padding = '6px 10px';
        listItem.style.backgroundColor = '#1C1E21';
        listItem.style.borderRadius = '4px';
        listItem.style.border = '1px solid red';

        const teamText = document.createElement('span');
        teamText.textContent = `Team ${team}`;
        teamText.style.color = 'white';
        teamText.style.fontFamily = 'Lato';
        listItem.appendChild(teamText);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'X';
        deleteButton.style.padding = '2px 8px';
        deleteButton.style.backgroundColor = '#ff5c5c';
        deleteButton.style.color = 'white';
        deleteButton.style.border = 'none';
        deleteButton.style.borderRadius = '4px';
        deleteButton.style.cursor = 'pointer';
        deleteButton.style.fontFamily = 'Lato';
        deleteButton.style.fontWeight = 'bold';

        deleteButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mobileHiddenTeams = mobileHiddenTeams.filter(t => t !== team);
            saveMobileHiddenTeams();
            renderMobileHideTeamsList();
            applyMobileFilters();
        });

        listItem.appendChild(deleteButton);
        list.appendChild(listItem);
    });

    const itemHeight = 42;
    const maxVisibleItems = 8;

    if (mobileHiddenTeams.length <= maxVisibleItems) {
        container.style.maxHeight = `${mobileHiddenTeams.length * itemHeight}px`;
        container.style.overflowY = 'hidden';
    } else {
        container.style.maxHeight = `${maxVisibleItems * itemHeight}px`;
        container.style.overflowY = 'auto';
    }
}

function applyMobileFilters() {
    console.log('Applying mobile filters...');

    const container = document.getElementById('rankedTeamsContainerMobile');
    if (!container) {
        console.error('Ranked teams container not found');
        return;
    }

    if (mobileEventData.length === 0) {
        container.innerHTML = '<p style="color: #aaa; text-align: center; padding: 40px;">Please upload event scouting CSV first</p>';
        return;
    }

    try {
        const selectedFilters = Array.from(document.querySelectorAll('#filterTeams-tab input[type="checkbox"]:checked')).map(cb => cb.value);
        const sortBy = document.getElementById('filterTeamsDropdownMobile')?.value || 'EPA';

        console.log('Selected filters:', selectedFilters);
        console.log('Sort by:', sortBy);

        const teamMap = {};

        mobileEventData.forEach(row => {
            const team = row['Team Number']?.toString().trim();
            if (!team) return;

            if (!teamMap[team]) {
                teamMap[team] = {
                    matches: [],
                    totalPoints: 0,
                    matchCount: 0,
                    autoShots: [],
                    teleShots: [],
                    autoFerried: [],
                    teleFerried: [],
                    hasAutoClimb: false,
                    hasAutoCenter: false,
                    hasAutoDepot: false,
                    hasAutoOutpost: false,
                    hasClimbLevel1: false,
                    hasClimbLevel2: false,
                    hasClimbLevel3: false,
                    hasClimbPositionCenter: false,
                    hasClimbPositionDepot: false,
                    hasClimbPositionOutpost: false,
                    hasSwerve: false,
                    hasTrench: false,
                    hasShootOnFly: false,
                    hasGroundIntake: false
                };
            }

            const points = parseFloat(row['Total Points'] || row['Total Score'] || 0);
            if (!isNaN(points)) {
                teamMap[team].totalPoints += points;
                teamMap[team].matchCount++;
            }

            // Collect shot data
            const autoShot = parseFloat(row['Auto Fuel Shot'] || 0);
            if (!isNaN(autoShot)) {
                teamMap[team].autoShots.push(autoShot);
            }

            const teleShot = parseFloat(row['Tele Fuel Shot'] || 0);
            if (!isNaN(teleShot)) {
                teamMap[team].teleShots.push(teleShot);
            }

            // Collect ferried data
            const autoFerried = parseFloat(row['Auto Fuel Ferried'] || 0);
            if (!isNaN(autoFerried)) {
                teamMap[team].autoFerried.push(autoFerried);
            }

            const teleFerried = parseFloat(row['Tele Fuel Ferried'] || 0);
            if (!isNaN(teleFerried)) {
                teamMap[team].teleFerried.push(teleFerried);
            }

            const autoClimb = row['Climb Auto']?.toString().trim();
            if (autoClimb === '1') teamMap[team].hasAutoClimb = true;

            const startingPos = row['Starting Position']?.toString().trim();
            if (startingPos === 'C') teamMap[team].hasAutoCenter = true;
            if (startingPos === 'D') teamMap[team].hasAutoDepot = true;
            if (startingPos === 'O') teamMap[team].hasAutoOutpost = true;

            const climbTeleop = row['Climb Teleop']?.toString().trim();
            if (climbTeleop === '1') teamMap[team].hasClimbLevel1 = true;
            if (climbTeleop === '2') teamMap[team].hasClimbLevel2 = true;
            if (climbTeleop === '3') teamMap[team].hasClimbLevel3 = true;

            const climbPosition = row['Climb Position']?.toString().trim();
            if (climbPosition === 'C') teamMap[team].hasClimbPositionCenter = true;
            if (climbPosition === 'D') teamMap[team].hasClimbPositionDepot = true;
            if (climbPosition === 'O') teamMap[team].hasClimbPositionOutpost = true;
        });

        if (mobilePitData && mobilePitData.length > 0) {
            mobilePitData.forEach(row => {
                const team = row['Team Number']?.toString().trim();
                if (!team || !teamMap[team]) return;

                const drivetrain = (row['Drivetrain'] || '').toString().toLowerCase();
                if (drivetrain.includes('swerve')) teamMap[team].hasSwerve = true;

                if (row['Trench'] === '1' || row['Trench'] === 1 || row['Trench'] === true) {
                    teamMap[team].hasTrench = true;
                }
                if (row['Shoot on Fly'] === '1' || row['Shoot on Fly'] === 1 || row['Shoot on Fly'] === true) {
                    teamMap[team].hasShootOnFly = true;
                }
                if (row['Ground Intake'] === '1' || row['Ground Intake'] === 1 || row['Ground Intake'] === true) {
                    teamMap[team].hasGroundIntake = true;
                }
            });
        }

        const allTeams = Object.keys(teamMap).map(team => {
            const data = teamMap[team];
            const avgPoints = data.matchCount > 0 ? data.totalPoints / data.matchCount : 0;
            const epa = avgPoints; // EPA is just average total points, no OPR

            // Calculate avg shot (auto + tele)
            const allShots = [...data.autoShots, ...data.teleShots];
            const avgShot = allShots.length > 0
                ? allShots.reduce((a, b) => a + b, 0) / allShots.length
                : 0;

            // Calculate avg ferried (auto + tele)
            const allFerried = [...data.autoFerried, ...data.teleFerried];
            const avgFerried = allFerried.length > 0
                ? allFerried.reduce((a, b) => a + b, 0) / allFerried.length
                : 0;

            return {
                team,
                epa: epa,
                avgShot: avgShot,
                avgFerried: avgFerried,
                flags: {
                    autoClimb: data.hasAutoClimb,
                    autoCenter: data.hasAutoCenter,
                    autoDepot: data.hasAutoDepot,
                    autoOutpost: data.hasAutoOutpost,
                    climbLevel1: data.hasClimbLevel1,
                    climbLevel2: data.hasClimbLevel2,
                    climbLevel3: data.hasClimbLevel3,
                    climbPositionCenter: data.hasClimbPositionCenter,
                    climbPositionDepot: data.hasClimbPositionDepot,
                    climbPositionOutpost: data.hasClimbPositionOutpost,
                    swerve: data.hasSwerve,
                    trench: data.hasTrench,
                    shootOnFly: data.hasShootOnFly,
                    groundIntake: data.hasGroundIntake
                },
                isHidden: mobileHiddenTeams.includes(team)
            };
        });

        console.log(`Found ${allTeams.length} teams total`);

        const matchingTeams = [];
        const nonMatchingTeams = [];

        allTeams.forEach(team => {
            if (!mobileShowHiddenTeamsInFilter && team.isHidden) return;

            if (selectedFilters.length === 0) {
                matchingTeams.push(team);
                return;
            }

            let hasAllFilters = true;
            for (const filter of selectedFilters) {
                if (!team.flags[filter]) {
                    hasAllFilters = false;
                    break;
                }
            }

            if (hasAllFilters) {
                matchingTeams.push(team);
            } else {
                nonMatchingTeams.push(team);
            }
        });

        console.log(`Matching teams: ${matchingTeams.length}, Non-matching teams: ${nonMatchingTeams.length}`);

        matchingTeams.sort((a, b) => {
            if (sortBy === 'EPA') return b.epa - a.epa;
            if (sortBy === 'avgShot') return b.avgShot - a.avgShot;
            if (sortBy === 'avgFerried') return b.avgFerried - a.avgFerried;
            return b.epa - a.epa;
        });

        nonMatchingTeams.sort((a, b) => {
            if (sortBy === 'EPA') return b.epa - a.epa;
            if (sortBy === 'avgShot') return b.avgShot - a.avgShot;
            if (sortBy === 'avgFerried') return b.avgFerried - a.avgFerried;
            return b.epa - a.epa;
        });

        renderMobileTeamGrid(matchingTeams, nonMatchingTeams, container, sortBy);

    } catch (e) {
        console.error('Error applying filters:', e);
        container.innerHTML = '<p style="color: #ff5c5c; text-align: center; padding: 40px;">Error loading data</p>';
    }
}
function renderMobileTeamGrid(matchingTeams, nonMatchingTeams, container, sortBy) {
    container.innerHTML = '';

    if (matchingTeams.length === 0 && nonMatchingTeams.length === 0) {
        container.innerHTML = '<p style="color: #aaa; text-align: center; padding: 40px;">No teams available</p>';
        return;
    }

    if (matchingTeams.length > 0) {
        const matchingLabel = document.createElement('div');
        matchingLabel.textContent = 'Matching Teams';
        matchingLabel.style.fontSize = '20px';
        matchingLabel.style.color = 'white';
        matchingLabel.style.margin = '10px 0 15px';
        matchingLabel.style.fontWeight = 'bold';
        matchingLabel.style.fontFamily = 'Lato';
        matchingLabel.style.borderBottom = '2px solid #1e90ff';
        matchingLabel.style.paddingBottom = '5px';
        container.appendChild(matchingLabel);

        const matchingGrid = document.createElement('div');
        matchingGrid.style.display = 'grid';
        matchingGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(160px, 1fr))';
        matchingGrid.style.gap = '15px';
        matchingGrid.style.width = '100%';
        matchingGrid.style.marginBottom = '30px';

        matchingTeams.forEach(team => {
            const box = createTeamBox(team, sortBy);
            matchingGrid.appendChild(box);
        });

        container.appendChild(matchingGrid);
    }

    if (nonMatchingTeams.length > 0) {
        const nonMatchingLabel = document.createElement('div');
        nonMatchingLabel.textContent = "Don't Match";
        nonMatchingLabel.style.fontSize = '20px';
        nonMatchingLabel.style.color = 'white';
        nonMatchingLabel.style.margin = '20px 0 15px';
        nonMatchingLabel.style.fontWeight = 'bold';
        nonMatchingLabel.style.fontFamily = 'Lato';
        nonMatchingLabel.style.borderBottom = '2px solid #ff5c5c';
        nonMatchingLabel.style.paddingBottom = '5px';
        container.appendChild(nonMatchingLabel);

        const nonMatchingGrid = document.createElement('div');
        nonMatchingGrid.style.display = 'grid';
        nonMatchingGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(160px, 1fr))';
        nonMatchingGrid.style.gap = '15px';
        nonMatchingGrid.style.width = '100%';
        nonMatchingGrid.style.opacity = '0.7';

        nonMatchingTeams.forEach(team => {
            const box = createTeamBox(team, sortBy);
            nonMatchingGrid.appendChild(box);
        });

        container.appendChild(nonMatchingGrid);
    }
}

function createTeamBox(team, sortBy) {
    const box = document.createElement('div');
    box.style.backgroundColor = team.isHidden ? '#2a2d31' : '#1C1E21';
    box.style.borderRadius = '12px';
    box.style.padding = '15px';
    box.style.color = 'white';
    box.style.boxShadow = '#131416 0px 0px 10px';
    box.style.textAlign = 'center';
    box.style.fontFamily = 'Lato';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.justifyContent = 'center';
    box.style.alignItems = 'center';
    box.style.position = 'relative';
    box.style.transition = 'transform 0.2s';
    box.style.cursor = 'pointer';

    box.onmouseover = function () {
        this.style.transform = 'scale(1.02)';
    };
    box.onmouseout = function () {
        this.style.transform = 'scale(1)';
    };

    if (team.isHidden) {
        const hiddenTag = document.createElement('div');
        hiddenTag.textContent = 'HIDDEN';
        hiddenTag.style.position = 'absolute';
        hiddenTag.style.top = '5px';
        hiddenTag.style.right = '5px';
        hiddenTag.style.backgroundColor = '#ff5c5c';
        hiddenTag.style.color = 'white';
        hiddenTag.style.fontSize = '10px';
        hiddenTag.style.padding = '2px 5px';
        hiddenTag.style.borderRadius = '3px';
        hiddenTag.style.fontFamily = 'Lato';
        hiddenTag.style.fontWeight = 'bold';
        box.appendChild(hiddenTag);
    }

    let metricValue, metricLabel;

    if (sortBy === 'EPA') {
        metricValue = team.epa.toFixed(1);
        metricLabel = 'Avg. EPA';
    } else if (sortBy === 'avgShot') {
        metricValue = team.avgShot.toFixed(1);
        metricLabel = 'Avg. Shot';
    } else if (sortBy === 'avgFerried') {
        metricValue = team.avgFerried.toFixed(1);
        metricLabel = 'Avg. Ferried';
    } else {
        metricValue = team.epa.toFixed(1);
        metricLabel = 'Avg. EPA';
    }

    const viewButton = document.createElement('button');
    viewButton.textContent = 'View';
    viewButton.style.marginTop = '10px';
    viewButton.style.padding = '8px 16px';
    viewButton.style.fontSize = '14px';
    viewButton.style.backgroundColor = '#1e90ff';
    viewButton.style.color = 'white';
    viewButton.style.border = 'none';
    viewButton.style.borderRadius = '4px';
    viewButton.style.cursor = 'pointer';
    viewButton.style.fontFamily = 'Lato';
    viewButton.style.transition = 'background-color 0.2s';

    viewButton.onmouseover = function () {
        this.style.backgroundColor = '#0066cc';
    };
    viewButton.onmouseout = function () {
        this.style.backgroundColor = '#1e90ff';
    };

    viewButton.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        goToMobileIndividualView(team.team);
    };

    box.innerHTML = `
    <h3 style="margin: 0 0 10px 0; font-size: 18px; font-family: Lato;">Team ${team.team}</h3>
    <p style="margin: 5px 0; font-size: 14px; font-family: Lato;"><strong>${metricLabel}:</strong> ${metricValue}</p>
    `;
    box.appendChild(viewButton);

    return box;
}

function goToMobileIndividualView(teamNumber) {
    console.log('Going to individual view for team:', teamNumber);
    switchMobileTab('individual');

    setTimeout(() => {
        const searchInput = document.getElementById('individualSearchMobile');
        if (searchInput) {
            searchInput.value = teamNumber;
            if (typeof handleMobileIndividualSearch === 'function') {
                handleMobileIndividualSearch();
            }
        }
    }, 100);
}

function saveMobileHiddenTeams() {
    localStorage.setItem('mobileHiddenTeams', JSON.stringify(mobileHiddenTeams));
}

function saveMobileFilterState() {
    try {
        const checkboxes = Array.from(document.querySelectorAll('#filterTeams-tab input[type="checkbox"]'));
        const state = {};
        checkboxes.forEach(cb => { state[cb.value] = cb.checked; });
        localStorage.setItem('mobileFilterState', JSON.stringify(state));

        const dropdown = document.getElementById('filterTeamsDropdownMobile');
        if (dropdown) {
            localStorage.setItem('mobileFilterSortBy', dropdown.value);
        }

        localStorage.setItem('mobileShowHiddenTeams', JSON.stringify(mobileShowHiddenTeamsInFilter));

        console.log('Filter state saved to localStorage');
    } catch (e) {
        console.error('Error saving filter state:', e);
    }
}

function loadMobileFilterState() {
    try {
        const savedState = localStorage.getItem('mobileFilterState');
        if (savedState) {
            const state = JSON.parse(savedState);
            document.querySelectorAll('#filterTeams-tab input[type="checkbox"]').forEach(cb => {
                if (state.hasOwnProperty(cb.value)) {
                    cb.checked = !!state[cb.value];
                } else {
                    cb.checked = false;
                }
            });
            console.log('Loaded filter state from localStorage');
        } else {
            console.log('No saved filter state found, setting all checkboxes to unchecked');
            document.querySelectorAll('#filterTeams-tab input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
        }

        const savedSortBy = localStorage.getItem('mobileFilterSortBy');
        const dropdown = document.getElementById('filterTeamsDropdownMobile');
        if (dropdown && savedSortBy) {
            dropdown.value = savedSortBy;
        }

        const savedShowHidden = localStorage.getItem('mobileShowHiddenTeams');
        if (savedShowHidden) {
            mobileShowHiddenTeamsInFilter = JSON.parse(savedShowHidden);
            const btn = document.getElementById('toggleHiddenTeamsButtonMobile');
            if (btn) {
                btn.textContent = mobileShowHiddenTeamsInFilter ? 'Hide Hidden Teams' : 'Show Hidden Teams';
            }
        }
    } catch (e) {
        console.error('Error loading filter state:', e);
        document.querySelectorAll('#filterTeams-tab input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
    }
}

/*-----MOBILE COMPARISON VIEW FUNCTIONS (VERTICAL PATHS/COMMENTS, HORIZONTAL CHARTS)-----*/

let mobileComparisonData = {
    team1: [],
    team2: []
};

let mobileComparisonCharts = {
    autoClimb1: null,
    autoClimb2: null,
    teleClimb1: null,
    teleClimb2: null,
    autoFuelShot1: null,
    autoFuelShot2: null,
    autoFuelFerried1: null,
    autoFuelFerried2: null,
    teleFuelShot1: null,
    teleFuelShot2: null,
    teleFuelFerried1: null,
    teleFuelFerried2: null,
    weightedTeleFuelShot1: null,
    weightedTeleFuelShot2: null
};

let mobileComparisonSyncEnabled = true;
let scrollSyncEnabled = true;
let isScrolling = false;

function initMobileComparison() {
    console.log('Initializing mobile comparison view');

    const searchBtn = document.getElementById('mobileComparisonSearchBtn');
    const team1Input = document.getElementById('mobileComparisonTeam1');
    const team2Input = document.getElementById('mobileComparisonTeam2');

    if (searchBtn) {
        searchBtn.addEventListener('click', handleMobileComparisonSearch);
    }

    if (team1Input) {
        team1Input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleMobileComparisonSearch();
        });
    }

    if (team2Input) {
        team2Input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleMobileComparisonSearch();
        });
    }

    setupComparisonFilterListeners();
}

function setupScrollSync() {
    // All scrollable containers including Auto Paths and Comments
    const scrollableContainerIds = [
        // Team 1 chart containers
        'mobileCompAutoClimbContainer1',
        'mobileCompAutoFuelShotContainer1',
        'mobileCompAutoFuelFerriedContainer1',
        'mobileCompTeleFuelShotContainer1',
        'mobileCompTeleFuelFerriedContainer1',
        'mobileCompTeleClimbContainer1',
        'mobileCompWeightedTeleFuelContainer1',  // Add this
        // Team 1 Auto Paths and Comments
        'mobileCompAutoPaths1',
        'mobileCompComments1',
        // Team 2 chart containers
        'mobileCompAutoClimbContainer2',
        'mobileCompAutoFuelShotContainer2',
        'mobileCompAutoFuelFerriedContainer2',
        'mobileCompTeleFuelShotContainer2',
        'mobileCompTeleFuelFerriedContainer2',
        'mobileCompTeleClimbContainer2',
        'mobileCompWeightedTeleFuelContainer2',  // Add this
        // Team 2 Auto Paths and Comments
        'mobileCompAutoPaths2',
        'mobileCompComments2'
    ];

    const scrollableContainers = [];

    scrollableContainerIds.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            scrollableContainers.push(container);

            // Remove existing listener and add new one
            container.removeEventListener('scroll', handleScroll);
            container.addEventListener('scroll', handleScroll);
        }
    });

    function handleScroll(event) {
        if (!scrollSyncEnabled || isScrolling) return;

        isScrolling = true;
        const sourceContainer = event.target;
        const scrollLeft = sourceContainer.scrollLeft;

        // Sync all other containers to the same scroll position
        scrollableContainers.forEach(container => {
            if (container !== sourceContainer) {
                container.scrollLeft = scrollLeft;
            }
        });

        isScrolling = false;
    }
}
function handleMobileComparisonSearch() {
    const team1 = document.getElementById('mobileComparisonTeam1')?.value.trim();
    const team2 = document.getElementById('mobileComparisonTeam2')?.value.trim();

    if (!team1 || !team2) {
        alert('Please enter both team numbers');
        return;
    }

    loadMobileComparisonData(team1, team2);
}



function loadMobileComparisonData(team1, team2) {
    const eventCSV = localStorage.getItem('eventScoutingCSV') || '';
    const pitCSV = localStorage.getItem('pitScoutingCSV') || '';
    const oprCSV = localStorage.getItem('oprCSV') || localStorage.getItem('oprCsvText') || '';

    if (!eventCSV) {
        showComparisonError('No event data available. Please upload CSV first.');
        return;
    }

    try {
        const parsed = Papa.parse(eventCSV, { header: true, skipEmptyLines: true });
        const allData = parsed.data || [];

        mobileComparisonData.team1 = allData.filter(row =>
            row['Team Number']?.toString().trim() === team1
        );

        mobileComparisonData.team2 = allData.filter(row =>
            row['Team Number']?.toString().trim() === team2
        );

        let pitData = [];
        if (pitCSV) {
            const pitParsed = Papa.parse(pitCSV, { header: true, skipEmptyLines: true });
            pitData = pitParsed.data || [];
        }

        resetComparisonFilters();

        renderComparisonTeamStats(team1, team2, pitData, oprCSV);
        renderComparisonAutoPaths(1);
        renderComparisonAutoPaths(2);
        renderComparisonAutoClimb(1);
        renderComparisonAutoClimb(2);
        renderComparisonTeleClimb(1);
        renderComparisonTeleClimb(2);
        renderComparisonFuelCharts();
        renderComparisonComments(1);
        renderComparisonComments(2);
        renderComparisonWeightedTeleFuelGraphs();


        // Setup scroll sync after rendering all chart containers
        setTimeout(setupScrollSync, 100);

    } catch (e) {
        console.error('Error loading comparison data:', e);
        showComparisonError('Error loading data');
    }
}

function renderComparisonWeightedTeleFuelGraph(column, yAxisMax = null) {
    const canvas = document.getElementById(`mobileCompWeightedTeleFuelChart${column}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chartKey = `weightedTeleFuel${column}`;

    if (mobileComparisonCharts[chartKey]) {
        mobileComparisonCharts[chartKey].destroy();
        mobileComparisonCharts[chartKey] = null;
    }

    const teamData = column === 1 ? mobileComparisonData.team1 : mobileComparisonData.team2;

    if (!teamData || teamData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No tele fuel data', canvas.width / 2, canvas.height / 2);
        document.getElementById(`mobileCompWeightedTeleFuel${column}`).textContent = '0.00';
        return;
    }

    // Sort data by match number
    const sortedData = [...teamData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const teleFuelValues = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const teleFuel = parseFloat(row['Tele Fuel Shot'] || 0);
        if (isNaN(teleFuel)) return;

        matches.push(`Q${matchNum}`);
        teleFuelValues.push(teleFuel);
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No tele fuel data', canvas.width / 2, canvas.height / 2);
        document.getElementById(`mobileCompWeightedTeleFuel${column}`).textContent = '0.00';
        return;
    }

    // Calculate weighted tele fuel for this team
    const weightedTeleFuel = (() => {
        const teleFuelWithMatches = sortedData.map(row => {
            const matchNum = parseInt(row['Match'] || row['Match Number'] || 0);
            const teleFuel = parseFloat(row['Tele Fuel Shot'] || 0);
            return { match: matchNum, value: teleFuel };
        }).filter(item => !isNaN(item.value) && item.match > 0);

        if (teleFuelWithMatches.length === 0) return 0;

        let totalWeightedValue = 0;
        let totalWeight = 0;

        teleFuelWithMatches.forEach(item => {
            let weight;
            if (item.match <= 2) {
                weight = 0.5;
            } else if (item.match <= 6) {
                weight = 1.0;
            } else if (item.match <= 8) {
                weight = 1.5;
            } else {
                weight = 2.0;
            }

            totalWeightedValue += item.value * weight;
            totalWeight += weight;
        });

        return totalWeight > 0 ? totalWeightedValue / totalWeight : 0;
    })();

    // Update the weighted tele fuel display
    document.getElementById(`mobileCompWeightedTeleFuel${column}`).textContent = weightedTeleFuel.toFixed(2);

    // Calculate dynamic width based on number of matches
    const matchesCount = matches.length;
    const pointWidth = 80;
    const minWidth = Math.max(300, matchesCount * pointWidth);

    // Get or create scrollable container
    const containerId = `mobileCompWeightedTeleFuelContainer${column}`;
    let container = document.getElementById(containerId);
    const parent = canvas.parentNode;

    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = `
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            position: relative;
            padding-bottom: 10px;
        `;

        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = `
            width: ${minWidth}px;
            height: 200px;
            position: relative;
        `;

        parent.innerHTML = '';
        canvasContainer.appendChild(canvas);
        container.appendChild(canvasContainer);
        parent.appendChild(container);
    } else {
        const canvasContainer = container.firstChild;
        if (canvasContainer) {
            canvasContainer.style.width = `${minWidth}px`;
        }
    }

    // Create datasets
    const datasets = [
        {
            label: 'Tele Fuel Scored',
            data: teleFuelValues,
            borderColor: '#3EDBF0',
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0,
            pointBackgroundColor: '#3EDBF0',
            pointBorderColor: '#fff',
            pointBorderWidth: 1,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: false
        }
    ];

    // Add weighted average line if there's data
    if (weightedTeleFuel > 0) {
        const weightedLineData = Array(matches.length).fill(weightedTeleFuel);
        datasets.push({
            label: 'Weighted Tele Fuel',
            data: weightedLineData,
            borderColor: '#FFD700',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 3],
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false
        });
    }

    // Use provided yAxisMax or calculate from data
    const finalYAxisMax = yAxisMax !== null ? yAxisMax : (Math.ceil(Math.max(...teleFuelValues) / 5) * 5 || 25);

    mobileComparisonCharts[chartKey] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: matches,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1C1E21',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#000',
                    borderWidth: 1,
                    padding: 6,
                    titleFont: {
                        size: 11,
                        weight: 'bold',
                        family: 'Lato'
                    },
                    bodyFont: {
                        size: 14,
                        family: 'Lato'
                    },
                    callbacks: {
                        label: function (context) {
                            if (context.datasetIndex === 0) {
                                return `Tele Fuel: ${context.raw}`;
                            } else {
                                return `Weighted Avg: ${context.raw.toFixed(2)}`;
                            }
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            },
            scales: {
                x: {
                    position: 'bottom',
                    grid: {
                        display: false,
                        drawBorder: false,
                        drawOnChartArea: false,
                        drawTicks: false
                    },
                    ticks: {
                        color: 'white',
                        font: {
                            size: 13,
                            weight: 'bold',
                            family: 'Lato'
                        },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false,
                        maxTicksLimit: matches.length,
                        source: 'data',
                        callback: function(val, index) {
                            // Return the label as-is (already in Q## format)
                            return this.getLabelForValue(val);
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    max: finalYAxisMax,
                    grid: {
                        display: false,
                        drawBorder: false,
                        drawOnChartArea: false,
                        drawTicks: false
                    },
                    ticks: {
                        color: 'white',
                        maxTicksLimit: 5,
                        font: {
                            family: 'Lato',
                            size: 13,
                            weight: 'bold'
                        },
                        stepSize: 5,
                        callback: function (value) {
                            return Math.round(value);
                        },
                        padding: 3
                    }
                }
            },
            layout: {
                padding: {
                    bottom: 40,
                    top: 15,
                    left: 2,
                    right: 2
                }
            }
        }
    });
}

function getGlobalMaxTeleFuelComparison() {
    let maxFuel = 0;

    const processTeam = (teamData) => {
        if (!teamData) return;
        teamData.forEach(row => {
            const teleFuel = parseFloat(row['Tele Fuel Shot'] || 0);
            if (!isNaN(teleFuel)) {
                maxFuel = Math.max(maxFuel, teleFuel);
            }
        });
    };

    processTeam(mobileComparisonData.team1);
    processTeam(mobileComparisonData.team2);

    return maxFuel;
}

function renderComparisonWeightedTeleFuelGraphs() {
    const globalMax = getGlobalMaxTeleFuelComparison();
    const yAxisMax = Math.ceil(globalMax / 5) * 5 || 25; // Round up to nearest 5, default to 25

    // Render both graphs with the same y-axis max
    renderComparisonWeightedTeleFuelGraph(1, yAxisMax);
    renderComparisonWeightedTeleFuelGraph(2, yAxisMax);
}
function renderComparisonTeamStats(team1, team2, pitData, oprCSV) {
    let oprMap = {};
    if (oprCSV) {
        const parsed = Papa.parse(oprCSV, { header: true, skipEmptyLines: true });
        parsed.data.forEach(row => {
            const team = row['Team Number']?.toString().trim();
            if (team) {
                oprMap[team] = {
                    total: parseFloat((row['Total OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0
                };
            }
        });
    }

    renderSingleTeamStats(1, team1, mobileComparisonData.team1, pitData, oprMap);
    renderSingleTeamStats(2, team2, mobileComparisonData.team2, pitData, oprMap);
}

function renderSingleTeamStats(column, teamNumber, teamData, pitData, oprMap) {
    const pitTeam = pitData.find(row => row['Team Number']?.toString().trim() === teamNumber);

    document.getElementById(`mobileCompTrench${column}`).textContent =
        pitTeam && (pitTeam['Trench'] === '1' || pitTeam['Trench'] === 1 || pitTeam['Trench'] === true) ? '✅' : '❌';
    document.getElementById(`mobileCompGroundIntake${column}`).textContent =
        pitTeam && (pitTeam['Ground Intake'] === '1' || pitTeam['Ground Intake'] === 1 || pitTeam['Ground Intake'] === true) ? '✅' : '❌';
    document.getElementById(`mobileCompShootOnFly${column}`).textContent =
        pitTeam && (pitTeam['Shoot on Fly'] === '1' || pitTeam['Shoot on Fly'] === 1 || pitTeam['Shoot on Fly'] === true) ? '✅' : '❌';

    // Calculate Average Shot
    const autoFuelShots = teamData.map(row => parseFloat(row['Auto Fuel Shot'] || 0)).filter(v => !isNaN(v));
    const teleFuelShots = teamData.map(row => parseFloat(row['Tele Fuel Shot'] || 0)).filter(v => !isNaN(v));
    const allShots = [...autoFuelShots, ...teleFuelShots];
    const avgShot = allShots.length > 0 ? allShots.reduce((a, b) => a + b, 0) / allShots.length : 0;
    document.getElementById(`mobileCompAvgShot${column}`).textContent = avgShot.toFixed(2);

    // Calculate Average Ferried
    const autoFuelFerried = teamData.map(row => parseFloat(row['Auto Fuel Ferried'] || 0)).filter(v => !isNaN(v));
    const teleFuelFerried = teamData.map(row => parseFloat(row['Tele Fuel Ferried'] || 0)).filter(v => !isNaN(v));
    const allFerried = [...autoFuelFerried, ...teleFuelFerried];
    const avgFerried = allFerried.length > 0 ? allFerried.reduce((a, b) => a + b, 0) / allFerried.length : 0;
    document.getElementById(`mobileCompAvgFerried${column}`).textContent = avgFerried.toFixed(2);

    // Calculate EPA
    const totalPoints = teamData.map(row => parseFloat(row['Total Points'] || row['Total Score'] || 0)).filter(v => !isNaN(v));
    const epa = totalPoints.length > 0 ? totalPoints.reduce((a, b) => a + b, 0) / totalPoints.length : 0;
    document.getElementById(`mobileCompEPA${column}`).textContent = epa.toFixed(2);

    // Shooting Accuracy
    const accuracyVals = teamData
        .map(row => parseFloat(row['Shooting Accuracy']))
        .filter(v => !isNaN(v));
    const shootingAcc = accuracyVals.length > 0
        ? (accuracyVals.reduce((a, b) => a + b, 0) / accuracyVals.length).toFixed(2)
        : '0.00';
    document.getElementById(`mobileCompShootingAcc${column}`).textContent = shootingAcc;

    // Climb Success %
    const climbValues = teamData.map(row => row['Climb Teleop']?.toString().trim()).filter(v => v && v !== '');
    const successfulClimbs = climbValues.filter(v => ['1', '2', '3'].includes(v)).length;
    const totalClimbAttempts = climbValues.filter(v => ['1', '2', '3', 'F'].includes(v)).length;
    const climbRate = totalClimbAttempts > 0 ? ((successfulClimbs / totalClimbAttempts) * 100).toFixed(1) : "0.0";
    document.getElementById(`mobileCompClimbRate${column}`).textContent = climbRate + '%';

    // Robot Died %
    const diedCount = teamData.filter(row => {
        const val = parseFloat(row['Robot Died'] || row['Died or Immobilized'] || 0);
        return val === 0.5 || val === 1;
    }).length;
    const diedRate = teamData.length ? ((diedCount / teamData.length) * 100).toFixed(1) : '0.0';
    document.getElementById(`mobileCompDiedRate${column}`).textContent = diedRate + '%';
}

function renderComparisonFuelCharts() {
    // Get max values for each chart type to synchronize y-axes
    const getMaxValues = () => {
        const maxValues = {
            autoFuelShot: 0,
            autoFuelFerried: 0,
            teleFuelShot: 0,
            teleFuelFerried: 0
        };

        [mobileComparisonData.team1, mobileComparisonData.team2].forEach(teamData => {
            teamData.forEach(row => {
                maxValues.autoFuelShot = Math.max(maxValues.autoFuelShot, parseFloat(row['Auto Fuel Shot'] || 0));
                maxValues.autoFuelFerried = Math.max(maxValues.autoFuelFerried, parseFloat(row['Auto Fuel Ferried'] || 0));
                maxValues.teleFuelShot = Math.max(maxValues.teleFuelShot, parseFloat(row['Tele Fuel Shot'] || 0));
                maxValues.teleFuelFerried = Math.max(maxValues.teleFuelFerried, parseFloat(row['Tele Fuel Ferried'] || 0));
            });
        });

        // Round up to nearest multiple of 3
        Object.keys(maxValues).forEach(key => {
            maxValues[key] = Math.ceil(maxValues[key] / 3) * 3 || 27;
        });

        return maxValues;
    };

    const maxValues = getMaxValues();

    // Render all fuel charts with synchronized y-axes
    renderComparisonAutoFuelShot(1, maxValues.autoFuelShot);
    renderComparisonAutoFuelShot(2, maxValues.autoFuelShot);
    renderComparisonAutoFuelFerried(1, maxValues.autoFuelFerried);
    renderComparisonAutoFuelFerried(2, maxValues.autoFuelFerried);
    renderComparisonTeleFuelShot(1, maxValues.teleFuelShot);
    renderComparisonTeleFuelShot(2, maxValues.teleFuelShot);
    renderComparisonTeleFuelFerried(1, maxValues.teleFuelFerried);
    renderComparisonTeleFuelFerried(2, maxValues.teleFuelFerried);
}

function renderComparisonAutoFuelShot(column, maxYValue) {
    const canvas = document.getElementById(`mobileCompAutoFuelShotChart${column}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chartKey = `autoFuelShot${column}`;

    if (mobileComparisonCharts[chartKey]) {
        mobileComparisonCharts[chartKey].destroy();
        mobileComparisonCharts[chartKey] = null;
    }

    const teamData = column === 1 ? mobileComparisonData.team1 : mobileComparisonData.team2;
    const filter = document.getElementById(`mobileCompAutoFuelShotFilter${column}`)?.value || 'all';

    let filteredData = teamData;
    if (filter !== 'all') {
        filteredData = teamData.filter(row => row['Starting Position']?.toString().trim() === filter);
    }

    if (!filteredData || filteredData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const sortedData = [...filteredData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const values = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const val = parseFloat(row['Auto Fuel Shot'] || 0);
        if (isNaN(val)) return;

        matches.push(`Q${matchNum}`);
        values.push(val);
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Calculate dynamic width based on number of matches
    const matchesCount = matches.length;
    const barWidth = 60;
    const minWidth = Math.max(400, matchesCount * barWidth);

    // Get or create scrollable container
    const containerId = `mobileCompAutoFuelShotContainer${column}`;
    let container = document.getElementById(containerId);
    const parent = canvas.parentNode;

    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = `
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            position: relative;
            padding-bottom: 10px;
        `;

        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = `
            width: ${minWidth}px;
            height: 200px;
            position: relative;
        `;

        parent.innerHTML = '';
        canvasContainer.appendChild(canvas);
        container.appendChild(canvasContainer);
        parent.appendChild(container);
    } else {
        const canvasContainer = container.firstChild;
        if (canvasContainer) {
            canvasContainer.style.width = `${minWidth}px`;
        }
    }

    mobileComparisonCharts[chartKey] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matches,
            datasets: [{
                data: values,
                backgroundColor: '#3edbf0',
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: (context) => context[0]?.label || '',
                        label: (context) => [`Fuel Shots: ${context.raw}`]
                    }
                },
                datalabels: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white',
                        font: { size: 12, weight: 'bold', family: 'Lato' },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false,
                        maxTicksLimit: matches.length
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: maxYValue,
                    ticks: {
                        color: 'white',
                        maxTicksLimit: 5,
                        font: { size: 12, weight: 'bold', family: 'Lato' },
                        callback: (value) => Math.round(value)
                    },
                    grid: { display: false }
                }
            },
            layout: {
                padding: { bottom: 30, left: 10, right: 10 }
            }
        }
    });
}

function renderComparisonAutoFuelFerried(column, maxYValue) {
    const canvas = document.getElementById(`mobileCompAutoFuelFerriedChart${column}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chartKey = `autoFuelFerried${column}`;

    if (mobileComparisonCharts[chartKey]) {
        mobileComparisonCharts[chartKey].destroy();
        mobileComparisonCharts[chartKey] = null;
    }

    const teamData = column === 1 ? mobileComparisonData.team1 : mobileComparisonData.team2;
    const filter = document.getElementById(`mobileCompAutoFuelFerriedFilter${column}`)?.value || 'all';

    let filteredData = teamData;
    if (filter !== 'all') {
        filteredData = teamData.filter(row => row['Starting Position']?.toString().trim() === filter);
    }

    if (!filteredData || filteredData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const sortedData = [...filteredData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const values = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const val = parseFloat(row['Auto Fuel Ferried'] || 0);
        if (isNaN(val)) return;

        matches.push(`Q${matchNum}`);
        values.push(val);
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Calculate dynamic width based on number of matches
    const matchesCount = matches.length;
    const barWidth = 60;
    const minWidth = Math.max(400, matchesCount * barWidth);

    // Get or create scrollable container
    const containerId = `mobileCompAutoFuelFerriedContainer${column}`;
    let container = document.getElementById(containerId);
    const parent = canvas.parentNode;

    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = `
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            position: relative;
            padding-bottom: 10px;
        `;

        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = `
            width: ${minWidth}px;
            height: 200px;
            position: relative;
        `;

        parent.innerHTML = '';
        canvasContainer.appendChild(canvas);
        container.appendChild(canvasContainer);
        parent.appendChild(container);
    } else {
        const canvasContainer = container.firstChild;
        if (canvasContainer) {
            canvasContainer.style.width = `${minWidth}px`;
        }
    }

    mobileComparisonCharts[chartKey] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matches,
            datasets: [{
                data: values,
                backgroundColor: 'rgb(0, 184, 148)',
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: (context) => context[0]?.label || '',
                        label: (context) => [`Fuel Ferried: ${context.raw}`]
                    }
                },
                datalabels: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white',
                        font: { size: 12, weight: 'bold', family: 'Lato' },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false,
                        maxTicksLimit: matches.length
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: maxYValue,
                    ticks: {
                        color: 'white',
                        maxTicksLimit: 5,
                        font: { size: 12, weight: 'bold', family: 'Lato' },
                        callback: (value) => Math.round(value)
                    },
                    grid: { display: false }
                }
            },
            layout: {
                padding: { bottom: 30, left: 10, right: 10 }
            }
        }
    });
}

function renderComparisonTeleFuelShot(column, maxYValue) {
    const canvas = document.getElementById(`mobileCompTeleFuelShotChart${column}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chartKey = `teleFuelShot${column}`;

    if (mobileComparisonCharts[chartKey]) {
        mobileComparisonCharts[chartKey].destroy();
        mobileComparisonCharts[chartKey] = null;
    }

    const teamData = column === 1 ? mobileComparisonData.team1 : mobileComparisonData.team2;

    if (!teamData || teamData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const sortedData = [...teamData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const values = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const val = parseFloat(row['Tele Fuel Shot'] || 0);
        if (isNaN(val)) return;

        matches.push(`Q${matchNum}`);
        values.push(val);
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Calculate dynamic width based on number of matches
    const matchesCount = matches.length;
    const barWidth = 60;
    const minWidth = Math.max(400, matchesCount * barWidth);

    // Get or create scrollable container
    const containerId = `mobileCompTeleFuelShotContainer${column}`;
    let container = document.getElementById(containerId);
    const parent = canvas.parentNode;

    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = `
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            position: relative;
            padding-bottom: 10px;
        `;

        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = `
            width: ${minWidth}px;
            height: 200px;
            position: relative;
        `;

        parent.innerHTML = '';
        canvasContainer.appendChild(canvas);
        container.appendChild(canvasContainer);
        parent.appendChild(container);
    } else {
        const canvasContainer = container.firstChild;
        if (canvasContainer) {
            canvasContainer.style.width = `${minWidth}px`;
        }
    }

    mobileComparisonCharts[chartKey] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matches,
            datasets: [{
                data: values,
                backgroundColor: '#3EDBF0',
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: (context) => context[0]?.label || '',
                        label: (context) => [`Fuel Shots: ${context.raw}`]
                    }
                },
                datalabels: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white',
                        font: { size: 12, weight: 'bold', family: 'Lato' },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false,
                        maxTicksLimit: matches.length
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: maxYValue,
                    ticks: {
                        color: 'white',
                        maxTicksLimit: 5,
                        font: { size: 12, weight: 'bold', family: 'Lato' },
                        callback: (value) => Math.round(value)
                    },
                    grid: { display: false }
                }
            },
            layout: {
                padding: { bottom: 30, left: 10, right: 10 }
            }
        }
    });
}

function renderComparisonTeleFuelFerried(column, maxYValue) {
    const canvas = document.getElementById(`mobileCompTeleFuelFerriedChart${column}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chartKey = `teleFuelFerried${column}`;

    if (mobileComparisonCharts[chartKey]) {
        mobileComparisonCharts[chartKey].destroy();
        mobileComparisonCharts[chartKey] = null;
    }

    const teamData = column === 1 ? mobileComparisonData.team1 : mobileComparisonData.team2;

    if (!teamData || teamData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const sortedData = [...teamData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const values = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const val = parseFloat(row['Tele Fuel Ferried'] || 0);
        if (isNaN(val)) return;

        matches.push(`Q${matchNum}`);
        values.push(val);
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Calculate dynamic width based on number of matches
    const matchesCount = matches.length;
    const barWidth = 60;
    const minWidth = Math.max(400, matchesCount * barWidth);

    // Get or create scrollable container
    const containerId = `mobileCompTeleFuelFerriedContainer${column}`;
    let container = document.getElementById(containerId);
    const parent = canvas.parentNode;

    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = `
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            position: relative;
            padding-bottom: 10px;
        `;

        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = `
            width: ${minWidth}px;
            height: 200px;
            position: relative;
        `;

        parent.innerHTML = '';
        canvasContainer.appendChild(canvas);
        container.appendChild(canvasContainer);
        parent.appendChild(container);
    } else {
        const canvasContainer = container.firstChild;
        if (canvasContainer) {
            canvasContainer.style.width = `${minWidth}px`;
        }
    }

    mobileComparisonCharts[chartKey] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matches,
            datasets: [{
                data: values,
                backgroundColor: 'rgb(0, 184, 148)',
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: (context) => context[0]?.label || '',
                        label: (context) => [`Fuel Ferried: ${context.raw}`]
                    }
                },
                datalabels: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white',
                        font: { size: 12, weight: 'bold', family: 'Lato' },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false,
                        maxTicksLimit: matches.length
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: maxYValue,
                    ticks: {
                        color: 'white',
                        maxTicksLimit: 5,
                        font: { size: 12, weight: 'bold', family: 'Lato' },
                        callback: (value) => Math.round(value)
                    },
                    grid: { display: false }
                }
            },
            layout: {
                padding: { bottom: 30, left: 10, right: 10 }
            }
        }
    });
}

function setupComparisonFilterListeners() {
    // Array of all auto filter IDs for both teams
    const allAutoFilterIds = [
        'mobileCompAutoPathFilter1', 'mobileCompAutoPathFilter2',
        'mobileCompAutoClimbFilter1', 'mobileCompAutoClimbFilter2',
        'mobileCompAutoFuelShotFilter1', 'mobileCompAutoFuelShotFilter2',
        'mobileCompAutoFuelFerriedFilter1', 'mobileCompAutoFuelFerriedFilter2'
    ];

    // Setup listeners for all auto filters
    allAutoFilterIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.removeEventListener('change', handleComparisonAutoFilterChange);
            element.addEventListener('change', handleComparisonAutoFilterChange);
        }
    });

    // Setup listeners for tele climb filters
    for (let i = 1; i <= 2; i++) {
        const teleClimb = document.getElementById(`mobileCompTeleClimbFilter${i}`);
        if (teleClimb) {
            teleClimb.removeEventListener('change', () => handleComparisonTeleFilterChange(i));
            teleClimb.addEventListener('change', () => handleComparisonTeleFilterChange(i));
        }
    }
}

function handleComparisonAutoFilterChange(event) {
    if (!mobileComparisonSyncEnabled) return;

    const changedFilter = event.target;
    const newValue = changedFilter.value;

    // Array of all auto filter IDs for both teams
    const allAutoFilterIds = [
        'mobileCompAutoPathFilter1', 'mobileCompAutoPathFilter2',
        'mobileCompAutoClimbFilter1', 'mobileCompAutoClimbFilter2',
        'mobileCompAutoFuelShotFilter1', 'mobileCompAutoFuelShotFilter2',
        'mobileCompAutoFuelFerriedFilter1', 'mobileCompAutoFuelFerriedFilter2'
    ];

    // Update all auto filters to the new value
    allAutoFilterIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = newValue;
        }
    });

    // Refresh all auto-related displays for both teams
    renderComparisonAutoPaths(1);
    renderComparisonAutoPaths(2);
    renderComparisonAutoClimb(1);
    renderComparisonAutoClimb(2);
    renderComparisonFuelCharts(); // This will refresh all fuel charts with new filter

    // Re-setup scroll sync after charts are re-rendered
    setTimeout(setupScrollSync, 100);
}

function handleComparisonTeleFilterChange(sourceColumn) {
    if (!mobileComparisonSyncEnabled) return;

    const sourceValue = document.getElementById(`mobileCompTeleClimbFilter${sourceColumn}`).value;
    const otherColumn = sourceColumn === 1 ? 2 : 1;
    const otherFilter = document.getElementById(`mobileCompTeleClimbFilter${otherColumn}`);

    if (otherFilter) {
        otherFilter.value = sourceValue;
    }

    renderComparisonTeleClimb(1);
    renderComparisonTeleClimb(2);

    // Re-setup scroll sync after charts are re-rendered
    setTimeout(setupScrollSync, 100);
}

function resetComparisonFilters() {
    const allFilterIds = [
        'mobileCompAutoPathFilter1', 'mobileCompAutoPathFilter2',
        'mobileCompAutoClimbFilter1', 'mobileCompAutoClimbFilter2',
        'mobileCompAutoFuelShotFilter1', 'mobileCompAutoFuelShotFilter2',
        'mobileCompAutoFuelFerriedFilter1', 'mobileCompAutoFuelFerriedFilter2',
        'mobileCompTeleClimbFilter1', 'mobileCompTeleClimbFilter2'
    ];

    allFilterIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 'all';
    });
}

function renderComparisonAutoPaths(column) {
    const container = document.getElementById(`mobileCompAutoPaths${column}`);
    if (!container) return;

    const teamData = column === 1 ? mobileComparisonData.team1 : mobileComparisonData.team2;
    const filter = document.getElementById(`mobileCompAutoPathFilter${column}`)?.value || 'all';

    let filteredData = teamData;
    if (filter !== 'all') {
        filteredData = teamData.filter(row => row['Starting Position']?.toString().trim() === filter);
    }

    if (filteredData.length === 0) {
        container.innerHTML = '<p class="no-data-message" style="color: #aaa; text-align: center; padding: 20px;">No auto path data available</p>';
        container.style.overflowX = 'hidden';
        container.style.overflowY = 'auto';
        return;
    }

    const sortedData = [...filteredData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    // Make vertically scrollable
    container.style.overflowY = 'auto';
    container.style.overflowX = 'hidden';
    container.style.maxHeight = '300px';
    container.style.whiteSpace = 'normal';

    let html = '';

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const travelString = row['Travel String']?.toString().trim() || '';
        const fuelString = row['Fuel Collection String']?.toString().trim() || '';

        const hasTravel = travelString && travelString !== '' && travelString !== '-';
        const hasFuel = fuelString && fuelString !== '' && fuelString !== '-';

        if (!hasTravel && !hasFuel) {
            html += `<div class="path-entry" style="padding: 8px 0; border-bottom: 1px solid #333;">
                       <span class="match-number" style="color: white; font-weight: bold; margin-right: 8px;">Q${matchNum}:</span> 
                       <span style="color: white;">N/A</span>
                   </div>`;
            return;
        }

        let sentence = '';
        if (travelString && fuelString) {
            sentence = travelString + ' and ' + fuelString;
        } else if (travelString) {
            sentence = travelString;
        } else if (fuelString) {
            sentence = fuelString;
        }

        if (sentence) {
            sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
            if (!sentence.endsWith('.')) sentence += '.';
            html += `<div class="path-entry" style="padding: 8px 0; border-bottom: 1px solid #333;">
                       <span class="match-number" style="color: white; font-weight: bold; margin-right: 8px;">Q${matchNum}:</span> 
                       <span style="color: white;">${escapeHtml(sentence)}</span>
                   </div>`;
        }
    });

    container.innerHTML = html || '<p class="no-data-message" style="color: #aaa; text-align: center; padding: 20px;">No auto path data available</p>';
}
function renderComparisonAutoClimb(column) {
    const canvas = document.getElementById(`mobileCompAutoClimbChart${column}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chartKey = `autoClimb${column}`;

    if (mobileComparisonCharts[chartKey]) {
        mobileComparisonCharts[chartKey].destroy();
        mobileComparisonCharts[chartKey] = null;
    }

    const teamData = column === 1 ? mobileComparisonData.team1 : mobileComparisonData.team2;
    const filter = document.getElementById(`mobileCompAutoClimbFilter${column}`)?.value || 'all';

    let filteredData = teamData;
    if (filter !== 'all') {
        filteredData = teamData.filter(row => row['Starting Position']?.toString().trim() === filter);
    }

    if (filteredData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const sortedData = [...filteredData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const climbValues = [];
    const barColors = [];
    const tooltipLabels = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const climbAuto = row['Climb Auto']?.toString().trim();
        if (!climbAuto || climbAuto === '') return;

        matches.push(`Q${matchNum}`);

        if (climbAuto === '1') {
            climbValues.push(1);
            barColors.push('#3EDBF0');
            tooltipLabels.push('Level 1');
        } else if (climbAuto === 'F') {
            climbValues.push(0.5);
            barColors.push('#ff5c5c');
            tooltipLabels.push('Failed');
        } else {
            climbValues.push(0);
            barColors.push('#3EDBF0');
            tooltipLabels.push('Not Attempted');
        }
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Calculate dynamic width based on number of matches
    const matchesCount = matches.length;
    const barWidth = 70;
    const minWidth = Math.max(400, matchesCount * barWidth);

    // Get or create scrollable container
    const containerId = `mobileCompAutoClimbContainer${column}`;
    let container = document.getElementById(containerId);
    const parent = canvas.parentNode;

    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = `
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            position: relative;
            padding-bottom: 10px;
        `;

        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = `
            width: ${minWidth}px;
            height: 200px;
            position: relative;
        `;

        parent.innerHTML = '';
        canvasContainer.appendChild(canvas);
        container.appendChild(canvasContainer);
        parent.appendChild(container);
    } else {
        const canvasContainer = container.firstChild;
        if (canvasContainer) {
            canvasContainer.style.width = `${minWidth}px`;
            canvasContainer.style.height = '200px';
        }
    }

    mobileComparisonCharts[chartKey] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matches,
            datasets: [{
                data: climbValues,
                backgroundColor: barColors,
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.6,
                categoryPercentage: 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: (context) => context[0]?.label || '',
                        label: (context) => {
                            const idx = context.dataIndex;
                            return [`Climb: ${tooltipLabels[idx]}`];
                        }
                    }
                },
                datalabels: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white',
                        font: { size: 12, weight: 'bold', family: 'Lato' },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false,
                        maxTicksLimit: matches.length
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        color: 'white',
                        stepSize: 1,
                        font: { size: 12, weight: 'bold', family: 'Lato' },
                        callback: (value) => value === 1 ? '1' : value === 0.5 ? '0.5' : '0'
                    },
                    grid: { display: false }
                }
            },
            layout: {
                padding: { bottom: 30, left: 10, right: 10 }
            }
        }
    });
}

function renderComparisonTeleClimb(column) {
    const canvas = document.getElementById(`mobileCompTeleClimbChart${column}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chartKey = `teleClimb${column}`;

    if (mobileComparisonCharts[chartKey]) {
        mobileComparisonCharts[chartKey].destroy();
        mobileComparisonCharts[chartKey] = null;
    }

    const teamData = column === 1 ? mobileComparisonData.team1 : mobileComparisonData.team2;
    const filter = document.getElementById(`mobileCompTeleClimbFilter${column}`)?.value || 'all';

    let filteredData = teamData;
    if (filter !== 'all') {
        filteredData = teamData.filter(row => row['Starting Position']?.toString().trim() === filter);
    }

    if (filteredData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const sortedData = [...filteredData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    const matches = [];
    const climbValues = [];
    const barColors = [];
    const tooltipData = [];

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        if (!matchNum) return;

        const climbTeleop = row['Climb Teleop']?.toString().trim();
        if (!climbTeleop || climbTeleop === '') return;

        matches.push(`Q${matchNum}`);

        const climbTime = parseFloat(row['Climb Time'] || row['Climb Time per Level'] || 0);
        const formattedClimbTime = !isNaN(climbTime) && climbTime > 0 ? climbTime.toFixed(1) + 's' : 'N/A';

        if (climbTeleop === '3') {
            climbValues.push(3);
            barColors.push('#3EDBF0');
            tooltipData.push({ level: 'Level 3', time: formattedClimbTime });
        } else if (climbTeleop === '2') {
            climbValues.push(2);
            barColors.push('#3EDBF0');
            tooltipData.push({ level: 'Level 2', time: formattedClimbTime });
        } else if (climbTeleop === '1') {
            climbValues.push(1);
            barColors.push('#3EDBF0');
            tooltipData.push({ level: 'Level 1', time: formattedClimbTime });
        } else if (climbTeleop === 'F') {
            climbValues.push(0.5);
            barColors.push('#ff5c5c');
            tooltipData.push({ level: 'Failed', time: 'N/A' });
        } else {
            climbValues.push(0);
            barColors.push('#3EDBF0');
            tooltipData.push({ level: 'Not Attempted', time: 'N/A' });
        }
    });

    if (matches.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px Lato';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Calculate dynamic width based on number of matches
    const matchesCount = matches.length;
    const barWidth = 70;
    const minWidth = Math.max(400, matchesCount * barWidth);

    // Get or create scrollable container
    const containerId = `mobileCompTeleClimbContainer${column}`;
    let container = document.getElementById(containerId);
    const parent = canvas.parentNode;

    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = `
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            position: relative;
            padding-bottom: 10px;
        `;

        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = `
            width: ${minWidth}px;
            height: 250px;
            position: relative;
        `;

        parent.innerHTML = '';
        canvasContainer.appendChild(canvas);
        container.appendChild(canvasContainer);
        parent.appendChild(container);
    } else {
        const canvasContainer = container.firstChild;
        if (canvasContainer) {
            canvasContainer.style.width = `${minWidth}px`;
            canvasContainer.style.height = '250px';
        }
    }

    mobileComparisonCharts[chartKey] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matches,
            datasets: [{
                data: climbValues,
                backgroundColor: barColors,
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.6,
                categoryPercentage: 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: (context) => context[0]?.label || '',
                        label: (context) => {
                            const idx = context.dataIndex;
                            const data = tooltipData[idx];
                            return data ? [`Level: ${data.level}`, `Time: ${data.time}`] : [];
                        }
                    }
                },
                datalabels: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white',
                        font: { size: 12, weight: 'bold', family: 'Lato' },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false,
                        maxTicksLimit: matches.length
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: 3,
                    ticks: {
                        color: 'white',
                        stepSize: 1,
                        font: { size: 12, weight: 'bold', family: 'Lato' },
                        callback: (value) => value === 1 ? '1' : value === 2 ? '2' : value === 3 ? '3' : ''
                    },
                    grid: { display: false }
                }
            },
            layout: {
                padding: { bottom: 30, left: 10, right: 10 }
            }
        }
    });
}

function renderComparisonComments(column) {
    const container = document.getElementById(`mobileCompComments${column}`);
    if (!container) return;

    const teamData = column === 1 ? mobileComparisonData.team1 : mobileComparisonData.team2;

    if (teamData.length === 0) {
        container.innerHTML = '<p class="no-data-message" style="color: #aaa; text-align: center; padding: 20px;">No comments available</p>';
        container.style.overflowX = 'hidden';
        container.style.overflowY = 'auto';
        return;
    }

    const sortedData = [...teamData].sort((a, b) => {
        const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
        const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
        return matchA - matchB;
    });

    // Make vertically scrollable
    container.style.overflowY = 'auto';
    container.style.overflowX = 'hidden';
    container.style.maxHeight = '300px';
    container.style.whiteSpace = 'normal';

    let html = '';

    sortedData.forEach(row => {
        const matchNum = row['Match'] || row['Match Number'];
        const comment = (row['Comments'] || '').toString().trim();

        if (comment && comment !== '' && comment !== 'N/A' && comment !== 'NA' && comment !== 'none') {
            html += `<div class="comment-entry" style="padding: 8px 0; border-bottom: 1px solid #333;">
                       <span class="match-number" style="color: white; font-weight: bold; margin-right: 8px;">Q${matchNum}:</span> 
                       <span style="color: white;">${escapeHtml(comment)}</span>
                   </div>`;
        }
    });

    container.innerHTML = html || '<p class="no-data-message" style="color: #aaa; text-align: center; padding: 20px;">No scouter comments available</p>';
}

function showComparisonError(message) {
    for (let i = 1; i <= 2; i++) {
        const containers = [
            `mobileCompAutoPaths${i}`,
            `mobileCompComments${i}`
        ];

        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = `<p class="no-data-message" style="color: #aaa; text-align: center; padding: 20px;">${message}</p>`;
            }
        });

        document.getElementById(`mobileCompTrench${i}`).textContent = '❌';
        document.getElementById(`mobileCompGroundIntake${i}`).textContent = '❌';
        document.getElementById(`mobileCompShootOnFly${i}`).textContent = '❌';
        document.getElementById(`mobileCompAvgShot${i}`).textContent = '0.00';
        document.getElementById(`mobileCompAvgFerried${i}`).textContent = '0.00';
        document.getElementById(`mobileCompEPA${i}`).textContent = '0.00';
        document.getElementById(`mobileCompShootingAcc${i}`).textContent = '0.00';
        document.getElementById(`mobileCompClimbRate${i}`).textContent = '0.0%';
        document.getElementById(`mobileCompDiedRate${i}`).textContent = '0.0%';
        document.getElementById(`mobileCompWeightedTeleFuel${i}`).textContent = '0.00';  // Add this line

        const charts = [
            `mobileCompAutoClimbChart${i}`,
            `mobileCompTeleClimbChart${i}`,
            `mobileCompAutoFuelShotChart${i}`,
            `mobileCompAutoFuelFerriedChart${i}`,
            `mobileCompTeleFuelShotChart${i}`,
            `mobileCompTeleFuelFerriedChart${i}`,
            `mobileCompWeightedTeleFuelChart${i}`  // Add this line
        ];

        charts.forEach(id => {
            const canvas = document.getElementById(id);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        });
    }
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
/*-----MOBILE RANKINGS FUNCTIONS-----*/
// mobile.js - Add this updated mobile rankings functionality

/*-----MOBILE RANKINGS FUNCTIONS (UPDATED)-----*/

let mobileRankingHiddenTeams = JSON.parse(localStorage.getItem('mobileRankingHiddenTeams') || '[]');
let mobileRankingIsolatedTeams = JSON.parse(localStorage.getItem('mobileRankingIsolatedTeams') || '[]');
let mobileRankingIsIsolated = JSON.parse(localStorage.getItem('mobileRankingIsIsolated') || 'false');
let mobileRankingFilterState = JSON.parse(localStorage.getItem('mobileRankingFilterState') || '{}');

// Updated column mapping with weighted tele fuel
const mobileColumnMapping = {
    'avgAutoShot': 5,
    'avgTeleShot': 4,
    'avgAutoFerried': 6,
    'avgTeleFerried': 7,
    'autoClimbAttempts': 8,
    'autoClimbSuccesses': 9,
    'stuckOnBar': 10,
    'shootingAccuracy': 11,
    'avgClimbPoints': 12,
    'climbAttempts': 13,
    'climbSuccesses': 14,
    'driverSkill': 15,
    'countDefenseRatings': 16,
    'maxDefenseRatings': 17,
    'robotDiedPercent': 18
};

function initMobileRankings() {
    console.log('Initializing mobile rankings');

    loadMobileRankingHiddenTeams();
    loadMobileRankingIsolatedTeams();
    loadMobileRankingFilterState();

    updateMobileIsolateButton();

    renderMobileHiddenTeamsListRanking();
    renderMobileIsolatedTeamsListRanking();

    renderMobileRankingTable();
}

function toggleMobileFilterContent() {
    const content = document.getElementById('mobileFilterContent');
    const arrow = document.getElementById('mobileFilterToggleArrow');

    if (content.style.display === 'none' || !content.style.display) {
        content.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
    }
}

function toggleMobileHideTeam() {
    const content = document.getElementById('mobileHideTeamContent');
    const arrow = document.getElementById('mobileHideTeamArrow');

    if (content.style.display === 'none' || !content.style.display) {
        content.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
    }
}

function toggleMobileIsolateTeam() {
    const content = document.getElementById('mobileIsolateTeamContent');
    const arrow = document.getElementById('mobileIsolateTeamArrow');

    if (content.style.display === 'none' || !content.style.display) {
        content.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
    }
}

function resetMobileFilters() {
    const checkboxes = document.querySelectorAll('#mobileRankingFilterForm input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    saveMobileRankingFilterState();
    renderMobileRankingTable();
    updateMobileRankingTableColumns();
}

function uncheckMobileAll() {
    const checkboxes = document.querySelectorAll('#mobileRankingFilterForm input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    renderMobileRankingTable();
    updateMobileRankingTableColumns();
    saveMobileRankingFilterState();

    console.log("Uncheck all clicked - Weighted Tele Fuel remains visible as permanent column");
}

function addMobileHiddenTeamRanking() {
    const input = document.getElementById('mobileHideTeamInput');
    const teamNumber = input.value.trim();

    if (!teamNumber) return;

    const eventCSV = localStorage.getItem('eventScoutingCSV') || '';
    if (eventCSV) {
        const parsed = Papa.parse(eventCSV, { header: true, skipEmptyLines: true });
        const teamExists = parsed.data.some(row => row['Team Number']?.toString().trim() === teamNumber);

        if (!teamExists) {
            alert(`No data found for team ${teamNumber}`);
            return;
        }
    }

    if (!mobileRankingHiddenTeams.includes(teamNumber)) {
        mobileRankingHiddenTeams.push(teamNumber);
        mobileRankingHiddenTeams.sort((a, b) => parseInt(a) - parseInt(b));
        saveMobileRankingHiddenTeams();
        renderMobileHiddenTeamsListRanking();
        renderMobileRankingTable();
        input.value = '';
    } else {
        alert(`Team ${teamNumber} is already in the list.`);
    }
}

function removeMobileHiddenTeamRanking(teamNumber) {
    mobileRankingHiddenTeams = mobileRankingHiddenTeams.filter(t => t !== teamNumber);
    saveMobileRankingHiddenTeams();
    renderMobileHiddenTeamsListRanking();
    renderMobileRankingTable();
}

function resetMobileHiddenTeamsRanking() {
    if (confirm('Are you sure you want to reset all hidden teams?')) {
        mobileRankingHiddenTeams = [];
        saveMobileRankingHiddenTeams();
        renderMobileHiddenTeamsListRanking();
        renderMobileRankingTable();
    }
}

function renderMobileHiddenTeamsListRanking() {
    const list = document.getElementById('mobileHideTeamList');
    const container = document.getElementById('mobileHideTeamListContainer');
    if (!list || !container) return;

    list.innerHTML = '';

    if (mobileRankingHiddenTeams.length === 0) {
        container.style.maxHeight = '0px';
        container.style.overflowY = 'hidden';
        return;
    }

    mobileRankingHiddenTeams.forEach(team => {
        const listItem = document.createElement('li');
        listItem.style.display = 'flex';
        listItem.style.justifyContent = 'space-between';
        listItem.style.alignItems = 'center';
        listItem.style.marginBottom = '8px';
        listItem.style.padding = '6px 10px';
        listItem.style.backgroundColor = '#1C1E21';
        listItem.style.borderRadius = '4px';
        listItem.style.border = '1px solid red';

        const teamText = document.createElement('span');
        teamText.textContent = `Team ${team}`;
        teamText.style.color = 'white';
        teamText.style.fontFamily = 'Lato';
        listItem.appendChild(teamText);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'X';
        deleteButton.style.padding = '2px 8px';
        deleteButton.style.backgroundColor = '#ff5c5c';
        deleteButton.style.color = 'white';
        deleteButton.style.border = 'none';
        deleteButton.style.borderRadius = '4px';
        deleteButton.style.cursor = 'pointer';
        deleteButton.style.fontFamily = 'Lato';
        deleteButton.style.fontWeight = 'bold';

        deleteButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeMobileHiddenTeamRanking(team);
        });

        listItem.appendChild(deleteButton);
        list.appendChild(listItem);
    });

    const itemHeight = 42;
    const maxVisibleItems = 8;

    if (mobileRankingHiddenTeams.length <= maxVisibleItems) {
        container.style.maxHeight = `${mobileRankingHiddenTeams.length * itemHeight}px`;
        container.style.overflowY = 'hidden';
    } else {
        container.style.maxHeight = `${maxVisibleItems * itemHeight}px`;
        container.style.overflowY = 'auto';
    }
}

function addMobileIsolatedTeam() {
    const input = document.getElementById('mobileIsolateTeamInput');
    const teamNumber = input.value.trim();

    if (!teamNumber) return;

    const eventCSV = localStorage.getItem('eventScoutingCSV') || '';
    if (eventCSV) {
        const parsed = Papa.parse(eventCSV, { header: true, skipEmptyLines: true });
        const teamExists = parsed.data.some(row => row['Team Number']?.toString().trim() === teamNumber);

        if (!teamExists) {
            alert(`No data found for team ${teamNumber}`);
            return;
        }
    }

    if (!mobileRankingIsolatedTeams.includes(teamNumber)) {
        mobileRankingIsolatedTeams.push(teamNumber);
        mobileRankingIsolatedTeams.sort((a, b) => parseInt(a) - parseInt(b));
        saveMobileRankingIsolatedTeams();
        renderMobileIsolatedTeamsListRanking();
        input.value = '';
        if (mobileRankingIsIsolated) {
            renderMobileRankingTable();
        }
    } else {
        alert(`Team ${teamNumber} is already in the list.`);
    }
}

function removeMobileIsolatedTeam(teamNumber) {
    mobileRankingIsolatedTeams = mobileRankingIsolatedTeams.filter(t => t !== teamNumber);
    saveMobileRankingIsolatedTeams();
    renderMobileIsolatedTeamsListRanking();
    if (mobileRankingIsIsolated) {
        renderMobileRankingTable();
    }
}

function toggleMobileIsolateMode() {
    mobileRankingIsIsolated = !mobileRankingIsIsolated;
    saveMobileRankingIsolatedTeams();
    updateMobileIsolateButton();
    renderMobileRankingTable();
}

function updateMobileIsolateButton() {
    const isolateBtn = document.getElementById('mobileIsolateBtn');
    if (isolateBtn) {
        isolateBtn.style.backgroundColor = mobileRankingIsIsolated ? '#28a745' : '#1e90ff';
        isolateBtn.textContent = mobileRankingIsIsolated ? 'Isolating' : 'Isolate';
    }
}

function revertMobileIsolatedTeams() {
    mobileRankingIsIsolated = false;
    mobileRankingIsolatedTeams = [];
    saveMobileRankingIsolatedTeams();
    updateMobileIsolateButton();
    renderMobileIsolatedTeamsListRanking();
    renderMobileRankingTable();
}

function renderMobileIsolatedTeamsListRanking() {
    const list = document.getElementById('mobileIsolateTeamList');
    const container = document.getElementById('mobileIsolateTeamListContainer');
    if (!list || !container) return;

    list.innerHTML = '';

    if (mobileRankingIsolatedTeams.length === 0) {
        container.style.maxHeight = '0px';
        container.style.overflowY = 'hidden';
        return;
    }

    mobileRankingIsolatedTeams.forEach(team => {
        const listItem = document.createElement('li');
        listItem.style.display = 'flex';
        listItem.style.justifyContent = 'space-between';
        listItem.style.alignItems = 'center';
        listItem.style.marginBottom = '8px';
        listItem.style.padding = '6px 10px';
        listItem.style.backgroundColor = '#1C1E21';
        listItem.style.borderRadius = '4px';
        listItem.style.border = '1px solid #1e90ff';

        const teamText = document.createElement('span');
        teamText.textContent = `Team ${team}`;
        teamText.style.color = 'white';
        teamText.style.fontFamily = 'Lato';
        listItem.appendChild(teamText);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'X';
        deleteButton.style.padding = '2px 8px';
        deleteButton.style.backgroundColor = '#1e90ff';
        deleteButton.style.color = 'white';
        deleteButton.style.border = 'none';
        deleteButton.style.borderRadius = '4px';
        deleteButton.style.cursor = 'pointer';
        deleteButton.style.fontFamily = 'Lato';
        deleteButton.style.fontWeight = 'bold';

        deleteButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeMobileIsolatedTeam(team);
        });

        listItem.appendChild(deleteButton);
        list.appendChild(listItem);
    });

    const itemHeight = 42;
    const maxVisibleItems = 8;

    if (mobileRankingIsolatedTeams.length <= maxVisibleItems) {
        container.style.maxHeight = `${mobileRankingIsolatedTeams.length * itemHeight}px`;
        container.style.overflowY = 'hidden';
    } else {
        container.style.maxHeight = `${maxVisibleItems * itemHeight}px`;
        container.style.overflowY = 'auto';
    }
}

function updateMobileRankingTableColumns() {
    const ths = document.querySelectorAll('#mobileRankingTable thead th');
    const trs = document.querySelectorAll('#mobileRankingTable tbody tr');
    const checkboxes = document.querySelectorAll('#mobileRankingFilterForm input[type="checkbox"]');

    const checkedValues = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    // Permanent columns: Rank (0), Team (1), Avg EPA (2), Weighted Tele Fuel (3)
    const permanentColumns = new Set([0, 1, 2, 3]);

    ths.forEach((th, index) => {
        if (permanentColumns.has(index)) {
            th.style.display = '';
        } else {
            let shouldShow = false;
            for (const [value, colIndex] of Object.entries(mobileColumnMapping)) {
                if (colIndex === index && checkedValues.includes(value)) {
                    shouldShow = true;
                    break;
                }
            }
            th.style.display = shouldShow ? '' : 'none';
        }
    });

    trs.forEach(tr => {
        Array.from(tr.children).forEach((td, index) => {
            if (permanentColumns.has(index)) {
                td.style.display = '';
            } else {
                let shouldShow = false;
                for (const [value, colIndex] of Object.entries(mobileColumnMapping)) {
                    if (colIndex === index && checkedValues.includes(value)) {
                        shouldShow = true;
                        break;
                    }
                }
                td.style.display = shouldShow ? '' : 'none';
            }
        });
    });
}

function renderMobileRankingTable() {
    const eventCSV = localStorage.getItem('eventScoutingCSV') || '';
    const tableBody = document.getElementById('mobileRankingTableBody');

    if (!tableBody) return;

    if (!eventCSV) {
        tableBody.innerHTML = '<tr><td colspan="18" style="color: #aaa; text-align: center; padding: 30px; font-size: 16px;">Upload event scouting CSV first</td></tr>';
        return;
    }

    try {
        const parsed = Papa.parse(eventCSV, { header: true, skipEmptyLines: true });
        const eventScoutingData = parsed.data || [];

        // Filter teams based on hide/isolate settings
        const visibleTeamsData = eventScoutingData.filter(row => {
            const team = row['Team Number']?.toString().trim();
            if (!team) return false;

            if (mobileRankingIsIsolated && mobileRankingIsolatedTeams.length > 0) {
                return mobileRankingIsolatedTeams.includes(team);
            }
            return !mobileRankingHiddenTeams.includes(team);
        });

        // Group by team
        const teams = {};
        visibleTeamsData.forEach(row => {
            const team = row['Team Number']?.toString().trim();
            if (!team) return;
            if (!teams[team]) teams[team] = [];
            teams[team].push(row);
        });

        // Calculate statistics for each team
        const teamStats = Object.keys(teams).map(team => {
            const matches = teams[team];

            // Helper function for averaging
            const avg = (arr, key) => {
                const vals = arr.map(r => parseFloat(r[key] || 0)).filter(v => !isNaN(v));
                return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            };

            // EPA calculation: average of Total Points only (no OPR)
            const avgTotalPoints = avg(matches, 'Total Points') || avg(matches, 'Total Score') || 0;
            const avgEPA = Math.round(avgTotalPoints * 100) / 100;

            // Fuel stats - rounded to 2 decimals
            const avgAutoShot = Math.round((avg(matches, 'Auto Fuel Shot') || 0) * 100) / 100;
            const avgTeleShot = Math.round((avg(matches, 'Tele Fuel Shot') || 0) * 100) / 100;
            const avgAutoFerried = Math.round((avg(matches, 'Auto Fuel Ferried') || 0) * 100) / 100;
            const avgTeleFerried = Math.round((avg(matches, 'Tele Fuel Ferried') || 0) * 100) / 100;

            // Auto climb stats
            const autoClimbAttempts = matches.filter(r => r['Climb Auto'] && r['Climb Auto'] !== '' && r['Climb Auto'] !== 'F').length;
            const autoClimbSuccesses = matches.filter(r => r['Climb Auto'] === '1').length;
            const stuckOnBar = matches.reduce((sum, r) => sum + (parseInt(r['Stuck On Bar']) || 0), 0);

            // Climb points
            const avgAutoClimbPoints = avg(matches, 'Auto Climb Points') || 0;
            const avgTeleClimbPoints = avg(matches, 'Tele Climb Points') || 0;
            const avgClimbPoints = avgAutoClimbPoints + avgTeleClimbPoints;

            // Teleop climb stats
            const climbAttempts = matches.filter(r => r['Climb Teleop'] && r['Climb Teleop'] !== '' && r['Climb Teleop'] !== 'F').length;
            const climbSuccesses = matches.filter(r => {
                const val = parseInt(r['Climb Teleop']);
                return !isNaN(val) && val > 0;
            }).length;

            // Driver skill
            const driverVals = matches.map(r => parseFloat(r['Driver Skill'] || NaN)).filter(v => !isNaN(v) && v !== 0);
            let driverSkill = 0;
            if (driverVals.length) {
                driverSkill = driverVals.reduce((a, b) => a + b, 0) / driverVals.length;
                driverSkill = Math.round(driverSkill * 10) / 10;
            }

            // Defense stats
            const countDefenseRatings = matches.filter(r => r['Defense On Robot'] !== undefined && r['Defense On Robot'] !== '').length;
            const maxDefenseRatings = Math.max(...matches.map(r => parseFloat(r['Robot Defense']) || 0).filter(v => !isNaN(v)), 0);

            // Robot died percentage
            const diedCount = matches.filter(r => {
                const val = parseFloat(r['Robot Died']);
                return val === 0.5 || val === 1;
            }).length;
            const robotDiedPercent = matches.length ? ((diedCount / matches.length) * 100).toFixed(1) : '0.0';

            // Shooting accuracy
            const shootingAccuracy = (() => {
                const accuracyVals = matches
                    .map(r => parseFloat(r['Shooting Accuracy']))
                    .filter(v => !isNaN(v));
                return accuracyVals.length > 0
                    ? (accuracyVals.reduce((a, b) => a + b, 0) / accuracyVals.length).toFixed(2)
                    : '0.00';
            })();

            const weightedTeleFuel = (() => {
                const teleFuelWithMatches = matches.map(row => {
                    const matchNum = parseInt(row['Match'] || row['Match Number'] || 0);
                    const teleFuel = parseFloat(row['Tele Fuel Shot'] || 0);
                    return { match: matchNum, value: teleFuel };
                }).filter(item => !isNaN(item.value) && item.match > 0);

                if (teleFuelWithMatches.length === 0) return 0;

                let totalWeightedValue = 0;
                let totalWeight = 0;

                teleFuelWithMatches.forEach(item => {
                    let weight;
                    if (item.match <= 2) {
                        weight = 0.5;
                    } else if (item.match <= 6) {
                        weight = 1.0;
                    } else if (item.match <= 8) {
                        weight = 1.5;
                    } else {
                        weight = 2.0;
                    }

                    totalWeightedValue += item.value * weight;
                    totalWeight += weight;
                });

                return totalWeight > 0 ? totalWeightedValue / totalWeight : 0;
            })();


            return {
                team,
                avgEPA,
                weightedTeleFuel,
                avgAutoShot,
                avgTeleShot,
                avgAutoFerried,
                avgTeleFerried,
                autoClimbAttempts,
                autoClimbSuccesses,
                stuckOnBar,
                avgClimbPoints,
                climbAttempts,
                climbSuccesses,
                driverSkill,
                countDefenseRatings,
                maxDefenseRatings,
                robotDiedPercent,
                shootingAccuracy
            };
        });

        // Sort by EPA descending
        teamStats.sort((a, b) => b.avgEPA - a.avgEPA);

        tableBody.innerHTML = '';

        // Column names for reference
        const columnNames = [
            'Rank', 'Team', 'Avg EPA', 'Weighted Tele Fuel',
            'Avg Tele Shot', 'Avg Auto Shot',  // Swapped these two
            'Avg Auto Ferried', 'Avg Tele Ferried', 'Auto Climb Attempts',
            'Auto Climb Successes', 'Stuck on Bar', 'Shooting Accuracy',
            'Avg Climb Points', 'Climb Attempts', 'Climb Successes',
            'Driver Skill', 'Count Defense Ratings', 'Max Defense Ratings',
            'Robot Died %'
        ];

        // Columns where lower is better (for color scaling)
        const flipColumns = ['Stuck on Bar', 'Robot Died %'];

        teamStats.forEach((stat, idx) => {
            const row = document.createElement('tr');
            const values = [
                idx + 1,
                stat.team,
                stat.avgEPA.toFixed(1),
                stat.weightedTeleFuel.toFixed(1),
                stat.avgTeleShot.toFixed(1),   // Tele Shot first (index 4)
                stat.avgAutoShot.toFixed(1),    // Auto Shot second (index 5)
                stat.avgAutoFerried.toFixed(1),
                stat.avgTeleFerried.toFixed(1),
                stat.autoClimbAttempts,
                stat.autoClimbSuccesses,
                stat.stuckOnBar,
                stat.shootingAccuracy,
                stat.avgClimbPoints.toFixed(1),
                stat.climbAttempts,
                stat.climbSuccesses,
                stat.driverSkill,
                stat.countDefenseRatings,
                stat.maxDefenseRatings,
                stat.robotDiedPercent + '%'
            ];
            let html = '';

            values.forEach((val, i) => {
                let bgColor = '';
                let additionalClasses = '';

                // Apply color scaling to all columns except Rank and Team
                if (i > 1) {
                    const colName = columnNames[i];

                    // Get all values for this column across all teams
                    const allVals = teamStats.map(s => {
                        switch (colName) {
                            case 'Avg EPA': return s.avgEPA;
                            case 'Weighted Tele Fuel': return s.weightedTeleFuel;  // Add this
                            case 'Avg Auto Shot': return s.avgAutoShot;
                            case 'Avg Tele Shot': return s.avgTeleShot;
                            case 'Avg Auto Ferried': return s.avgAutoFerried;
                            case 'Avg Tele Ferried': return s.avgTeleFerried;
                            case 'Auto Climb Attempts': return s.autoClimbAttempts;
                            case 'Auto Climb Successes': return s.autoClimbSuccesses;
                            case 'Stuck on Bar': return s.stuckOnBar;
                            case 'Shooting Accuracy': return parseFloat(s.shootingAccuracy);
                            case 'Avg Climb Points': return s.avgClimbPoints;
                            case 'Climb Attempts': return s.climbAttempts;
                            case 'Climb Successes': return s.climbSuccesses;
                            case 'Driver Skill': return s.driverSkill;
                            case 'Count Defense Ratings': return s.countDefenseRatings;
                            case 'Max Defense Ratings': return s.maxDefenseRatings;
                            case 'Robot Died %': return parseFloat(s.robotDiedPercent);
                            default: return null;
                        }
                    }).filter(v => typeof v === 'number' && !isNaN(v));
                    const numVal = parseFloat(val);

                    if (!isNaN(numVal) && allVals.length) {
                        const minVal = Math.min(...allVals);
                        const maxVal = Math.max(...allVals);

                        let normalized = maxVal > minVal ? (numVal - minVal) / (maxVal - minVal) : 0.5;

                        // Flip for columns where lower is better
                        if (flipColumns.includes(colName)) {
                            normalized = 1 - normalized;
                        }

                        const hue = normalized * 120; // 0 = red, 120 = green
                        bgColor = `hsl(${hue}, 70%, 35%)`;
                    }
                }

                // Highlight team 226
                if (stat.team === "226") {
                    if (i === 0) {
                        additionalClasses = 'team-226-rank';
                    } else if (i === 1) {
                        additionalClasses = 'team-226-team';
                    }
                }

                const styleAttr = bgColor ? `background-color: ${bgColor}` : '';
                const classAttr = additionalClasses ? `class="${additionalClasses}"` : '';

                html += `<td ${classAttr} style="${styleAttr}">${val}</td>`;
            });

            row.innerHTML = html;
            tableBody.appendChild(row);
        });

        updateMobileRankingTableColumns();

    } catch (e) {
        console.error('Error rendering mobile ranking table:', e);
        tableBody.innerHTML = '<tr><td colspan="18" style="color: #ff5c5c; text-align: center; padding: 30px; font-size: 16px;">Error loading data</td></tr>';
    }
}

function saveMobileRankingHiddenTeams() {
    localStorage.setItem('mobileRankingHiddenTeams', JSON.stringify(mobileRankingHiddenTeams));
}

function saveMobileRankingIsolatedTeams() {
    localStorage.setItem('mobileRankingIsolatedTeams', JSON.stringify(mobileRankingIsolatedTeams));
    localStorage.setItem('mobileRankingIsIsolated', JSON.stringify(mobileRankingIsIsolated));
}

function saveMobileRankingFilterState() {
    try {
        const checkboxes = Array.from(document.querySelectorAll('#mobileRankingFilterForm input[type="checkbox"]'));
        const state = {};
        checkboxes.forEach(cb => { state[cb.value] = cb.checked; });
        localStorage.setItem('mobileRankingFilterState', JSON.stringify(state));
    } catch (e) {
        console.error('Error saving filter state:', e);
    }
}

function loadMobileRankingHiddenTeams() {
    mobileRankingHiddenTeams = JSON.parse(localStorage.getItem('mobileRankingHiddenTeams') || '[]');
}

function loadMobileRankingIsolatedTeams() {
    mobileRankingIsolatedTeams = JSON.parse(localStorage.getItem('mobileRankingIsolatedTeams') || '[]');
    mobileRankingIsIsolated = JSON.parse(localStorage.getItem('mobileRankingIsIsolated') || 'false');
}

function loadMobileRankingFilterState() {
    try {
        const savedState = localStorage.getItem('mobileRankingFilterState');
        if (savedState) {
            const state = JSON.parse(savedState);
            document.querySelectorAll('#mobileRankingFilterForm input[type="checkbox"]').forEach(cb => {
                if (state.hasOwnProperty(cb.value)) {
                    cb.checked = !!state[cb.value];
                } else {
                    cb.checked = false;
                }
            });
        } else {
            // Default: all checkboxes checked
            document.querySelectorAll('#mobileRankingFilterForm input[type="checkbox"]').forEach(cb => {
                cb.checked = true;
            });
        }
    } catch (e) {
        console.error('Error loading filter state:', e);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
    const filterForm = document.getElementById('mobileRankingFilterForm');
    if (filterForm) {
        filterForm.addEventListener('change', function () {
            renderMobileRankingTable();
            updateMobileRankingTableColumns();
            saveMobileRankingFilterState();
        });
    }

    const hideTeamInput = document.getElementById('mobileHideTeamInput');
    if (hideTeamInput) {
        hideTeamInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addMobileHiddenTeamRanking();
            }
        });
    }

    const isolateTeamInput = document.getElementById('mobileIsolateTeamInput');
    if (isolateTeamInput) {
        isolateTeamInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addMobileIsolatedTeam();
            }
        });
    }
});

// Make functions globally available
window.initMobileRankings = initMobileRankings;
window.toggleMobileFilterContent = toggleMobileFilterContent;
window.toggleMobileHideTeam = toggleMobileHideTeam;
window.toggleMobileIsolateTeam = toggleMobileIsolateTeam;
window.resetMobileFilters = resetMobileFilters;
window.uncheckMobileAll = uncheckMobileAll;
window.addMobileHiddenTeamRanking = addMobileHiddenTeamRanking;
window.resetMobileHiddenTeamsRanking = resetMobileHiddenTeamsRanking;
window.addMobileIsolatedTeam = addMobileIsolatedTeam;
window.revertMobileIsolatedTeams = revertMobileIsolatedTeams;
window.toggleMobileIsolateMode = toggleMobileIsolateMode;
window.handleMobileComparisonSearch = handleMobileComparisonSearch;
window.initMobileComparison = initMobileComparison;
window.switchMobileTab = switchMobileTab;
window.handleMobileOverviewSearch = handleMobileOverviewSearch;
window.clearMobileOverviewSearch = clearMobileOverviewSearch;
window.handleMobileIndividualSearch = handleMobileIndividualSearch;
window.handleMobileMatchPrediction = handleMobileMatchPrediction;
window.loadOverviewData = loadOverviewData;
window.loadSavedFiles = loadSavedFiles;
window.deleteFile = deleteFile;
window.initMobileFilterView = initMobileFilterView;
window.applyMobileFilters = applyMobileFilters;
window.addMobileHiddenTeam = addMobileHiddenTeam;
window.resetMobileHiddenTeams = resetMobileHiddenTeams;
window.toggleMobileHiddenTeams = toggleMobileHiddenTeams;