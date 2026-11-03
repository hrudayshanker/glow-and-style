import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://jxohllhrhyolipamnyqf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6cfdZNQ2k2H_GBUeuT1QYA_ZjuPyixR';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;

// ==========================================
// EXPOSE ALL FUNCTIONS GLOBALLY FOR HTML UI
// ==========================================
window.toggleAuthMode = toggleAuthMode;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleLogout = handleLogout;
window.switchTab = switchTab;
window.filterSchedule = filterSchedule;
window.openWalkInModal = openWalkInModal;
window.closeWalkInModal = closeWalkInModal;
window.toggleWalkInMode = toggleWalkInMode;
window.checkExistingPhone = checkExistingPhone;
window.handleWalkInSubmit = handleWalkInSubmit;
window.openBreakModal = openBreakModal;
window.closeBreakModal = closeBreakModal;
window.handleBreakSubmit = handleBreakSubmit;
window.openCustomerModal = openCustomerModal;
window.closeCustomerModal = closeCustomerModal;
window.filterCustomerDirectory = filterCustomerDirectory;
window.addCustomerNote = addCustomerNote;
window.saveProfileSettings = saveProfileSettings;
window.toggleStatus = toggleStatus;
window.cancelBreak = cancelBreak;

// Initialize state variables
let shopCustomers = [
    {
        id: 101,
        customerName: "Marcus Vance",
        phone: "+49 170 9876543",
        totalVisits: 8,
        preferredBarber: "Alex Morgan",
        notes: ["Prefers textured crop on top", "Sensitive skin around neckline"],
        pastVisits: [
            { date: "10 Sep", service: "Fade Cut", barber: "Alex Morgan" },
            { date: "22 Aug", service: "Beard Trim", barber: "David" }
        ]
    },
    {
        id: 102,
        customerName: "Julian Schmidt",
        phone: "+49 172 1122334",
        totalVisits: 3,
        preferredBarber: "Alex Morgan",
        notes: ["Always uses matte styling clay"],
        pastVisits: [
            { date: "01 Sep", service: "Hair Cut", barber: "Alex Morgan" }
        ]
    }
];

let appointmentsData = [
    { id: 1, time: "10:00 AM", originalTime: "10:00 AM", type: "Appointment", customerId: 101, customerName: "Marcus Vance", phone: "+49 170 9876543", service: "Classic Haircut (€25)", price: 25, status: "Upcoming" },
    { id: 2, time: "11:30 AM", originalTime: "11:30 AM", type: "Appointment", customerId: 102, customerName: "Julian Schmidt", phone: "+49 172 1122334", service: "Full Grooming (€40)", price: 40, status: "Upcoming" }
];

let currentFilter = 'All';
let activeModalCustomerId = null;
let currentBarber = null;

// TIME & SERVICE DURATION HELPER FUNCTIONS
function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 600; // default 10:00 AM
    const cleanStr = timeStr.replace(/\(.*\)/g, '').trim();
    const parts = cleanStr.split(' ');
    if (parts.length < 2) return 600;
    
    let [hours, minutes] = parts[0].split(':').map(Number);
    const modifier = parts[1].toUpperCase();

    if (hours === 12) hours = 0;
    if (modifier === 'PM') hours += 12;

    return (hours * 60) + (minutes || 0);
}

function formatMinutesToTime(totalMinutes) {
    let hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const modifier = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    if (hours === 0) hours = 12;

    const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;

    return `${formattedHours}:${formattedMinutes} ${modifier}`;
}

function getServiceDuration(serviceStr) {
    if (!serviceStr) return 30;
    const lower = serviceStr.toLowerCase();
    if (lower.includes('full grooming') || lower.includes('package')) return 45;
    if (lower.includes('haircut') || lower.includes('hair cut')) return 30;
    if (lower.includes('beard')) return 20;
    return 30; // default fallback duration
}

// UI TOGGLE BETWEEN LOGIN & SIGNUP
function toggleAuthMode(mode) {
    if(mode === 'signup') {
        document.getElementById('login-form-box').style.display = 'none';
        document.getElementById('signup-form-box').style.display = 'block';
        document.getElementById('auth-subtitle').innerText = 'Create a New Barber Account';
    } else {
        document.getElementById('signup-form-box').style.display = 'none';
        document.getElementById('login-form-box').style.display = 'block';
        document.getElementById('auth-subtitle').innerText = 'Barber Staff Portal Login';
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const role = document.getElementById('signup-role').value.trim();
    const password = document.getElementById('signup-password').value;

    if (!name || !role || !password) {
        alert('Please fill out all fields.');
        return;
    }

    const { data: existing } = await supabaseClient
        .from('barbers')
        .select('*')
        .ilike('name', name)
        .maybeSingle();

    if (existing) {
        alert('A barber with this name already exists! Please log in instead.');
        toggleAuthMode('login');
        document.getElementById('login-username').value = name;
        return;
    }

    const { data: newBarber, error: dbError } = await supabaseClient
        .from('barbers')
        .insert([{ 
            name: name, 
            role: role, 
            email: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@barberportal.com`,
            password: password 
        }])
        .select()
        .single();

    if (dbError) {
        console.error('Signup error:', dbError);
        alert('Error creating account: ' + dbError.message);
        return;
    }

    alert('Account created successfully! You can now log in.');
    toggleAuthMode('login');
    document.getElementById('login-username').value = name;
    document.getElementById('signup-form-box').reset();
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const passwordInput = document.getElementById('login-password').value;

    if (!username || !passwordInput) {
        alert('Please enter both your name and password.');
        return;
    }

    const { data: barberData, error: dbError } = await supabaseClient
        .from('barbers')
        .select('*')
        .ilike('name', username)
        .maybeSingle();

    if (dbError || !barberData) {
        alert('Barber not found! Please check your name or sign up first.');
        return;
    }

    if (barberData.password !== passwordInput) {
        alert('Incorrect password! Please try again.');
        return;
    }

    currentBarber = barberData;
    loadDashboardSession();
}

function loadDashboardSession() {
    if (!currentBarber) return;

    const nameElement = document.getElementById('current-barber-name');
    const roleElement = document.getElementById('current-barber-role');
    const welcomeElement = document.getElementById('welcome-heading');

    if (nameElement) nameElement.innerText = currentBarber.name;
    if (roleElement) roleElement.innerText = currentBarber.role || 'Stylist';
    if (welcomeElement) welcomeElement.innerText = `Welcome back, ${currentBarber.name.split(' ')[0]}! 👋`;

    const settingName = document.getElementById('setting-name');
    const settingRole = document.getElementById('setting-role');
    if (settingName) settingName.value = currentBarber.name;
    if (settingRole) settingRole.value = currentBarber.role || 'Stylist';

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-wrapper').style.display = 'flex';
    
    if (typeof initDashboard === 'function') {
        initDashboard();
    }
}

function handleLogout() {
    if (window.supabaseClient && window.supabaseClient.auth) {
        supabaseClient.auth.signOut();
    }
    currentBarber = null;
    document.getElementById('app-wrapper').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    
    const loginPass = document.getElementById('login-password');
    if (loginPass) loginPass.value = '';
    
    toggleAuthMode('login');
}

function switchTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));

    document.getElementById(`tab-${tabId}`).classList.add('active');
    if(el) el.classList.add('active');

    if(tabId === 'customers') renderCustomerDirectory();
    if(tabId === 'performance') renderPerformanceReviews();
}

function initDashboard() {
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', { 
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
    });
    renderAppointments();
    populateRegularCustomerDropdown();
}

function updateDashboardStats() {
    document.getElementById('total-bookings-count').innerText = appointmentsData.filter(a => a.type !== 'Break').length;
    const completed = appointmentsData.filter(a => a.status === "Completed");
    document.getElementById('completed-count').innerText = completed.length;

    const totalRevenue = completed.reduce((sum, item) => sum + (item.price || 0), 0);
    const commission = totalRevenue * 0.60;
    document.getElementById('commission-display').innerText = `€${commission.toFixed(2)}`;
}

function filterSchedule(type, btn) {
    currentFilter = type;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderAppointments();
}

function renderAppointments() {
    const tableBody = document.getElementById('appointment-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    let filtered = appointmentsData;
    if(currentFilter !== 'All') {
        filtered = appointmentsData.filter(a => a.type === currentFilter);
    }

    filtered.forEach(item => {
        const row = document.createElement('tr');
        const isBreak = item.type === "Break";
        
        let actionCell = '';
        if (isBreak) {
            actionCell = `<button class="action-btn" style="background:#fee2e2; color:#dc2626;" onclick="cancelBreak(${item.id})">End Break</button>`;
        } else {
            actionCell = `<button class="action-btn" onclick="toggleStatus(${item.id})">${item.status === 'Upcoming' ? 'Mark Done' : 'Undo'}</button>`;
        }

        row.innerHTML = `
            <td><strong>${item.time}</strong> <br><small style="color:var(--text-muted);">${item.type}</small></td>
            <td>${isBreak ? '<em>-</em>' : `<a href="#" class="customer-link" onclick="openCustomerModal(${item.customerId})">${item.customerName}</a>`}</td>
            <td>${item.service}</td>
            <td><span class="status-badge ${item.status.toLowerCase()}">${item.status}</span></td>
            <td>${actionCell}</td>
        `;
        tableBody.appendChild(row);
    });
    updateDashboardStats();
}

// UNIFIED SCHEDULE RECALCULATION ENGINE (Dynamic Service-Based Durations & Overlap Checks)
function recalculateScheduleShifts() {
    // 1. Calculate total cumulative minutes contributed by all active (uncompleted) Walk-Ins
    let totalWalkInMinutes = 0;
    appointmentsData.forEach(item => {
        if (item.type === "Walk-In" && item.status !== "Completed") {
            totalWalkInMinutes += getServiceDuration(item.service);
        }
    });

    // 2. Recalculate appointment times based on original baseline time + cumulative walk-in minutes
    appointmentsData.forEach(item => {
        if (item.type === "Appointment" && item.status !== "Completed") {
            const originalBaseTime = item.originalTime || item.time;
            
            if (totalWalkInMinutes > 0) {
                item.status = "Pushed";
                const baseMinutes = parseTimeToMinutes(originalBaseTime);
                item.time = formatMinutesToTime(baseMinutes + totalWalkInMinutes);
            } else {
                item.status = "Upcoming";
                item.time = originalBaseTime;
            }
        }
    });

    // 3. Resolve Break Collisions (Supports multi-appointment overlaps across the entire break duration window)
    const activeBreaks = appointmentsData.filter(a => a.type === "Break");

    activeBreaks.forEach(breakItem => {
        const breakRange = breakItem.time.split(' - ');
        if (breakRange.length === 2) {
            const breakStartMin = parseTimeToMinutes(breakRange[0]);
            const breakEndMin = parseTimeToMinutes(breakRange[1]);

            let postBreakOffsetMin = breakEndMin;

            appointmentsData.forEach(item => {
                if (item.type === "Appointment" && item.status !== "Completed") {
                    const apptMin = parseTimeToMinutes(item.time);

                    // If an appointment falls inside or overlaps the break window range
                    if (apptMin >= breakStartMin && apptMin < breakEndMin) {
                        item.status = "Rescheduled";
                        item.time = formatMinutesToTime(postBreakOffsetMin);
                        postBreakOffsetMin += 45; // Stagger multi-appointment clashes cleanly by 45 mins
                    }
                }
            });
        }
    });
}

function toggleStatus(id) {
    const appt = appointmentsData.find(a => a.id === id);
    if(!appt) return;

    appt.status = appt.status === "Upcoming" ? "Completed" : "Upcoming";

    // Recalculate schedule cleanly based on active states
    recalculateScheduleShifts();
    renderAppointments();
}

function cancelBreak(id) {
    appointmentsData = appointmentsData.filter(a => a.id !== id);
    recalculateScheduleShifts();
    alert("Break ended early. Schedule recalculated.");
    renderAppointments();
}

// ==========================================
// WALK-IN MODAL LOGIC
// ==========================================
function openWalkInModal() { 
    document.getElementById('walkin-modal').style.display = 'flex'; 
    populateRegularCustomerDropdown();
}

function closeWalkInModal() { 
    document.getElementById('walkin-modal').style.display = 'none'; 
}

function toggleWalkInMode() {
    const mode = document.getElementById('walkin-type-selector').value;
    if(mode === 'regular') {
        document.getElementById('regular-customer-group').style.display = 'block';
        document.getElementById('new-customer-fields').style.display = 'none';
    } else {
        document.getElementById('regular-customer-group').style.display = 'none';
        document.getElementById('new-customer-fields').style.display = 'block';
    }
}

function populateRegularCustomerDropdown() {
    const select = document.getElementById('existing-customer-select');
    if (!select) return;
    select.innerHTML = '';
    shopCustomers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = `${c.customerName} (${c.phone})`;
        select.appendChild(opt);
    });
}

function checkExistingPhone(phone) {
    const found = shopCustomers.find(c => c.phone.trim() === phone.trim());
    if(found) {
        alert(`Match Found! Linked to existing shop customer: ${found.customerName} (${found.totalVisits} past visits).`);
        document.getElementById('walkin-name').value = found.customerName;
        document.getElementById('walkin-name').disabled = true;
    } else {
        document.getElementById('walkin-name').disabled = false;
    }
}

async function handleWalkInSubmit(e) {
    e.preventDefault();
    const mode = document.getElementById('walkin-type-selector').value;
    let custId, custName, custPhone, customerObj;

    if(mode === 'regular') {
        custId = parseInt(document.getElementById('existing-customer-select').value);
        customerObj = shopCustomers.find(c => c.id === custId);
        custName = customerObj.customerName;
        custPhone = customerObj.phone;
    } else {
        custName = document.getElementById('walkin-name').value;
        custPhone = document.getElementById('walkin-phone').value;
        customerObj = shopCustomers.find(c => c.phone.trim() === custPhone.trim());
        
        if(!customerObj) {
            custId = Date.now();
            customerObj = {
                id: custId,
                customerName: custName,
                phone: custPhone,
                totalVisits: 1,
                preferredBarber: currentBarber ? currentBarber.name : 'Staff',
                notes: ["Walk-in entry"],
                pastVisits: []
            };
            shopCustomers.push(customerObj);
        } else {
            custId = customerObj.id;
        }
    }

    const serviceStr = document.getElementById('walkin-service').value;
    const price = serviceStr.includes('40') ? 40 : (serviceStr.includes('25') ? 25 : 15);

    customerObj.totalVisits += 1;
    customerObj.pastVisits.unshift({ date: "Today", service: serviceStr, barber: currentBarber ? currentBarber.name : 'Staff' });

    let barberId = currentBarber ? currentBarber.id : null;

    if (barberId) {
        await supabaseClient
            .from('appointments')
            .insert([{
                barber_id: barberId,
                customer_name: custName,
                service_name: `${serviceStr} (Walk-In)`,
                appointment_time: new Date().toISOString(),
                status: 'upcoming',
                notes: `Phone: ${custPhone} | Price: €${price}`
            }]);
    }

    const newWalkIn = {
        id: Date.now(),
        time: "Now (Walk-In)",
        originalTime: "Now (Walk-In)",
        type: "Walk-In",
        customerId: custId,
        customerName: custName,
        phone: custPhone,
        service: serviceStr,
        price: price,
        status: "Upcoming"
    };

    appointmentsData.unshift(newWalkIn);
    recalculateScheduleShifts();
    renderAppointments();
    closeWalkInModal();
    document.getElementById('walkin-form').reset();
    populateRegularCustomerDropdown();
}

// ==========================================
// BREAK MODAL LOGIC
// ==========================================
function openBreakModal() { 
    document.getElementById('break-modal').style.display = 'flex'; 
}

function closeBreakModal() { 
    document.getElementById('break-modal').style.display = 'none'; 
}

async function handleBreakSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('break-title').value;
    const startTime = document.getElementById('break-start-time').value;
    const endTime = document.getElementById('break-end-time').value;

    const timeRange = `${startTime} - ${endTime}`;
    let barberId = currentBarber ? currentBarber.id : null;

    if (barberId) {
        await supabaseClient
            .from('appointments')
            .insert([{
                barber_id: barberId,
                customer_name: 'BREAK',
                service_name: title,
                appointment_time: new Date().toISOString(),
                status: 'break',
                notes: timeRange
            }]);
    }

    const breakItem = {
        id: Date.now(),
        time: timeRange,
        originalTime: timeRange,
        type: "Break",
        customerId: null,
        customerName: "",
        phone: "",
        service: title,
        price: 0,
        status: "Break"
    };

    appointmentsData.push(breakItem);
    recalculateScheduleShifts();
    renderAppointments();
    closeBreakModal();
    const breakForm = document.getElementById('break-form');
    if (breakForm) breakForm.reset();
}

// ==========================================
// CUSTOMER & SETTINGS LOGIC
// ==========================================
function renderCustomerDirectory() {
    const tbody = document.getElementById('customer-directory-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    shopCustomers.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.customerName}</strong></td>
            <td>${c.phone}</td>
            <td>${c.totalVisits}</td>
            <td>${c.preferredBarber}</td>
            <td><button class="action-btn" onclick="openCustomerModal(${c.id})">View History</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function filterCustomerDirectory() {
    const query = document.getElementById('customer-search-input').value.toLowerCase();
    const tbody = document.getElementById('customer-directory-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    shopCustomers.filter(c => c.customerName.toLowerCase().includes(query) || c.phone.includes(query)).forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.customerName}</strong></td>
            <td>${c.phone}</td>
            <td>${c.totalVisits}</td>
            <td>${c.preferredBarber}</td>
            <td><button class="action-btn" onclick="openCustomerModal(${c.id})">View History</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function openCustomerModal(custId) {
    activeModalCustomerId = custId;
    const customer = shopCustomers.find(c => c.id === custId);
    if (!customer) return;

    document.getElementById('modal-customer-name').innerText = customer.customerName;
    document.getElementById('modal-customer-phone').innerHTML = `<i class="fa-solid fa-phone"></i> ${customer.phone}`;
    document.getElementById('modal-total-visits').innerText = customer.totalVisits;
    document.getElementById('modal-fav-barber').innerText = customer.preferredBarber;

    renderNotes(customer.notes);

    const historyList = document.getElementById('modal-history-list');
    historyList.innerHTML = '';
    customer.pastVisits.forEach(visit => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${visit.date} - ${visit.service}</span> (Barber: ${visit.barber})`;
        historyList.appendChild(li);
    });

    document.getElementById('customer-modal').style.display = 'flex';
}

function renderNotes(notesArray) {
    const container = document.getElementById('notes-container');
    if (!container) return;
    container.innerHTML = '';
    if(!notesArray || notesArray.length === 0) {
        container.innerHTML = '<p style="font-size:0.85rem; color:var(--text-muted);">No notes recorded yet.</p>';
        return;
    }
    notesArray.forEach(note => {
        const div = document.createElement('div');
        div.className = 'note-item';
        div.innerText = `• ${note}`;
        container.appendChild(div);
    });
}

function addCustomerNote() {
    const input = document.getElementById('new-note-input');
    const val = input.value.trim();
    if(val && activeModalCustomerId) {
        const customer = shopCustomers.find(c => c.id === activeModalCustomerId);
        if(customer) {
            customer.notes.push(val);
            renderNotes(customer.notes);
            input.value = '';
        }
    }
}

function closeCustomerModal() { 
    document.getElementById('customer-modal').style.display = 'none'; 
}

function renderPerformanceReviews() {
    const container = document.getElementById('reviews-container');
    if (!container) return;
    container.innerHTML = `
        <div class="review-card">
            <div class="review-header"><span>Marcus Vance</span> <span class="review-stars">★★★★★</span></div>
            <p style="font-size:0.85rem; color:var(--text-muted);">"Alex always knows exactly how I like my fade. Best barber in Glow & Style!"</p>
        </div>
        <div class="review-card">
            <div class="review-header"><span>Julian Schmidt</span> <span class="review-stars">★★★★★</span></div>
            <p style="font-size:0.85rem; color:var(--text-muted);">"Great attention to detail and very professional service."</p>
        </div>
    `;
}

async function saveProfileSettings(e) {
    e.preventDefault();
    const name = document.getElementById('setting-name').value;
    const role = document.getElementById('setting-role').value;
    const newPassword = document.getElementById('setting-password').value;

    let updatePayload = { name: name, role: role };
    if(newPassword.trim() !== '') {
        updatePayload.password = newPassword;
    }

    const { error } = await supabaseClient
        .from('barbers')
        .update(updatePayload)
        .eq('id', currentBarber.id);

    if (error) {
        alert('Failed to update settings: ' + error.message);
        return;
    }

    currentBarber.name = name;
    currentBarber.role = role;
    document.getElementById('current-barber-name').innerText = name;
    document.getElementById('current-barber-role').innerText = role;
    document.getElementById('welcome-heading').innerText = `Welcome back, ${name.split(' ')[0]}! 👋`;
    
    alert('Profile settings updated successfully in Supabase!');
    document.getElementById('setting-password').value = '';
}