let resultTable;
let currentSort = {
    column: null,
    direction: 'asc'
};
let processedData = null; // Added global variable

const ACRONYMS = new Set([
    "gpt", "seo", "llm", "nft", "dns", "llc", "ai", "api", "aws", "cdn", "css", "dev",
    "dns", "ftp", "git", "html", "http", "ios", "ip", "js", "php", "sdk", "sql", "ssl",
    "tcp", "ui", "ux", "vm", "vpn", "xml"
]);

// Add this function near the top of the file
function compareDomainsCharacters(original, modified) {
    // Remove dots and convert to lowercase for comparison
    const stripDomain = (domain) => domain.replace(/\./g, '').toLowerCase();
    const originalChars = stripDomain(original);
    const modifiedChars = stripDomain(modified);
    return originalChars === modifiedChars;
}

function updateGraphLabelVisibility(svg, show) {
    // Update value labels above bars
    svg.selectAll('.value-label')
        .style('opacity', show ? 1 : 0);

    // Update Y-axis text (numbers only)
    svg.selectAll('.y-axis text')
        .style('opacity', show ? 1 : 0);

    // Note: We're no longer toggling the y-axis-label visibility
    // so it stays visible at all times

    // Update button icon and text
    const button = document.getElementById('toggleGraphLabels');
    button.innerHTML = show ?
        '<i class="fas fa-tag"></i> Hide Value Labels' :
        '<i class="fas fa-tag"></i> Show Value Labels';
}

function updateTldGraphLabelVisibility(svg, show) {
    // Update value labels above bars
    svg.selectAll('.value-label')
        .style('opacity', show ? 1 : 0);

    // Update Y-axis text (numbers only)
    svg.selectAll('.y-axis text')
        .style('opacity', show ? 1 : 0);

    // Update button icon and text
    const button = document.getElementById('toggleTldGraphLabels');
    button.innerHTML = show ?
        '<i class="fas fa-tag"></i> Hide Value Labels' :
        '<i class="fas fa-tag"></i> Show Value Labels';
}

function updateSummaryStats(data) {
    // Update total counts
    const totalDomains = data.results.length;

    // Get all unique words from all domains' split words
    const allWords = new Set();
    data.results.forEach(result => {
        if (result.split) {
            const words = result.split.toLowerCase().split(' ');
            words.forEach(word => allWords.add(word));
        }
    });
    const uniqueWords = allWords.size;

    const uniqueTlds = new Set(data.tld_stats.map(t => t.tld)).size;

    document.getElementById('totalDomains').textContent = totalDomains;
    document.getElementById('totalUniqueWords').textContent = uniqueWords;
    document.getElementById('totalTlds').textContent = uniqueTlds;

    // Create summary word cloud
    createWordCloud(data.word_cloud, 'summaryWordCloud');

    // Create summary SLD graph
    createSummarySldGraph(data.sld_stats);

    // Create summary TLD graph
    createSummaryTldGraph(data.tld_stats);

    // Update top 30 words table
    updateTopWordsTable(data.word_stats, totalDomains);
}

function updateTopWordsTable(wordStats, totalDomains) {
    const tableBody = document.getElementById('summaryWordTable');
    tableBody.innerHTML = '';

    // Define words to exclude (same as word cloud)
    const excludeWords = new Set(['a', 'e', 'y', 'i', 'o', 'and', 'of', 'in', 'on', 'the', 'to', 'is', 'for']);

    // Filter and take only top 30 words
    wordStats
        .filter(stat => !excludeWords.has(stat.word.toLowerCase()) && stat.word.length > 1)
        .slice(0, 30)
        .forEach(stat => {
            const percentage = ((stat.count / totalDomains) * 100).toFixed(1);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${stat.word}</td>
                <td class="text-end">${stat.count}</td>
                <td class="text-end">${percentage}%</td>
            `;
            tableBody.appendChild(tr);
        });
}

function createSummarySldGraph(sldStats) {
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const container = document.getElementById('summarySldGraph');
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    // Clear previous graph
    d3.select('#summarySldGraph').html('');

    const svg = d3.select('#summarySldGraph')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const sortedData = [...sldStats].sort((a, b) => a.length - b.length);

    const x = d3.scaleBand()
        .range([0, width])
        .domain(sortedData.map(d => d.length))
        .padding(0.2);

    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(sortedData, d => d.count)]);

    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('text-anchor', 'middle')
        .style('font-size', '10px');

    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('font-size', '10px');

    // Add bars
    svg.selectAll('rect')
        .data(sortedData)
        .enter()
        .append('rect')
        .attr('x', d => x(d.length))
        .attr('y', d => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.count))
        .attr('fill', '#4A90E2')
        .style('opacity', 0.8);
}

function createSummaryTldGraph(tldStats) {
    const margin = { top: 20, right: 30, bottom: 60, left: 50 };
    const container = document.getElementById('summaryTldGraph');
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    // Clear previous graph
    d3.select('#summaryTldGraph').html('');

    const svg = d3.select('#summaryTldGraph')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Take top 10 TLDs
    const topTlds = tldStats.slice(0, 10);

    const x = d3.scaleBand()
        .range([0, width])
        .domain(topTlds.map(d => d.tld))
        .padding(0.2);

    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(topTlds, d => d.count)]);

    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('transform', 'rotate(-45)')
        .style('font-size', '10px');

    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('font-size', '10px');

    // Add bars
    svg.selectAll('rect')
        .data(topTlds)
        .enter()
        .append('rect')
        .attr('x', d => x(d.tld))
        .attr('y', d => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.count))
        .attr('fill', '#4A90E2')
        .style('opacity', 0.8);
}

function displaySldStats(data) {
    const sldStatsTable = document.getElementById('sldStatsTable');
    sldStatsTable.innerHTML = '';

    // Create bar graph
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const graphContainer = document.getElementById('sldBarGraph');
    const width = graphContainer.clientWidth - margin.left - margin.right;
    const height = graphContainer.clientHeight - margin.top - margin.bottom;

    // Clear previous graph
    d3.select('#sldBarGraph').html('');

    // Create SVG
    const svg = d3.select('#sldBarGraph')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Sort data by SLD length
    const sortedData = [...data.sld_stats].sort((a, b) => a.length - b.length);

    // Create scales
    const x = d3.scaleBand()
        .range([0, width])
        .domain(sortedData.map(d => d.length))
        .padding(0.2);

    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(sortedData, d => d.count)]);

    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('text-anchor', 'middle')
        .style('font-size', '12px');

    // Add X axis label
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 5)
        .style('font-size', '14px')
        .text('SLD Length (characters)');

    // Add Y axis with class for toggling
    const yAxis = svg.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('font-size', '12px');

    // Add Y axis label with class for toggling
    const yAxisLabel = svg.append('text')
        .attr('class', 'y-axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 20)
        .attr('x', -height / 2)
        .style('font-size', '14px')
        .text('Number of Domains');

    // Create and style the bars
    svg.selectAll('rect')
        .data(sortedData)
        .enter()
        .append('rect')
        .attr('x', d => x(d.length))
        .attr('y', d => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.count))
        .attr('fill', '#4A90E2')
        .style('opacity', 0.8)
        .on('mouseover', function () {
            d3.select(this)
                .style('opacity', 1)
                .attr('fill', '#357ABD');
        })
        .on('mouseout', function () {
            d3.select(this)
                .style('opacity', 0.8)
                .attr('fill', '#4A90E2');
        });

    // Add value labels on top of bars with class for toggling
    const valueLabels = svg.selectAll('.value-label')
        .data(sortedData)
        .enter()
        .append('text')
        .attr('class', 'value-label')
        .attr('x', d => x(d.length) + x.bandwidth() / 2)
        .attr('y', d => y(d.count) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(d => d.count);

    // Get toggle button state from localStorage or default to true
    const showLabels = localStorage.getItem('showGraphLabels') !== 'false';
    updateGraphLabelVisibility(svg, showLabels);

    // Update table
    data.sld_stats.forEach(stat => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${stat.length} characters</td>
            <td class="text-center">${stat.count}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary download-sld-domains" onclick="downloadDomainsWithSldLength(${stat.length})" title="Download domains with this length">
                    <i class="fas fa-arrow-down"></i>
                </button>
            </td>
        `;
        sldStatsTable.appendChild(tr);
    });

    // Add SLD Stats download button handler
    const downloadSldStatsButton = document.getElementById('downloadSldStats');
    if (downloadSldStatsButton) {
        downloadSldStatsButton.addEventListener('click', async function () {
            try {
                const response = await fetch('/download/sld-stats', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ sld_stats: data.sld_stats })
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                // Create a blob from the response
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'sld_length_statistics.csv';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } catch (error) {
                console.error('Error downloading SLD stats:', error);
                showNotification('Error downloading SLD length statistics');
            }
        });
    }
}

function displayTldStats(data, range = "1-20") {
    const tldStatsTable = document.getElementById('tldStatsTable');
    tldStatsTable.innerHTML = '';

    // Sort data by count (descending)
    const sortedData = [...data.tld_stats].sort((a, b) => b.count - a.count);

    // Parse range
    let start = 1, end = 20;
    if (range && range.includes('-')) {
        const [rangeStart, rangeEnd] = range.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(rangeStart) && !isNaN(rangeEnd) && rangeStart <= rangeEnd) {
            start = rangeStart;
            end = rangeEnd;
        }
    }

    // Apply range (subtract 1 from start because array is 0-based)
    const displayData = sortedData.slice(start - 1, end);

    // Create bar graph
    const margin = { top: 20, right: 30, bottom: 60, left: 60 };
    const graphContainer = document.getElementById('tldBarGraph');
    const width = graphContainer.clientWidth - margin.left - margin.right;
    const height = graphContainer.clientHeight - margin.top - margin.bottom;

    // Clear previous graph
    d3.select('#tldBarGraph').html('');

    // Create SVG
    const svg = d3.select('#tldBarGraph')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const x = d3.scaleBand()
        .range([0, width])
        .domain(displayData.map(d => d.tld))
        .padding(0.2);

    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(displayData, d => d.count)]);

    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('transform', 'rotate(-45)')
        .style('font-size', '12px');

    // Add X axis label
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 5)
        .style('font-size', '14px')
        .text('Top Level Domains');

    // Add Y axis with class for toggling
    svg.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('font-size', '12px');

    // Add Y axis label
    svg.append('text')
        .attr('class', 'y-axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 20)
        .attr('x', -height / 2)
        .style('font-size', '14px')
        .text('Number of Domains');

    // Create and style the bars
    svg.selectAll('rect')
        .data(displayData)
        .enter()
        .append('rect')
        .attr('x', d => x(d.tld))
        .attr('y', d => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.count))
        .attr('fill', '#4A90E2')
        .style('opacity', 0.8)
        .on('mouseover', function () {
            d3.select(this)
                .style('opacity', 1)
                .attr('fill', '#357ABD');
        })
        .on('mouseout', function () {
            d3.select(this)
                .style('opacity', 0.8)
                .attr('fill', '#4A90E2');
        });

    // Add value labels on top of bars
    const valueLabels = svg.selectAll('.value-label')
        .data(displayData)
        .enter()
        .append('text')
        .attr('class', 'value-label')
        .attr('x', d => x(d.tld) + x.bandwidth() / 2)
        .attr('y', d => y(d.count) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(d => d.count);

    // Get toggle button state from localStorage or default to true
    const showLabels = localStorage.getItem('showTldGraphLabels') !== 'false';
    updateTldGraphLabelVisibility(svg, showLabels);

    // Update table (show all data in table, not just limited view)
    sortedData.forEach(stat => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>.${stat.tld}</td>
            <td class="text-center">${stat.count}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary download-tld-domains" onclick="downloadDomainsWithTld('${stat.tld}')" title="Download domains with this TLD">
                    <i class="fas fa-arrow-down"></i>
                </button>
            </td>
        `;
        tldStatsTable.appendChild(tr);
    });
}

function displayWordStats(wordStats) {
    const statsTable = document.getElementById('statsTable');
    statsTable.innerHTML = '';

    // Get filter state from checkbox
    const filterEnabled = document.getElementById('filterCommonWords').checked;

    // Define words to exclude (same as word cloud)
    const excludeWords = new Set(['a', 'e', 'y', 'i', 'o', 'and', 'of', 'in', 'on', 'the', 'to', 'is', 'for']);

    // Filter stats if enabled
    const filteredStats = filterEnabled
        ? wordStats.filter(stat => !excludeWords.has(stat.word.toLowerCase()) && stat.word.length > 1)
        : wordStats;

    filteredStats.forEach(stat => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${stat.word}</td>
            <td class="text-center">${stat.count}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary download-word-domains" onclick="downloadDomainsWithWord('${stat.word}')" title="Download domains with this word">
                    <i class="fas fa-arrow-down"></i>
                </button>
            </td>
        `;
        statsTable.appendChild(tr);
    });
}

function createWordCloud(wordCloudData, containerId) {
    const wordCloudContainer = document.getElementById(containerId);
    // Clear previous word cloud
    wordCloudContainer.innerHTML = '';

    // Check if we have valid data
    if (!wordCloudData || !Array.isArray(wordCloudData) || wordCloudData.length === 0) {
        console.error('No valid word cloud data received');
        return;
    }

    // Define words to exclude
    const excludeWords = new Set(['a', 'e', 'y', 'i', 'o', 'and', 'of', 'in', 'on', 'the', 'to', 'is', 'for']);

    // Filter out single characters and common words, then limit to top 40
    const filteredData = wordCloudData
        .filter(d => !excludeWords.has(d.text.toLowerCase()) && d.text.length > 1)
        .slice(0, 40);

    // Set up dimensions
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const width = wordCloudContainer.clientWidth || 800;
    const height = 600; // Increased height to match container

    // Create color scale using application's color scheme
    const colors = [
        '#4A90E2', // Primary blue
        '#34C759', // Secondary green
        '#357abd', // Darker blue
        '#2da84e', // Darker green
    ];

    const colorScale = d3.scaleOrdinal()
        .domain(d3.range(filteredData.length))
        .range(colors);

    // Create SVG container
    const svg = d3.select(`#${containerId}`)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    // Configure the cloud layout
    const layout = d3.layout.cloud()
        .size([width - margin.left - margin.right, height - margin.top - margin.bottom])
        .words(filteredData.map(d => ({
            text: d.text,
            size: d.size,
            originalSize: d.size // Keep original size for reference
        })))
        .padding(5)
        .rotate(() => 0) // No rotation for better readability
        .font('Inter')
        .fontSize(d => Math.min(Math.max(d.size, 14), 60)) // Constrain font size between 14 and 60
        .spiral('archimedean') // Use archimedean spiral for better word placement
        .on('end', draw);

    // Start the layout
    layout.start();

    // Draw function
    function draw(words) {
        const texts = svg.selectAll('text')
            .data(words)
            .enter()
            .append('text')
            .style('font-family', 'Inter')
            .style('fill', (d, i) => colorScale(i))
            .style('fill-opacity', 0.9)
            .attr('text-anchor', 'middle')
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .style('font-size', d => `${d.size}px`)
            .text(d => d.text)
            .style('cursor', 'pointer')
            .on('mouseover', function () {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style('fill-opacity', 1)
                    .style('font-weight', '500');
            })
            .on('mouseout', function () {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style('fill-opacity', 0.9)
                    .style('font-weight', '400');
            });

        // Add subtle animation
        texts.style('opacity', 0)
            .transition()
            .duration(600)
            .style('opacity', 1);
    }
}

function sortTable(column) {
    const tbody = document.getElementById('resultTable');
    const rows = Array.from(tbody.getElementsByTagName('tr'));
    const hideConfident = document.getElementById('hideConfidentDomains').checked;

    // Remove existing sort indicators
    document.querySelectorAll('th .sort-indicator').forEach(el => el.remove());

    // Add sort indicator to clicked column
    const th = document.querySelector(`th[data-sort="${column}"]`);
    if (th) {
        // Toggle direction if clicking same column
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }

        // Add sort indicator
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator ms-1';
        indicator.innerHTML = currentSort.direction === 'asc' ? '↑' : '↓';
        th.appendChild(indicator);

        // Sort rows
        rows.sort((a, b) => {
            let aVal, bVal;
            if (column === 'confidence') {
                aVal = parseFloat(a.querySelector('.confidence-cell').dataset.confidence);
                bVal = parseFloat(b.querySelector('.confidence-cell').dataset.confidence);
            } else if (column === 'wordCount') {
                aVal = parseInt(a.cells[3].textContent);
                bVal = parseInt(b.cells[3].textContent);
            }

            if (currentSort.direction === 'asc') {
                return aVal - bVal;
            } else {
                return bVal - aVal;
            }
        });

        // Reattach sorted rows
        rows.forEach(row => {
            if (!hideConfident || (parseFloat(row.querySelector('.confidence-cell').dataset.confidence) !== 100 && !row.querySelector('.mark-reviewed'))) {
                tbody.appendChild(row);
            }
        });
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    processingIndicator.style.display = 'none';
    resultContainer.style.display = 'none';
}

function displayResults(results) {
    resultTable = document.getElementById('resultTable');
    resultTable.innerHTML = '';
    const hideConfident = document.getElementById('hideConfidentDomains').checked;

    // Count total and less certain domains
    const totalDomains = results.length;
    const lessConfidentDomains = results.filter(result => result.confidence !== 100 && !result.reviewed).length;

    // Update the review count badge
    const reviewCount = document.getElementById('reviewCount');
    reviewCount.textContent = `${lessConfidentDomains}/${totalDomains}`;

    // Store the current sort settings if any
    const prevSort = { ...currentSort };

    results.forEach(result => {
        if (hideConfident && (result.confidence === 100 || result.reviewed)) {
            return;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${result.original || ''}</td>
            <td class="converted-domain">${result.converted || ''}</td>
            <td>
                <div class="split-words" contenteditable="true"
                     data-original="${result.split || ''}"
                     style="border: 1px solid transparent; padding: 2px; min-height: 24px;"
                     onblur="updateConvertedDomain(this)"
                     onfocus="this.style.border='1px solid #4A90E2'">${result.split || ''}</div>
            </td>
            <td class="text-center">${result.word_count || 0}</td>
            <td class="confidence-cell" data-confidence="${result.confidence || 0}">
                ${hideConfident && result.confidence !== 100 ?
                    `<button class="btn btn-sm btn-outline-primary mark-reviewed" onclick="markAsReviewed(this)">Mark as Reviewed</button>` :
                    `<div class="confidence-bar" style="width: ${result.confidence}%"></div>
                    <span>${result.confidence}%</span>`
                    }
            </td>
            <td class="sld-length" style="display: none;">${result.sld_length}</td>`;
        resultTable.appendChild(tr);
    });

    // Reapply sorting if it was previously set
    if (prevSort.column) {
        sortTable(prevSort.column);
    }

    resultContainer.style.display = 'block';
}


function downloadMatchingDomains(matchingRows, filename) {
    if (!matchingRows || matchingRows.length === 0) {
        showNotification('No matching domains found');
        return;
    }

    const csvContent = [
        'Original Domain,Converted Domain,Split Words,Word Count,Confidence %',
        ...matchingRows.map(row => {
            return [
                row.original,
                row.converted,
                row.split,
                row.word_count,
                row.confidence
            ].map(field => `"${field?.toString().replace(/"/g, '""') || ''}"`)
                .join(',');
        })
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
}

function downloadDomainsWithWord(word) {
    console.log('Downloading domains with word:', word);
    if (!window.lastProcessedData || !window.lastProcessedData.results) {
        console.error('No processed data available');
        showNotification('No data available');
        return;
    }

    const matchingDomains = window.lastProcessedData.results.filter(result =>
        result.split && result.split.toLowerCase().includes(word.toLowerCase())
    );

    if (matchingDomains.length === 0) {
        showNotification('No domains found containing this word');
        return;
    }

    downloadMatchingDomains(matchingDomains, `domains_with_${word}.csv`);
}

function downloadDomainsWithSldLength(targetLength) {
    console.log('Downloading domains with SLD length:', targetLength);
    if (!window.lastProcessedData || !window.lastProcessedData.results) {        console.error('No processed data available');
        showNotification('No data available');
        return;
    }const matchingDomains = window.lastProcessedData.results.filter(result =>
        result.sld_length === targetLength
    );

    if (matchingDomains.length === 0) {
        showNotification('No domains found with this length');
        return;
    }

    downloadMatchingDomains(matchingDomains, `domains_length_${targetLength}.csv`);
}

function downloadDomainsWithTld(targetTld) {
    console.log('Downloading domains with TLD:', targetTld);
    if (!window.lastProcessedData || !window.lastProcessedData.results) {
        console.error('No processed data available');
        showNotification('No data available');
        return;
    }

    const matchingDomains = window.lastProcessedData.results.filter(result =>
        result.original.endsWith('.' + targetTld)
    );

    if (matchingDomains.length === 0) {
        showNotification('No domains found with this TLD');
        return;
    }

    downloadMatchingDomains(matchingDomains, `domains_with_tld_${targetTld}.csv`);
}

// Add the markAsReviewed function after the downloadDomainsWithTld function
function markAsReviewed(button) {
    const row = button.closest('tr');
    const confidenceCell = row.querySelector('.confidence-cell');

    // Update confidence to 100%
    confidenceCell.dataset.confidence = "100";
    confidenceCell.innerHTML = `
        <div class="confidence-bar" style="width: 100%"></div>
        <span>100%</span>
    `;

    // If we're hiding confident results, hide this row
    if (document.getElementById('hideConfidentDomains').checked) {
        row.style.display = 'none';
    }

    // Update the processed data to reflect the review
    const originalDomain = row.cells[0].textContent;
    const domainData = processedData.results.find(result => result.original === originalDomain);
    if (domainData) {
        domainData.confidence = 100;
        domainData.reviewed = true;
    }

    // Update the review count - count only unreviewed domains with confidence < 100
    const totalDomains = processedData.results.length;
    const lessConfidentDomains = processedData.results.filter(result =>
        result.confidence !== 100 && !result.reviewed
    ).length;

    const reviewCount = document.getElementById('reviewCount');
    reviewCount.textContent = `${lessConfidentDomains}/${totalDomains}`;
}

function processDomains(domains) {
    if (!domains || domains.length === 0) {
        showError('No domains provided');
        return;
    }

    // Show processing indicator
    processingIndicator.style.display = 'block';
    errorMessage.style.display = 'none';
    resultContainer.style.display = 'none';

    fetch('/convert', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domains: domains })
    })
        .then(response => response.json())
        .then(data => {
            processedData = data; // Store in our global variable
            window.lastProcessedData = data; // Keep for backwards compatibility
            displayResults(data.results);
            updateSummaryStats(data);
            displaySldStats(data);
            displayTldStats(data);
            displayWordStats(data.word_stats);
        })
        .catch(error => {
            console.error('Error:', error);
            showError('Error processing domains');
        })
        .finally(() => {
            processingIndicator.style.display = 'none';
        });
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification-popup';
    notification.textContent = message;
    document.body.appendChild(notification);

    // Remove the notification after animation completes (3 seconds + animation duration)
    setTimeout(() => {
        notification.remove();
    }, 3300);
}

function updateConvertedDomain(element) {
    // Reset border style when focus is lost
    element.style.border = '1px solid transparent';

    const originalWords = element.getAttribute('data-original');
    const newWords = element.innerText.trim();

    if (originalWords === newWords) {
        return; // No changes made
    }

    // Get the row elements
    const row = element.closest('tr');
    const originalDomain = row.cells[0].textContent;
    const convertedCell = row.cells[1];

    // Update the processedData
    const domainData = processedData.results.find(result => result.original === originalDomain);
    if (domainData) {
        domainData.split = newWords;
        // Update word count
        domainData.word_count = newWords.split(' ').length;
        row.cells[3].textContent = domainData.word_count;

        // Create camelCase version from new split words
        const camelCaseWords = newWords.split(' ').map((word, index) => {
            if (word.toLowerCase() === "ai") return "AI";
            if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
            return index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
        }).join('');

        // Get the domain extension
        const extension = originalDomain.split('.').slice(1).join('.');

        // Update converted domain
        const newConvertedDomain = `${camelCaseWords}.${extension}`;
        domainData.converted = newConvertedDomain;
        convertedCell.textContent = newConvertedDomain;

        // Recalculate word statistics
        const wordFreq = new Map();
        processedData.results.forEach(result => {
            if (result.split) {
                const words = result.split.toLowerCase().split(' ');
                words.forEach(word => {
                    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
                });
            }
        });

        // Convert Map to array of objects and sort by count
        const wordStats = Array.from(wordFreq.entries())
            .map(([word, count]) => ({ word, count }))
            .sort((a, b) => b.count - a.count);

        processedData.word_stats = wordStats;

        // Calculate word cloud data
        const words = wordStats.map(stat => stat.word);
        const counts = wordStats.map(stat => stat.count);
        processedData.word_cloud = calculate_word_cloud_layout(words, counts);

        // Update displays
        updateSummaryStats(processedData);
        displayWordStats(processedData.word_stats);
        createWordCloud(processedData.word_cloud, 'wordCloudContainer');
    }
}

// Helper function to calculate word cloud layout
function calculate_word_cloud_layout(words, counts, width = 800, height = 400) {
    const positions = [];
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    const countRange = maxCount - minCount + 1;

    words.forEach((word, i) => {
        const size = 20 + (counts[i] - minCount) * (60 / countRange);
        positions.push({
            text: word,
            size: Math.round(size),
            x: Math.random() * width - width/2,
            y: Math.random() * height - height/2,
            rotate: 0
        });
    });

    return positions;
}

function downloadDomains(filename) {
    if (!window.lastProcessedData || !window.lastProcessedData.results) {
        console.error('No processed data available');
        showNotification('No data available');
        return;
    }
    downloadMatchingDomains(window.lastProcessedData.results, filename);
}



function downloadWordCloudData(filename) {
    if (!window.lastProcessedData || !window.lastProcessedData.word_cloud) {
        console.error('No processed data available');
        showNotification('No data available');
        return;
    }
    const csvContent = [
        'Word,Size',
        ...window.lastProcessedData.word_cloud.map(item =>
            `${item.text},${item.size}`
        )
    ].join('\n');
    downloadCSV(csvContent, filename);
}

function downloadWordStats(filename) {
    if (!window.lastProcessedData || !window.lastProcessedData.word_stats) {
        console.error('No processed data available');
        showNotification('No data available');
        return;
    }
    const csvContent = [
        'Word,Occurrences',
        ...window.lastProcessedData.word_stats.map(item =>
            `"${item.word}","${item.count}"`
        )
    ].join('\n');
    downloadCSV(csvContent, filename);
}

function downloadSldStats(filename) {
    if (!window.lastProcessedData || !window.lastProcessedData.sld_stats) {
        console.error('No processed data available');
        showNotification('No data available');
        return;
    }
    const csvContent = [
        'SLD Length,Number of Domains',
        ...window.lastProcessedData.sld_stats.map(item =>
            `"${item.length}","${item.count}"`
        )
    ].join('\n');
    downloadCSV(csvContent, filename);
}

function downloadTldStats(filename) {
    if (!window.lastProcessedData || !window.lastProcessedData.tld_stats) {
        console.error('No processed data available');
        showNotification('No data available');
        return;
    }
    const csvContent = [
        'TLD,Number of Domains',
        ...window.lastProcessedData.tld_stats.map(item =>
            `"${item.tld}","${item.count}"`
        )
    ].join('\n');
    downloadCSV(csvContent, filename);
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}


function updateReviewCount() {
    if (!window.lastProcessedData || !window.lastProcessedData.results) return;
    const totalDomains = window.lastProcessedData.results.length;
    const lessConfidentDomains = window.lastProcessedData.results.filter(result => result.confidence !== 100 && !result.reviewed).length;
    const reviewCount = document.getElementById('reviewCount');
    reviewCount.textContent = `${lessConfidentDomains}/${totalDomains}`;
}

document.addEventListener('DOMContentLoaded', function () {
    // Initialize all tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadForm = document.getElementById('uploadForm');
    const processingIndicator = document.getElementById('processingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const resultContainer = document.getElementById('resultContainer');
    resultTable = document.getElementById('resultTable');
    const statsTable = document.getElementById('statsTable');
    const wordCloudContainer = document.getElementById('wordCloudContainer');
    const convertBtn = document.getElementById('convertBtn');
    const domainsTextarea = document.getElementById('domainsList');

    // Drag and drop handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#34C759';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#4A90E2';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#4A90E2';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // Click to upload
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Handle direct domain input
    convertBtn.addEventListener('click', () => {
        const domains = domainsTextarea.value.trim();
        if (!domains) {
            showError('Please enter some domain names');
            return;
        }

        const domainList = domains.split('\n')
            .map(d => d.trim())
            .filter(d => d);

        if (domainList.length === 0) {
            showError('Please enter valid domain names');
            return;
        }

        processDomains(domainList);
    });

    function handleFile(file) {
        if (!file.name.endsWith('.csv')) {
            showError('Please upload a CSV file');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const text = e.target.result;
            const domains = text.split('\n')
                .map(line => line.trim())
                .filter(line => line && line !== 'Original Domain');

            if (domains.length === 0) {
                showError('No valid domains found in CSV');
                return;
            }

            processDomains(domains);
        };
        reader.onerror = function () {
            showError('Error reading file');
        };
        reader.readAsText(file);
    }


    // Download handlers for each tab
    document.getElementById('downloadDomainsBtn').addEventListener('click', () => downloadDomains('converted_domains.csv'));
    document.getElementById('downloadWordCloudBtn').addEventListener('click', () => downloadWordCloudData('word_cloud_data.csv'));
    document.getElementById('downloadWordStatsBtn').addEventListener('click', () => downloadWordStats('word_statistics.csv'));
    document.getElementById('downloadSldStatsBtn').addEventListener('click', () => downloadSldStats('sld_length_statistics.csv'));
    document.getElementById('downloadTldStatsBtn').addEventListener('click', () => downloadTldStats('tld_statistics.csv'));

    // Add global toggle button event listener
    document.getElementById('toggleGraphLabels').addEventListener('click', function () {
        const currentState = localStorage.getItem('showGraphLabels') !== 'false';
        const newState = !currentState;
        localStorage.setItem('showGraphLabels', newState);

        // Get the current SVG and update visibility
        const svg = d3.select('#sldBarGraph svg g');
        if (!svg.empty()) {
            updateGraphLabelVisibility(svg, newState);
        }
    });

    // Add TLD graph labels toggle button event listener
    document.getElementById('toggleTldGraphLabels').addEventListener('click', function () {
        const currentState = localStorage.getItem('showTldGraphLabels') !== 'false';
        const newState = !currentState;
        localStorage.setItem('showTldGraphLabels', newState);

        // Get the current SVG and update visibility
        const svg = d3.select('#tldBarGraph svg g');
        if (!svg.empty()) {
            updateTldGraphLabelVisibility(svg, newState);
        }
    });

    // Add tab switching handler
    document.querySelector('button[data-bs-target="#sld-stats"]').addEventListener('shown.bs.tab', function (e) {
        if (window.lastProcessedData) {
            setTimeout(() => {
                displaySldStats(window.lastProcessedData);
            }, 100);
        }
    });

    // Add tab switching handler for TLD stats
    document.querySelector('button[data-bs-target="#tld-stats"]').addEventListener('shown.bs.tab', function (e) {
        if (window.lastProcessedData) {
            setTimeout(() => {
                const range = document.getElementById('tldLimit').value.trim();
                displayTldStats(window.lastProcessedData, range);
            }, 100);
        }
    });

    // Add update TLD limit button handler
    const updateTldLimit = document.getElementById('updateTldLimit');
    const tldLimitInput = document.getElementById('tldLimit');

    updateTldLimit.addEventListener('click', function () {
        const range = tldLimitInput.value.trim();
        const rangePattern = /^\d+\s*-\s*\d+$/;

        if (!rangePattern.test(range)) {
            alert('Please enter a valid range (e.g., 1-20)');
            return;
        }

        const [start, end] = range.split('-').map(n => parseInt(n.trim()));
        if (start > end) {
            alert('Start number must be less than or equal to end number');
            return;
        }

        if (start < 1) {
            alert('Range must start from 1 or higher');
            return;
        }

        if (window.lastProcessedData) {
            displayTldStats(window.lastProcessedData, range);
        }
    });
    // Add tab switching handler for Summary tab
    document.querySelector('button[data-bs-target="#summary"]').addEventListener('shown.bs.tab', function (e) {
        if (window.lastProcessedData) {
            setTimeout(() => {
                updateSummaryStats(window.lastProcessedData);
            }, 100);
        }
    });

    // Add handler for window resize to redraw charts
    window.addEventListener('resize', function () {
        if (window.lastProcessedData) {
            const activeTab = document.querySelector('.tab-pane.active');
            if (activeTab && activeTab.id === 'summary') {
                updateSummaryStats(window.lastProcessedData);
            }
        }
    });

    // Add filter toggle handler
    const filterToggle = document.getElementById('filterCommonWords');
    filterToggle.addEventListener('change', function () {
        if (window.lastProcessedData && window.lastProcessedData.word_stats) {
            displayWordStats(window.lastProcessedData.word_stats);
        }
    });

    // Add event listener for the confidence filter
    const hideConfidentCheckbox = document.getElementById('hideConfidentDomains');
    hideConfidentCheckbox.addEventListener('change', function () {
        if (window.lastProcessedData && window.lastProcessedData.results) {
            displayResults(window.lastProcessedData.results);
        }
    });

    // Add handler for domain updates
    document.addEventListener('domainUpdated', function (e) {
        // If we have stored data, update it
        if (window.lastProcessedData && window.lastProcessedData.results) {
            const row = e.target.closest('tr');
            const originalDomain = row.cells[0].textContent;

            // Find and update the corresponding result
            const result = window.lastProcessedData.results.find(r => r.original === originalDomain);
            if (result) {
                result.converted = e.detail.newConvertedDomain;
                result.split = e.detail.newWords;
                result.word_count = e.detail.wordCount;

                // Recalculate word statistics
                const allWords = window.lastProcessedData.results
                    .map(r => r.split ? r.split.toLowerCase().split(' ') : [])
                    .flat();

                // Update word stats
                const wordStats = Array.from(allWords.reduce((acc, word) => {
                    acc.set(word, (acc.get(word) || 0) + 1);
                    return acc;
                }, new Map()))
                    .map(([word, count]) => ({ word, count }))
                    .sort((a, b) => b.count - a.count);

                window.lastProcessedData.word_stats = wordStats;

                // Update word cloud data
                window.lastProcessedData.word_cloud = wordStats
                    .map(stat => ({
                        text: stat.word,
                        size: Math.max(20, Math.min(80, 20 + stat.count * 10))
                    }));

                // Refresh all visualizations
                displayWordStats(window.lastProcessedData.word_stats);
                createWordCloud(window.lastProcessedData.word_cloud, 'wordCloudContainer');
                updateSummaryStats(window.lastProcessedData);
            }
        }
    });

    // Add click handlers for sortable columns
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            sortTable(th.dataset.sort);
        });
    });

    // Add click handlers for table headers
    const headers = document.querySelectorAll('#resultTable th');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.sort;
            if (column) {
                sortTable(column);
            }
        });
    });
});