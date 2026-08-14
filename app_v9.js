document.addEventListener('DOMContentLoaded', () => {
    
    // --- Router Logik (Navigation) ---
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    const switchView = (targetViewId) => {
        views.forEach(view => view.classList.remove('active'));
        navItems.forEach(item => item.classList.remove('active'));
        
        const targetView = document.getElementById(targetViewId);
        if (targetView) targetView.classList.add('active');
        
        const targetNavBtn = document.querySelector(`.nav-item[data-target="${targetViewId}"]`);
        if (targetNavBtn) targetNavBtn.classList.add('active');
        
        document.getElementById('main-content').scrollTo(0, 0);

        if(targetViewId === 'view-table') renderDatabaseTable();
        if(targetViewId === 'view-daily') renderDailyView();
        if(targetViewId === 'view-stats') renderStatsView();
        if(targetViewId === 'view-insights') renderInsightsView();
        if(targetViewId === 'view-home') renderHomeFavorites();
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchView(item.getAttribute('data-target'));
        });
    });

    // --- Konstanten & State ---
    const LIMIT_MG = 400; 
    let dailyLog = JSON.parse(localStorage.getItem('gichtomat_log')) || {};
    
    // --- CUSTOM FOODS MERGE ---
    const customFoods = JSON.parse(localStorage.getItem('gichtomat_custom_foods')) || [];
    customFoods.forEach(customItem => {
        const existing = purinData.find(p => p.name.toLowerCase() === customItem.name.toLowerCase());
        if (existing) {
            existing.harnsaeure_100g = customItem.harnsaeure_100g;
            existing.category = customItem.category;
            existing.isCustom = true;
        } else {
            customItem.isCustom = true;
            purinData.push(customItem);
        }
    });

    const populateCategoryDatalist = () => {
        const datalist = document.getElementById('category-list');
        if (!datalist) return;
        datalist.innerHTML = '';
        const uniqueCategories = [...new Set(purinData.map(item => item.category))].sort();
        uniqueCategories.forEach(cat => {
            if(!cat) return;
            const option = document.createElement('option');
            option.value = cat;
            datalist.appendChild(option);
        });
    };
    populateCategoryDatalist();
    let currentActiveDate = new Date().toISOString().split('T')[0];
    const getTodayKey = () => currentActiveDate;

    window.editPastDay = (date) => {
        currentActiveDate = date;
        switchView('view-daily');
    };

    const saveLog = () => {
        localStorage.setItem('gichtomat_log', JSON.stringify(dailyLog));
    };

    const recalcTotal = (dateKey) => {
        if (!dailyLog[dateKey]) return;
        dailyLog[dateKey].total = dailyLog[dateKey].items.reduce((sum, item) => sum + item.harn_total, 0);
        saveLog();
    };

    // --- 1. HOME VIEW: Suche & Eingabe ---
    const searchInput = document.getElementById('food-search');
    const suggestionsBox = document.getElementById('suggestions');
    const amountInput = document.getElementById('food-amount');
    const form = document.getElementById('add-meal-form');
    const hiddenName = document.getElementById('selected-food-name');
    const hiddenHarn = document.getElementById('selected-food-harnsaeure');
    const bufferPreview = document.getElementById('buffer-preview');

    // Autocomplete
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        suggestionsBox.innerHTML = '';
        
        if (query.length < 2) {
            suggestionsBox.style.display = 'none';
            return;
        }

        const matches = purinData.filter(item => item.name.toLowerCase().includes(query)).slice(0, 10);
        
        if (matches.length > 0) {
            suggestionsBox.style.display = 'block';
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `<strong>${match.name}</strong> <span style="font-size:0.8em; color:var(--text-muted)">(${match.harnsaeure_100g}mg/100g)</span>`;
                div.addEventListener('click', () => {
                    searchInput.value = match.name;
                    hiddenName.value = match.name;
                    hiddenHarn.value = match.harnsaeure_100g;
                    suggestionsBox.style.display = 'none';
                    updateBufferPreview();
                    amountInput.focus();
                });
                suggestionsBox.appendChild(div);
            });
        } else {
            suggestionsBox.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.style.display = 'none';
        }
    });

    // Buffer Preview
    const updateBufferPreview = () => {
        const harn100 = parseFloat(hiddenHarn.value);
        const amount = parseFloat(amountInput.value);
        const today = getTodayKey();
        const currentTotal = dailyLog[today] ? dailyLog[today].total : 0;
        
        if (isNaN(harn100) || isNaN(amount) || amount <= 0) {
            bufferPreview.style.display = 'none';
            return;
        }

        const calcHarn = (amount / 100) * harn100;
        const newTotal = currentTotal + calcHarn;
        const buffer = LIMIT_MG - newTotal;

        bufferPreview.style.display = 'block';
        if (buffer >= 0) {
            bufferPreview.innerHTML = `Mit dieser Mahlzeit bleiben noch <strong>${Math.round(buffer)} mg</strong> Puffer für heute.`;
            bufferPreview.style.color = 'var(--text-muted)';
        } else {
            bufferPreview.innerHTML = `⚠️ Diese Mahlzeit überschreitet das Tageslimit um <strong>${Math.abs(Math.round(buffer))} mg</strong>!`;
            bufferPreview.style.color = 'var(--traffic-red)';
        }
    };
    amountInput.addEventListener('input', updateBufferPreview);

    // Formular Submit
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const homeTemplateSelect = document.getElementById('home-template-select');
        const templateId = homeTemplateSelect ? homeTemplateSelect.value : '';
        const today = getTodayKey();
        if (!dailyLog[today]) dailyLog[today] = { total: 0, items: [], note: "" };

        if (templateId) {
            // Apply template
            const templates = JSON.parse(localStorage.getItem('gichtomat_templates')) || [];
            const template = templates.find(t => t.id === templateId);
            if (template && template.items) {
                template.items.forEach(item => {
                    dailyLog[today].items.push({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                        name: item.name,
                        harn100: item.harn100,
                        amount: item.amount,
                        harn_total: item.harn_total,
                        time: new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'})
                    });
                });
                alert(`Vorlage "${template.name}" hinzugefügt!`);
            }
        } else {
            // Manual entry
            const name = hiddenName.value;
            const harn100 = parseFloat(hiddenHarn.value);
            const amount = parseFloat(amountInput.value);

            if (!name || isNaN(harn100) || isNaN(amount)) {
                alert('Bitte wähle ein Lebensmittel aus der Liste und gib eine Menge ein, oder wähle eine Vorlage.');
                return;
            }

            const calcHarn = (amount / 100) * harn100;
            
            dailyLog[today].items.push({
                id: Date.now().toString(),
                name: name,
                harn100: harn100, // Speichere Basiswert fürs Bearbeiten
                amount: amount,
                harn_total: calcHarn,
                time: new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'})
            });
        }

        recalcTotal(today);

        // Reset
        searchInput.value = '';
        amountInput.value = '';
        hiddenName.value = '';
        hiddenHarn.value = '';
        if (homeTemplateSelect) homeTemplateSelect.value = '';
        bufferPreview.style.display = 'none';
        
        updateTrafficLight();
        
        const btn = form.querySelector('button');
        const origText = btn.textContent;
        btn.textContent = 'Hinzugefügt!';
        btn.style.background = 'var(--traffic-green)';
        setTimeout(() => {
            btn.textContent = origText;
            btn.style.background = '';
        }, 1000);
    });

    const indicator = document.getElementById('traffic-light-indicator');
    const totalDisplay = document.getElementById('daily-total-display');

    const updateTrafficLight = () => {
        const today = getTodayKey();
        const total = dailyLog[today] ? dailyLog[today].total : 0;
        
        totalDisplay.textContent = Math.round(total);

        let color = 'var(--traffic-green)';
        if (total >= 300 && total <= 400) {
            color = 'var(--traffic-yellow)';
        } else if (total > 400) {
            color = 'var(--traffic-red)';
        }

        indicator.style.background = color;
        indicator.style.boxShadow = `0 0 20px ${color}, inset 0 0 15px rgba(255,255,255,0.5)`;
    };


    // --- 2. DAILY VIEW ---
    const dateDisplay = document.getElementById('current-date-display');
    if (dateDisplay) {
        dateDisplay.addEventListener('change', (e) => {
            if (e.target.value) {
                currentActiveDate = e.target.value;
                renderDailyView();
                updateTrafficLight();
            }
        });
    }
    const dailyListContainer = document.getElementById('daily-list');
    const dailyEmptyMsg = document.getElementById('daily-empty-msg');
    const saveNoteInput = document.getElementById('daily-note-input');
    const saveAttackInput = document.getElementById('daily-attack');
    const attackDetailsDiv = document.getElementById('attack-details');
    const painPointsContainer = document.getElementById('pain-points-container');
    const addPainPointBtn = document.getElementById('add-pain-point-btn');
    const cameraUpload = document.getElementById('camera-upload');
    const photosContainer = document.getElementById('photos-container');
    const saveAttackMed = document.getElementById('daily-attack-med');
    const saveWaterInput = document.getElementById('daily-water');

    window.addWater = (amount) => {
        if(!saveWaterInput) return;
        let current = parseInt(saveWaterInput.value) || 0;
        saveWaterInput.value = current + amount;
        saveWaterInput.dispatchEvent(new Event('change'));
    };
    
    if (saveNoteInput) {
        saveNoteInput.addEventListener('change', (e) => {
            const today = getTodayKey();
            if (!dailyLog[today]) {
                dailyLog[today] = { items: [], note: '', attack: false, water: 0 };
            }
            dailyLog[today].note = e.target.value;
            saveLog();
        });
    }

    const renderPhotos = (dateKey) => {
        if (!photosContainer) return;
        photosContainer.innerHTML = '';
        const log = dailyLog[dateKey];
        if (!log || !log.attack || !log.photos) return;

        log.photos.forEach((photoData, idx) => {
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.flexShrink = '0';
            
            const img = document.createElement('img');
            img.src = photoData;
            img.style.width = '60px';
            img.style.height = '60px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            img.style.border = '1px solid var(--traffic-red)';
            img.style.cursor = 'pointer';
            img.onclick = () => {
                const w = window.open("");
                w.document.write(`<img src="${photoData}" style="max-width:100%;">`);
            };
            
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '&times;';
            delBtn.style.position = 'absolute';
            delBtn.style.top = '-10px';
            delBtn.style.right = '-10px';
            delBtn.style.background = 'var(--traffic-red)';
            delBtn.style.color = 'white';
            delBtn.style.border = 'none';
            delBtn.style.borderRadius = '50%';
            delBtn.style.width = '28px';
            delBtn.style.height = '28px';
            delBtn.style.fontSize = '1.2rem';
            delBtn.style.cursor = 'pointer';
            delBtn.style.fontSize = '12px';
            delBtn.style.display = 'flex';
            delBtn.style.alignItems = 'center';
            delBtn.style.justifyContent = 'center';
            delBtn.onclick = () => {
                log.photos.splice(idx, 1);
                saveLog();
                renderPhotos(dateKey);
            };

            wrapper.appendChild(img);
            wrapper.appendChild(delBtn);
            photosContainer.appendChild(wrapper);
        });
    };

    if (cameraUpload) {
        cameraUpload.addEventListener('change', (e) => {
            const today = getTodayKey();
            if (!dailyLog[today]) dailyLog[today] = { items: [], note: '', attack: false, water: 0 };
            if (!dailyLog[today].photos) dailyLog[today].photos = [];
            
            const files = e.target.files;
            if (!files.length) return;

            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 800;
                        const MAX_HEIGHT = 800;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                            }
                        } else {
                            if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                            }
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                        
                        dailyLog[today].photos.push(dataUrl);
                        saveLog();
                        renderPhotos(today);
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            });
            cameraUpload.value = ''; // Reset
        });
    }

    const renderPainPoints = (dateKey) => {
        if (!painPointsContainer) return;
        painPointsContainer.innerHTML = '';
        const log = dailyLog[dateKey];
        if (!log || !log.attack) return;

        // Migration von altem Datenformat
        if (log.attackBodyPart && (!log.painPoints || log.painPoints.length === 0)) {
            log.painPoints = [{ part: log.attackBodyPart, intensity: 5 }];
            delete log.attackBodyPart;
            saveLog();
        }
        
        const points = log.painPoints || [];
        
        points.forEach((pt, idx) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'center';

            const partInput = document.createElement('input');
            partInput.type = 'text';
            partInput.value = pt.part;
            partInput.placeholder = 'Körperteil...';
            partInput.style.flex = '1';
            partInput.style.padding = '6px';
            partInput.style.fontSize = '0.9em';
            partInput.addEventListener('change', (e) => {
                log.painPoints[idx].part = e.target.value;
                saveLog();
            });

            const intensityInput = document.createElement('input');
            intensityInput.type = 'number';
            intensityInput.min = '1';
            intensityInput.max = '10';
            intensityInput.value = pt.intensity;
            intensityInput.style.width = '60px';
            intensityInput.style.padding = '6px';
            intensityInput.style.fontSize = '0.9em';
            intensityInput.title = 'Schmerzskala 1-10';
            intensityInput.addEventListener('change', (e) => {
                let val = parseInt(e.target.value) || 1;
                if(val < 1) val = 1;
                if(val > 10) val = 10;
                e.target.value = val;
                log.painPoints[idx].intensity = val;
                saveLog();
            });

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.innerHTML = '<i class="ph ph-trash"></i>';
            delBtn.className = 'action-btn';
            delBtn.style.color = 'var(--traffic-red)';
            delBtn.addEventListener('click', () => {
                log.painPoints.splice(idx, 1);
                saveLog();
                renderPainPoints(dateKey);
            });

            row.appendChild(partInput);
            row.appendChild(intensityInput);
            row.appendChild(delBtn);
            painPointsContainer.appendChild(row);
        });
    };

    if (addPainPointBtn) {
        addPainPointBtn.addEventListener('click', () => {
            const today = getTodayKey();
            if (!dailyLog[today]) dailyLog[today] = { items: [], note: '', attack: false, water: 0 };
            if (!dailyLog[today].painPoints) dailyLog[today].painPoints = [];
            dailyLog[today].painPoints.push({ part: '', intensity: 5 });
            saveLog();
            renderPainPoints(today);
        });
    }

    if (saveAttackInput) {
        saveAttackInput.addEventListener('change', (e) => {
            const today = getTodayKey();
            if (!dailyLog[today]) {
                dailyLog[today] = { items: [], note: '', attack: false, water: 0 };
            }
            dailyLog[today].attack = e.target.checked;
            
            if(!dailyLog[today].attack) {
                dailyLog[today].attackBodyPart = '';
                dailyLog[today].painPoints = [];
                dailyLog[today].photos = [];
                dailyLog[today].attackMedication = '';
                if(saveAttackMed) saveAttackMed.value = '';
            }
            if(attackDetailsDiv) attackDetailsDiv.style.display = e.target.checked ? 'block' : 'none';
            if(e.target.checked) {
                renderPainPoints(today);
                renderPhotos(today);
            }
            
            saveLog();
        });
    }

    if (saveAttackMed) {
        saveAttackMed.addEventListener('change', (e) => {
            const today = getTodayKey();
            if (dailyLog[today]) {
                dailyLog[today].attackMedication = e.target.value.trim();
                saveLog();
            }
        });
    }

    if (saveWaterInput) {
        saveWaterInput.addEventListener('change', (e) => {
            const today = getTodayKey();
            if (!dailyLog[today]) {
                dailyLog[today] = { items: [], note: '', attack: false, water: 0 };
            }
            dailyLog[today].water = parseInt(e.target.value) || 0;
            saveLog();
        });
    }

    window.toggleAttack = (dateString) => {
        if(dailyLog[dateString]) {
            dailyLog[dateString].attack = !dailyLog[dateString].attack;
            
            if(dailyLog[dateString].attack) {
                const part = prompt("Körperteil (optional, z.B. Großzehe):") || '';
                const intensity = prompt("Schmerzskala 1-10 (optional):") || '5';
                const med = prompt("Medikament (optional, z.B. Ibuprofen):") || '';
                
                if (part.trim()) {
                    dailyLog[dateString].painPoints = [{ part: part.trim(), intensity: parseInt(intensity) || 5 }];
                } else {
                    dailyLog[dateString].painPoints = [];
                }
                dailyLog[dateString].attackMedication = med.trim();
            } else {
                dailyLog[dateString].painPoints = [];
                dailyLog[dateString].attackMedication = '';
            }
            
            saveLog();
            renderStatsView(); 
        }
    };

    window.deleteDailyItem = (id) => {
        if(!confirm('Eintrag wirklich löschen?')) return;
        const today = getTodayKey();
        if(dailyLog[today]) {
            dailyLog[today].items = dailyLog[today].items.filter(i => String(i.id) !== String(id));
            recalcTotal(today);
            renderDailyView();
            updateTrafficLight();
        }
    };

    window.editDailyItem = (id) => {
        const today = getTodayKey();
        if(!dailyLog[today]) return;
        const item = dailyLog[today].items.find(i => String(i.id) === String(id));
        if(!item) return;

        const newAmount = prompt(`Neue Menge in Gramm für ${item.name}:`, item.amount);
        if(newAmount !== null && !isNaN(parseFloat(newAmount)) && parseFloat(newAmount) > 0) {
            item.amount = parseFloat(newAmount);
            item.harn_total = (item.amount / 100) * item.harn100;
            recalcTotal(today);
            renderDailyView();
            updateTrafficLight();
        }
    };

    const renderDailyView = () => {
        dateDisplay.value = currentActiveDate;

        const today = getTodayKey();
        const data = dailyLog[today] || { total: 0, items: [], note: "", attack: false, water: 0 };

        if(saveNoteInput) saveNoteInput.value = data.note || "";
        if(saveAttackInput) {
            saveAttackInput.checked = !!data.attack;
            if(attackDetailsDiv) attackDetailsDiv.style.display = saveAttackInput.checked ? 'block' : 'none';
            if(saveAttackMed) saveAttackMed.value = data.attackMedication || '';
            renderPainPoints(today);
            renderPhotos(today);
        }
        if(saveWaterInput) saveWaterInput.value = data.water || "";

        dailyListContainer.innerHTML = '';
        
        if (data.items.length === 0) {
            dailyEmptyMsg.style.display = 'block';
        } else {
            dailyEmptyMsg.style.display = 'none';
            const sortedItems = [...data.items].reverse();
            
            sortedItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'daily-item';
                div.innerHTML = `
                    <div class="item-info">
                        <h4>${item.name}</h4>
                        <p>${item.amount}g • um ${item.time} Uhr</p>
                        <div class="item-actions">
                            <button class="action-btn" onclick="editDailyItem('${item.id}')"><i class="ph ph-pencil-simple"></i> Edit</button>
                            <button class="action-btn delete" onclick="deleteDailyItem('${item.id}')"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                    <div class="item-value">${Math.round(item.harn_total)} mg</div>
                `;
                dailyListContainer.appendChild(div);
            });
        }
    };

    // --- 3. STATS VIEW ---
    const statsList = document.getElementById('stats-list');
    const statsMonthFilter = document.getElementById('stats-month-filter');

    const renderStatsView = () => {
        statsList.innerHTML = '';
        const keys = Object.keys(dailyLog).sort().reverse(); 
        
        if(keys.length === 0) {
            statsList.innerHTML = '<p class="text-muted">Noch keine Daten vorhanden.</p>';
            if(statsMonthFilter) statsMonthFilter.style.display = 'none';
            return;
        }

        // Filter keys by month
        const months = new Set();
        keys.forEach(date => {
            months.add(date.substring(0, 7)); // "YYYY-MM"
        });
        const monthsArray = Array.from(months);

        if (statsMonthFilter) {
            statsMonthFilter.style.display = 'block';
            let selectedMonth = statsMonthFilter.value;
            if (!selectedMonth || !months.has(selectedMonth)) {
                selectedMonth = monthsArray[0];
            }

            statsMonthFilter.innerHTML = '';
            monthsArray.forEach(mStr => {
                const [yyyy, mm] = mStr.split('-');
                const d = new Date(yyyy, parseInt(mm)-1, 1);
                const label = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
                const option = document.createElement('option');
                option.value = mStr;
                option.textContent = label;
                if (mStr === selectedMonth) option.selected = true;
                statsMonthFilter.appendChild(option);
            });
        }

        const activeMonth = statsMonthFilter ? statsMonthFilter.value : null;
        const filteredKeys = activeMonth ? keys.filter(date => date.startsWith(activeMonth)) : keys;

        if (filteredKeys.length === 0) {
            statsList.innerHTML = '<p class="text-muted">Keine Einträge für diesen Monat.</p>';
            return;
        }

        filteredKeys.forEach(date => {
            const data = dailyLog[date];
            const totalHarn = Math.round(data.total);
            let color = 'var(--traffic-green)';
            if (data.total >= 300 && data.total <= 400) color = 'var(--traffic-yellow)';
            else if (data.total > 400) color = 'var(--traffic-red)';

            const dateFormatted = new Date(date).toLocaleDateString('de-DE');
            const hasAttack = !!data.attack;
            const waterAmt = data.water || 0;
            
            let attackText = "💥 Schub";
            if (hasAttack && ((data.painPoints && data.painPoints.length > 0) || data.attackBodyPart || data.attackMedication || (data.photos && data.photos.length > 0))) {
                let parts = [];
                
                const points = data.painPoints || (data.attackBodyPart ? [{part: data.attackBodyPart, intensity: ''}] : []);
                points.forEach(pt => {
                    if(pt.part) {
                        parts.push(`🩸 ${pt.part}${pt.intensity ? ' ('+pt.intensity+'/10)' : ''}`);
                    }
                });

                if (data.attackMedication) parts.push(`💊 ${data.attackMedication}`);
                if (data.photos && data.photos.length > 0) parts.push(`📷 ${data.photos.length} Foto(s)`);
                attackText += ` <span style="font-weight:normal; opacity:0.8;">(${parts.join(', ')})</span>`;
            }
            
            const waterHtml = waterAmt > 0 ? `<br><span style="font-size:0.85em; color:var(--traffic-green);"><i class="ph ph-drop"></i> ${waterAmt} ml Wasser</span>` : '';
            const noteHtml = data.note ? `<br><span style="font-size:0.85em; color:var(--text-muted);"><i class="ph ph-note"></i> ${data.note}</span>` : '';
            const attackLabel = hasAttack ? `<span style="color:var(--traffic-red); font-size:0.75em; margin-left:8px; display:inline-block; vertical-align:middle; padding:2px 6px; background:rgba(239,68,68,0.1); border-radius:4px;">${attackText}</span>` : '';

            const editBtn = `<button class="action-btn" onclick="editPastDay('${date}')" title="Tag bearbeiten" style="color: var(--text-muted); margin-left:10px;">
                                   <i class="ph ph-pencil-simple"></i>
                               </button>`;

            const div = document.createElement('div');
            div.className = 'daily-item';
            div.innerHTML = `
                <div class="item-info">
                    <h4>${dateFormatted}${attackLabel}</h4>
                    <p>Mahlzeiten: ${data.items.length} ${waterHtml} ${noteHtml}</p>
                </div>
                <div style="display:flex; align-items:center;">
                    <div class="item-value" style="color: ${color};">${totalHarn} mg</div>
                    ${editBtn}
                </div>
            `;
            statsList.appendChild(div);
        });
    };

    if (statsMonthFilter) {
        statsMonthFilter.addEventListener('change', renderStatsView);
    }

    // --- 4. TABLE VIEW ---
    const dbSearchInput = document.getElementById('db-search');
    const dbTableBody = document.getElementById('db-table-body');
    let currentDbSort = 'name'; 
    let dbSortDesc = false;

    window.editDbItem = (name) => {
        const item = purinData.find(p => p.name === name);
        if(!item) return;

        document.getElementById('custom-food-name').value = item.name;
        document.getElementById('custom-food-cat').value = item.category;
        document.getElementById('custom-food-harn').value = item.harnsaeure_100g;
        
        const btn = document.querySelector('#add-custom-food-form button');
        if(btn) btn.textContent = 'Änderung Speichern';
        
        document.getElementById('main-content').scrollTo({top: 0, behavior: 'smooth'});
        document.getElementById('custom-food-cat').focus();
    };

    window.setDbSort = (col) => {
        if (currentDbSort === col) {
            dbSortDesc = !dbSortDesc;
        } else {
            currentDbSort = col;
            dbSortDesc = false;
        }
        renderDatabaseTable(dbSearchInput.value);
    };

    const dbFilterSelect = document.getElementById('db-filter');
    if (dbFilterSelect) {
        dbFilterSelect.addEventListener('change', () => renderDatabaseTable(dbSearchInput.value));
    }

    const renderDatabaseTable = (filter = '') => {
        dbTableBody.innerHTML = '';
        const query = filter.toLowerCase().trim();
        const mode = dbFilterSelect ? dbFilterSelect.value : 'all';
        
        if (mode === 'templates') {
            const templates = JSON.parse(localStorage.getItem('gichtomat_templates')) || [];
            let matches = templates.filter(t => t.name.toLowerCase().includes(query));
            
            // Minimal sorting for templates
            matches.sort((a, b) => a.name.localeCompare(b.name));

            matches.forEach(t => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="font-weight:600;">${t.name}</div>
                        <div style="font-size:0.8em; color:var(--text-muted);">Menge: ${t.totalAmount}g</div>
                    </td>
                    <td style="color:var(--traffic-yellow); font-size:0.8em"><i class="ph ph-star"></i> Vorlage</td>
                    <td><strong>${Math.round(t.totalHarn)}</strong></td>
                    <td style="text-align:right; white-space:nowrap;">
                        <button class="action-btn" style="display:inline-block; margin-right:4px;" onclick="editTemplate('${t.id}')">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                        <button class="action-btn delete" style="display:inline-block;" onclick="deleteTemplate('${t.id}')">
                            <i class="ph ph-trash"></i>
                        </button>
                    </td>
                `;
                dbTableBody.appendChild(tr);
            });
            return;
        }

        let matches = purinData.filter(item => {
            if (mode === 'custom' && !item.isCustom) return false;
            return item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
        });

        matches.sort((a, b) => {
            if (currentDbSort === 'name') {
                const cmp = a.name.localeCompare(b.name);
                return dbSortDesc ? -cmp : cmp;
            } else if (currentDbSort === 'category') {
                const cmp = a.category.localeCompare(b.category);
                return dbSortDesc ? -cmp : cmp;
            } else if (currentDbSort === 'harn') {
                const cmp = a.harnsaeure_100g - b.harnsaeure_100g;
                return dbSortDesc ? -cmp : cmp;
            }
            return 0;
        });

        const iconName = document.getElementById('sort-icon-name');
        const iconCat = document.getElementById('sort-icon-category');
        const iconHarn = document.getElementById('sort-icon-harn');
        if(iconName) iconName.textContent = currentDbSort === 'name' ? (dbSortDesc ? '↓' : '↑') : '';
        if(iconCat) iconCat.textContent = currentDbSort === 'category' ? (dbSortDesc ? '↓' : '↑') : '';
        if(iconHarn) iconHarn.textContent = currentDbSort === 'harn' ? (dbSortDesc ? '↓' : '↑') : '';

        matches.forEach(item => {
            const tr = document.createElement('tr');
            const escapedName = item.name.replace(/'/g, "\\'");
            tr.innerHTML = `
                <td>${item.name}</td>
                <td style="color:var(--text-muted); font-size:0.8em">${item.category}</td>
                <td><strong>${item.harnsaeure_100g}</strong></td>
                <td style="text-align:right;">
                    <button class="action-btn" style="display:inline-block;" onclick="editDbItem('${escapedName}')">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                </td>
            `;
            dbTableBody.appendChild(tr);
        });
    };

    dbSearchInput.addEventListener('input', (e) => {
        renderDatabaseTable(e.target.value);
    });

    // --- 5. INSIGHTS VIEW ---
    const insightsContainer = document.getElementById('insights-container');
    const topFoodsList = document.getElementById('top-foods-list');

    const renderInsightsView = () => {
        // UI Reset
        searchInput.value = '';
        if(saveNoteInput) saveNoteInput.value = '';
        if(saveAttackInput) {
            saveAttackInput.checked = false;
            if(attackDetailsDiv) attackDetailsDiv.style.display = 'none';
            if(painPointsContainer) painPointsContainer.innerHTML = '';
            if(photosContainer) photosContainer.innerHTML = '';
            if(saveAttackMed) saveAttackMed.value = '';
        }
        if(saveWaterInput) saveWaterInput.value = '';

        const today = getTodayKey();
        
        // Notiz & Schub laden
        if(dailyLog[today]) {
            if(saveNoteInput) saveNoteInput.value = dailyLog[today].note || '';
            if(saveAttackInput) {
                saveAttackInput.checked = !!dailyLog[today].attack;
                if(attackDetailsDiv) attackDetailsDiv.style.display = saveAttackInput.checked ? 'block' : 'none';
                if(saveAttackMed) saveAttackMed.value = dailyLog[today].attackMedication || '';
                renderPainPoints(today);
                renderPhotos(today);
            }
            if(saveWaterInput) saveWaterInput.value = dailyLog[today].water || '';
        }

        // Warnungen (wie bisher)
        insightsContainer.innerHTML = '';
        const total = dailyLog[today] ? dailyLog[today].total : 0;
        
        let statusHtml = '';
        if (total > LIMIT_MG) {
            statusHtml = `
            <div class="card insight-card danger mb-3">
                <div class="insight-icon"><i class="ph ph-warning-circle"></i></div>
                <div>
                    <h3>Achtung! Limit überschritten</h3>
                    <p class="text-muted">Du hast heute bereits ${Math.round(total)}mg Harnsäure aufgenommen. Das Limit liegt bei ${LIMIT_MG}mg. Bitte achte darauf, heute nur noch purinarme Lebensmittel (wie Milchprodukte oder Eier) zu essen.</p>
                </div>
            </div>`;
        } else if (total > LIMIT_MG * 0.75) {
            statusHtml = `
            <div class="card insight-card warning mb-3">
                <div class="insight-icon"><i class="ph ph-warning-circle"></i></div>
                <div>
                    <h3>Limit fast erreicht</h3>
                    <p class="text-muted">Du bist bei ${Math.round(total)}mg. Sei bei den nächsten Mahlzeiten vorsichtig mit Fleisch und Hülsenfrüchten.</p>
                </div>
            </div>`;
        } else {
            statusHtml = `
            <div class="card insight-card success mb-3">
                <div class="insight-icon"><i class="ph ph-check-circle"></i></div>
                <div>
                    <h3>Alles im grünen Bereich</h3>
                    <p class="text-muted">Deine Werte sehen heute hervorragend aus!</p>
                </div>
            </div>`;
        }
        
        insightsContainer.innerHTML = statusHtml;

        // TOP LEBENSMITTEL & KATEGORIEN RANKING
        topFoodsList.innerHTML = '';
        const topCategoriesList = document.getElementById('top-categories-list');
        if(topCategoriesList) topCategoriesList.innerHTML = '';
        
        // Alle Items aus der Historie sammeln
        const foodAggregation = {};
        const categoryAggregation = {};
        
        Object.values(dailyLog).forEach(day => {
            day.items.forEach(item => {
                // Lebensmittel
                if(!foodAggregation[item.name]) {
                    foodAggregation[item.name] = { totalHarn: 0, totalAmount: 0, count: 0 };
                }
                foodAggregation[item.name].totalHarn += item.harn_total;
                foodAggregation[item.name].totalAmount += item.amount;
                foodAggregation[item.name].count += 1;

                // Kategorie ermitteln
                const dbItem = purinData.find(p => p.name === item.name);
                const cat = dbItem ? dbItem.category : "Sonstiges";

                if(!categoryAggregation[cat]) {
                    categoryAggregation[cat] = { totalHarn: 0, count: 0 };
                }
                categoryAggregation[cat].totalHarn += item.harn_total;
                categoryAggregation[cat].count += 1;
            });
        });

        // 1. Lebensmittel rendern
        const sortedFoods = Object.entries(foodAggregation)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.totalHarn - a.totalHarn);

        if(sortedFoods.length === 0) {
            topFoodsList.innerHTML = '<p class="text-muted text-center">Noch nicht genug Daten für ein Ranking.</p>';
            if(topCategoriesList) topCategoriesList.innerHTML = '<p class="text-muted text-center">Noch nicht genug Daten für ein Ranking.</p>';
            return;
        }

        // Alle Lebensmittel anzeigen (nicht nur Top 10)
        sortedFoods.forEach((food, index) => {
            const avgHarn = (food.totalHarn / food.count).toFixed(0);
            const div = document.createElement('div');
            div.className = 'daily-item';
            div.innerHTML = `
                <div class="item-info">
                    <h4>#${index + 1} ${food.name}</h4>
                    <p>${food.count}x verzehrt (Ø ${avgHarn} mg pro Mahlzeit)</p>
                </div>
                <div class="item-value" style="color: var(--traffic-red); text-align:right;">
                    Gesamt<br>${Math.round(food.totalHarn)} mg
                </div>
            `;
            topFoodsList.appendChild(div);
        });

        // 2. Kategorien rendern
        if (topCategoriesList) {
            const sortedCategories = Object.entries(categoryAggregation)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.totalHarn - a.totalHarn);

            sortedCategories.forEach((cat, index) => {
                const avgHarn = (cat.totalHarn / cat.count).toFixed(0);
                const div = document.createElement('div');
                div.className = 'daily-item';
                div.innerHTML = `
                    <div class="item-info">
                        <h4>#${index + 1} ${cat.name}</h4>
                        <p>${cat.count}x Mahlzeiten (Ø ${avgHarn} mg pro Mahlzeit)</p>
                    </div>
                    <div class="item-value" style="color: var(--traffic-red); text-align:right;">
                        Gesamt<br>${Math.round(cat.totalHarn)} mg
                    </div>
                `;
                topCategoriesList.appendChild(div);
            });
        }

        // 3. SCHUB TAGE LEBENSMITTEL
        const attackFoodsList = document.getElementById('attack-foods-list');
        if (attackFoodsList) {
            attackFoodsList.innerHTML = '';
            const attackAggregation = {};
            let hasAnyAttacks = false;

            Object.values(dailyLog).forEach(day => {
                if(day.attack) {
                    hasAnyAttacks = true;
                    day.items.forEach(item => {
                        if(!attackAggregation[item.name]) {
                            attackAggregation[item.name] = { totalHarn: 0, count: 0 };
                        }
                        attackAggregation[item.name].totalHarn += item.harn_total;
                        attackAggregation[item.name].count += 1;
                    });
                }
            });

            if(!hasAnyAttacks) {
                attackFoodsList.innerHTML = '<p class="text-muted text-center">Bisher keine Schübe markiert.</p>';
            } else {
                const sortedAttack = Object.entries(attackAggregation)
                    .map(([name, data]) => ({ name, ...data }))
                    .sort((a, b) => b.totalHarn - a.totalHarn);
                    
                sortedAttack.forEach((food, index) => {
                    const avgHarn = (food.totalHarn / food.count).toFixed(0);
                    const div = document.createElement('div');
                    div.className = 'daily-item';
                    div.innerHTML = `
                        <div class="item-info">
                            <h4>#${index + 1} ${food.name}</h4>
                            <p>${food.count}x an Schub-Tagen verzehrt</p>
                        </div>
                        <div class="item-value" style="color: var(--traffic-red); text-align:right;">
                            Gesamt<br>${Math.round(food.totalHarn)} mg
                        </div>
                    `;
                    attackFoodsList.appendChild(div);
                });
            }
        }

        // 4. WASSER STATISTIK
        const waterStatsContainer = document.getElementById('water-stats');
        if (waterStatsContainer) {
            let totalWater = 0;
            let daysWithWater = 0;
            
            Object.values(dailyLog).forEach(day => {
                if(day.water && day.water > 0) {
                    totalWater += day.water;
                    daysWithWater += 1;
                }
            });

            const avgWater = daysWithWater > 0 ? Math.round(totalWater / daysWithWater) : 0;
            
            waterStatsContainer.innerHTML = `
                <div style="flex:1; background: white; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="font-size: 0.9em; color: var(--text-muted); margin-bottom: 5px;">Gesamt getrunken</div>
                    <div style="font-size: 1.5em; font-weight: 700; color: var(--traffic-green);">${totalWater} ml</div>
                </div>
                <div style="flex:1; background: white; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="font-size: 0.9em; color: var(--text-muted); margin-bottom: 5px;">Durchschnitt / Tag</div>
                    <div style="font-size: 1.5em; font-weight: 700; color: var(--traffic-green);">${avgWater} ml</div>
                </div>
            `;
        }

        // 5. GICHTSCHUB PROTOKOLL
        const attackProtocolList = document.getElementById('attack-protocol-list');
        if(attackProtocolList) {
            attackProtocolList.innerHTML = '';
            let attacksFound = false;

            const sortedDates = Object.keys(dailyLog).sort((a,b) => new Date(b) - new Date(a));
            sortedDates.forEach(date => {
                const day = dailyLog[date];
                if(day.attack) {
                    attacksFound = true;
                    const dateFormatted = new Date(date).toLocaleDateString('de-DE');
                    const noteStr = day.note ? `<span style="display:block; font-size:0.85em; color:var(--text-muted); margin-top:4px;"><i class="ph ph-note"></i> Notiz: ${day.note}</span>` : '';
                    
                    let parts = [];
                    const points = day.painPoints || (day.attackBodyPart ? [{part: day.attackBodyPart, intensity: ''}] : []);
                    points.forEach(pt => {
                        if(pt.part) {
                            parts.push(`🩸 ${pt.part}${pt.intensity ? ' ('+pt.intensity+'/10)' : ''}`);
                        }
                    });
                    if (day.attackMedication) parts.push(`💊 ${day.attackMedication}`);
                    if (day.photos && day.photos.length > 0) parts.push(`📷 ${day.photos.length} Foto(s)`);
                    const detailsStr = parts.length > 0 ? `<div style="margin-top: 6px; font-size: 0.85em; color: var(--traffic-red);">${parts.join(' &nbsp;|&nbsp; ')}</div>` : '';
                    
                    const foodNames = day.items.map(i => i.name).join(', ');
                    const foodsStr = foodNames ? `<div style="margin-top: 6px; font-size: 0.85em; color: var(--text-color);"><i class="ph ph-fork-knife"></i> Verzehrt: ${foodNames}</div>` : '';

                    let photosStr = '';
                    if (day.photos && day.photos.length > 0) {
                        photosStr = `<div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">`;
                        day.photos.forEach(photo => {
                            photosStr += `<img src="${photo}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; border: 1px solid var(--traffic-red);">`;
                        });
                        photosStr += `</div>`;
                    }

                    const div = document.createElement('div');
                    div.className = 'daily-item';
                    div.style.flexDirection = 'column';
                    div.style.alignItems = 'flex-start';
                    div.innerHTML = `
                        <div style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
                            <h4 style="margin:0;">${dateFormatted}</h4>
                            <div class="item-value" style="color:var(--traffic-red); font-size: 0.9em;">${Math.round(day.total)} mg</div>
                        </div>
                        ${noteStr}
                        ${detailsStr}
                        ${foodsStr}
                        ${photosStr}
                    `;
                    attackProtocolList.appendChild(div);
                }
            });

            if(!attacksFound) {
                attackProtocolList.innerHTML = '<p class="text-muted text-center">Bisher keine Schübe protokolliert.</p>';
            }
        }
    };


    // --- CUSTOM FOOD FORM ---
    const customFoodForm = document.getElementById('add-custom-food-form');
    if (customFoodForm) {
        customFoodForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('custom-food-name').value.trim();
            const cat = document.getElementById('custom-food-cat').value.trim();
            const harn = parseInt(document.getElementById('custom-food-harn').value);

            if (!name || !cat || isNaN(harn)) return;

            const newItem = { name: name, category: cat, harnsaeure_100g: harn };
            
            const stored = JSON.parse(localStorage.getItem('gichtomat_custom_foods')) || [];
            const filtered = stored.filter(i => i.name.toLowerCase() !== name.toLowerCase());
            filtered.push(newItem);
            localStorage.setItem('gichtomat_custom_foods', JSON.stringify(filtered));

            // Update in-memory data
            const existing = purinData.find(p => p.name.toLowerCase() === name.toLowerCase());
            if (existing) {
                existing.harnsaeure_100g = harn;
                existing.category = cat;
                existing.isCustom = true;
            } else {
                newItem.isCustom = true;
                purinData.push(newItem);
            }

            // Update UI without reload
            populateCategoryDatalist();
            if(typeof renderDatabaseTable === 'function') {
                renderDatabaseTable(document.getElementById('db-search').value);
            }
            
            // Reset form
            document.getElementById('custom-food-name').value = '';
            document.getElementById('custom-food-cat').value = '';
            document.getElementById('custom-food-harn').value = '';
            const btn = document.querySelector('#add-custom-food-form button');
            if(btn) btn.textContent = 'Speichern';

            alert('Eingabe erfolgreich! Die Datenbank wurde aktualisiert.');
        });
    }

    // --- TEMPLATE BUILDER (Settings) ---
    let currentTemplateItems = [];
    let editTemplateId = null;

    const renderTemplateBuilderList = () => {
        const list = document.getElementById('template-items-list');
        if (!list) return;
        list.innerHTML = '';
        if (currentTemplateItems.length === 0) {
            list.innerHTML = '<p class="text-muted text-center" style="font-size: 0.85em; margin: 0;">Noch keine Zutaten hinzugefügt.</p>';
            return;
        }
        currentTemplateItems.forEach((item, index) => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.background = 'rgba(59, 130, 246, 0.05)';
            div.style.padding = '8px';
            div.style.borderRadius = '6px';
            div.innerHTML = `
                <div>
                    <div style="font-weight:600; font-size:0.9em;">${item.name}</div>
                    <div style="font-size:0.8em; color:var(--text-muted);">${item.amount}g (${Math.round(item.harn_total)} mg Harnsäure)</div>
                </div>
                <button type="button" class="action-btn delete" onclick="removeTemplateItem(${index})"><i class="ph ph-trash"></i></button>
            `;
            list.appendChild(div);
        });
    };

    window.removeTemplateItem = (index) => {
        currentTemplateItems.splice(index, 1);
        renderTemplateBuilderList();
    };

    const templateFoodSearch = document.getElementById('template-food-search');
    const templateSuggestionsBox = document.getElementById('template-suggestions');
    const templateSelectedHarnsaeure = document.getElementById('template-selected-harnsaeure');
    const templateSelectedName = document.getElementById('template-selected-name');
    const templateFoodAmount = document.getElementById('template-food-amount');
    const btnAddTemplateItem = document.getElementById('btn-add-template-item');
    const templateBuilderForm = document.getElementById('template-builder-form');
    const btnCancelEditTemplate = document.getElementById('btn-cancel-edit-template');

    if (templateFoodSearch) {
        templateFoodSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            templateSuggestionsBox.innerHTML = '';
            
            if (query.length < 2) {
                templateSuggestionsBox.style.display = 'none';
                return;
            }

            const matches = purinData.filter(item => 
                item.name.toLowerCase().includes(query) || 
                item.category.toLowerCase().includes(query)
            ).slice(0, 8); 

            if (matches.length > 0) {
                templateSuggestionsBox.style.display = 'block';
                matches.forEach(match => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.innerHTML = `
                        <strong>${match.name}</strong> 
                        <span style="font-size: 0.8em; color: var(--text-muted);">(${match.harnsaeure_100g} mg/100g)</span>
                    `;
                    div.addEventListener('click', () => {
                        templateFoodSearch.value = match.name;
                        templateSelectedHarnsaeure.value = match.harnsaeure_100g;
                        templateSelectedName.value = match.name;
                        templateSuggestionsBox.style.display = 'none';
                        templateFoodAmount.focus();
                    });
                    templateSuggestionsBox.appendChild(div);
                });
            } else {
                templateSuggestionsBox.style.display = 'none';
            }
        });
    }

    if (btnAddTemplateItem) {
        btnAddTemplateItem.addEventListener('click', () => {
            const name = templateSelectedName.value || templateFoodSearch.value;
            const amount = parseInt(templateFoodAmount.value);
            const harn100 = parseInt(templateSelectedHarnsaeure.value);
            
            if (!name || isNaN(amount) || amount <= 0 || isNaN(harn100)) {
                alert("Bitte wähle eine Zutat aus der Liste und gib eine gültige Menge ein.");
                return;
            }
            
            const harn_total = (amount / 100) * harn100;
            currentTemplateItems.push({ name, amount, harn100, harn_total });
            
            templateFoodSearch.value = '';
            templateFoodAmount.value = '';
            templateSelectedName.value = '';
            templateSelectedHarnsaeure.value = '';
            
            renderTemplateBuilderList();
        });
    }

    if (templateBuilderForm) {
        templateBuilderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const templateName = document.getElementById('template-name').value.trim();
            if (currentTemplateItems.length === 0) {
                alert("Bitte füge mindestens eine Zutat hinzu.");
                return;
            }
            
            let totalAmount = 0;
            let totalHarn = 0;
            currentTemplateItems.forEach(item => {
                totalAmount += item.amount;
                totalHarn += item.harn_total;
            });
            
            let templates = JSON.parse(localStorage.getItem('gichtomat_templates')) || [];
            
            if (editTemplateId) {
                const idx = templates.findIndex(t => t.id === editTemplateId);
                if (idx > -1) {
                    templates[idx] = { id: editTemplateId, name: templateName, items: currentTemplateItems, totalAmount, totalHarn };
                }
            } else {
                templates.push({ id: Date.now().toString(), name: templateName, items: currentTemplateItems, totalAmount, totalHarn });
            }
            
            localStorage.setItem('gichtomat_templates', JSON.stringify(templates));
            
            // Reset builder
            document.getElementById('template-name').value = '';
            currentTemplateItems = [];
            editTemplateId = null;
            btnCancelEditTemplate.style.display = 'none';
            renderTemplateBuilderList();
            
            alert('Vorlage gespeichert!');
            
            renderHomeTemplateSelect();
            const dbFilterSelect = document.getElementById('db-filter');
            const dbSearchInput = document.getElementById('db-search');
            if(dbFilterSelect && dbFilterSelect.value === 'templates') {
                if(typeof renderDatabaseTable === 'function') renderDatabaseTable(dbSearchInput.value);
            }
        });
    }

    if (btnCancelEditTemplate) {
        btnCancelEditTemplate.addEventListener('click', () => {
            document.getElementById('template-name').value = '';
            currentTemplateItems = [];
            editTemplateId = null;
            btnCancelEditTemplate.style.display = 'none';
            renderTemplateBuilderList();
        });
    }

    window.editTemplate = (id) => {
        const templates = JSON.parse(localStorage.getItem('gichtomat_templates')) || [];
        const template = templates.find(t => t.id === String(id));
        if (template) {
            editTemplateId = template.id;
            document.getElementById('template-name').value = template.name;
            currentTemplateItems = [...template.items];
            renderTemplateBuilderList();
            btnCancelEditTemplate.style.display = 'inline-block';
            switchView('view-settings');
        }
    };

    window.deleteTemplate = (id) => {
        if(confirm("Vorlage wirklich löschen?")) {
            let templates = JSON.parse(localStorage.getItem('gichtomat_templates')) || [];
            templates = templates.filter(t => t.id !== String(id));
            localStorage.setItem('gichtomat_templates', JSON.stringify(templates));
            const dbSearchInput = document.getElementById('db-search');
            if(typeof renderDatabaseTable === 'function') renderDatabaseTable(dbSearchInput.value);
            renderHomeTemplateSelect();
        }
    };

    const renderHomeTemplateSelect = () => {
        const select = document.getElementById('home-template-select');
        if (!select) return;
        const templates = JSON.parse(localStorage.getItem('gichtomat_templates')) || [];
        select.innerHTML = '<option value="">Keine Vorlage (manuelle Eingabe)</option>';
        templates.sort((a, b) => a.name.localeCompare(b.name));
        templates.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.name} (${t.totalAmount}g, ${Math.round(t.totalHarn)}mg)`;
            select.appendChild(opt);
        });
    };

    // --- DARK MODE ---
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        if (localStorage.getItem('gichtomat_theme') === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggle.checked = true;
        }
        themeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('dark-theme');
                localStorage.setItem('gichtomat_theme', 'dark');
            } else {
                document.body.classList.remove('dark-theme');
                localStorage.setItem('gichtomat_theme', 'light');
            }
        });
    }

    // --- BACKUP & RESTORE ---
    const btnExport = document.getElementById('btn-export-backup');
    const btnImport = document.getElementById('btn-import-backup');
    
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const backupData = {
                log: localStorage.getItem('gichtomat_log'),
                customFoods: localStorage.getItem('gichtomat_custom_foods'),
                templates: localStorage.getItem('gichtomat_templates')
            };
            const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gichtomat_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    if (btnImport) {
        btnImport.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (data.log !== undefined && data.log !== null) localStorage.setItem('gichtomat_log', data.log);
                    if (data.customFoods !== undefined && data.customFoods !== null) localStorage.setItem('gichtomat_custom_foods', data.customFoods);
                    if (data.templates !== undefined && data.templates !== null) localStorage.setItem('gichtomat_templates', data.templates);
                    alert('Backup erfolgreich geladen! App wird neu gestartet.');
                    location.reload();
                } catch (err) {
                    alert('Fehler beim Laden des Backups. Ist die Datei gültig?');
                }
            };
            reader.readAsText(file);
        });
    }

    // Initialisierung
    updateTrafficLight();
    renderHomeTemplateSelect();
});


window.printSection = (mode) => {
    document.body.classList.add('printing');
    if (mode === 'stats') {
        document.body.classList.add('print-stats');
    } else if (mode === 'protocol') {
        document.body.classList.add('print-protocol');
    }
    setTimeout(() => {
        window.print();
        document.body.classList.remove('printing', 'print-stats', 'print-protocol');
    }, 200);
};

