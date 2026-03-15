/*-----VARIABLES----*/

const charts = {
  overviewStackedChart: null,
  fuelOprChart: null,
  fuelFerriedChart: null,
  autoFuelShotChart: null,
  autoFuelFerriedChart: null,
  teleFuelShotChart: null,
  teleFuelFerriedChart: null,
  teleFuelWeightedGraph: null 
};

let hiddenTeams = JSON.parse(localStorage.getItem('hiddenTeams') || '[]');
let showHiddenTeamsInFilter = false;
let isolatedTeams = [];
let isIsolated = false;
let highlightedOverviewTeam = null;
let csvText = localStorage.getItem('csvText') || "";
let pitCsvText = localStorage.getItem('pitCsvText') || "";
let scheduleCsvText = localStorage.getItem('scheduleCsvText') || "";
let oprCsvText = localStorage.getItem('oprCsvText') || localStorage.getItem('oprCSV') || "";
let currentTeamData = [];
let teleClimbPositionFilterValue = 'all';
let pitScoutingData = [];


/*-----RANKINGS-----*/

const columnMapping = {
  'avgTeleShot': 4,
  'avgAutoShot': 5,
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
  'robotDiedPercent': 18,
  'autoOPR': 19,
  'teleOPR': 20
};
columnMapping['weightedTeleFuel'] = 3; 
function updateRankingTableColumns() {
  const ths = document.querySelectorAll('#rankingTable thead th');
  const trs = document.querySelectorAll('#rankingTable tbody tr');
  const checkboxes = document.querySelectorAll('#rankingFilterForm input[type="checkbox"]');

  const checkedValues = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  ths.forEach((th, index) => {
    if (index === 0 || index === 1 || index === 2 || index === 3) {
      th.style.display = '';
    }
    else {
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
      if (index === 0 || index === 1 || index === 2 || index === 3) {
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
  let hasOprData = false;

  if (oprCsvText && oprCsvText.trim()) {
    try {
      const parsed = Papa.parse(oprCsvText, { header: true, skipEmptyLines: true });
      parsed.data.forEach(row => {
        const team = row['Team Number']?.toString().trim();
        if (team) {
          oprData[team] = {
            autoOPR: parseFloat((row['Auto OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0,
            teleOPR: parseFloat((row['Tele OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0,
            totalOPR: parseFloat((row['Total OPR'] || '').toString().replace(/[^0-9.-]/g, '')) || 0
          };
          hasOprData = true;
        }
      });
    } catch (e) {
      console.error('Error parsing OPR data:', e);
    }
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

    const avgTotalPoints = avg(matches, 'Total Points') || avg(matches, 'Total Score') || 0;
    const avgEPA = Math.round(avgTotalPoints * 100) / 100;

    const avgAutoShot = Math.round((avg(matches, 'Auto Fuel Shot') || 0) * 100) / 100;
    const avgTeleShot = Math.round((avg(matches, 'Tele Fuel Shot') || 0) * 100) / 100;
    const avgAutoFerried = Math.round((avg(matches, 'Auto Fuel Ferried') || 0) * 100) / 100;
    const avgTeleFerried = Math.round((avg(matches, 'Tele Fuel Ferried') || 0) * 100) / 100;

    // Auto climb attempts - sum of 1s and Fs
    const autoClimbAttempts = matches.filter(r => {
      const val = r['Climb Auto']?.toString().trim();
      return val === '1' || val === 'F';
    }).length;

    const autoClimbSuccesses = matches.filter(r => r['Climb Auto'] === '1').length;

    const stuckOnBar = matches.reduce((sum, r) => sum + (parseInt(r['Stuck On Bar']) || 0), 0);

    const avgAutoClimbPoints = avg(matches, 'Auto Climb Points') || 0;
    const avgTeleClimbPoints = avg(matches, 'Tele Climb Points') || 0;
    const avgClimbPoints = avgAutoClimbPoints + avgTeleClimbPoints;

    // Tele climb attempts - sum of 3s, 2s, 1s, and Fs
    const climbAttempts = matches.filter(r => {
      const val = r['Climb Teleop']?.toString().trim();
      return val === '3' || val === '2' || val === '1' || val === 'F';
    }).length;

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

    // Robot died count - just the number of times they died (no percentage)
    const diedCount = matches.filter(r => {
      const val = parseFloat(r['Robot Died']);
      return val === 0.5 || val === 1;
    }).length;

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

    const teamOpr = oprData[team] || { autoOPR: 0, teleOPR: 0, totalOPR: 0 };

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
      robotDied: diedCount,
      shootingAccuracy,
      autoOPR: teamOpr.autoOPR,
      teleOPR: teamOpr.teleOPR,
      totalOPR: teamOpr.totalOPR
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
      stat.avgEPA.toFixed(1),
      stat.weightedTeleFuel.toFixed(1),  
      stat.avgTeleShot.toFixed(1),
      stat.avgAutoShot.toFixed(1),
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
      stat.robotDied  // Now just the count, no percentage
    ];

    if (hasOprData) {
      values.push(stat.autoOPR.toFixed(2));
      values.push(stat.teleOPR.toFixed(2));
    }

    let html = '';
    const columnNames = [
      'Rank',
      'Team',
      'Avg EPA',
      'Weighted Tele Fuel',  
      'Avg Tele Shot',
      'Avg Auto Shot',
      'Avg Auto Ferried',
      'Avg Tele Ferried',
      'Auto Climb Attempts',
      'Auto Climb Successes',
      'Stuck on Bar',
      'Shooting Accuracy',
      'Avg Climb Points',
      'Climb Attempts',
      'Climb Successes',
      'Driver Skill',
      'Count Defense Ratings',
      'Max Defense Ratings',
      'Robot Died'  // Changed from 'Robot Died %'
    ];

    if (hasOprData) {
      columnNames.push('Auto OPR', 'Tele OPR');
    }

    // Columns where LOWER numbers are better (should be red when high, green when low)
    const flipColumns = ['Stuck on Bar', 'Robot Died'];

    values.forEach((val, i) => {
      let bgColor = '';

      if (i > 1) {
        const colName = columnNames[i];
        const allVals = teamStats.map(s => {
          switch (colName) {
            case 'Avg EPA': return s.avgEPA;
            case 'Weighted Tele Fuel': return s.weightedTeleFuel;  
            case 'Avg Tele Shot': return s.avgTeleShot;
            case 'Avg Auto Shot': return s.avgAutoShot;
            case 'Avg Auto Ferried': return s.avgAutoFerried;
            case 'Avg Tele Ferried': return s.avgTeleFerried;
            case 'Auto Climb Attempts': return s.autoClimbAttempts;
            case 'Auto Climb Successes': return s.autoClimbSuccesses;
            case 'Climb Attempts': return s.climbAttempts;
            case 'Climb Successes': return s.climbSuccesses;
            case 'Shooting Accuracy': return parseFloat(s.shootingAccuracy);
            case 'Avg Climb Points': return s.avgClimbPoints;
            case 'Driver Skill': return s.driverSkill;
            case 'Count Defense Ratings': return s.countDefenseRatings;
            case 'Max Defense Ratings': return s.maxDefenseRatings;
            case 'Robot Died': return s.robotDied;
            case 'Stuck on Bar': return s.stuckOnBar;
            case 'Auto OPR': return s.autoOPR;
            case 'Tele OPR': return s.teleOPR;
            default: return null;
          }
        }).filter(v => typeof v === 'number' && !isNaN(v));
        const numVal = parseFloat(val);

        if (!isNaN(numVal) && allVals.length) {
          const minVal = Math.min(...allVals);
          const maxVal = Math.max(...allVals);

          let normalized =
            maxVal > minVal ? (numVal - minVal) / (maxVal - minVal) : 0.5;

          // For columns in flipColumns, lower numbers should be green (normalized near 0 = green, near 1 = red)
          // So we need to flip the normalized value: 0 becomes green, 1 becomes red
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

  columnMapping['weightedTeleFuel'] = 3; 
  columnMapping['robotDied'] = 18;

  updateRankingUIForOpr(hasOprData);

  function avg(arr, key) {
    const vals = arr.map(r => parseFloat(r[key] || 0)).filter(v => !isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }
}

function updateRankingUIForOpr(hasOprData) {
  if (hasOprData) {
    columnMapping['autoOPR'] = 18;
    columnMapping['teleOPR'] = 19;
  } else {
    delete columnMapping['autoOPR'];
    delete columnMapping['teleOPR'];
  }

  updateRankingTableColumns();
  updateFilterCheckboxesForOpr(hasOprData);
}

function updateFilterCheckboxesForOpr(hasOprData) {
  const filterForm = document.getElementById('rankingFilterForm');
  if (!filterForm) return;

  const filterGroups = filterForm.querySelectorAll('.filter-group-inline');
  let otherGroup = null;

  filterGroups.forEach(group => {
    const heading = group.querySelector('h3');
    if (heading && heading.textContent.trim() === 'Other') {
      otherGroup = group;
    }
  });

  if (!otherGroup) return;

  const labels = otherGroup.querySelectorAll('label');
  let autoOPRLabel = null;
  let teleOPRLabel = null;

  labels.forEach(label => {
    const input = label.querySelector('input[type="checkbox"]');
    if (input) {
      if (input.value === 'autoOPR') {
        autoOPRLabel = label;
      } else if (input.value === 'teleOPR') {
        teleOPRLabel = label;
      }
    }
  });

  if (autoOPRLabel) {
    autoOPRLabel.style.display = hasOprData ? 'flex' : 'none';
  }

  if (teleOPRLabel) {
    teleOPRLabel.style.display = hasOprData ? 'flex' : 'none';
  }
}

function updateRankingTableColumns() {
  const ths = document.querySelectorAll('#rankingTable thead th');
  const trs = document.querySelectorAll('#rankingTable tbody tr');
  const checkboxes = document.querySelectorAll('#rankingFilterForm input[type="checkbox"]');

  const checkedValues = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  const permanentColumns = new Set([0, 1, 2, 3]); 

  ths.forEach((th, index) => {
    if (permanentColumns.has(index)) {
      th.style.display = '';
    }
    else {
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
      if (permanentColumns.has(index)) {
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
function updateRankingTableColumnsWithOpr(hasOprData) {
  const ths = document.querySelectorAll('#rankingTable thead th');
  const trs = document.querySelectorAll('#rankingTable tbody tr');
  const checkboxes = document.querySelectorAll('#rankingFilterForm input[type="checkbox"]');

  const checkedValues = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);
  if (hasOprData) {
    columnMapping['autoOPR'] = 19;  
    columnMapping['teleOPR'] = 20;   
  }


  ths.forEach((th, index) => {
    if (index === 0 || index === 1 || index === 2) {
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

  console.log("Uncheck all clicked - Weighted Tele Fuel remains visible as permanent column");
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
    checkboxes.forEach(cb => {
      if (cb.closest('label') && cb.closest('label').style.display !== 'none') {
        state[cb.value] = cb.checked;
      }
    });
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
  };
  reader.readAsText(file);
}

function parseEventScoutingCSV(csvText, fileName) {
  try {
    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transform: function (value) {
        if (typeof value === 'string') {
          return value.replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"').trim();
        }
        return value;
      }
    });

    if (result.errors && result.errors.length > 0) {
      console.warn('Papa Parse warnings:', result.errors);
    }

    eventScoutingData = result.data;
    console.log(`Event Scouting Data loaded: ${eventScoutingData.length} rows`);
    updateVisualizerWithData('event', eventScoutingData);
  } catch (error) {
    console.error('Error parsing event scouting CSV:', error);
    eventScoutingData = [];
  }
}

function parsePitScoutingCSV(csvText, fileName) {
  try {
    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transform: function (value) {
        if (typeof value === 'string') {
          return value.replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"').trim();
        }
        return value;
      }
    });

    if (result.errors && result.errors.length > 0) {
      console.warn('Papa Parse warnings:', result.errors);
    }

    pitScoutingData = result.data.filter(row => {
      return row['Team Number'] &&
        row['Trench'] !== undefined &&
        row['Ground Intake'] !== undefined &&
        row['Shoot on Fly'] !== undefined;
    });

    console.log(`Pit Scouting Data loaded: ${pitScoutingData.length} teams`);
    updateVisualizerWithData('pit', pitScoutingData);
  } catch (error) {
    console.error('Error parsing pit scouting CSV:', error);
    pitScoutingData = [];
  }
}

function parseMatchScheduleCSV(csvText, fileName) {
  try {
    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transform: function (value) {
        if (typeof value === 'string') {
          return value.replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"').trim();
        }
        return value;
      }
    });

    if (result.errors && result.errors.length > 0) {
      console.warn('Papa Parse warnings:', result.errors);
    }

    const requiredHeaders = ['Match Number', 'Red 1', 'Red 2', 'Red 3', 'Blue 1', 'Blue 2', 'Blue 3'];
    const missingHeaders = requiredHeaders.filter(h => !result.meta.fields.includes(h));

    if (missingHeaders.length > 0) {
      updateStatus(statusSchedule, `Missing headers: ${missingHeaders.join(", ")}`, false);
      matchScheduleData = [];
      return;
    }

    matchScheduleData = result.data;
    console.log(`Match Schedule loaded: ${matchScheduleData.length} matches`);
    updateVisualizerWithData('schedule', matchScheduleData);
  } catch (error) {
    console.error('Error parsing match schedule CSV:', error);
    matchScheduleData = [];
  }
}

function parseOPRCSV(csvText, fileName) {
  try {
    const result = Papa.parse(csvText, {
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

    if (result.errors && result.errors.length > 0) {
      console.warn('Papa Parse warnings:', result.errors);
    }

    const firstRow = result.data[0] || {};
    const hasTeamNumber = firstRow.hasOwnProperty('Team Number');
    const hasAutoOPR = firstRow.hasOwnProperty('Auto OPR');
    const hasTeleOPR = firstRow.hasOwnProperty('Tele OPR');
    const hasTotalOPR = firstRow.hasOwnProperty('Total OPR');

    if (!hasTeamNumber || !hasTeleOPR || !hasAutoOPR || !hasTotalOPR) {
      console.warn('OPR CSV missing required headers');
    }

    oprData = result.data;
    console.log(`OPR Data loaded: ${oprData.length} teams`);
    updateVisualizerWithData('opr', oprData);
  } catch (error) {
    console.error('Error parsing OPR CSV:', error);
    oprData = [];
  }
}

/*-----CLEAR VIEWS WHEN DATA DELETED-----*/

function clearAllEventDataViews() {
  console.log("Clearing all event data views");

  // In clearAllEventDataViews function, add:
  if (charts.teleFuelWeightedGraph) {
    charts.teleFuelWeightedGraph.destroy();
    charts.teleFuelWeightedGraph = null;
  }

  // And add this to clear the weighted tele fuel amount
  document.getElementById('weightedTeleFuelAmount').textContent = '0.00';

  // Clear Overview charts
  if (charts.overviewStackedChart) {
    charts.overviewStackedChart.destroy();
    charts.overviewStackedChart = null;
  }
  if (charts.fuelOprChart) {
    charts.fuelOprChart.destroy();
    charts.fuelOprChart = null;
  }
  if (charts.fuelFerriedChart) {
    charts.fuelFerriedChart.destroy();
    charts.fuelFerriedChart = null;
  }

  // Render blank charts in Overview
  renderBlankChart('overviewStackedChart', 'No Data');
  renderBlankChart('fuelOprChart', 'No Data');
  renderBlankChart('fuelFerriedChart', 'No Data');

  // Clear Match Predictor
  document.getElementById('matchPredictionResult').innerHTML = '';
  document.getElementById('matchSummaryTable').innerHTML = '';
  document.getElementById('redTeam1').value = '';
  document.getElementById('redTeam2').value = '';
  document.getElementById('redTeam3').value = '';
  document.getElementById('blueTeam1').value = '';
  document.getElementById('blueTeam2').value = '';
  document.getElementById('blueTeam3').value = '';
  document.getElementById('matchNumberInput').value = '';

  // Clear Individual View
  document.getElementById('teamSearch').value = '';
  document.getElementById('teamNicknameDisplay').textContent = '';
  document.getElementById('flaggedMatches').innerHTML = '';
  document.getElementById('scouterComments').innerHTML = '';
  document.getElementById('autoPathContent').innerHTML = '';

  // Clear pit scouting indicators in Individual View
  document.getElementById('trench').textContent = '❌';
  document.getElementById('groundIntake').textContent = '❌';
  document.getElementById('shootOnFly').textContent = '❌';

  // Clear stat elements in Individual View
  const statElements = [
    'avgShot', 'avgFerried', 'averageEPA', 'shootingAccuracy',
    'climbSuccessRate', 'robotDiedRate'
  ];
  statElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = '0.00';
  });

  // In the individualCharts array in clearAllEventDataViews, add:
  const individualCharts = [
    'autoClimbChart', 'teleClimbChart', 'autoFuelShotChart',
    'autoFuelFerriedChart', 'teleFuelShotChart', 'teleFuelFerriedChart',
    'teleFuelWeightedGraph'  // Add this line
  ];

  individualCharts.forEach(chartId => {
    if (charts[chartId]) {
      charts[chartId].destroy();
      charts[chartId] = null;
    }
    const canvas = document.getElementById(chartId);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '16px Lato';
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'center';
      ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
    }
  });

  // Clear Comparison View
  if (window.comparisonTeamData) {
    window.comparisonTeamData = { 1: [], 2: [] };
  }

  // Clear comparison search inputs and nicknames
  document.getElementById('comparisonSearch1').value = '';
  document.getElementById('comparisonSearch2').value = '';
  document.getElementById('comparisonNickname1').textContent = '';
  document.getElementById('comparisonNickname2').textContent = '';

  document.getElementById('comparisonWeightedTeleFuel1').textContent = '0.00';
  document.getElementById('comparisonWeightedTeleFuel2').textContent = '0.00';

  // Clear comparison stat boxes
  const comparisonStats = [
    'comparisonTrench1', 'comparisonTrench2',
    'comparisonGroundIntake1', 'comparisonGroundIntake2',
    'comparisonShootOnFly1', 'comparisonShootOnFly2',
    'comparisonAvgShot1', 'comparisonAvgShot2',
    'comparisonAvgFerried1', 'comparisonAvgFerried2',
    'comparisonEPA1', 'comparisonEPA2',
    'comparisonShootingAccuracy1', 'comparisonShootingAccuracy2',
    'comparisonClimbRate1', 'comparisonClimbRate2',
    'comparisonDiedRate1', 'comparisonDiedRate2'
  ];

  comparisonStats.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = '0.00';
  });

  // Clear comparison path and comment containers
  document.getElementById('comparisonAutoPaths1').innerHTML = '';
  document.getElementById('comparisonAutoPaths2').innerHTML = '';
  document.getElementById('comparisonComments1').innerHTML = '';
  document.getElementById('comparisonComments2').innerHTML = '';

  // Destroy all comparison charts
  if (window.comparisonCharts) {
    Object.keys(window.comparisonCharts).forEach(key => {
      if (window.comparisonCharts[key]) {
        try {
          window.comparisonCharts[key].destroy();
        } catch (e) { }
        window.comparisonCharts[key] = null;
      }
    });
  }
  // In the section where you destroy comparison charts, add:
  if (window.comparisonCharts) {
    if (window.comparisonCharts.teleFuelWeighted1) {
      window.comparisonCharts.teleFuelWeighted1.destroy();
      window.comparisonCharts.teleFuelWeighted1 = null;
    }
    if (window.comparisonCharts.teleFuelWeighted2) {
      window.comparisonCharts.teleFuelWeighted2.destroy();
      window.comparisonCharts.teleFuelWeighted2 = null;
    }
  }

  // Clear comparison chart canvases
  const comparisonChartIds = [
    'comparisonAutoClimbChart1', 'comparisonAutoClimbChart2',
    'comparisonTeleClimbChart1', 'comparisonTeleClimbChart2',
    'comparisonAutoFuelShotChart1', 'comparisonAutoFuelShotChart2',
    'comparisonAutoFuelFerriedChart1', 'comparisonAutoFuelFerriedChart2',
    'comparisonTeleFuelShotChart1', 'comparisonTeleFuelShotChart2',
    'comparisonTeleFuelFerriedChart1', 'comparisonTeleFuelFerriedChart2',
    'comparisonTeleFuelWeightedGraph1',
    'comparisonTeleFuelWeightedGraph2'
  ];

  comparisonChartIds.forEach(canvasId => {
    const canvas = document.getElementById(canvasId);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '16px Lato';
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'center';
      ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
    }
  });

  // Clear Filter Teams view
  document.getElementById('rankedTeamsContainer').innerHTML = '';

  // Clear Rankings table
  const rankingTableBody = document.getElementById('rankingTableBody');
  if (rankingTableBody) {
    rankingTableBody.innerHTML = '';
  }

  // Update latest match info
  document.getElementById('latestMatchInfoSidebar').textContent = 'Data up till Q—';

  // Clear current team data
  currentTeamData = [];
}

// Helper function to render blank chart
function renderBlankChart(canvasId, message) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '24px Lato';
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'center';
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
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
      // Clear all views that depend on event data
      clearAllEventDataViews();
    }
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

  const savedOPRCSV = localStorage.getItem('oprCsvText') || localStorage.getItem('oprCSV');
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
      // Find the 'event' case in updateVisualizerWithData and update it to:
      case 'event':
        try {
          csvText = (Array.isArray(data) && data.length) ? Papa.unparse(data) : '';
          localStorage.setItem('eventScoutingCSV', csvText || '');
        } catch (e) { console.warn('Could not serialize event data to CSV text', e); }

        try { renderRankingTable(); } catch (e) { console.warn('renderRankingTable failed', e); }
        try { updateRankingTableColumns(); } catch (e) { }
        try { updateLatestMatchInfo(); } catch (e) { }
        try { renderOverviewStackedChart((Array.isArray(data) ? data : parseCSV().data) || []); } catch (e) { }
        try { renderFuelShotChart(); } catch (e) { }
        try { renderFuelFerriedChart(); } catch (e) { }

        // Clear individual view if there's a currently searched team
        const currentTeam = document.getElementById('teamSearch').value.trim();
        if (currentTeam) {
          try { searchTeam(); } catch (e) { console.warn('Could not refresh individual view', e); }
        }

        // Clear comparison view
        if (window.comparisonTeamData) {
          window.comparisonTeamData = { 1: [], 2: [] };
        }

        // Clear filter teams view and reapply filters
        try { applyFilters(); } catch (e) { console.warn('Could not apply filters', e); }

        // Clear match predictor
        try {
          document.getElementById('matchPredictionResult').innerHTML = '';
          document.getElementById('matchSummaryTable').innerHTML = '';
        } catch (e) { }

        break;

      case 'pit':
        try {
          pitCsvText = (Array.isArray(data) && data.length) ? Papa.unparse(data) : '';
          localStorage.setItem('pitCsvText', pitCsvText || '');
        } catch (e) { console.warn('Could not serialize pit data', e); }

        try { loadPitScoutingData(); } catch (e) { }
        break;

      case 'schedule':
        try {
          scheduleCsvText = (Array.isArray(data) && data.length) ? Papa.unparse(data) : '';
          localStorage.setItem('scheduleCsvText', scheduleCsvText || '');
        } catch (e) { console.warn('Could not serialize schedule data', e); }

        try { generateTargetedScoutingBlocks(); } catch (e) { }
        break;

      case 'opr':
        try {
          oprCsvText = (Array.isArray(data) && data.length) ? Papa.unparse(data) : '';
          localStorage.setItem('oprCsvText', oprCsvText || '');
        } catch (e) { console.warn('Could not serialize opr data', e); }

        try { renderRankingTable(); } catch (e) { }
        try { updateOverviewCharts(); } catch (e) { }
        break;
    }
  } catch (err) {
    console.error('updateVisualizerWithData error', err);
  }
}

function parseCSV() {
  if (!csvText) return { data: [], meta: { fields: [] } };
  try {
    return Papa.parse(csvText, {
      header: true,
      transform: function (value) {
        if (typeof value === 'string') {
          return value.replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"').trim();
        }
        return value;
      }
    });
  } catch (error) {
    console.error('Error in parseCSV:', error);
    return { data: [], meta: { fields: [] } };
  }
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
      localStorage.setItem('oprCsvText', oprCsvText);
      localStorage.setItem('oprFileName', file.name);
      updateStatus(statusEl, file.name, true);
      try { renderFuelShotChart(); } catch (e) { console.warn('Fuel OPR chart render failed', e); }
      try { renderRankingTable(); } catch (e) { console.warn('Ranking table refresh failed', e); }
      try { updateOverviewCharts(); } catch (e) { console.warn('Overview charts refresh failed', e); }
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
    renderFuelShotChart();
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

  switch (inputId) {
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

/*-----TBA API CONFIGURATION-----*/
const TBA_API_KEY = 'dkHdbc90y6rrKoG7w15O2YsLW3bWKySKjDItw93b8benEh0ZtNDTK4hYRseZnsT3';
const TBA_BASE_URL = 'https://www.thebluealliance.com/api/v3';

let teamNameCache = {};

async function fetchTeamName(teamNumber) {
  if (teamNameCache[teamNumber]) {
    return teamNameCache[teamNumber];
  }

  if (!navigator.onLine) {
    console.log('Offline: Skipping TBA API call');
    return null;
  }

  try {
    const response = await fetch(`${TBA_BASE_URL}/team/frc${teamNumber}`, {
      headers: {
        'X-TBA-Auth-Key': TBA_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`TBA API error: ${response.status}`);
    }

    const data = await response.json();
    const teamName = data.nickname;

    teamNameCache[teamNumber] = teamName;
    return teamName;
  } catch (error) {
    console.error('Error fetching team name:', error);
    return nul
  }
}


async function displayTeamName(teamNumber, elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const teamName = await fetchTeamName(teamNumber);
  element.textContent = teamName;
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
        renderFuelShotChart();
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
  const autoFuelShotFilter = document.getElementById('autoFuelShotFilter')?.value || 'all';
  const autoFuelFerriedFilter = document.getElementById('autoFuelFerriedFilter')?.value || 'all';

  let filteredData = currentTeamData;

  if (autoPathFilter !== 'all' || autoClimbFilter !== 'all' || autoFuelShotFilter !== 'all' || autoFuelFerriedFilter !== 'all') {
    const filterValue = autoPathFilter !== 'all' ? autoPathFilter :
      (autoClimbFilter !== 'all' ? autoClimbFilter :
        (autoFuelShotFilter !== 'all' ? autoFuelShotFilter : autoFuelFerriedFilter));
    filteredData = currentTeamData.filter(row => {
      const startingPos = row['Starting Position']?.toString().trim();
      return startingPos === filterValue;
    });
  }

  // Calculate global max for filtered data
  const globalMaxFuel = calculateGlobalMaxFuel(filteredData);

  renderAutoPaths(filteredData);
  renderAutoClimbChart(filteredData);
  renderAutoFuelShotChart(filteredData, globalMaxFuel);
  renderAutoFuelFerriedChart(filteredData, globalMaxFuel);
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
  const autoFuelShotFilter = document.getElementById('autoFuelShotFilter');
  const autoFuelFerriedFilter = document.getElementById('autoFuelFerriedFilter');

  if (autoPathFilter && autoClimbFilter && autoFuelShotFilter && autoFuelFerriedFilter) {
    autoPathFilter.value = value;
    autoClimbFilter.value = value;
    autoFuelShotFilter.value = value;
    autoFuelFerriedFilter.value = value;
    filterAutoData();
  }
}

function searchTeam() {
  console.log("=== searchTeam() called ===");

  const teamNumber = document.getElementById('teamSearch').value.trim();
  displayTeamName(teamNumber, 'teamNicknameDisplay');
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

    // Clear existing charts
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

    // Clear auto fuel charts
    const autoFuelShotCanvas = document.getElementById('autoFuelShotChart');
    if (autoFuelShotCanvas) {
      const ctx = autoFuelShotCanvas.getContext('2d');
      ctx.clearRect(0, 0, autoFuelShotCanvas.width, autoFuelShotCanvas.height);
    }

    const autoFuelFerriedCanvas = document.getElementById('autoFuelFerriedChart');
    if (autoFuelFerriedCanvas) {
      const ctx = autoFuelFerriedCanvas.getContext('2d');
      ctx.clearRect(0, 0, autoFuelFerriedCanvas.width, autoFuelFerriedCanvas.height);
    }

    // Clear tele fuel charts
    const teleFuelShotCanvas = document.getElementById('teleFuelShotChart');
    if (teleFuelShotCanvas) {
      const ctx = teleFuelShotCanvas.getContext('2d');
      ctx.clearRect(0, 0, teleFuelShotCanvas.width, teleFuelShotCanvas.height);
    }

    const teleFuelFerriedCanvas = document.getElementById('teleFuelFerriedChart');
    if (teleFuelFerriedCanvas) {
      const ctx = teleFuelFerriedCanvas.getContext('2d');
      ctx.clearRect(0, 0, teleFuelFerriedCanvas.width, teleFuelFerriedCanvas.height);
    }

    const autoPathContent = document.getElementById('autoPathContent');
    if (autoPathContent) {
      autoPathContent.innerHTML = '<p style="color: #aaa; margin: 0; font-size: 14px;">No auto path data</p>';
    }
    return;
  }

  // Reset all dropdown filters
  const autoPathFilter = document.getElementById('autoPathFilter');
  const autoClimbFilter = document.getElementById('autoClimbFilter');
  const teleClimbPositionFilterDropdown = document.getElementById('teleClimbPositionFilterDropdown');
  const autoFuelShotFilter = document.getElementById('autoFuelShotFilter');
  const autoFuelFerriedFilter = document.getElementById('autoFuelFerriedFilter');

  if (autoPathFilter) autoPathFilter.value = 'all';
  if (autoClimbFilter) autoClimbFilter.value = 'all';
  if (teleClimbPositionFilterDropdown) teleClimbPositionFilterDropdown.value = 'all';
  if (autoFuelShotFilter) autoFuelShotFilter.value = 'all';
  if (autoFuelFerriedFilter) autoFuelFerriedFilter.value = 'all';

  teleClimbPositionFilterValue = 'all';

  // Load pit scouting data
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

  // Render all charts and data
  renderTeamStatistics(teamData, pitData);
  renderFlaggedMatches(teamData);
  renderAutoClimbChart(teamData);
  renderTeleClimbChart(teamData);
  renderAutoPaths(teamData);
  renderScouterComments(teamData);
  // Add this at the end of searchTeam function, before return false;
  renderTeleFuelWeightedGraph(teamData);

  // Calculate global max for auto fuel charts
  const globalMaxAutoFuel = calculateGlobalMaxFuel(teamData);
  renderAutoFuelShotChart(teamData, globalMaxAutoFuel);
  renderAutoFuelFerriedChart(teamData, globalMaxAutoFuel);

  // Render tele fuel charts (no position filtering)
  renderTeleFuelShotChart(teamData);
  renderTeleFuelFerriedChart(teamData);

  return false;
}
// Helper function to calculate global max across both fuel metrics
function calculateGlobalMaxFuel(teamData) {
  let maxShot = 0;
  let maxFerried = 0;

  teamData.forEach(row => {
    const autoFuelShot = parseFloat(row['Auto Fuel Shot'] || 0);
    const autoFuelFerried = parseFloat(row['Auto Fuel Ferried'] || 0);

    if (!isNaN(autoFuelShot)) {
      maxShot = Math.max(maxShot, autoFuelShot);
    }
    if (!isNaN(autoFuelFerried)) {
      maxFerried = Math.max(maxFerried, autoFuelFerried);
    }
  });

  return Math.max(maxShot, maxFerried);
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

  // Calculate Average Shot (combining auto and tele fuel shots)
  const autoFuelShots = teamData.map(row => parseFloat(row['Auto Fuel Shot'] || 0)).filter(v => !isNaN(v));
  const teleFuelShots = teamData.map(row => parseFloat(row['Tele Fuel Shot'] || 0)).filter(v => !isNaN(v));
  const allShots = [...autoFuelShots, ...teleFuelShots];
  const avgShot = allShots.length > 0 ? allShots.reduce((a, b) => a + b, 0) / allShots.length : 0;

  // Calculate Average Ferried (combining auto and tele fuel ferried)
  const autoFuelFerried = teamData.map(row => parseFloat(row['Auto Fuel Ferried'] || 0)).filter(v => !isNaN(v));
  const teleFuelFerried = teamData.map(row => parseFloat(row['Tele Fuel Ferried'] || 0)).filter(v => !isNaN(v));
  const allFerried = [...autoFuelFerried, ...teleFuelFerried];
  const avgFerried = allFerried.length > 0 ? allFerried.reduce((a, b) => a + b, 0) / allFerried.length : 0;

  document.getElementById('avgShot').textContent = avgShot.toFixed(2);
  document.getElementById('avgFerried').textContent = avgFerried.toFixed(2);

  // Calculate EPA (average of total points only - no OPR)
  const totalPoints = teamData.map(row => parseFloat(row['Total Points'] || row['Total Score'] || 0)).filter(v => !isNaN(v));
  const epa = totalPoints.length > 0 ? totalPoints.reduce((a, b) => a + b, 0) / totalPoints.length : 0;
  document.getElementById('averageEPA').textContent = epa.toFixed(2);

  // Calculate Shooting Accuracy
  const shootingAccuracy = (() => {
    const accuracyVals = teamData
      .map(row => parseFloat(row['Shooting Accuracy']))
      .filter(v => !isNaN(v));
    return accuracyVals.length > 0
      ? (accuracyVals.reduce((a, b) => a + b, 0) / accuracyVals.length).toFixed(2)
      : '0.00';
  })();
  document.getElementById('shootingAccuracy').textContent = shootingAccuracy;

  // Calculate Climb Success %
  const climbValues = teamData.map(row => row['Climb Teleop']?.toString().trim()).filter(v => v && v !== '');
  const successfulClimbs = climbValues.filter(v => ['1', '2', '3'].includes(v)).length;
  const totalClimbAttempts = climbValues.filter(v => ['1', '2', '3', 'F'].includes(v)).length;
  const climbSuccessRate = totalClimbAttempts > 0 ? ((successfulClimbs / totalClimbAttempts) * 100).toFixed(1) : "0.0";
  document.getElementById('climbSuccessRate').textContent = climbSuccessRate;

  // Calculate Robot Died %
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

    const startingPosition = row['Starting Position']?.toString().trim();
    const isRobotMissing = startingPosition === 'R';

    const reasons = [];

    if (isRobotMissing) {
      flaggedMatches.push(`<div style="margin-bottom: 16px; font-size: 16px; line-height: 1.5;"><strong style="font-size: 16px;">Q${matchNum}:</strong> <span style="color: #ff5c5c; font-weight: bold; text-transform: uppercase;">ROBOT MISSING</span></div>`);
      return;
    }

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
        },
        datalabels: {
          display: false // Ensure no data labels on bars
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
            maxTicksLimit: matches.length,
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

function renderAutoFuelShotChart(teamData, globalMax) {
  const canvas = document.getElementById('autoFuelShotChart');
  if (!canvas) {
    console.warn('autoFuelShotChart canvas not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  if (charts.autoFuelShotChart) {
    charts.autoFuelShotChart.destroy();
    charts.autoFuelShotChart = null;
  }

  if (!teamData || teamData.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No auto fuel shot data', canvas.width / 2, canvas.height / 2);
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

    const autoFuelShot = parseFloat(row['Auto Fuel Shot'] || 0);
    if (isNaN(autoFuelShot)) return;

    matches.push(`Q${matchNum}`);
    fuelShotValues.push(autoFuelShot);

    // Always use blue color regardless of value
    barColors.push('#3EDBF0');
  });

  if (matches.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No auto fuel shot data', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Calculate y-axis max based on globalMax with step size 3
  const yAxisMax = Math.ceil(globalMax / 3) * 3 || 27; // Round up to nearest multiple of 3, default to 27

  charts.autoFuelShotChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: matches,
      datasets: [{
        label: 'Auto Fuel Shot',
        data: fuelShotValues,
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
              return `Fuel Shots: ${context.raw}`;
            }
          }
        },
        datalabels: {
          display: false // Ensure no data labels on bars
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
            maxTicksLimit: matches.length,
            padding: 10
          }
        },
        y: {
          beginAtZero: true,
          max: yAxisMax,
          grid: {
            display: false,
            drawBorder: false,
            drawOnChartArea: false,
            drawTicks: false
          },
          ticks: {
            color: 'white',
            maxTicksLimit: 6,
            font: {
              family: 'Lato',
              size: 16,
              weight: 'bold'
            },
            stepSize: 3,
            callback: function (value) {
              return Math.round(value);
            },
            padding: 10
          }
        }
      }
    }
  });
}

function renderAutoFuelFerriedChart(teamData, globalMax) {
  const canvas = document.getElementById('autoFuelFerriedChart');
  if (!canvas) {
    console.warn('autoFuelFerriedChart canvas not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  if (charts.autoFuelFerriedChart) {
    charts.autoFuelFerriedChart.destroy();
    charts.autoFuelFerriedChart = null;
  }

  if (!teamData || teamData.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No auto fuel ferried data', canvas.width / 2, canvas.height / 2);
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

    const autoFuelFerried = parseFloat(row['Auto Fuel Ferried'] || 0);
    if (isNaN(autoFuelFerried)) return;

    matches.push(`Q${matchNum}`);
    fuelFerriedValues.push(autoFuelFerried);

    // Always use blue color regardless of value
    barColors.push('rgb(0, 184, 148)'); // #3EDBF0
  });

  if (matches.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No auto fuel ferried data', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Calculate y-axis max based on globalMax with step size 3
  const yAxisMax = Math.ceil(globalMax / 3) * 3 || 27; // Round up to nearest multiple of 3, default to 27

  charts.autoFuelFerriedChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: matches,
      datasets: [{
        label: 'Auto Fuel Ferried',
        data: fuelFerriedValues,
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
              return `Fuel Ferried: ${context.raw}`;
            }
          }
        },
        datalabels: {
          display: false // Ensure no data labels on bars
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
            maxTicksLimit: matches.length,
            padding: 10
          }
        },
        y: {
          beginAtZero: true,
          max: yAxisMax,
          grid: {
            display: false,
            drawBorder: false,
            drawOnChartArea: false,
            drawTicks: false
          },
          ticks: {
            color: 'white',
            maxTicksLimit: 6,
            font: {
              family: 'Lato',
              size: 16,
              weight: 'bold'
            },
            stepSize: 3,
            callback: function (value) {
              return Math.round(value);
            },
            padding: 10
          }
        }
      }
    }
  });
}

function renderTeleFuelShotChart(teamData) {
  const canvas = document.getElementById('teleFuelShotChart');
  if (!canvas) {
    console.warn('teleFuelShotChart canvas not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  if (charts.teleFuelShotChart) {
    charts.teleFuelShotChart.destroy();
    charts.teleFuelShotChart = null;
  }

  if (!teamData || teamData.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
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

    // Always use blue color regardless of value
    barColors.push('#3EDBF0');
  });

  if (matches.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No tele fuel shot data', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Calculate global max for tele fuel metrics to ensure consistent y-axis
  const globalMaxTeleFuel = calculateGlobalMaxTeleFuel(teamData);
  const yAxisMax = Math.ceil(globalMaxTeleFuel / 3) * 3 || 27; // Round up to nearest multiple of 3, default to 27

  charts.teleFuelShotChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: matches,
      datasets: [{
        label: 'Tele Fuel Shot',
        data: fuelShotValues,
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
              return `Fuel Shots: ${context.raw}`;
            }
          }
        },
        datalabels: {
          display: false // Ensure no data labels on bars
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
            maxTicksLimit: matches.length,
            padding: 10
          }
        },
        y: {
          beginAtZero: true,
          max: yAxisMax,
          grid: {
            display: false,
            drawBorder: false,
            drawOnChartArea: false,
            drawTicks: false
          },
          ticks: {
            color: 'white',
            maxTicksLimit: 6,
            font: {
              family: 'Lato',
              size: 16,
              weight: 'bold'
            },
            stepSize: 3,
            callback: function (value) {
              return Math.round(value);
            },
            padding: 10
          }
        }
      }
    }
  });
}

function renderTeleFuelFerriedChart(teamData) {
  const canvas = document.getElementById('teleFuelFerriedChart');
  if (!canvas) {
    console.warn('teleFuelFerriedChart canvas not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  if (charts.teleFuelFerriedChart) {
    charts.teleFuelFerriedChart.destroy();
    charts.teleFuelFerriedChart = null;
  }

  if (!teamData || teamData.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
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

    // Always use blue color regardless of value
    barColors.push('rgb(0, 184, 148)'); // #3EDBF0
  });

  if (matches.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No tele fuel ferried data', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Calculate global max for tele fuel metrics to ensure consistent y-axis
  const globalMaxTeleFuel = calculateGlobalMaxTeleFuel(teamData);
  const yAxisMax = Math.ceil(globalMaxTeleFuel / 3) * 3 || 27; // Round up to nearest multiple of 3, default to 27

  charts.teleFuelFerriedChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: matches,
      datasets: [{
        label: 'Tele Fuel Ferried',
        data: fuelFerriedValues,
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
              return `Fuel Ferried: ${context.raw}`;
            }
          }
        },
        datalabels: {
          display: false // Ensure no data labels on bars
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
            maxTicksLimit: matches.length,
            padding: 10
          }
        },
        y: {
          beginAtZero: true,
          max: yAxisMax,
          grid: {
            display: false,
            drawBorder: false,
            drawOnChartArea: false,
            drawTicks: false
          },
          ticks: {
            color: 'white',
            maxTicksLimit: 6,
            font: {
              family: 'Lato',
              size: 16,
              weight: 'bold'
            },
            stepSize: 3,
            callback: function (value) {
              return Math.round(value);
            },
            padding: 10
          }
        }
      }
    }
  });
}

// Helper function to calculate global max across both tele fuel metrics
function calculateGlobalMaxTeleFuel(teamData) {
  let maxShot = 0;
  let maxFerried = 0;

  teamData.forEach(row => {
    const teleFuelShot = parseFloat(row['Tele Fuel Shot'] || 0);
    const teleFuelFerried = parseFloat(row['Tele Fuel Ferried'] || 0);

    if (!isNaN(teleFuelShot)) {
      maxShot = Math.max(maxShot, teleFuelShot);
    }
    if (!isNaN(teleFuelFerried)) {
      maxFerried = Math.max(maxFerried, teleFuelFerried);
    }
  });

  return Math.max(maxShot, maxFerried);
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

function renderTeleFuelWeightedGraph(teamData) {
  const canvas = document.getElementById('teleFuelWeightedGraph');
  if (!canvas) {
    console.warn('teleFuelWeightedGraph canvas not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  if (charts.teleFuelWeightedGraph) {
    charts.teleFuelWeightedGraph.destroy();
    charts.teleFuelWeightedGraph = null;
  }

  if (!teamData || teamData.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No tele fuel data', canvas.width / 2, canvas.height / 2);
    document.getElementById('weightedTeleFuelAmount').textContent = '0.00';
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
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No tele fuel data', canvas.width / 2, canvas.height / 2);
    document.getElementById('weightedTeleFuelAmount').textContent = '0.00';
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
  const weightedTeleFuelDisplay = document.getElementById('weightedTeleFuelAmount');
  if (weightedTeleFuelDisplay) {
    weightedTeleFuelDisplay.textContent = weightedTeleFuel.toFixed(2);
  }

  // Create datasets
  const datasets = [
    {
      label: 'Tele Fuel Scored',
      data: teleFuelValues,
      borderColor: '#3EDBF0',
      backgroundColor: 'transparent',
      borderWidth: 3,
      tension: 0,
      pointBackgroundColor: '#3EDBF0',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 8,
      pointHoverRadius: 10,
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
      borderWidth: 3,
      borderDash: [8, 6],
      tension: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false
    });
  }

  charts.teleFuelWeightedGraph = new Chart(ctx, {
    type: 'line',
    data: {
      labels: matches,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 2,
      layout: {
        padding: {
          bottom: 35,
          top: 30,
          left: 15,
          right: 15
        }
      },
      plugins: {
        legend: {
          display: false,
          labels: {
            color: 'white',
            font: {
              family: 'Lato',
              size: 14,
              weight: 'bold'
            },
            usePointStyle: true,
            pointStyle: 'line'
          },
          position: 'top',
          align: 'center'
        },
        tooltip: {
          backgroundColor: '#1C1E21',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#000',
          borderWidth: 1,
          padding: 12,
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
              size: 16,
              weight: 'bold'
            },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12,
            padding: 10
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
            maxTicksLimit: 10,
            font: {
              family: 'Lato',
              size: 16,
              weight: 'bold'
            },
            stepSize: 5,
            callback: function (value) {
              return Math.round(value);
            },
            padding: 10
          }
        }
      }
    }
  });
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
  const tooltipPositions = [];

  sortedData.forEach(row => {
    const matchNum = row['Match'] || row['Match Number'];
    if (!matchNum) return;

    const climbTeleop = row['Climb Teleop']?.toString().trim();
    if (!climbTeleop || climbTeleop === '') return;

    matches.push(`Q${matchNum}`);

    const startingPos = row['Starting Position']?.toString().trim() || '';
    const positionName = getPositionName(startingPos);

    let yValue = 0;
    let color = '#3EDBF0';
    let levelText = '';

    if (climbTeleop === '3') {
      yValue = 3;
      color = '#3EDBF0';
      levelText = 'Level 3';
    } else if (climbTeleop === '2') {
      yValue = 2;
      color = '#3EDBF0';
      levelText = 'Level 2';
    } else if (climbTeleop === '1') {
      yValue = 1;
      color = '#3EDBF0';
      levelText = 'Level 1';
    } else if (climbTeleop === 'F') {
      yValue = 0.5;
      color = '#ff5c5c';
      levelText = 'Failed';
    } else if (climbTeleop === '0') {
      yValue = 0;
      color = '#3EDBF0';
      levelText = 'Not Attempted';
    }

    climbValues.push(yValue);
    barColors.push(color);
    tooltipLevels.push(levelText);
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

              if (tooltipPositions[index] && tooltipPositions[index] !== '' && tooltipPositions[index] !== 'Unknown') {
                lines.push(`Position: ${tooltipPositions[index]}`);
              }

              return lines;
            },
            title: function (context) {
              return context[0].label;
            }
          }
        },
        datalabels: {
          display: false // Ensure no data labels on bars
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
              size: 16, // Increased from 13 to 16
              weight: 'bold' // Added bold weight
            },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: matches.length,
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
              size: 16, // Increased from 13 to 16
              weight: 'bold' // Added bold weight
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

// Also update the comparison tele climb chart for consistency
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
          },
          datalabels: {
            display: false // This removes the numbers from the top of the bars
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
                size: 16, // Increased from 13 to 16
                weight: 'bold' // Added bold weight
              },
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: matches.length,
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
                size: 16, // Increased from 13 to 16
                weight: 'bold' // Added bold weight
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

    console.log(`Row for match ${matchNum}:`, row);

    const travelString = row['Travel String'];
    const fuelString = row['Fuel Collection String'];

    const hasTravel = travelString && String(travelString).trim() !== '' && String(travelString).trim() !== '-';
    const hasFuel = fuelString && String(fuelString).trim() !== '' && String(fuelString).trim() !== '-';

    if (!hasTravel && !hasFuel) {
      pathEntries.push(`
        <div style="margin-bottom: 16px; font-size: 18px; line-height: 1.5;">
          <strong style="color: white; font-size: 15px;">Q${matchNum}:</strong> 
          <span style="color: #ddd;">N/A</span>
        </div>
      `);
      return;
    }

    const travelText = travelString ? String(travelString).trim() : '';
    const fuelText = fuelString ? String(fuelString).trim() : '';

    let sentence = '';

    if (travelText && fuelText) {
      sentence = travelText + ' and ' + fuelText;
    } else if (travelText) {
      sentence = travelText;
    } else if (fuelText) {
      sentence = fuelText;
    }

    if (sentence) {
      sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);

      if (!sentence.endsWith('.')) {
        sentence += '.';
      }
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
// Add this to the window.comparisonCharts initialization
window.comparisonCharts = window.comparisonCharts || {
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
  teleFuelWeighted1: null,  // Add this
  teleFuelWeighted2: null   // Add this
};

// Function to calculate global max tele fuel for weighted graphs
function getGlobalMaxTeleFuelWeighted() {
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

  processTeam(window.comparisonTeamData[1]);
  processTeam(window.comparisonTeamData[2]);

  return maxFuel;
}


function renderComparisonTeleFuelWeightedGraph(column) {
  const canvas = document.getElementById(`comparisonTeleFuelWeightedGraph${column}`);
  if (!canvas) {
    console.error(`Canvas comparisonTeleFuelWeightedGraph${column} not found`);
    return;
  }

  const ctx = canvas.getContext('2d');
  const chartKey = `teleFuelWeighted${column}`;

  // Destroy existing chart
  if (window.comparisonCharts && window.comparisonCharts[chartKey]) {
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
    ctx.fillText('No tele fuel data', canvas.width / 2, canvas.height / 2);

    // Clear the weighted tele fuel display
    const displayElement = document.getElementById(`comparisonWeightedTeleFuel${column}`);
    if (displayElement) displayElement.textContent = '0.00';
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
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No tele fuel data', canvas.width / 2, canvas.height / 2);

    const displayElement = document.getElementById(`comparisonWeightedTeleFuel${column}`);
    if (displayElement) displayElement.textContent = '0.00';
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
  const displayElement = document.getElementById(`comparisonWeightedTeleFuel${column}`);
  if (displayElement) {
    displayElement.textContent = weightedTeleFuel.toFixed(2);
  }

  // Get global max for y-axis synchronization
  const globalMax = getGlobalMaxTeleFuelWeighted();
  const yAxisMax = Math.ceil(globalMax / 5) * 5 || 25; // Round up to nearest 5, default to 25

  // Create datasets
  const datasets = [
    {
      label: 'Tele Fuel Scored',
      data: teleFuelValues,
      borderColor: '#3EDBF0',
      backgroundColor: 'transparent',
      borderWidth: 3,
      tension: 0,
      pointBackgroundColor: '#3EDBF0',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 8,
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
      borderWidth: 3,
      borderDash: [8, 6],
      tension: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false
    });
  }

  try {
    window.comparisonCharts[chartKey] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: matches,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: 2,
        layout: {
          padding: {
            bottom: 35,
            top: 30,
            left: 15,
            right: 15
          }
        },
        plugins: {
          legend: {
            display: false,
            labels: {
              color: 'white',
              font: {
                family: 'Lato',
                size: 16,
                weight: 'bold'
              },
              usePointStyle: true,
              pointStyle: 'line'
            },
            position: 'top',
            align: 'center'
          },
          tooltip: {
            backgroundColor: '#1C1E21',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#000',
            borderWidth: 1,
            padding: 10,
            titleFont: {
              size: 16,
              weight: 'bold',
              family: 'Lato'
            },
            bodyFont: {
              size: 16,
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
                size: 16,
                weight: 'bold'
              },
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              padding: 8
            }
          },
          y: {
            beginAtZero: true,
            max: yAxisMax, // Synchronized y-axis
            grid: {
              display: false,
              drawBorder: false,
              drawOnChartArea: false,
              drawTicks: false
            },
            ticks: {
              color: 'white',
              maxTicksLimit: 10,
              font: {
                family: 'Lato',
                size: 16,
                weight: 'bold'
              },
              stepSize: 5,
              callback: function (value) {
                return Math.round(value);
              },
              padding: 8
            }
          }
        }
      }
    });
    console.log(`Tele fuel weighted graph created for column ${column} with y-axis max: ${yAxisMax}`);
  } catch (error) {
    console.error('Error creating tele fuel weighted graph:', error);
  }
}
// Function to calculate global max tele fuel ferried across both teams
function getGlobalMaxTeleFuelFerried() {
  let maxFerried = 0;

  const processTeam = (teamData) => {
    if (!teamData) return;
    teamData.forEach(row => {
      const teleFuelFerried = parseFloat(row['Tele Fuel Ferried'] || 0);
      if (!isNaN(teleFuelFerried)) {
        maxFerried = Math.max(maxFerried, teleFuelFerried);
      }
    });
  };

  processTeam(window.comparisonTeamData[1]);
  processTeam(window.comparisonTeamData[2]);

  return maxFerried;
}

// Function to render comparison auto fuel shot chart
function renderComparisonAutoFuelShotChart(column) {
  const canvas = document.getElementById(`comparisonAutoFuelShotChart${column}`);
  if (!canvas) {
    console.error(`Canvas comparisonAutoFuelShotChart${column} not found`);
    return;
  }

  const ctx = canvas.getContext('2d');
  const chartKey = `autoFuelShot${column}`;

  // Destroy existing chart
  if (window.comparisonCharts && window.comparisonCharts[chartKey]) {
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
    ctx.fillText('No auto fuel shot data', canvas.width / 2, canvas.height / 2);
    return;
  }

  const filterValue = document.getElementById(`comparisonAutoFuelShotFilter${column}`)?.value || 'all';

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
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No auto fuel shot data', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Get global max from both teams for consistent y-axis
  const globalMax = getGlobalMaxAutoFuelShot();
  const yAxisMax = Math.ceil(globalMax / 5) * 5 || 30; // Round up to nearest multiple of 5, default to 30

  try {
    window.comparisonCharts[chartKey] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: matches,
        datasets: [{
          label: 'Auto Fuel Shot',
          data: fuelShotValues,
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
                return `Fuel Shots: ${context.raw}`;
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
                size: 16,
                weight: 'bold'
              },
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: matches.length,
              padding: 10
            }
          },
          y: {
            beginAtZero: true,
            max: yAxisMax,
            grid: {
              display: false,
              drawBorder: false,
              drawOnChartArea: false,
              drawTicks: false
            },
            ticks: {
              color: 'white',
              maxTicksLimit: 6, // Added maxTicksLimit: 6
              font: {
                family: 'Lato',
                size: 16,
                weight: 'bold'
              },
              stepSize: 5,
              callback: function (value) {
                return Math.round(value);
              },
              padding: 10
            }
          }
        }
      }
    });
    console.log(`Auto fuel shot chart created for column ${column} with y-axis max: ${yAxisMax}`);
  } catch (error) {
    console.error('Error creating auto fuel shot chart:', error);
  }
}

// Function to render comparison auto fuel ferried chart
function renderComparisonAutoFuelFerriedChart(column) {
  const canvas = document.getElementById(`comparisonAutoFuelFerriedChart${column}`);
  if (!canvas) {
    console.error(`Canvas comparisonAutoFuelFerriedChart${column} not found`);
    return;
  }

  const ctx = canvas.getContext('2d');
  const chartKey = `autoFuelFerried${column}`;

  // Destroy existing chart
  if (window.comparisonCharts && window.comparisonCharts[chartKey]) {
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
    ctx.fillText('No auto fuel ferried data', canvas.width / 2, canvas.height / 2);
    return;
  }

  const filterValue = document.getElementById(`comparisonAutoFuelFerriedFilter${column}`)?.value || 'all';

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
  const fuelFerriedValues = [];
  const barColors = [];

  sortedData.forEach(row => {
    const matchNum = row['Match'] || row['Match Number'];
    if (!matchNum) return;

    const autoFuelFerried = parseFloat(row['Auto Fuel Ferried'] || 0);
    if (isNaN(autoFuelFerried)) return;

    matches.push(`Q${matchNum}`);
    fuelFerriedValues.push(autoFuelFerried);
    barColors.push('rgb(0, 184, 148)'); // Teal color for ferried
  });

  if (matches.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No auto fuel ferried data', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Get global max from both teams for consistent y-axis
  const globalMax = getGlobalMaxAutoFuelFerried();
  const yAxisMax = Math.ceil(globalMax / 5) * 5 || 30;

  try {
    window.comparisonCharts[chartKey] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: matches,
        datasets: [{
          label: 'Auto Fuel Ferried',
          data: fuelFerriedValues,
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
                return `Fuel Ferried: ${context.raw}`;
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
                size: 16,
                weight: 'bold'
              },
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: matches.length,
              padding: 10
            }
          },
          y: {
            beginAtZero: true,
            max: yAxisMax,
            grid: {
              display: false,
              drawBorder: false,
              drawOnChartArea: false,
              drawTicks: false
            },
            ticks: {
              color: 'white',
              maxTicksLimit: 6, // Added maxTicksLimit: 6
              font: {
                family: 'Lato',
                size: 16,
                weight: 'bold'
              },
              stepSize: 5,
              callback: function (value) {
                return Math.round(value);
              },
              padding: 10
            }
          }
        }
      }
    });
    console.log(`Auto fuel ferried chart created for column ${column} with y-axis max: ${yAxisMax}`);
  } catch (error) {
    console.error('Error creating auto fuel ferried chart:', error);
  }
}

// Function to render comparison tele fuel shot chart
function renderComparisonTeleFuelShotChart(column) {
  const canvas = document.getElementById(`comparisonTeleFuelShotChart${column}`);
  if (!canvas) {
    console.error(`Canvas comparisonTeleFuelShotChart${column} not found`);
    return;
  }

  const ctx = canvas.getContext('2d');
  const chartKey = `teleFuelShot${column}`;

  // Destroy existing chart
  if (window.comparisonCharts && window.comparisonCharts[chartKey]) {
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
    barColors.push('#3EDBF0'); // Blue color for tele fuel shot
  });

  if (matches.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No tele fuel shot data', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Get global max from both teams for consistent y-axis
  const globalMax = getGlobalMaxTeleFuelShot();
  const yAxisMax = Math.ceil(globalMax / 5) * 5 || 30; // Round up to nearest multiple of 5, default to 30

  try {
    window.comparisonCharts[chartKey] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: matches,
        datasets: [{
          label: 'Tele Fuel Shot',
          data: fuelShotValues,
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
                return `Fuel Shots: ${context.raw}`;
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
                size: 16,
                weight: 'bold'
              },
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: matches.length,
              padding: 10
            }
          },
          y: {
            beginAtZero: true,
            max: yAxisMax,
            grid: {
              display: false,
              drawBorder: false,
              drawOnChartArea: false,
              drawTicks: false
            },
            ticks: {
              color: 'white',
              maxTicksLimit: 6, // Added maxTicksLimit: 6
              font: {
                family: 'Lato',
                size: 16,
                weight: 'bold'
              },
              stepSize: 5,
              callback: function (value) {
                return Math.round(value);
              },
              padding: 10
            }
          }
        }
      }
    });
    console.log(`Tele fuel shot chart created for column ${column} with y-axis max: ${yAxisMax}`);
  } catch (error) {
    console.error('Error creating tele fuel shot chart:', error);
  }
}

// Function to render comparison tele fuel ferried chart
function renderComparisonTeleFuelFerriedChart(column) {
  const canvas = document.getElementById(`comparisonTeleFuelFerriedChart${column}`);
  if (!canvas) {
    console.error(`Canvas comparisonTeleFuelFerriedChart${column} not found`);
    return;
  }

  const ctx = canvas.getContext('2d');
  const chartKey = `teleFuelFerried${column}`;

  // Destroy existing chart
  if (window.comparisonCharts && window.comparisonCharts[chartKey]) {
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
    barColors.push('rgb(0, 184, 148)'); // Teal color for ferried
  });

  if (matches.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Lato';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No tele fuel ferried data', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Get global max from both teams for consistent y-axis
  const globalMax = getGlobalMaxTeleFuelFerried();
  const yAxisMax = Math.ceil(globalMax / 5) * 5 || 30; // Round up to nearest multiple of 5, default to 30

  try {
    window.comparisonCharts[chartKey] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: matches,
        datasets: [{
          label: 'Tele Fuel Ferried',
          data: fuelFerriedValues,
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
                return `Fuel Ferried: ${context.raw}`;
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
                size: 16,
                weight: 'bold'
              },
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: matches.length,
              padding: 10
            }
          },
          y: {
            beginAtZero: true,
            max: yAxisMax,
            grid: {
              display: false,
              drawBorder: false,
              drawOnChartArea: false,
              drawTicks: false
            },
            ticks: {
              color: 'white',
              maxTicksLimit: 6, 
              font: {
                family: 'Lato',
                size: 16,
                weight: 'bold'
              },
              stepSize: 5,
              callback: function (value) {
                return Math.round(value);
              },
              padding: 10
            }
          }
        }
      }
    });
    console.log(`Tele fuel ferried chart created for column ${column} with y-axis max: ${yAxisMax}`);
  } catch (error) {
    console.error('Error creating tele fuel ferried chart:', error);
  }
}

function getGlobalMaxAutoFuelFerried() {
  let maxFerried = 0;

  const processTeam = (teamData) => {
    if (!teamData) return;
    teamData.forEach(row => {
      const autoFuelFerried = parseFloat(row['Auto Fuel Ferried'] || 0);
      if (!isNaN(autoFuelFerried)) {
        maxFerried = Math.max(maxFerried, autoFuelFerried);
      }
    });
  };

  processTeam(window.comparisonTeamData[1]);
  processTeam(window.comparisonTeamData[2]);

  return maxFerried;
}


function syncComparisonAutoFuelFerriedDropdowns(value, sourceColumn) {
  const dropdown1 = document.getElementById('comparisonAutoFuelFerriedFilter1');
  const dropdown2 = document.getElementById('comparisonAutoFuelFerriedFilter2');

  if (!dropdown1 || !dropdown2) return;

  if (sourceColumn === 1) {
    dropdown2.value = value;
  } else if (sourceColumn === 2) {
    dropdown1.value = value;
  }

  renderComparisonAutoFuelFerriedChart(1);
  renderComparisonAutoFuelFerriedChart(2);
}

// Unified function to sync all auto dropdowns in comparison view
function syncAllComparisonAutoDropdowns(value, sourceColumn, sourceType) {
  // Get all dropdowns
  const autoPath1 = document.getElementById('comparisonAutoPathFilter1');
  const autoPath2 = document.getElementById('comparisonAutoPathFilter2');
  const autoClimb1 = document.getElementById('comparisonAutoClimbFilter1');
  const autoClimb2 = document.getElementById('comparisonAutoClimbFilter2');
  const autoFuelShot1 = document.getElementById('comparisonAutoFuelShotFilter1');
  const autoFuelShot2 = document.getElementById('comparisonAutoFuelShotFilter2');
  const autoFuelFerried1 = document.getElementById('comparisonAutoFuelFerriedFilter1');
  const autoFuelFerried2 = document.getElementById('comparisonAutoFuelFerriedFilter2');

  // Sync all dropdowns regardless of source
  if (autoPath1 && autoPath2) {
    autoPath1.value = value;
    autoPath2.value = value;
  }

  if (autoClimb1 && autoClimb2) {
    autoClimb1.value = value;
    autoClimb2.value = value;
  }

  if (autoFuelShot1 && autoFuelShot2) {
    autoFuelShot1.value = value;
    autoFuelShot2.value = value;
  }

  if (autoFuelFerried1 && autoFuelFerried2) {
    autoFuelFerried1.value = value;
    autoFuelFerried2.value = value;
  }

  // Re-render all auto-related charts for both columns
  displayAutoPaths(1);
  displayAutoPaths(2);
  renderComparisonAutoClimbChart(1);
  renderComparisonAutoClimbChart(2);
  renderComparisonAutoFuelShotChart(1);
  renderComparisonAutoFuelShotChart(2);
  renderComparisonAutoFuelFerriedChart(1);
  renderComparisonAutoFuelFerriedChart(2);
}

// Individual filter functions that call the unified sync
function filterComparisonAutoPaths(column) {
  const currentValue = document.getElementById(`comparisonAutoPathFilter${column}`).value;
  syncAllComparisonAutoDropdowns(currentValue, column, 'path');
}

function filterComparisonAutoClimb(column) {
  const currentValue = document.getElementById(`comparisonAutoClimbFilter${column}`).value;
  syncAllComparisonAutoDropdowns(currentValue, column, 'climb');
}

function filterComparisonAutoFuelShot(column) {
  const currentValue = document.getElementById(`comparisonAutoFuelShotFilter${column}`).value;
  syncAllComparisonAutoDropdowns(currentValue, column, 'fuelShot');
}

function filterComparisonAutoFuelFerried(column) {
  const currentValue = document.getElementById(`comparisonAutoFuelFerriedFilter${column}`).value;
  syncAllComparisonAutoDropdowns(currentValue, column, 'fuelFerried');
}

// Initialize all dropdowns with the unified sync
function initializeAllAutoDropdownSync() {
  const dropdownConfigs = [
    { id: 'comparisonAutoPathFilter1', type: 'path', column: 1 },
    { id: 'comparisonAutoPathFilter2', type: 'path', column: 2 },
    { id: 'comparisonAutoClimbFilter1', type: 'climb', column: 1 },
    { id: 'comparisonAutoClimbFilter2', type: 'climb', column: 2 },
    { id: 'comparisonAutoFuelShotFilter1', type: 'fuelShot', column: 1 },
    { id: 'comparisonAutoFuelShotFilter2', type: 'fuelShot', column: 2 },
    { id: 'comparisonAutoFuelFerriedFilter1', type: 'fuelFerried', column: 1 },
    { id: 'comparisonAutoFuelFerriedFilter2', type: 'fuelFerried', column: 2 }
  ];

  dropdownConfigs.forEach(config => {
    const element = document.getElementById(config.id);
    if (element) {
      // Remove old event listeners
      element.removeEventListener('change', window[`${config.id}Handler`]);

      // Create new handler
      const handler = function (e) {
        syncAllComparisonAutoDropdowns(this.value, config.column, config.type);
      };

      // Store handler for potential removal
      window[`${config.id}Handler`] = handler;

      // Add new event listener
      element.addEventListener('change', handler);
    }
  });
}
// Function to calculate global max tele fuel shot across both teams
function getGlobalMaxTeleFuelShot() {
  let maxShot = 0;

  const processTeam = (teamData) => {
    if (!teamData) return;
    teamData.forEach(row => {
      const teleFuelShot = parseFloat(row['Tele Fuel Shot'] || 0);
      if (!isNaN(teleFuelShot)) {
        maxShot = Math.max(maxShot, teleFuelShot);
      }
    });
  };

  processTeam(window.comparisonTeamData[1]);
  processTeam(window.comparisonTeamData[2]);

  return maxShot;
}

function renderComparisonTeamStatistics(teamData, pitScoutingData, column) {
  if (!teamData || teamData.length === 0) return;

  const teamNumber = teamData[0]['Team Number']?.toString().trim();

  // Robot stats from pit scouting
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

  // Calculate Average Shot (combining auto and tele fuel shots)
  const autoFuelShots = teamData.map(row => parseFloat(row['Auto Fuel Shot'] || 0)).filter(v => !isNaN(v));
  const teleFuelShots = teamData.map(row => parseFloat(row['Tele Fuel Shot'] || 0)).filter(v => !isNaN(v));
  const allShots = [...autoFuelShots, ...teleFuelShots];
  const avgShot = allShots.length > 0 ? allShots.reduce((a, b) => a + b, 0) / allShots.length : 0;
  document.getElementById(`comparisonAvgShot${column}`).textContent = avgShot.toFixed(2);

  // Calculate Average Ferried (combining auto and tele fuel ferried)
  const autoFuelFerried = teamData.map(row => parseFloat(row['Auto Fuel Ferried'] || 0)).filter(v => !isNaN(v));
  const teleFuelFerried = teamData.map(row => parseFloat(row['Tele Fuel Ferried'] || 0)).filter(v => !isNaN(v));
  const allFerried = [...autoFuelFerried, ...teleFuelFerried];
  const avgFerried = allFerried.length > 0 ? allFerried.reduce((a, b) => a + b, 0) / allFerried.length : 0;
  document.getElementById(`comparisonAvgFerried${column}`).textContent = avgFerried.toFixed(2);

  // Calculate EPA (average of total points only - no OPR)
  const totalPoints = teamData.map(row => parseFloat(row['Total Points'] || row['Total Score'] || 0)).filter(v => !isNaN(v));
  const epa = totalPoints.length > 0 ? totalPoints.reduce((a, b) => a + b, 0) / totalPoints.length : 0;
  document.getElementById(`comparisonEPA${column}`).textContent = epa.toFixed(2);

  // Calculate Shooting Accuracy
  const shootingAccuracy = (() => {
    const accuracyVals = teamData
      .map(row => parseFloat(row['Shooting Accuracy']))
      .filter(v => !isNaN(v));
    return accuracyVals.length > 0
      ? (accuracyVals.reduce((a, b) => a + b, 0) / accuracyVals.length).toFixed(2)
      : '0.00';
  })();
  document.getElementById(`comparisonShootingAccuracy${column}`).textContent = shootingAccuracy;

  // Calculate Climb Success %
  const climbValues = teamData.map(row => row['Climb Teleop']?.toString().trim()).filter(v => v && v !== '');
  const successfulClimbs = climbValues.filter(v => ['1', '2', '3'].includes(v)).length;
  const totalClimbAttempts = climbValues.filter(v => ['1', '2', '3', 'F'].includes(v)).length;
  const climbSuccessRate = totalClimbAttempts > 0 ? ((successfulClimbs / totalClimbAttempts) * 100).toFixed(1) : "0.0";
  document.getElementById(`comparisonClimbRate${column}`).textContent = climbSuccessRate;

  // Calculate Robot Died %
  const diedCount = teamData.filter(row => {
    const val = parseFloat(row['Robot Died'] || row['Died or Immobilized'] || 0);
    return val === 0.5 || val === 1;
  }).length;
  const robotDiedRate = teamData.length ? ((diedCount / teamData.length) * 100).toFixed(1) : '0.0';
  document.getElementById(`comparisonDiedRate${column}`).textContent = robotDiedRate;

  // Removed climb time calculation and setting
}
async function searchComparison(column) {
  if (!window.comparisonTeamData) {
    window.comparisonTeamData = { 1: [], 2: [] };
  }
  if (!window.comparisonCharts) {
    window.comparisonCharts = {
      autoClimb1: null,
      autoClimb2: null,
      teleClimb1: null,
      teleClimb2: null,
      autoFuelShot1: null,
      autoFuelShot2: null,
      teleFuelShot1: null,
      teleFuelShot2: null,
      autoFuelFerried1: null,
      autoFuelFerried2: null,
      teleFuelFerried1: null,
      teleFuelFerried2: null,
      teleFuelWeighted1: null,
      teleFuelWeighted2: null
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

  const nicknameElement = document.getElementById(`comparisonNickname${column}`);
  if (nicknameElement) {
    try {
      const teamName = await fetchTeamName(teamNumber);
      nicknameElement.textContent = teamName || `Team ${teamNumber}`;
    } catch (err) {
      console.warn('Could not fetch team name for comparison view', err);
      nicknameElement.textContent = `Team ${teamNumber}`;
    }
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

    // Clear auto fuel shot chart
    const fuelCanvas = document.getElementById(`comparisonAutoFuelShotChart${column}`);
    if (fuelCanvas) {
      const ctx = fuelCanvas.getContext('2d');
      ctx.clearRect(0, 0, fuelCanvas.width, fuelCanvas.height);
      ctx.font = '16px Lato';
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'center';
      ctx.fillText('No data', fuelCanvas.width / 2, fuelCanvas.height / 2);
    }
    return;
  }

  window.comparisonTeamData[column] = teamData;

  loadPitScoutingData();

  renderComparisonTeamStatistics(teamData, pitScoutingData, column);

  displayAutoPaths(column);
  displayScouterComments(column);

  // Reset filters to 'all' for the searched team
  document.getElementById(`comparisonAutoPathFilter${column}`).value = 'all';
  document.getElementById(`comparisonAutoClimbFilter${column}`).value = 'all';
  document.getElementById(`comparisonAutoFuelShotFilter${column}`).value = 'all';
  document.getElementById(`comparisonAutoFuelFerriedFilter${column}`).value = 'all'; // Add this line


  // Render charts for both teams to ensure y-axis sync
  renderComparisonAutoClimbChart(1);
  renderComparisonAutoClimbChart(2);
  renderComparisonTeleClimbChart(1);
  renderComparisonTeleClimbChart(2);
  renderComparisonAutoFuelShotChart(1);
  renderComparisonAutoFuelShotChart(2);
  // Add this after rendering auto fuel shot charts
  renderComparisonAutoFuelFerriedChart(1);
  renderComparisonAutoFuelFerriedChart(2);
  renderComparisonTeleFuelShotChart(1);
  renderComparisonTeleFuelShotChart(2);
  // Add these lines after the tele fuel shot chart render calls
  renderComparisonTeleFuelFerriedChart(1);
  renderComparisonTeleFuelFerriedChart(2);
  // At the end of searchComparison function, add:
  renderComparisonTeleFuelWeightedGraph(1);
  renderComparisonTeleFuelWeightedGraph(2);
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

    const hasTravel = travelString && travelString !== '' && travelString !== '-';
    const hasFuel = fuelString && fuelString !== '' && fuelString !== '-';

    if (!hasTravel && !hasFuel) {
      pathEntries.push(`
        <div style="margin-bottom: 16px; font-size: 18px; line-height: 1.5;">
          <strong style="color: white; font-size: 15px;">Q${matchNum}:</strong> 
          <span style="color: white;">N/A</span>
        </div>
      `);
      return;
    }

    let sentence = '';

    if (travelString && fuelString) {
      let fuelText = fuelString;
      if (fuelText.length > 0) {
        fuelText = fuelText.charAt(0).toLowerCase() + fuelText.slice(1);
      }
      sentence = `${travelString} and ${fuelText}`;
    } else if (travelString) {
      sentence = travelString;
    } else if (fuelString) {
      sentence = fuelString.charAt(0).toUpperCase() + fuelString.slice(1);
    }

    if (sentence && !sentence.endsWith('.')) {
      sentence += '.';
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
          },
          datalabels: {
            display: false // This removes the numbers from the top of the bars
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
              maxTicksLimit: matches.length,
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
          },
          datalabels: {
            display: false // This ensures no data labels on bars
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
              maxTicksLimit: matches.length,
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

// Function to calculate global max auto fuel shot across both teams
function getGlobalMaxAutoFuelShot() {
  let maxShot = 0;

  const processTeam = (teamData) => {
    if (!teamData) return;
    teamData.forEach(row => {
      const autoFuelShot = parseFloat(row['Auto Fuel Shot'] || 0);
      if (!isNaN(autoFuelShot)) {
        maxShot = Math.max(maxShot, autoFuelShot);
      }
    });
  };

  processTeam(window.comparisonTeamData[1]);
  processTeam(window.comparisonTeamData[2]);

  return maxShot;
}

// Function to sync auto fuel shot dropdowns
function syncComparisonAutoFuelShotDropdowns(value, sourceColumn) {
  const dropdown1 = document.getElementById('comparisonAutoFuelShotFilter1');
  const dropdown2 = document.getElementById('comparisonAutoFuelShotFilter2');

  if (!dropdown1 || !dropdown2) return;

  if (sourceColumn === 1) {
    dropdown2.value = value;
  } else if (sourceColumn === 2) {
    dropdown1.value = value;
  }

  renderComparisonAutoFuelShotChart(1);
  renderComparisonAutoFuelShotChart(2);
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

  const autoFuelShotFilter1 = document.getElementById('comparisonAutoFuelShotFilter1');
  const autoFuelShotFilter2 = document.getElementById('comparisonAutoFuelShotFilter2');

  if (autoFuelShotFilter1) {
    autoFuelShotFilter1.addEventListener('change', function () {
      filterComparisonAutoFuelShot(1);
    });
  }

  if (autoFuelShotFilter2) {
    autoFuelShotFilter2.addEventListener('change', function () {
      filterComparisonAutoFuelShot(2);
    });
  }

  // Initialize auto fuel ferried dropdown sync
  const autoFuelFerriedFilter1 = document.getElementById('comparisonAutoFuelFerriedFilter1');
  const autoFuelFerriedFilter2 = document.getElementById('comparisonAutoFuelFerriedFilter2');

  if (autoFuelFerriedFilter1) {
    autoFuelFerriedFilter1.addEventListener('change', function () {
      filterComparisonAutoFuelFerried(1);
    });
  }

  if (autoFuelFerriedFilter2) {
    autoFuelFerriedFilter2.addEventListener('change', function () {
      filterComparisonAutoFuelFerried(2);
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
  renderFuelShotChart();
  renderFuelFerriedChart(); // Add this line
  renderOverviewStackedChart(parsedData.data);
}

function renderOverviewStackedChart(data) {
  const canvas = document.getElementById('overviewStackedChart');
  if (!canvas) return;

  const container = document.getElementById('overviewStackedChartContainer');
  if (!container) return;

  const titleDiv = container.querySelector('#overviewStackedChartTitle');
  container.innerHTML = '';
  if (titleDiv) container.appendChild(titleDiv);

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
    const points = parseFloat(row['Total Points'] || row['Total Score'] || 0);
    if (!teamTotals[team]) {
      teamTotals[team] = { sum: 0, matches: 0 };
    }
    teamTotals[team].sum += points;
    teamTotals[team].matches += 1;
  });

  // Calculate EPA as average of total points only (no OPR)
  const scores = Object.keys(teamTotals).map(team => {
    const avgPoints = teamTotals[team].matches > 0
      ? teamTotals[team].sum / teamTotals[team].matches
      : 0;
    return { team, epa: avgPoints };
  });

  if (scores.length === 0) {
    renderBlankChart('overviewStackedChart', 'No Data');
    return;
  }

  scores.sort((a, b) => b.epa - a.epa);

  const scrollWrapper = document.createElement('div');
  scrollWrapper.style.cssText = `
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    position: relative;
    margin-top: 20px;
  `;

  const barWidth = 75;
  const spacing = 15;
  const totalWidth = Math.max(800, scores.length * (barWidth + spacing));

  const canvasContainer = document.createElement('div');
  canvasContainer.style.cssText = `
    width: ${totalWidth}px;
    height: 650px;
    position: relative;
  `;

  const newCanvas = document.createElement('canvas');
  newCanvas.id = 'overviewStackedChart';
  newCanvas.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    display: block;
  `;

  canvasContainer.appendChild(newCanvas);
  scrollWrapper.appendChild(canvasContainer);
  container.appendChild(scrollWrapper);

  const ctx = newCanvas.getContext('2d');
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
      datasets: [{
        label: 'EPA',
        data: epaData,
        backgroundColor: barColors,
        borderWidth: 0,
        borderRadius: 6,
        barThickness: 75,
        hoverBackgroundColor: barColors.map(color => color + '80')
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 3,
      onClick: getChartClickHandler(),
      layout: {
        padding: {
          top: 30,
          bottom: 10,
          left: 20,
          right: 20
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            title: function (context) {
              const idx = context[0].dataIndex;
              return `Team ${scores[idx].team}`;
            },
            label: function (context) {
              const idx = context.dataIndex;
              const rank = idx + 1;
              return [
                `Rank: ${rank}`,
                `EPA: ${scores[idx].epa.toFixed(2)}`
              ];
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
        },
        datalabels: {
          display: true,
          color: 'white',
          anchor: 'end',
          align: 'top',
          offset: 4,
          font: {
            family: 'Lato',
            size: 16,
            weight: 'bold'
          },
          formatter: function (value) {
            return value.toFixed(1);
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: 'white',
            font: { family: 'Lato', size: 16, weight: 'bold' },
            autoSkip: false
          },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: 'white',
            font: { family: 'Lato', size: 16, weight: 'bold' },
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

  if (charts.overviewStackedChart) {
    charts.overviewStackedChart.data.labels = cleanLabels;
    charts.overviewStackedChart.update();
  }
}

function renderFuelShotChart() {
  const canvas = document.getElementById('fuelOprChart');
  if (!canvas) return;

  const container = document.getElementById('fuelOprChartContainer');
  if (!container) return;

  const titleDiv = container.querySelector('#fuelOprChartTitle');
  container.innerHTML = '';
  if (titleDiv) container.appendChild(titleDiv);

  if (charts['fuelOprChart']) {
    charts['fuelOprChart'].destroy();
    charts['fuelOprChart'] = null;
  }

  // Parse event data
  const parsed = parseCSV();
  const data = parsed && parsed.data ? parsed.data : [];

  if (!data || data.length === 0) {
    renderBlankChart('fuelOprChart', 'No Data');
    return;
  }

  // Calculate average auto and tele fuel shots per team
  const teamStats = {};

  data.forEach(row => {
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
    renderBlankChart('fuelOprChart', 'No Fuel Shot Data');
    return;
  }

  // Sort by total fuel shots
  teams.sort((a, b) => b.total - a.total);

  const scrollWrapper = document.createElement('div');
  scrollWrapper.style.cssText = `
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    position: relative;
    margin-top: 20px;
  `;

  const barWidth = 75;
  const spacing = 15;
  const totalWidth = Math.max(800, teams.length * (barWidth + spacing));

  const canvasContainer = document.createElement('div');
  canvasContainer.style.cssText = `
    width: ${totalWidth}px;
    height: 650px;
    position: relative;
  `;

  const newCanvas = document.createElement('canvas');
  newCanvas.id = 'fuelOprChart';
  newCanvas.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    display: block;
  `;

  canvasContainer.appendChild(newCanvas);
  scrollWrapper.appendChild(canvasContainer);
  container.appendChild(scrollWrapper);

  const ctx = newCanvas.getContext('2d');
  const labels = teams.map(t => `Team ${t.team}`);
  const cleanLabels = teams.map(t => t.team);

  // Set colors based on team
  const autoColors = teams.map(t => {
    if (t.team === '226') return '#7014c5'; // Pink for 226 auto
    if (t.team === highlightedOverviewTeam) return '#FE59D7'; // Light pink for searched team auto
    return '#000bab'; // Deeper vibrant blue for normal auto (Cobalt blue)
  });

  const teleColors = teams.map(t => {
    if (t.team === '226') return '#FE59D7'; // Light pink for 226 tele
    if (t.team === highlightedOverviewTeam) return '#FFC0CB'; // Lighter pink for searched team tele
    return '#3EDBF0'; // Standard blue for normal tele
  });

  charts['fuelOprChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
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
      onClick: getChartClickHandler(),
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 3,
      layout: {
        padding: {
          top: 30,
          bottom: 10,
          left: 20,
          right: 20
        }
      },
      plugins: {
        legend: {
          display: false // Remove legend/key
        },
        tooltip: {
          enabled: true,
          callbacks: {
            title: function () {
              return ''; // No title
            },
            label: function (context) {
              const idx = context.dataIndex;
              const teamNumber = teams[idx].team;
              const rank = idx + 1;
              const total = teams[idx].total.toFixed(2);

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
          borderWidth: 1,
          titleFont: { family: 'Lato', size: 14 },
          bodyFont: { family: 'Lato', size: 14 },
          padding: 10
        },
        datalabels: {
          display: true,
          color: 'white',
          anchor: 'end',
          align: 'top',
          offset: 4,
          font: {
            family: 'Lato',
            size: 16,
            weight: 'bold'
          },
          formatter: function (value, context) {
            // Only show the total value on top of the stack
            // We'll check if this is the second dataset (Tele Shot) which is on top
            const datasetIndex = context.datasetIndex;
            if (datasetIndex === 1) { // Tele Shot dataset (the top one)
              const dataIndex = context.dataIndex;
              return teams[dataIndex].total.toFixed(1);
            }
            return null; // Don't show on Auto Shot bars
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: 'white',
            font: { family: 'Lato', size: 16, weight: 'bold' },
            autoSkip: false,
          },
          grid: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            color: 'white',
            font: { family: 'Lato', size: 16, weight: 'bold' },
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

  if (charts['fuelOprChart']) {
    charts['fuelOprChart'].data.labels = cleanLabels;
    charts['fuelOprChart'].update();
  }
}
function renderFuelFerriedChart() {
  const canvas = document.getElementById('fuelFerriedChart');
  if (!canvas) return;

  const container = document.getElementById('fuelFerriedChartContainer');
  if (!container) return;

  const titleDiv = container.querySelector('#fuelFerriedChartTitle');
  container.innerHTML = '';
  if (titleDiv) container.appendChild(titleDiv);

  if (charts['fuelFerriedChart']) {
    charts['fuelFerriedChart'].destroy();
    charts['fuelFerriedChart'] = null;
  }

  // Parse event data
  const parsed = parseCSV();
  const data = parsed && parsed.data ? parsed.data : [];

  if (!data || data.length === 0) {
    renderBlankChart('fuelFerriedChart', 'No Data');
    return;
  }

  // Calculate average auto and tele fuel ferried per team
  const teamStats = {};

  data.forEach(row => {
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
    renderBlankChart('fuelFerriedChart', 'No Fuel Ferried Data');
    return;
  }

  // Sort by total fuel ferried
  teams.sort((a, b) => b.total - a.total);

  const scrollWrapper = document.createElement('div');
  scrollWrapper.style.cssText = `
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    position: relative;
    margin-top: 20px;
  `;

  const barWidth = 75;
  const spacing = 15;
  const totalWidth = Math.max(800, teams.length * (barWidth + spacing));

  const canvasContainer = document.createElement('div');
  canvasContainer.style.cssText = `
    width: ${totalWidth}px;
    height: 650px;
    position: relative;
  `;

  const newCanvas = document.createElement('canvas');
  newCanvas.id = 'fuelFerriedChart';
  newCanvas.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    display: block;
  `;

  canvasContainer.appendChild(newCanvas);
  scrollWrapper.appendChild(canvasContainer);
  container.appendChild(scrollWrapper);

  const ctx = newCanvas.getContext('2d');
  const labels = teams.map(t => `Team ${t.team}`);
  const cleanLabels = teams.map(t => t.team);

  const autoColors = teams.map(t => {
    if (t.team === '226') return '#7014c5'; // Pink for 226 auto
    if (t.team === highlightedOverviewTeam) return '#FE59D7'; // Light pink for searched team auto
    return '#000bab'; // Deeper vibrant blue for normal auto (Cobalt blue)
  });

  const teleColors = teams.map(t => {
    if (t.team === '226') return '#FE59D7'; // Light pink for 226 tele
    if (t.team === highlightedOverviewTeam) return '#FFC0CB'; // Lighter pink for searched team tele
    return '#3EDBF0'; // Standard blue for normal tele
  });

  charts['fuelFerriedChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
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
      onClick: getChartClickHandler(),
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 3,
      layout: {
        padding: {
          top: 30,
          bottom: 10,
          left: 20,
          right: 20
        }
      },
      plugins: {
        legend: {
          display: false // Remove legend/key
        },
        tooltip: {
          enabled: true,
          callbacks: {
            title: function () {
              return ''; // No title
            },
            label: function (context) {
              const idx = context.dataIndex;
              const teamNumber = teams[idx].team;
              const rank = idx + 1;
              const total = teams[idx].total.toFixed(2);

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
          borderWidth: 1,
          titleFont: { family: 'Lato', size: 14 },
          bodyFont: { family: 'Lato', size: 14 },
          padding: 10
        },
        datalabels: {
          display: true,
          color: 'white',
          anchor: 'end',
          align: 'top',
          offset: 4,
          font: {
            family: 'Lato',
            size: 16,
            weight: 'bold'
          },
          formatter: function (value, context) {
            // Only show the total value on top of the stack
            const datasetIndex = context.datasetIndex;
            if (datasetIndex === 1) { // Tele Ferried dataset (the top one)
              const dataIndex = context.dataIndex;
              return teams[dataIndex].total.toFixed(1);
            }
            return null; // Don't show on Auto Ferried bars
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: 'white',
            font: { family: 'Lato', size: 16, weight: 'bold' },
            autoSkip: false,
          },
          grid: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            color: 'white',
            font: { family: 'Lato', size: 16, weight: 'bold' },
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

  if (charts['fuelFerriedChart']) {
    charts['fuelFerriedChart'].data.labels = cleanLabels;
    charts['fuelFerriedChart'].update();
  }
}

function handleOverviewSearch() {
  const input = document.getElementById('overviewSearch').value.trim();

  if (!input) return;

  displayTeamName(input, 'overviewTeamNicknameDisplay');

  highlightedOverviewTeam = input;
  const parsedData = parseCSV();
  renderOverviewStackedChart(parsedData.data);
  renderFuelShotChart();
  renderFuelFerriedChart(); // Add this line
}

function clearOverviewSearch() {
  document.getElementById('overviewSearch').value = '';
  document.getElementById('overviewTeamNicknameDisplay').textContent = '';
  highlightedOverviewTeam = null;
  const parsedData = parseCSV();
  renderOverviewStackedChart(parsedData.data);
  renderFuelShotChart();
  renderFuelFerriedChart(); // Add this line
}

document.addEventListener('DOMContentLoaded', function () {
  try {
    const overviewCanvas = document.getElementById('overviewStackedChart');
    const fuelCanvas = document.getElementById('fuelOprChart');
    const fuelFerriedCanvas = document.getElementById('fuelFerriedChart'); // Add this line

    if (!overviewCanvas || !fuelCanvas || !fuelFerriedCanvas) return; // Update this line

    const parsed = parseCSV();
    const data = (parsed && parsed.data) ? parsed.data : [];

    if (!data || data.length === 0) {
      renderBlankChart('overviewStackedChart', 'No Data');
      renderBlankChart('fuelOprChart', 'No Data');
      renderBlankChart('fuelFerriedChart', 'No Data'); // Add this line
    } else {
      setTimeout(() => {
        renderOverviewStackedChart(data);
        renderFuelShotChart();
        renderFuelFerriedChart(); // Add this line
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
        totalPoints: 0,
        totalAutoShot: 0,
        totalTeleShot: 0,
        totalAutoFerried: 0,
        totalTeleFerried: 0,
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

    const totalScore = parseFloat(row['Total Points'] || row['Total Score'] || 0);
    const autoShot = parseFloat(row['Auto Fuel Shot'] || 0);
    const teleShot = parseFloat(row['Tele Fuel Shot'] || 0);
    const autoFerried = parseFloat(row['Auto Fuel Ferried'] || 0);
    const teleFerried = parseFloat(row['Tele Fuel Ferried'] || 0);

    if (!isNaN(totalScore)) teamMap[team].totalPoints += totalScore;
    if (!isNaN(autoShot)) teamMap[team].totalAutoShot += autoShot;
    if (!isNaN(teleShot)) teamMap[team].totalTeleShot += teleShot;
    if (!isNaN(autoFerried)) teamMap[team].totalAutoFerried += autoFerried;
    if (!isNaN(teleFerried)) teamMap[team].totalTeleFerried += teleFerried;

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

  const allTeams = Object.entries(teamMap).map(([team, data]) => {
    // Calculate EPA as average of Total Points only (no OPR) - rounded to 1 decimal
    const avgEPA = data.matchCount > 0 ? Math.round((data.totalPoints / data.matchCount) * 10) / 10 : 0;

    // Calculate average shot (auto + tele) - rounded to 1 decimal
    const totalShot = data.totalAutoShot + data.totalTeleShot;
    const avgShot = data.matchCount > 0 ? Math.round((totalShot / data.matchCount) * 10) / 10 : 0;

    // Calculate average ferried (auto + tele) - rounded to 1 decimal
    const totalFerried = data.totalAutoFerried + data.totalTeleFerried;
    const avgFerried = data.matchCount > 0 ? Math.round((totalFerried / data.matchCount) * 10) / 10 : 0;

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
      avgEPA,
      avgShot,
      avgFerried,
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
    case 'avgShot':
      sortFn = (a, b) => b.avgShot - a.avgShot;
      break;
    case 'avgFerried':
      sortFn = (a, b) => b.avgFerried - a.avgFerried;
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
        metricValue = team.avgEPA.toFixed(1); // Changed from toFixed(2) to toFixed(1)
        metricLabel = 'Avg. EPA';
        break;
      case 'avgShot':
        metricValue = team.avgShot.toFixed(1); // Changed from toFixed(2) to toFixed(1)
        metricLabel = 'Avg. Shot';
        break;
      case 'avgFerried':
        metricValue = team.avgFerried.toFixed(1); // Changed from toFixed(2) to toFixed(1)
        metricLabel = 'Avg. Ferried';
        break;
      default:
        metricValue = team.avgEPA.toFixed(1); // Changed from toFixed(2) to toFixed(1)
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


/*-----MATCH PREDICTOR FUNCTIONS-----*/

document.addEventListener('DOMContentLoaded', function () {
  console.log("DOM fully loaded - setting up match predictor");

  // Function to setup predict button with retry
  function setupPredictButton() {
    const predictButton = document.getElementById('predict-button');
    if (predictButton) {
      console.log("Predict button found, attaching event listener");

      // Remove any existing event listeners by cloning
      const newPredictButton = predictButton.cloneNode(true);
      predictButton.parentNode.replaceChild(newPredictButton, predictButton);

      // Add our unified click handler
      newPredictButton.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log("Predict button clicked from event listener");
        handlePredictClick();
      });

      return true;
    }
    return false;
  }

  // Try to setup immediately
  if (!setupPredictButton()) {
    console.log("Predict button not found immediately, will retry");
    // Retry a few times with delays
    let retryCount = 0;
    const maxRetries = 10;
    const retryInterval = setInterval(function () {
      retryCount++;
      console.log(`Retry ${retryCount} to find predict button`);

      if (setupPredictButton()) {
        console.log("Predict button found and setup on retry", retryCount);
        clearInterval(retryInterval);
      } else if (retryCount >= maxRetries) {
        console.log("Max retries reached, stopping search for predict button");
        clearInterval(retryInterval);
      }
    }, 500);
  }

  // Set up match number input for Enter key
  const matchNumberInput = document.getElementById('matchNumberInput');
  if (matchNumberInput) {
    console.log("Match number input found");
    matchNumberInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        console.log("Enter pressed on match number input");
        handlePredictClick();
      }
    });
  } else {
    console.log("Match number input not found");
  }

  // Add input validation for team fields
  const teamInputs = ['redTeam1', 'redTeam2', 'redTeam3', 'blueTeam1', 'blueTeam2', 'blueTeam3'];
  teamInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
      });
    } else {
      console.log(`Team input ${id} not found`);
    }
  });
});

// Backup direct onclick handler
window.onload = function () {
  console.log("Window fully loaded");
  const predictButton = document.getElementById('predict-button');
  if (predictButton) {
    console.log("Setting up backup onclick handler");
    predictButton.onclick = function (e) {
      e.preventDefault();
      console.log("Predict button clicked via onclick backup");
      handlePredictClick();
      return false;
    };
  }
};
// Unified handler for predict button clicks
function handlePredictClick() {
  console.log("handlePredictClick function is running!");
  console.log("Predict button clicked");

  // Get match number first - this should take priority
  const matchNumber = document.getElementById('matchNumberInput').value.trim();

  // Get team values
  const teamInputs = [
    document.getElementById('redTeam1').value.trim(),
    document.getElementById('redTeam2').value.trim(),
    document.getElementById('redTeam3').value.trim(),
    document.getElementById('blueTeam1').value.trim(),
    document.getElementById('blueTeam2').value.trim(),
    document.getElementById('blueTeam3').value.trim(),
  ];

  const filledTeams = teamInputs.filter(t => t);

  console.log("Team inputs:", teamInputs);
  console.log("Filled teams:", filledTeams);
  console.log("Match number:", matchNumber);

  // CASE 1: Match number is provided - this takes priority over custom teams
  if (matchNumber) {
    console.log("Match number provided, loading from schedule: " + matchNumber);

    // Clear any existing team inputs? Or leave them? 
    // For now, we'll load from schedule and it will overwrite them
    populateMatchTeams();
    return;
  }

  // CASE 2: No match number, but user provided at least one team - treat as custom/imaginary match
  if (filledTeams.length > 0) {
    console.log("Custom/imaginary match prediction (teams provided)");
    predictCustomMatch();
    return;
  }

  // CASE 3: Nothing to do
  alert('Please either:\n- Enter a match number to load from schedule, OR\n- Enter at least one team to predict an imaginary match');
}

// Custom match prediction
function predictCustomMatch() {
  console.log("Running custom match prediction");

  // Get values (allow partial "imaginary" lineups)
  const teamInputs = [
    document.getElementById('redTeam1').value.trim(),
    document.getElementById('redTeam2').value.trim(),
    document.getElementById('redTeam3').value.trim(),
    document.getElementById('blueTeam1').value.trim(),
    document.getElementById('blueTeam2').value.trim(),
    document.getElementById('blueTeam3').value.trim(),
  ];

  const filledTeams = teamInputs.filter(t => t);

  if (filledTeams.length === 0) {
    alert('Please enter at least one team to predict an imaginary match');
    return;
  }

  // Validate entries are numbers
  const invalidTeams = filledTeams.filter(team => !/^\d+$/.test(team));
  if (invalidTeams.length > 0) {
    alert('Please enter valid team numbers (digits only)');
    return;
  }

  // Clear match number input (not needed for custom prediction)
  document.getElementById('matchNumberInput').value = '';

  // Run prediction using partial lineup if provided
  updateMatchPrediction(teamInputs);
  renderMatchSummary(teamInputs);
}

function populateMatchTeams() {
  const matchNumber = document.getElementById('matchNumberInput').value.trim();

  if (!matchNumber) {
    alert('Please enter a match number');
    return;
  }

  let scheduleText = window.scheduleCsvText || localStorage.getItem('scheduleCsvText');

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

    // Find match header
    const matchHeader = (result.meta.fields || []).find(f => {
      if (!f) return false;
      const normalized = f.toString().trim().toLowerCase().replace(/[_\s]/g, '');
      return normalized === 'match' || normalized === 'matchnumber';
    }) || 'Match Number';

    const match = result.data.find(row => {
      return row[matchHeader]?.toString().trim() === matchNumber;
    });

    if (match) {
      // Populate team fields
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

      // Always call prediction functions, even if not all teams are present
      // This will show predictions based on available teams
      updateMatchPrediction(allTeams);
      renderMatchSummary(allTeams);

      console.log("Match loaded and prediction updated for match", matchNumber);
    } else {
      alert(`Match ${matchNumber} not found in schedule`);
    }
  } catch (err) {
    console.error('Error:', err);
    alert('Error reading schedule file');
  }
}
function renderMatchSummary(teams) {
  console.log("renderMatchSummary called with teams:", teams);
  const summaryDiv = document.getElementById('matchSummaryTable');

  if (!summaryDiv) return;

  const eventData = parseCSV().data;

  const calculateTeamEPA = (team) => {
    if (!team) return 0;
    const teamMatches = eventData.filter(row => {
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

    return avgTotalPoints;
  };

  const calculateAutoShot = (team) => {
    if (!team) return 0;
    const teamMatches = eventData.filter(row => {
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

    return avgAutoShot;
  };

  const calculateTeleShot = (team) => {
    if (!team) return 0;
    const teamMatches = eventData.filter(row => {
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

    return avgTeleShot;
  };

  const calculateClimbAttempts = (team) => {
    if (!team) return 0;
    const teamMatches = eventData.filter(row => {
      const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
      return teamNum === team;
    }).filter(row => {
      const startingPosition = row['Starting Position']?.toString().trim();
      return startingPosition !== 'R';
    });

    const climbValues = teamMatches
      .map(row => row['Climb Teleop']?.toString().trim())
      .filter(v => v && v !== '' && ['1', '2', '3', 'F'].includes(v));

    return climbValues.length;
  };

  const calculateClimbRate = (team) => {
    if (!team) return '0.0%';
    const teamMatches = eventData.filter(row => {
      const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
      return teamNum === team;
    }).filter(row => {
      const startingPosition = row['Starting Position']?.toString().trim();
      return startingPosition !== 'R';
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

  const calculateDiedAndMissingRate = (team) => {
    if (!team) return { diedRate: '0%', missingRate: '0%', diedMatches: [], missingMatches: [] };

    const teamMatches = eventData.filter(row => {
      const teamNum = row['Team Number']?.toString().trim() || row['Team No.']?.toString().trim();
      return teamNum === team;
    });

    if (teamMatches.length === 0) return { diedRate: '0%', missingRate: '0%', diedMatches: [], missingMatches: [] };

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

    const diedCount = diedMatches.length;
    const missingCount = missingMatches.length;
    const totalMatches = teamMatches.length;

    const diedRate = Math.round((diedCount / totalMatches) * 100) + '%';
    const missingRate = Math.round((missingCount / totalMatches) * 100) + '%';

    return {
      diedRate,
      missingRate,
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

  const calculateAvgDefenseRating = (team) => {
    if (!team) return '0.0';
    const teamMatches = eventData.filter(row => {
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
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: bold;">EPA</th>
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: bold;">Auto Shot</th>
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: bold;">Tele Shot</th>
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: bold;">Shooting Acc</th>
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: bold;">Climb Attempts</th>
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
    const epa = calculateTeamEPA(team);
    const autoShot = calculateAutoShot(team);
    const teleShot = calculateTeleShot(team);
    const shootingAccuracy = calculateShootingAccuracy(team);
    const climbAttempts = calculateClimbAttempts(team);
    const climbRate = calculateClimbRate(team);
    const { diedRate, missingRate, diedMatches, missingMatches } = calculateDiedAndMissingRate(team);
    const defenseRating = calculateAvgDefenseRating(team);
    const teamCellBg = alliance === 'Red' ? '#ff5c5c30' : '#3EDBF030';

    let teamDisplay = team;
    let tooltipHTML = '';

    const hasIssues = diedMatches.length > 0 || missingMatches.length > 0;

    if (hasIssues) {
      teamDisplay = `⚠️${team}`;

      tooltipHTML = `<div class="death-tooltip" style="border-color: ${allianceColor};">`;

      tooltipHTML += `<div class="death-tooltip-team" style="color: ${allianceColor};">${team}</div>`;

      tooltipHTML += `
        <div class="death-tooltip-row">
          <span class="death-tooltip-label" style="color: ${allianceColor};">Died %:</span>
          <span class="death-tooltip-value">${diedRate}</span>
        </div>
      `;

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
                <td style="padding: 10px 8px; background-color: ${teamCellBg}; color: white; font-weight: bold;">
                  <span class="team-cell-wrapper">
                    ${teamDisplay}
                    ${tooltipHTML}
                  </span>
                </td>
                <td style="padding: 10px 8px; text-align: center; color: white;">${epa.toFixed(2)}</td>
                <td style="padding: 10px 8px; text-align: center; color: white;">${autoShot.toFixed(2)}</td>
                <td style="padding: 10px 8px; text-align: center; color: white;">${teleShot.toFixed(2)}</td>
                <td style="padding: 10px 8px; text-align: center; color: white;">${shootingAccuracy}</td>
                <td style="padding: 10px 8px; text-align: center; color: white;">${climbAttempts}</td>
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
  console.log("updateMatchPrediction called with teams:", teams);
  if (!Array.isArray(teams) || teams.length === 0) return;

  const redTeams = teams.slice(0, 3);
  const blueTeams = teams.slice(3, 6);

  // Parse event data for total points and auto fuel shots
  const eventData = parseCSV().data;

  const calculateTeamEPA = (team) => {
    if (!team) return 0;
    const teamMatches = eventData.filter(row => {
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

  const calculateTeamAutoFuelShot = (team) => {
    if (!team) return 0;
    const teamMatches = eventData.filter(row => {
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

  // Calculate EPA for each team (average of total points only)
  const redEPA = redTeams.reduce((sum, team) => sum + calculateTeamEPA(team), 0);
  const blueEPA = blueTeams.reduce((sum, team) => sum + calculateTeamEPA(team), 0);

  // Calculate Auto Fuel Shot averages for alliance shift
  const redAutoFuelShot = redTeams.reduce((sum, team) => sum + calculateTeamAutoFuelShot(team), 0);
  const blueAutoFuelShot = blueTeams.reduce((sum, team) => sum + calculateTeamAutoFuelShot(team), 0);
  const totalAutoFuelShot = redAutoFuelShot + blueAutoFuelShot;
  const redAutoPercentage = totalAutoFuelShot > 0 ? ((redAutoFuelShot / totalAutoFuelShot) * 100).toFixed(1) : "50.0";
  const blueAutoPercentage = totalAutoFuelShot > 0 ? ((blueAutoFuelShot / totalAutoFuelShot) * 100).toFixed(1) : "50.0";

  const totalEPA = redEPA + blueEPA;
  const redPercentage = totalEPA > 0 ? ((redEPA / totalEPA) * 100).toFixed(1) : "50.0";
  const bluePercentage = totalEPA > 0 ? ((blueEPA / totalEPA) * 100).toFixed(1) : "50.0";

  let firstShiftAlliance = '';
  let firstShiftColor = '';
  let secondShiftAlliance = '';
  let secondShiftColor = '';

  if (redAutoFuelShot < blueAutoFuelShot) {
    firstShiftAlliance = 'RED';
    firstShiftColor = '#ff5c5c';
    secondShiftAlliance = 'BLUE';
    secondShiftColor = '#3EDBF0';
  } else if (blueAutoFuelShot < redAutoFuelShot) {
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
                Avg Auto Shot: ${redAutoFuelShot.toFixed(2)}
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
                Avg Auto Shot: ${blueAutoFuelShot.toFixed(2)}
              </div>
            </div>
          </div>
          
          <!-- Progress bar for Alliance Shift -->
          <div style="width:100%;">
            <div style="height:6px;background:#222;border-radius:6px;overflow:hidden;display:flex;">
              <div style="height:100%;width:${redAutoPercentage}%;background:${redAutoFuelShot < blueAutoFuelShot ? '#ff5c5c' : '#666'};"></div>
              <div style="height:100%;width:${blueAutoPercentage}%;background:${blueAutoFuelShot < redAutoFuelShot ? '#3EDBF0' : '#666'};"></div>
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