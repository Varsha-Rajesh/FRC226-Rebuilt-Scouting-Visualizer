/*-----VARIABLES----*/

const charts = {
  overviewStackedChart: null,
  fuelOprChart: null
};

let hiddenTeams = JSON.parse(localStorage.getItem('hiddenTeams') || '[]');
let showHiddenTeamsInFilter = false;
let isolatedTeams = [];
let isIsolated = false;
let highlightedOverviewTeam = null;
let csvText = localStorage.getItem('csvText') || "";
let pitCsvText = localStorage.getItem('pitCsvText') || "";
let scheduleCsvText = localStorage.getItem('scheduleCsvText') || "";
let oprCsvText = localStorage.getItem('oprCsvText') || "";
let currentTeamData = [];
let teleClimbPositionFilterValue = 'all';
let pitScoutingData = [];


/*-----RANKINGS-----*/

const columnMapping = {
  'autoOPR': 4,
  'autoClimbAttempts': 5,
  'autoClimbSuccesses': 6,
  'stuckOnBar': 7,
  'teleOPR': 8,
  'shootingAccuracy': 9,
  'climbTimePerLevel': 10,
  'avgClimbPoints': 11,
  'climbAttempts': 12,
  'climbSuccesses': 13,
  'driverSkill': 14,
  'countDefenseRatings': 15,
  'maxDefenseRatings': 16,
  'robotDiedPercent': 17
};


function updateRankingTableColumns() {
  const ths = document.querySelectorAll('#rankingTable thead th');
  const trs = document.querySelectorAll('#rankingTable tbody tr');
  const checkboxes = document.querySelectorAll('#rankingFilterForm input[type="checkbox"]');

  const checkedValues = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  ths.forEach((th, index) => {
    if (index <= 3) {
      th.style.display = '';
    } else {
      let shouldShow = false;
      for (const [value, colIndex] of Object.entries(columnMapping)) {
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
      if (index <= 3) {
        td.style.display = '';
      } else {
        let shouldShow = false;
        for (const [value, colIndex] of Object.entries(columnMapping)) {
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

document.getElementById('rankingFilterForm')?.addEventListener('change', function () {
  renderRankingTable();
  updateRankingTableColumns();
  saveRankingFilterState();
});

document.addEventListener('DOMContentLoaded', () => {
  updateRankingTableColumns();

});

function renderRankingTable() {
  if (typeof Papa === 'undefined' || typeof csvText === 'undefined') return;
  const eventScoutingData = Papa.parse(csvText, { header: true }).data;
  const tableBody = document.getElementById('rankingTableBody');
  if (!tableBody) return;

  let oprData = {};
  if (oprCsvText && oprCsvText.trim()) {
    const parsed = Papa.parse(oprCsvText, { header: true, skipEmptyLines: true });
    parsed.data.forEach(row => {
      const team = row['Team Number']?.toString().trim();
      if (team) {
        oprData[team] = {
          autoOPR: parseFloat((row['Auto OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0,
          teleOPR: parseFloat((row['Tele OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0,
          totalOPR: parseFloat((row['Total OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0
        };
      }
    });
  }

  const visibleTeamsData = eventScoutingData.filter(row => {
    if (isIsolated && isolatedTeams.length > 0) {
      return isolatedTeams.includes(row['Team Number']);
    }
    return !hiddenTeams.includes(row['Team Number']);
  });

  const teams = {};
  visibleTeamsData.forEach(row => {
    const team = row['Team Number'];
    if (!team) return;
    if (!teams[team]) teams[team] = [];
    teams[team].push(row);
  });

  const teamStats = Object.keys(teams).map(team => {
    const matches = teams[team];
    const opr = oprData[team] || { autoOPR: 0, teleOPR: 0, totalOPR: 0 };

    const avgTotalPoints = avg(matches, 'Total Points') || avg(matches, 'Total Score') || 0;
    const avgEPA = avgTotalPoints + opr.totalOPR;

    const avgOPR = opr.totalOPR;

    const autoClimbAttempts = matches.filter(r => r['Climb Auto'] && r['Climb Auto'] !== '' && r['Climb Auto'] !== 'F').length;
    const autoClimbSuccesses = matches.filter(r => r['Climb Auto'] === '1').length;

    const stuckOnBar = matches.reduce((sum, r) => sum + (parseInt(r['Stuck On Bar']) || 0), 0);

    const climbTimeVals = matches.map(r => parseFloat(r['Climb Time per Level'] || NaN)).filter(v => !isNaN(v) && v !== 0);
    let climbTimePerLevel = 0;
    if (climbTimeVals.length) {
      climbTimePerLevel = climbTimeVals.reduce((a, b) => a + b, 0) / climbTimeVals.length;
      climbTimePerLevel = Math.round(climbTimePerLevel * 10) / 10;
    }

    const avgAutoClimbPoints = avg(matches, 'Auto Climb Points') || 0;
    const avgTeleClimbPoints = avg(matches, 'Tele Climb Points') || 0;
    const avgClimbPoints = avgAutoClimbPoints + avgTeleClimbPoints;

    const climbAttempts = matches.filter(r => r['Climb Teleop'] && r['Climb Teleop'] !== '' && r['Climb Teleop'] !== 'F').length;

    const climbSuccesses = matches.filter(r => {
      const val = parseInt(r['Climb Teleop']);
      return !isNaN(val) && val > 0;
    }).length;

    const driverVals = matches.map(r => parseFloat(r['Driver Skill'] || NaN)).filter(v => !isNaN(v) && v !== 0);
    let driverSkill = 0;
    if (driverVals.length) {
      driverSkill = driverVals.reduce((a, b) => a + b, 0) / driverVals.length;
      driverSkill = Math.round(driverSkill * 10) / 10;
    }

    const countDefenseRatings = matches.filter(r => r['Defense On Robot'] !== undefined && r['Defense On Robot'] !== '').length;

    const maxDefenseRatings = Math.max(...matches.map(r => parseFloat(r['Robot Defense']) || 0).filter(v => !isNaN(v)), 0);

    const diedCount = matches.filter(r => {
      const val = parseFloat(r['Robot Died']);
      return val === 0.5 || val === 1;
    }).length;
    const robotDiedPercent = matches.length ? ((diedCount / matches.length) * 100).toFixed(1) : '0.0';

    const shootingAccuracy = (() => {
      const accuracyVals = matches
        .map(r => parseFloat(r['Shooting Accuracy']))
        .filter(v => !isNaN(v));
      return accuracyVals.length > 0
        ? (accuracyVals.reduce((a, b) => a + b, 0) / accuracyVals.length).toFixed(2)
        : '0.00';
    })();

    return {
      team,
      avgEPA,
      avgOPR,
      autoOPR: opr.autoOPR,
      autoClimbAttempts,
      autoClimbSuccesses,
      stuckOnBar,
      teleOPR: opr.teleOPR,
      climbTimePerLevel,
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

  teamStats.sort((a, b) => b.avgEPA - a.avgEPA);

  tableBody.innerHTML = '';
  teamStats.forEach((stat, idx) => {
    const row = document.createElement('tr');
    if (stat.team === "226") row.classList.add('team-226');

    const values = [
      idx + 1,
      stat.team,
      stat.avgEPA.toFixed(2),
      stat.avgOPR.toFixed(2),
      stat.autoOPR.toFixed(2),
      stat.autoClimbAttempts,
      stat.autoClimbSuccesses,
      stat.stuckOnBar,
      stat.teleOPR.toFixed(2),
      stat.shootingAccuracy,
      stat.climbTimePerLevel,
      stat.avgClimbPoints.toFixed(2),
      stat.climbAttempts,
      stat.climbSuccesses,
      stat.driverSkill,
      stat.countDefenseRatings,
      stat.maxDefenseRatings,
      stat.robotDiedPercent + '%'
    ];

    let html = '';
    const columnNames = ['Rank', 'Team', 'Avg EPA', 'Avg OPR', 'Auto OPR',
      'Auto Climb Attempts', 'Auto Climb Successes', 'Stuck on Bar',
      'Tele OPR', 'Shooting Accuracy',
      'Climb Time per Level', 'Avg Climb Points', 'Climb Attempts',
      'Climb Successes', 'Driver Skill', 'Count Defense Ratings',
      'Max Defense Ratings', 'Robot Died %'];
    const flipColumns = ['Stuck on Bar', 'Robot Died %'];

    values.forEach((val, i) => {
      let bgColor = '';

      if (i > 1) {
        const colName = columnNames[i];

        const allVals = teamStats.map(s => {
          switch (colName) {
            case 'Avg EPA': return s.avgEPA;
            case 'Avg OPR': return s.avgOPR;
            case 'Auto OPR': return s.autoOPR;
            case 'Tele OPR': return s.teleOPR;
            case 'Auto Climb Attempts': return s.autoClimbAttempts;
            case 'Auto Climb Successes': return s.autoClimbSuccesses;
            case 'Climb Attempts': return s.climbAttempts;
            case 'Climb Successes': return s.climbSuccesses;
            case 'Shooting Accuracy': return parseFloat(s.shootingAccuracy);
            case 'Climb Time per Level': return s.climbTimePerLevel;
            case 'Avg Climb Points': return s.avgClimbPoints;
            case 'Driver Skill': return s.driverSkill;
            case 'Count Defense Ratings': return s.countDefenseRatings;
            case 'Max Defense Ratings': return s.maxDefenseRatings;
            case 'Robot Died %': return parseFloat(s.robotDiedPercent);
            case 'Stuck on Bar': return s.stuckOnBar;
            default: return null;
          }
        }).filter(v => typeof v === 'number' && !isNaN(v));

        const numVal = parseFloat(val);

        if (!isNaN(numVal) && allVals.length) {
          const minVal = Math.min(...allVals);
          const maxVal = Math.max(...allVals);

          let normalized =
            maxVal > minVal ? (numVal - minVal) / (maxVal - minVal) : 0.5;

          if (flipColumns.includes(colName)) {
            normalized = 1 - normalized;
          }

          const hue = normalized * 120;
          bgColor = `hsl(${hue}, 70%, 35%)`;
        }
      }
      html += `<td style="${bgColor ? `background-color: ${bgColor}` : ''}">${val}</td>`;
    });

    row.innerHTML = html;
    tableBody.appendChild(row);
  });

  updateRankingTableColumns();

  function avg(arr, key) {
    const vals = arr.map(r => parseFloat(r[key] || 0)).filter(v => !isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }
}

document.getElementById('resetFilters').addEventListener('click', function () {
  const checkboxes = document.querySelectorAll('#rankingFilterForm input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
  });
  updateRankingTableColumns();
  saveRankingFilterState();
});

document.getElementById('uncheckAll').addEventListener('click', function () {
  const checkboxes = document.querySelectorAll('#rankingFilterForm input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  renderRankingTable();
  updateRankingTableColumns();
  saveRankingFilterState();
});

document.getElementById('addIsolateTeamButtonRanking').addEventListener('click', function () {
  const input = document.getElementById('isolateTeamInputRanking');
  const teamNumber = input.value.trim();
  if (!teamNumber) return;

  if (!isolatedTeams.includes(teamNumber)) {
    isolatedTeams.push(teamNumber);
    isolatedTeams.sort((a, b) => parseInt(a) - parseInt(b));
    saveIsolatedTeamsRanking();
    renderIsolatedTeamsListRanking();
    input.value = '';
  } else {
    alert(`Team ${teamNumber} is already in the list.`);
  }
});

document.getElementById('isolateTeamBoxRankingIsolate').addEventListener('click', function () {
  isIsolated = !isIsolated;
  saveIsolatedTeamsRanking();
  renderIsolatedTeamsListRanking();
  renderRankingTable();
  updateRankingTableColumns();
  this.style.backgroundColor = isIsolated ? '#28a745' : '#1e90ff';
  this.textContent = isIsolated ? 'Isolating' : 'Isolate';
});

document.getElementById('revertIsolateTeamButtonRanking').addEventListener('click', function () {
  isIsolated = false;
  isolatedTeams = [];
  saveIsolatedTeamsRanking();
  renderIsolatedTeamsListRanking();
  renderRankingTable();
  updateRankingTableColumns();

  const isolateButton = document.getElementById('isolateTeamBoxRankingIsolate');
  if (isolateButton) {
    isolateButton.style.backgroundColor = '#1e90ff';
    isolateButton.textContent = 'Isolate';
  }
});

function saveRankingFilterState() {
  try {
    const checkboxes = Array.from(document.querySelectorAll('#rankingFilterForm input[type="checkbox"]'));
    const state = {};
    checkboxes.forEach(cb => { state[cb.value] = cb.checked; });
    localStorage.setItem('rankingFilterState', JSON.stringify(state));
  } catch (e) { console.error('saveRankingFilterState error', e); }
}

function loadRankingFilterState() {
  try {
    const raw = localStorage.getItem('rankingFilterState');
    if (!raw) return;
    const state = JSON.parse(raw);
    const checkboxes = Array.from(document.querySelectorAll('#rankingFilterForm input[type="checkbox"]'));
    checkboxes.forEach(cb => {
      if (state.hasOwnProperty(cb.value)) cb.checked = !!state[cb.value];
    });
    renderRankingTable();
    updateRankingTableColumns();
  } catch (e) { console.error('loadRankingFilterState error', e); }
}

function saveIsolatedTeamsRanking() {
  try {
    localStorage.setItem('isolatedTeamsRanking', JSON.stringify(isolatedTeams || []));
    localStorage.setItem('isIsolated', JSON.stringify(!!isIsolated));
  } catch (e) { console.error('saveIsolatedTeamsRanking error', e); }
}

function loadIsolatedTeamsRanking() {
  try {
    isolatedTeams = JSON.parse(localStorage.getItem('isolatedTeamsRanking') || '[]');
    isIsolated = JSON.parse(localStorage.getItem('isIsolated') || 'false');
    const isolateButton = document.getElementById('isolateTeamBoxRankingIsolate');
    if (isolateButton) {
      isolateButton.style.backgroundColor = isIsolated ? '#28a745' : '#1e90ff';
      isolateButton.textContent = isIsolated ? 'Isolating' : 'Isolate';
    }
    renderIsolatedTeamsListRanking();
    if (isIsolated) {
      renderRankingTable();
      updateRankingTableColumns();
    }
  } catch (e) { console.error('loadIsolatedTeamsRanking error', e); }
}

function renderIsolatedTeamsListRanking() {
  const list = document.getElementById('isolateTeamListRanking');
  const container = document.getElementById('isolateTeamListContainerRanking');
  if (!list || !container) return;

  list.innerHTML = '';

  isolatedTeams.forEach(team => {
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
    listItem.appendChild(teamText);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'X';
    deleteButton.style.padding = '2px 8px';
    deleteButton.style.backgroundColor = '#1e90ff';
    deleteButton.style.color = 'white';
    deleteButton.style.border = 'none';
    deleteButton.style.borderRadius = '4px';
    deleteButton.style.cursor = 'pointer';

    deleteButton.addEventListener('click', () => {
      isolatedTeams = isolatedTeams.filter(t => t !== team);
      saveIsolatedTeamsRanking();
      renderIsolatedTeamsListRanking();
      renderRankingTable();
    });

    listItem.appendChild(deleteButton);
    list.appendChild(listItem);
  });

  const itemHeight = 42;
  const maxVisibleItems = 8;

  container.style.transition = 'max-height 0.20s ease, height 0.20s ease';

  if (isolatedTeams.length === 0) {
    container.style.maxHeight = '0px';
    container.style.overflowY = 'hidden';
  } else if (isolatedTeams.length <= maxVisibleItems) {
    container.style.maxHeight = `${isolatedTeams.length * itemHeight}px`;
    container.style.overflowY = 'hidden';
  } else {
    container.style.maxHeight = `${maxVisibleItems * itemHeight}px`;
    container.style.overflowY = 'auto';
  }

  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 40);
}

document.getElementById('isolateTeamInputRanking').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('addIsolateTeamButtonRanking').click();
  }
});

document.addEventListener('DOMContentLoaded', function () {
  renderIsolatedTeamsListRanking();
});
function renderHiddenTeamsListRanking() {
  const list = document.getElementById('hideTeamListRanking');
  const container = document.getElementById('hideTeamListContainerRanking');
  if (!list || !container) return;
  list.innerHTML = '';

  hiddenTeams.forEach(team => {
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
    listItem.appendChild(teamText);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'X';
    deleteButton.style.padding = '2px 8px';
    deleteButton.style.backgroundColor = '#ff5c5c';
    deleteButton.style.color = 'white';
    deleteButton.style.border = 'none';
    deleteButton.style.borderRadius = '4px';
    deleteButton.style.cursor = 'pointer';

    deleteButton.addEventListener('click', (e) => {
      hiddenTeams = hiddenTeams.filter(t => t !== team);
      saveHiddenTeams();
      renderHiddenTeamsList();
      renderHiddenTeamsListRanking();
      applyFilters();
      updateRankingTableColumns();
      renderRankingTable();
    });

    listItem.appendChild(deleteButton);
    list.appendChild(listItem);
  });

  const itemHeight = 42;
  const maxVisibleItems = 8;
  container.style.transition = 'max-height 0.20s ease, height 0.20s ease';
  if (hiddenTeams.length === 0) {
    container.style.maxHeight = '0px';
    container.style.overflowY = 'hidden';
  } else if (hiddenTeams.length <= maxVisibleItems) {
    container.style.maxHeight = `${hiddenTeams.length * itemHeight}px`;
    container.style.overflowY = 'hidden';
  } else {
    container.style.maxHeight = `${maxVisibleItems * itemHeight}px`;
    container.style.overflowY = 'auto';
  }

  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 40);

  applyFilters();
  updateRankingTableColumns();
}

document.getElementById('addHideTeamButtonRanking').addEventListener('click', function () {
  const input = document.getElementById('hideTeamInputRanking');
  const teamNumber = input.value.trim();
  if (!teamNumber) return;
  if (!hiddenTeams.includes(teamNumber)) {
    hiddenTeams.push(teamNumber);
    hiddenTeams.sort((a, b) => parseInt(a) - parseInt(b));
    saveHiddenTeams();
    renderHiddenTeamsList();
    renderHiddenTeamsListRanking();
    applyFilters();
    updateRankingTableColumns();
    renderRankingTable();
    input.value = '';
  } else {
    alert(`Team ${teamNumber} is already in the list.`);
  }
});

document.getElementById('resetHideTeamButtonRanking').addEventListener('click', function () {
  hiddenTeams = [];
  saveHiddenTeams();
  renderHiddenTeamsList();
  renderHiddenTeamsListRanking();
  applyFilters();
  updateRankingTableColumns();
  renderRankingTable();
});

document.addEventListener('DOMContentLoaded', function () {
  loadHiddenTeams();
  renderHiddenTeamsList();
  renderHiddenTeamsListRanking();
  loadIsolatedTeamsRanking();
  loadRankingFilterState();
  applyFilters();
  renderRankingTable();
  updateRankingTableColumns();
  renderIsolatedTeamsListRanking();
  loadPitScoutingData();

});

document.getElementById('hideTeamInputRanking').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('addHideTeamButtonRanking').click();
  }
});


document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', function (e) {
    if (tab.textContent.trim().toLowerCase().includes('ranking')) {
    }
  });
});

function saveHiddenTeams() {
  localStorage.setItem('hiddenTeams', JSON.stringify(hiddenTeams));
}

function loadHiddenTeams() {
  hiddenTeams = JSON.parse(localStorage.getItem('hiddenTeams') || '[]');
}

/*-----NUMPAD-----*/

let numpadBuffer = '';

document.addEventListener('keydown', function (e) {
  if (e.location === 3 && e.key >= '0' && e.key <= '9') {
    numpadBuffer += e.key;
    e.preventDefault();
  }

  if (e.key === 'Enter' && e.location === 3) {
    const teamNumber = numpadBuffer.trim();

    if (teamNumber && !hiddenTeams.includes(teamNumber)) {
      hiddenTeams.push(teamNumber);
      hiddenTeams.sort((a, b) => parseInt(a) - parseInt(b));
      saveHiddenTeams();
      renderHiddenTeamsList();
      renderHiddenTeamsListRanking();
      applyFilters();
      updateRankingTableColumns();
      renderRankingTable();
    }

    numpadBuffer = '';
    e.preventDefault();
  }

  if (e.key === 'Escape' || e.key === 'Backspace') {
    numpadBuffer = '';
  }
});

function updatePersistentNumpadBox(text = '') {
  const el = document.getElementById('numpadBufferBox');
  if (!el) return;
  if (!text) {
    el.textContent = 'numpad:';
    el.classList.add('empty');
    el.classList.remove('small');
    return;
  }
  el.classList.remove('empty');
  el.textContent = text;
  if (text.length > 8) el.classList.add('small'); else el.classList.remove('small');
}

document.addEventListener('DOMContentLoaded', () => {
  updatePersistentNumpadBox('');
});

(function () {
  let tick = null;
  document.addEventListener('keydown', (e) => {
    const code = e.code || '';
    const isNumpadDigit = code.startsWith('Numpad') && /Numpad[0-9]/.test(code);
    const isNumpadEnter = code === 'NumpadEnter' || (e.key === 'Enter' && e.location === 3);
    const isNumpadRelated = isNumpadDigit || isNumpadEnter || e.key === 'Escape' || e.key === 'Backspace' || (e.location === 3 && /^[0-9]$/.test(e.key));

    if (!isNumpadRelated) return;

    if (tick) clearTimeout(tick);
    tick = setTimeout(() => {
      try {
        const buf = typeof numpadBuffer !== 'undefined' ? String(numpadBuffer || '') : '';
        updatePersistentNumpadBox(buf);
      } catch (err) {
        updatePersistentNumpadBox('');
      }
    }, 0);
  });

  window._updateNumpadBufferBox = updatePersistentNumpadBox;
})();


/*-----FILE UPLOADS-----*/

let eventScoutingData = [];
let matchScheduleData = [];
let oprData = [];

const dataFileInput = document.getElementById('dataFile');
const pitFileInput = document.getElementById('pitFile');
const scheduleFileInput = document.getElementById('scheduleFile');
const oprFileInput = document.getElementById('oprFile');

const statusData = document.getElementById('statusData');
const statusPit = document.getElementById('statusPit');
const statusSchedule = document.getElementById('statusSchedule');
const statusOPR = document.getElementById('statusOPR');

const submitData = document.getElementById('submitData');
const submitPit = document.getElementById('submitPit');
const submitSchedule = document.getElementById('submitSchedule');
const submitOPR = document.getElementById('submitOPR');

submitData.addEventListener('click', () => {
    handleFileUpload('dataFile', 'eventScouting', statusData);
});

submitPit.addEventListener('click', () => {
    handleFileUpload('pitFile', 'pitScouting', statusPit);
});

submitSchedule.addEventListener('click', () => {
    handleFileUpload('scheduleFile', 'matchSchedule', statusSchedule);
});

submitOPR.addEventListener('click', () => {
    handleFileUpload('oprFile', 'opr', statusOPR);
});

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
        
        switch(dataKey) {
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
    };
    reader.readAsText(file);
}

function parseEventScoutingCSV(csvText, fileName) {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());
    
    eventScoutingData = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim());
        const rowObj = {};
        headers.forEach((header, i) => {
            rowObj[header] = values[i];
        });
        return rowObj;
    });
    
    console.log("Event Scouting Data loaded:", eventScoutingData);
    updateVisualizerWithData('event', eventScoutingData);
}

function parsePitScoutingCSV(csvText, fileName) {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());
    
    pitScoutingData = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim());
        const rowObj = {};
        headers.forEach((header, i) => {
            rowObj[header] = values[i];
        });
        return rowObj;
    });
    
    console.log("Pit Scouting Data loaded:", pitScoutingData);
    updateVisualizerWithData('pit', pitScoutingData);
}

function parseMatchScheduleCSV(csvText, fileName) {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());
    const requiredHeaders = ['Match Number', 'Red 1', 'Red 2', 'Red 3', 'Blue 1', 'Blue 2', 'Blue 3'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
        updateStatus(statusSchedule, `Missing headers: ${missingHeaders.join(", ")}`, false);
        matchScheduleData = [];
        return;
    }

    matchScheduleData = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim());
        const rowObj = {};
        headers.forEach((header, i) => {
            rowObj[header] = values[i];
        });
        return rowObj;
    });
    
    console.log("Match Schedule loaded:", matchScheduleData);
    updateVisualizerWithData('schedule', matchScheduleData);
}

function parseOPRCSV(csvText, fileName) {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());
    
    oprData = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim());
        const rowObj = {};
        headers.forEach((header, i) => {
            rowObj[header] = values[i];
        });
        return rowObj;
    });
    
    console.log("OPR Data loaded:", oprData);
    updateVisualizerWithData('opr', oprData);
}

function deleteFile(inputId) {
    let dataKey, statusDiv, confirmMessage;
    
    switch(inputId) {
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
        if (dataKey === 'eventScouting') eventScoutingData = [];
        if (dataKey === 'pitScouting') pitScoutingData = [];
        if (dataKey === 'matchSchedule') matchScheduleData = [];
        if (dataKey === 'opr') oprData = [];
        
        localStorage.removeItem(`${dataKey}CSV`);
        localStorage.removeItem(`${dataKey}FileName`);
        
        document.getElementById(inputId).value = '';
        
        statusDiv.style.background = "#1a1c1f";
        statusDiv.style.border = "2px solid #2a2d31";
        statusDiv.style.color = "#ffffff";
        statusDiv.innerHTML = `<p style="text-align: center; font-size: 1rem; color: #ccc;">No file uploaded.</p>`;
        statusDiv.classList.remove('uploaded');
        
        updateVisualizerWithData(dataKey, []);
        
        alert("File deleted successfully!");
    }
}

function updateStatus(statusDiv, message, success) {
    if (success) {
        statusDiv.style.background = "#002244";
        statusDiv.style.border = "2px solid #1e90ff";
        statusDiv.style.color = "#1e90ff";
        statusDiv.innerHTML = `<p style="text-align:center; font-size:1rem; margin:0;">${message}</p>`;
        statusDiv.classList.add('uploaded');
    } else {
        statusDiv.style.background = "#440000";
        statusDiv.style.border = "2px solid #ff4c4c";
        statusDiv.style.color = "#ff4c4c";
        statusDiv.innerHTML = `<p style="text-align:center; font-size:1rem; margin:0;">${message}</p>`;
        statusDiv.classList.remove('uploaded');
    }
}

    function updateStatusNeutral(statusDiv, message) {
      if (!statusDiv) return;
      statusDiv.style.background = "#1a1c1f";
      statusDiv.style.border = "2px solid #2a2d31";
      statusDiv.style.color = "#ffffff";
      statusDiv.innerHTML = `<p style="text-align:center; font-size:1rem; margin:0; color:#ccc;">${message}</p>`;
      statusDiv.classList.remove('uploaded');
    }


window.addEventListener('DOMContentLoaded', () => {
    const savedEventCSV = localStorage.getItem('eventScoutingCSV');
    const savedEventFileName = localStorage.getItem('eventScoutingFileName');
    if (savedEventCSV) {
        parseEventScoutingCSV(savedEventCSV, savedEventFileName);
        updateStatus(statusData, savedEventFileName, true);
    }

    const savedPitCSV = localStorage.getItem('pitScoutingCSV');
    const savedPitFileName = localStorage.getItem('pitScoutingFileName');
    if (savedPitCSV) {
        parsePitScoutingCSV(savedPitCSV, savedPitFileName);
        updateStatus(statusPit, savedPitFileName, true);
    }

    const savedScheduleCSV = localStorage.getItem('matchScheduleCSV');
    const savedScheduleFileName = localStorage.getItem('matchScheduleFileName');
    if (savedScheduleCSV) {
        parseMatchScheduleCSV(savedScheduleCSV, savedScheduleFileName);
        updateStatus(statusSchedule, savedScheduleFileName, true);
    }

    const savedOPRCSV = localStorage.getItem('oprCSV');
    const savedOPRFileName = localStorage.getItem('oprFileName');
    if (savedOPRCSV) {
        parseOPRCSV(savedOPRCSV, savedOPRFileName);
        updateStatus(statusOPR, savedOPRFileName, true);
    }
});

function updateVisualizerWithData(dataType, data) {
  try {
    console.log(`Updating visualizer with ${dataType} data:`, data);

    switch (dataType) {
      case 'event':
        try {
          csvText = (Array.isArray(data) && data.length) ? Papa.unparse(data) : '';
          localStorage.setItem('eventScoutingCSV', csvText || '');
        } catch (e) { console.warn('Could not serialize event data to CSV text', e); }

        try { renderRankingTable(); } catch (e) { console.warn('renderRankingTable failed', e); }
        try { updateRankingTableColumns(); } catch (e) {}
        try { updateLatestMatchInfo(); } catch (e) {}
        try { renderOverviewStackedChart((Array.isArray(data) ? data : parseCSV().data) || []); } catch (e) {}
        try { renderFuelOprChart(); } catch (e) {}
        break;

      case 'pit':
        try {
          pitCsvText = (Array.isArray(data) && data.length) ? Papa.unparse(data) : '';
          localStorage.setItem('pitCsvText', pitCsvText || '');
        } catch (e) { console.warn('Could not serialize pit data', e); }

        try { loadPitScoutingData(); } catch (e) {}
        break;

      case 'schedule':
        try {
          scheduleCsvText = (Array.isArray(data) && data.length) ? Papa.unparse(data) : '';
          localStorage.setItem('scheduleCsvText', scheduleCsvText || '');
        } catch (e) { console.warn('Could not serialize schedule data', e); }

        try { generateTargetedScoutingBlocks(); } catch (e) {}
        break;

      case 'opr':
        try {
          oprCsvText = (Array.isArray(data) && data.length) ? Papa.unparse(data) : '';
          localStorage.setItem('oprCSV', oprCsvText || '');
        } catch (e) { console.warn('Could not serialize opr data', e); }

        try { renderFuelOprChart(); } catch (e) {}
        try { renderRankingTable(); } catch (e) {}
        break;
    }
  } catch (err) {
    console.error('updateVisualizerWithData error', err);
  }
}

function parseCSV() {
  return Papa.parse(csvText, { header: true });
}

async function handleDataUpload(e) {
  e.preventDefault();
  const fileInput = document.getElementById('dataFile');
  const statusEl = document.getElementById('statusData');
  const file = fileInput.files[0];
  if (!file || !file.name.endsWith('.csv')) {
    updateStatus(statusEl, 'Please upload a valid .csv file.', false);
    return;
  }
  const reader = new FileReader();
  reader.onload = function (evt) {
    csvText = evt.target.result;
    localStorage.setItem('csvText', csvText);
    localStorage.setItem('eventScoutingCSV', csvText);
    localStorage.setItem('eventScoutingFileName', file.name);
    updateStatus(statusEl, file.name, true);
    renderRankingTable();
    updateRankingTableColumns();
    updateLatestMatchInfo();
    try { updateOverviewCharts(); } catch (e) { console.warn('Could not update overview charts on upload', e); }
  };
  reader.readAsText(file);
  setTimeout(initializeOverviewCharts, 500);

}

document.getElementById('submitData').addEventListener('click', handleDataUpload);

function updateLatestMatchInfo() {
  const el = document.getElementById('latestMatchInfoSidebar');
  if (!el) return;
  if (!csvText || !csvText.trim()) {
    el.textContent = 'Data up till Q—';
    return;
  }

  try {
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const data = parsed.data || [];
    let maxMatch = -1;
    data.forEach(row => {
      const mRaw = row['Match'] ?? row['Match Number'] ?? row['Match_Number'] ?? row['match'] ?? row['match_number'];
      if (mRaw === undefined || mRaw === null) return;
      const n = parseInt(String(mRaw).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(n) && n > maxMatch) maxMatch = n;
    });

    if (maxMatch === -1) el.textContent = 'Data up till Q—';
    else el.textContent = `Data up till Q${maxMatch}`;
  } catch (e) {
    console.error('Error parsing CSV for latest match:', e);
    el.textContent = 'Data up till Q—';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  updateLatestMatchInfo();
});

function loadPitScoutingData() {
  if (pitCsvText && pitCsvText.trim()) {
    try {
      const parsed = Papa.parse(pitCsvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
      });
      pitScoutingData = parsed.data.filter(row => {
        return row['Team Number'] &&
          row['Trench'] !== undefined &&
          row['Ground Intake'] !== undefined &&
          row['Shoot on Fly'] !== undefined;
      });
      console.log(`Loaded ${pitScoutingData.length} pit scouting records`);
    } catch (e) {
      console.error("Error loading pit scouting data:", e);
      pitScoutingData = [];
    }
  } else {
    pitScoutingData = [];
  }
}

async function handlePitUpload(e) {
  e.preventDefault();
  const fileInput = document.getElementById('pitFile');
  const statusEl = document.getElementById('statusPit');
  const file = fileInput.files[0];
  if (!file || !file.name.endsWith('.csv')) {
    statusEl.textContent = 'Please upload a valid .csv file.';
    return;
  }
  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const text = evt.target.result;
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false
      });

      if (result.data.length === 0) {
        statusEl.textContent = 'CSV file is empty.';
        return;
      }

      const firstRow = result.data[0];
      const hasTeamNumber = firstRow.hasOwnProperty('Team Number');
      const hasTrench = firstRow.hasOwnProperty('Trench');
      const hasGroundIntake = firstRow.hasOwnProperty('Ground Intake');
      const hasShootOnFly = firstRow.hasOwnProperty('Shoot on Fly');

      if (!hasTeamNumber || !hasTrench || !hasGroundIntake || !hasShootOnFly) {
        statusEl.textContent = 'CSV must have "Team Number", "Trench", "Ground Intake", and "Shoot on Fly" headers.';
        return;
      }

      pitCsvText = text;
      localStorage.setItem('pitCsvText', pitCsvText);
      statusEl.textContent = `Pit CSV uploaded successfully for ${result.data.length} teams!`;
    } catch (err) {
      statusEl.textContent = 'Error processing file';
      console.error(err);
    }
  };
  reader.readAsText(file);
}

document.getElementById('submitPit').addEventListener('click', handlePitUpload);


async function handleScheduleUpload(e) {
  e.preventDefault();
  const fileInput = document.getElementById('scheduleFile');
  const statusEl = document.getElementById('statusSchedule');
  const file = fileInput.files[0];

  if (!file || !file.name.endsWith('.csv')) {
    statusEl.textContent = 'Please upload a valid .csv file.';
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (evt) {
    try {
      const text = evt.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      const matchCount = Math.max(0, lines.length - 1);
      scheduleCsvText = text;
      localStorage.setItem('scheduleCsvText', scheduleCsvText);
      let uploadStatus = '';
      statusEl.textContent = `Successfully uploaded ${matchCount} matches${uploadStatus}`;
      generateTargetedScoutingBlocks();
    } catch (err) {
      statusEl.textContent = 'Error processing file';
      console.error(err);
    }
  };
  reader.readAsText(file);
}

document.getElementById('submitSchedule').addEventListener('click', handleScheduleUpload);

async function handleOPRUpload(e) {
  e.preventDefault();
  const fileInput = document.getElementById('oprFile');
  const statusEl = document.getElementById('statusOPR');
  const file = fileInput.files[0];

  if (!file || !file.name.endsWith('.csv')) {
    statusEl.textContent = 'Please upload a valid .csv file.';
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (evt) {
    try {
      const text = evt.target.result;
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false
      });

      if (result.data.length === 0) {
        statusEl.textContent = 'CSV file is empty.';
        return;
      }

      const firstRow = result.data[0];
      const hasTeamNumber = firstRow.hasOwnProperty('Team Number');
      const hasAutoOPR = firstRow.hasOwnProperty('Auto OPR');
      const hasTeleOPR = firstRow.hasOwnProperty('Tele OPR');
      const hasTotalOPR = firstRow.hasOwnProperty('Total OPR');

      if (!hasTeamNumber || !hasTeleOPR || !hasAutoOPR || !hasTotalOPR) {
        statusEl.textContent = 'CSV must have "Team Number", "Auto OPR", "Tele OPR", and "Total OPR" headers.';
        return;
      }

      oprCsvText = text;
      localStorage.setItem('oprCSV', oprCsvText);
      localStorage.setItem('oprFileName', file.name);
      updateStatus(statusEl, file.name, true);
      try { renderFuelOprChart(); } catch (e) { console.warn('Fuel OPR chart render failed', e); }
    } catch (err) {
      statusEl.textContent = 'Error processing file';
      console.error(err);
    }
  };
  reader.readAsText(file);
}

document.getElementById('submitOPR').addEventListener('click', handleOPRUpload);

async function uploadFile(fileInputId, statusId, uploadType) {
  const fileInput = document.getElementById(fileInputId);
  const statusEl = document.getElementById(statusId);
  const file = fileInput.files[0];

  if (!file || !file.name.endsWith(".csv")) {
    statusEl.textContent = "Please upload a valid .csv file.";
    return;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      csvText = e.target.result;
      localStorage.setItem('csvText', csvText);
      statusEl.textContent = "Event CSV uploaded!";
      renderRankingTable();
      updateRankingTableColumns();
      resolve();
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
function getLatestMatchNumber(data) {
  const matches = data.map(row => parseInt(row['Match'])).filter(n => !isNaN(n));
  return matches.length > 0 ? Math.max(...matches) : null;
}
async function handleDataUpload(e) {
  e.preventDefault();
  uploadFile('dataFile', 'statusData', 'csvData').then(() => {
    const parsedData = parseCSV();
    renderOverviewStackedChart(parsedData.data);
    renderFuelOprChart();
    updateDefenseRankings(parsedData.data);
    applyFilters();


    const latestMatch = getLatestMatchNumber(parsedData.data);
    if (latestMatch) {
      document.getElementById('latestMatchInfoSidebar').textContent = `Data up till Q${latestMatch}`;
    }
  });
  setTimeout(initializeOverviewCharts, 500);

}
async function handlePitUpload(e) {
  e.preventDefault();
  const fileInput = document.getElementById('pitFile');
  const statusEl = document.getElementById('statusPit');
  const file = fileInput.files[0];

  if (!file || !file.name.endsWith('.csv')) {
    statusEl.textContent = 'Please upload a valid .csv file.';
    return;
  }

  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const text = evt.target.result;
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
      });

      if (result.data.length === 0) {
        statusEl.textContent = 'CSV file is empty.';
        return;
      }

      const firstRow = result.data[0];
      const hasTeamNumber = firstRow.hasOwnProperty('Team Number');
      const hasTrench = firstRow.hasOwnProperty('Trench');
      const hasGroundIntake = firstRow.hasOwnProperty('Ground Intake');
      const hasShootOnFly = firstRow.hasOwnProperty('Shoot on Fly');

      if (!hasTeamNumber || !hasTrench || !hasGroundIntake || !hasShootOnFly) {
        statusEl.textContent = 'CSV must have "Team Number", "Trench", "Ground Intake", and "Shoot on Fly" headers.';
        console.log('Found headers:', Object.keys(firstRow));
        return;
      }

      pitScoutingData = result.data.filter(row => {
        return row['Team Number'] &&
          row['Trench'] !== undefined &&
          row['Ground Intake'] !== undefined &&
          row['Shoot on Fly'] !== undefined;
      });

      pitCsvText = text;
      localStorage.setItem('pitCsvText', pitCsvText);
      statusEl.textContent = `Pit CSV uploaded successfully for ${pitScoutingData.length} teams!`;

      const currentTeam = document.getElementById('teamSearch').value.trim();
      if (currentTeam) {
        const teamData = filterTeamData(currentTeam);
        if (teamData.length > 0) {
          renderTeamStatistics(teamData, pitScoutingData);
        }
      }

    } catch (err) {
      statusEl.textContent = 'Error processing file';
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function deleteFile(inputId) {
    let dataKey, statusDiv;
    
    switch(inputId) {
        case 'dataFile':
            dataKey = 'eventScouting';
            statusDiv = document.getElementById('statusData');
            break;
        case 'pitFile':
            dataKey = 'pitScouting';
            statusDiv = document.getElementById('statusPit');
            break;
        case 'scheduleFile':
            dataKey = 'matchSchedule';
            statusDiv = document.getElementById('statusSchedule');
            break;
        case 'oprFile':
            dataKey = 'opr';
            statusDiv = document.getElementById('statusOPR');
            break;
        default:
            return;
    }
    
    if (!localStorage.getItem(`${dataKey}CSV`)) {
        return;
    }
    
    if (dataKey === 'eventScouting') eventScoutingData = [];
    if (dataKey === 'pitScouting') pitScoutingData = [];
    if (dataKey === 'matchSchedule') matchScheduleData = [];
    if (dataKey === 'opr') oprData = [];
    
    localStorage.removeItem(`${dataKey}CSV`);
    localStorage.removeItem(`${dataKey}FileName`);
    
    document.getElementById(inputId).value = '';
    
    statusDiv.style.background = "#1a1c1f";
    statusDiv.style.border = "2px solid #2a2d31";
    statusDiv.style.color = "#ffffff";
    statusDiv.innerHTML = `<p style="text-align: center; font-size: 1rem; color: #ccc;">No file uploaded.</p>`;
    statusDiv.classList.remove('uploaded');
    
    updateVisualizerWithData(dataKey, []);
}

function parseScheduleCSV() {
  const scheduleText = localStorage.getItem('scheduleCsvText');
  if (!scheduleText) return { data: [] };
  try {
    return Papa.parse(scheduleText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });
  } catch (e) {
    console.error('Error parsing schedule CSV:', e);
    return { data: [] };
  }
}


/*-----CHART FUNCTIONS----*/

function destroyChart(chartName) {
  if (charts[chartName]) {
    charts[chartName].destroy();
    charts[chartName] = null;
  }
}

function createChart(ctx, type, data, options) {
  return new Chart(ctx, { type, data, options });
}

function getChartOptions(stacked = false, stepSize = 1) {
  return {
    responsive: true,
    devicePixelRatio: 3,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1C1E21',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#000',
        borderWidth: 1,
        titleFont: { family: 'Lato', size: 14 },
        bodyFont: { family: 'Lato', size: 14 },
        padding: 10
      }
    },
    scales: {
      x: {
        stacked: stacked,
        ticks: {
          color: 'white',
          font: { family: 'Lato', size: 12, weight: 'bold' }
        }
      },
      y: {
        stacked: stacked,
        beginAtZero: true,
        ticks: {
          color: 'white',
          stepSize: stepSize,
          font: { family: 'Lato', size: 14, weight: 'bold' }
        }
      }
    }
  };
}

function clearAllCharts() {
  if (charts['overviewStackedChart']) {
    charts['overviewStackedChart'].destroy();
    charts['overviewStackedChart'] = null;
  }
  if (charts['fuelOprChart']) {
    charts['fuelOprChart'].destroy();
    charts['fuelOprChart'] = null;
  }

  Object.keys(charts).forEach(chartName => {
    if (charts[chartName]) {
      charts[chartName].destroy();
      charts[chartName] = null;
    }
  });

  document.getElementById('teamSearch').value = '';
  document.getElementById('flaggedMatches').innerHTML = '';
  document.getElementById('scouterComments').innerHTML = '';

  const statElements = [
    'climbSuccessRate', 'robotDiedRate', 'groundBarge', 'groundProcessor',
    'averageEPA', 'averageCoral', 'averageAlgae', 'maxCoral', 'maxCoralMatch',
    'maxAlgae', 'maxAlgaeMatch'
  ];

  statElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = id.includes('Rate') || id.includes('average') ? '0.00' :
        id.includes('max') ? '0' :
          id.includes('ground') ? '❌' : '';
    }
  });

  document.getElementById('comparisonSearch1').value = '';
  document.getElementById('comparisonSearch2').value = '';
}


/*-----EVENT LISTENERS----*/

function showTab(event, tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(button => {
    button.classList.remove('active');
    button.removeAttribute('disabled');
    button.style.pointerEvents = 'auto';
    button.style.opacity = '1';
  });

  if (tabId === 'filterTeams') {
    try {
      loadPitScoutingData();
      applyFilters();
      saveFilterViewState();
    } catch (err) {
      console.error('Error applying filters on tab show:', err);
    }
  }
  document.getElementById(tabId).classList.add('active');
  event.currentTarget.classList.add('active');

  document.querySelector('.content').scrollTo({ top: 0, behavior: 'auto' });

  if (tabId === 'scoutingSchedule') {
    document.getElementById('strategyContent').style.display = 'block';
    document.getElementById('targetedScoutingContainer').style.display = 'none';
    generateTargetedScoutingBlocks();
    const btn = document.getElementById('viewToggleBtn');
    const title = document.getElementById('scoutingScheduleTitle');
    if (btn && title) {
      title.textContent = "Strategist's View";
      btn.textContent = "Switch to Targeted Scouting";
    }
  }

  try {
    if (typeof renderHiddenTeamsList === 'function') renderHiddenTeamsList();
  } catch (err) { }
  try {
    if (typeof renderHiddenTeamsListRanking === 'function') renderHiddenTeamsListRanking();
  } catch (err) { }

  if (tabId === 'ranking') {
    try { renderRankingTable(); } catch (e) { }
    try { updateRankingTableColumns(); } catch (e) { }
  }

  if (tabId === 'overview') {
    try {
      const parsed = parseCSV();
      const data = (parsed && parsed.data) ? parsed.data : [];

      if (!data || data.length === 0) {
        renderBlankChart('overviewStackedChart', 'No Data');
        renderBlankChart('fuelOprChart', 'No Data');
      } else {
        renderOverviewStackedChart(data);
        renderFuelOprChart();
      }
    } catch (err) {
      console.error('Error rendering overview charts on tab show:', err);
    }
  }
}


document.addEventListener('DOMContentLoaded', () => {
  const searchButton = document.getElementById('search');
  if (searchButton) {
    searchButton.addEventListener('click', function (e) {
      e.preventDefault();
      searchTeam();
    });
  }

  const teamSearch = document.getElementById('teamSearch');
  if (teamSearch) {
    teamSearch.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchTeam();
      }
    });
  }

  const hideTeamInput = document.getElementById('hideTeamInput');
  if (hideTeamInput) {
    hideTeamInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('addHideTeamButton')?.click();
      }
    });
  }

  const matchNumberInput = document.getElementById('matchNumberInput');
  if (matchNumberInput) {
    matchNumberInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('predict-button')?.click();
      }
    });
  }

  const teleClimbPositionFilterDropdown = document.getElementById('teleClimbPositionFilterDropdown');
  if (teleClimbPositionFilterDropdown) {
    teleClimbPositionFilterDropdown.addEventListener('change', function () {
      filterTeleClimbByPosition();
    });
  }
});

// CSV Upload
document.getElementById('submitData').addEventListener('click', handleDataUpload);

// Filter Teams
document.getElementById('addHideTeamButton').addEventListener('click', addHiddenTeam);
document.getElementById('resetHideTeamButton').addEventListener('click', resetHiddenTeams);
document.getElementById('toggleHiddenTeamsButton').addEventListener('click', toggleHiddenTeams);
document.querySelectorAll('#filterCheckboxesContainer input[type="checkbox"]').forEach(checkbox => {
  checkbox.addEventListener('change', () => { applyFilters(); saveFilterViewState(); });
});
document.getElementById('filterTeamsDropdown').addEventListener('change', applyFilters);
document.getElementById('filterTeamsDropdown').addEventListener('change', () => { saveFilterViewState(); });

// Chart Filters
document.getElementById('chartFilterDropdown').addEventListener('change', updateOverviewCharts);
document.querySelectorAll('#startingPositionFilter').forEach(dropdown => {
  dropdown.addEventListener('change', function () {
    syncDropdowns(this.value);
  });
});

// Comparison View
document.getElementById('comparisonSearch1').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    searchComparison(1);
  }
});
document.getElementById('comparisonSearch2').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    searchComparison(2);
  }
});

// Overview
document.getElementById('overviewSearch').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    handleOverviewSearch();
  }
});

/*-----INDIVIDUAL VIEW----*/

function filterTeamData(teamNumber) {
  if (!teamNumber) return [];
  const parsed = parseCSV();
  if (!parsed || !parsed.data) return [];
  return parsed.data.filter(row => row['Team Number'] === teamNumber.toString().trim());
}


function filterAutoData() {
  if (!currentTeamData || currentTeamData.length === 0) return;

  const autoPathFilter = document.getElementById('autoPathFilter')?.value || 'all';
  const autoClimbFilter = document.getElementById('autoClimbFilter')?.value || 'all';

  let filteredData = currentTeamData;

  if (autoPathFilter !== 'all' || autoClimbFilter !== 'all') {
    const filterValue = autoPathFilter !== 'all' ? autoPathFilter : autoClimbFilter;
    filteredData = currentTeamData.filter(row => {
      const startingPos = row['Starting Position']?.toString().trim();
      return startingPos === filterValue;
    });
  }

  renderAutoPaths(filteredData);
  renderAutoClimbChart(filteredData);
}

function filterAutoPaths() {
  if (!currentTeamData || currentTeamData.length === 0) return;

  const filterValue = document.getElementById('autoPathFilter')?.value || 'all';

  let filteredData = currentTeamData;
  if (filterValue !== 'all') {
    filteredData = currentTeamData.filter(row => {
      const startingPos = row['Starting Position']?.toString().trim();
      return startingPos === filterValue;
    });
  }

  renderAutoPaths(filteredData);
}

function filterAutoClimb() {
  if (!currentTeamData || currentTeamData.length === 0) return;

  const filterValue = document.getElementById('autoClimbFilter')?.value || 'all';

  let filteredData = currentTeamData;
  if (filterValue !== 'all') {
    filteredData = currentTeamData.filter(row => {
      const startingPos = row['Starting Position']?.toString().trim();
      return startingPos === filterValue;
    });
  }

  renderAutoClimbChart(filteredData);
}

function syncIndividualViewDropdowns(value) {
  const autoPathFilter = document.getElementById('autoPathFilter');
  const autoClimbFilter = document.getElementById('autoClimbFilter');

  if (autoPathFilter && autoClimbFilter) {
    autoPathFilter.value = value;
    autoClimbFilter.value = value;
    filterAutoData();
  }
}


function searchTeam() {
  console.log("=== searchTeam() called ===");

  const teamNumber = document.getElementById('teamSearch').value.trim();
  console.log("Team number entered:", teamNumber);

  if (!teamNumber) {
    console.log("No team number entered");
    return;
  }


  if (!csvText || csvText.length === 0) {
    console.error("No CSV data loaded!");
    alert("Please upload event data CSV first");
    return;
  }

  const teamData = filterTeamData(teamNumber);
  console.log("filterTeamData returned:", teamData);
  console.log("Number of matches found:", teamData.length);

  currentTeamData = teamData;

  if (teamData.length === 0) {
    console.log('No data found for team:', teamNumber);
    document.getElementById('flaggedMatches').innerHTML = '<p style="color: #aaa; margin: 0; font-size: 16px;">No data available</p>';

    document.getElementById('trench').textContent = '❌';
    document.getElementById('groundIntake').textContent = '❌';
    document.getElementById('shootOnFly').textContent = '❌';

    const autoClimbCanvas = document.getElementById('autoClimbChart');
    if (autoClimbCanvas) {
      const ctx = autoClimbCanvas.getContext('2d');
      ctx.clearRect(0, 0, autoClimbCanvas.width, autoClimbCanvas.height);
    }
    const teleClimbCanvas = document.getElementById('teleClimbChart');
    if (teleClimbCanvas) {
      const ctx = teleClimbCanvas.getContext('2d');
      ctx.clearRect(0, 0, teleClimbCanvas.width, teleClimbCanvas.height);
    }

    const autoPathContent = document.getElementById('autoPathContent');
    if (autoPathContent) {
      autoPathContent.innerHTML = '<p style="color: #aaa; margin: 0; font-size: 14px;">No auto path data</p>';
    }
    return;
  }

  const autoPathFilter = document.getElementById('autoPathFilter');
  const autoClimbFilter = document.getElementById('autoClimbFilter');
  const teleClimbPositionFilterDropdown = document.getElementById('teleClimbPositionFilterDropdown');

  if (autoPathFilter) autoPathFilter.value = 'all';
  if (autoClimbFilter) autoClimbFilter.value = 'all';
  if (teleClimbPositionFilterDropdown) teleClimbPositionFilterDropdown.value = 'all';

  teleClimbPositionFilterValue = 'all';

  let pitData = [];
  console.log("pitCsvText exists:", !!pitCsvText);

  if (pitCsvText && pitCsvText.trim()) {
    try {
      const parsed = Papa.parse(pitCsvText, { header: true, skipEmptyLines: true });
      pitData = parsed.data.filter(row => {
        return row['Team Number'] &&
          (row['Trench'] !== undefined) &&
          (row['Ground Intake'] !== undefined) &&
          (row['Shoot on Fly'] !== undefined);
      });
      console.log("Pit data parsed, found:", pitData.length, "teams");
    } catch (e) {
      console.error("Error parsing pit data:", e);
    }
  }

  renderTeamStatistics(teamData, pitData);
  renderFlaggedMatches(teamData);
  renderAutoClimbChart(teamData);
  renderTeleClimbChart(teamData);
  renderAutoPaths(teamData);
  renderScouterComments(teamData);
  return false;
}

function renderScouterComments(teamData) {
  const container = document.getElementById('scouterComments');
  if (!container) {
    console.warn('scouterComments container not found');
    return;
  }

  container.innerHTML = '';

  if (!teamData || teamData.length === 0) {
    container.innerHTML = '<p style="color: #aaa; margin: 0; font-size: 14px;">No scouter comments available</p>';
    return;
  }

  const sortedData = [...teamData].sort((a, b) => {
    const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
    const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
    return matchA - matchB;
  });

  const commentEntries = [];

  sortedData.forEach(row => {
    const matchNum = row['Match'] || row['Match Number'];
    if (!matchNum) return;

    const comment = (row['Comments'] || '').toString().trim();

    if (!comment || comment === '' || comment === 'N/A' || comment === 'NA' || comment === 'none' || comment === 'None') return;

    commentEntries.push(`
      <div style="margin-bottom: 16px; font-size: 18px; line-height: 1.5;">
        <strong style="color: white; font-size: 15px;">Q${matchNum}:</strong> 
        <span style="color: #ddd;">${escapeHtml(comment)}</span>
      </div>
    `);
  });

  if (commentEntries.length === 0) {
    container.innerHTML = '<p style="color: #aaa; margin: 0; font-size: 14px;">No scouter comments available</p>';
    return;
  }

  container.innerHTML = commentEntries.join('');
}

function renderTeamStatistics(teamData, pitScoutingData) {
  if (!teamData || teamData.length === 0) return;

  const teamNumber = teamData[0]['Team Number']?.toString().trim();

  let hasTrench = false;
  let hasGroundIntake = false;
  let hasShootOnFly = false;

  if (pitScoutingData && pitScoutingData.length > 0) {
    const pitData = pitScoutingData.find(row => {
      const teamNum = row['Team Number']?.toString().trim();
      return teamNum === teamNumber;
    });

    if (pitData) {
      hasTrench = pitData['Trench'] === '1' || pitData['Trench'] === 1 || pitData['Trench'] === true;
      hasGroundIntake = pitData['Ground Intake'] === '1' || pitData['Ground Intake'] === 1 || pitData['Ground Intake'] === true;
      hasShootOnFly = pitData['Shoot on Fly'] === '1' || pitData['Shoot on Fly'] === 1 || pitData['Shoot on Fly'] === true;
    }
  }

  document.getElementById('trench').textContent = hasTrench ? '✅' : '❌';
  document.getElementById('groundIntake').textContent = hasGroundIntake ? '✅' : '❌';
  document.getElementById('shootOnFly').textContent = hasShootOnFly ? '✅' : '❌';

  const totalPoints = teamData.map(row => parseFloat(row['Total Points'] || row['Total Score'] || 0)).filter(v => !isNaN(v));
  const avgTotalPoints = totalPoints.length > 0 ? totalPoints.reduce((a, b) => a + b, 0) / totalPoints.length : 0;

  let autoOPR = 0;
  let teleOPR = 0;
  let totalOPR = 0;

  if (oprCsvText && oprCsvText.trim()) {
    const parsed = Papa.parse(oprCsvText, { header: true, skipEmptyLines: true });
    const oprData = parsed.data.find(row => {
      const teamNum = row['Team Number']?.toString().trim();
      return teamNum === teamNumber;
    });

    if (oprData) {
      autoOPR = parseFloat((oprData['Auto OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0;
      teleOPR = parseFloat((oprData['Tele OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0;
      totalOPR = parseFloat((oprData['Total OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0;
    }
  }

  const epa = avgTotalPoints + totalOPR;

  const shootingAccuracy = (() => {
    const accuracyVals = teamData
      .map(row => parseFloat(row['Shooting Accuracy']))
      .filter(v => !isNaN(v));
    return accuracyVals.length > 0
      ? (accuracyVals.reduce((a, b) => a + b, 0) / accuracyVals.length).toFixed(2)
      : '0.00';
  })();

  document.getElementById('averageEPA').textContent = epa.toFixed(2);
  document.getElementById('totalOPR').textContent = totalOPR.toFixed(2);
  document.getElementById('shootingAccuracy').textContent = shootingAccuracy;

  const climbTimeVals = teamData
    .map(row => parseFloat(row['Climb Time per Level']))
    .filter(v => !isNaN(v) && v > 0);

  let climbTimePerLevel = 0;
  if (climbTimeVals.length > 0) {
    climbTimePerLevel = climbTimeVals.reduce((a, b) => a + b, 0) / climbTimeVals.length;
    climbTimePerLevel = Math.round(climbTimePerLevel * 10) / 10;
  }
  document.getElementById('climbTimePerLevel').textContent = climbTimePerLevel.toFixed(2);

  const climbValues = teamData.map(row => row['Climb Teleop']?.toString().trim()).filter(v => v && v !== '');

  const successfulClimbs = climbValues.filter(v => ['1', '2', '3'].includes(v)).length;
  const totalClimbAttempts = climbValues.filter(v => ['1', '2', '3', 'F'].includes(v)).length;

  const climbSuccessRate = totalClimbAttempts > 0 ? ((successfulClimbs / totalClimbAttempts) * 100).toFixed(1) : "0.0";
  document.getElementById('climbSuccessRate').textContent = climbSuccessRate;

  const diedCount = teamData.filter(row => {
    const val = parseFloat(row['Robot Died'] || row['Died or Immobilized'] || 0);
    return val === 0.5 || val === 1;
  }).length;
  const robotDiedRate = teamData.length ? ((diedCount / teamData.length) * 100).toFixed(1) : '0.0';
  document.getElementById('robotDiedRate').textContent = robotDiedRate;
}
function renderFlaggedMatches(teamData) {
  const container = document.getElementById('flaggedMatches');
  if (!container) {
    console.warn('flaggedMatches container not found');
    return;
  }

  container.innerHTML = '';

  if (!teamData || teamData.length === 0) {
    container.innerHTML = '<p style="color: #aaa; margin: 0; font-size: 16px;">No flagged matches</p>';
    return;
  }

  const sortedData = [...teamData].sort((a, b) => {
    const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
    const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
    return matchA - matchB;
  });

  const flaggedMatches = [];

  sortedData.forEach(row => {
    const matchNum = row['Match'] || row['Match Number'];
    if (!matchNum) return;

    const reasons = [];

    const robotDied = parseFloat(row['Robot Died'] || row['Died or Immobilized'] || 0);
    if (robotDied > 0) {
      reasons.push('Robot Died');
    }

    const robotDefense = parseFloat(row['Robot Defense'] || row['Defense Rating'] || 0);
    if (robotDefense > 0) {
      reasons.push('Played Defense');
    }

    const defenseOnRobot = parseFloat(row['Defense On Robot'] || 0);
    if (defenseOnRobot > 0) {
      reasons.push('Defended On');
    }

    if (reasons.length > 0) {
      flaggedMatches.push(`<div style="margin-bottom: 16px; font-size: 16px; line-height: 1.5;"><strong style="font-size: 16px;">Q${matchNum}:</strong> ${reasons.join(', ')}</div>`);
    }
  });

  if (flaggedMatches.length === 0) {
    container.innerHTML = '<p style="color: #aaa; margin: 0; font-size: 16px;">No flagged matches</p>';
    return;
  }

  container.innerHTML = flaggedMatches.join('');
}

function renderAutoClimbChart(teamData) {
  const canvas = document.getElementById('autoClimbChart');
  if (!canvas) {
    console.warn('autoClimbChart canvas not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  if (charts.autoClimbChart) {
    charts.autoClimbChart.destroy();
    charts.autoClimbChart = null;
  }

  if (!teamData || teamData.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No auto climb data', canvas.width / 2, canvas.height / 2);
    return;
  }

  const sortedData = [...teamData].sort((a, b) => {
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

    let yValue = 0;
    let color = '#3EDBF0';
    let tooltipText = '';

    if (climbAuto === '1') {
      yValue = 1;
      color = '#3EDBF0';
      tooltipText = 'Level 1';
    } else if (climbAuto === 'F') {
      yValue = .5;
      color = '#ff5c5c';
      tooltipText = 'Failed';
    } else if (climbAuto === '0') {
      yValue = 0;
      color = '#3EDBF0';
      tooltipText = 'Not Attempted';
    }

    climbValues.push(yValue);
    barColors.push(color);
    tooltipLabels.push(tooltipText);
  });

  if (matches.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No auto climb data', canvas.width / 2, canvas.height / 2);
    return;
  }

  charts.autoClimbChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: matches,
      datasets: [{
        label: 'Auto Climb',
        data: climbValues,
        backgroundColor: barColors,
        borderWidth: 0,
        borderRadius: 6,
        barPercentage: 1,
        categoryPercentage: .9,
        maxBarThickness: 75
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 2,
      layout: {
        padding: {
          bottom: 35,
          top: 25
        }
      },
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
          padding: 10,
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
              const index = context.dataIndex;
              return tooltipLabels[index];
            },
            title: function (context) {
              return context[0].label;
            }
          }
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
              size: 16,
              weight: 'bold'
            },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            padding: 10
          }
        },
        y: {
          beginAtZero: true,
          max: 1,
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
              size: 16,
              weight: 'bold'
            },
            stepSize: 1,
            callback: function (value) {
              return value;
            },
            padding: 10
          }
        }
      }
    }
  });
}

function filterTeleClimbByPosition() {
  if (!currentTeamData || currentTeamData.length === 0) return;

  const filterValue = document.getElementById('teleClimbPositionFilterDropdown')?.value || 'all';
  teleClimbPositionFilterValue = filterValue;

  let filteredData = currentTeamData;

  if (filterValue !== 'all') {
    filteredData = currentTeamData.filter(row => {
      const startingPos = row['Starting Position']?.toString().trim();
      return startingPos === filterValue;
    });
  }

  renderTeleClimbChart(filteredData);
}

function renderTeleClimbChart(teamData) {
  const canvas = document.getElementById('teleClimbChart');
  if (!canvas) {
    console.warn('teleClimbChart canvas not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  if (charts.teleClimbChart) {
    charts.teleClimbChart.destroy();
    charts.teleClimbChart = null;
  }

  if (!teamData || teamData.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No tele climb data', canvas.width / 2, canvas.height / 2);
    return;
  }

  let dataToRender = teamData;
  if (teleClimbPositionFilterValue !== 'all') {
    dataToRender = teamData.filter(row => {
      const startingPos = row['Starting Position']?.toString().trim();
      return startingPos === teleClimbPositionFilterValue;
    });

    if (dataToRender.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '16px Lato';
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'center';
      ctx.fillText(`No tele climb data for ${getPositionName(teleClimbPositionFilterValue)} position`, canvas.width / 2, canvas.height / 2);
      return;
    }
  }

  const sortedData = [...dataToRender].sort((a, b) => {
    const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
    const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
    return matchA - matchB;
  });

  const matches = [];
  const climbValues = [];
  const barColors = [];
  const tooltipLevels = [];
  const tooltipTimes = [];
  const tooltipPositions = [];

  sortedData.forEach(row => {
    const matchNum = row['Match'] || row['Match Number'];
    if (!matchNum) return;

    const climbTeleop = row['Climb Teleop']?.toString().trim();
    if (!climbTeleop || climbTeleop === '') return;

    matches.push(`Q${matchNum}`);

    const climbTime = row['Climb Time']?.toString().trim() || 'N/A';

    const startingPos = row['Starting Position']?.toString().trim() || '';
    const positionName = getPositionName(startingPos);

    let yValue = 0;
    let color = '#3EDBF0';
    let levelText = '';
    let timeText = '';

    if (climbTeleop === '3') {
      yValue = 3;
      color = '#3EDBF0';
      levelText = 'Level 3';
      timeText = climbTime !== 'N/A' ? `Time: ${climbTime}s` : 'Time: N/A';
    } else if (climbTeleop === '2') {
      yValue = 2;
      color = '#3EDBF0';
      levelText = 'Level 2';
      timeText = climbTime !== 'N/A' ? `Time: ${climbTime}s` : 'Time: N/A';
    } else if (climbTeleop === '1') {
      yValue = 1;
      color = '#3EDBF0';
      levelText = 'Level 1';
      timeText = climbTime !== 'N/A' ? `Time: ${climbTime}s` : 'Time: N/A';
    } else if (climbTeleop === 'F') {
      yValue = 0.5;
      color = '#ff5c5c';
      levelText = 'Failed';
      timeText = climbTime !== 'N/A' ? `Time: ${climbTime}s` : 'Time: N/A';
    } else if (climbTeleop === '0') {
      yValue = 0;
      color = '#3EDBF0';
      levelText = 'Not Attempted';
      timeText = '';
    }

    climbValues.push(yValue);
    barColors.push(color);
    tooltipLevels.push(levelText);
    tooltipTimes.push(timeText);
    tooltipPositions.push(positionName);
  });

  if (matches.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No tele climb data', canvas.width / 2, canvas.height / 2);
    return;
  }

  charts.teleClimbChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: matches,
      datasets: [{
        label: 'Tele Climb',
        data: climbValues,
        backgroundColor: barColors,
        borderWidth: 0,
        borderRadius: 6,
        barPercentage: 1,
        categoryPercentage: .9,
        maxBarThickness: 75
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 2,
      layout: {
        padding: {
          bottom: 35,
          top: 25
        }
      },
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
          padding: 10,
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
              const index = context.dataIndex;
              const lines = [tooltipLevels[index]];

              if (tooltipTimes[index]) {
                lines.push(tooltipTimes[index]);
              }

              if (tooltipPositions[index] && tooltipPositions[index] !== '') {
                lines.push(`Position: ${tooltipPositions[index]}`);
              }

              return lines;
            },
            title: function (context) {
              return context[0].label;
            }
          }
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
              size: 13,
              weight: 'bold'
            },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            padding: 10
          }
        },
        y: {
          beginAtZero: true,
          max: 3,
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
              size: 13,
              weight: 'bold'
            },
            stepSize: 1,
            callback: function (value) {
              return value;
            },
            padding: 10
          }
        }
      }
    }
  });
}

function getPositionName(value) {
  switch (value) {
    case 'D': return 'Depot';
    case 'C': return 'Center';
    case 'O': return 'Outpost';
    default: return value || 'Unknown';
  }
}
function renderAutoPaths(teamData) {
  const container = document.getElementById('autoPathContent');
  if (!container) {
    console.warn('autoPathContent container not found');
    return;
  }

  container.innerHTML = '';

  if (!teamData || teamData.length === 0) {
    container.innerHTML = '<p style="color: #aaa; margin: 0; font-size: 14px;">No auto path data</p>';
    return;
  }

  const sortedData = [...teamData].sort((a, b) => {
    const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
    const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
    return matchA - matchB;
  });

  const pathEntries = [];

  sortedData.forEach(row => {
    const matchNum = row['Match'] || row['Match Number'];
    if (!matchNum) return;

    const travelString = (row['Travel String'] || '').toString().trim();
    const fuelString = (row['Fuel Collection String'] || '').toString().trim();

    if (!travelString && !fuelString) return;

    let sentence = '';

    if (travelString && fuelString) {
      sentence = `${travelString} and ${fuelString}`;
    } else if (travelString) {
      sentence = travelString;
    } else if (fuelString) {
      sentence = fuelString.charAt(0).toUpperCase() + fuelString.slice(1);
    }

    if (sentence && !/[.!?]$/.test(sentence)) {
      sentence = sentence + '.';
    }

    if (sentence) {
      pathEntries.push(`
        <div style="margin-bottom: 16px; font-size: 18px; line-height: 1.5;">
          <strong style="color: white; font-size: 15px;">Q${matchNum}:</strong> 
          <span style="color: #ddd;">${escapeHtml(sentence)}</span>
        </div>
      `);
    }
  });

  if (pathEntries.length === 0) {
    container.innerHTML = '<p style="color: #aaa; margin: 0; font-size: 14px;">No auto path data</p>';
    return;
  }

  container.innerHTML = pathEntries.join('');
}


function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/*-----COMPARISION VIEW----*/

window.comparisonTeamData = {
  1: [],
  2: []
};

window.comparisonCharts = {
  autoClimb1: null,
  autoClimb2: null,
  teleClimb1: null,
  teleClimb2: null
};

function renderComparisonTeamStatistics(teamData, pitScoutingData, column) {
  if (!teamData || teamData.length === 0) return;

  const teamNumber = teamData[0]['Team Number']?.toString().trim();

  let hasTrench = false;
  let hasGroundIntake = false;
  let hasShootOnFly = false;

  if (pitScoutingData && pitScoutingData.length > 0) {
    const pitData = pitScoutingData.find(row => {
      const teamNum = row['Team Number']?.toString().trim();
      return teamNum === teamNumber;
    });

    if (pitData) {
      hasTrench = pitData['Trench'] === '1' || pitData['Trench'] === 1 || pitData['Trench'] === true;
      hasGroundIntake = pitData['Ground Intake'] === '1' || pitData['Ground Intake'] === 1 || pitData['Ground Intake'] === true;
      hasShootOnFly = pitData['Shoot on Fly'] === '1' || pitData['Shoot on Fly'] === 1 || pitData['Shoot on Fly'] === true;
    }
  }

  document.getElementById(`comparisonTrench${column}`).textContent = hasTrench ? '✅' : '❌';
  document.getElementById(`comparisonGroundIntake${column}`).textContent = hasGroundIntake ? '✅' : '❌';
  document.getElementById(`comparisonShootOnFly${column}`).textContent = hasShootOnFly ? '✅' : '❌';

  const totalPoints = teamData.map(row => parseFloat(row['Total Points'] || row['Total Score'] || 0)).filter(v => !isNaN(v));
  const avgTotalPoints = totalPoints.length > 0 ? totalPoints.reduce((a, b) => a + b, 0) / totalPoints.length : 0;

  let autoOPR = 0;
  let teleOPR = 0;
  let totalOPR = 0;

  if (oprCsvText && oprCsvText.trim()) {
    const parsed = Papa.parse(oprCsvText, { header: true, skipEmptyLines: true });
    const oprData = parsed.data.find(row => {
      const teamNum = row['Team Number']?.toString().trim();
      return teamNum === teamNumber;
    });

    if (oprData) {
      autoOPR = parseFloat((oprData['Auto OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0;
      teleOPR = parseFloat((oprData['Tele OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0;
      totalOPR = parseFloat((oprData['Total OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0;
    }
  }

  const epa = Math.round((avgTotalPoints + totalOPR) * 10) / 10;
  
  const shootingAccuracy = (() => {
    const accuracyVals = teamData
      .map(row => parseFloat(row['Shooting Accuracy']))
      .filter(v => !isNaN(v));
    return accuracyVals.length > 0
      ? (accuracyVals.reduce((a, b) => a + b, 0) / accuracyVals.length).toFixed(2)
      : '0.00';
  })();

  document.getElementById(`comparisonEPA${column}`).textContent = epa.toFixed(1);
  document.getElementById(`comparisonTotalOPR${column}`).textContent = totalOPR.toFixed(2);
  document.getElementById(`comparisonShootingAccuracy${column}`).textContent = shootingAccuracy;

  const climbTimeVals = teamData
    .map(row => parseFloat(row['Climb Time per Level']))
    .filter(v => !isNaN(v) && v > 0);

  let climbTimePerLevel = 0;
  if (climbTimeVals.length > 0) {
    climbTimePerLevel = climbTimeVals.reduce((a, b) => a + b, 0) / climbTimeVals.length;
    climbTimePerLevel = Math.round(climbTimePerLevel * 10) / 10;
  }
  document.getElementById(`comparisonClimbTime${column}`).textContent = climbTimePerLevel.toFixed(2);

  const climbValues = teamData.map(row => row['Climb Teleop']?.toString().trim()).filter(v => v && v !== '');

  const successfulClimbs = climbValues.filter(v => ['1', '2', '3'].includes(v)).length;
  const totalClimbAttempts = climbValues.filter(v => ['1', '2', '3', 'F'].includes(v)).length;

  const climbSuccessRate = totalClimbAttempts > 0 ? ((successfulClimbs / totalClimbAttempts) * 100).toFixed(1) : "0.0";
  document.getElementById(`comparisonClimbRate${column}`).textContent = climbSuccessRate;

  const diedCount = teamData.filter(row => {
    const val = parseFloat(row['Robot Died'] || row['Died or Immobilized'] || 0);
    return val === 0.5 || val === 1;
  }).length;
  const robotDiedRate = teamData.length ? ((diedCount / teamData.length) * 100).toFixed(1) : '0.0';
  document.getElementById(`comparisonDiedRate${column}`).textContent = robotDiedRate;
}
function searchComparison(column) {

  if (!window.comparisonTeamData) {
    window.comparisonTeamData = { 1: [], 2: [] };
  }
  if (!window.comparisonCharts) {
    window.comparisonCharts = {
      autoClimb1: null,
      autoClimb2: null,
      teleClimb1: null,
      teleClimb2: null
    };
  }

  const inputElement = document.getElementById(`comparisonSearch${column}`);

  if (!inputElement) {
    console.error(`Input element comparisonSearch${column} not found!`);
    return;
  }

  const teamNumber = inputElement.value.trim();

  if (!teamNumber) {
    console.log('No team number entered');
    return;
  }

  if (!csvText || csvText.length === 0) {
    console.error("No CSV data loaded!");
    alert("Please upload event data CSV first");
    return;
  }

  let parsed;
  try {
    parsed = Papa.parse(csvText, { header: true });
  } catch (error) {
    console.error('Error parsing CSV:', error);
    alert('Error parsing CSV data');
    return;
  }

  if (!parsed || !parsed.data) {
    console.error('Parsed data is empty');
    return;
  }

  const teamData = parsed.data.filter(row => {
    const rowTeam = row['Team Number']?.toString().trim();
    return rowTeam === teamNumber;
  });

  console.log(`Found ${teamData.length} matches for team ${teamNumber}`);

  if (teamData.length === 0) {
    document.getElementById(`comparisonAutoPaths${column}`).innerHTML =
      '<p style="color: #ff5c5c;">No data found for this team</p>';
    document.getElementById(`comparisonComments${column}`).innerHTML =
      '<p style="color: #ff5c5c;">No data found for this team</p>';

    const canvas = document.getElementById(`comparisonAutoClimbChart${column}`);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '16px Lato';
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'center';
      ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
    }
    return;
  }

  window.comparisonTeamData[column] = teamData;

  loadPitScoutingData();

  renderComparisonTeamStatistics(teamData, pitScoutingData, column);

  displayAutoPaths(column);
  displayScouterComments(column);
  renderComparisonAutoClimbChart(column);
  renderComparisonTeleClimbChart(column);

  document.getElementById(`comparisonAutoPathFilter${column}`).value = 'all';
  document.getElementById(`comparisonAutoClimbFilter${column}`).value = 'all';
}
function displayAutoPaths(column) {

  const container = document.getElementById(`comparisonAutoPaths${column}`);

  if (!container) {
    console.error(`Container comparisonAutoPaths${column} not found`);
    return;
  }

  container.innerHTML = '';

  if (!window.comparisonTeamData) {
    console.error('comparisonTeamData not initialized');
    container.innerHTML = '<p style="color: #ff5c5c;">Error: Data not initialized</p>';
    return;
  }

  const teamData = window.comparisonTeamData[column];

  if (!teamData || teamData.length === 0) {
    container.innerHTML = '<p style="color: #aaa; margin: 0;">No auto path data</p>';
    return;
  }

  const filterValue = document.getElementById(`comparisonAutoPathFilter${column}`)?.value || 'all';

  let filteredData = teamData;
  if (filterValue !== 'all') {
    filteredData = teamData.filter(row => {
      const startingPos = row['Starting Position']?.toString().trim();
      return startingPos === filterValue;
    });
  }

  if (filteredData.length === 0) {
    container.innerHTML = `<p style="color: #aaa; margin: 0;">No auto path data for ${getPositionName(filterValue)} position</p>`;
    return;
  }

  const sortedData = [...filteredData].sort((a, b) => {
    const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
    const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
    return matchA - matchB;
  });

  const pathEntries = [];

  sortedData.forEach(row => {
    const matchNum = row['Match'] || row['Match Number'];
    if (!matchNum) return;

    const travelString = (row['Travel String'] || '').toString().trim();
    const fuelString = (row['Fuel Collection String'] || '').toString().trim();

    if (!travelString && !fuelString) return;

    let sentence = '';
    if (travelString && fuelString) {
      sentence = `${travelString} and ${fuelString}`;
    } else if (travelString) {
      sentence = travelString;
    } else if (fuelString) {
      sentence = fuelString.charAt(0).toUpperCase() + fuelString.slice(1);
    }

    if (sentence && !/[.!?]$/.test(sentence)) {
      sentence = sentence + '.';
    }

    if (sentence) {
      pathEntries.push(`
        <div style="margin-bottom: 16px; font-size: 18px; line-height: 1.5;">
          <strong style="color: white; font-size: 15px;">Q${matchNum}:</strong> 
          <span style="color: white;">${escapeHtml(sentence)}</span>
        </div>
      `);
    }
  });

  if (pathEntries.length === 0) {
    container.innerHTML = '<p style="color: white; margin: 0;">No auto path data</p>';
    return;
  }

  container.innerHTML = pathEntries.join('');
}
function displayScouterComments(column) {
  console.log(`Displaying scouter comments for column ${column}`);

  const container = document.getElementById(`comparisonComments${column}`);

  if (!container) {
    console.error(`Container comparisonComments${column} not found`);
    return;
  }

  container.innerHTML = '';

  if (!window.comparisonTeamData) {
    console.error('comparisonTeamData not initialized');
    container.innerHTML = '<p style="color: #ff5c5c;">Error: Data not initialized</p>';
    return;
  }

  const teamData = window.comparisonTeamData[column];

  if (!teamData || teamData.length === 0) {
    container.innerHTML = '<p style="color: #aaa; margin: 0; font-size: 14px;">No scouter comments available</p>';
    return;
  }
  const sortedData = [...teamData].sort((a, b) => {
    const matchA = parseInt(a['Match'] || a['Match Number'] || 0);
    const matchB = parseInt(b['Match'] || b['Match Number'] || 0);
    return matchA - matchB;
  });

  const commentEntries = [];

  sortedData.forEach(row => {
    const matchNum = row['Match'] || row['Match Number'];
    if (!matchNum) return;

    const comment = (row['Comments'] || '').toString().trim();

    if (!comment || comment === '' || comment === 'N/A' || comment === 'NA' || comment === 'none' || comment === 'None') return;

    commentEntries.push(`
            <div style="margin-bottom: 16px; font-size: 18px; line-height: 1.5;">
                <strong style="color: white; font-size: 15px;">Q${matchNum}:</strong> 
                <span style="color: white;">${escapeHtml(comment)}</span>
            </div>
        `);
  });

  if (commentEntries.length === 0) {
    container.innerHTML = '<p style="color: white; margin: 0; font-size: 14px;">No scouter comments available</p>';
    return;
  }

  container.innerHTML = commentEntries.join('');
}


function renderComparisonTeleClimbChart(column) {

  const container = document.querySelector(`.comparison-tele-climb[data-team="${column}"]`);
  if (container) {
    container.style.height = '550px';
    container.style.minHeight = '550px';
    container.style.maxHeight = '550px';
  }

  const canvas = document.getElementById(`comparisonTeleClimbChart${column}`);
  if (!canvas) {
    console.error(`Canvas comparisonTeleClimbChart${column} not found`);
    return;
  }

  const ctx = canvas.getContext('2d');

  if (!window.comparisonCharts) {
    window.comparisonCharts = {
      autoClimb1: null,
      autoClimb2: null,
      teleClimb1: null,
      teleClimb2: null
    };
  }

  const chartKey = `teleClimb${column}`;
  if (window.comparisonCharts[chartKey]) {
    try {
      window.comparisonCharts[chartKey].destroy();
    } catch (e) {
      console.log('Error destroying chart:', e);
    }
    window.comparisonCharts[chartKey] = null;
  }

  const teamData = window.comparisonTeamData[column];
  if (!teamData || teamData.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No tele climb data', canvas.width / 2, canvas.height / 2);
    return;
  }

  const filterValue = document.getElementById(`comparisonTeleClimbFilter${column}`)?.value || 'all';

  let filteredData = teamData;
  if (filterValue !== 'all') {
    filteredData = teamData.filter(row => {
      const startingPos = row['Starting Position']?.toString().trim();
      return startingPos === filterValue;
    });
  }

  if (filteredData.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText(`No tele climb data for ${getPositionName(filterValue)} position`, canvas.width / 2, canvas.height / 2);
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
  const tooltipLevels = [];
  const tooltipTimes = [];
  const tooltipPositions = [];

  sortedData.forEach(row => {
    const matchNum = row['Match'] || row['Match Number'];
    if (!matchNum) return;

    const climbTeleop = row['Climb Teleop']?.toString().trim();
    if (!climbTeleop || climbTeleop === '') return;

    matches.push(`Q${matchNum}`);

    const climbTime = row['Climb Time']?.toString().trim() || 'N/A';

    const startingPos = row['Starting Position']?.toString().trim() || '';
    const positionName = getPositionName(startingPos);

    let yValue = 0;
    let color = '#3EDBF0';
    let levelText = '';
    let timeText = '';

    if (climbTeleop === '3') {
      yValue = 3;
      color = '#3EDBF0';
      levelText = 'Level 3';
      timeText = climbTime !== 'N/A' ? `Time: ${climbTime}s` : 'Time: N/A';
    } else if (climbTeleop === '2') {
      yValue = 2;
      color = '#3EDBF0';
      levelText = 'Level 2';
      timeText = climbTime !== 'N/A' ? `Time: ${climbTime}s` : 'Time: N/A';
    } else if (climbTeleop === '1') {
      yValue = 1;
      color = '#3EDBF0';
      levelText = 'Level 1';
      timeText = climbTime !== 'N/A' ? `Time: ${climbTime}s` : 'Time: N/A';
    } else if (climbTeleop === 'F') {
      yValue = 0.5;
      color = '#ff5c5c';
      levelText = 'Failed';
      timeText = climbTime !== 'N/A' ? `Time: ${climbTime}s` : 'Time: N/A';
    } else if (climbTeleop === '0') {
      yValue = 0;
      color = '#3EDBF0';
      levelText = 'Not Attempted';
      timeText = '';
    }

    climbValues.push(yValue);
    barColors.push(color);
    tooltipLevels.push(levelText);
    tooltipTimes.push(timeText);
    tooltipPositions.push(positionName);
  });

  if (matches.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No tele climb data', canvas.width / 2, canvas.height / 2);
    return;
  }

  try {
    window.comparisonCharts[chartKey] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: matches,
        datasets: [{
          label: 'Tele Climb',
          data: climbValues,
          backgroundColor: barColors,
          borderWidth: 0,
          borderRadius: 6,
          barPercentage: 1,
          categoryPercentage: 0.9,
          maxBarThickness: 75
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: 2,
        layout: {
          padding: {
            bottom: 35,
            top: 25
          }
        },
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
            padding: 10,
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
                const index = context.dataIndex;
                const lines = [tooltipLevels[index]];

                if (tooltipTimes[index]) {
                  lines.push(tooltipTimes[index]);
                }

                if (tooltipPositions[index] && tooltipPositions[index] !== '') {
                  lines.push(`Position: ${tooltipPositions[index]}`);
                }

                return lines;
              },
              title: function (context) {
                return context[0].label;
              }
            }
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
                size: 16,
                weight: 'bold'
              },
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
              padding: 10
            }
          },
          y: {
            beginAtZero: true,
            max: 3,
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
                size: 16,
                weight: 'bold'
              },
              stepSize: 1,
              callback: function (value) {
                return value;
              },
              padding: 10
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error creating tele climb chart:', error);
  }
}

function renderComparisonAutoClimbChart(column) {

  const container = document.querySelector(`.comparison-auto-climb[data-team="${column}"]`);
  if (container) {
    container.style.height = '400px';
    container.style.minHeight = '400px';
    container.style.maxHeight = '400px';
  }

  const canvas = document.getElementById(`comparisonAutoClimbChart${column}`);
  if (!canvas) {
    console.error(`Canvas comparisonAutoClimbChart${column} not found`);
    return;
  }

  const ctx = canvas.getContext('2d');

  if (!window.comparisonCharts) {
    window.comparisonCharts = {
      autoClimb1: null,
      autoClimb2: null,
      teleClimb1: null,
      teleClimb2: null
    };
  }

  const chartKey = `autoClimb${column}`;
  if (window.comparisonCharts[chartKey]) {
    try {
      window.comparisonCharts[chartKey].destroy();
    } catch (e) {
      console.log('Error destroying chart:', e);
    }
    window.comparisonCharts[chartKey] = null;
  }

  const teamData = window.comparisonTeamData[column];
  if (!teamData || teamData.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No auto climb data', canvas.width / 2, canvas.height / 2);
    return;
  }

  const filterValue = document.getElementById(`comparisonAutoClimbFilter${column}`)?.value || 'all';

  let filteredData = teamData;
  if (filterValue !== 'all') {
    filteredData = teamData.filter(row => {
      const startingPos = row['Starting Position']?.toString().trim();
      return startingPos === filterValue;
    });
  }

  if (filteredData.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText(`No data for ${getPositionName(filterValue)}`, canvas.width / 2, canvas.height / 2);
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

    let yValue = 0;
    let color = '#3EDBF0';
    let tooltipText = '';

    if (climbAuto === '1') {
      yValue = 1;
      color = '#3EDBF0';
      tooltipText = 'Level 1';
    } else if (climbAuto === 'F') {
      yValue = 0.5;
      color = '#ff5c5c';
      tooltipText = 'Failed';
    } else if (climbAuto === '0') {
      yValue = 0;
      color = '#3EDBF0';
      tooltipText = 'Not Attempted';
    }

    climbValues.push(yValue);
    barColors.push(color);
    tooltipLabels.push(tooltipText);
  });

  if (matches.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No auto climb data', canvas.width / 2, canvas.height / 2);
    return;
  }

  try {
    window.comparisonCharts[chartKey] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: matches,
        datasets: [{
          label: 'Auto Climb',
          data: climbValues,
          backgroundColor: barColors,
          borderWidth: 0,
          borderRadius: 6,
          barPercentage: 1,
          categoryPercentage: 0.9,
          maxBarThickness: 75
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: 2,
        layout: {
          padding: {
            bottom: 35,
            top: 25
          }
        },
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
            padding: 10,
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
                const index = context.dataIndex;
                return tooltipLabels[index];
              },
              title: function (context) {
                return context[0].label;
              }
            }
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
                size: 16,
                weight: 'bold'
              },
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
              padding: 10
            }
          },
          y: {
            beginAtZero: true,
            max: 1,
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
                size: 16,
                weight: 'bold'
              },
              stepSize: 0.5,
              callback: function (value) {
                if (value === 1) return '1';
                if (value === 0) return '0';
                return '';
              },
              padding: 10
            }
          }
        }
      }
    });
    console.log(`Chart created successfully for column ${column}`);
  } catch (error) {
    console.error('Error creating chart:', error);
  }
}

function syncComparisonTeleClimbDropdowns(value, sourceColumn) {
  const dropdown1 = document.getElementById('comparisonTeleClimbFilter1');
  const dropdown2 = document.getElementById('comparisonTeleClimbFilter2');

  if (!dropdown1 || !dropdown2) return;

  if (sourceColumn === 1) {
    dropdown2.value = value;
  } else if (sourceColumn === 2) {
    dropdown1.value = value;
  }

  renderComparisonTeleClimbChart(1);
  renderComparisonTeleClimbChart(2);
}

function initializeTeleClimbSync() {
  const teleClimbFilter1 = document.getElementById('comparisonTeleClimbFilter1');
  const teleClimbFilter2 = document.getElementById('comparisonTeleClimbFilter2');

  if (teleClimbFilter1) {
    teleClimbFilter1.removeEventListener('change', window.teleClimbHandler1);

    window.teleClimbHandler1 = function (e) {
      const value = this.value;
      syncComparisonTeleClimbDropdowns(value, 1);
    };
    teleClimbFilter1.addEventListener('change', window.teleClimbHandler1);
  }

  if (teleClimbFilter2) {
    teleClimbFilter2.removeEventListener('change', window.teleClimbHandler2);

    window.teleClimbHandler2 = function (e) {
      const value = this.value;
      syncComparisonTeleClimbDropdowns(value, 2);
    };
    teleClimbFilter2.addEventListener('change', window.teleClimbHandler2);
  }
}

function filterComparisonTeleClimb(column) {
  const currentValue = document.getElementById(`comparisonTeleClimbFilter${column}`).value;

  if (column === 1) {
    const dropdown2 = document.getElementById('comparisonTeleClimbFilter2');
    if (dropdown2) dropdown2.value = currentValue;
  } else if (column === 2) {
    const dropdown1 = document.getElementById('comparisonTeleClimbFilter1');
    if (dropdown1) dropdown1.value = currentValue;
  }

  renderComparisonTeleClimbChart(1);
  renderComparisonTeleClimbChart(2);
}

function syncComparisonAutoDropdowns(value, sourceType, sourceColumn) {
  const autoPath1 = document.getElementById('comparisonAutoPathFilter1');
  const autoPath2 = document.getElementById('comparisonAutoPathFilter2');
  const autoClimb1 = document.getElementById('comparisonAutoClimbFilter1');
  const autoClimb2 = document.getElementById('comparisonAutoClimbFilter2');

  if (!autoPath1 || !autoPath2 || !autoClimb1 || !autoClimb2) return;

  autoPath1.value = value;
  autoPath2.value = value;
  autoClimb1.value = value;
  autoClimb2.value = value;

  displayAutoPaths(1);
  displayAutoPaths(2);
  renderComparisonAutoClimbChart(1);
  renderComparisonAutoClimbChart(2);
}


function initializeAutoDropdownSync() {
  const autoPath1 = document.getElementById('comparisonAutoPathFilter1');
  const autoPath2 = document.getElementById('comparisonAutoPathFilter2');

  const autoClimb1 = document.getElementById('comparisonAutoClimbFilter1');
  const autoClimb2 = document.getElementById('comparisonAutoClimbFilter2');

  if (autoPath1) {
    autoPath1.removeEventListener('change', window.autoPathHandler1);
    window.autoPathHandler1 = function (e) {
      const value = this.value;
      syncComparisonAutoDropdowns(value, 'path', 1);
    };
    autoPath1.addEventListener('change', window.autoPathHandler1);
  }

  if (autoPath2) {
    autoPath2.removeEventListener('change', window.autoPathHandler2);
    window.autoPathHandler2 = function (e) {
      const value = this.value;
      syncComparisonAutoDropdowns(value, 'path', 2);
    };
    autoPath2.addEventListener('change', window.autoPathHandler2);
  }

  if (autoClimb1) {
    autoClimb1.removeEventListener('change', window.autoClimbHandler1);
    window.autoClimbHandler1 = function (e) {
      const value = this.value;
      syncComparisonAutoDropdowns(value, 'climb', 1);
    };
    autoClimb1.addEventListener('change', window.autoClimbHandler1);
  }

  if (autoClimb2) {
    autoClimb2.removeEventListener('change', window.autoClimbHandler2);
    window.autoClimbHandler2 = function (e) {
      const value = this.value;
      syncComparisonAutoDropdowns(value, 'climb', 2);
    };
    autoClimb2.addEventListener('change', window.autoClimbHandler2);
  }
}

function filterComparisonAutoPaths(column) {
  const currentValue = document.getElementById(`comparisonAutoPathFilter${column}`).value;
  syncComparisonAutoDropdowns(currentValue, 'path', column);
}

function filterComparisonAutoClimb(column) {
  const currentValue = document.getElementById(`comparisonAutoClimbFilter${column}`).value;
  syncComparisonAutoDropdowns(currentValue, 'climb', column);
}

function getPositionName(value) {
  switch (value) {
    case 'D': return 'Depot';
    case 'C': return 'Center';
    case 'O': return 'Outpost';
    default: return 'Unknown';
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

function displayTeamNickname(teamNumber, elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = `Team ${teamNumber}`;
}

document.addEventListener('DOMContentLoaded', function () {

  window.comparisonTeamData = window.comparisonTeamData || {
    1: [],
    2: []
  };

  window.comparisonCharts = window.comparisonCharts || {
    autoClimb1: null,
    autoClimb2: null,
    teleClimb1: null,
    teleClimb2: null
  };

  const style = document.createElement('style');
  style.textContent = `
    .comparison-auto-climb {
      height: 400px !important;
      min-height: 400px !important;
      max-height: 400px !important;
    }
    .comparison-tele-climb {
      height: 550px !important;
      min-height: 550px !important;
      max-height: 550px !important;
    }
  `;
  document.head.appendChild(style);

  const autoClimbContainers = document.querySelectorAll('.comparison-auto-climb');
  autoClimbContainers.forEach(container => {
    container.style.height = '400px';
    container.style.minHeight = '400px';
    container.style.maxHeight = '400px';
  });

  const teleClimbContainers = document.querySelectorAll('.comparison-tele-climb');
  teleClimbContainers.forEach(container => {
    container.style.height = '550px';
    container.style.minHeight = '550px';
    container.style.maxHeight = '550px';
  });

  const searchBtn1 = document.querySelector('button[onclick="searchComparison(1)"]');
  if (searchBtn1) {
    searchBtn1.onclick = function (e) {
      e.preventDefault();
      searchComparison(1);
      return false;
    };
  }

  const searchBtn2 = document.querySelector('button[onclick="searchComparison(2)"]');
  if (searchBtn2) {
    searchBtn2.onclick = function (e) {
      e.preventDefault();
      searchComparison(2);
      return false;
    };
  }

  const input1 = document.getElementById('comparisonSearch1');
  if (input1) {
    input1.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchComparison(1);
      }
    });
  }

  const input2 = document.getElementById('comparisonSearch2');
  if (input2) {
    input2.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchComparison(2);
      }
    });
  }

  const autoPathFilter1 = document.getElementById('comparisonAutoPathFilter1');
  if (autoPathFilter1) {
    autoPathFilter1.addEventListener('change', function () {
      filterComparisonAutoPaths(1);
    });
  }

  const autoPathFilter2 = document.getElementById('comparisonAutoPathFilter2');
  if (autoPathFilter2) {
    autoPathFilter2.addEventListener('change', function () {
      filterComparisonAutoPaths(2);
    });
  }

  const autoClimbFilter1 = document.getElementById('comparisonAutoClimbFilter1');
  if (autoClimbFilter1) {
    autoClimbFilter1.addEventListener('change', function () {
      filterComparisonAutoClimb(1);
    });
  }

  const autoClimbFilter2 = document.getElementById('comparisonAutoClimbFilter2');
  if (autoClimbFilter2) {
    autoClimbFilter2.addEventListener('change', function () {
      filterComparisonAutoClimb(2);
    });
  }
  initializeTeleClimbSync();
  initializeAutoDropdownSync();

});

window.comparisonTeamData = window.comparisonTeamData || {
  1: [],
  2: []
};

window.comparisonCharts = window.comparisonCharts || {
  autoClimb1: null,
  autoClimb2: null,
  teleClimb1: null,
  teleClimb2: null
};
/*-----OVERVIEW STACKED CHART----*/

function getChartClickHandler() {
  return function (event) {
    const points = this.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false);
    if (!points.length) return;

    const index = points[0].index;
    const teamLabel = this.data.labels[index];

    if (teamLabel) {
      const teamNumber = teamLabel.replace('Team ', '');
      document.querySelector('.content').scrollTo({ top: 0, behavior: 'auto' });
      document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(button => button.classList.remove('active'));
      document.getElementById('individual').classList.add('active');
      document.querySelector('.tab[onclick*="individual"]').classList.add('active');
      document.getElementById('teamSearch').value = teamNumber;

      searchTeam();
    }
  };
}

function updateOverviewCharts() {
  const parsedData = parseCSV();
  renderFuelOprChart();
  renderOverviewStackedChart(parsedData.data);
}

function renderOverviewStackedChart(data) {
  const canvas = document.getElementById('overviewStackedChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  if (charts.overviewStackedChart) {
    charts.overviewStackedChart.destroy();
    charts.overviewStackedChart = null;
  }

  if (!data || data.length === 0) {
    renderBlankChart('overviewStackedChart', 'No Data');
    return;
  }
  const teamTotals = {};

  data.forEach(row => {
    const team = row['Team Number']?.toString().trim();
    if (!team) return;

    const points = parseFloat(row['Total Points']) || 0;

    if (!teamTotals[team]) {
      teamTotals[team] = { sum: 0, matches: 0 };
    }

    teamTotals[team].sum += points;
    teamTotals[team].matches += 1;
  });

  const oprTotals = {};

  if (oprCsvText && oprCsvText.trim()) {
    const parsed = Papa.parse(oprCsvText, {
      header: true,
      skipEmptyLines: true
    });

    parsed.data.forEach(row => {
      const team = row['Team Number']?.toString().trim();
      if (!team) return;

      const opr = parseFloat(
        (row['Total OPR'] || '').toString().replace(/[^0-9.-]/g, '')
      ) || 0;

      oprTotals[team] = opr;
    });
  }

  const scores = Object.keys(teamTotals).map(team => {
    const avgPoints =
      teamTotals[team].sum / teamTotals[team].matches;

    const opr = oprTotals[team] || 0;

    return {
      team,
      epa: avgPoints + opr
    };
  });

  if (scores.length === 0) {
    renderBlankChart('overviewStackedChart', 'No Data');
    return;
  }

  scores.sort((a, b) => b.epa - a.epa);

  const labels = scores.map(s => `Team ${s.team}`);

  const cleanLabels = scores.map(s => s.team);
  const epaData = scores.map(s => s.epa);

  const barColors = scores.map(s => {
    if (s.team === '226') return '#FE59D7';
    if (s.team === highlightedOverviewTeam) return '#ffaad3';
    return '#3EDBF0';
  });

  charts.overviewStackedChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'EPA',
          data: epaData,
          backgroundColor: barColors
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 3,
      onClick: getChartClickHandler(),

      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            beforeBody: function (tooltipItems) {
              const index = tooltipItems[0].dataIndex;
              const ranking = index + 1;
              return `Rank: ${ranking}`;
            },
            title: items => items[0].label,
            label: item => `EPA: ${scores[item.dataIndex].epa.toFixed(2)}`
          },
          backgroundColor: '#1C1E21',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#000',
          borderWidth: 1,
          titleFont: { family: 'Lato', size: 14 },
          bodyFont: { family: 'Lato', size: 14 },
          padding: 10,
          callbacks: {
            title: items => items[0].label,
            label: item => `Rank: ${item.dataIndex + 1}`,
            afterLabel: item =>
              `EPA: ${scores[item.dataIndex].epa.toFixed(2)}`
          }
        }
      },

      scales: {
        x: {
          stacked: false,
          ticks: {
            color: 'white',
            maxRotation: 45,
            minRotation: 45,
            font: { family: 'Lato', size: 12, weight: 'bold' }
          },
          grid: { display: false }
        },
        y: {
          stacked: false,
          beginAtZero: true,
          ticks: {
            color: 'white',
            font: { family: 'Lato', size: 14, weight: 'bold' }
          },
          grid: { display: false }
        }
      }
    }
  });
  charts.overviewStackedChart.data.labels = cleanLabels;
  charts.overviewStackedChart.update();
}

function renderFuelOprChart() {
  const canvas = document.getElementById('fuelOprChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (charts['fuelOprChart']) {
    charts['fuelOprChart'].destroy();
    charts['fuelOprChart'] = null;
  }

  if (!oprCsvText || oprCsvText.trim().length === 0) {
    renderBlankChart('fuelOprChart', 'No OPR data');
    return;
  }

  try {
    const parsed = Papa.parse(oprCsvText, { header: true, skipEmptyLines: true });
    const rows = parsed && parsed.data ? parsed.data : [];
    if (!rows || rows.length === 0) {
      renderBlankChart('fuelOprChart', 'No OPR data');
      return;
    }

    const sample = rows.find(r => Object.keys(r).length > 0) || {};
    const fields = Object.keys(sample);
    const teamCandidates = ['Team Number', 'Team No.', 'Team No', 'Team', 'team', 'TeamNumber', 'team_number'];
    const oprCandidates = ['Total OPR', 'OPR', 'TotalOPR', 'Total OPR '];

    let teamKey = fields.find(f => teamCandidates.includes(f));
    let oprKey = fields.find(f => oprCandidates.includes(f));

    if (!teamKey) teamKey = fields.find(f => f.toLowerCase().includes('team'));
    if (!oprKey) oprKey = fields.find(f => f.toLowerCase().includes('opr'));

    if (!teamKey || !oprKey) {
      renderBlankChart('fuelOprChart', 'No OPR columns found');
      return;
    }

    const entries = rows.map(r => {
      const t = (r[teamKey] || '').toString().trim();
      const raw = (r[oprKey] || '').toString();
      const v = parseFloat(raw.replace(/[^0-9.-]+/g, '')) || 0;
      return { team: t, value: v };
    }).filter(e => e.team);

    if (entries.length === 0) {
      renderBlankChart('fuelOprChart', 'No OPR data');
      return;
    }

    const sorted = entries.sort((a, b) => b.value - a.value);
    const labels = sorted.map(s => `Team ${s.team}`);
    const cleanLabels = sorted.map(s => s.team);
    const dataVals = sorted.map(s => s.value);
    const colors = sorted.map(s => (s.team === '226' ? '#FE59D7' : (s.team === highlightedOverviewTeam ? '#ffaad3' : '#3EDBF0')));

    charts['fuelOprChart'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'OPR', data: dataVals, backgroundColor: colors }
        ]
      },
      options: {
        onClick: getChartClickHandler(),
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: 3,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              beforeBody: function (tooltipItems) {
                const index = tooltipItems[0].dataIndex;
                const ranking = index + 1;
                return `Rank: ${ranking}`;
              }
            },
            backgroundColor: '#1C1E21',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#000',
            borderWidth: 1,
            titleFont: { family: 'Lato', size: 14 },
            bodyFont: { family: 'Lato', size: 14 },
            padding: 10
          }
        },
        scales: {
          x: {
            ticks: {
              color: 'white',
              font: { family: 'Lato', size: 12, weight: 'bold' },
              autoSkip: false,
              maxRotation: 45,
              minRotation: 45
            },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: { color: 'white', font: { family: 'Lato', size: 14, weight: 'bold' } },
            grid: { display: false }
          }
        },
        layout: { padding: { left: 10, right: 10, top: 20, bottom: 50 } }
      }
    });
    charts['fuelOprChart'].data.labels = cleanLabels;
    charts['fuelOprChart'].update();
  } catch (err) {
    console.error('Error rendering Fuel OPR chart', err);
    renderBlankChart('fuelOprChart', 'Error');
  }
}


function handleOverviewSearch() {
  const input = document.getElementById('overviewSearch').value.trim();

  if (!input) return;

  highlightedOverviewTeam = input;
  const parsedData = parseCSV();
  renderOverviewStackedChart(parsedData.data);
  renderFuelOprChart();


}

function clearOverviewSearch() {
  document.getElementById('overviewSearch').value = '';
  document.getElementById('overviewTeamNicknameDisplay').textContent = '';
  highlightedOverviewTeam = null;
  const parsedData = parseCSV();
  renderOverviewStackedChart(parsedData.data);
  renderFuelOprChart();
}



document.addEventListener('DOMContentLoaded', function () {
  try {
    const overviewCanvas = document.getElementById('overviewStackedChart');
    const fuelCanvas = document.getElementById('fuelOprChart');
    if (!overviewCanvas || !fuelCanvas) return;

    const parsed = parseCSV();
    const data = (parsed && parsed.data) ? parsed.data : [];

    if (!data || data.length === 0) {
      renderBlankChart('overviewStackedChart', 'No Data');
      renderBlankChart('fuelOprChart', 'No Data');
    } else {
      setTimeout(() => {
        renderOverviewStackedChart(data);
        renderFuelOprChart();
      }, 100);
    }
  } catch (err) {
    console.error('Error initializing overview charts on load:', err);
  }
});

/*-----FILTER VIEW----*/

async function addHiddenTeam(e) {
  e.preventDefault();
  e.stopPropagation();

  const input = document.getElementById('hideTeamInput');
  const teamNumber = input.value.trim();
  const data = parseCSV().data;
  const teamExists = data.some(row => row['Team Number'] === teamNumber);

  if (!teamNumber) return;

  if (!teamExists) {
    alert(`No data found for team ${teamNumber}`);
    return;
  }

  if (!hiddenTeams.includes(teamNumber)) {
    hiddenTeams.push(teamNumber);
    hiddenTeams.sort((a, b) => parseInt(a) - parseInt(b));
    saveHiddenTeams();
    renderHiddenTeamsList();
    input.value = '';
  } else {
    alert(`Team ${teamNumber} is already in the list.`);
  }
}
function renderHiddenTeamsList() {
  const list = document.getElementById('hideTeamList');
  const container = document.getElementById('hideTeamListContainer');
  if (!list || !container) return;
  list.innerHTML = '';

  hiddenTeams.forEach(team => {
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
    listItem.appendChild(teamText);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'X';
    deleteButton.style.padding = '2px 8px';
    deleteButton.style.backgroundColor = '#ff5c5c';
    deleteButton.style.color = 'white';
    deleteButton.style.border = 'none';
    deleteButton.style.borderRadius = '4px';
    deleteButton.style.cursor = 'pointer';

    deleteButton.addEventListener('click', (e) => {
      hiddenTeams = hiddenTeams.filter(t => t !== team);
      saveHiddenTeams();
      renderHiddenTeamsList();
      renderHiddenTeamsListRanking();
      applyFilters();
      updateRankingTableColumns();
      renderRankingTable();
    });

    listItem.appendChild(deleteButton);
    list.appendChild(listItem);
  });

  const itemHeight = 42;
  const maxVisibleItems = 8;
  container.style.transition = 'max-height 0.20s ease, height 0.20s ease';
  if (hiddenTeams.length === 0) {
    container.style.maxHeight = '0px';
    container.style.overflowY = 'hidden';
  } else if (hiddenTeams.length <= maxVisibleItems) {
    container.style.maxHeight = `${hiddenTeams.length * itemHeight}px`;
    container.style.overflowY = 'hidden';
  } else {
    container.style.maxHeight = `${maxVisibleItems * itemHeight}px`;
    container.style.overflowY = 'auto';
  }

  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 40);

  applyFilters();
}


async function resetHiddenTeams(e) {
  e.preventDefault();
  e.stopPropagation();
  hiddenTeams = [];
  saveHiddenTeams();
  renderHiddenTeamsList();
  applyFilters();
};

async function toggleHiddenTeams() {
  showHiddenTeamsInFilter = !showHiddenTeamsInFilter;
  document.getElementById('toggleHiddenTeamsButton').textContent = showHiddenTeamsInFilter
    ? 'Hide Hidden Teams'
    : 'Show Hidden Teams';
  applyFilters();
}

function applyFilters() {
  loadPitScoutingData();

  const parsed = Papa.parse(csvText, { header: true }).data;
  const selectedFilters = Array.from(document.querySelectorAll('#filterCheckboxesContainer input[type="checkbox"]:checked')).map(cb => cb.value);
  const sortBy = document.getElementById('filterTeamsDropdown').value;

  const teamMap = {};

  parsed.forEach(row => {
    const team = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
    if (!team) return;
    if (!showHiddenTeamsInFilter && hiddenTeams.includes(team)) return;

    if (!teamMap[team]) {
      teamMap[team] = {
        matches: [],
        epaTotal: 0,
        matchCount: 0,
        hasAutoClimb: false,
        hasAutoCenter: false,
        hasAutoDepot: false,
        hasAutoOutpost: false,
        hasClimbLevel1: false,
        hasClimbLevel2: false,
        hasClimbLevel3: false,
        hasClimbPositionCenter: false,
        hasClimbPositionDepot: false,
        hasClimbPositionOutpost: false
      };
    }

    const totalScore = parseFloat(row['Total Score'] || row['Total Points'] || 0);
    teamMap[team].epaTotal += totalScore;
    teamMap[team].matchCount++;
    teamMap[team].matches.push(row);

    const autoClimb = row['Climb Auto']?.toString().trim();
    if (autoClimb === '1') {
      teamMap[team].hasAutoClimb = true;
    }

    const startingPos = row['Starting Position']?.toString().trim();
    if (startingPos === 'C') {
      teamMap[team].hasAutoCenter = true;
    }
    if (startingPos === 'D') {
      teamMap[team].hasAutoDepot = true;
    }
    if (startingPos === 'O') {
      teamMap[team].hasAutoOutpost = true;
    }

    const climbTeleop = row['Climb Teleop']?.toString().trim();
    if (climbTeleop === '1') {
      teamMap[team].hasClimbLevel1 = true;
    }
    if (climbTeleop === '2') {
      teamMap[team].hasClimbLevel2 = true;
    }
    if (climbTeleop === '3') {
      teamMap[team].hasClimbLevel3 = true;
    }

    const climbPosition = row['Climb Position']?.toString().trim();
    if (climbPosition === 'C') {
      teamMap[team].hasClimbPositionCenter = true;
    }
    if (climbPosition === 'D') {
      teamMap[team].hasClimbPositionDepot = true;
    }
    if (climbPosition === 'O') {
      teamMap[team].hasClimbPositionOutpost = true;
    }
  });

  Object.keys(teamMap).forEach(team => {
    teamMap[team].hasSwerve = false;
    teamMap[team].hasTrench = false;
    teamMap[team].hasShootOnFly = false;
    teamMap[team].hasGroundIntake = false;
  });

  if (pitScoutingData && pitScoutingData.length > 0) {
    pitScoutingData.forEach(row => {
      const team = row['Team Number']?.toString().trim();
      if (!team || !teamMap[team]) return;
      if (!showHiddenTeamsInFilter && hiddenTeams.includes(team)) return;

      const drivetrain = (row['Drivetrain'] || '').toString().toLowerCase();
      if (drivetrain.includes('swerve')) {
        teamMap[team].hasSwerve = true;
      }

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

  let oprData = {};
  if (oprCsvText && oprCsvText.trim()) {
    const parsed = Papa.parse(oprCsvText, { header: true, skipEmptyLines: true });
    parsed.data.forEach(row => {
      const team = row['Team Number']?.toString().trim();
      if (team) {
        oprData[team] = parseFloat((row['Total OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0;
      }
    });
  }

const allTeams = Object.entries(teamMap).map(([team, data]) => {
  const avgPoints = data.matchCount > 0 ? (data.epaTotal / data.matchCount) : 0;
  
  const opr = oprData[team] || 0;
  
  const epa = Math.round((avgPoints + opr) * 10) / 10;

  const flags = {
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
  };

  return {
    team,
    avgEPA: epa, 
    avgOPR: opr,
    flags,
    isHidden: hiddenTeams.includes(team)
  };
});

  const passed = allTeams.filter(team => {
    const selectedAutoFilters = selectedFilters.filter(f =>
      ['autoClimb', 'autoCenter', 'autoDepot', 'autoOutpost'].includes(f)
    );

    const selectedClimbFilters = selectedFilters.filter(f =>
      ['climbLevel1', 'climbLevel2', 'climbLevel3'].includes(f)
    );

    const selectedClimbPositionFilters = selectedFilters.filter(f =>
      ['climbPositionCenter', 'climbPositionDepot', 'climbPositionOutpost'].includes(f)
    );

    const selectedRobotFilters = selectedFilters.filter(f =>
      ['swerve', 'trench', 'shootOnFly', 'groundIntake'].includes(f)
    );

    let autoPassed = true;
    if (selectedAutoFilters.length > 0) {
      autoPassed = selectedAutoFilters.some(filter => team.flags[filter] === true);
    }

    let climbPassed = true;
    if (selectedClimbFilters.length > 0) {
      climbPassed = selectedClimbFilters.some(filter => team.flags[filter] === true);
    }

    let climbPositionPassed = true;
    if (selectedClimbPositionFilters.length > 0) {
      climbPositionPassed = selectedClimbPositionFilters.some(filter => team.flags[filter] === true);
    }

    let robotPassed = true;
    if (selectedRobotFilters.length > 0) {
      robotPassed = selectedRobotFilters.every(filter => team.flags[filter] === true);
    }

    return autoPassed && climbPassed && climbPositionPassed && robotPassed;
  });

  const filteredIn = passed;
  const filteredOut = allTeams.filter(team => !passed.includes(team));

  let sortFn;
  switch (sortBy) {
    case 'EPA':
      sortFn = (a, b) => b.avgEPA - a.avgEPA; 
      break;
    case 'avgOPR':
      sortFn = (a, b) => b.avgOPR - a.avgOPR;
      break;
    default:
      sortFn = (a, b) => b.avgEPA - a.avgEPA; 
  }

  filteredIn.sort(sortFn);
  filteredOut.sort(sortFn);

  const container = document.getElementById('rankedTeamsContainer');
  container.innerHTML = '';

  const labelIn = document.createElement('div');
  labelIn.textContent = 'Matching Teams';
  labelIn.style.fontSize = '20px';
  labelIn.style.color = 'white';
  labelIn.style.margin = '10px 0 5px';
  labelIn.style.fontWeight = 'bold';
  labelIn.style.fontFamily = 'Lato';
  container.appendChild(labelIn);

  renderTeamGroup(filteredIn, container, sortBy);

  if (filteredOut.length > 0) {
    const divider = document.createElement('hr');
    divider.style.border = 'none';
    divider.style.borderTop = '2px solid #1e90ff';
    divider.style.margin = '40px 0 20px';
    container.appendChild(divider);

    const labelOut = document.createElement('div');
    labelOut.textContent = "Don't Match";
    labelOut.style.fontSize = '20px';
    labelOut.style.color = 'white';
    labelOut.style.marginBottom = '10px';
    labelOut.style.fontWeight = 'bold';
    labelOut.style.fontFamily = 'Lato';
    container.appendChild(labelOut);

    renderTeamGroup(filteredOut, container, sortBy);
  }
}

function renderTeamGroup(teams, container, sortBy) {
  const grid = document.createElement('div');
  grid.className = 'row';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(5, 1fr)';
  grid.style.gap = '15px';

  teams.forEach(team => {
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
      box.appendChild(hiddenTag);
    }

    let metricValue, metricLabel;
    switch (sortBy) {
      case 'EPA':
        metricValue = team.avgEPA; 
        metricLabel = 'Avg. EPA';
        break;
      case 'avgOPR':
        metricValue = team.avgOPR.toFixed(1);
        metricLabel = 'Fuel OPR';
        break;
      default:
        metricValue = team.avgEPA;
        metricLabel = 'Avg. EPA';
    }

    box.innerHTML = `
  <h3 style="margin: 0 0 10px 0;">Team ${team.team}</h3>
  <p style="margin: 5px 0;"><strong>${metricLabel}:</strong> ${metricValue.toFixed(1)}</p>
  <button class="blue-button" onclick="goToIndividualView('${team.team}')" style="margin-top: 10px;">View</button>
`;

    grid.appendChild(box);
  });

  container.appendChild(grid);
}

function renderTeamGroup(teams, container, sortBy) {
  const grid = document.createElement('div');
  grid.className = 'row';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(5, 1fr)';
  grid.style.gap = '15px';

  teams.forEach(team => {
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
      box.appendChild(hiddenTag);
    }

    let metricValue, metricLabel;
    switch (sortBy) {
      case 'EPA':
        metricValue = team.avgEPA;
        metricLabel = 'Avg. EPA';
        break;
      case 'avgOPR':
        metricValue = team.avgOPR.toFixed(1);
        metricLabel = 'Fuel OPR';
        break;
      default:
        metricValue = team.avgEPA;
        metricLabel = 'Avg. EPA';
    }

    box.innerHTML = `
      <h3 style="margin: 0 0 10px 0;">Team ${team.team}</h3>
      <p style="margin: 5px 0;"><strong>${metricLabel}:</strong> ${metricValue}</p>
      <button class="blue-button" onclick="goToIndividualView('${team.team}')" style="margin-top: 10px;">View</button>
    `;

    grid.appendChild(box);
  });

  container.appendChild(grid);
}

function adjustContainerHeight(container) {
  const list = container.querySelector('ul');
  container.style.height = list.children.length > 0 ?
    `${list.scrollHeight + 10}px` : 'auto';
}

function goToIndividualView(teamNumber) {
  document.querySelector('.content').scrollTo({ top: 0, behavior: 'auto' });
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(button => button.classList.remove('active'));
  document.getElementById('individual').classList.add('active');
  document.querySelector('.tab[onclick*="individual"]').classList.add('active');
  document.getElementById('teamSearch').value = teamNumber;
  searchTeam();
}


/*-----MATCH PREDICTOR FUNCTIONS----*/


document.addEventListener('DOMContentLoaded', function () {
  const submitSchedule = document.getElementById('submitSchedule');
  if (submitSchedule) {
    const newSubmitSchedule = submitSchedule.cloneNode(true);
    submitSchedule.parentNode.replaceChild(newSubmitSchedule, submitSchedule);

    newSubmitSchedule.addEventListener('click', function (e) {
      e.preventDefault();
      handleScheduleUpload(e);
    });
  }

  const predictButton = document.getElementById('predict-button');
  if (predictButton) {
    const newPredictButton = predictButton.cloneNode(true);
    predictButton.parentNode.replaceChild(newPredictButton, predictButton);

    newPredictButton.addEventListener('click', function (e) {
      e.preventDefault();
      populateMatchTeams();
    });
  }
});

function populateMatchTeams() {
  const matchNumber = document.getElementById('matchNumberInput').value.trim();

  if (!matchNumber) {
    alert('Please enter a match number');
    return;
  }

  let scheduleText = scheduleCsvText;
  if (!scheduleText) {
    scheduleText = localStorage.getItem('scheduleCsvText');
  }

  if (!scheduleText) {
    alert('Please upload match schedule CSV first');
    return;
  }

  try {
    const result = Papa.parse(scheduleText, {
      header: true,
      skipEmptyLines: true
    });

    if (result.errors && result.errors.length > 0) {
      alert('Error parsing schedule: ' + result.errors[0].message);
      return;
    }

    const scheduleData = result.data;

    const match = scheduleData.find(row => {
      const rowMatchNum = row['Match Number']?.toString().trim();
      return rowMatchNum === matchNumber;
    });

    if (match) {
      document.getElementById('redTeam1').value = match['Red 1']?.toString().trim() || '';
      document.getElementById('redTeam2').value = match['Red 2']?.toString().trim() || '';
      document.getElementById('redTeam3').value = match['Red 3']?.toString().trim() || '';
      document.getElementById('blueTeam1').value = match['Blue 1']?.toString().trim() || '';
      document.getElementById('blueTeam2').value = match['Blue 2']?.toString().trim() || '';
      document.getElementById('blueTeam3').value = match['Blue 3']?.toString().trim() || '';

      const allTeams = [
        match['Red 1']?.toString().trim(),
        match['Red 2']?.toString().trim(),
        match['Red 3']?.toString().trim(),
        match['Blue 1']?.toString().trim(),
        match['Blue 2']?.toString().trim(),
        match['Blue 3']?.toString().trim()
      ].filter(team => team && team !== '');

      updateMatchPrediction(allTeams);
      renderMatchSummary(allTeams);

    } else {
      alert(`Match ${matchNumber} not found in schedule`);
    }
  } catch (err) {
    console.error('Error populating match:', err);
    alert('Error reading schedule file: ' + err.message);
  }
}
function renderMatchSummary(teams) {
  const summaryDiv = document.getElementById('matchSummaryTable');

  if (!summaryDiv) return;

  let oprData = {};
  if (oprCsvText && oprCsvText.trim()) {
    const parsed = Papa.parse(oprCsvText, { header: true, skipEmptyLines: true });
    parsed.data.forEach(row => {
      const team = row['Team Number']?.toString().trim();
      if (team) {
        oprData[team] = {
          autoOPR: parseFloat((row['Auto OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0,
          teleOPR: parseFloat((row['Tele OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0,
          totalOPR: parseFloat((row['Total OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0
        };
      }
    });
  }

  const eventData = parseCSV().data;

  const calculateClimbRate = (team) => {
    if (!team) return '0.0%';
    const teamMatches = eventData.filter(row => {
      const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
      return teamNum === team;
    });

    const climbValues = teamMatches
      .map(row => row['Climb Teleop']?.toString().trim() || row['Climb Score']?.toString().trim())
      .filter(v => v && v !== '');

    const successfulClimbs = climbValues.filter(v => ['1', '2', '3'].includes(v)).length;

    const totalClimbAttempts = climbValues.filter(v => ['1', '2', '3', 'F'].includes(v)).length;

    if (totalClimbAttempts === 0) return '0.0%';

    const rate = ((successfulClimbs / totalClimbAttempts) * 100).toFixed(1);
    return rate + '%';
  };

  const calculateShootingAccuracy = (team) => {
    if (!team) return '0.0';
    const teamMatches = eventData.filter(row => {
      const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
      return teamNum === team;
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
    const teamMatches = eventData.filter(row => {
      const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
      return teamNum === team;
    });

    const climbValues = teamMatches
      .map(row => row['Climb Teleop']?.toString().trim() || row['Climb Score']?.toString().trim())
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

  const getAverageClimbTime = (team, targetLevel) => {
    if (!team) return 'N/A';
    const teamMatches = eventData.filter(row => {
      const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
      return teamNum === team;
    });

    const levelNum = targetLevel.replace('L', '');

    const climbTimes = teamMatches
      .filter(row => {
        const climbValue = row['Climb Teleop']?.toString().trim() || row['Climb Score']?.toString().trim();
        const climbTime = parseFloat(row['Climb Time'] || row['Climb Time per Level'] || 0);
        return climbValue === levelNum && !isNaN(climbTime) && climbTime > 0;
      })
      .map(row => parseFloat(row['Climb Time'] || row['Climb Time per Level'] || 0));

    if (climbTimes.length === 0) return 'N/A';

    const avgTime = climbTimes.reduce((a, b) => a + b, 0) / climbTimes.length;
    return avgTime.toFixed(1) + 's';
  };

  const calculateDiedRate = (team) => {
    if (!team) return '0%';
    const teamMatches = eventData.filter(row => {
      const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
      return teamNum === team;
    });

    if (teamMatches.length === 0) return '0%';

    const diedCount = teamMatches.filter(row => {
      const died = row['Robot Died']?.toString().trim() || row['Died or Immobilized']?.toString().trim();
      return died === '1' || died === '0.5' || died === 'true';
    }).length;

    return Math.round((diedCount / teamMatches.length) * 100) + '%';
  };

  const getDeathMatches = (team) => {
    if (!team) return [];
    const teamMatches = eventData.filter(row => {
      const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
      return teamNum === team;
    });

    const deathMatches = teamMatches
      .filter(row => {
        const died = row['Robot Died']?.toString().trim() || row['Died or Immobilized']?.toString().trim();
        return died === '1' || died === '0.5' || died === 'true';
      })
      .map(row => row['Match Number'] || row['Match No.'] || 'Unknown')
      .filter(m => m);

    return deathMatches.sort((a, b) => {
      const numA = parseInt(a.toString().replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(b.toString().replace(/[^0-9]/g, '')) || 0;
      return numA - numB;
    });
  };

  const calculateAvgDefenseRating = (team) => {
    if (!team) return '0.0';
    const teamMatches = eventData.filter(row => {
      const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
      return teamNum === team;
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

  let summaryHTML = `
        <style>
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
            <h3 style="color: white; margin: 0 0 20px 0; font-size: 20px; font-family: 'Lato', sans-serif; padding-bottom: 10px;">
                Match Summary
            </h3>
            <table style="width: 100%; border-collapse: collapse; color: white; font-family: 'Lato', sans-serif; table-layout: auto;">
                <thead>
                    <tr style="border-bottom: 2px solid white;">
                        <th style="padding: 12px 8px; text-align: left; color: white; font-weight: bold;">Team</th>
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: bold;">Total OPR</th>
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: bold;">Auto OPR</th>
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: bold;">Tele OPR</th>
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: bold;">Shooting Acc</th>
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: bold;">Most Common</th>
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: bold;">Climb Time</th>
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: bold;">Climb Rate</th>
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: bold;">Defense</th>
                    </tr>
                </thead>
                <tbody>
    `;

  teams.forEach((team, index) => {
    if (!team) return;

    const alliance = index < 3 ? 'Red' : 'Blue';
    const allianceColor = alliance === 'Red' ? '#ff5c5c' : '#3EDBF0';
    const stats = oprData[team] || { autoOPR: 0, teleOPR: 0, totalOPR: 0 };
    const shootingAccuracy = calculateShootingAccuracy(team);
    const mostCommonClimb = getMostCommonClimb(team);
    const climbTime = getAverageClimbTime(team, mostCommonClimb);
    const climbRate = calculateClimbRate(team);
    const diedRate = calculateDiedRate(team);
    const deathMatches = getDeathMatches(team);
    const defenseRating = calculateAvgDefenseRating(team);
    const teamCellBg = alliance === 'Red' ? '#ff5c5c30' : '#3EDBF030';

    let teamDisplay = team;
    let tooltipHTML = '';
    if (diedRate !== '0%') {
      teamDisplay = `⚠️${team}⚠️`;
      const matchesStr = deathMatches.join(', ');
      tooltipHTML = `
        <div class="death-tooltip" style="border-color: ${allianceColor};">
          <div class="death-tooltip-team" style="color: ${allianceColor};">${team}</div>
          <div class="death-tooltip-row">
            <span class="death-tooltip-label" style="color: ${allianceColor};">Died %:</span>
            <span class="death-tooltip-value">${diedRate}</span>
          </div>
          <div class="death-tooltip-row">
            <span class="death-tooltip-label" style="color: ${allianceColor};">Matches:</span>
            <span class="death-tooltip-value">${matchesStr}</span>
          </div>
        </div>
      `;
    }

    summaryHTML += `
            <tr>
                <td style="padding: 10px 8px; background-color: ${teamCellBg}; color: white; font-weight: bold;">
                  <span class="team-cell-wrapper">
                    ${teamDisplay}
                    ${tooltipHTML}
                  </span>
                </td>
                <td style="padding: 10px 8px; text-align: center; color: white;">${stats.totalOPR.toFixed(2)}</td>
                <td style="padding: 10px 8px; text-align: center; color: white;">${stats.autoOPR.toFixed(2)}</td>
                <td style="padding: 10px 8px; text-align: center; color: white;">${stats.teleOPR.toFixed(2)}</td>
                <td style="padding: 10px 8px; text-align: center; color: white;">${shootingAccuracy}</td>
                <td style="padding: 10px 8px; text-align: center; color: white;">${mostCommonClimb}</td>
                <td style="padding: 10px 8px; text-align: center; color: white;">${climbTime}</td>
                <td style="padding: 10px 8px; text-align: center; color: white;">${climbRate}</td>
                <td style="padding: 10px 8px; text-align: center; color: white;">${defenseRating}</td>
            </tr>
        `;
  });

  summaryHTML += `
                </tbody>
            </table>
        </div>
    `;

  summaryDiv.innerHTML = summaryHTML;
  console.log("Summary HTML inserted");
}

function updateMatchPrediction(teams) {
  if (teams.length !== 6) return;

  const redTeams = teams.slice(0, 3);
  const blueTeams = teams.slice(3, 6);

  let oprData = {};
  let autoOprData = {};
  if (oprCsvText && oprCsvText.trim()) {
    const parsed = Papa.parse(oprCsvText, { header: true, skipEmptyLines: true });
    parsed.data.forEach(row => {
      const team = row['Team Number']?.toString().trim();
      if (team) {
        oprData[team] = parseFloat((row['Total OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0;
        autoOprData[team] = parseFloat((row['Auto OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0;
      }
    });
  }

  const eventData = parseCSV().data;

  const calculateTeamEPA = (team) => {
    const teamMatches = eventData.filter(row => {
      const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
      return teamNum === team;
    });
    const totalPoints = teamMatches.map(row => parseFloat(row['Total Points'] || row['Total Score'] || 0)).filter(v => !isNaN(v));
    const avgTotalPoints = totalPoints.length > 0 ? totalPoints.reduce((a, b) => a + b, 0) / totalPoints.length : 0;
    return avgTotalPoints + (oprData[team] || 0);
  };

  const redEPA = redTeams.reduce((sum, team) => sum + calculateTeamEPA(team), 0);
  const blueEPA = blueTeams.reduce((sum, team) => sum + calculateTeamEPA(team), 0);

  const totalEPA = redEPA + blueEPA;
  const redPercentage = totalEPA > 0 ? ((redEPA / totalEPA) * 100).toFixed(1) : "50.0";
  const bluePercentage = totalEPA > 0 ? ((blueEPA / totalEPA) * 100).toFixed(1) : "50.0";

  const redAutoOPR = redTeams.reduce((sum, team) => sum + (autoOprData[team] || 0), 0);
  const blueAutoOPR = blueTeams.reduce((sum, team) => sum + (autoOprData[team] || 0), 0);
  const totalAutoOPR = redAutoOPR + blueAutoOPR;
  const redAutoPercentage = totalAutoOPR > 0 ? ((redAutoOPR / totalAutoOPR) * 100).toFixed(1) : "50.0";
  const blueAutoPercentage = totalAutoOPR > 0 ? ((blueAutoOPR / totalAutoOPR) * 100).toFixed(1) : "50.0";

  let firstShiftAlliance = '';
  let secondShiftAlliance = '';
  let firstShiftColor = '';
  let secondShiftColor = '';

  if (redAutoOPR < blueAutoOPR) {
    firstShiftAlliance = 'RED';
    firstShiftColor = '#ff5c5c';
    secondShiftAlliance = 'BLUE';
    secondShiftColor = '#3EDBF0';
  } else if (blueAutoOPR < redAutoOPR) {
    firstShiftAlliance = 'BLUE';
    firstShiftColor = '#3EDBF0';
    secondShiftAlliance = 'RED';
    secondShiftColor = '#ff5c5c';
  } else {
    firstShiftAlliance = 'RED';
    firstShiftColor = '#ff5c5c';
    secondShiftAlliance = 'BLUE';
    secondShiftColor = '#3EDBF0';
  }

  let matchWinnerColor = '#1e90ff';
  if (redEPA > blueEPA) {
    matchWinnerColor = '#ff5c5c';
  } else if (blueEPA > redEPA) {
    matchWinnerColor = '#3EDBF0';
  }

  let redAllianceColor, blueAllianceColor;
  let redTextColor, blueTextColor;
  let redBarColor, blueBarColor;

  if (redEPA > blueEPA) {
    redAllianceColor = '#ff5c5c';
    redTextColor = 'white';
    redBarColor = '#ff5c5c';

    blueAllianceColor = '#444';
    blueTextColor = '#888';
    blueBarColor = '#666';
  } else if (blueEPA > redEPA) {
    blueAllianceColor = '#3EDBF0';
    blueTextColor = 'white';
    blueBarColor = '#3EDBF0';

    redAllianceColor = '#444';
    redTextColor = '#888';
    redBarColor = '#666';
  } else {
    redAllianceColor = '#ff5c5c';
    redTextColor = 'white';
    redBarColor = '#ff5c5c';

    blueAllianceColor = '#3EDBF0';
    blueTextColor = 'white';
    blueBarColor = '#3EDBF0';
  }

  const resultDiv = document.getElementById('matchPredictionResult');
  if (resultDiv) {
    resultDiv.innerHTML = `
      <div style="display:flex;gap:20px;margin:16px 0;width:100%;">
        <!-- Match Prediction (Left Side) -->
        <div style="flex:1;">
          <div style="text-align:center;margin-bottom:12px;">
            <span style="color:white;font-size:16px;font-weight:bold;border-bottom:2px solid ${matchWinnerColor};padding-bottom:4px;">MATCH PREDICTION</span>
          </div>
          
          <div style="display:flex;justify-content:space-between;align-items:center;width:100%;margin-bottom:12px;">
            <!-- Red Alliance -->
            <div style="flex:1;text-align:center;">
              <div style="color: ${redAllianceColor};font-weight:700;font-size:20px;margin-bottom:4px;">Red</div>
              <div style="color:${redAllianceColor};font-size:24px;font-weight:bold;margin-top:4px;">${redPercentage}%</div>
              <div style="color:${redTextColor};font-size:14px;margin-top:2px;">EPA: ${redEPA.toFixed(2)}</div>
            </div>
            
            <!-- VS Divider -->
            <div style="width:40px;text-align:center;">
              <div style="font-size:16px;color:white;font-weight:bold;">VS</div>
            </div>
            
            <!-- Blue Alliance -->
            <div style="flex:1;text-align:center;">
              <div style="color: ${blueAllianceColor};font-weight:700;font-size:20px;margin-bottom:4px;">Blue</div>
              <div style="color:${blueAllianceColor};font-size:24px;font-weight:bold;margin-top:4px;">${bluePercentage}%</div>
              <div style="color:${blueTextColor};font-size:14px;margin-top:2px;">EPA: ${blueEPA.toFixed(2)}</div>
            </div>
          </div>
          
          <!-- Progress bar for Match Prediction -->
          <div style="width:100%;">
            <div style="height:6px;background:#222;border-radius:6px;overflow:hidden;display:flex;">
              <div style="height:100%;width:${redPercentage}%;background:${redBarColor};"></div>
              <div style="height:100%;width:${bluePercentage}%;background:${blueBarColor};"></div>
            </div>
          </div>
        </div>

        <!-- Alliance Shift (Right Side) -->
        <div style="flex:1;">
          <div style="text-align:center;margin-bottom:12px;">
            <span style="color:white;font-size:16px;font-weight:bold;border-bottom:2px solid ${firstShiftColor};padding-bottom:4px;">ALLIANCE SHIFT</span>
          </div>
          
          <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;margin-bottom:12px;">
            <!-- Red Alliance -->
            <div style="flex:1;text-align:center;">
              <div style="color: ${firstShiftAlliance === 'RED' ? firstShiftColor : '#666'};font-weight:700;font-size:20px;margin-bottom:4px;">Red</div>
              <div style="color: ${firstShiftAlliance === 'RED' ? firstShiftColor : '#666'};font-size:24px;font-weight:bold;margin-bottom:2px;">
                ${firstShiftAlliance === 'RED' ? 'FIRST' : 'SECOND'}
              </div>
              <div style="color: ${firstShiftAlliance === 'RED' ? 'white' : '#666'};font-size:14px;font-weight:normal;">
                Auto OPR: ${redAutoOPR.toFixed(2)}
              </div>
            </div>
            
            <!-- VS Divider -->
            <div style="width:40px;text-align:center;padding-top:30px;">
              <div style="font-size:16px;color:white;font-weight:bold;">VS</div>
            </div>
            
            <!-- Blue Alliance -->
            <div style="flex:1;text-align:center;">
              <div style="color: ${firstShiftAlliance === 'BLUE' ? firstShiftColor : '#666'};font-weight:700;font-size:20px;margin-bottom:4px;">Blue</div>
              <div style="color: ${firstShiftAlliance === 'BLUE' ? firstShiftColor : '#666'};font-size:24px;font-weight:bold;margin-bottom:2px;">
                ${firstShiftAlliance === 'BLUE' ? 'FIRST' : 'SECOND'}
              </div>
              <div style="color: ${firstShiftAlliance === 'BLUE' ? 'white' : '#666'};font-size:14px;font-weight:normal;">
                Auto OPR: ${blueAutoOPR.toFixed(2)}
              </div>
            </div>
          </div>
          
          <!-- Progress bar for Alliance Shift -->
          <div style="width:100%;">
            <div style="height:6px;background:#222;border-radius:6px;overflow:hidden;display:flex;">
              <div style="height:100%;width:${redAutoPercentage}%;background:${redAutoOPR < blueAutoOPR ? '#ff5c5c' : '#666'};"></div>
              <div style="height:100%;width:${blueAutoPercentage}%;background:${blueAutoOPR < redAutoOPR ? '#3EDBF0' : '#666'};"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
/*-----SCOUTING SCHEDULE FUNCTIONS----*/
function generateTargetedScoutingBlocks() {
  if (!scheduleCsvText) {
    document.getElementById('strategyContent').innerHTML =
      '<div style="color: #aaa; text-align: center; width: 100%;">Upload match schedule CSV first</div>';
    return;
  }

  const TEAM = "226";
  const rows = scheduleCsvText.trim().split("\n").map(r => r.split(","));
  const headers = rows[0].map(h => h.trim());

  const matchIndex = headers.indexOf("Match Number");
  const redIndices = [headers.indexOf("Red 1"), headers.indexOf("Red 2"), headers.indexOf("Red 3")];
  const blueIndices = [headers.indexOf("Blue 1"), headers.indexOf("Blue 2"), headers.indexOf("Blue 3")];

  if (matchIndex === -1 || redIndices.includes(-1) || blueIndices.includes(-1)) {
    document.getElementById('strategyContent').innerHTML =
      '<div style="color: red;">Error: Could not find expected column headers in CSV</div>';
    return;
  }

  const schedule = rows.slice(1).map(row => {
    const match = parseInt(row[matchIndex]);
    const red = redIndices.map(i => row[i]?.trim()).filter(Boolean);
    const blue = blueIndices.map(i => row[i]?.trim()).filter(Boolean);
    return { match, red, blue };
  }).filter(m => !isNaN(m.match));

  const teamMatches = {};
  schedule.forEach(({ match, red, blue }) => {
    [...red, ...blue].forEach(team => {
      if (!teamMatches[team]) teamMatches[team] = [];
      teamMatches[team].push(match);
    });
  });
  Object.values(teamMatches).forEach(list => list.sort((a, b) => a - b));

  const matchesWith226 = [];
  schedule.forEach(({ match, red, blue }) => {
    const isRed = red.includes(TEAM);
    const isBlue = blue.includes(TEAM);
    if (isRed || isBlue) {
      const partners = (isRed ? red : blue).filter(t => t !== TEAM);
      const opponents = isRed ? blue : red;
      matchesWith226.push({ matchNum: match, opponents, partners });
    }
  });

  const scoutingMap = {};
  for (const { matchNum, opponents, partners } of matchesWith226) {
    const teamsToScout = [...opponents, ...partners];
    teamsToScout.forEach(team => {
      const priorMatches = (teamMatches[team] || [])
        .filter(m => m < matchNum)
        .sort((a, b) => b - a)
        .slice(0, 2);
      priorMatches.forEach(m => {
        if (!scoutingMap[m]) scoutingMap[m] = new Set();
        scoutingMap[m].add(team);
      });
    });
  }

  const sortedMatches = Object.keys(scoutingMap).map(n => parseInt(n)).sort((a, b) => a - b);

  const container = document.getElementById('strategyContent');
  container.innerHTML = '';

  const currentQualSection = document.createElement('div');
  currentQualSection.style.marginBottom = '18px';
  currentQualSection.style.display = 'flex';
  currentQualSection.style.alignItems = 'center';
  currentQualSection.style.gap = '10px';

  const currentQualLabel = document.createElement('label');
  currentQualLabel.textContent = 'Current Qual Match:';
  currentQualLabel.style.color = 'white';
  currentQualLabel.style.fontWeight = 'bold';
  currentQualLabel.style.fontSize = '17px';
  currentQualLabel.setAttribute('for', 'currentQualMatch');

  const currentQualInput = document.createElement('input');
  currentQualInput.type = 'text';
  currentQualInput.id = 'currentQualMatch';
  currentQualInput.style.background = 'transparent';
  currentQualInput.style.border = 'none';
  currentQualInput.style.borderBottom = '2px solid white';
  currentQualInput.style.color = 'white';
  currentQualInput.style.fontSize = '17px';
  currentQualInput.style.fontFamily = 'inherit';
  currentQualInput.style.width = '70px';
  currentQualInput.style.marginLeft = '8px';
  currentQualInput.style.padding = '2px 0 2px 0';
  currentQualInput.style.outline = 'none';
  currentQualInput.style.boxShadow = 'none';
  currentQualInput.style.verticalAlign = 'middle';
  currentQualInput.style.textAlign = 'center';

  const savedQual = localStorage.getItem('currentQualMatch');
  if (savedQual) currentQualInput.value = savedQual;

  currentQualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      localStorage.setItem('currentQualMatch', currentQualInput.value);
      generateTargetedScoutingBlocks();
    }
  });

  currentQualSection.appendChild(currentQualLabel);
  currentQualSection.appendChild(currentQualInput);
  container.appendChild(currentQualSection);

  const currentQual = parseInt(localStorage.getItem('currentQualMatch')) || 1;

  if (sortedMatches.length === 0) {
    container.innerHTML += `
      <div style="color: #aaa; text-align: center; width: 100%;">
        No targeted scouting assignments found for team ${TEAM}.
      </div>
    `;
    return;
  }

  const mainFlex = document.createElement('div');
  mainFlex.style.display = 'flex';
  mainFlex.style.width = '100%';
  mainFlex.style.gap = '20px';
  mainFlex.style.alignItems = 'flex-start';

  const leftPanel = document.createElement('div');
  leftPanel.style.flex = '3 1 0';
  leftPanel.style.maxWidth = '75%';

  const grid = document.createElement('div');
  grid.className = 'row';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(175px, 1fr))';
  grid.style.gap = '15px';
  grid.style.width = '100%';

  sortedMatches.forEach(matchNum => {
    if (matchNum < currentQual) return;
    const teams = Array.from(scoutingMap[matchNum]).filter(Boolean);
    if (teams.length === 0) return;

    const block = document.createElement('div');
    block.style.backgroundColor = '#1C1E21';
    block.style.borderRadius = '12px';
    block.style.padding = '15px';
    block.style.color = 'white';
    block.style.boxShadow = '#131416 0px 0px 10px';
    block.style.fontFamily = 'Lato';
    block.style.display = 'flex';
    block.style.flexDirection = 'column';
    block.style.gap = '10px';

    const header = document.createElement('h3');
    header.textContent = `Match ${matchNum}`;
    header.style.margin = '0 0 10px 0';
    header.style.color = '#1e90ff';
    header.style.fontSize = '18px';
    header.style.textAlign = 'center';
    block.appendChild(header);

    const teamsList = document.createElement('div');
    teamsList.style.display = 'flex';
    teamsList.style.flexDirection = 'column';
    teamsList.style.gap = '8px';
    teamsList.style.alignItems = 'center';

    teams.forEach(team => {
      const teamDiv = document.createElement('div');
      teamDiv.style.display = 'flex';
      teamDiv.style.alignItems = 'center';
      teamDiv.style.justifyContent = 'center';
      teamDiv.style.gap = '8px';
      teamDiv.style.width = '100%';

      const teamLabel = document.createElement('span');
      teamLabel.textContent = `Team ${team}`;
      teamLabel.style.fontWeight = 'bold';
      teamLabel.style.textAlign = 'center';
      teamDiv.appendChild(teamLabel);
      teamsList.appendChild(teamDiv);
    });

    block.appendChild(teamsList);
    grid.appendChild(block);
  });
  leftPanel.appendChild(grid);

  const rightPanel = document.createElement('div');
  rightPanel.style.flex = '1 1 0';
  rightPanel.style.maxWidth = '25%';
  rightPanel.style.background = '#1C1E21';
  rightPanel.style.borderRadius = '12px';
  rightPanel.style.padding = '18px 12px';
  rightPanel.style.color = 'white';
  rightPanel.style.boxShadow = '#131416 0px 0px 10px';
  rightPanel.style.fontFamily = 'Lato';
  rightPanel.style.display = 'flex';
  rightPanel.style.flexDirection = 'column';
  rightPanel.style.gap = '12px';
  rightPanel.innerHTML = `<h3 style="margin:0 0 10px 0; text-align:center; border-bottom: 2px solid #1e90ff;
    padding-bottom: 8px; color:white;">226 Match Schedule</h3>`;

  matchesWith226
    .sort((a, b) => a.matchNum - b.matchNum)
    .forEach(({ matchNum, opponents, partners }) => {
      if (matchNum < currentQual) return;
      const matchObj = schedule.find(m => m.match === matchNum);
      let isRed = false, isBlue = false;
      if (matchObj) {
        isRed = matchObj.red.includes(TEAM);
        isBlue = matchObj.blue.includes(TEAM);
      }

      const matchRow = document.createElement('div');
      matchRow.style.marginBottom = '10px';
      matchRow.style.background = 'transparent';
      matchRow.style.borderRadius = '8px';
      matchRow.style.padding = '10px 8px';
      matchRow.style.boxShadow = 'none';

      const toggleHeader = document.createElement('div');
      toggleHeader.style.display = 'flex';
      toggleHeader.style.alignItems = 'center';
      toggleHeader.style.cursor = 'pointer';

      const arrowImg = document.createElement('img');
      arrowImg.src = 'images/down_arrow.png';
      arrowImg.alt = 'Toggle';
      arrowImg.style.width = '16px';
      arrowImg.style.height = '16px';
      arrowImg.style.marginRight = '6px';
      arrowImg.style.transition = 'transform 0.2s ease-in-out';

      const qualLabel = document.createElement('span');
      qualLabel.textContent = `Qualification Match ${matchNum}`;
      qualLabel.style.fontWeight = 'bold';
      qualLabel.style.color = '#fff';
      qualLabel.style.flex = '1';

      const viewBtn = document.createElement('button');
      viewBtn.textContent = 'View';
      viewBtn.className = 'blue-button';
      viewBtn.style.marginLeft = '8px';
      viewBtn.style.fontSize = '13px';
      viewBtn.style.padding = '3px 10px';
      viewBtn.style.height = '28px';
      viewBtn.style.lineHeight = '1.2';
      viewBtn.style.minWidth = 'unset';
      viewBtn.style.borderRadius = '5px';

      viewBtn.onclick = function (e) {
        e.stopPropagation();
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(button => {
          button.classList.remove('active');
          button.removeAttribute('disabled');
          button.style.pointerEvents = 'auto';
          button.style.opacity = '1';
        });

        document.getElementById('matchPredictor').classList.add('active');
        document.querySelector('.tab[onclick*="matchPredictor"]').classList.add('active');
        document.querySelector('.content').scrollTo({ top: 0, behavior: 'auto' });

        const scoutingTab = document.querySelector('.tab[onclick*="scoutingSchedule"]');
        if (scoutingTab) {
          scoutingTab.removeAttribute('disabled');
          scoutingTab.style.pointerEvents = 'auto';
          scoutingTab.style.opacity = '1';
        }

        if (matchObj) {
          for (let i = 0; i < 3; i++) {
            document.getElementById(`redTeam${i + 1}`).value = matchObj.red[i] || '';
            document.getElementById(`blueTeam${i + 1}`).value = matchObj.blue[i] || '';
          }
          document.getElementById('matchNumberInput').value = matchNum;

          const allTeams = [
            matchObj.red[0] || '',
            matchObj.red[1] || '',
            matchObj.red[2] || '',
            matchObj.blue[0] || '',
            matchObj.blue[1] || '',
            matchObj.blue[2] || ''
          ].filter(team => team && team !== '');

          if (typeof updateMatchPrediction === 'function') {
            updateMatchPrediction(allTeams);
          }

          if (typeof renderMatchSummary === 'function') {
            renderMatchSummary(allTeams);
          }
        }
      };

      toggleHeader.appendChild(arrowImg);
      toggleHeader.appendChild(qualLabel);
      toggleHeader.appendChild(viewBtn);

      matchRow.appendChild(toggleHeader);

      const detailsDiv = document.createElement('div');
      detailsDiv.style.marginTop = '10px';
      detailsDiv.style.display = 'none';
      detailsDiv.style.fontSize = '15px';

      const redTeams = matchObj ? matchObj.red : [];
      const blueTeams = matchObj ? matchObj.blue : [];

      const listsWrapper = document.createElement('div');
      listsWrapper.style.display = 'flex';
      listsWrapper.style.flexDirection = 'row';
      listsWrapper.style.gap = '8px';
      listsWrapper.style.justifyContent = 'space-between';

      const redDiv = document.createElement('div');
      redDiv.style.display = 'flex';
      redDiv.style.flexDirection = 'column';
      redDiv.style.marginBottom = '8px';
      redDiv.style.minWidth = '60px';
      const redLabel = document.createElement('span');
      redLabel.textContent = 'Red';
      redLabel.style.color = '#ff5c5c';
      redLabel.style.fontWeight = 'bold';
      redLabel.style.marginBottom = '2px';
      redLabel.style.fontSize = '18px';
      redDiv.appendChild(redLabel);
      redTeams.forEach(t => {
        const teamSpan = document.createElement('span');
        teamSpan.textContent = t;
        teamSpan.style.color = t === TEAM ? '#ff5c5c' : '#fff';
        teamSpan.style.fontWeight = t === TEAM ? 'bold' : 'normal';
        teamSpan.style.fontSize = '17px';
        redDiv.appendChild(teamSpan);
      });

      const blueDiv = document.createElement('div');
      blueDiv.style.display = 'flex';
      blueDiv.style.flexDirection = 'column';
      blueDiv.style.marginBottom = '8px';
      blueDiv.style.minWidth = '60px';
      const blueLabel = document.createElement('span');
      blueLabel.textContent = 'Blue';
      blueLabel.style.color = '#3EDBF0';
      blueLabel.style.fontWeight = 'bold';
      blueLabel.style.marginBottom = '2px';
      blueLabel.style.fontSize = '18px';
      blueDiv.appendChild(blueLabel);
      blueTeams.forEach(t => {
        const teamSpan = document.createElement('span');
        teamSpan.textContent = t;
        teamSpan.style.color = t === TEAM ? '#3EDBF0' : '#fff';
        teamSpan.style.fontWeight = t === TEAM ? 'bold' : 'normal';
        teamSpan.style.fontSize = '17px';
        blueDiv.appendChild(teamSpan);
      });

      listsWrapper.appendChild(redDiv);
      listsWrapper.appendChild(blueDiv);
      detailsDiv.appendChild(listsWrapper);

      toggleHeader.addEventListener('click', () => {
        const isOpen = detailsDiv.style.display === 'block';
        detailsDiv.style.display = isOpen ? 'none' : 'block';
        arrowImg.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
      });

      matchRow.appendChild(detailsDiv);
      rightPanel.appendChild(matchRow);
    });

  mainFlex.appendChild(leftPanel);
  mainFlex.appendChild(rightPanel);
  container.appendChild(mainFlex);
}

function renderTargetedScouterView() {
  const container = document.getElementById('targetedScoutingContainer');
  container.innerHTML = '';

  const mainFlex = document.createElement('div');
  mainFlex.style.display = 'flex';
  mainFlex.style.width = '100%';
  mainFlex.style.gap = '20px';
  mainFlex.style.alignItems = 'flex-start';

  const leftPanel = document.createElement('div');
  leftPanel.style.flex = '3 1 0';
  leftPanel.style.maxWidth = '75%';

  const currentQualSection = document.createElement('div');
  currentQualSection.style.marginBottom = '18px';
  currentQualSection.style.display = 'flex';
  currentQualSection.style.alignItems = 'center';
  currentQualSection.style.gap = '10px';

  const currentQualLabel = document.createElement('label');
  currentQualLabel.textContent = 'Current Qual Match:';
  currentQualLabel.style.color = 'white';
  currentQualLabel.style.fontWeight = 'bold';
  currentQualLabel.style.fontSize = '17px';
  currentQualLabel.setAttribute('for', 'currentQualMatchPicklist');

  const currentQualInput = document.createElement('input');
  currentQualInput.type = 'text';
  currentQualInput.id = 'currentQualMatchPicklist';
  currentQualInput.style.background = 'transparent';
  currentQualInput.style.border = 'none';
  currentQualInput.style.borderBottom = '2px solid white';
  currentQualInput.style.color = 'white';
  currentQualInput.style.fontSize = '17px';
  currentQualInput.style.fontFamily = 'inherit';
  currentQualInput.style.width = '70px';
  currentQualInput.style.marginLeft = '8px';
  currentQualInput.style.padding = '2px 0 2px 0';
  currentQualInput.style.outline = 'none';
  currentQualInput.style.boxShadow = 'none';
  currentQualInput.style.verticalAlign = 'middle';
  currentQualInput.style.textAlign = 'center';

  const savedQual = localStorage.getItem('currentQualMatchPicklist');
  if (savedQual) currentQualInput.value = savedQual;

  currentQualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      localStorage.setItem('currentQualMatchPicklist', currentQualInput.value);
      renderTargetedBlocks();
    }
  });

  currentQualSection.appendChild(currentQualLabel);
  currentQualSection.appendChild(currentQualInput);
  leftPanel.appendChild(currentQualSection);

  const rightPanel = document.createElement('div');
  rightPanel.style.flex = '1 1 0';
  rightPanel.style.maxWidth = '25%';
  rightPanel.style.background = '#1C1E21';
  rightPanel.style.borderRadius = '12px';
  rightPanel.style.padding = '18px 12px';
  rightPanel.style.color = 'white';
  rightPanel.style.boxShadow = '#131416 0px 0px 10px';
  rightPanel.style.fontFamily = 'Lato';
  rightPanel.style.display = 'flex';
  rightPanel.style.flexDirection = 'column';
  rightPanel.style.gap = '12px';

  rightPanel.innerHTML = `
  <h3 style="margin:0 0 10px 0; text-align:center; border-bottom: 2px solid #1e90ff;
    padding-bottom: 8px; color:white;">Picklist Teams</h3>
  <div style="display:flex;gap:10px;margin-bottom:15px;">
    <input type="text" id="picklistInput" placeholder="Team #"
      style="flex:1;padding:8px;border-radius:4px;background-color:#2a2d31;color:white;border:1px solid #888;font-family:'Lato';font-size:medium;">
    <button id="addPicklistBtn" style="padding:8px 16px;background:#1e90ff;color:white;border:none;border-radius:4px;font-weight:bold;cursor:pointer;">Add</button>
  </div>
  <div id="picklistListContainer" style="max-height:300px;overflow-y:auto;transition:max-height 0.3s;">
    <ul id="picklistList" style="list-style:none;padding:0;margin:0;color:white;font-family:'Lato';font-size:medium;"></ul>
  </div>
  <div style="display:flex;align-items:center;gap:10px;margin-top:15px;justify-content:center;">
    <button id="resetPicklistBtn" style="
      background: #ff1e1e;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 15px;
      padding: 8px 28px;
      cursor: pointer;
    "
    onmouseover="this.style.background='#ff7b7b';this.style.boxShadow='0 4px 16px #ff5c5c55';"
    onmouseout="this.style.background='#ff5c5c';this.style.boxShadow='0 2px 8px #0003';"
    >Reset</button>
  </div>
`;

  const picklistInput = rightPanel.querySelector('#picklistInput');
  picklistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const teamNumber = picklistInput.value.trim();
      if (!teamNumber) return;
      if (!picklist.includes(teamNumber)) {
        picklist.push(teamNumber);
        picklist.sort((a, b) => parseInt(a) - parseInt(b));
        picklistInput.value = '';
        renderPicklist();
        localStorage.setItem('picklist', JSON.stringify(picklist));
        renderTargetedBlocks();
      }
    }
  });
  let picklist = JSON.parse(localStorage.getItem('picklist') || '[]');
  renderPicklist();

  rightPanel.querySelector('#addPicklistBtn').onclick = function () {
    const input = rightPanel.querySelector('#picklistInput');
    const teamNumber = input.value.trim();
    if (!teamNumber) return;
    if (!picklist.includes(teamNumber)) {
      picklist.push(teamNumber);
      picklist.sort((a, b) => parseInt(a) - parseInt(b));
      input.value = '';
      renderPicklist();
      localStorage.setItem('picklist', JSON.stringify(picklist));
      renderTargetedBlocks();
    }
  };

  rightPanel.querySelector('#resetPicklistBtn').onclick = function () {
    picklist = [];
    renderPicklist();
    localStorage.setItem('picklist', JSON.stringify(picklist));
    renderTargetedBlocks();
  };

  function renderPicklist() {
    const list = rightPanel.querySelector('#picklistList');
    list.innerHTML = '';
    picklist.forEach(team => {
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
      listItem.appendChild(teamText);

      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'X';
      deleteButton.style.padding = '2px 8px';
      deleteButton.style.backgroundColor = '#ff5c5c';
      deleteButton.style.color = 'white';
      deleteButton.style.border = 'none';
      deleteButton.style.borderRadius = '4px';
      deleteButton.style.cursor = 'pointer';

      deleteButton.addEventListener('click', (e) => {
        e.preventDefault();
        picklist = picklist.filter(t => t !== team);
        renderPicklist();
        localStorage.setItem('picklist', JSON.stringify(picklist));
        renderTargetedBlocks();
      });

      listItem.appendChild(deleteButton);
      list.appendChild(listItem);
    });
  }

  const blocksContainer = document.createElement('div');
  blocksContainer.id = 'targetedBlocksContainer';
  leftPanel.appendChild(blocksContainer);

  mainFlex.appendChild(leftPanel);
  mainFlex.appendChild(rightPanel);
  container.appendChild(mainFlex);

  renderTargetedBlocks();

  function renderTargetedBlocks() {
    blocksContainer.innerHTML = '';
    if (!scheduleCsvText) {
      blocksContainer.innerHTML = '<div style="color: #aaa; text-align: center; width: 100%;">Upload match schedule CSV first</div>';
      return;
    }
    const rows = scheduleCsvText.trim().split("\n").map(r => r.split(","));
    const headers = rows[0].map(h => h.trim());
    const matchIndex = headers.indexOf("Match Number");
    const redIndices = [headers.indexOf("Red 1"), headers.indexOf("Red 2"), headers.indexOf("Red 3")];
    const blueIndices = [headers.indexOf("Blue 1"), headers.indexOf("Blue 2"), headers.indexOf("Blue 3")];
    if (matchIndex === -1 || redIndices.includes(-1) || blueIndices.includes(-1)) {
      blocksContainer.innerHTML = '<div style="color: red;">Error: Could not find expected column headers in CSV</div>';
      return;
    }
    const schedule = rows.slice(1).map(row => {
      const match = parseInt(row[matchIndex]);
      const red = redIndices.map(i => row[i]?.trim()).filter(Boolean);
      const blue = blueIndices.map(i => row[i]?.trim()).filter(Boolean);
      return { match, teams: [...red, ...blue] };
    }).filter(m => !isNaN(m.match));

    const matchToPicklistTeams = {};
    schedule.forEach(({ match, teams }) => {
      const presentPicklistTeams = picklist.filter(team => teams.includes(team));
      if (presentPicklistTeams.length > 0) {
        matchToPicklistTeams[match] = presentPicklistTeams;
      }
    });

    const currentQual = parseInt(localStorage.getItem('currentQualMatchPicklist')) || 1;

    const filteredMatches = Object.entries(matchToPicklistTeams)
      .filter(([match]) => parseInt(match) >= currentQual)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    if (filteredMatches.length === 0) {
      blocksContainer.innerHTML = `<div style="color: #aaa; text-align: center; width: 100%;">No matches found for picklist teams.</div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'row';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(175px, 1fr))';
    grid.style.gap = '15px';
    grid.style.width = '100%';

    filteredMatches.forEach(([match, teams]) => {
      const block = document.createElement('div');
      block.style.backgroundColor = '#1C1E21';
      block.style.borderRadius = '12px';
      block.style.padding = '15px';
      block.style.color = 'white';
      block.style.boxShadow = '#131416 0px 0px 10px';
      block.style.fontFamily = 'Lato';
      block.style.display = 'flex';
      block.style.flexDirection = 'column';
      block.style.gap = '10px';

      const header = document.createElement('h3');
      header.textContent = `Match ${match}`;
      header.style.margin = '0 0 10px 0';
      header.style.color = '#1e90ff';
      header.style.fontSize = '18px';
      header.style.textAlign = 'center';
      block.appendChild(header);

      const teamsList = document.createElement('div');
      teamsList.style.display = 'flex';
      teamsList.style.flexDirection = 'column';
      teamsList.style.gap = '8px';
      teamsList.style.alignItems = 'center';

      teams.forEach(team => {
        const teamDiv = document.createElement('div');
        teamDiv.style.display = 'flex';
        teamDiv.style.alignItems = 'center';
        teamDiv.style.justifyContent = 'center';
        teamDiv.style.gap = '8px';
        teamDiv.style.width = '100%';

        const teamLabel = document.createElement('span');
        teamLabel.textContent = `Team ${team}`;
        teamLabel.style.fontWeight = 'bold';
        teamLabel.style.textAlign = 'center';
        teamLabel.style.color = 'white';
        teamDiv.appendChild(teamLabel);

        teamsList.appendChild(teamDiv);
      });

      block.appendChild(teamsList);
      grid.appendChild(block);
    });

    blocksContainer.appendChild(grid);
  }
}

window.renderTargetedScouterView = renderTargetedScouterView;
window.generateTargetedScoutingBlocks = generateTargetedScoutingBlocks;

window.renderTargetedScouterView = renderTargetedScouterView;
window.generateTargetedScoutingBlocks = generateTargetedScoutingBlocks;