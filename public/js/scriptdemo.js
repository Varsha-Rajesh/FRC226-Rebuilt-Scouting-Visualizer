/*-----VARIABLES----*/

// Charts
const charts = {
  autoCoral: null,
  autoAlgae: null,
  teleCoral: null,
  teleAlgae: null,
  endGame: null,
  overviewStackedChart: null,
  coralCyclesChart: null,
  algaeCyclesChart: null,
  reliabilityChartsArea: null,
};

let pitScoutingData = [];
let tbaClimbData = {};
let coralMismatchData = [];
let hiddenTeams = JSON.parse(localStorage.getItem('hiddenTeams') || '[]');
let showHiddenTeamsInFilter = false;
let isolatedTeams = [];
let isIsolated = false;
let highlightedOverviewTeam = null;
let csvText = localStorage.getItem('csvText') || "";
let pitCsvText = localStorage.getItem('pitCsvText') || "";
let scheduleCsvText = localStorage.getItem('scheduleCsvText') || "";

let isBoxPlot = true;

/*-----RELIABILITY CHARTS-----*/

if (typeof Chart !== 'undefined' && window.ChartBoxplot) {
  Chart.register(window.ChartBoxplot);
} else {
  console.error('Chart.js or Boxplot plugin not loaded');
}

Chart.register({
  id: 'boxplot',
  beforeDraw: function (chart) {
  }
});

const reliabilityMetrics = [
  { id: 'reliabilityTotalPoints', label: 'Total Points', color: '#3ED098', getValue: row => parseFloat(row['Total Score'] || 0) },
  { id: 'reliabilityAutoPoints', label: 'Auto Points', color: '#51E7CF', getValue: row => parseFloat(row['Auton Score'] || 0) },
  { id: 'reliabilityTelePoints', label: 'Tele Points', color: '#3ecdd0', getValue: row => (parseFloat(row['Total Score'] || 0) - parseFloat(row['Auton Score'] || 0)) },
  {
    id: 'reliabilityTotalCycles', label: 'Total Cycles', color: '#cf8ffc', getValue: row =>
    (parseInt(row['L1'] || 0) + parseInt(row['L2'] || 0) + parseInt(row['L3'] || 0) + parseInt(row['L4'] || 0) +
      parseInt(row['Algae in Net'] || 0) + parseInt(row['Algae in Processor'] || 0))
  },
  {
    id: 'reliabilityTotalCoralCycles', label: 'Total Coral Cycles', color: '#ff83fa', getValue: row =>
      (parseInt(row['L1'] || 0) + parseInt(row['L2'] || 0) + parseInt(row['L3'] || 0) + parseInt(row['L4'] || 0))
  },
  { id: 'reliabilityL4Cycles', label: 'L4 Cycles', color: '#ff8bfc', getValue: row => parseInt(row['L4'] || 0) },
  { id: 'reliabilityL3Cycles', label: 'L3 Cycles', color: '#ed0cef', getValue: row => parseInt(row['L3'] || 0) },
  { id: 'reliabilityL2Cycles', label: 'L2 Cycles', color: '#BF02ff', getValue: row => parseInt(row['L2'] || 0) },
  { id: 'reliabilityL1Cycles', label: 'L1 Cycles', color: '#8105d8', getValue: row => parseInt(row['L1'] || 0) },
  {
    id: 'reliabilityTotalAlgaeCycles', label: 'Total Algae Cycles', color: '#006fff', getValue: row =>
      (parseInt(row['Algae in Net'] || 0) + parseInt(row['Algae in Processor'] || 0))
  },
  { id: 'reliabilityBargeCycles', label: 'Barge Cycles', color: '#3498db', getValue: row => parseInt(row['Algae in Net'] || 0) },
  { id: 'reliabilityProcessorCycles', label: 'Processor Cycles', color: '#14c7de', getValue: row => parseInt(row['Algae in Processor'] || 0) }
];

function toggleEPAAvg(containerId, show) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const charts = container.querySelectorAll('canvas');

  charts.forEach(canvas => {
    const chart = Chart.getChart(canvas);
    if (chart) {
      chart.data.datasets.forEach((dataset, i) => {
        if (dataset.label === 'Average') {
          chart.setDatasetVisibility(i, show);
        }
      });
      chart.update('none');
    }
  });
}

/*-----RANKINGS-----*/
function getGradientColor(value, distribution) {
  if (isNaN(value)) return 'black';

  const redDark = [110, 40, 60];
  const white = [44, 46, 49];
  const greenDark = [60, 120, 80];

  const sorted = [...distribution].filter(v => !isNaN(v)).sort((a, b) => a - b);
  const index = sorted.findIndex(v => value <= v);
  const percentile = index === -1 ? 1 : index / (sorted.length - 1 || 1);

  let r, g, b;
  if (percentile <= 0.5) {
    const ratio = percentile / 0.5;
    r = Math.round(redDark[0] * (1 - ratio) + white[0] * ratio);
    g = Math.round(redDark[1] * (1 - ratio) + white[1] * ratio);
    b = Math.round(redDark[2] * (1 - ratio) + white[2] * ratio);
  } else {
    const ratio = (percentile - 0.5) / 0.5;
    r = Math.round(white[0] * (1 - ratio) + greenDark[0] * ratio);
    g = Math.round(white[1] * (1 - ratio) + greenDark[1] * ratio);
    b = Math.round(white[2] * (1 - ratio) + greenDark[2] * ratio);
  }
  return `rgb(${r},${g},${b})`;
}

function updateRankingTableColumns() {
  const alwaysShow = [0, 1, 2];
  const statMap = {
    avgTotalScore: 2,
    avgAutoScore: 3,
    avgTeleScore: 4,
    avgClimbScore: 5,
    avgAutoL4: 6,
    avgAutoLeaveStart: 7,
    avgTeleL4: 8,
    avgTeleL3: 9,
    avgTeleL2: 10,
    avgTeleL1: 11,
    avgTeleCoral: 12,
    avgAlgaeRemoved: 13,
    avgAlgaeProcessed: 14,
    avgAlgaeBarge: 15,
    avgTeleAlgae: 16,
    climbAttempts: 17,
    climbSuccess: 18,
    driverSkill: 19,
    countDefenseRating: 20,
    maxDefenseRating: 21,
    diedRate: 22,
    maxAlgaeNet: 23,
    maxTeleCoral: 24
  };
  const checked = Array.from(document.querySelectorAll('#rankingFilterForm input[type="checkbox"]:checked')).map(cb => cb.value);

  const ths = document.querySelectorAll('#rankingTable thead th');
  const trs = document.querySelectorAll('#rankingTable tbody tr');

  ths.forEach((th, idx) => {
    if (alwaysShow.includes(idx) || checked.some(key => statMap[key] === idx)) {
      th.style.display = '';
    } else {
      th.style.display = 'none';
    }
  });
  trs.forEach(tr => {
    Array.from(tr.children).forEach((td, idx) => {
      if (alwaysShow.includes(idx) || checked.some(key => statMap[key] === idx)) {
        td.style.display = '';
      } else {
        td.style.display = 'none';
      }
    });
  });
}

document.getElementById('rankingFilterForm').addEventListener('change', function () {
  renderRankingTable();
  updateRankingTableColumns();
  saveRankingFilterState();
});

document.addEventListener('DOMContentLoaded', () => {
  updateRankingTableColumns();

});

function renderRankingTable() {

  if (typeof Papa === 'undefined' || typeof csvText === 'undefined') return;
  const parsed = Papa.parse(csvText, { header: true }).data;
  const tableBody = document.getElementById('rankingTableBody');
  if (!tableBody) return;

  const checked = Array.from(document.querySelectorAll('#rankingFilterForm input[type="checkbox"]:checked')).map(cb => cb.value);
  const statMap = {
    avgTotalScore: 2,
    avgAutoScore: 3,
    avgTeleScore: 4,
    avgClimbScore: 5,
    avgAutoL4: 6,
    avgAutoLeaveStart: 7,
    avgTeleL4: 8,
    avgTeleL3: 9,
    avgTeleL2: 10,
    avgTeleL1: 11,
    avgTeleCoral: 12,
    avgAlgaeRemoved: 13,
    avgAlgaeProcessed: 14,
    avgAlgaeBarge: 15,
    avgTeleAlgae: 16,
    climbAttempts: 17,
    climbSuccess: 18,
    driverSkill: 19,
    countDefenseRating: 20,
    maxDefenseRating: 21,
    diedRate: 22,
    maxAlgaeNet: 23,
    maxTeleCoral: 24
  };
  const visibleColumns = new Set([0, 1, 2]); 
  checked.forEach(key => visibleColumns.add(statMap[key]));

  const visibleTeamsData = parsed.filter(row => {
    if (isIsolated && isolatedTeams.length > 0) {
      return isolatedTeams.includes(row['Team No.']);
    }
    return !hiddenTeams.includes(row['Team No.']);
  });
  const teams = {};
  visibleTeamsData.forEach(row => {
    const team = row['Team No.'];
    if (!team) return;
    if (!teams[team]) teams[team] = [];
    teams[team].push(row);
  });

  const metricKeys = [
    'Total Score', 'Auton Score', 'Teleop Score', 'Climb Score', 'Auton L4', 'Auton Leave starting line',
    'L4', 'L3', 'L2', 'L1', 'Tele Coral', 'Algae removed', 'Algae in Processor', 'Algae in Net',
    'Tele Algae', 'Climb Attempts', 'Climb Success', 'Driver skill', 'Defense Rating', 'MAX Defense Rating',
    'Died or Immobilized', 'Algae in Net', 'Tele Coral'
  ];

  const metricStats = metricKeys.map(key => {
    const vals = Object.values(teams).map(arr => {
      if (key === 'Tele Coral') {
        return arr.map(r =>
          (parseInt(r['L1'] || 0)) +
          (parseInt(r['L2'] || 0)) +
          (parseInt(r['L3'] || 0)) +
          (parseInt(r['L4'] || 0))
        ).reduce((a, b) => a + b, 0) / arr.length;
      }
      if (key === 'Tele Algae') {
        return arr.map(r =>
          (parseInt(r['Algae in Net'] || 0)) +
          (parseInt(r['Algae in Processor'] || 0))
        ).reduce((a, b) => a + b, 0) / arr.length;
      }
      if (key === 'Climb Attempts') {
        return arr.filter(r => r['Climb Score'] !== undefined && r['Climb Score'] !== '').length;
      }
      if (key === 'Climb Success') {
        return arr.filter(r => r['Climb Score'] === '12' || r['Climb Score'] === '6').length;
      }
      if (key === 'MAX Defense Rating' || key === 'Algae in Net' || key === 'Tele Coral') {
        return Math.max(...arr.map(r => parseFloat(r[key] || 0)).filter(v => !isNaN(v)), 0);
      }
      const vals = arr.map(r => parseFloat(r[key] || 0)).filter(v => !isNaN(v));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const mid = min + (max - min) / 2;
    return { min, max, mid, vals };
  });

  const sortedTeams = Object.keys(teams)
    .sort((a, b) => {
      const avgA = metricStats[0].vals[Object.keys(teams).indexOf(a)];
      const avgB = metricStats[0].vals[Object.keys(teams).indexOf(b)];
      return avgB - avgA;
    });

  tableBody.innerHTML = '';
  sortedTeams.forEach((team, idx) => {
    const arr = teams[team];
    const teleCoralCycles = arr.map(r =>
      (parseInt(r['L1'] || 0)) +
      (parseInt(r['L2'] || 0)) +
      (parseInt(r['L3'] || 0)) +
      (parseInt(r['L4'] || 0))
    );
    const teleAlgaeCycles = arr.map(r =>
      (parseInt(r['Algae in Net'] || 0)) +
      (parseInt(r['Algae in Processor'] || 0))
    );
    const climbAttempts = arr.filter(r => r['Climb Score'] !== undefined && r['Climb Score'] !== '').length;
    const climbSuccess = arr.filter(r => r['Climb Score'] === '12' || r['Climb Score'] === '6').length;

    const metricValues = [
      avg(arr, 'Total Score'),
      avg(arr, 'Auton Score'),
      avg(arr, 'Teleop Score'),
      avg(arr, 'Climb Score'),
      avg(arr, 'Auton L4'),
      avg(arr, 'Auton Leave starting line'),
      avg(arr, 'L4'),
      avg(arr, 'L3'),
      avg(arr, 'L2'),
      avg(arr, 'L1'),
      teleCoralCycles.length ? (teleCoralCycles.reduce((a, b) => a + b, 0) / teleCoralCycles.length).toFixed(2) : '0.00',
      avg(arr, 'Algae removed'),
      avg(arr, 'Algae in Processor'),
      avg(arr, 'Algae in Net'),
      teleAlgaeCycles.length ? (teleAlgaeCycles.reduce((a, b) => a + b, 0) / teleAlgaeCycles.length).toFixed(2) : '0.00',
      climbAttempts,
      climbSuccess,
      avg(arr, 'Driver skill'),
      count(arr, 'Defense Rating'),
      max(arr, 'Defense Rating'),
      percent(arr, 'Died or Immobilized', '1'),
      max(arr, 'Algae in Net'),
      max(teleCoralCycles, null)
    ];

    const row = document.createElement('tr');
    if (team === "226") row.classList.add('team-226');
    let html = `<td>${idx + 1}</td><td>${team}</td>`;

    metricValues.forEach((val, i) => {
      const colIdx = i + 2; 
      const numVal = parseFloat(val);
      const bg = getGradientColor(numVal, metricStats[i].vals);
      const displayStyle = visibleColumns.has(colIdx) ? '' : 'display:none;';
      html += `<td style="background:${bg};${displayStyle}">${val}</td>`;
    });


    row.innerHTML = html;
    tableBody.appendChild(row);
  });
  function avg(arr, key) {
    const vals = arr.map(r => parseFloat(r[key] || 0)).filter(v => !isNaN(v));
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '0.00';
  }
  function max(arr, key) {
    if (key === null) return Math.max(...arr.filter(v => !isNaN(v)), 0);
    const vals = arr.map(r => parseFloat(r[key] || 0)).filter(v => !isNaN(v));
    return vals.length ? Math.max(...vals) : 0;
  }
  function count(arr, key) {
    return arr.filter(r => r[key] !== undefined && r[key] !== '').length;
  }
  function percent(arr, key, val = '1') {
    const total = arr.length;
    const count = arr.filter(r => r[key] === val).length;
    return total ? ((count / total) * 100).toFixed(1) : '0.0';
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
  isIsolated = !!this.checked;
  saveIsolatedTeamsRanking();
  renderRankingTable();
  updateRankingTableColumns();
});

document.getElementById('revertIsolateTeamButtonRanking').addEventListener('click', function () {
  isIsolated = false;
  isolatedTeams = [];
  saveIsolatedTeamsRanking();
  renderIsolatedTeamsListRanking();
  renderRankingTable();
  updateRankingTableColumns();
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
    const isolateCheckbox = document.getElementById('isolateTeamBoxRankingIsolate');
    if (isolateCheckbox) isolateCheckbox.checked = !!isIsolated;
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

  container.style.height = list.children.length > 0 ? `${list.scrollHeight + 10}px` : 'auto';
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

  if (e.key === 'Enter' && e.location === 3){
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

function parseCSV() {
  return Papa.parse(csvText, { header: true });
}

async function handleDataUpload(e) {
  e.preventDefault();
  const fileInput = document.getElementById('dataFile');
  const statusEl = document.getElementById('statusData');
  const file = fileInput.files[0];
  if (!file || !file.name.endsWith('.csv')) {
    statusEl.textContent = 'Please upload a valid .csv file.';
    return;
  }
  const reader = new FileReader();
  reader.onload = function (evt) {
    csvText = evt.target.result;
    localStorage.setItem('csvText', csvText);
    statusEl.textContent = 'Event CSV uploaded!';
    renderRankingTable();
    updateRankingTableColumns();
  };
  reader.readAsText(file);
}

document.getElementById('submitData').addEventListener('click', handleDataUpload);

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
    pitCsvText = evt.target.result;
    localStorage.setItem('pitCsvText', pitCsvText);
    statusEl.textContent = 'Pit CSV uploaded!';
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


function deleteFile(type) {
  if (type === 'dataFile') {
    csvText = "";
    localStorage.removeItem('csvText');
    document.getElementById('dataFile').value = "";
    document.getElementById('statusData').textContent = "Event CSV deleted.";
  } else if (type === 'pitFile') {
    pitCsvText = "";
    localStorage.removeItem('pitCsvText');
    document.getElementById('pitFile').value = "";
    document.getElementById('statusPit').textContent = "Pit CSV deleted.";
  } else if (type === 'scheduleFile') {
    scheduleCsvText = "";
    localStorage.removeItem('scheduleCsvText');
    document.getElementById('scheduleFile').value = "";
    document.getElementById('statusSchedule').textContent = "File succsessfully deleted";
  }

}

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
    renderOverviewStackedChart(parsedData.data, 'all');
    renderCoralCyclesChart(parsedData.data);
    renderAlgaeCyclesChart(parsedData.data);
    renderRescoutTable(parsedData.data);
    updateDefenseRankings(parsedData.data);
    applyFilters();

    document.getElementById('rescoutFilter').value = 'all';

    const latestMatch = getLatestMatchNumber(parsedData.data);
    if (latestMatch) {
      document.getElementById('latestMatchInfoSidebar').textContent = `Data up till Q${latestMatch}`;
    }
  });
}
async function handlePitUpload(fileInputId, statusId) {
  const fileInput = document.getElementById(fileInputId);
  const statusEl = document.getElementById(statusId);
  const file = fileInput.files[0];

  if (!file || !file.name.endsWith(".csv")) {
    statusEl.textContent = "Please upload a valid .csv file.";
    return;
  }

  try {
    const formData = new FormData();
    formData.append('dataFile', file);
    formData.append('uploadType', 'csvPitScouting');

    const text = await file.text();
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transform: (value, header) => {
        const normalizedHeader = header.trim();
        if (normalizedHeader === 'Ground Barge' || normalizedHeader === 'Ground Processor') {
          return value === '1';
        }
        return value;
      }
    });

    pitScoutingData = result.data.filter(row => {
      return row['Team No.'] &&
        (row['Ground Barge'] !== undefined) &&
        (row['Ground Processor'] !== undefined);
    });

    statusEl.textContent = `Successfully loaded pit data for ${pitScoutingData.length} teams`;

    const currentTeam = document.getElementById('teamSearch').value.trim();
    if (currentTeam) {
      const teamData = filterTeamData(currentTeam);
      if (teamData.length > 0) {
        renderTeamStatistics(teamData, pitScoutingData);
      }
    }

    const comparisonTeam1 = document.getElementById('comparisonSearch1').value.trim();
    const comparisonTeam2 = document.getElementById('comparisonSearch2').value.trim();

    if (comparisonTeam1) {
      const team1Data = filterTeamData(comparisonTeam1);
      if (team1Data.length > 0) {
        renderComparisonTeamStatistics(team1Data, pitScoutingData, 1);
      }
    }

    if (comparisonTeam2) {
      const team2Data = filterTeamData(comparisonTeam2);
      if (team2Data.length > 0) {
        renderComparisonTeamStatistics(team2Data, pitScoutingData, 2);
      }
    }

    applyFilters();
  } catch (error) {
    statusEl.textContent = "Error: " + error.message;
    pitScoutingData = [];
  }
}
async function deleteFile(fileType) {
  let filename, statusId, fileInputId;

  if (fileType === 'dataFile') {
    filename = 'data.csv';
    statusId = 'statusData';
    fileInputId = 'dataFile';
  } else if (fileType === 'pitFile') {
    filename = 'pit_scouting.csv';
    statusId = 'statusPit';
    fileInputId = 'pitFile';
  } else if (fileType === 'scheduleFile') {
    filename = 'schedule.csv';
    statusId = 'statusSchedule';
    fileInputId = 'scheduleFile';
  }

  try {
    if (filename) {
      await fetch(`/uploads/${filename}`, {
        method: 'DELETE'
      });
    }

    document.getElementById(fileInputId).value = '';
    document.getElementById(statusId).textContent = 'File deleted successfully';

    if (fileType === 'dataFile') {
      clearAllCharts();
      clearRescoutTable();
    } else if (fileType === 'pitFile') {
      pitScoutingData = [];

      const currentTeam = document.getElementById('teamSearch').value.trim();
      if (currentTeam) {
        const teamData = filterTeamData(currentTeam);
        if (teamData.length > 0) {
          renderTeamStatistics(teamData, []);
        }
      }

      const comparisonTeam1 = document.getElementById('comparisonSearch1').value.trim();
      const comparisonTeam2 = document.getElementById('comparisonSearch2').value.trim();

      if (comparisonTeam1) {
        const team1Data = filterTeamData(comparisonTeam1);
        if (team1Data.length > 0) {
          renderComparisonTeamStatistics(team1Data, [], 1);
        }
      }

      if (comparisonTeam2) {
        const team2Data = filterTeamData(comparisonTeam2);
        if (team2Data.length > 0) {
          renderComparisonTeamStatistics(team2Data, [], 2);
        }
      }
    } else if (fileType === 'scheduleFile') {
      scheduleCsvText = "";
      localStorage.removeItem('scheduleCsvText');
      document.getElementById('statusSchedule').textContent = "File succsessfully deleted";
      document.getElementById('scheduleFile').value = "";
      const strategyContent = document.getElementById('strategyContent');
      if (strategyContent) strategyContent.innerHTML = '';
      const targetedScoutingContainer = document.getElementById('targetedScoutingContainer');
      if (targetedScoutingContainer) targetedScoutingContainer.innerHTML = '';
    }
  } catch (error) {
    document.getElementById(fileInputId).value = '';
    document.getElementById(statusId).textContent = 'File deleted successfully';

    if (fileType === 'dataFile') {
      clearAllCharts();
      clearRescoutTable();
    } else if (fileType === 'pitFile') {
      pitScoutingData = [];
    } else if (fileType === 'scheduleFile') {
      scheduleCsvText = "";
      localStorage.removeItem('scheduleCsvText');
      document.getElementById('statusSchedule').textContent = "File succsessfully deleted";
      document.getElementById('scheduleFile').value = "";
      const strategyContent = document.getElementById('strategyContent');
      if (strategyContent) strategyContent.innerHTML = '';
      const targetedScoutingContainer = document.getElementById('targetedScoutingContainer');
      if (targetedScoutingContainer) targetedScoutingContainer.innerHTML = '';
    }
  }
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

/*-----DEFENSE RANKING FUNCTIONS----*/
function calculateDefenseRankings(data) {
  const matches = {};
  const teamMatches = {};
  const robotDiedMap = {};

  const getAllianceFromColor = (color) => {
    if (!color) return null;
    const alliance = color.toLowerCase().trim();
    if (alliance.startsWith('red') || alliance.startsWith('r')) return 'red';
    if (alliance.startsWith('blue') || alliance.startsWith('b')) return 'blue';
    return null;
  };

  data.forEach(row => {
    const match = row['Match'];
    const teamNumber = row['Team No.'];
    const died = row['Died or Immobilized'] === '1';

    if (match && teamNumber) {
      if (!robotDiedMap[match]) {
        robotDiedMap[match] = new Set();
      }
      if (died) {
        robotDiedMap[match].add(teamNumber);
      }
    }
  });

  data.forEach(row => {
    const match = row['Match'];
    const teamNumber = row['Team No.'];
    const robotColor = row['Robot Color'];
    const totalScore = parseFloat(row['Total Score']) || 0;

    if (!match || !teamNumber || !robotColor) return;

    const alliance = getAllianceFromColor(robotColor);
    if (!alliance) return;

    if (!matches[match]) {
      matches[match] = { red: [], blue: [] };
    }

    matches[match][alliance].push({ teamNumber, totalScore });

    if (!teamMatches[teamNumber]) {
      teamMatches[teamNumber] = [];
    }
    teamMatches[teamNumber].push({ match, alliance, totalScore });
  });

  const allianceEPAs = {};
  const teamDefenseImpact = {};
  const defenseMatchCount = {};

  Object.entries(matches).forEach(([match, { red, blue }]) => {
    if (red.length !== 3 || blue.length !== 3) return;

    const redEPA = red.reduce((sum, t) => sum + t.totalScore, 0);
    const blueEPA = blue.reduce((sum, t) => sum + t.totalScore, 0);

    allianceEPAs[match] = { redEPA, blueEPA };
  });

  data.forEach(row => {
    const teamNumber = row['Team No.'];
    const match = row['Match'];
    const robotColor = row['Robot Color'];
    const defenseRating = parseFloat(row['Defense Rating']);

    if (!match || !teamNumber || isNaN(defenseRating) || defenseRating <= 0) return;

    const alliance = getAllianceFromColor(robotColor);
    if (!alliance) return;

    const defendingAgainst = alliance === 'red' ? 'blue' : 'red';

    const thisMatch = matches[match];
    if (!thisMatch || thisMatch.red.length !== 3 || thisMatch.blue.length !== 3) return;

    const diedRobots = robotDiedMap[match] || new Set();
    const opponentTeams = thisMatch[defendingAgainst].map(t => t.teamNumber);
    const anyOpponentDied = opponentTeams.some(team => diedRobots.has(team));
    if (anyOpponentDied) return;

    const opponentEPAInMatch = allianceEPAs[match][`${defendingAgainst}EPA`];

    let totalOpponentEPA = 0;
    let opponentMatchCount = 0;

    opponentTeams.forEach(opponent => {
      const games = teamMatches[opponent];
      games.forEach(g => {
        if (g.match !== match) {
          const comparisonDiedRobots = robotDiedMap[g.match] || new Set();
          if (!comparisonDiedRobots.has(opponent)) {
            const allianceScore = allianceEPAs[g.match]?.[`${g.alliance}EPA`];
            if (!isNaN(allianceScore)) {
              totalOpponentEPA += allianceScore;
              opponentMatchCount++;
            }
          }
        }
      });
    });

    if (opponentMatchCount === 0) return;

    const avgOpponentEPA = totalOpponentEPA / opponentMatchCount;
    const impact = avgOpponentEPA - opponentEPAInMatch;

    if (!teamDefenseImpact[teamNumber]) {
      teamDefenseImpact[teamNumber] = 0;
      defenseMatchCount[teamNumber] = 0;
    }

    teamDefenseImpact[teamNumber] += impact;
    defenseMatchCount[teamNumber]++;
  });

  const rankings = Object.keys(teamDefenseImpact).map(team => {
    const matches = defenseMatchCount[team];
    return {
      team,
      avgImpact: matches > 0 ? teamDefenseImpact[team] / matches : 0,
      matchesCount: matches
    };
  });

  rankings.sort((a, b) => b.avgImpact - a.avgImpact);
  rankings.forEach((entry, i) => entry.rank = i + 1);

  return rankings;
}

let defenseRankings = [];

function updateDefenseRankings(data) {
  defenseRankings = calculateDefenseRankings(data);
  renderDefenseRankingTable();

}

function renderDefenseRankingTable() {
  const tableBody = document.getElementById('defenseRankingTableBody');
  tableBody.innerHTML = '';

  if (!defenseRankings || defenseRankings.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="3" style="padding: 8px; text-align: center; color: #aaa;">
          No defense data available. Upload match data first.
        </td>
      </tr>
    `;
    return;
  }

  defenseRankings.forEach(team => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="padding: 8px; border-bottom: 1px solid #2a2d31;">${team.rank}</td>
      <td style="padding: 8px; border-bottom: 1px solid #2a2d31;">${team.team}</td>
      <td style="padding: 8px; border-bottom: 1px solid #2a2d31;">${team.avgImpact.toFixed(1)}</td>
    `;
    tableBody.appendChild(row);
  });
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
  if (charts['coralCyclesChart']) {
    charts['coralCyclesChart'].destroy();
    charts['coralCyclesChart'] = null;
  }
  if (charts['algaeCyclesChart']) {
    charts['algaeCyclesChart'].destroy();
    charts['algaeCyclesChart'] = null;
  }
  if (charts['reliabilityChartsArea']) {
    charts['reliabilityChartsArea'].destroy();
    charts['reliabilityChartsArea'] = null;
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
  } catch (err) {}
  try {
    if (typeof renderHiddenTeamsListRanking === 'function') renderHiddenTeamsListRanking();
  } catch (err) {}

  if (tabId === 'ranking') {
    try { renderRankingTable(); } catch (e) {}
    try { updateRankingTableColumns(); } catch (e) {}
  }

   if (tabId === 'overview') {
    try {
      const parsed = parseCSV();
      const data = (parsed && parsed.data) ? parsed.data : [];
      const filter = document.getElementById('chartFilterDropdown')?.value || 'all';

      if (!data || data.length === 0) {
        renderBlankChart('overviewStackedChart', 'No Data');
        renderBlankChart('coralCyclesChart', 'No Data');
        renderBlankChart('algaeCyclesChart', 'No Data');
      } else {
        renderOverviewStackedChart(data, filter);
        renderCoralCyclesChart(data);
        renderAlgaeCyclesChart(data);
      }
    } catch (err) {
      console.error('Error rendering overview charts on tab show:', err);
    }
  }
}

// Individual View

document.addEventListener('DOMContentLoaded', renderReliabilityCharts);
document.querySelectorAll('input[type="checkbox"][id^="reliability"]').forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    renderReliabilityCharts();
  });
});


document.getElementById('search').addEventListener('click', () => {
  setReliabilityCheckboxState(lastReliabilityCheckboxState);
  renderReliabilityCharts();
});
document.getElementById('teamSearch').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    searchTeam();
    setReliabilityCheckboxState(lastReliabilityCheckboxState);
    renderReliabilityCharts();
  }
});

document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('toggleChartTypeBtn').addEventListener('click', () => {
    isBoxPlot = !isBoxPlot;

    const btn = document.getElementById('toggleChartTypeBtn');
    btn.textContent = isBoxPlot ? 'Switch to Line Chart' : 'Switch to Box Plot';

    renderReliabilityCharts();
  });

  const tbaEventKeyInput = document.getElementById('tbaEventKey');
  if (tbaEventKeyInput) {
    tbaEventKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('verifyWithTBABtn')?.click();
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
});
document.getElementById('algaeTypeFilter').addEventListener('change', function () {
  const value = this.value;
  const teamNumber = document.getElementById('teamSearch').value.trim();
  if (!teamNumber) return;

  const data = filterTeamData(teamNumber);
  renderTeleAlgaeChartFiltered(data, value);
});

// CSV Upload
document.getElementById('submitData').addEventListener('click', handleDataUpload);
document.getElementById('submitPit').addEventListener('click', function (e) {
  e.preventDefault();
  handlePitUpload('pitFile', 'statusPit');
});
// TBA Verification
document.getElementById('verifyWithTBABtn').addEventListener('click', getTBAData);
document.getElementById('updateClimbsBtn').addEventListener('click', updateClimbs);
document.getElementById('updateAutoLeaveBtn').addEventListener('click', updateAutoLeave);

// Rescout Table
document.getElementById('rescoutFilter').addEventListener('change', filterRescoutTable);
document.getElementById('hideCoralMismatch').addEventListener('change', filterRescoutTable);


// Filter Teams
document.getElementById('addHideTeamButton').addEventListener('click', addHiddenTeam);
document.getElementById('resetHideTeamButton').addEventListener('click', resetHiddenTeams);
document.getElementById('toggleHiddenTeamsButton').addEventListener('click', toggleHiddenTeams);
document.querySelectorAll('#filterCheckboxesContainer input[type="checkbox"]').forEach(checkbox => {
  checkbox.addEventListener('change', () => { applyFilters(); saveFilterViewState(); });
});
document.getElementById('filterTeamsDropdown').addEventListener('change', applyFilters);

// ensure dropdown change also saved
document.getElementById('filterTeamsDropdown').addEventListener('change', () => { saveFilterViewState(); });

// Chart Filters
document.getElementById('chartFilterDropdown').addEventListener('change', updateOverviewCharts);
document.querySelectorAll('#startingPositionFilter').forEach(dropdown => {
  dropdown.addEventListener('change', function () {
    syncDropdowns(this.value);
    const algaeFilter = document.getElementById('algaeTypeFilter').value;
    filterAndRenderCharts(this.value);
    document.getElementById('algaeTypeFilter').value = algaeFilter;
  });
});
document.getElementById('algaeTypeFilter1').addEventListener('change', function () {
  syncAlgaeDropdownsAndFilter(this.value);
});

document.getElementById('algaeTypeFilter2').addEventListener('change', function () {
  syncAlgaeDropdownsAndFilter(this.value);
})

// Comparison View
document.getElementById('comparisonSearch1').addEventListener('change', searchComparisonBothTeams);
document.getElementById('comparisonSearch1').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    searchComparisonBothTeams();
  }
});
document.getElementById('comparisonSearch2').addEventListener('change', searchComparisonBothTeams);
document.getElementById('comparisonSearch2').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    searchComparisonBothTeams();
  }
});

// Overview
document.getElementById('overviewSearch').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    handleOverviewSearch();
  }
});

document.querySelector('.tab[onclick*="defenseRankingInfo"]').addEventListener('click', function () {
  renderDefenseRankingTable();
});

/*-----TBA DATA FETCHING-----*/

async function getTBAData() {
  const eventKey = document.getElementById('tbaEventKey').value.trim();
  if (!eventKey) {
    document.getElementById('tbaStatus').textContent = 'Please enter an event key';
    return;
  }

  document.getElementById('tbaStatus').textContent = 'Fetching and comparing data...';

  try {
    const response = await fetch(`https://www.thebluealliance.com/api/v3/event/${eventKey}/matches`, {
      headers: {
        'X-TBA-Auth-Key': 'dkHdbc90y6rrKoG7w15O2YsLW3bWKySKjDItw93b8benEh0ZtNDTK4hYRseZnsT3	'
      }
    });

    if (!response.ok) throw new Error(`TBA API error: ${response.status}`);

    const matches = await response.json();

    tbaClimbData = processTbaClimbData(matches);
    tbaAutoLeaveData = processTbaAutoLeaveData(matches);
    coralMismatchData = verifyCoralCounts(matches, parseCSV().data);

    document.getElementById('tbaStatus').textContent = 'Verification complete!';
    renderRescoutTable(parseCSV().data);
  } catch (error) {
    document.getElementById('tbaStatus').textContent = `Error: ${error.message}`;
  }
}
function matchKeyToTeams(matchKey, data, alliance) {
  const matchNum = matchKey.split('_qm')[1];
  return data
    .filter(row => row['Match'] === matchNum && row['Robot Color'].toLowerCase().startsWith(alliance))
    .map(row => row['Team No.']);
}

function verifyCoralCounts(matches, csvData) {
  const allianceMismatches = {};
  const csvMatchMap = {};

  const normalizeRobotColor = (color) => {
    if (!color) return color;

    const cleaned = color.toString().toLowerCase().replace(/[\s-]/g, '');

    if (cleaned.startsWith('r')) {
      const position = cleaned.match(/\d+/)?.[0] || '1';
      return `Red-${position}`;
    }
    else if (cleaned.startsWith('b')) {
      const position = cleaned.match(/\d+/)?.[0] || '1';
      return `Blue-${position}`;
    }
    else if (cleaned.match(/^(red|blue)\d+/)) {
      const alliance = cleaned.startsWith('red') ? 'Red' : 'Blue';
      const position = cleaned.match(/\d+/)?.[0] || '1';
      return `${alliance}-${position}`;
    }
    console.warn(`Unrecognized robot position format: ${color}`);
    return color;
  };

  csvData.forEach(row => {
    const match = row['Match'];
    if (!match) return;

    const robotColor = normalizeRobotColor(row['Robot Color'] || '');
    let alliance = null;

    if (robotColor.startsWith('Red-')) alliance = 'red';
    else if (robotColor.startsWith('Blue-')) alliance = 'blue';

    if (alliance) {
      if (!csvMatchMap[match]) csvMatchMap[match] = { red: [], blue: [] };
      csvMatchMap[match][alliance].push(row);
    }
  });

  matches.forEach(match => {
    if (match.comp_level !== "qm") return;

    ["red", "blue"].forEach(alliance => {
      const breakdown = match.score_breakdown?.[alliance];
      if (!breakdown) return;

      const expected =
        (breakdown.autoReef?.trough || 0) +
        (breakdown.teleopReef?.tba_botRowCount || 0) +
        (breakdown.teleopReef?.tba_midRowCount || 0) +
        (breakdown.teleopReef?.tba_topRowCount || 0) +
        (breakdown.teleopReef?.trough || 0);

      let actual = 0;
      const csvRows = csvMatchMap[match.match_number]?.[alliance] || [];

      csvRows.forEach(row => {
        actual += parseInt(row['Auton L1'] || 0);
        actual += parseInt(row['Auton L2'] || 0);
        actual += parseInt(row['Auton L3'] || 0);
        actual += parseInt(row['Auton L4'] || 0);
        actual += parseInt(row['L1'] || 0);
        actual += parseInt(row['L2'] || 0);
        actual += parseInt(row['L3'] || 0);
        actual += parseInt(row['L4'] || 0);
      });

      const difference = Math.abs(expected - actual);
      if (difference >= 1) {
        const matchKey = `Q${match.match_number}-${alliance}`;
        allianceMismatches[matchKey] = {
          match: match.match_number,
          alliance: alliance,
          expected: expected,
          actual: actual,
          difference: difference,
          reason: `Coral: Scouting shows ${actual}, TBA shows ${expected} (${difference} off)`,
          type: 'coral'
        };
      }
    });
  });

  return Object.values(allianceMismatches);
}
const rescoutFilter = document.getElementById('rescoutFilter');
const hideCoralCheckbox = document.getElementById('hideCoralMismatch');

rescoutFilter.addEventListener('change', function () {
  const selectedFilter = this.value;

  if (selectedFilter === 'climb' || selectedFilter === 'autoLeave' || selectedFilter === 'others') {
    hideCoralCheckbox.checked = false;
    hideCoralCheckbox.disabled = true;
  } else {
    hideCoralCheckbox.disabled = false;
  }

  filterRescoutTable();
});

hideCoralCheckbox.addEventListener('change', function () {
  const currentFilter = rescoutFilter.value;
  if (currentFilter === 'all' || currentFilter === 'coral') {
    filterRescoutTable();
  }
});

function filterCoralData() {
  const tableBody = document.getElementById('rescoutBody');
  const currentFilter = rescoutFilter.value;
  let filteredRows = window.rescoutData || [];

  if (currentFilter !== 'all') {
    filteredRows = filteredRows.filter(row => row.type === currentFilter);
  }


  if (hideCoralCheckbox.checked && (currentFilter === 'all' || currentFilter === 'coral')) {
    filteredRows = filteredRows.filter(row =>
      row.type !== 'coral' || row.difference >= 3
    );
  }

  tableBody.innerHTML = filteredRows.length === 0 ?
    '<tr><td colspan="3" style="text-align: center; padding: 12px; color: #888;font-style: italic;">No Matches to Rescout</td></tr>' :
    filteredRows.sort((a, b) => parseInt(a.match, 10) - parseInt(b.match, 10))
      .map(({ match, team, reason }) => `
          <tr>
            <td style="padding: 8px;">Q${match}</td>
            <td style="padding: 8px;">${team}</td>
            <td style="padding: 8px;">${reason}</td>
          </tr>
        `).join('');
}

function processTbaClimbData(matches) {
  const climbData = {};
  const qualMatches = matches.filter(match => match.comp_level === 'qm');

  qualMatches.forEach(match => {
    const matchKey = match.match_number.toString();
    climbData[matchKey] = {};

    match.alliances.red.team_keys.forEach((teamKey, idx) => {
      const teamNumber = teamKey.replace('frc', '');
      const climbStatus = match.score_breakdown?.red?.[`endGameRobot${idx + 1}`] || "Unknown";
      climbData[matchKey][teamNumber] = mapTbaClimbStatus(climbStatus);
    });

    match.alliances.blue.team_keys.forEach((teamKey, idx) => {
      const teamNumber = teamKey.replace('frc', '');
      const climbStatus = match.score_breakdown?.blue?.[`endGameRobot${idx + 1}`] || "Unknown";
      climbData[matchKey][teamNumber] = mapTbaClimbStatus(climbStatus);
    });
  });

  return climbData;
}

function mapTbaClimbStatus(tbaStatus) {
  switch (tbaStatus) {
    case 'DeepCage': return 12;
    case 'ShallowCage': return 6;
    case 'Parked': return 2;
    case 'None': return 0;
  }
}

function classifyScoutClimb(score) {
  if (score >= 11.5) return 12;
  if (score >= 5.5 && score <= 7) return 6;
  if (score >= 1.8 && score <= 2.2) return 2;
  return 0;
}

function getClimbName(score) {
  if (score >= 11.5) return 'Deep Climb';
  if (score >= 5.5 && score <= 7) return 'Shallow Climb';
  if (score >= 1.8 && score <= 2.2) return 'Parked';
  return 'No Climb';
}
async function updateClimbs() {
  if (!csvText || !tbaClimbData || Object.keys(tbaClimbData).length === 0) {
    alert('Please verify climbs with TBA first and ensure data is loaded');
    return;
  }

  const parsed = Papa.parse(csvText, { header: true });
  const data = parsed.data;

  let changesMade = false;
  let updatedRows = 0;

  const changeLog = [];

  data.forEach(row => {
    const match = row['Match']?.toString();
    const team = row['Team No.']?.toString();

    if (!match || !team || !tbaClimbData[match] || tbaClimbData[match][team] === undefined) {
      return;
    }

    const scoutClimb = parseFloat(row['Climb Score'] || 0);
    const normalizedScoutClimb = classifyScoutClimb(scoutClimb);
    const tbaClimb = tbaClimbData[match][team];

    if (Math.abs(normalizedScoutClimb - tbaClimb) > 1) {
      changesMade = true;
      updatedRows++;

      const oldClimbScore = parseFloat(row['Climb Score'] || 0);
      let newClimbScore;

      if (tbaClimb === 2) {
        newClimbScore = scoutClimb > 2 ? 2.1 : 2;
      } else {
        newClimbScore = tbaClimb;
      }

      const oldTotalScore = parseFloat(row['Total Score'] || 0);
      const newTotalScore = Math.round(oldTotalScore + oldClimbScore - newClimbScore);

      changeLog.push({
        'Qual Match': match,
        'Robot': team,
        'Scouter Input': normalizedScoutClimb,
        'TBA': tbaClimb,
        'Final': newClimbScore
      });
      row['Climb Score'] = newClimbScore.toString();
      row['Total Score'] = newTotalScore.toString();
    }
  });

  if (!changesMade) {
    alert('No climb discrepancies found - no changes needed');
    return;
  }

  const updatedCsv = Papa.unparse(data);

  const blob = new Blob([updatedCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'updated_scouting_data.csv');
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (changeLog.length > 0) {
    const changeLogCsv = Papa.unparse(changeLog);
    const blobLog = new Blob([changeLogCsv], { type: 'text/csv;charset=utf-8;' });
    const logUrl = URL.createObjectURL(blobLog);
    const logLink = document.createElement('a');
    logLink.setAttribute('href', logUrl);
    logLink.setAttribute('download', 'climb_change_log.csv');
    logLink.style.visibility = 'hidden';
    document.body.appendChild(logLink);
    logLink.click();
    document.body.removeChild(logLink);

    document.getElementById('downloadStatus').textContent = `Updated ${updatedRows} rows with climb data from TBA`;

  };
}

async function updateAutoLeave() {
  if (!csvText || !tbaAutoLeaveData || Object.keys(tbaAutoLeaveData).length === 0) {
    alert('Please verify auto leave with TBA first and ensure data is loaded');
    return;
  }

  const parsed = Papa.parse(csvText, { header: true });
  const data = parsed.data;

  let changesMade = false;
  let updatedRows = 0;
  const changeLog = [];

  const teamAllianceMap = {};
  data.forEach(row => {
    const match = row['Match']?.toString();
    const team = row['Team No.']?.toString();
    const color = (row['Robot Color'] || '').toLowerCase();

    if (match && team) {
      if (!teamAllianceMap[match]) teamAllianceMap[match] = {};
      teamAllianceMap[match][team] = color.startsWith('red') ? 'red' :
        color.startsWith('blue') ? 'blue' : null;
    }
  });

  data.forEach(row => {
    const match = row['Match']?.toString();
    const team = row['Team No.']?.toString();

    if (!match || !team || !tbaAutoLeaveData[match] || !teamAllianceMap[match] || !teamAllianceMap[match][team]) {
      return;
    }

    const alliance = teamAllianceMap[match][team];
    const tbaLeave = tbaAutoLeaveData[match][alliance][team];
    if (tbaLeave === undefined) return;

    const scoutLeave = parseInt(row['Auton Leave starting line'] || 0);

    if (scoutLeave !== tbaLeave) {
      changesMade = true;
      updatedRows++;

      const oldTotal = parseFloat(row['Total Score'] || 0);
      const newTotal = scoutLeave === 1 && tbaLeave === 0
        ? oldTotal - 3
        : scoutLeave === 0 && tbaLeave === 1
          ? oldTotal + 3
          : oldTotal;

      changeLog.push({
        'Match': match,
        'Team': team,
        'Alliance': alliance,
        'Scouter Input': scoutLeave,
        'TBA': tbaLeave,
        'Final': tbaLeave,
        'Points Adjustment': newTotal - oldTotal
      });

      row['Auton Leave starting line'] = tbaLeave.toString();
      row['Total Score'] = Math.round(newTotal).toString();
    }
  });

  if (!changesMade) {
    alert('No Auto Leave discrepancies found - no changes needed');
    return;
  }

  const updatedCsv = Papa.unparse(data);
  const blob = new Blob([updatedCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'updated_scouting_data_auto_leave.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (changeLog.length > 0) {
    const changeLogCsv = Papa.unparse(changeLog);
    const logBlob = new Blob([changeLogCsv], { type: 'text/csv;charset=utf-8;' });
    const logUrl = URL.createObjectURL(logBlob);
    const logLink = document.createElement('a');
    logLink.setAttribute('href', logUrl);
    logLink.setAttribute('download', 'auto_leave_changes_log.csv');
    document.body.appendChild(logLink);
    logLink.click();
    document.body.removeChild(logLink);
  }

  document.getElementById('downloadStatus').textContent =
    `Updated ${updatedRows} rows with corrected auto leave data`;
}

function processTbaAutoLeaveData(matches) {
  const autoLeaveData = {};

  const qualMatches = matches.filter(match => match.comp_level === 'qm');

  qualMatches.forEach(match => {
    const matchNumber = match.match_number.toString();
    autoLeaveData[matchNumber] = { red: {}, blue: {} };

    if (match.alliances?.red?.team_keys && match.score_breakdown?.red) {
      match.alliances.red.team_keys.forEach((teamKey, index) => {
        const teamNumber = teamKey.replace('frc', '');
        const leaveStatus = match.score_breakdown.red[`autoLineRobot${index + 1}`] || "No";
        autoLeaveData[matchNumber].red[teamNumber] = leaveStatus === "Yes" ? 1 : 0;
      });
    }

    if (match.alliances?.blue?.team_keys && match.score_breakdown?.blue) {
      match.alliances.blue.team_keys.forEach((teamKey, index) => {
        const teamNumber = teamKey.replace('frc', '');
        const leaveStatus = match.score_breakdown.blue[`autoLineRobot${index + 1}`] || "No";
        autoLeaveData[matchNumber].blue[teamNumber] = leaveStatus === "Yes" ? 1 : 0;
      });
    }
  });

  return autoLeaveData;
}

 
async function fetchTeamData(teamNumber) {
  try {
    const response = await fetch(`https://www.thebluealliance.com/api/v3/team/frc${teamNumber}`, {
      headers: {
        'X-TBA-Auth-Key': 'dkHdbc90y6rrKoG7w15O2YsLW3bWKySKjDItw93b8benEh0ZtNDTK4hYRseZnsT3'
      }
    });

    if (!response.ok) {
      throw new Error(`TBA API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching team data:', error);
    return null;
  }
}

function displayTeamNickname(teamNumber, elementId) {
  if (!teamNumber) {
    document.getElementById(elementId).textContent = '';
    return;
  }

  fetchTeamData(teamNumber).then(teamData => {
    const nickname = teamData?.nickname || '';
    document.getElementById(elementId).textContent = nickname;
  }).catch(() => {
    document.getElementById(elementId).textContent = '';
  });
}

/*-----RESCOUT TABLE----*/

function filterRescoutTable() {
  const tableBody = document.getElementById('rescoutBody');
  const filterType = document.getElementById('rescoutFilter').value;
  const hideSmallMismatches = document.getElementById('hideCoralMismatch').checked;

  let filteredRows = window.rescoutData || [];

  if (filterType !== 'all') {
    filteredRows = filteredRows.filter(row => row.type === filterType);
  }

  if ((filterType === 'all' || filterType === 'coral') && hideSmallMismatches) {
    filteredRows = filteredRows.filter(row =>
      row.type !== 'coral' || (row.type === 'coral' && row.difference >= 3)
    );
  }

  tableBody.innerHTML = '';

  if (filteredRows.length === 0) {
    tableBody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 12px; color: #888; font-style: italic;">
                    No Matches to Rescout
                </td>
            </tr>
        `;
    return;
  }

  filteredRows.sort((a, b) => parseInt(a.match, 10) - parseInt(b.match, 10))
    .forEach(({ match, team, reason }) => {
      const row = document.createElement('tr');
      row.innerHTML = `
                <td style="padding: 8px;">Q${match}</td>
                <td style="padding: 8px;">${team}</td>
                <td style="padding: 8px;">${reason}</td>
            `;
      tableBody.appendChild(row);
    });
}
function renderRescoutTable(data) {
  const rescoutSection = document.getElementById('rescoutSection');
  const seenRows = new Set();
  const matchCounts = {};
  const rescoutRows = [];

  const normalizeRobotColor = (color) => {
    if (!color) return color;

    const cleaned = color.toString().toLowerCase().replace(/[\s-]/g, '');

    if (cleaned.startsWith('r')) {
      const position = cleaned.match(/\d+/)?.[0] || '1';
      return `Red-${position}`;
    }
    else if (cleaned.startsWith('b')) {
      const position = cleaned.match(/\d+/)?.[0] || '1';
      return `Blue-${position}`;
    }
    else if (cleaned.match(/^(red|blue)\d+/)) {
      const alliance = cleaned.startsWith('red') ? 'Red' : 'Blue';
      const position = cleaned.match(/\d+/)?.[0] || '1';
      return `${alliance}-${position}`;
    }
    console.warn(`Unrecognized robot position format: ${color}`);
    return color;
  };

  coralMismatchData.forEach(mismatch => {
    rescoutRows.push({
      match: mismatch.match,
      difference: mismatch.difference,
      team: `${mismatch.alliance.charAt(0).toUpperCase()}${mismatch.alliance.slice(1)}`,
      reason: mismatch.reason,
      type: 'coral'
    });
  });

  data.forEach(row => {
    const match = row['Match']?.toString().replace(/^Q/i, '');
    const team = row['Team No.']?.toString();
    const scoutClimb = Math.round(parseFloat(row['Climb Score'] || 0));
    const normalizedScoutClimb = classifyScoutClimb(scoutClimb);

    if (tbaClimbData[match] && tbaClimbData[match][team] !== undefined) {
      const tbaClimb = tbaClimbData[match][team];
      if (Math.abs(normalizedScoutClimb - tbaClimb) > 1) {
        rescoutRows.push({
          match,
          team,
          reason: `Climb: Scouted ${getClimbName(normalizedScoutClimb)}, TBA shows ${getClimbName(tbaClimb)}`,
          type: 'climb'
        });
      }
    }
  });

  data.forEach(row => {
    const match = row['Match']?.toString().replace(/^Q/i, '');
    const team = row['Team No.']?.toString();
    const robotColor = normalizeRobotColor(row['Robot Color']);
    const matchKey = `${match}-${team}-${robotColor}`;

    if (seenRows.has(matchKey)) {
      rescoutRows.push({
        match,
        team,
        reason: 'Duplicate entry',
        type: 'others'
      });
    } else {
      seenRows.add(matchKey);
    }
  });

  data.forEach(row => {
    const matchKey = row['Match'];
    if (matchKey) {
      matchCounts[matchKey] = (matchCounts[matchKey] || 0) + 1;
    }
  });

  Object.entries(matchCounts).forEach(([match, count]) => {
    if (count < 6) {
      const existingPositions = data
        .filter(row => row['Match'] === match)
        .map(row => normalizeRobotColor(row['Robot Color']));

      const allPositions = ['Red-1', 'Red-2', 'Red-3', 'Blue-1', 'Blue-2', 'Blue-3'];
      const missingPositions = allPositions.filter(pos =>
        !existingPositions.includes(pos)
      );

      missingPositions.forEach(pos => {
        rescoutRows.push({
          match: match.replace(/^Q/i, ''),
          team: pos,
          reason: `Missing data for ${pos}`,
          type: 'others'
        });
      });
    }
  });

  data.forEach(row => {
    const match = row['Match']?.toString().replace(/^Q/i, '');
    const team = row['Team No.']?.toString();
    const robotColor = (row['Robot Color'] || '').toLowerCase();
    const alliance = robotColor.startsWith('red') ? 'red' :
      robotColor.startsWith('blue') ? 'blue' : null;

    if (match && team && alliance && tbaAutoLeaveData[match]?.[alliance]?.[team] !== undefined) {
      const scoutLeave = parseInt(row['Auton Leave starting line'] || 0);
      const tbaLeave = tbaAutoLeaveData[match][alliance][team];

      if (scoutLeave !== tbaLeave) {
        rescoutRows.push({
          match,
          team,
          reason: `Auto Leave: Scouted ${scoutLeave ? "Yes" : "No"}, TBA shows ${tbaLeave ? "Yes" : "No"}`,
          type: 'autoLeave'
        });
      }
    }
  });

  window.rescoutData = rescoutRows;

  if (rescoutRows.length > 0) {
    rescoutSection.style.display = 'block';
    filterRescoutTable('all');
  } else {
    rescoutSection.style.display = 'block';
    const tableBody = document.getElementById('rescoutBody');
    tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 12px; color: #888;font-style: italic;">No Matches to Rescout</td></tr>';
  }
}
function clearRescoutTable() {
  const tableBody = document.getElementById('rescoutBody');
  tableBody.innerHTML = '';
}

/*-----INDIVIDUAL VIEW----*/

function searchTeam() {
  const teamNumber = document.getElementById('teamSearch').value.trim();
  let teamData = filterTeamData(teamNumber);

  const startingPosition = 'all';
  const algaeFilter = 'all';

  syncDropdowns(startingPosition);
  renderAutoCharts(teamData);
  renderTeleAlgaeChartFiltered(teamData, algaeFilter);
  renderTeleCharts(teamData);
  renderEndGameChart(teamData);
  renderQualitativeNotes(teamData);
  renderFlaggedMatches(teamData);
  renderTeamStatistics(teamData, pitScoutingData);

  renderReliabilityCharts(teamData, 'reliabilityChartsArea');

  document.getElementById('startingPositionFilter').value = startingPosition;
  document.getElementById('algaeTypeFilter').value = algaeFilter;

  displayTeamNickname(teamNumber, 'teamNicknameDisplay');
}
function filterTeamData(teamNumber) {
  const parsed = parseCSV();
  return parsed.data.filter(row => row['Team No.'] === teamNumber);

}

function renderAutoCharts(data) {
  const sortedData = data.sort((a, b) => parseInt(a.Match) - parseInt(b.Match));
  const matchLabels = sortedData.map(row => 'Q' + row.Match);

  destroyChart('autoCoral');
  charts.autoCoral = createChart(
    document.getElementById('autoCoral').getContext('2d'),
    'bar',
    {
      labels: matchLabels,
      datasets: [
        { label: 'L1', data: sortedData.map(row => parseInt(row['Auton L1'] || 0)), backgroundColor: '#3B064D' },
        { label: 'L2', data: sortedData.map(row => parseInt(row['Auton L2'] || 0)), backgroundColor: '#8105D8' },
        { label: 'L3', data: sortedData.map(row => parseInt(row['Auton L3'] || 0)), backgroundColor: '#ED0CEF' },
        { label: 'L4', data: sortedData.map(row => parseInt(row['Auton L4'] || 0)), backgroundColor: '#FF8BFC' }
      ]
    },

    getChartOptions(true)
  );

  destroyChart('autoAlgae');
  charts.autoAlgae = createChart(
    document.getElementById('autoAlgae').getContext('2d'),
    'bar',
    {
      labels: matchLabels,
      datasets: [
        { label: 'Removed', data: sortedData.map(row => parseInt(row['Auton Algae Removed'] || 0)), backgroundColor: '#002BFF' },
        { label: 'Net', data: sortedData.map(row => parseInt(row['Auton Algae in Net'] || 0)), backgroundColor: '#00D2F3' },
        { label: 'Processor', data: sortedData.map(row => parseInt(row['Auton Algae in Processor'] || 0)), backgroundColor: '#5cffd5' }
      ]
    },
    getChartOptions(true)
  );
}

function renderQualitativeNotes(data) {
  const scouterCommentsDiv = document.getElementById('scouterComments');

  scouterCommentsDiv.innerHTML = '';

  const notes = data
    .filter(row => row['Comments'] && row['Comments'].trim() !== '')
    .map(row => `Q${row.Match}: ${row['Comments']}`);

  if (notes.length > 0) {
    scouterCommentsDiv.innerHTML = notes.join('<hr style="border: 0; margin: 10px 0;">');
  } else {
    scouterCommentsDiv.innerHTML = 'No qualitative notes available for this team.';
  }
}

function renderTeleCharts(data) {
  const matchLabels = data.map(row => 'Q' + row.Match);
  const sortedData = data.sort((a, b) => parseInt(a.Match) - parseInt(b.Match));

  const coralTotals = sortedData.map(row =>
    (parseInt(row['L1'] || 0)) +
    (parseInt(row['L2'] || 0)) +
    (parseInt(row['L3'] || 0)) +
    (parseInt(row['L4'] || 0))
  );

  const yMax = Math.max(...coralTotals, 0);
  const stepSize = yMax > 16 ? 4 : 2;
  const adjustedYMax = Math.ceil(yMax / stepSize) * stepSize;

  destroyChart('teleCoral');
  charts.teleCoral = createChart(
    document.getElementById('teleCoral').getContext('2d'),
    'bar',
    {
      labels: matchLabels,
      datasets: [
        { label: 'L1', data: sortedData.map(row => parseInt(row['L1'] || 0)), backgroundColor: '#3B064D' },
        { label: 'L2', data: sortedData.map(row => parseInt(row['L2'] || 0)), backgroundColor: '#8105D8' },
        { label: 'L3', data: sortedData.map(row => parseInt(row['L3'] || 0)), backgroundColor: '#ED0CEF' },
        { label: 'L4', data: sortedData.map(row => parseInt(row['L4'] || 0)), backgroundColor: '#FF8BFC' }
      ]
    },
    {
      ...getChartOptions(true, stepSize),
      scales: {
        ...getChartOptions(true, stepSize).scales,
        y: {
          ...getChartOptions(true, stepSize).scales.y,
          max: adjustedYMax
        }
      },
      plugins: {
        ...getChartOptions(true, stepSize).plugins,
        tooltip: {
          ...getChartOptions(true, stepSize).plugins.tooltip,
          callbacks: {
            afterBody: function (context) {
              const dataIndex = context[0].dataIndex;
              const row = sortedData[dataIndex];
              const total =
                (parseInt(row['L1'] || 0)) +
                (parseInt(row['L2'] || 0)) +
                (parseInt(row['L3'] || 0)) +
                (parseInt(row['L4'] || 0));
              return `Total Coral: ${total}`;
            }
          }
        }
      }
    }
  );

  destroyChart('teleAlgae');
  charts.teleAlgae = createChart(
    document.getElementById('teleAlgae').getContext('2d'),
    'bar',
    {
      labels: matchLabels,
      datasets: [
        { label: 'Removed', data: data.map(row => parseInt(row['Algae removed'] || 0)), backgroundColor: '#002BFF' },
        { label: 'Net', data: data.map(row => parseInt(row['Algae in Net'] || 0)), backgroundColor: '#00D2F3' },
        { label: 'Processor', data: data.map(row => parseInt(row['Algae in Processor'] || 0)), backgroundColor: '#5cffd5' }
      ]
    },
    getChartOptions(true, 2)
  );
}

function renderTeleAlgaeChartFiltered(data, filter) {
  const sortedData = data.sort((a, b) => parseInt(a.Match) - parseInt(b.Match));
  let filteredRows;

  if (filter === 'remove') {
    filteredRows = sortedData.filter(row => parseInt(row['Algae removed'] || 0) > 0);
  } else if (filter === 'process') {
    filteredRows = sortedData.filter(row => parseInt(row['Algae in Processor'] || 0) > 0);
  } else if (filter === 'barge') {
    filteredRows = sortedData.filter(row => parseInt(row['Algae in Net'] || 0) > 0);
  } else {
    filteredRows = sortedData.filter(row =>
      parseInt(row['Algae removed'] || 0) > 0 ||
      parseInt(row['Algae in Processor'] || 0) > 0 ||
      parseInt(row['Algae in Net'] || 0) > 0
    );
  }

  if (filteredRows.length === 0) {
    renderBlankChart('teleAlgae', "No Data");
    return;
  }

  const matchLabels = filteredRows.map(row => 'Q' + row.Match);
  const datasets = [];

  if (filter === 'all' || filter === 'remove') {
    datasets.push({
      label: 'Removed',
      data: filteredRows.map(row => parseInt(row['Algae removed'] || 0)),
      backgroundColor: '#002BFF'
    });
  }

  if (filter === 'all' || filter === 'process') {
    datasets.push({
      label: 'Processor',
      data: filteredRows.map(row => parseInt(row['Algae in Processor'] || 0)),
      backgroundColor: '#5cffd5'
    });
  }

  if (filter === 'all' || filter === 'barge') {
    datasets.push({
      label: 'Net',
      data: filteredRows.map(row => parseInt(row['Algae in Net'] || 0)),
      backgroundColor: '#00D2F3'
    });
  }

  destroyChart('teleAlgae');
  charts.teleAlgae = createChart(
    document.getElementById('teleAlgae').getContext('2d'),
    'bar',
    { labels: matchLabels, datasets },
    getChartOptions(true, 2)
  );
}

function renderTeamStatistics(data, pitData) {
  const clearValue = (id, defaultValue = '') => {
    document.getElementById(id).textContent = defaultValue;
  };

  clearValue('climbSuccessRate', '0.00');
  clearValue('robotDiedRate', '0.00');
  clearValue('groundBarge');
  clearValue('groundProcessor');
  clearValue('averageEPA', '0.00');
  clearValue('averageCoral', '0.00');
  clearValue('averageAlgae', '0.00');
  clearValue('defenseRank', 'N/A')
  clearValue('maxCoral', '0');
  clearValue('maxCoralMatch', 'N/A');
  clearValue('maxAlgae', '0');
  clearValue('maxAlgaeMatch', 'N/A');

  if (!data || data.length === 0) return;

  const teamNumber = data[0]['Team No.'].toString().trim();

  let groundBarge = '';
  let groundProcessor = '';

  if (pitData && pitData.length > 0) {
    const teamPitData = pitData.find(team => {
      const pitTeamNumber = team['Team No.']?.toString().trim();
      return pitTeamNumber === teamNumber;
    });

    if (teamPitData) {
      if (teamPitData['Ground Barge'] !== undefined) {
        groundBarge = teamPitData['Ground Barge'] ? '✅' : '❌';
      }

      if (teamPitData['Ground Processor'] !== undefined) {
        groundProcessor = teamPitData['Ground Processor'] ? '✅' : '❌';
      }
    }
  }
  document.getElementById('groundBarge').textContent = groundBarge;
  document.getElementById('groundProcessor').textContent = groundProcessor;

  const climbScores = data.map(row => parseFloat(row['Climb Score'] || 0));
  const successfulClimbs = climbScores.filter(score => score === 12 || score === 6).length;
  const totalClimbAttempts = climbScores.filter(score => score === 12 || score === 6 || score === 2.1).length;
  const climbSuccessRate = totalClimbAttempts > 0 ? (successfulClimbs / totalClimbAttempts * 100).toFixed(1) : "0.00";
  const robotDiedRate = data.length > 0 ? (data.filter(row => row['Died or Immobilized'] === '1').length / data.length * 100).toFixed(1) : "0.00";

  document.getElementById('climbSuccessRate').textContent = climbSuccessRate;
  document.getElementById('robotDiedRate').textContent = robotDiedRate;


  const totalScore = data.reduce((sum, row) => sum + (parseFloat(row['Total Score']) || 0), 0);
  const totalCoral = data.reduce((sum, row) => {
    return sum +
      (parseInt(row['Auton L1']) || 0) +
      (parseInt(row['Auton L2']) || 0) +
      (parseInt(row['Auton L3']) || 0) +
      (parseInt(row['Auton L4']) || 0) +
      (parseInt(row['L1']) || 0) +
      (parseInt(row['L2']) || 0) +
      (parseInt(row['L3']) || 0) +
      (parseInt(row['L4']) || 0);
  }, 0);

  const totalAlgae = data.reduce((sum, row) => {
    return sum +
      (parseInt(row['Auton Algae in Net'] || 0)) * 2 +
      (parseInt(row['Auton Algae in Processor'] || 0)) * 3 +
      (parseInt(row['Algae in Net'] || 0) * 2) +
      (parseInt(row['Algae in Processor'] || 0) * 3);
  }, 0);

  const averageEPA = data.length > 0 ? (totalScore / data.length).toFixed(1) : "";
  const averageCoral = data.length > 0 ? (totalCoral / data.length).toFixed(1) : "";
  const averageAlgae = data.length > 0 ? (totalAlgae / data.length).toFixed(1) : "";

  document.getElementById('averageEPA').textContent = averageEPA;
  document.getElementById('averageCoral').textContent = averageCoral;
  document.getElementById('averageAlgae').textContent = averageAlgae;

  const coralCycles = data.map(row => {
    return (parseInt(row['L1']) || 0) +
      (parseInt(row['L2']) || 0) +
      (parseInt(row['L3']) || 0) +
      (parseInt(row['L4']) || 0);
  });
  const maxCoral = Math.max(...coralCycles, 0);
  const maxCoralMatch = maxCoral > 0 ? `Q${data[coralCycles.indexOf(maxCoral)].Match}` : "";

  const algaeCycles = data.map(row => {
    return (parseInt(row['Algae in Net'] || 0)) +
      (parseInt(row['Algae in Processor'] || 0));
  });
  const maxAlgae = Math.max(...algaeCycles, 0);
  const maxAlgaeMatch = maxAlgae > 0 ? `Q${data[algaeCycles.indexOf(maxAlgae)].Match}` : "";

  document.getElementById('maxCoral').textContent = maxCoral > 0 ? maxCoral : "";
  document.getElementById('maxCoralMatch').textContent = maxCoralMatch;
  document.getElementById('maxAlgae').textContent = maxAlgae > 0 ? maxAlgae : "";
  document.getElementById('maxAlgaeMatch').textContent = maxAlgaeMatch;

  const defenseData = defenseRankings.find(t => t.team === teamNumber);
  const defenseRank = defenseData ? `${defenseData.rank}/${defenseRankings.length}` : 'N/A';
  document.getElementById('defenseRank').textContent = defenseRank;

}
function renderFlaggedMatches(data) {
  const flaggedMatchesDiv = document.getElementById('flaggedMatches');
  flaggedMatchesDiv.innerHTML = '';

  if (!data || data.length === 0) {
    flaggedMatchesDiv.innerHTML = '<p>No data available for this team.</p>';
    return;
  }

  const validMatches = data.filter(row => row['Died or Immobilized'] !== '1');
  const scores = validMatches.map(row => parseFloat(row['Total Score'] || 0));

  const sortedScores = [...scores].sort((a, b) => a - b);
  const q1 = calculatePercentile(sortedScores, 25);
  const q3 = calculatePercentile(sortedScores, 75);
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const lowestScoreMatch = data.reduce((lowest, row) => {
    const score = parseFloat(row['Total Score'] || 0);
    return score < lowest.score ? { match: row.Match, score } : lowest;
  }, { match: null, score: Infinity });

  const flaggedMatches = data
    .filter(row => {
      const score = parseFloat(row['Total Score'] || 0);
      const isOutlier = score < lowerBound || score > upperBound;
      const startingPos = (row['Auton Starting Position'] || '').toLowerCase().trim();
      const isNoShow = startingPos === 'r.';

      return (
        row['Died or Immobilized'] === '1' ||
        row['Defense was played on robot'] === '1' ||
        parseFloat(row['Defense Rating'] || 0) > 1 ||
        row.Match === lowestScoreMatch.match ||
        (isOutlier && row['Died or Immobilized'] !== '1') ||
        isNoShow
      );
    })
    .map(row => {
      const reasons = [];
      const startingPos = (row['Auton Starting Position'] || '').toLowerCase().trim();
      if (startingPos === 'r.' || startingPos === 'r' || startingPos.includes('no show')) {
        reasons.push('<span style="color:#ff5c5c;font-weight:bold;text-transform:uppercase;">NO SHOW</span>');
      } if (row['Died or Immobilized'] === '1') reasons.push(' Robot Died');
      if (row['Defense was played on robot'] === '1') reasons.push(' Defended On');
      if (parseFloat(row['Defense Rating'] || 0) > 1) reasons.push(' Played Defense');
      if (row.Match === lowestScoreMatch.match) reasons.push(' Lowest Score');

      const score = parseFloat(row['Total Score'] || 0);
      if (score < lowerBound || score > upperBound) {
        reasons.push(' Outlier Score');
      }

      return `<p><strong>Q${row.Match}:</strong> ${reasons.join(', ')} </p>`;
    });
  if (flaggedMatches.length > 0) {
    flaggedMatchesDiv.innerHTML = flaggedMatches.join('<hr style="border: 0; margin: 10px 0;">');
  } else {
    flaggedMatchesDiv.innerHTML = '<p>No flagged matches.</p>';
  }
}

function calculatePercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sortedArray[lower];

  return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (index - lower);
}
function renderEndGameChart(data) {
  destroyChart('endGame');

  const sortedData = data.sort((a, b) => parseInt(a.Match) - parseInt(b.Match));
  const matchLabels = sortedData.map(row => 'Q' + row.Match);
  const climbScores = sortedData.map(row => parseFloat(row['Climb Score'] || 0));

  const colors = climbScores.map(score => {
    if (score === 12 || score === 6 || score === 2) return '#3EDBF0';
    if (score === 2.1) return '#FF5C5C';
    return '#888888';
  });

  charts.endGame = createChart(
    document.getElementById('endGame').getContext('2d'),
    'bar',
    {
      labels: matchLabels,
      datasets: [
        {
          label: 'Climb Score',
          data: climbScores,
          backgroundColor: colors
        }
      ]
    },
    {
      ...getChartOptions(false, 6),
      scales: {
        ...getChartOptions(false, 6).scales,
        y: {
          ...getChartOptions(false, 6).scales.y,
          max: 12
        }
      }
    }
  );
}

function renderReliabilityCharts() {
  const container = document.getElementById('reliabilityChartsArea');
  if (!container) return;

  const teamNumber = document.getElementById('teamSearch').value.trim();
  if (!teamNumber) return;

  let data = filterTeamData(teamNumber);
  if (!data || data.length === 0) return;

  container.innerHTML = '';

  data = data.slice().sort((a, b) => parseInt(a.Match) - parseInt(b.Match));

  const showAvg = document.getElementById('showEPAAvg')?.checked ?? true;

  const metricsToShow = reliabilityMetrics.filter(metric => {
    const checkbox = document.getElementById(metric.id);
    return checkbox && checkbox.checked;
  });

  const chartContainer = document.createElement('div');
  chartContainer.className = 'reliability-charts-grid';
  chartContainer.style.display = 'grid';
  chartContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(400px, 1fr))';
  chartContainer.style.gap = '20px';
  container.appendChild(chartContainer);

  metricsToShow.forEach(metric => {
    const chartCard = document.createElement('div');
    chartCard.className = 'reliability-chart-card';
    chartCard.style.background = '#1C1E21';
    chartCard.style.borderRadius = '8px';
    chartCard.style.padding = '15px';
    chartCard.style.boxShadow = '0 0 20px #131416';

    const title = document.createElement('h3');
    title.textContent = metric.label;
    title.style.margin = '0 0 10px 0';
    title.style.color = metric.color;
    title.style.fontSize = '16px';
    title.style.fontFamily = "'Lato', sans-serif";
    chartCard.appendChild(title);

    const canvasContainer = document.createElement('div');
    canvasContainer.style.position = 'relative';
    canvasContainer.style.height = '320px';
    canvasContainer.style.width = '100%';
    chartCard.appendChild(canvasContainer);

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvasContainer.appendChild(canvas);

    chartContainer.appendChild(chartCard);

    if (isBoxPlot) {
      const values = data.map(metric.getValue);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;

      try {
        createBoxPlot(canvas, metric, values, avg, showAvg);
      } catch (error) {
        console.error('Error creating boxplot chart:', error);
        canvasContainer.innerHTML = '<p style="color: #ff5c5c;">Error rendering chart</p>';
      }
    } else {
      const labels = data.map(row => "Q" + row.Match);
      const values = data.map(metric.getValue);
      const avgValue = values.reduce((a, b) => a + b, 0) / values.length;

      const maxValue = Math.max(...values);
      const stepSize = 1;
      const yMax = Math.ceil(maxValue / stepSize) * stepSize;

      try {
        new Chart(canvas.getContext('2d'), {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: metric.label,
                data: values,
                borderColor: metric.color,
                backgroundColor: metric.color + '55',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
              },
              {
                label: 'Average',
                data: Array(labels.length).fill(avgValue),
                borderColor: '#FFD700',
                borderWidth: 2,
                borderDash: [6, 6],
                pointRadius: 0,
                fill: false,
                tension: 0,
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: 3,
            scales: {
              x: {
                ticks: {
                  color: 'white',
                  font: { family: 'Lato', size: 12, weight: 'bold' },
                },
                grid: { color: 'rgba(255,255,255,0.1)' },
              },
              y: {
                beginAtZero: true,
                max: yMax,
                ticks: {
                  color: 'white',
                  font: { family: 'Lato', size: 14, weight: 'bold' },
                  stepSize: stepSize,
                },
                grid: { color: 'rgba(255,255,255,0.1)' },
              },
            },
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
                padding: 10,
                callbacks: {
                  label: function (context) {
                    if (context.dataset.label === 'Average') {
                      return `Average: ${avgValue.toFixed(2)}`;
                    } else {
                      const value = context.parsed.y;
                      const delta = value - avgValue;
                      const sign = delta >= 0 ? '+' : '';
                      return [
                        `Value: ${value}`,
                        `Average: ${avgValue.toFixed(2)}`,
                        `Δ: ${sign}${delta.toFixed(2)}`
                      ];
                    }
                  }
                }
              }
            },
          },
        });
      } catch (error) {
        console.error('Error creating line chart:', error);
        canvasContainer.innerHTML = '<p style="color: #ff5c5c;">Error rendering chart</p>';
      }
    }
  });
}

function createBoxPlot(canvas, metric, values, avg, showAvg) {
  const sortedValues = [...values].sort((a, b) => a - b);
  const q1 = calculatePercentile(sortedValues, 25);
  const median = calculatePercentile(sortedValues, 50);
  const q3 = calculatePercentile(sortedValues, 75);
  const iqr = q3 - q1;
  const lowerWhisker = Math.max(sortedValues[0], q1 - 1.5 * iqr);
  const upperWhisker = Math.min(sortedValues[sortedValues.length - 1], q3 + 1.5 * iqr);
  const outliers = values.filter(v => v < lowerWhisker || v > upperWhisker);

  const boxPlotData = {
    labels: [metric.label],
    datasets: [{
      backgroundColor: metric.color + '40',
      borderColor: metric.color,
      borderWidth: 2,
      outlierBackgroundColor: '#ff5c5c',
      outlierRadius: 5,
      data: [{
        min: lowerWhisker,
        q1: q1,
        median: median,
        q3: q3,
        max: upperWhisker,
        outliers: outliers
      }]
    }]
  };

  const chart = new Chart(canvas.getContext('2d'), {
    type: 'boxplot',
    data: boxPlotData,
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 3,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'point',
          intersect: true,
          backgroundColor: '#1C1E21',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#000',
          borderWidth: 1,
          titleFont: {
            family: 'Lato',
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            family: 'Lato',
            size: 14
          },
          padding: 10,
          displayColors: false,
          callbacks: {
            title: function () {
              return metric.label;
            },
            label: function (context) {
              if (context.datasetIndex === 0 && context.dataIndex === 0) {
                return null;
              }
              return `Outlier: ${context.raw}`;
            },
            beforeBody: function (context) {
              if (context[0].datasetIndex === 0) {
                const data = context[0].dataset.data[context[0].dataIndex];
                return [
                  `Minimum: ${data.min.toFixed(1)}`,
                  `Q1: ${data.q1.toFixed(1)}`,
                  `Median: ${data.median.toFixed(1)}`,
                  `Q3: ${data.q3.toFixed(1)}`,
                  `Maximum: ${data.max.toFixed(1)}`,
                  `IQR: ${q3 - q1}`,
                ];
              }
              return null;
            },
            afterBody: function (context) {
              if (context[0].datasetIndex === 0 && showAvg) {
                return [`Average: ${avg.toFixed(1)}`];
              }
              return null;
            }
          }
        }
      },
      scales: {
        y: {
          display: false
        },
        x: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255,255,255,0.1)',
            drawBorder: false
          },
          ticks: {
            color: 'white',
            font: {
              family: 'Lato',
              size: 14,
              weight: 'bold'
            }
          }
        }
      }
    }
  });

  return chart;
}
const reliabilityCheckboxIds = [
  'reliabilityTotalPoints',
  'reliabilityAutoPoints',
  'reliabilityTelePoints',
  'reliabilityTotalCycles',
  'reliabilityTotalCoralCycles',
  'reliabilityL4Cycles',
  'reliabilityL3Cycles',
  'reliabilityL2Cycles',
  'reliabilityL1Cycles',
  'reliabilityTotalAlgaeCycles',
  'reliabilityBargeCycles',
  'reliabilityProcessorCycles',
];

function setDefaultReliabilityCheckboxes() {
  reliabilityCheckboxIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'reliabilityTotalPoints' || id === 'showEPAAvg') {
        el.checked = true;
      } else {
        el.checked = false;
      }
    }
  });
}

function getReliabilityCheckboxState() {
  const state = {};
  reliabilityCheckboxIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) state[id] = el.checked;
  });
  return state;
}
function setReliabilityCheckboxState(state) {
  reliabilityCheckboxIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && typeof state[id] === 'boolean') el.checked = state[id];
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setDefaultReliabilityCheckboxes();
});

let lastReliabilityCheckboxState = getReliabilityCheckboxState();
reliabilityCheckboxIds.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', () => {
      lastReliabilityCheckboxState = getReliabilityCheckboxState();
      renderReliabilityCharts();
    });
  }
});

function renderBlankChart(canvasId, label = "No Data") {
  const ctx = document.getElementById(canvasId).getContext('2d');

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [label],
      datasets: [
        {
          label: label,
          data: [0],
          backgroundColor: '#888888'
        }
      ]
    },
    options: getChartOptions(false)
  });
}

function filterAndRenderCharts(filterValue) {
  const teamNumber = document.getElementById('teamSearch').value.trim();
  if (!teamNumber) {
    renderBlankCharts();
    return;
  }

  const algaeFilter = document.getElementById('algaeTypeFilter').value;

  const filteredData = filterTeamData(teamNumber);
  let autoFilteredData = [...filteredData];

  if (filterValue === 'side') {
    autoFilteredData = autoFilteredData.filter(row => ['o', 'p'].includes(row['Auton Starting Position']));
  } else if (filterValue === 'center') {
    autoFilteredData = autoFilteredData.filter(row => row['Auton Starting Position'] === 'c');
  } else if (filterValue === 'processor') {
    autoFilteredData = autoFilteredData.filter(row => row['Auton Starting Position'] === 'p');
  } else if (filterValue === 'barge') {
    autoFilteredData = autoFilteredData.filter(row => row['Auton Starting Position'] === 'o');
  }

  if (autoFilteredData.length === 0) {
    renderBlankChart('autoCoral', "No Data");
    renderBlankChart('autoAlgae', "No Data");
  } else {
    renderAutoCharts(autoFilteredData);
  }

  renderTeleCharts(filteredData);
  renderEndGameChart(filteredData);
  renderTeleAlgaeChartFiltered(filteredData, algaeFilter);
}
function syncDropdowns(value) {
  document.querySelectorAll('#startingPositionFilter').forEach(dropdown => {
    dropdown.value = value;
  });
}

/*-----COMPARISON VIEW----*/

function getMaxTeleCoral(team1Data, team2Data) {
  const combined = [...team1Data, ...team2Data];

  let maxTotal = 0;

  combined.forEach(row => {
    const totalCoral =
      (parseInt(row['L1']) || 0) +
      (parseInt(row['L2']) || 0) +
      (parseInt(row['L3']) || 0) +
      (parseInt(row['L4']) || 0);

    if (totalCoral > maxTotal) {
      maxTotal = totalCoral;
    }
  });

  return maxTotal;
}


function getMaxTeleAlgae(team1Data, team2Data, filter = 'all') {
  const combined = [...team1Data, ...team2Data];
  let max = 0;

  combined.forEach(row => {
    let value = 0;
    if (filter === 'remove') {
      value = parseInt(row['Algae removed'] || 0);
    } else if (filter === 'barge') {
      value = parseInt(row['Algae in Net'] || 0);
    } else if (filter === 'process') {
      value = parseInt(row['Algae in Processor'] || 0);
    } else {
      value =
        (parseInt(row['Algae removed'] || 0)) +
        (parseInt(row['Algae in Net'] || 0)) +
        (parseInt(row['Algae in Processor'] || 0));
    }

    if (value > max) {
      max = value;
    }
  });

  return Math.ceil(max / 2) * 2;
}

function getMaxAutoCoral(team1Data, team2Data, filterValue = 'all') {
  const combined = [...team1Data, ...team2Data];

  let filtered = combined;
  if (filterValue === 'side') {
    filtered = filtered.filter(row => ['o', 'p'].includes(row['Auton Starting Position']));
  } else if (filterValue === 'center') {
    filtered = filtered.filter(row => row['Auton Starting Position'] === 'c');
  } else if (filterValue === 'processor') {
    filtered = filtered.filter(row => row['Auton Starting Position'] === 'p');
  } else if (filterValue === 'barge') {
    filtered = filtered.filter(row => row['Auton Starting Position'] === 'o');
  }

  let max = 0;
  filtered.forEach(row => {
    const total =
      (parseInt(row['Auton L1']) || 0) +
      (parseInt(row['Auton L2']) || 0) +
      (parseInt(row['Auton L3']) || 0) +
      (parseInt(row['Auton L4']) || 0);
    if (total > max) max = total;
  });

  return Math.ceil(max / 1) * 1;
}

function getMaxAutoAlgae(team1Data, team2Data, filterValue = 'all') {
  const combined = [...team1Data, ...team2Data];

  let filtered = combined;
  if (filterValue === 'side') {
    filtered = filtered.filter(row => ['o', 'p'].includes(row['Auton Starting Position']));
  } else if (filterValue === 'center') {
    filtered = filtered.filter(row => row['Auton Starting Position'] === 'c');
  } else if (filterValue === 'processor') {
    filtered = filtered.filter(row => row['Auton Starting Position'] === 'p');
  } else if (filterValue === 'barge') {
    filtered = filtered.filter(row => row['Auton Starting Position'] === 'o');
  }

  let max = 0;
  filtered.forEach(row => {
    const total =
      (parseInt(row['Auton Algae Removed'] || 0)) +
      (parseInt(row['Auton Algae in Net'] || 0)) +
      (parseInt(row['Auton Algae in Processor'] || 0));
    if (total > max) max = total;
  });

  return Math.ceil(max / 1) * 1;
}

function searchComparisonBothTeams() {
  const team1 = document.getElementById('comparisonSearch1').value.trim();
  const team2 = document.getElementById('comparisonSearch2').value.trim();

  displayTeamNickname(team1, 'teamNameDisplay1');
  displayTeamNickname(team2, 'teamNameDisplay2');

  const team1Data = filterTeamData(team1);
  const team2Data = filterTeamData(team2);

  const maxTeleopCoral = getMaxTeleCoral(team1Data, team2Data);
  const algaeFilter = document.getElementById('algaeTypeFilter1').value || 'all';
  const maxTeleopAlgae = getMaxTeleAlgae(team1Data, team2Data, algaeFilter);
  const yMax = Math.ceil(maxTeleopCoral / 2) * 2;
  const startFilter = document.getElementById('startingPositionFilter1').value || 'all';
  const maxAutoCoral = getMaxAutoCoral(team1Data, team2Data, startFilter);
  const maxAutoAlgae = getMaxAutoAlgae(team1Data, team2Data, startFilter);

  searchComparison(1, yMax, maxTeleopAlgae, maxAutoCoral, maxAutoAlgae);
  searchComparison(2, yMax, maxTeleopAlgae, maxAutoCoral, maxAutoAlgae);
  renderComparisonMetricBoxPlots();

}
function searchComparison(teamNumber, yMaxOverride = null, yMaxAlgaeOverride = null, maxAutoCoralOverride = null, maxAutoAlgaeOverride = null) {

  const teamInputId = teamNumber === 1 ? 'comparisonSearch1' : 'comparisonSearch2';
  const otherTeamInputId = teamNumber === 1 ? 'comparisonSearch2' : 'comparisonSearch1';
  const coralCanvasId = teamNumber === 1 ? 'autoCoralTeam1' : 'autoCoralTeam2';
  const algaeCanvasId = teamNumber === 1 ? 'autoAlgaeTeam1' : 'autoAlgaeTeam2';
  const teleCoralCanvasId = teamNumber === 1 ? 'teleCoralTeam1' : 'teleCoralTeam2';
  const teleAlgaeCanvasId = teamNumber === 1 ? 'teleAlgaeTeam1' : 'teleAlgaeTeam2';
  const endGameCanvasId = teamNumber === 1 ? 'endGameTeam1' : 'endGameTeam2';
  const scouterCommentsId = teamNumber === 1 ? 'scouterComments1' : 'scouterComments2';
  const teamNameDisplayId = teamNumber === 1 ? 'teamNameDisplay1' : 'teamNameDisplay2';

  const teamNumberInput = document.getElementById(teamInputId).value.trim();
  const otherTeamNumberInput = document.getElementById(otherTeamInputId).value.trim();

  displayTeamNickname(teamNumberInput, teamNameDisplayId);

  document.getElementById(`startingPositionFilter${teamNumber}`).value = 'all';
  document.querySelectorAll('.showEPAAvgComparison').forEach(cb => cb.checked = true);


  let teamData = filterTeamData(teamNumberInput);
  let otherTeamData = filterTeamData(otherTeamNumberInput);

  const yMax = yMaxOverride !== null
    ? yMaxOverride
    : Math.ceil(getMaxTeleCoral(teamData, otherTeamData) / 2) * 2;

  const yMaxAlgae = yMaxAlgaeOverride !== null
    ? yMaxAlgaeOverride
    : Math.ceil(getTopAlgaeMatchFromTwoTeams(teamData, otherTeamData) / 2) * 2;


  const maxAutoCoral = maxAutoCoralOverride !== null
    ? maxAutoCoralOverride
    : Math.ceil(getMaxAutoCoral(teamData, otherTeamData) / 1) * 1;

  const maxAutoAlgae = maxAutoAlgaeOverride !== null
    ? maxAutoAlgaeOverride
    : Math.ceil(getMaxAutoAlgae(teamData, otherTeamData) / 1) * 1;

  if (teamData.length === 0) {
    renderBlankChart(coralCanvasId);
    renderBlankChart(algaeCanvasId);
    renderBlankChart(teleCoralCanvasId);
    renderBlankChart(teleAlgaeCanvasId);
    renderBlankChart(endGameCanvasId);
    document.getElementById(scouterCommentsId).innerHTML = 'No qualitative notes available for this team.';
    return;
  }

  teamData = teamData.sort((a, b) => parseInt(a.Match) - parseInt(b.Match));
  otherTeamData = otherTeamData.sort((a, b) => parseInt(a.Match) - parseInt(b.Match));

  renderAutoCoralChartForTeam(teamData, coralCanvasId, maxAutoCoral);
  renderAutoAlgaeChartForTeam(teamData, algaeCanvasId, maxAutoAlgae);
  renderTeleCoralChartForTeam(teamData, teleCoralCanvasId, yMax);
  renderTeleAlgaeChartForTeam(teamData, teleAlgaeCanvasId, yMaxAlgae);
  renderEndGameChartForTeam(teamData, endGameCanvasId);
  renderScouterCommentsForTeam(teamData, scouterCommentsId);
  renderComparisonTeamStatistics(teamData, pitScoutingData, teamNumber);

  const currentFilterValue = document.getElementById(`startingPositionFilter${teamNumber}`).value;
  syncDropdownsAndFilter(currentFilterValue);

  filterAndRenderAlgaeCharts(1, 'all');
  filterAndRenderAlgaeCharts(2, 'all');
}
function renderTeleCoralChartForTeam(teamData, canvasId, maxYValue = null) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  const matchLabels = teamData.map(row => 'Q' + row.Match);
  const coralL1 = teamData.map(row => parseInt(row['L1'] || 0));
  const coralL2 = teamData.map(row => parseInt(row['L2'] || 0));
  const coralL3 = teamData.map(row => parseInt(row['L3'] || 0));
  const coralL4 = teamData.map(row => parseInt(row['L4'] || 0));

  const yMax = maxYValue !== null ? maxYValue : getMaxTeleCoral(teamData, []);

  const stepSize = maxYValue > 16 ? 4 : 2;
  const newMax = Math.ceil(yMax / stepSize) * stepSize;

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: matchLabels,
      datasets: [
        { label: 'L1', data: coralL1, backgroundColor: '#3B064D' },
        { label: 'L2', data: coralL2, backgroundColor: '#8105D8' },
        { label: 'L3', data: coralL3, backgroundColor: '#ED0CEF' },
        { label: 'L4', data: coralL4, backgroundColor: '#FF8BFC' }
      ]
    },
    options: {
      ...getChartOptions(true, 2),
      scales: {
        ...getChartOptions(true, 2).scales,
        y: {
          ...getChartOptions(true, 2).scales.y,
          max: newMax,
          ticks: {
            ...getChartOptions(true, 2).scales.y.ticks,
            stepSize: stepSize
          }
        }
      },
      plugins: {
        ...getChartOptions(true, 2).plugins,
        tooltip: {
          ...getChartOptions(true, 2).plugins.tooltip,
          callbacks: {
            afterBody: function (context) {
              const dataIndex = context[0].dataIndex;
              const row = teamData[dataIndex];
              const total =
                (parseInt(row['L1'] || 0)) +
                (parseInt(row['L2'] || 0)) +
                (parseInt(row['L3'] || 0)) +
                (parseInt(row['L4'] || 0));
              return `Total Coral: ${total}`;
            }
          }
        }
      }
    }
  });

  return newMax;
}

function renderAutoCoralChartForTeam(teamData, canvasId, maxY = null) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  const matchLabels = teamData.map(row => 'Q' + row.Match);
  const coralL1 = teamData.map(row => parseInt(row['Auton L1'] || 0));
  const coralL2 = teamData.map(row => parseInt(row['Auton L2'] || 0));
  const coralL3 = teamData.map(row => parseInt(row['Auton L3'] || 0));
  const coralL4 = teamData.map(row => parseInt(row['Auton L4'] || 0));

  const yMax = maxY ?? Math.ceil(Math.max(...coralL1, ...coralL2, ...coralL3, ...coralL4) / 1) * 1;

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: matchLabels,
      datasets: [
        { label: 'L1', data: coralL1, backgroundColor: '#3B064D' },
        { label: 'L2', data: coralL2, backgroundColor: '#8105D8' },
        { label: 'L3', data: coralL3, backgroundColor: '#ED0CEF' },
        { label: 'L4', data: coralL4, backgroundColor: '#FF8BFC' }
      ]
    },
    options: {
      ...getChartOptions(true, 2),
      scales: {
        ...getChartOptions(true, 2).scales,
        y: {
          ...getChartOptions(true, 2).scales.y,
          max: yMax,
          ticks: {
            ...getChartOptions(true, 2).scales.y.ticks,
            stepSize: 1
          }
        }
      }
    }
  });

  return yMax;
}

function renderAutoAlgaeChartForTeam(teamData, canvasId, maxY = null) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  const matchLabels = teamData.map(row => 'Q' + row.Match);
  const algaeRemoved = teamData.map(row => parseInt(row['Auton Algae Removed'] || 0));
  const algaeNet = teamData.map(row => parseInt(row['Auton Algae in Net'] || 0));
  const algaeProcessor = teamData.map(row => parseInt(row['Auton Algae in Processor'] || 0));

  const yMax = maxY ?? Math.ceil(Math.max(...algaeRemoved, ...algaeNet, ...algaeProcessor) / 1) * 1;

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: matchLabels,
      datasets: [
        { label: 'Removed', data: algaeRemoved, backgroundColor: '#002BFF' },
        { label: 'Net', data: algaeNet, backgroundColor: '#00D2F3' },
        { label: 'Processor', data: algaeProcessor, backgroundColor: '#5cffd5' }
      ]
    },
    options: {
      ...getChartOptions(true, 2),
      scales: {
        ...getChartOptions(true, 2).scales,
        y: {
          ...getChartOptions(true, 2).scales.y,
          max: yMax,
          ticks: {
            ...getChartOptions(true, 2).scales.y.ticks,
            stepSize: 1
          }
        }
      },
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
          padding: 10,
          callbacks: {
            afterBody: function (context) {
              const dataIndex = context[0].dataIndex;
              const row = teamData[dataIndex];
              const total =
                (parseInt(row['Auton Algae Removed'] || 0)) +
                (parseInt(row['Auton Algae in Net'] || 0)) +
                (parseInt(row['Auton Algae in Processor'] || 0));
              return `Total Algae: ${total}`;
            }
          }
        }
      }
    }
  });
}

function syncAlgaeDropdownsAndFilter(value) {
  document.querySelectorAll('#algaeTypeFilter1, #algaeTypeFilter2').forEach(dropdown => {
    dropdown.value = value;
  });

  filterAndRenderAlgaeCharts(1, value);
  filterAndRenderAlgaeCharts(2, value);
}

function filterAndRenderAlgaeCharts(teamNumber, filterValue) {
  const teamInputId = teamNumber === 1 ? 'comparisonSearch1' : 'comparisonSearch2';
  const teleAlgaeCanvasId = teamNumber === 1 ? 'teleAlgaeTeam1' : 'teleAlgaeTeam2';

  const teamNumberInput = document.getElementById(teamInputId).value.trim();
  if (!teamNumberInput) {
    renderBlankChart(teleAlgaeCanvasId);
    return;
  }

  let teamData = filterTeamData(teamNumberInput);
  if (teamData.length === 0) {
    renderBlankChart(teleAlgaeCanvasId);
    return;
  }

  teamData = teamData.sort((a, b) => parseInt(a.Match) - parseInt(b.Match));

  let filteredData = [...teamData];
  if (filterValue === 'remove') {
    filteredData = filteredData.filter(row => parseInt(row['Algae removed'] || 0) > 0);
  } else if (filterValue === 'barge') {
    filteredData = filteredData.filter(row => parseInt(row['Algae in Net'] || 0) > 0);
  } else if (filterValue === 'process') {
    filteredData = filteredData.filter(row => parseInt(row['Algae in Processor'] || 0) > 0);
  }

  const otherTeamInputId = teamNumber === 1 ? 'comparisonSearch2' : 'comparisonSearch1';
  const otherTeamInput = document.getElementById(otherTeamInputId).value.trim();
  const otherTeamData = filterTeamData(otherTeamInput);

  const maxY = getMaxTeleAlgae(teamData, otherTeamData, filterValue);

  renderFilteredTeleAlgaeChartForTeam(filteredData, teleAlgaeCanvasId, filterValue, maxY);
}

function renderFilteredTeleAlgaeChartForTeam(teamData, canvasId, filterValue, yMax = null) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  const matchLabels = teamData.map(row => 'Q' + row.Match);
  const datasets = [];

  if (filterValue === 'all' || filterValue === 'remove') {
    datasets.push({
      label: 'Removed',
      data: teamData.map(row => parseInt(row['Algae removed'] || 0)),
      backgroundColor: '#002BFF'
    });
  }

  if (filterValue === 'all' || filterValue === 'barge') {
    datasets.push({
      label: 'Net',
      data: teamData.map(row => parseInt(row['Algae in Net'] || 0)),
      backgroundColor: '#00D2F3'
    });
  }

  if (filterValue === 'all' || filterValue === 'process') {
    datasets.push({
      label: 'Processor',
      data: teamData.map(row => parseInt(row['Algae in Processor'] || 0)),
      backgroundColor: '#5cffd5'
    });
  }

  if (datasets.length === 0) {
    renderBlankChart(canvasId, "No Data");
    return;
  }

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: matchLabels,
      datasets: datasets
    },
    options: {
      ...getChartOptions(true, 2),
      scales: {
        ...getChartOptions(true, 2).scales,
        y: {
          ...getChartOptions(true, 2).scales.y,
          max: yMax ?? undefined,
          ticks: {
            ...getChartOptions(true, 2).scales.y.ticks,
            stepSize: 2
          }
        }
      },
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
      }
    }
  });
}

function renderTeleAlgaeChartForTeam(teamData, canvasId, yMax) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  const matchLabels = teamData.map(row => 'Q' + row.Match);
  const algaeRemoved = teamData.map(row => parseInt(row['Algae removed'] || 0));
  const algaeNet = teamData.map(row => parseInt(row['Algae in Net'] || 0));
  const algaeProcessed = teamData.map(row => parseInt(row['Algae in Processor'] || 0));

  const maxYValue = yMax ?? Math.ceil(Math.max(...algaeRemoved, ...algaeNet, ...algaeProcessed) / 1) * 1;

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: matchLabels,
      datasets: [
        { label: 'Removed', data: algaeRemoved, backgroundColor: '#002BFF' },
        { label: 'Net', data: algaeNet, backgroundColor: '#00D2F3' },
        { label: 'Processor', data: algaeProcessed, backgroundColor: '#5cffd5' }
      ]
    },
    options: {
      ...getChartOptions(true, 2),
      scales: {
        ...getChartOptions(true, 2).scales,
        y: {
          ...getChartOptions(true, 2).scales.y,
          max: maxYValue,
          ticks: {
            ...getChartOptions(true, 2).scales.y.ticks,
            stepSize: 2
          }
        }
      },
      plugins: {
        ...getChartOptions(true, 2).plugins,
        tooltip: {
          ...getChartOptions(true, 2).plugins.tooltip,
          callbacks: {}
        }
      }
    }
  });

  return maxYValue;
}

function renderEndGameChartForTeam(teamData, canvasId) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  const matchLabels = teamData.map(row => 'Q' + row.Match);
  const climbScores = teamData.map(row => parseFloat(row['Climb Score'] || 0));

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: matchLabels,
      datasets: [
        {
          label: 'Climb Score',
          data: climbScores,
          backgroundColor: climbScores.map(score =>
            score === 12 || score === 6 || score === 2 ? '#3EDBF0' : '#FF5C5C'
          )
        }
      ]
    },
    options: {
      ...getChartOptions(false, 6),
      scales: {
        ...getChartOptions(false, 6).scales,
        y: {
          ...getChartOptions(false, 6).scales.y,
          max: 12
        }
      }
    }
  });
}

function renderComparisonTeamStatistics(teamData, pitData, teamNumber) {
  const climbSuccessRateId = `comparisonClimbSuccessRate${teamNumber}`;
  const robotDiedRateId = `comparisonRobotDiedRate${teamNumber}`;
  const groundBargeId = `comparisonGroundBarge${teamNumber}`;
  const groundProcessorId = `comparisonGroundProcessor${teamNumber}`;
  const averageEPAId = `comparisonAverageEPA${teamNumber}`;
  const averageCoralId = `comparisonAverageCoral${teamNumber}`;
  const averageAlgaeId = `comparisonAverageAlgae${teamNumber}`;

  const clearValue = (id, defaultValue = '') => {
    document.getElementById(id).textContent = defaultValue;
  };

  clearValue(climbSuccessRateId, '0.00');
  clearValue(robotDiedRateId, '0.00');
  clearValue(groundBargeId);
  clearValue(groundProcessorId);
  clearValue(averageEPAId, '0.00');
  clearValue(averageCoralId, '0.00');
  clearValue(averageAlgaeId, '0.00');

  if (!teamData || teamData.length === 0) return;

  let groundBarge = '';
  let groundProcessor = '';

  if (pitData && pitData.length > 0) {
    const teamPitData = pitData.find(team => {
      const pitTeamNumber = team['Team No.']?.toString().trim();
      return pitTeamNumber === teamData[0]['Team No.'].toString().trim();
    });

    if (teamPitData) {
      if (teamPitData['Ground Barge'] !== undefined) {
        groundBarge = teamPitData['Ground Barge'] ? '✅' : '❌';
      }

      if (teamPitData['Ground Processor'] !== undefined) {
        groundProcessor = teamPitData['Ground Processor'] ? '✅' : '❌';
      }
    }
  }
  document.getElementById(groundBargeId).textContent = groundBarge;
  document.getElementById(groundProcessorId).textContent = groundProcessor;

  const climbScores = teamData.map(row => parseFloat(row['Climb Score'] || 0));
  const successfulClimbs = climbScores.filter(score => score === 12 || score === 6).length;
  const totalClimbAttempts = climbScores.filter(score => score === 12 || score === 6 || score === 2.1).length;
  const climbSuccessRate = totalClimbAttempts > 0 ? (successfulClimbs / totalClimbAttempts * 100).toFixed(1) : "0.00";
  const robotDiedRate = teamData.length > 0 ? (teamData.filter(row => row['Died or Immobilized'] === '1').length / teamData.length * 100).toFixed(1) : "0.00";

  document.getElementById(climbSuccessRateId).textContent = climbSuccessRate;
  document.getElementById(robotDiedRateId).textContent = robotDiedRate;

  const totalScore = teamData.reduce((sum, row) => sum + (parseFloat(row['Total Score']) || 0), 0);
  const totalCoral = teamData.reduce((sum, row) => {
    return sum +
      (parseInt(row['Auton L1']) || 0) +
      (parseInt(row['Auton L2']) || 0) +
      (parseInt(row['Auton L3']) || 0) +
      (parseInt(row['Auton L4']) || 0) +
      (parseInt(row['L1']) || 0) +
      (parseInt(row['L2']) || 0) +
      (parseInt(row['L3']) || 0) +
      (parseInt(row['L4']) || 0);
  }, 0);

  const totalAlgae = teamData.reduce((sum, row) => {
    return sum +
      (parseInt(row['Auton Algae in Net'] || 0)) * 2 +
      (parseInt(row['Auton Algae in Processor'] || 0)) * 3 +
      (parseInt(row['Algae in Net'] || 0) * 2) +
      (parseInt(row['Algae in Processor'] || 0) * 3);
  }, 0);

  const averageEPA = teamData.length > 0 ? (totalScore / teamData.length).toFixed(1) : "0.00";
  const averageCoral = teamData.length > 0 ? (totalCoral / teamData.length).toFixed(1) : "0.00";
  const averageAlgae = teamData.length > 0 ? (totalAlgae / teamData.length).toFixed(1) : "0.00";

  document.getElementById(averageEPAId).textContent = averageEPA;
  document.getElementById(averageCoralId).textContent = averageCoral;
  document.getElementById(averageAlgaeId).textContent = averageAlgae;
}

function renderScouterCommentsForTeam(teamData, containerId) {
  const scouterCommentsDiv = document.getElementById(containerId);

  scouterCommentsDiv.innerHTML = '';

  const notes = teamData
    .filter(row => row['Comments'] && row['Comments'].trim() !== '')
    .map(row => `Q${row.Match}: ${row['Comments']}`);

  if (notes.length > 0) {
    scouterCommentsDiv.innerHTML = notes.join('<hr style="border: 0; margin: 10px 0;">');
  } else {
    scouterCommentsDiv.innerHTML = 'No qualitative notes available for this team.';
  }
}
function syncDropdownsAndFilter(value) {
  const algae1 = document.getElementById('algaeTypeFilter1').value;
  const algae2 = document.getElementById('algaeTypeFilter2').value;

  document.querySelectorAll('.comparison-filter').forEach(dropdown => {
    dropdown.value = value;
  });

  const team1Input = document.getElementById('comparisonSearch1').value.trim();
  const team2Input = document.getElementById('comparisonSearch2').value.trim();

  const team1Data = filterTeamData(team1Input);
  const team2Data = filterTeamData(team2Input);

  const maxAutoCoral = getMaxAutoCoral(team1Data, team2Data, value);
  const maxAutoAlgae = getMaxAutoAlgae(team1Data, team2Data, value);

  filterAndRenderComparisonCharts(1, value, maxAutoCoral, maxAutoAlgae);
  filterAndRenderComparisonCharts(2, value, maxAutoCoral, maxAutoAlgae);

  document.getElementById('algaeTypeFilter1').value = algae1;
  document.getElementById('algaeTypeFilter2').value = algae2;
  filterAndRenderAlgaeCharts(1, algae1);
  filterAndRenderAlgaeCharts(2, algae2);
}

function filterAndRenderComparisonCharts(teamNumber, filterValue, yMaxCoral = null, yMaxAlgae = null) {
  const teamInputId = teamNumber === 1 ? 'comparisonSearch1' : 'comparisonSearch2';
  const coralCanvasId = teamNumber === 1 ? 'autoCoralTeam1' : 'autoCoralTeam2';
  const algaeCanvasId = teamNumber === 1 ? 'autoAlgaeTeam1' : 'autoAlgaeTeam2';

  const teamNumberInput = document.getElementById(teamInputId).value.trim();

  if (!teamNumberInput) {
    renderBlankChart(coralCanvasId);
    renderBlankChart(algaeCanvasId);
    return;
  }

  let teamData = filterTeamData(teamNumberInput);
  if (teamData.length === 0) {
    renderBlankChart(coralCanvasId);
    renderBlankChart(algaeCanvasId);
    return;
  }

  teamData = teamData.sort((a, b) => parseInt(a.Match) - parseInt(b.Match));

  let filteredData = [...teamData];
  if (filterValue === 'side') {
    filteredData = filteredData.filter(row => ['o', 'p'].includes(row['Auton Starting Position']));
  } else if (filterValue === 'center') {
    filteredData = filteredData.filter(row => row['Auton Starting Position'] === 'c');
  } else if (filterValue === 'processor') {
    filteredData = filteredData.filter(row => row['Auton Starting Position'] === 'p');
  } else if (filterValue === 'barge') {
    filteredData = filteredData.filter(row => row['Auton Starting Position'] === 'o');
  }

  const dataToUse = filterValue === 'all' ? teamData : filteredData;

  if (dataToUse.length > 0) {
    renderAutoCoralChartForTeam(dataToUse, coralCanvasId, yMaxCoral);
    renderAutoAlgaeChartForTeam(dataToUse, algaeCanvasId, yMaxAlgae);
  } else {
    renderBlankChart(coralCanvasId);
    renderBlankChart(algaeCanvasId);
  }
}

function getMetricValues(teamData, metricKey) {
  switch (metricKey) {
    case 'Total Points':
      return teamData.map(row => parseFloat(row['Total Score'] || 0));
    case 'Auto Points':
      return teamData.map(row => parseFloat(row['Auton Score'] || 0));
    case 'Tele Points':
      return teamData.map(row => (parseFloat(row['Total Score'] || 0) - parseFloat(row['Auton Score'] || 0)));
    case 'Total Cycles':
      return teamData.map(row =>
      (parseInt(row['L1'] || 0) + parseInt(row['L2'] || 0) + parseInt(row['L3'] || 0) + parseInt(row['L4'] || 0) +
        parseInt(row['Algae in Net'] || 0) + parseInt(row['Algae in Processor'] || 0))
      );
    case 'Total Coral Cycles':
      return teamData.map(row =>
        (parseInt(row['L1'] || 0) + parseInt(row['L2'] || 0) + parseInt(row['L3'] || 0) + parseInt(row['L4'] || 0))
      );
    case 'L4 Cycles':
      return teamData.map(row => parseInt(row['L4'] || 0));
    case 'L3 Cycles':
      return teamData.map(row => parseInt(row['L3'] || 0));
    case 'L2 Cycles':
      return teamData.map(row => parseInt(row['L2'] || 0));
    case 'L1 Cycles':
      return teamData.map(row => parseInt(row['L1'] || 0));
    case 'Total Algae Cycles':
      return teamData.map(row =>
        (parseInt(row['Algae in Net'] || 0) + parseInt(row['Algae in Processor'] || 0))
      );
    case 'Barge Cycles':
      return teamData.map(row => parseInt(row['Algae in Net'] || 0));
    case 'Processor Cycles':
      return teamData.map(row => parseInt(row['Algae in Processor'] || 0));
    default:
      return [];
  }
}


function calculatePercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedArray[lower];
  return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (index - lower);
}

function renderComparisonMetricBoxPlots() {
  const team1 = document.getElementById('comparisonSearch1').value.trim();
  const team2 = document.getElementById('comparisonSearch2').value.trim();
  const team1Data = filterTeamData(team1);
  const team2Data = filterTeamData(team2);

  const metrics = [
    { label: 'Total Points', left: 'leftTotalPointsChart', right: 'rightTotalPointsChart', color: '#3ED098' },
    { label: 'Auto Points', left: 'leftAutoPointsChart', right: 'rightAutoPointsChart', color: '#51E7CF' },
    { label: 'Tele Points', left: 'leftTelePointsChart', right: 'rightTelePointsChart', color: '#3ecdd0' },
    { label: 'Total Cycles', left: 'leftTotalCyclesChart', right: 'rightTotalCyclesChart', color: '#cf8ffc' },
    { label: 'Total Coral Cycles', left: 'leftTotalCoralCyclesChart', right: 'rightTotalCoralCyclesChart', color: '#ff83fa' },
    { label: 'L4 Cycles', left: 'leftL4CyclesChart', right: 'rightL4CyclesChart', color: '#ff8bfc' },
    { label: 'L3 Cycles', left: 'leftL3CyclesChart', right: 'rightL3CyclesChart', color: '#ed0cef' },
    { label: 'L2 Cycles', left: 'leftL2CyclesChart', right: 'rightL2CyclesChart', color: '#BF02ff' },
    { label: 'L1 Cycles', left: 'leftL1CyclesChart', right: 'rightL1CyclesChart', color: '#8105d8' },
    { label: 'Total Algae Cycles', left: 'leftTotalAlgaeCyclesChart', right: 'rightTotalAlgaeCyclesChart', color: '#006fff' },
    { label: 'Barge Cycles', left: 'leftBargeCyclesChart', right: 'rightBargeCyclesChart', color: '#3498db' },
    { label: 'Processor Cycles', left: 'leftProcessorCyclesChart', right: 'rightProcessorCyclesChart', color: '#14c7de' }
  ];

  metrics.forEach(metric => {
    const values1 = getMetricValues(team1Data, metric.label);
    const values2 = getMetricValues(team2Data, metric.label);

    const allValues = [...values1, ...values2].filter(v => typeof v === 'number' && !isNaN(v));
    let min = 0, max = 1, stepSize = 1;
    if (allValues.length > 0) {
      let rawMin = Math.min(...allValues);
      let rawMax = Math.max(...allValues);

      const range = rawMax - rawMin;
      if (range > 20) stepSize = 5;
      else if (range > 10) stepSize = 2;
      else stepSize = 1;

      min = Math.floor(rawMin / stepSize) * stepSize;
      max = Math.ceil(rawMax / stepSize) * stepSize;
      if (max <= rawMax) max += stepSize;
    }

    renderMetricBoxPlot(metric.left, values1, metric.color, min, max, stepSize);
    renderMetricBoxPlot(metric.right, values2, metric.color, min, max, stepSize);
  });
}

function renderMetricBoxPlot(canvasId, values, color = '#3ED098', min = 0, max = 1, stepSize = 1) {
  if (window.charts && window.charts[canvasId]) {
    window.charts[canvasId].destroy();
  }
  if (!window.charts) window.charts = {};
  const ctx = document.getElementById(canvasId).getContext('2d');

  if (!values || values.length === 0) {
    window.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: { labels: ['No Data'], datasets: [{ data: [0], backgroundColor: '#888' }] },
      options: { responsive: true }
    });
    return;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = calculatePercentile(sorted, 25);
  const median = calculatePercentile(sorted, 50);
  const q3 = calculatePercentile(sorted, 75);
  const iqr = q3 - q1;
  const boxMin = Math.max(sorted[0], q1 - 1.5 * iqr);
  const boxMax = Math.min(sorted[sorted.length - 1], q3 + 1.5 * iqr);
  const outliers = values.filter(v => v < boxMin || v > boxMax);

  window.charts[canvasId] = new Chart(ctx, {
    type: 'boxplot',
    data: {
      labels: [''],
      datasets: [{
        backgroundColor: color + '40',
        borderColor: color,
        borderWidth: 2,
        outlierBackgroundColor: '#ff5c5c',
        outlierRadius: 5,
        data: [{
          min: boxMin,
          q1: q1,
          median: median,
          q3: q3,
          max: boxMax,
          outliers: outliers
        }]
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      devicePixelRatio: 2,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'point',
          intersect: true,
          backgroundColor: '#1C1E21',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#000',
          borderWidth: 1,
          titleFont: { family: 'Lato', size: 14, weight: 'bold' },
          bodyFont: { family: 'Lato', size: 14 },
          padding: 10,
          displayColors: false,
          callbacks: {
            title: () => '',
            label: context => {
              if (context.datasetIndex === 0 && context.dataIndex === 0) {
                return [
                  `Min: ${boxMin}`,
                  `Q1: ${q1}`,
                  `Median: ${median}`,
                  `Q3: ${q3}`,
                  `Max: ${boxMax}`,
                  `IQR: ${q3 - q1}`,
                ];
              }
              return '';
            }
          }
        }
      },
      scales: {
        y: { display: false },
        x: {
          min: min,
          max: max,
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.1)', drawBorder: false },
          ticks: {
            color: 'white',
            font: { family: 'Lato', size: 14, weight: 'bold' },
            stepSize: stepSize
          }
        }
      }
    }
  });
}

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
  const filter = document.getElementById('chartFilterDropdown').value;
  (parsedData.data, filter);
  renderCoralCyclesChart(parsedData.data);
  renderAlgaeCyclesChart(parsedData.data);
  renderOverviewStackedChart(parsedData.data, filter);
}

function renderOverviewStackedChart(data, filter = 'all') {

  const ctx = document.getElementById('overviewStackedChart').getContext('2d');

  if (charts['overviewStackedChart']) {
    charts['overviewStackedChart'].destroy();
  }

  const teamScores = {};
  data.forEach(row => {
    const team = row['Team No.'];
    if (!team) return;

    const autonScore = parseFloat(row['Auton Score'] || 0);
    const totalScore = parseFloat(row['Total Score'] || 0);
    const teleScore = totalScore - autonScore;

    if (!teamScores[team]) {
      teamScores[team] = { autoScore: 0, teleScore: 0, matches: 0 };
    }

    teamScores[team].autoScore += autonScore;
    teamScores[team].teleScore += teleScore;
    teamScores[team].matches += 1;
  });

  const averagedScores = Object.keys(teamScores).map(team => ({
    team,
    autoScore: teamScores[team].autoScore / teamScores[team].matches,
    teleScore: teamScores[team].teleScore / teamScores[team].matches,
    totalScore: (teamScores[team].autoScore + teamScores[team].teleScore) / teamScores[team].matches
  }));

  let sortedScores;
  if (filter === 'auto') {
    sortedScores = averagedScores.sort((a, b) => b.autoScore - a.autoScore);
  } else if (filter === 'teleop') {
    sortedScores = averagedScores.sort((a, b) => b.teleScore - a.teleScore);
  } else {
    sortedScores = averagedScores.sort((a, b) => b.totalScore - a.totalScore);
  }

  const labels = sortedScores.map(score => `Team ${score.team}`);
  const autoScores = sortedScores.map(score => score.autoScore);
  const teleScores = sortedScores.map(score => score.teleScore);

  const autoColors = sortedScores.map(score => {
    if (score.team === '226') return '#8105D8';
    if (score.team === highlightedOverviewTeam) return '#ff69b4';
    return '#002BFF';
  });

  const teleColors = sortedScores.map(score => {
    if (score.team === '226') return '#FE59D7';
    if (score.team === highlightedOverviewTeam) return '#ffaad3';
    return '#3EDBF0';
  });


  let datasets = [];
  if (filter === 'all') {
    datasets = [
      {
        label: 'Auton Score',
        data: autoScores,
        backgroundColor: autoColors
      },
      {
        label: 'Teleop Score',
        data: teleScores,
        backgroundColor: teleColors
      }
    ];
  } else if (filter === 'auto') {
    datasets = [
      {
        label: 'Auton Score',
        data: autoScores,
        backgroundColor: autoColors
      }
    ];
  } else if (filter === 'teleop') {
    datasets = [
      {
        label: 'Teleop Score',
        data: teleScores,
        backgroundColor: teleColors
      }
    ];
  }

  charts['overviewStackedChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
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

              if (filter === 'all') {
                const totalScore = Math.round(sortedScores[index].totalScore * 100) / 100;
                return `Rank: ${ranking}\nTotal Score: ${totalScore}`;
              }

              return `Rank: ${ranking}`;
            }
          },
          backgroundColor: '#1C1E21',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#000',
          borderWidth: 1,
          titleFont: { family: 'Lato', size: 14, },
          bodyFont: { family: 'Lato', size: 14 },
          padding: 10
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: 'white',
            font: { family: 'Lato', size: 12 },
            autoSkip: false,
            maxRotation: 45,
            minRotation: 45
          },
          grid: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            color: 'white',
            font: { family: 'Lato', size: 14, weight: 'bold' }
          },
          grid: { display: false }
        }
      },
      layout: {
        padding: {
          left: 10,
          right: 10,
          top: 20,
          bottom: 50
        }
      }
    }
  });
}

function renderCoralCyclesChart(data) {
  const ctx = document.getElementById('coralCyclesChart').getContext('2d');

  if (charts['coralCyclesChart']) {
    charts['coralCyclesChart'].destroy();
  }

  const teamScores = {};
  data.forEach(row => {
    const team = row['Team No.'];
    if (!team) return;

    const teleL1 = parseInt(row['L1'] || 0);
    const teleL2 = parseInt(row['L2'] || 0);
    const teleL3 = parseInt(row['L3'] || 0);
    const teleL4 = parseInt(row['L4'] || 0);

    const totalCoralCycles = teleL1 + teleL2 + teleL3 + teleL4;

    if (!teamScores[team]) {
      teamScores[team] = { coralCycles: 0, matches: 0 };
    }

    teamScores[team].coralCycles += totalCoralCycles;
    teamScores[team].matches += 1;
  });

  const averagedScores = Object.keys(teamScores).map(team => ({
    team,
    avgCoralCycles: (teamScores[team].coralCycles / teamScores[team].matches)
  }));

  const sortedScores = averagedScores.sort((a, b) => b.avgCoralCycles - a.avgCoralCycles);

  const labels = sortedScores.map(score => `Team ${score.team}`);
  const coralCycles = sortedScores.map(score => score.avgCoralCycles);

  const coralColors = sortedScores.map(score => {
    if (score.team === '226') return '#FE59D7';
    if (score.team === highlightedOverviewTeam) return '#ffaad3';
    return '#3EDBF0';
  });


  charts['coralCyclesChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Cycles',
          data: coralCycles,
          backgroundColor: coralColors
        }
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
              return `Rank: ${ranking}`
            },
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
            font: { family: 'Lato', size: 12 },
            autoSkip: false,
            maxRotation: 45,
            minRotation: 45
          },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: 'white',
            font: { family: 'Lato', size: 14, weight: 'bold' }
          },
          grid: { display: false }
        }
      },
      layout: {
        padding: {
          left: 10,
          right: 10,
          top: 20,
          bottom: 50
        }
      }
    }
  });
}
function renderAlgaeCyclesChart(data) {
  const ctx = document.getElementById('algaeCyclesChart').getContext('2d');

  if (charts['algaeCyclesChart']) {
    charts['algaeCyclesChart'].destroy();
  }

  const teamScores = {};
  data.forEach(row => {
    const team = row['Team No.'];
    if (!team) return;

    const algaeProcessor = parseInt(row['Algae in Processor'] || 0);
    const algaeNet = parseInt(row['Algae in Net'] || 0);

    const totalAlgaeCycles = algaeProcessor + algaeNet;

    if (!teamScores[team]) {
      teamScores[team] = { algaeCycles: 0, matches: 0 };
    }

    teamScores[team].algaeCycles += totalAlgaeCycles;
    teamScores[team].matches += 1;
  });

  const averagedScores = Object.keys(teamScores).map(team => ({
    team,
    avgAlgaeCycles: teamScores[team].algaeCycles / teamScores[team].matches
  }));

  const sortedScores = averagedScores.sort((a, b) => b.avgAlgaeCycles - a.avgAlgaeCycles);

  const labels = sortedScores.map(score => `Team ${score.team}`);
  const algaeCycles = sortedScores.map(score => score.avgAlgaeCycles);

  const algaeColors = sortedScores.map(score => {
    if (score.team === '226') return '#FE59D7';
    if (score.team === highlightedOverviewTeam) return '#ffaad3';
    return '#3EDBF0';
  });


  charts['algaeCyclesChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Cycles',
          data: algaeCycles,
          backgroundColor: algaeColors
        }
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
              return `Rank: ${ranking}`
            },
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
            font: { family: 'Lato', size: 12 },
            autoSkip: false,
            maxRotation: 45,
            minRotation: 45
          },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: 'white',
            font: { family: 'Lato', size: 14, weight: 'bold' }
          },
          grid: { display: false }
        }
      },
      layout: {
        padding: {
          left: 10,
          right: 10,
          top: 20,
          bottom: 50
        }
      }
    }
  });
}
function handleOverviewSearch() {
  const input = document.getElementById('overviewSearch').value.trim();
  document.getElementById('chartFilterDropdown').value = 'all';

  if (!input) return;

  highlightedOverviewTeam = input;
  const parsedData = parseCSV();
  renderOverviewStackedChart(parsedData.data, 'all');
  renderCoralCyclesChart(parsedData.data);
  renderAlgaeCyclesChart(parsedData.data);
  displayTeamNickname(input, 'overviewTeamNicknameDisplay');

}

function clearOverviewSearch() {
  document.getElementById('overviewSearch').value = '';
  document.getElementById('chartFilterDropdown').value = 'all';
  document.getElementById('overviewTeamNicknameDisplay').textContent = '';
  highlightedOverviewTeam = null;
  const parsedData = parseCSV();
  renderOverviewStackedChart(parsedData.data, 'all');
  renderCoralCyclesChart(parsedData.data);
  renderAlgaeCyclesChart(parsedData.data);
}


document.addEventListener('DOMContentLoaded', function () {
  try {
    const overviewCanvas = document.getElementById('overviewStackedChart');
    const coralCanvas = document.getElementById('coralCyclesChart');
    const algaeCanvas = document.getElementById('algaeCyclesChart');
    if (!overviewCanvas || !coralCanvas || !algaeCanvas) return;

    const parsed = parseCSV();
    const data = (parsed && parsed.data) ? parsed.data : [];

    if (!data || data.length === 0) {
      renderBlankChart('overviewStackedChart', 'No Data');
      renderBlankChart('coralCyclesChart', 'No Data');
      renderBlankChart('algaeCyclesChart', 'No Data');
    } else {
      renderOverviewStackedChart(data, 'all');
      renderCoralCyclesChart(data);
      renderAlgaeCyclesChart(data);
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
  const teamExists = data.some(row => row['Team No.'] === teamNumber);

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
  const parsed = Papa.parse(csvText, { header: true }).data;
  const selectedFilters = Array.from(document.querySelectorAll('#filterCheckboxesContainer input[type="checkbox"]:checked')).map(cb => cb.value);
  const sortBy = document.getElementById('filterTeamsDropdown').value;

  const teamMap = {};
  const hasDeepClimbFilter = selectedFilters.includes('deepClimb');
  const hasShallowClimbFilter = selectedFilters.includes('shallowClimb');
  const hasBothClimbFilters = hasDeepClimbFilter && hasShallowClimbFilter;

  parsed.forEach(row => {
    const team = row['Team No.'];
    if (!team) return;
    if (!showHiddenTeamsInFilter && hiddenTeams.includes(team)) return;

    if (!teamMap[team]) {
      teamMap[team] = {
        matches: [],
        epaTotal: 0,
        matchCount: 0,
        coralCycles: [],
        algaeNetCycles: [],
        flags: new Set()
      };
    }

    const teleCoral =
      (parseInt(row['L1'] || 0)) +
      (parseInt(row['L2'] || 0)) +
      (parseInt(row['L3'] || 0)) +
      (parseInt(row['L4'] || 0));

    const teleAlgaeNet = parseInt(row['Algae in Net'] || 0);
    const totalScore = parseFloat(row['Total Score'] || 0);

    teamMap[team].matches.push(row);
    teamMap[team].epaTotal += totalScore;
    teamMap[team].matchCount++;
    teamMap[team].coralCycles.push(teleCoral);
    teamMap[team].algaeNetCycles.push(teleAlgaeNet);

    if (row['Auton Starting Position'] === 'c') teamMap[team].flags.add('centerAuto');
    if (parseInt(row['Auton L1'] || 0) > 0 || parseInt(row['L1'] || 0) > 0) teamMap[team].flags.add('L1');
    if (parseInt(row['Auton L2'] || 0) > 0 || parseInt(row['L2'] || 0) > 0) teamMap[team].flags.add('L2');
    if (parseInt(row['Auton L3'] || 0) > 0 || parseInt(row['L3'] || 0) > 0) teamMap[team].flags.add('L3');
    if (parseInt(row['Auton L4'] || 0) > 0 || parseInt(row['L4'] || 0) > 0) teamMap[team].flags.add('L4');
    if (parseInt(row['Auton Algae Removed'] || 0) > 0 || parseInt(row['Algae removed'] || 0) > 0) teamMap[team].flags.add('RemoveAlgae');
    if (parseInt(row['Auton Algae in Net'] || 0) > 0 || parseInt(row['Algae in Net'] || 0) > 0) teamMap[team].flags.add('BargeAlgae');
    if (parseInt(row['Auton Algae in Processor'] || 0) > 0 || parseInt(row['Algae in Processor'] || 0) > 0) teamMap[team].flags.add('ProcessorAlgae');
    if (parseFloat(row['Defense Rating'] || 0) > 0) teamMap[team].flags.add('defense');
    if (parseFloat(row['Climb Score'] || 0) === 12) teamMap[team].flags.add('deepClimb');
    if (parseFloat(row['Climb Score'] || 0) === 6) teamMap[team].flags.add('shallowClimb');
  });

  pitScoutingData.forEach(row => {
    const team = row['Team No.'];
    if (!showHiddenTeamsInFilter && hiddenTeams.includes(team)) return;
    if (!teamMap[team]) return;

    if (row['Ground Barge']) teamMap[team].flags.add('groundBarge');
    if (row['Ground Processor']) teamMap[team].flags.add('groundProcessor');
    if (typeof row['Drivetrain'] === 'string' && row['Drivetrain'].toLowerCase().includes('swerve')) {
      teamMap[team].flags.add('swerve');
    }
  });

  const allTeams = Object.entries(teamMap).map(([team, data]) => {
    const avgEPA = (data.epaTotal / data.matchCount).toFixed(1);
    const avgCoral = (data.coralCycles.reduce((a, b) => a + b, 0) / data.matchCount).toFixed(1);
    const maxCoral = Math.max(...data.coralCycles);
    const avgBarge = (data.algaeNetCycles.reduce((a, b) => a + b, 0) / data.matchCount).toFixed(1);
    const maxBarge = Math.max(...data.algaeNetCycles);

    return {
      team,
      avgEPA,
      avgCoral,
      maxCoral,
      avgBarge,
      maxBarge,
      flags: data.flags,
      isHidden: hiddenTeams.includes(team)
    };
  });

  const passed = allTeams.filter(team => {
    const climbPassed = hasBothClimbFilters
      ? (team.flags.has('deepClimb') || team.flags.has('shallowClimb'))
      : selectedFilters.every(f => {
        if (f === 'deepClimb' || f === 'shallowClimb') {
          return team.flags.has(f);
        }
        return true;
      });

    const othersPassed = selectedFilters
      .filter(f => f !== 'deepClimb' && f !== 'shallowClimb')
      .every(f => team.flags.has(f));

    return climbPassed && othersPassed;
  });

  const filteredIn = passed;
  const filteredOut = allTeams.filter(team => !passed.includes(team));

  let sortFn;
  switch (sortBy) {
    case 'EPA': sortFn = (a, b) => b.avgEPA - a.avgEPA; break;
    case 'avgCoral': sortFn = (a, b) => b.avgCoral - a.avgCoral || b.avgEPA - a.avgEPA; break;
    case 'maxCoral': sortFn = (a, b) => b.maxCoral - a.maxCoral || b.avgCoral - a.avgCoral; break;
    case 'avgBarge': sortFn = (a, b) => b.avgBarge - a.avgBarge || b.avgEPA - a.avgEPA; break;
    case 'maxBarge': sortFn = (a, b) => b.maxBarge - a.maxBarge || b.avgBarge - a.avgBarge; break;
    default: sortFn = (a, b) => b.avgEPA - a.avgEPA;
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
    labelIn.style.fontWeight = 'bold';
    labelIn.style.fontFamily = 'Lato';
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
      case 'EPA': metricValue = team.avgEPA; metricLabel = 'EPA'; break;
      case 'avgCoral': metricValue = team.avgCoral; metricLabel = 'Avg Coral'; break;
      case 'maxCoral': metricValue = team.maxCoral; metricLabel = 'Max Coral'; break;
      case 'avgBarge': metricValue = team.avgBarge; metricLabel = 'Avg Barge'; break;
      case 'maxBarge': metricValue = team.maxBarge; metricLabel = 'Max Barge'; break;
      default: metricValue = team.avgEPA; metricLabel = 'EPA';
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

function renderMatchPredictor() {

  const matchNumberInput = document.getElementById('matchNumberInput');
  const matchNumber = matchNumberInput.value.trim();
  const teamInputs = [
    document.getElementById('redTeam1'),
    document.getElementById('redTeam2'),
    document.getElementById('redTeam3'),
    document.getElementById('blueTeam1'),
    document.getElementById('blueTeam2'),
    document.getElementById('blueTeam3')
  ];

  if (matchNumber) {
    const scheduleData = parseScheduleCSV().data;
    if (scheduleData && scheduleData.length > 0) {
      const match = scheduleData.find(row =>
        String(row.Match).trim().replace(/^0+/, '') === matchNumber.replace(/^0+/, '')
      );
      if (match) {
        teamInputs[0].value = match['Red 1'] || '';
        teamInputs[1].value = match['Red 2'] || '';
        teamInputs[2].value = match['Red 3'] || '';
        teamInputs[3].value = match['Blue 1'] || '';
        teamInputs[4].value = match['Blue 2'] || '';
        teamInputs[5].value = match['Blue 3'] || '';
      }
    }
  }

  ['redTeam1', 'redTeam2', 'redTeam3', 'blueTeam1', 'blueTeam2', 'blueTeam3'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', function () {
        document.getElementById('matchNumberInput').value = '';
      });
    }
  });

  const redTeams = [];
  const blueTeams = [];

  document.getElementById('matchPredictionResult').innerHTML = '';
  document.getElementById('matchStatsTable').innerHTML = '';

  for (let i = 1; i <= 3; i++) {
    const redTeam = document.getElementById(`redTeam${i}`).value.trim();
    const blueTeam = document.getElementById(`blueTeam${i}`).value.trim();

    if (redTeam) redTeams.push(redTeam);
    if (blueTeam) blueTeams.push(blueTeam);
  }

  renderMatchSummaryTable(redTeams, blueTeams);

  if (redTeams.length === 0 && blueTeams.length === 0) return;

  const parsedData = parseCSV().data;
  const allTeams = [...redTeams, ...blueTeams];

  const teamStats = {};

  allTeams.forEach(team => {
    const teamData = parsedData.filter(row => row['Team No.'] === team);
    if (teamData.length === 0) return;

    const stats = {
      auto: {
        modes: {},
        mostCommon: null,
        mostCommonStats: null
      },
      tele: {
        L1: 0, L2: 0, L3: 0, L4: 0,
        barge: 0, processor: 0, removed: 0
      },
      endgame: {
        deepClimb: 0,
        shallowClimb: 0,
        deepAttempts: 0,
        shallowAttempts: 0,
        deepClimbRate: '-',
        shallowClimbRate: '-'
      },
      epa: 0,
      matches: teamData.length
    };

    teamData.forEach(row => {
      const autoRun = {
        L1: parseInt(row['Auton L1'] || 0),
        L2: parseInt(row['Auton L2'] || 0),
        L3: parseInt(row['Auton L3'] || 0),
        L4: parseInt(row['Auton L4'] || 0),
        barge: parseInt(row['Auton Algae in Net'] || 0),
        processor: parseInt(row['Auton Algae in Processor'] || 0),
        removed: parseInt(row['Auton Algae Removed'] || 0),
        score: parseInt(row['Auton Score'] || 0)
      };

      const runKey = `${autoRun.L1}-${autoRun.L2}-${autoRun.L3}-${autoRun.L4}`;

      if (!stats.auto.modes[runKey]) {
        stats.auto.modes[runKey] = {
          count: 0,
          run: autoRun
        };
      }
      stats.auto.modes[runKey].count++;
    });

    let maxCount = 0;
    let bestScore = 0;
    let mostCommonRun = null;

    Object.values(stats.auto.modes).forEach(mode => {
      if (mode.count > maxCount ||
        (mode.count === maxCount && mode.run.score > bestScore)) {
        maxCount = mode.count;
        bestScore = mode.run.score;
        mostCommonRun = mode.run;
      }
    });

    if (mostCommonRun) {
      stats.auto.mostCommonStats = {
        L1: mostCommonRun.L1,
        L2: mostCommonRun.L2,
        L3: mostCommonRun.L3,
        L4: mostCommonRun.L4,
        barge: mostCommonRun.barge,
        processor: mostCommonRun.processor,
        removed: mostCommonRun.removed
      };
    }

    teamData.forEach(row => {
      stats.tele.L1 += parseInt(row['L1'] || 0);
      stats.tele.L2 += parseInt(row['L2'] || 0);
      stats.tele.L3 += parseInt(row['L3'] || 0);
      stats.tele.L4 += parseInt(row['L4'] || 0);
      stats.tele.barge += parseInt(row['Algae in Net'] || 0);
      stats.tele.processor += parseInt(row['Algae in Processor'] || 0);
      stats.tele.removed += parseInt(row['Algae removed'] || 0);

      const climbScore = parseFloat(row['Climb Score'] || 0);

      if (climbScore === 12 || climbScore === 2.1) {
        stats.endgame.deepAttempts++;
        if (climbScore === 12) stats.endgame.deepClimb++;
      }

      if (climbScore === 6 || climbScore === 2.1) {
        stats.endgame.shallowAttempts++;
        if (climbScore === 6) stats.endgame.shallowClimb++;
      }

      stats.epa += parseFloat(row['Total Score'] || 0);
    });

    if (stats.matches > 0) {
      stats.tele.L1 = (stats.tele.L1 / stats.matches).toFixed(1);
      stats.tele.L2 = (stats.tele.L2 / stats.matches).toFixed(1);
      stats.tele.L3 = (stats.tele.L3 / stats.matches).toFixed(1);
      stats.tele.L4 = (stats.tele.L4 / stats.matches).toFixed(1);
      stats.tele.barge = (stats.tele.barge / stats.matches).toFixed(1);
      stats.tele.processor = (stats.tele.processor / stats.matches).toFixed(1);
      stats.tele.removed = (stats.tele.removed / stats.matches).toFixed(1);

      if (stats.endgame.deepAttempts > 0) {
        const rate = (stats.endgame.deepClimb / stats.endgame.deepAttempts * 100);
        stats.endgame.deepClimbRate = rate === 0 ? '-' : rate.toFixed(1) + '%';
      }
      if (stats.endgame.shallowAttempts > 0) {
        const rate = (stats.endgame.shallowClimb / stats.endgame.shallowAttempts * 100);
        stats.endgame.shallowClimbRate = rate === 0 ? '-' : rate.toFixed(1) + '%';
      }

      stats.epa = (stats.epa / stats.matches).toFixed(1);
    }

    teamStats[team] = stats;
  });

  let redEPA = 0, blueEPA = 0;

  redTeams.forEach(team => {
    if (teamStats[team]) redEPA += parseFloat(teamStats[team].epa);
  });

  blueTeams.forEach(team => {
    if (teamStats[team]) blueEPA += parseFloat(teamStats[team].epa);
  });

  const resultDiv = document.getElementById('matchPredictionResult');
  const isTie = redEPA === blueEPA;
  const redWins = redEPA > blueEPA;

  resultDiv.innerHTML = `
  <div class="alliance-prediction" style="flex: 1; text-align: center; padding: 15px; 
        border-radius: 8px; ${isTie
      ? 'background-color: #FFD70030; border: 2px solid #FFD700;'
      : redWins
        ? 'background-color: #ff5c5c30; border: 2px solid #ff5c5c;'
        : ''
    }">
    <h3 style="margin: 0 0 10px 0; color: ${redWins ? '#ff5c5c' : isTie ? '#FFD700' : 'white'};">Red Alliance</h3>
    <p style="margin: 5px 0;">${redTeams.join(', ')}</p>
    <p class="epa-total" style="font-size: 24px; font-weight: bold; margin: 10px 0 0 0; 
          color: ${redWins ? '#ff5c5c' : isTie ? '#FFD700' : 'white'};">${redEPA.toFixed(1)} EPA</p>
  </div>
  <div class="vs-divider" style="font-size: 24px; font-weight: bold; color: white;">VS</div>
  <div class="alliance-prediction" style="flex: 1; text-align: center; padding: 15px; 
        border-radius: 8px; ${isTie
      ? 'background-color: #FFD70030; border: 2px solid #FFD700;'
      : !redWins
        ? 'background-color: #3EDBF030; border: 2px solid #3EDBF0;'
        : ''
    }">
<h3 style="margin: 0 0 10px 0; color: ${isTie ? '#FFD700' : !redWins ? '#3EDBF0' : 'white'};">Blue Alliance</h3>
    <p style="margin: 5px 0;">${blueTeams.join(', ')}</p>
  <p class="epa-total" style="font-size: 24px; font-weight: bold; margin: 10px 0 0 0; 
      color: ${isTie ? '#FFD700' : !redWins ? '#3EDBF0' : 'white'};">${blueEPA.toFixed(1)} EPA</p>
  </div>
`;

  const table = document.getElementById('matchStatsTable');
  table.innerHTML = '';

  const headerRow = document.createElement('tr');
  headerRow.innerHTML = `
    <th style="background-color: #1C1E21; color: white; text-align: center; padding: 8px; width: 150px;">Stat</th>
    ${redTeams.map(team => `
      <th style="background-color: #ff5c5c30; color: white; padding: 8px; text-align: center; min-width: 80px;">
        ${team}
      </th>
    `).join('')}
    ${blueTeams.map(team => `
      <th style="background-color: #3EDBF030; color: white; padding: 8px; text-align: center; min-width: 80px;">
        ${team}
      </th>
    `).join('')}
  `;
  table.appendChild(headerRow);

  const autoHeader = document.createElement('tr');
  autoHeader.innerHTML = `
    <td colspan="${redTeams.length + blueTeams.length + 1}" 
        style="background-color: #2a2d31; color: white; font-weight: bold; padding: 8px;">
      Autonomous (Most Common Run)
    </td>
  `;
  table.appendChild(autoHeader);

  ['L1', 'L2', 'L3', 'L4'].forEach(level => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="background-color: #1C1E21; color: white; padding: 8px; text-align: left;">Auto ${level}</td>
      ${redTeams.map(team => `
        <td style="background-color: #ff5c5c30; color: white; padding: 8px; text-align: center;">
          ${teamStats[team]?.auto.mostCommonStats ? teamStats[team].auto.mostCommonStats[level] : '0'}
        </td>
      `).join('')}
      ${blueTeams.map(team => `
        <td style="background-color: #3EDBF030; color: white; padding: 8px; text-align: center;">
          ${teamStats[team]?.auto.mostCommonStats ? teamStats[team].auto.mostCommonStats[level] : '0'}
        </td>
      `).join('')}
    `;
    table.appendChild(row);
  });

  ['Barge', 'Processor', 'Removed'].forEach(type => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="background-color: #1C1E21; color: white; padding: 8px; text-align: left;">Auto ${type}</td>
      ${redTeams.map(team => `
        <td style="background-color: #ff5c5c30; color: white; padding: 8px; text-align: center;">
          ${teamStats[team]?.auto.mostCommonStats ? teamStats[team].auto.mostCommonStats[type.toLowerCase()] : '0'}
        </td>
      `).join('')}
      ${blueTeams.map(team => `
        <td style="background-color: #3EDBF030; color: white; padding: 8px; text-align: center;">
          ${teamStats[team]?.auto.mostCommonStats ? teamStats[team].auto.mostCommonStats[type.toLowerCase()] : '0'}
        </td>
      `).join('')}
    `;
    table.appendChild(row);
  });

  const teleHeader = document.createElement('tr');
  teleHeader.innerHTML = `
    <td colspan="${redTeams.length + blueTeams.length + 1}" 
        style="background-color: #2a2d31; color: white; font-weight: bold; padding: 8px;">
      TeleOp (Averages)
    </td>
  `;
  table.appendChild(teleHeader);

  ['L1', 'L2', 'L3', 'L4'].forEach(level => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="background-color: #1C1E21; color: white; padding: 8px; text-align: left;">Tele ${level}</td>
      ${redTeams.map(team => `
        <td style="background-color: #ff5c5c30; color: white; padding: 8px; text-align: center;">
          ${teamStats[team]?.tele[level] || '0.0'}
        </td>
      `).join('')}
      ${blueTeams.map(team => `
        <td style="background-color: #3EDBF030; color: white; padding: 8px; text-align: center;">
          ${teamStats[team]?.tele[level] || '0.0'}
        </td>
      `).join('')}
    `;
    table.appendChild(row);
  });

  ['Barge', 'Processor', 'Removed'].forEach(type => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="background-color: #1C1E21; color: white; padding: 8px; text-align: left;">Tele ${type}</td>
      ${redTeams.map(team => `
        <td style="background-color: #ff5c5c30; color: white; padding: 8px; text-align: center;">
          ${teamStats[team]?.tele[type.toLowerCase()] || '0.0'}
        </td>
      `).join('')}
      ${blueTeams.map(team => `
        <td style="background-color: #3EDBF030; color: white; padding: 8px; text-align: center;">
          ${teamStats[team]?.tele[type.toLowerCase()] || '0.0'}
        </td>
      `).join('')}
    `;
    table.appendChild(row);
  });

  const endgameHeader = document.createElement('tr');
  endgameHeader.innerHTML = `
    <td colspan="${redTeams.length + blueTeams.length + 1}" 
        style="background-color: #2a2d31; color: white; font-weight: bold; padding: 8px;">
      End Game
    </td>
  `;
  table.appendChild(endgameHeader);

  const deepClimbRow = document.createElement('tr');
  deepClimbRow.innerHTML = `
    <td style="background-color: #1C1E21; color: white; padding: 8px; text-align: left;">Deep Climb</td>
    ${redTeams.map(team => `
      <td style="background-color: #ff5c5c30; color: white; padding: 8px; text-align: center;">
        ${teamStats[team]?.endgame.deepClimbRate || '-'}
      </td>
    `).join('')}
    ${blueTeams.map(team => `
      <td style="background-color: #3EDBF030; color: white; padding: 8px; text-align: center;">
        ${teamStats[team]?.endgame.deepClimbRate || '-'}
      </td>
    `).join('')}
  `;
  table.appendChild(deepClimbRow);

  const shallowClimbRow = document.createElement('tr');
  shallowClimbRow.innerHTML = `
    <td style="background-color: #1C1E21; color: white; padding: 8px; text-align: left;">Shallow Climb</td>
    ${redTeams.map(team => `
      <td style="background-color: #ff5c5c30; color: white; padding: 8px; text-align: center;">
        ${teamStats[team]?.endgame.shallowClimbRate || '-'}
      </td>
    `).join('')}
    ${blueTeams.map(team => `
      <td style="background-color: #3EDBF030; color: white; padding: 8px; text-align: center;">
        ${teamStats[team]?.endgame.shallowClimbRate || '-'}
      </td>
    `).join('')}
  `;
  table.appendChild(shallowClimbRow);

  const epaRow = document.createElement('tr');
  epaRow.innerHTML = `
    <td style="background-color: #1C1E21; color: white; font-weight: bold; padding: 8px; text-align: left;">EPA</td>
    ${redTeams.map(team => `
      <td style="background-color: #ff5c5c30; color: white; font-weight: bold; padding: 8px; text-align: center;">
        ${teamStats[team]?.epa || '0.0'}
      </td>
    `).join('')}
    ${blueTeams.map(team => `
      <td style="background-color: #3EDBF030; color: white; font-weight: bold; padding: 8px; text-align: center;">
        ${teamStats[team]?.epa || '0.0'}
      </td>
    `).join('')}
  `;
  table.appendChild(epaRow);

  updateAllianceCompareTable(redTeams, blueTeams);
}

function updateAllianceCompareTable(redTeams, blueTeams) {
  const table = document.getElementById('allianceCompareTable');
  if (!table) return;

  table.style.border = "2px solid #444";
  table.style.borderRadius = "8px";
  table.style.overflow = "hidden";

  const headerRow = document.createElement('tr');
  headerRow.innerHTML = `
    <th style="background-color: #1C1E21; color: white; text-align: center; padding: 8px; width: 180px; border-bottom: 2px solid #444;">Stat</th>
    ${redTeams.map(team => `
      <th style="background-color: #ff5c5c30; color: white; padding: 8px; text-align: center; min-width: 80px; border-bottom: 2px solid #444; border-left: 1px solid #333;">
        ${team}
      </th>
    `).join('')}
    <th style="background-color: #ffb6e630; color: white; padding: 8px; text-align: center; min-width: 80px; border-bottom: 2px solid #444; border-left: 1px solid #333; font-weight:bold;">
      Red Total
    </th>
    <th style="background-color: #b6a6ff30; color: white; padding: 8px; text-align: center; min-width: 80px; border-bottom: 2px solid #444; border-left: 1px solid #333; font-weight:bold;">
      Blue Total
    </th>
    ${blueTeams.map(team => `
      <th style="background-color: #3EDBF030; color: white; padding: 8px; text-align: center; min-width: 80px; border-bottom: 2px solid #444; border-left: 1px solid #333;">
        ${team}
      </th>
    `).join('')}
  `;

  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';
  thead.appendChild(headerRow);

  const parsedData = parseCSV().data;
  function getTeamRows(team) {
    return parsedData.filter(row => row['Team No.'] === team);
  }
  function avg(rows, key) {
    const vals = rows.map(r => parseFloat(r[key] || 0)).filter(v => !isNaN(v));
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '-';
  }
  function sum(rows, key) {
    const vals = rows.map(r => parseFloat(r[key] || 0)).filter(v => !isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) : '-';
  }
  function max(rows, key) {
    const vals = rows.map(r => parseFloat(r[key] || 0)).filter(v => !isNaN(v));
    return vals.length ? Math.max(...vals) : '-';
  }
  function count(rows, key) {
    return rows.filter(r => r[key] !== undefined && r[key] !== '').length;
  }

  const statDefs = [
    { label: "Avg Total Points", fn: rows => avg(rows, 'Total Score') },
    { label: "Avg Auto Points", fn: rows => avg(rows, 'Auton Score') },
    { label: "Avg TeleOp Points", fn: rows => avg(rows, 'Teleop Score') },
    { label: "Avg Climb Points", fn: rows => avg(rows, 'Climb Score') },
    { label: "Avg Auto L4", fn: rows => avg(rows, 'Auton L4') },
    { label: "Avg Leave", fn: rows => avg(rows, 'Auton Leave starting line') },
    { label: "Avg L4", fn: rows => avg(rows, 'L4') },
    { label: "Avg L3", fn: rows => avg(rows, 'L3') },
    { label: "Avg L2", fn: rows => avg(rows, 'L2') },
    { label: "Avg L1", fn: rows => avg(rows, 'L1') },
    {
      label: "Avg Coral Cycles", fn: rows => {
        const vals = rows.map(r =>
          (parseInt(r['L1'] || 0)) +
          (parseInt(r['L2'] || 0)) +
          (parseInt(r['L3'] || 0)) +
          (parseInt(r['L4'] || 0))
        );
        return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '-';
      }
    },
    {
      label: "Avg A+T L4", fn: rows => {
        const vals = rows.map(r =>
          (parseInt(r['Auton L4'] || 0)) +
          (parseInt(r['L4'] || 0))
        );
        return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '-';
      }
    },
    { label: "Avg Algae Remove", fn: rows => avg(rows, 'Algae removed') },
    { label: "Avg Alg in Processor", fn: rows => avg(rows, 'Algae in Processor') },
    { label: "Avg Alg in Net", fn: rows => avg(rows, 'Algae in Net') },
    { label: "Max Alg in Net", fn: rows => max(rows, 'Algae in Net') },
    {
      label: "Avg Alg Cycles", fn: rows => {
        const vals = rows.map(r =>
          (parseInt(r['Algae in Net'] || 0)) +
          (parseInt(r['Algae in Processor'] || 0))
        );
        return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '-';
      }
    },
    {
      label: "Attempted Climbs", fn: rows => {
        return rows.filter(r => {
          const v = parseFloat(r['Climb Score'] || 0);
          return v === 12 || v === 6 || v === 2.1;
        }).length;
      }
    },
    {
      label: "Successful Climbs", fn: rows => {
        return rows.filter(r => {
          const v = parseFloat(r['Climb Score'] || 0);
          return v === 12 || v === 6;
        }).length;
      }
    },
    {
      label: "Climb Rate", fn: rows => {
        const attempts = rows.filter(r => {
          const v = parseFloat(r['Climb Score'] || 0);
          return v === 12 || v === 6 || v === 2.1;
        }).length;
        const successes = rows.filter(r => {
          const v = parseFloat(r['Climb Score'] || 0);
          return v === 12 || v === 6;
        }).length;
        return attempts > 0 ? ((successes / attempts) * 100).toFixed(1) + "%" : "-";
      }
    },
    { label: "Avg Driver Skill", fn: rows => avg(rows, 'Driver skill') },
    { label: "Defense Count", fn: rows => count(rows, 'Defense Rating') },
    { label: "Max Def. Rating", fn: rows => max(rows, 'Defense Rating') },
    { label: "SUM of Immobolized", fn: rows => sum(rows, 'Died or Immobilized') }
  ];

  statDefs.forEach((stat, idx) => {
    const borderStyle = "border-bottom: 1px solid #333;";
    const statCell = `<td style="background-color: #1C1E21; color: white; padding: 8px; text-align: left; width: 180px; ${borderStyle}">${stat.label}</td>`;
    const redCells = redTeams.map((team, i) => {
      const bgColor = idx % 2 === 0 ? "#ff5c5c30" : "#ff7b7b30";
      return `<td style="background-color: ${bgColor}; color: white; padding: 8px; text-align: center; ${borderStyle} border-left: 1px solid #333;">${team ? stat.fn(getTeamRows(team)) : '-'}</td>`;
    }).join('');
    const redTotalBg = idx % 2 === 0 ? "#ff83fa30" : "#ffb6e630";
    const redTotal = (() => {
      const vals = redTeams.map(team => {
        const rows = getTeamRows(team);
        const v = stat.fn(rows);
        return isNaN(parseFloat(v)) ? 0 : parseFloat(v);
      }).filter(v => typeof v === 'number' && !isNaN(v));
      if (typeof stat.fn(getTeamRows(redTeams[0])) === 'string' && stat.fn(getTeamRows(redTeams[0])).includes('%')) {
        return '-';
      }
      return vals.length ? vals.reduce((a, b) => a + b, 0).toFixed(2) : '-';
    })();
    const redTotalCell = `<td style="background-color: ${redTotalBg}; color: white; padding: 8px; text-align: center; font-weight:bold; ${borderStyle} border-left: 1px solid #333;">${redTotal}</td>`;

    const blueTotalBg = idx % 2 === 0 ? "#b083ff30" : "#b6a6ff30";
    const blueTotal = (() => {
      const vals = blueTeams.map(team => {
        const rows = getTeamRows(team);
        const v = stat.fn(rows);
        return isNaN(parseFloat(v)) ? 0 : parseFloat(v);
      }).filter(v => typeof v === 'number' && !isNaN(v));
      if (typeof stat.fn(getTeamRows(blueTeams[0])) === 'string' && stat.fn(getTeamRows(blueTeams[0])).includes('%')) {
        return '-';
      }
      return vals.length ? vals.reduce((a, b) => a + b, 0).toFixed(2) : '-';
    })();
    const blueTotalCell = `<td style="background-color: ${blueTotalBg}; color: white; padding: 8px; text-align: center; font-weight:bold; ${borderStyle} border-left: 1px solid #333;">${blueTotal}</td>`; const blueTotalColor = idx % 2 === 0 ? "#8105d8" : "#cf8ffc";


    const blueCells = blueTeams.map((team, i) => {
      const bgColor = idx % 2 === 0 ? "#3EDBF030" : "#5cf0ff30";
      return `<td style="background-color: ${bgColor}; color: white; padding: 8px; text-align: center; ${borderStyle} border-left: 1px solid #333;">${team ? stat.fn(getTeamRows(team)) : '-'}</td>`;
    }).join('');

    const row = document.createElement('tr');
    row.innerHTML = statCell + redCells + redTotalCell + blueTotalCell + blueCells;
    tbody.appendChild(row);
  });
}

function createStatsTable(redTeams, blueTeams, teamStats) {
  const table = document.getElementById('matchStatsTable');
  table.innerHTML = '';

  const headerRow = document.createElement('tr');
  headerRow.innerHTML = `
  <th style="background-color: #1C1E21; color: white; text-align: center; padding: 8px; width: 180px; border-bottom: 2px solid #444;">Stat</th>
  ${redTeams.map(team => `
    <th style="background-color: #ff5c5c30; color: white; padding: 8px; text-align: center; min-width: 80px; border-bottom: 2px solid #444; border-left: 1px solid #333;">
      ${team}
    </th>
  `).join('')}
  <th style="background-color: #ffb6e630; color: white; padding: 8px; text-align: center; min-width: 80px; border-bottom: 2px solid #444; border-left: 1px solid #333; font-weight:bold;">
    Red Total
  </th>
  <th style="background-color: #b6a6ff30; color: white; padding: 8px; text-align: center; min-width: 80px; border-bottom: 2px solid #444; border-left: 1px solid #333; font-weight:bold;">
    Blue Total
  </th>
  ${blueTeams.map(team => `
    <th style="background-color: #3EDBF030; color: white; padding: 8px; text-align: center; min-width: 80px; border-bottom: 2px solid #444; border-left: 1px solid #333;">
      ${team}
    </th>
  `).join('')}
`;
  table.appendChild(headerRow);

  addStatRows('Autonomous', [
    'Auto L1', 'Auto L2', 'Auto L3', 'Auto L4',
    'Auto Barge', 'Auto Processor'
  ], 'auto', table, redTeams, blueTeams, teamStats);

  addStatRows('TeleOp', [
    'Tele L1', 'Tele L2', 'Tele L3', 'Tele L4',
    'Tele Barge', 'Tele Processor'
  ], 'tele', table, redTeams, blueTeams, teamStats);

  addStatRows('End Game', [
    'Deep Climb', 'Shallow Climb'
  ], 'endgame', table, redTeams, blueTeams, teamStats);

  const epaRow = document.createElement('tr');
  epaRow.innerHTML = `
    <td style="background-color: #1C1E21; color: white; font-weight: bold; padding: 8px;">EPA</td>
    ${redTeams.map(team => `<td style="padding: 8px;">${teamStats[team]?.epa || 'N/A'}</td>`).join('')}
    ${blueTeams.map(team => `<td style="padding: 8px;">${teamStats[team]?.epa || 'N/A'}</td>`).join('')}
  `;
  table.appendChild(epaRow);
}

function addStatRows(category, stats, statType, table, redTeams, blueTeams, teamStats) {
  const categoryRow = document.createElement('tr');
  categoryRow.innerHTML = `
    <td colspan="${redTeams.length + blueTeams.length + 1}" 
        style="background-color: #2a2d31; color: white; font-weight: bold; padding: 8px;">
      ${category}
    </td>
  `;
  table.appendChild(categoryRow);

  stats.forEach(stat => {
    const statKey = stat.toLowerCase().replace(' ', '');
    const row = document.createElement('tr');

    row.innerHTML = `
      <td style="background-color: #1C1E21; color: white; padding: 8px;">${stat}</td>
      ${redTeams.map(team => `
        <td style="background-color: #ff5c5c30; color: white; padding: 8px;">
          ${teamStats[team]?.[statType]?.[statKey] || 'N/A'}
        </td>
      `).join('')}
      ${blueTeams.map(team => `
        <td style="background-color: #3EDBF030; color: white; padding: 8px;">
          ${teamStats[team]?.[statType]?.[statKey] || 'N/A'}
        </td>
      `).join('')}
    `;

    table.appendChild(row);
  });
}

function addStatRows(category, stats, statType, table, redTeams, blueTeams, teamStats) {
  const categoryRow = document.createElement('tr');
  categoryRow.innerHTML = `
    <td colspan="${redTeams.length + blueTeams.length + 1}" 
        style="background-color: #2a2d31; color: white; font-weight: bold; padding: 8px;">
      ${category}
    </td>
  `;
  table.appendChild(categoryRow);

  stats.forEach(stat => {
    const statKey = stat.toLowerCase().replace(' ', '');
    const row = document.createElement('tr');

    row.innerHTML = `
      <td style="background-color: #1C1E21; color: white; padding: 8px;">${stat}</td>
      ${redTeams.map(team => `
        <td style="background-color: #ff5c5c30; color: white;">
          ${teamStats[team]?.[statType]?.[statKey] || 'N/A'}
        </td>
      `).join('')}
      ${blueTeams.map(team => `
        <td style="background-color: #3EDBF030; color: white;">
          ${teamStats[team]?.[statType]?.[statKey] || 'N/A'}
        </td>
      `).join('')}
    `;

    table.appendChild(row);
  });
}

function toggleStatsTable() {
  const container = document.getElementById('matchStatsTableContainer');
  const arrow = document.getElementById('statsToggleArrow');
  const isExpanded = container.classList.toggle('expanded');
  arrow.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
}

function toggleMatchSummaryTable() {
  const container = document.getElementById('matchSummaryTableContainer');
  const arrow = document.getElementById('matchSummaryToggleArrow');
  const isExpanded = container.classList.toggle('expanded');
  arrow.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
}

function toggleAllianceCompareTable() {
  const container = document.getElementById('allianceCompareTableContainer');
  const arrow = document.getElementById('allianceCompareToggleArrow');
  const isOpen = container.style.display === 'block';
  if (isOpen) {
    container.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
  } else {
    container.style.display = 'block';
    arrow.style.transform = 'rotate(180deg)';
  }
}
document.addEventListener('DOMContentLoaded', function () {
  const container = document.getElementById('allianceCompareTableContainer');
  const arrow = document.getElementById('allianceCompareToggleArrow');
  if (container && arrow) {
    container.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
  }
});

function renderMatchSummaryTable(redTeams, blueTeams) {
  const parsedData = parseCSV().data;
  const tbody = document.getElementById('matchSummaryBody');
  tbody.innerHTML = '';

  const allTeams = [...redTeams, ...blueTeams];

  allTeams.forEach((team, index) => {
    const teamData = parsedData.filter(row => row['Team No.'] === team);
    if (teamData.length === 0) return;

    const stats = calculateTeamStatsForSummary(teamData);

    const levels = ['L4', 'L3', 'L2', 'L1'];
    const teleStats = levels.map(level => {
      const vals = teamData.map(row => parseInt(row[level] || 0));
      return {
        level,
        max: Math.max(...vals),
        avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
      };
    });

    const bargeVals = teamData.map(row => parseInt(row['Algae in Net'] || 0));
    const processorVals = teamData.map(row => parseInt(row['Algae in Processor'] || 0));
    const algaeVals = teamData.map(row =>
      (parseInt(row['Algae in Net'] || 0) || 0) +
      (parseInt(row['Algae in Processor'] || 0) || 0)
    ); const barge = { max: Math.max(...bargeVals), avg: (bargeVals.reduce((a, b) => a + b, 0) / bargeVals.length).toFixed(1) };
    const processor = { max: Math.max(...processorVals), avg: (processorVals.reduce((a, b) => a + b, 0) / processorVals.length).toFixed(1) };
    const algae = { max: Math.max(...algaeVals), avg: (algaeVals.reduce((a, b) => a + b, 0) / algaeVals.length).toFixed(1) };

    const diedMatches = teamData.filter(row => row['Died or Immobilized'] === '1').map(row => row['Match']);
    const diedPct = diedMatches.length > 0 ? ((diedMatches.length / teamData.length) * 100).toFixed(1) : null;

    let tooltipHTML = `
  <div class="custom-tooltip-content">
    <div class="tooltip-col">
      <div class="tooltip-header">Coral</div>
      <div class="tooltip-row"><b>L4:</b> ${teleStats[0].max} / ${teleStats[0].avg}</div>
      <div class="tooltip-row"><b>L3:</b> ${teleStats[1].max} / ${teleStats[1].avg}</div>
      <div class="tooltip-row"><b>L2:</b> ${teleStats[2].max} / ${teleStats[2].avg}</div>
      <div class="tooltip-row"><b>L1:</b> ${teleStats[3].max} / ${teleStats[3].avg}</div>
    </div>
    <div class="tooltip-col">
      <div class="tooltip-header">Algae</div>
      <div class="tooltip-row"><b>Barge:</b> ${barge.max} / ${barge.avg}</div>
      <div class="tooltip-row"><b>Processor:</b> ${processor.max} / ${processor.avg}</div>
      <div class="tooltip-row"><b>Algae:</b> ${algae.max} / ${algae.avg}</div>
    </div>
    ${diedPct ? `
    <div class="tooltip-col">
      <div class="tooltip-header">Died</div>
      <div class="tooltip-row"><b>Robot Died:</b> ${diedPct}%</div>
      <div class="tooltip-row"><b>Matches:</b> ${diedMatches.map(m => 'Q' + m).join(', ')}</div>
    </div>
    ` : ''}
  </div>
  <div style="width:100%;font-size:12px; font-family:Lato;color:#aaa;margin-top:10px;text-align:right;">
    * game pieces are shown as max / avg
  </div>
`;

    const row = document.createElement('tr');
    const hasDied = diedMatches.length > 0;
    const teamDisplay = hasDied ? `⚠️${team}⚠️` : team;
    const teamCellStyle = index < redTeams.length ?
      'background-color: #ff5c5c30;' : 'background-color: #3EDBF030;';

    row.innerHTML = `
            <td style="${teamCellStyle} padding: 8px; font-weight: bold; position:relative; cursor:pointer;">
                <span class="team-tooltip-trigger">${teamDisplay}
                    <span class="custom-tooltip" style="display:none; position:absolute; left:100%; top:0; z-index:10; background:#222; color:#fff; border-radius:8px; padding:12px; font-size:13px; box-shadow:0 2px 8px #000a;">
                        ${tooltipHTML}
                    </span>
                </span>
            </td>
            <td style="padding: 8px; text-align: center;">${stats.epa}</td>
            <td style="padding: 8px; text-align: center;">${stats.avgCycles}</td>
            <td style="padding: 8px; text-align: center;">${stats.mostCommonScoring}</td>
            <td style="padding: 8px; text-align: center;">${stats.secondCommonScoring}</td>
            <td style="padding: 8px; text-align: center;">${stats.canNet ? '✅' : '❌'}</td>
            <td style="padding: 8px; text-align: center;">${stats.canProcess ? '✅' : '❌'}</td>
            <td style="padding: 8px; text-align: center;">${stats.climbRate}</td>
            <td style="padding: 8px; text-align: center;">${stats.defenseRating}</td>
            <td style="padding: 8px; text-align: center;">${stats.defenseRank}</td>
        `;

    tbody.appendChild(row);
  });

  setTimeout(() => {
    document.querySelectorAll('.team-tooltip-trigger').forEach(trigger => {
      trigger.onmouseenter = (e) => {
        const tooltip = document.getElementById('global-tooltip');
        const customTooltip = trigger.querySelector('.custom-tooltip');
        tooltip.innerHTML = customTooltip.innerHTML;
        tooltip.style.display = 'block';

        const rect = trigger.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        let top = rect.bottom + 8;
        let left = rect.left;

        if (top + tooltipRect.height > window.innerHeight) {
          top = rect.top - tooltipRect.height - 8;
        }
        if (left + tooltipRect.width > window.innerWidth) {
          left = window.innerWidth - tooltipRect.width - 8;
        }
        if (left < 0) left = 8;
        if (top < 0) top = 8;

        tooltip.style.position = 'fixed';
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.zIndex = 99999;
      };
      trigger.onmouseleave = () => {
        const tooltip = document.getElementById('global-tooltip');
        tooltip.style.display = 'none';
      };
    });
  }, 0);
}

function calculateTeamStatsForSummary(teamData) {
  const totalEPA = teamData.reduce((sum, row) => sum + (parseFloat(row['Total Score']) || 0), 0);
  const avgEPA = (totalEPA / teamData.length).toFixed(1);

  const teleCycles = teamData.map(row =>
  (parseInt(row['L1'] || 0) +
    parseInt(row['L2'] || 0) +
    parseInt(row['L3'] || 0) +
    parseInt(row['L4'] || 0))
  );
  const avgCycles = (teleCycles.reduce((a, b) => a + b, 0) / teamData.length).toFixed(1);

  const scoringCounts = { L1: 0, L2: 0, L3: 0, L4: 0 };
  teamData.forEach(row => {
    if (parseInt(row['L1'] || 0) > 0) scoringCounts.L1++;
    if (parseInt(row['L2'] || 0) > 0) scoringCounts.L2++;
    if (parseInt(row['L3'] || 0) > 0) scoringCounts.L3++;
    if (parseInt(row['L4'] || 0) > 0) scoringCounts.L4++;
  });
  const sortedScoring = Object.entries(scoringCounts)
    .sort((a, b) => b[1] - a[1])
    .filter(entry => entry[1] > 0);
  const mostCommonScoring = sortedScoring.length > 0 ? sortedScoring[0][0] : 'N/A';
  const secondCommonScoring = sortedScoring.length > 1 ? sortedScoring[1][0] : 'N/A';

  const canNet = teamData.some(row => parseInt(row['Algae in Net'] || 0) > 0);
  const canProcess = teamData.some(row => parseInt(row['Algae in Processor'] || 0) > 0);

  const climbScores = teamData.map(row => parseFloat(row['Climb Score'] || 0));
  const successfulClimbs = climbScores.filter(score => score === 12 || score === 6).length;
  const climbAttempts = climbScores.filter(score => score === 12 || score === 6 || score === 2.1).length;
  const climbRate = climbAttempts > 0 ?
    ((successfulClimbs / climbAttempts) * 100).toFixed(1) + '%' : 'N/A';

  let defenseRank = 'N/A';
  try {
    const parsed = parseCSV();
    const data = parsed.data;
    const matches = {};
    const teamMatches = {};
    const robotDiedMap = {};

    data.forEach(row => {
      const match = row['Match'];
      const teamNumber = row['Team No.'];
      const died = row['Died or Immobilized'] === '1';
      if (match && teamNumber) {
        if (!robotDiedMap[match]) robotDiedMap[match] = new Set();
        if (died) robotDiedMap[match].add(teamNumber);
      }
    });

    data.forEach(row => {
      const match = row['Match'];
      const teamNumber = row['Team No.'];
      const robotColor = row['Robot Color'];
      const totalScore = parseFloat(row['Total Score']) || 0;
      if (!match || !teamNumber || !robotColor) return;
      if (!matches[match]) matches[match] = { red: [], blue: [] };
      const alliance = robotColor.toLowerCase().startsWith('red') ? 'red' : 'blue';
      matches[match][alliance].push({ teamNumber, totalScore });
      if (!teamMatches[teamNumber]) teamMatches[teamNumber] = [];
      teamMatches[teamNumber].push({ match, alliance, totalScore });
    });

    const allianceEPAs = {};
    const teamDefenseImpact = {};
    const defenseMatchCount = {};

    Object.entries(matches).forEach(([match, { red, blue }]) => {
      if (red.length !== 3 || blue.length !== 3) return;
      const redEPA = red.reduce((sum, t) => sum + t.totalScore, 0);
      const blueEPA = blue.reduce((sum, t) => sum + t.totalScore, 0);
      allianceEPAs[match] = { redEPA, blueEPA };
    });

    data.forEach(row => {
      const teamNumber = row['Team No.'];
      const match = row['Match'];
      const robotColor = row['Robot Color'];
      const defenseRating = parseFloat(row['Defense Rating']);
      if (!match || !teamNumber || isNaN(defenseRating) || defenseRating <= 0) return;
      const isRed = robotColor.toLowerCase().startsWith('red');
      const defendingAgainst = isRed ? 'blue' : 'red';
      const thisMatch = matches[match];
      if (!thisMatch || thisMatch.red.length !== 3 || thisMatch.blue.length !== 3) return;
      const diedRobots = robotDiedMap[match] || new Set();
      const opponentTeams = thisMatch[defendingAgainst].map(t => t.teamNumber);
      const anyOpponentDied = opponentTeams.some(team => diedRobots.has(team));
      if (anyOpponentDied) return;
      const opponentEPAInMatch = allianceEPAs[match][`${defendingAgainst}EPA`];
      let totalOpponentEPA = 0;
      let opponentMatchCount = 0;
      opponentTeams.forEach(opponent => {
        const games = teamMatches[opponent];
        games.forEach(g => {
          if (g.match !== match) {
            const comparisonDiedRobots = robotDiedMap[g.match] || new Set();
            if (!comparisonDiedRobots.has(opponent)) {
              const allianceScore = allianceEPAs[g.match]?.[`${g.alliance}EPA`];
              if (!isNaN(allianceScore)) {
                totalOpponentEPA += allianceScore;
                opponentMatchCount++;
              }
            }
          }
        });
      });
      if (opponentMatchCount === 0) return;
      const avgOpponentEPA = totalOpponentEPA / opponentMatchCount;
      const impact = avgOpponentEPA - opponentEPAInMatch;
      if (!teamDefenseImpact[teamNumber]) {
        teamDefenseImpact[teamNumber] = 0;
        defenseMatchCount[teamNumber] = 0;
      }
      teamDefenseImpact[teamNumber] += impact;
      defenseMatchCount[teamNumber]++;
    });

    const rankings = Object.keys(teamDefenseImpact).map(team => {
      const matches = defenseMatchCount[team];
      return {
        team,
        avgImpact: matches > 0 ? teamDefenseImpact[team] / matches : 0,
        matchesCount: matches
      };
    });

    rankings.sort((a, b) => b.avgImpact - a.avgImpact);
    rankings.forEach((entry, i) => entry.rank = i + 1);

    const teamNum = teamData[0]['Team No.'].toString().trim();
    const found = rankings.find(t => t.team === teamNum);
    if (found) {
      defenseRank = `${found.rank}/${rankings.length}`;
    }
  } catch (e) {
    defenseRank = 'N/A';
  }

  const ratings = teamData.map(row => parseFloat(row['Defense Rating'])).filter(n => !isNaN(n));
  let defenseRating = 'N/A';
  if (ratings.length > 0) {
    const freq = {};
    ratings.forEach(r => freq[r] = (freq[r] || 0) + 1);
    let mode = ratings[0], maxCount = 0;
    for (const r in freq) {
      if (freq[r] > maxCount) {
        maxCount = freq[r];
        mode = r;
      }
    }
    defenseRating = mode;
  }

  return {
    epa: avgEPA,
    avgCycles,
    mostCommonScoring,
    secondCommonScoring,
    canNet,
    canProcess,
    climbRate,
    defenseRating,
    defenseRank
  };
}

/*-----ALLIANCE COMPARISON FUNCTIONS-----*/

function openAllianceComparison(alliance) {
  const popup = document.getElementById('allianceComparisonPopup');
  const title = document.getElementById('allianceComparisonTitle');
  const content = document.getElementById('allianceComparisonContent');

  content.innerHTML = '';

  const teamNumbers = [];
  for (let i = 1; i <= 3; i++) {
    const team = document.getElementById(`${alliance}Team${i}`).value.trim();
    if (team) teamNumbers.push(team);
  }

  if (teamNumbers.length === 0) {
    alert(`Please enter at least one team for the ${alliance} alliance`);
    return;
  }

  title.textContent = `${alliance.toUpperCase()} Alliance Comparison: ${teamNumbers.join(', ')}`;
  title.style.color = alliance === 'red' ? '#ff5c5c' : '#3EDBF0';

  teamNumbers.forEach((team, index) => {
    let teamData = filterTeamData(team);
    if (teamData.length === 0) return;

    teamData = teamData.sort((a, b) => parseInt(a.Match) - parseInt(b.Match));

    const teamContainer = document.createElement('div');
    teamContainer.style.backgroundColor = '#2a2d31';
    teamContainer.style.borderRadius = '8px';
    teamContainer.style.padding = '15px';
    teamContainer.style.color = 'white';

    const teamHeader = document.createElement('div');
    teamHeader.style.display = 'flex';
    teamHeader.style.justifyContent = 'space-between';
    teamHeader.style.alignItems = 'center';
    teamHeader.style.marginBottom = '15px';

    const teamTitle = document.createElement('h3');
    teamTitle.textContent = `Team ${team}`;
    teamTitle.style.margin = '0';
    teamTitle.style.color = alliance === 'red' ? '#ff5c5c' : '#3EDBF0';

    teamHeader.appendChild(teamTitle);
    teamContainer.appendChild(teamHeader);

    const statsContainer = document.createElement('div');
    statsContainer.style.marginBottom = '15px';

    const stats = calculateTeamStats(teamData);
    statsContainer.innerHTML = `
      <div style="margin-bottom: 10px;">
        <strong>EPA:</strong> ${stats.epa}<br>
        <strong>Avg Coral:</strong> ${stats.avgCoral}<br>
        <strong>Avg Algae:</strong> ${stats.avgAlgae}
      </div>
      <div>
        <strong>Climb Success:</strong> ${stats.climbSuccessRate}%<br>
        <strong>Robot Died:</strong> ${stats.robotDiedRate}%
      </div>
    `;
    teamContainer.appendChild(statsContainer);

    const chartsContainer = document.createElement('div');
    chartsContainer.style.display = 'flex';
    chartsContainer.style.flexDirection = 'column';
    chartsContainer.style.gap = '15px';

    const autoCoralCanvas = document.createElement('canvas');
    autoCoralCanvas.id = `allianceAutoCoral${index}`;
    autoCoralCanvas.style.width = '100%';
    autoCoralCanvas.style.height = '200px';

    const autoAlgaeCanvas = document.createElement('canvas');
    autoAlgaeCanvas.id = `allianceAutoAlgae${index}`;
    autoAlgaeCanvas.style.width = '100%';
    autoAlgaeCanvas.style.height = '200px';

    const teleCoralCanvas = document.createElement('canvas');
    teleCoralCanvas.id = `allianceTeleCoral${index}`;
    teleCoralCanvas.style.width = '100%';
    teleCoralCanvas.style.height = '200px';

    const teleAlgaeCanvas = document.createElement('canvas');
    teleAlgaeCanvas.id = `allianceTeleAlgae${index}`;
    teleAlgaeCanvas.style.width = '100%';
    teleAlgaeCanvas.style.height = '200px';

    const climbCanvas = document.createElement('canvas');
    climbCanvas.id = `allianceClimb${index}`;
    climbCanvas.style.width = '100%';
    climbCanvas.style.height = '200px';

    const addChartTitle = (container, title) => {
      const titleDiv = document.createElement('div');
      titleDiv.textContent = title;
      titleDiv.style.fontWeight = 'bold';
      titleDiv.style.marginBottom = '5px';
      titleDiv.style.color = '#ccc';
      container.appendChild(titleDiv);
    };

    addChartTitle(chartsContainer, 'Auto Coral');
    chartsContainer.appendChild(autoCoralCanvas);

    addChartTitle(chartsContainer, 'Auto Algae');
    chartsContainer.appendChild(autoAlgaeCanvas);

    addChartTitle(chartsContainer, 'Tele Coral');
    chartsContainer.appendChild(teleCoralCanvas);

    addChartTitle(chartsContainer, 'Tele Algae');
    chartsContainer.appendChild(teleAlgaeCanvas);

    addChartTitle(chartsContainer, 'Endgame Climb');
    chartsContainer.appendChild(climbCanvas);

    teamContainer.appendChild(chartsContainer);
    content.appendChild(teamContainer);

    const allTeamData = teamNumbers.map(t => filterTeamData(t));
    const maxTeleCoral = getMaxTeleCoral(...allTeamData);
    const maxTeleAlgae = getMaxTeleAlgae(...allTeamData);
    const maxAutoCoral = getMaxAutoCoral(...allTeamData);
    const maxAutoAlgae = getMaxAutoAlgae(...allTeamData);

    renderAutoCoralChartForTeam(teamData, `allianceAutoCoral${index}`, maxAutoCoral);
    renderAutoAlgaeChartForTeam(teamData, `allianceAutoAlgae${index}`, maxAutoAlgae);
    renderTeleCoralChartForTeam(teamData, `allianceTeleCoral${index}`, maxTeleCoral);
    renderTeleAlgaeChartForTeam(teamData, `allianceTeleAlgae${index}`, maxTeleAlgae);
    renderEndGameChartForTeam(teamData, `allianceClimb${index}`);
  });

  popup.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeAllianceComparison() {
  const popup = document.getElementById('allianceComparisonPopup');
  popup.style.display = 'none';
  document.body.style.overflow = 'auto';

  const chartIds = [
    'allianceAutoCoral0', 'allianceAutoCoral1', 'allianceAutoCoral2',
    'allianceTeleCoral0', 'allianceTeleCoral1', 'allianceTeleCoral2',
    'allianceTeleAlgae0', 'allianceTeleAlgae1', 'allianceTeleAlgae2'
  ];

  chartIds.forEach(id => {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  });
}

function calculateTeamStats(teamData) {
  if (!teamData || teamData.length === 0) return {};

  const climbScores = teamData.map(row => parseFloat(row['Climb Score'] || 0));
  const successfulClimbs = climbScores.filter(score => score === 12 || score === 6).length;
  const totalClimbAttempts = climbScores.filter(score => score === 12 || score === 6 || score === 2.1).length;
  const climbSuccessRate = totalClimbAttempts > 0 ? (successfulClimbs / totalClimbAttempts * 100).toFixed(1) : "0.0";
  const robotDiedRate = (teamData.filter(row => row['Died or Immobilized'] === '1').length / teamData.length * 100).toFixed(1);

  const totalScore = teamData.reduce((sum, row) => sum + (parseFloat(row['Total Score']) || 0), 0);
  const totalCoral = teamData.reduce((sum, row) => {
    return sum +
      (parseInt(row['Auton L1']) || 0) +
      (parseInt(row['Auton L2']) || 0) +
      (parseInt(row['Auton L3']) || 0) +
      (parseInt(row['Auton L4']) || 0) +
      (parseInt(row['L1']) || 0) +
      (parseInt(row['L2']) || 0) +
      (parseInt(row['L3']) || 0) +
      (parseInt(row['L4']) || 0);
  }, 0);

  const totalAlgae = teamData.reduce((sum, row) => {
    return sum +
      (parseInt(row['Auton Algae in Net'] || 0)) * 2 +
      (parseInt(row['Auton Algae in Processor'] || 0)) * 3 +
      (parseInt(row['Algae in Net'] || 0) * 2) +
      (parseInt(row['Algae in Processor'] || 0) * 3);
  }, 0);

  return {
    epa: (totalScore / teamData.length).toFixed(1),
    avgCoral: (totalCoral / teamData.length).toFixed(1),
    avgAlgae: (totalAlgae / teamData.length).toFixed(1),
    climbSuccessRate,
    robotDiedRate
  };
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

  const matchIndex = headers.indexOf("Match");
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
          if (typeof renderMatchPredictor === 'function') {
            renderMatchPredictor();
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
    const matchIndex = headers.indexOf("Match");
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