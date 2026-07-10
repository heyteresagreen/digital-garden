const MONTH_NAMES_LOWER = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_NAMES_TITLE = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

let weekStart = 1;
let highlightColor = 'yellow';
let drawMode = null;
let isMouseDown = false;
let dragTargetState = null;
let activeHighlights = {};
let zoomLevel = 1;
let viewMode = 'year';
let currentMonth = 0;

// Cached DOM elements — populated in initElements() before first use
const el = {};

const dims = {
    'A4':     { w: 210, h: 297, unit: 'mm', dateSize: 11,  daySize: 10, titleSize: 12,  rowGap: 2, colGap: 8, cellHeight: 8,   margin: 10 },
    'A5':     { w: 148, h: 210, unit: 'mm', dateSize: 9,   daySize: 8,  titleSize: 8,   rowGap: 1, colGap: 6, cellHeight: 6,   margin: 6  },
    'A6':     { w: 105, h: 148, unit: 'mm', dateSize: 7.5, daySize: 5,  titleSize: 6.5, rowGap: 0, colGap: 3, cellHeight: 4.5, margin: 4  },
    'Square': { w: 500, h: 500, unit: 'px', dateSize: 7.5, daySize: 7.5,titleSize: 8,   rowGap: 0, colGap: 3, cellHeight: 18,  margin: 3  }
};

const monthDims = {
    'A4': {
        portrait:  { dateSize: 20, daySize: 12, titleSize: 24, cellHeight: 34, margin: 12, rowGap: 0, colGap: 0, giantTitleSize: 180 },
        landscape: { dateSize: 17, daySize: 10, titleSize: 18, cellHeight: 22, margin: 12, rowGap: 0, colGap: 0, giantTitleSize: 125 },
    },
    'A5': {
        portrait:  { dateSize: 16, daySize: 9,  titleSize: 17, cellHeight: 24, margin: 8,  rowGap: 0, colGap: 0, giantTitleSize: 130 },
        landscape: { dateSize: 13, daySize: 8,  titleSize: 13, cellHeight: 15, margin: 8,  rowGap: 0, colGap: 0, giantTitleSize: 90  },
    },
    'A6': {
        portrait:  { dateSize: 11, daySize: 7,  titleSize: 12, cellHeight: 17, margin: 6,  rowGap: 0, colGap: 0, giantTitleSize: 80  },
        landscape: { dateSize: 10, daySize: 6,  titleSize: 10, cellHeight: 11, margin: 5,  rowGap: 0, colGap: 0, giantTitleSize: 60  },
    },
    'Square': {
        portrait:  { dateSize: 14, daySize: 10, titleSize: 18, cellHeight: 48, margin: 5,  rowGap: 0, colGap: 0, giantTitleSize: 115 },
        landscape: { dateSize: 14, daySize: 10, titleSize: 18, cellHeight: 48, margin: 5,  rowGap: 0, colGap: 0, giantTitleSize: 115 },
    },
};

function initElements() {
    el.year               = document.getElementById('year');
    el.calendar           = document.getElementById('calendar');
    el.sizeSelect         = document.getElementById('sizeSelect');
    el.layoutSelect       = document.getElementById('layoutSelect');
    el.monthFormat        = document.getElementById('monthFormat');
    el.showYearTitle      = document.getElementById('showYearTitle');
    el.showDayOutlines    = document.getElementById('showDayOutlines');
    el.adjMonthColor      = document.getElementById('adjMonthColor');
    el.adjDateSize        = document.getElementById('adjDateSize');
    el.adjDayNameSize     = document.getElementById('adjDayNameSize');
    el.adjTitleSize       = document.getElementById('adjTitleSize');
    el.dateInput          = document.getElementById('dateInput');
    el.yearTitleHeader    = document.getElementById('yearTitleHeader');
    el.zoomDisplay        = document.getElementById('zoomLevel');
    el.currentMonthDisplay = document.getElementById('currentMonthDisplay');
    el.captureTarget      = document.getElementById('captureTarget');
    el.btnViewYear        = document.getElementById('btnViewYear');
    el.btnViewMonth       = document.getElementById('btnViewMonth');
    el.btnMon             = document.getElementById('btnMon');
    el.btnSun             = document.getElementById('btnSun');
    el.optFolded          = document.getElementById('optFolded');
    el.yearTitleToggle    = document.getElementById('yearTitleToggle');
    el.swatchPicker       = document.getElementById('swatchPicker');
    el.dayGridBtn         = document.getElementById('dayGridBtn');
    /* B6A: styling-grid controls */
    el.adjYearColor  = document.getElementById('adjYearColor');
    el.adjYearSize   = document.getElementById('adjYearSize');
    el.adjDayColor   = document.getElementById('adjDayColor');
    el.adjDateColor  = document.getElementById('adjDateColor');
    el.dayGridColor  = document.getElementById('dayGridColor');
    el.hexYear  = document.getElementById('hexYear');
    el.hexMonth = document.getElementById('hexMonth');
    el.hexDay   = document.getElementById('hexDay');
    el.hexDate  = document.getElementById('hexDate');
    el.hexGrid  = document.getElementById('hexGrid');
}

function hexToRgb(hex) {
    return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function zoomIn()  { zoomLevel = Math.min(zoomLevel + 0.1, 2);   updateZoom(); }
function zoomOut() { zoomLevel = Math.max(zoomLevel - 0.1, 0.5); updateZoom(); }

function updateZoom() {
    document.documentElement.style.setProperty('--zoom-level', zoomLevel);
    el.zoomDisplay.textContent = Math.round(zoomLevel * 100) + '%';
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
}

/* input-fields: measures the actual active button's box (not a %-of-N
   guess) so the thumb lands exactly on it regardless of padding/gap —
   robust if those ever change. Called wherever .active moves. */
function syncSegThumb(container) {
    if (!container) return;
    const thumb = container.querySelector('.seg-thumb');
    const active = container.querySelector('button.active');
    if (!thumb || !active) return;
    /* offsetLeft/offsetWidth are relative to the container's padding
       edge — the exact coordinate space an absolutely-positioned child
       (the thumb, with left:0) is placed in. Using getBoundingClientRect
       here instead double-counts the container's border width and lands
       the thumb ~1px off from the button it's supposed to match. */
    thumb.style.width = active.offsetWidth + 'px';
    thumb.style.transform = `translateX(${active.offsetLeft}px)`;
}

function setViewMode(mode) {
    viewMode = mode;
    document.body.setAttribute('data-view', mode);
    el.btnViewYear.classList.toggle('active', mode === 'year');
    el.btnViewMonth.classList.toggle('active', mode === 'month');
    syncSegThumb(el.btnViewYear.closest('.seg-ctrl'));
    el.optFolded.disabled = (mode === 'month');
    if (mode === 'month' && el.layoutSelect.value === 'folded') el.layoutSelect.value = 'portrait';
    if (mode === 'month') el.showDayOutlines.checked = true;
    updateDimensions();
}

function changeMonth(dir) {
    currentMonth = (currentMonth + dir + 12) % 12;
    updateMonthNav();
    render();
    updateUrl();
}

function updateMonthNav() {
    const year = +el.year.value;
    const name = new Date(year, currentMonth).toLocaleString('default', { month: 'long' });
    el.currentMonthDisplay.textContent = name + ' ' + year;
}

function updateUrl() {
    try {
        const state = {
            y:   el.year.value,
            mf:  el.monthFormat.value,
            s:   el.sizeSelect.value,
            l:   el.layoutSelect.value,
            ws:  weekStart,
            yt:  el.showYearTitle.checked,
            do:  el.showDayOutlines.checked,
            /* B6A */
            yc:  el.adjYearColor.value.slice(1),
            ysz: el.adjYearSize.value,
            dyc: el.adjDayColor.value.slice(1),
            dtc: el.adjDateColor.value.slice(1),
            gc:  el.dayGridColor.value.slice(1),
            mc:  el.adjMonthColor.value,
            ds:  el.adjDateSize.value,
            dns: el.adjDayNameSize.value,
            ts:  el.adjTitleSize.value,
            vm:  viewMode,
            cm:  currentMonth,
        };
        if (Object.keys(activeHighlights).length) state.h = JSON.stringify(activeHighlights);
        window.history.replaceState({}, '', '?' + new URLSearchParams(state));
    } catch (e) {}
}

function loadFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('y'))   el.year.value              = params.get('y');
        if (params.has('mf'))  el.monthFormat.value        = params.get('mf');
        if (params.has('s'))   el.sizeSelect.value         = params.get('s');
        if (params.has('l'))   el.layoutSelect.value       = params.get('l');
        if (params.has('ws'))  weekStart                   = +params.get('ws');
        if (params.has('yt'))  el.showYearTitle.checked    = params.get('yt') === 'true';
        if (params.has('do'))  el.showDayOutlines.checked  = params.get('do') === 'true';
        /* B6A */
        if (params.has('yc'))  el.adjYearColor.value  = '#' + params.get('yc');
        if (params.has('ysz')) el.adjYearSize.value   = params.get('ysz');
        if (params.has('dyc')) el.adjDayColor.value   = '#' + params.get('dyc');
        if (params.has('dtc')) el.adjDateColor.value  = '#' + params.get('dtc');
        if (params.has('gc'))  el.dayGridColor.value  = '#' + params.get('gc');
        if (params.has('mc'))  el.adjMonthColor.value      = params.get('mc');
        if (params.has('ds'))  el.adjDateSize.value        = params.get('ds');
        if (params.has('dns')) el.adjDayNameSize.value     = params.get('dns');
        if (params.has('ts'))  el.adjTitleSize.value       = params.get('ts');
        if (params.has('h'))   activeHighlights            = JSON.parse(params.get('h'));
        if (params.has('vm'))  viewMode                    = params.get('vm');
        if (params.has('cm'))  currentMonth                = +params.get('cm');
        el.btnMon.classList.toggle('active', weekStart === 1);
        el.btnSun.classList.toggle('active', weekStart === 0);
        syncSegThumb(el.btnMon.closest('.seg-ctrl'));
        el.btnViewYear.classList.toggle('active', viewMode === 'year');
        el.btnViewMonth.classList.toggle('active', viewMode === 'month');
        syncSegThumb(el.btnViewYear.closest('.seg-ctrl'));
        document.body.setAttribute('data-view', viewMode);
        el.optFolded.disabled = (viewMode === 'month');
        if (params.has('yt')) {
            el.yearTitleToggle.classList.toggle('active', params.get('yt') === 'true');
        }
        if (viewMode === 'month') {
            if (el.layoutSelect.value === 'folded') el.layoutSelect.value = 'portrait';
            if (!params.has('do')) el.showDayOutlines.checked = true;
        }
        updateDayGridBtn();
    } catch (e) {}
}

function updateDimensions() {
    const size   = el.sizeSelect.value;
    const layout = el.layoutSelect.value;
    if (viewMode === 'month') {
        const orient = layout === 'folded' ? 'portrait' : layout;
        const preset = (monthDims[size] && monthDims[size][orient]) || monthDims[size]['portrait'];
        el.adjDateSize.value    = preset.dateSize;
        el.adjDayNameSize.value = preset.daySize;
        el.adjTitleSize.value   = preset.giantTitleSize;
    } else {
        const base = dims[size];
        el.adjDateSize.value    = base.dateSize;
        el.adjDayNameSize.value = base.daySize;
        el.adjTitleSize.value   = base.titleSize;
    }
    applyAdvanced();
}

function clearAllHighlights() {
    activeHighlights = {};
    el.dateInput.value = '';
    render();
    updateUrl();
}

function computeAutoSpacing(size, layout, dateSize, dayNameSize, titleSize) {
    const base   = dims[size];
    const { unit, margin, rowGap, colGap } = base;

    if (viewMode === 'month') {
        const orient = (layout === 'landscape') ? 'landscape' : 'portrait';
        const mp = (monthDims[size] && monthDims[size][orient]) || monthDims[size]['portrait'];
        return { margin: mp.margin, rowGap: 0, colGap: 0, cellHeight: mp.cellHeight };
    }

    const paperH    = (layout === 'portrait') ? base.h : base.w;
    const gridRows  = (layout === 'landscape' || layout === 'folded') ? 3 : 4;
    const ptConvert    = (unit === 'px') ? 1.333 : 0.353;
    const marginInUnit = (unit === 'px') ? margin * 3.78 : margin;
    const rowGapInUnit = (unit === 'px') ? rowGap * 3.78 : rowGap;
    const usableH    = paperH - 2 * marginInUnit;
    const perMonthH  = (usableH - (gridRows - 1) * rowGapInUnit) / gridRows;
    const titleH     = titleSize   * ptConvert * 1.5;
    const headerH    = dayNameSize * ptConvert * 1.5;
    const availH     = perMonthH - titleH - headerH;
    // Use 6 rows (worst-case month) with 0.88 fill factor so every month fits
    const cellHeight = Math.max((availH * 0.88) / 6, dateSize * ptConvert * 1.1);
    return { margin, rowGap, colGap, cellHeight };
}

function applyAdvanced() {
    const size   = el.sizeSelect.value;
    const layout = el.layoutSelect.value;
    const unit   = dims[size].unit;
    el.yearTitleHeader.textContent = el.year.value;
    el.yearTitleHeader.style.display = (viewMode === 'month' || !el.showYearTitle.checked) ? 'none' : 'block';
    updateDayGridBtn();
    const root = document.documentElement;
    /* B6A: grid colour comes from its own well, not the month colour */
    root.style.setProperty('--grid-color', el.dayGridColor.value);
    root.style.setProperty('--grid-display',
        el.showDayOutlines.checked ? '0.3pt solid var(--grid-color)' : 'none');
    const base = dims[size];
    const effectiveLayout = (viewMode === 'month' && layout === 'folded') ? 'portrait' : layout;
    const [width, height] = effectiveLayout === 'portrait' ? [base.w, base.h] : [base.h, base.w];
    root.style.setProperty('--orientation', effectiveLayout === 'portrait' ? 'portrait' : 'landscape');
    root.style.setProperty('--paper-width',  width  + unit);
    root.style.setProperty('--paper-height', height + unit);
    const dateSize    = parseFloat(el.adjDateSize.value);
    const dayNameSize = parseFloat(el.adjDayNameSize.value);
    const titleSize   = parseFloat(el.adjTitleSize.value);
    root.style.setProperty('--date-font-size',   dateSize    + 'pt');
    root.style.setProperty('--day-name-size',    dayNameSize + 'pt');
    root.style.setProperty('--month-title-size', titleSize   + 'pt');
    const spacing = computeAutoSpacing(size, layout, dateSize, dayNameSize, titleSize);
    root.style.setProperty('--month-gap-row',  spacing.rowGap    + 'mm');
    root.style.setProperty('--month-gap-col',  spacing.colGap    + 'mm');
    root.style.setProperty('--cell-height',    spacing.cellHeight + unit);
    root.style.setProperty('--paper-padding',  spacing.margin    + 'mm');
    root.style.setProperty('--month-color',    el.adjMonthColor.value);
    /* B6A: independent per-element colours + year title size */
    root.style.setProperty('--year-color',      el.adjYearColor.value);
    root.style.setProperty('--day-color',       el.adjDayColor.value);
    root.style.setProperty('--date-color',      el.adjDateColor.value);
    root.style.setProperty('--year-title-size', parseFloat(el.adjYearSize.value) + 'pt');
    /* B6A: year styling row follows the year-title eye */
    const yearRow = document.getElementById('styleRowYear');
    if (yearRow) yearRow.style.display = (viewMode !== 'month' && el.showYearTitle.checked) ? '' : 'none';
    syncAllHex();
    if (viewMode === 'month') {
        root.style.setProperty('--month-giant-size', titleSize + 'pt');
    } else {
        root.style.setProperty('--month-giant-size', '0pt');
    }
    document.body.setAttribute('data-layout', layout);
    render();
    updateUrl();
}

function setWeekStart(val) {
    weekStart = val;
    el.btnMon.classList.toggle('active', val === 1);
    el.btnSun.classList.toggle('active', val === 0);
    syncSegThumb(el.btnMon.closest('.seg-ctrl'));
    render();
    updateUrl();
}

function buildMonthViewHeader(year, m) {
    const mvh = document.createElement('div');
    mvh.className = 'mvh';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'mvh-name';
    nameDiv.textContent = new Date(year, m).toLocaleString('default', { month: el.monthFormat.value }).toUpperCase();
    mvh.appendChild(nameDiv);
    if (el.showYearTitle.checked) {
        const side = document.createElement('div');
        side.className = 'mvh-side';
        const yearEl = document.createElement('div');
        yearEl.className = 'mvh-year-text';
        yearEl.textContent = year;
        side.appendChild(yearEl);
        mvh.appendChild(side);
    }
    return mvh;
}

function fitGiantTitle() {
    const nameEl = document.querySelector('.mvh-name');
    if (!nameEl) return;
    const savedText = nameEl.textContent;
    nameEl.textContent = 'SEPTEMBER';
    nameEl.style.fontSize = '200pt';
    const ratio = nameEl.clientWidth / nameEl.scrollWidth;
    nameEl.textContent = savedText;
    nameEl.style.removeProperty('font-size');
    document.documentElement.style.setProperty('--month-giant-size', Math.floor(200 * ratio * 10) / 10 + 'pt');
}

function render() {
    const year        = +el.year.value;
    const monthFormat = el.monthFormat.value;
    el.calendar.innerHTML = '';
    if (viewMode === 'month') updateMonthNav();
    const months = viewMode === 'month' ? [currentMonth] : Array.from({length: 12}, (_, i) => i);
    for (const m of months) {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'month';
        if (viewMode === 'month') {
            monthDiv.appendChild(buildMonthViewHeader(year, m));
        } else {
            const name = new Date(year, m).toLocaleString('default', { month: monthFormat }).toUpperCase();
            monthDiv.innerHTML = `<h3>${name}</h3>`;
        }
        const table = document.createElement('table');
        const days = ['S','M','T','W','T','F','S'];
        let headHtml = '<tr>';
        for (let i = 0; i < 7; i++) headHtml += `<th>${days[(i + weekStart) % 7]}</th>`;
        table.innerHTML = headHtml + '</tr>';

        let date = new Date(year, m, 1);
        let row  = document.createElement('tr');
        const leadingCount = (date.getDay() - weekStart + 7) % 7;
        const showAdjacent = viewMode === 'month';
        if (showAdjacent && leadingCount > 0) {
            const prevLast = new Date(year, m, 0).getDate();
            for (let i = leadingCount - 1; i >= 0; i--) {
                const td = document.createElement('td');
                td.className = 'overflow-date';
                td.innerHTML = `<span>${prevLast - i}</span>`;
                row.appendChild(td);
            }
        } else {
            for (let i = 0; i < leadingCount; i++) row.appendChild(document.createElement('td'));
        }

        while (date.getMonth() === m) {
            const currentDay = date.getDate();
            const td  = document.createElement('td');
            const key = `${year}-${m}-${currentDay}`;
            td.dataset.key = key;
            td.innerHTML = `<span>${currentDay}</span>`;

            if (activeHighlights[key]) {
                const hType     = activeHighlights[key];
                const dayInWeek = date.getDay();
                const prevDate  = new Date(year, m, currentDay - 1);
                const nextDate  = new Date(year, m, currentDay + 1);
                const prevKey   = `${prevDate.getFullYear()}-${prevDate.getMonth()}-${prevDate.getDate()}`;
                const nextKey   = `${nextDate.getFullYear()}-${nextDate.getMonth()}-${nextDate.getDate()}`;
                const hasPrev = (dayInWeek !== weekStart) && activeHighlights[prevKey] === hType;
                const hasNext = (dayInWeek !== (weekStart + 6) % 7) && activeHighlights[nextKey] === hType;
                if (!hasPrev && !hasNext) td.classList.add('round-all');
                else if (!hasPrev && hasNext) td.classList.add('round-left');
                else if (hasPrev && !hasNext) td.classList.add('round-right');
                if (hType === 'outline') {
                    td.classList.add('outline');
                } else if (hType.startsWith('#')) {
                    td.classList.add('highlight-custom');
                    const span = td.querySelector('span');
                    span.style.background = hType;
                    span.style.color = getContrastColor(hType);
                } else {
                    td.classList.add(`highlight-${hType}`);
                }
            }

            td.onpointerdown = (e) => {
                if (!drawMode) return;
                isMouseDown = true;
                td.releasePointerCapture(e.pointerId);
                dragTargetState = !isCellMarked(td);
                toggleCell(td, dragTargetState, false);
            };
            td.onpointerenter = () => { if (isMouseDown) toggleCell(td, dragTargetState, false); };
            row.appendChild(td);
            if (row.children.length === 7) { table.appendChild(row); row = document.createElement('tr'); }
            date.setDate(date.getDate() + 1);
        }
        if (showAdjacent && row.children.length > 0 && row.children.length < 7) {
            let nextDay = 1;
            while (row.children.length < 7) {
                const td = document.createElement('td');
                td.className = 'overflow-date';
                td.innerHTML = `<span>${nextDay++}</span>`;
                row.appendChild(td);
            }
        }
        table.appendChild(row);
        monthDiv.appendChild(table);
        el.calendar.appendChild(monthDiv);
    }
    // fitGiantTitle removed — title size is now driven directly by adjTitleSize
}

function toggleCell(td, forceState, fullRender = true) {
    const key = td.dataset.key;
    if (drawMode === 'highlight') {
        td.classList.remove('highlight-yellow','highlight-blue','highlight-pink','highlight-green','highlight-grey','highlight-black','highlight-custom','outline','round-all','round-left','round-right');
        const span = td.querySelector('span');
        if (span) { span.style.background = ''; span.style.color = ''; }
        if (forceState) activeHighlights[key] = highlightColor;
        else delete activeHighlights[key];
    }
    if (fullRender) { render(); updateTextareaFromHighlights(); }
    updateUrl();
}

let isUpdatingFromTextarea = false;

function parseDateInput() {
    if (isUpdatingFromTextarea) return;
    const input = el.dateInput.value.replace(/lime/g, 'green');
    const year  = +el.year.value;
    activeHighlights = {};
    const regex = /([\d\-]+)\s+([a-z]{3})(?:\s*-\s*(\d+)\s+([a-z]{3}))?\s+([a-z]+)/gi;
    let match;
    while ((match = regex.exec(input)) !== null) {
        const [, dayPart, startMonthName, endDay, endMonthName, color] = match;
        const startMonth = MONTH_NAMES_LOWER.indexOf(startMonthName.toLowerCase().substring(0, 3));
        if (startMonth === -1) continue;
        if (endMonthName) {
            const endMonth = MONTH_NAMES_LOWER.indexOf(endMonthName.toLowerCase().substring(0, 3));
            if (endMonth === -1) continue;
            const startDate = new Date(year, startMonth, parseInt(dayPart));
            const endDate   = new Date(year, endMonth, parseInt(endDay));
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1))
                activeHighlights[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] = color;
        } else if (dayPart.includes('-')) {
            const [start, end] = dayPart.split('-').map(Number);
            for (let day = start; day <= end; day++)
                activeHighlights[`${year}-${startMonth}-${day}`] = color;
        } else {
            activeHighlights[`${year}-${startMonth}-${parseInt(dayPart)}`] = color;
        }
    }
    /* B6A: month-first lines — "Jan 1 yellow", "Mar 10-15 pink" —
       previously only day-first parsed, despite the placeholder */
    const regexMF = /([a-z]{3,})\s+(\d+)(?:\s*-\s*(\d+))?\s+([a-z]+)/gi;
    while ((match = regexMF.exec(input)) !== null) {
        const [, monthName, startDay, endDay, color] = match;
        const month = MONTH_NAMES_LOWER.indexOf(monthName.toLowerCase().substring(0, 3));
        if (month === -1) continue;
        const last = endDay ? parseInt(endDay) : parseInt(startDay);
        for (let day = parseInt(startDay); day <= last; day++)
            activeHighlights[`${year}-${month}-${day}`] = color;
    }
    render();
    updateUrl();
}

function updateTextareaFromHighlights() {
    isUpdatingFromTextarea = true;
    const sortedKeys = Object.keys(activeHighlights).sort((a, b) => {
        const [y1, m1, d1] = a.split('-');
        const [y2, m2, d2] = b.split('-');
        return (y1 - y2) || (m1 - m2) || (d1 - d2);
    });
    if (sortedKeys.length === 0) {
        el.dateInput.value = '';
        isUpdatingFromTextarea = false;
        return;
    }
    const lines = [];
    let i = 0;
    while (i < sortedKeys.length) {
        const startKey = sortedKeys[i];
        const color    = activeHighlights[startKey];
        let endKey = startKey;
        let j = i + 1;
        while (j < sortedKeys.length) {
            const currentKey = sortedKeys[j];
            const prevKey    = sortedKeys[j - 1];
            const [yC,mC,dC] = currentKey.split('-').map(Number);
            const [yP,mP,dP] = prevKey.split('-').map(Number);
            const diffDays = (new Date(yC,mC,dC) - new Date(yP,mP,dP)) / 86400000;
            if (activeHighlights[currentKey] === color && diffDays === 1) { endKey = currentKey; j++; }
            else break;
        }
        const [,mS,dS] = startKey.split('-').map(Number);
        const [,mE,dE] = endKey.split('-').map(Number);
        if (startKey === endKey) lines.push(`${dS} ${MONTH_NAMES_TITLE[mS]} ${color}`);
        else if (mS === mE)     lines.push(`${dS}-${dE} ${MONTH_NAMES_TITLE[mS]} ${color}`);
        else                    lines.push(`${dS} ${MONTH_NAMES_TITLE[mS]}-${dE} ${MONTH_NAMES_TITLE[mE]} ${color}`);
        i = j;
    }
    el.dateInput.value = lines.join('\n');
    isUpdatingFromTextarea = false;
}

function isCellMarked(td) {
    return activeHighlights[td.dataset.key] === highlightColor;
}

function getContrastColor(hex) {
    if (!hex || !hex.startsWith('#')) return '';
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) < 128 ? '#fff' : '';
}

function toggleYearTitle() {
    el.showYearTitle.checked = !el.showYearTitle.checked;
    el.yearTitleToggle.classList.toggle('active', el.showYearTitle.checked);
    applyAdvanced();
}

function toggleDayGrid() {
    el.showDayOutlines.checked = !el.showDayOutlines.checked;
    applyAdvanced();
}

function updateDayGridBtn() {
    if (!el.dayGridBtn) return;
    el.dayGridBtn.classList.toggle('active', el.showDayOutlines.checked);
}

function setCustomColor(hex) {
    highlightColor = hex;
    drawMode = 'highlight';
    document.body.setAttribute('data-active-mode', 'highlight');
    document.body.setAttribute('data-highlight-color', 'custom');
    el.swatchPicker.style.background = hex;
    el.swatchPicker.classList.add('has-custom');
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    el.swatchPicker.classList.add('active');
}

function setDrawMode(mode) {
    drawMode = mode;
    if (mode) {
        document.body.setAttribute('data-active-mode', mode);
        if (mode === 'highlight') document.body.setAttribute('data-highlight-color', highlightColor);
    } else {
        document.body.removeAttribute('data-active-mode');
    }
}

function setHighlightColor(color) {
    highlightColor = color;
    drawMode = 'highlight';
    document.body.setAttribute('data-active-mode', 'highlight');
    document.body.setAttribute('data-highlight-color', color);
    document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
}

function printAllMonths() {
    if (viewMode !== 'month') return;
    const savedMonth    = currentMonth;
    const previewScroll = document.querySelector('.preview-scroll');
    const pageFrame     = document.querySelector('.page-frame');
    const tempPages     = [];

    for (let m = 0; m < 12; m++) {
        currentMonth = m;
        render();
        const page = document.createElement('div');
        page.className = 'page month-print-page';
        const grid = document.createElement('div');
        grid.className = 'months-grid';
        grid.innerHTML = el.calendar.innerHTML;
        page.appendChild(grid);
        previewScroll.insertBefore(page, pageFrame);
        tempPages.push(page);
    }

    currentMonth = savedMonth;
    render();
    document.body.classList.add('print-all-months');
    window.print();
    document.body.classList.remove('print-all-months');
    tempPages.forEach(p => p.remove());
}

function saveAsPng() {
    const year = el.year.value;
    document.body.classList.add('is-capturing');
    const filename = viewMode === 'month'
        ? `calendar-${year}-${new Date(year, currentMonth).toLocaleString('default', { month: 'long' }).toLowerCase()}.png`
        : `calendar-${year}.png`;
    setTimeout(() => {
        html2canvas(el.captureTarget, { scale: 3, useCORS: true, backgroundColor: null }).then(canvas => {
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL();
            link.click();
            document.body.classList.remove('is-capturing');
        });
    }, 50);
}

window.addEventListener('pointerup', () => {
    if (isMouseDown) {
        isMouseDown = false;
        dragTargetState = null;
        render();
        updateTextareaFromHighlights();
    }
});

// ─── Theme toggle ─────────────────────────────────────────────────────────
function toggleTheme() {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = next;
    localStorage.setItem('calTheme', next);
}

function initTheme() {
    const saved = localStorage.getItem('calTheme');
    if (saved) {
        document.body.dataset.theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.dataset.theme = 'dark';
    }
}

initElements();
initTheme();
loadFromUrl();
updateDimensions();
updateTextareaFromHighlights();
setDrawMode('highlight');


/* ═══ B6A UI helpers (integrated from the prototype shim) ═══ */
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function syncAllHex() {
    const pairs = [['hexYear','adjYearColor'], ['hexMonth','adjMonthColor'],
                   ['hexDay','adjDayColor'], ['hexDate','adjDateColor'], ['hexGrid','dayGridColor']];
    pairs.forEach(([h, c]) => {
        if (el[h] && el[c] && document.activeElement !== el[h]) el[h].value = el[c].value.toUpperCase();
    });
}
function pickColor(pickerId) {
    applyAdvanced();
}
function typeColor(hexEl, pickerId) {
    if (!HEX_RE.test(hexEl.value)) return;
    el[pickerId].value = hexEl.value;
    if (pickerId === 'dayGridColor' && !el.showDayOutlines.checked) el.showDayOutlines.checked = true;
    applyAdvanced();
}
function pickGridColor() {
    if (!el.showDayOutlines.checked) el.showDayOutlines.checked = true;
    applyAdvanced();
}

/* orientation icon seg drives the hidden #layoutSelect */
function syncLayoutIcons() {
    const sel = el.layoutSelect;
    document.querySelectorAll('.orient-icons button').forEach(b =>
        b.classList.toggle('active', b.dataset.layout === sel.value));
    const folded = document.getElementById('iconFolded');
    if (folded) folded.disabled = el.optFolded.disabled;
    syncSegThumb(document.querySelector('.orient-icons'));
}
function setLayoutIcon(v) {
    if (el.optFolded.disabled && v === 'folded') return;
    el.layoutSelect.value = v;
    updateDimensions();
    syncLayoutIcons();
}

/* month-label seg drives the hidden #monthFormat */
function syncMonthFmt() {
    document.querySelectorAll('.monthfmt-seg button').forEach(b =>
        b.classList.toggle('active', b.dataset.fmt === el.monthFormat.value));
    syncSegThumb(document.querySelector('.monthfmt-seg'));
}
function setMonthFormat(v) {
    el.monthFormat.value = v;
    applyAdvanced();
    syncMonthFmt();
}

const _b6aSetViewMode = setViewMode;
setViewMode = function (m) { _b6aSetViewMode(m); syncLayoutIcons(); applyAdvanced(); };

/* highlighting section disclosure — state lives in activeHighlights/URL,
   untouched by open/close */
(function () {
    const head = document.querySelector('.highlighting-head');
    if (!head) return;
    const section = head.closest('.prop-section');
    section.classList.add('hl-section');
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    head.setAttribute('aria-expanded', 'false');
    function toggleHl() {
        const open = section.classList.toggle('open');
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    head.addEventListener('click', e => { if (!e.target.closest('.link-btn')) toggleHl(); });
    head.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHl(); }
    });
    setTimeout(() => {
        if (el.dateInput.value.trim()) {
            section.classList.add('open');
            head.setAttribute('aria-expanded', 'true');
        }
    }, 0);
})();

/* boot sync for the seg/icon/hex mirrors */
syncLayoutIcons();
syncMonthFmt();
syncAllHex();
applyAdvanced();
