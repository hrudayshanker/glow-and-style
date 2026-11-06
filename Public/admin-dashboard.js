const pageMessage = document.getElementById("pageMessage");

let currentAppointments = [];
let currentProfiles = [];
let currentServices = [];

function showMessage(message) {
    pageMessage.textContent = message;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Check administrator access
async function checkAdminAccess() {

    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
        window.location.replace("/admin-login.html");
        return false;
    }

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", data.session.user.id)
            .single();

    if (profileError || !profile || profile.role !== "admin") {
        await supabaseClient.auth.signOut();
        window.location.replace("/admin-login.html");
        return false;
    }

    return true;
}

// Load customers
async function loadCustomers() {

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("id, full_name, email, role, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    currentProfiles = data || [];

    document.getElementById("totalCustomers").textContent =
        currentProfiles.filter(p => p.role === "customer").length;

    document.getElementById("allCustomers").innerHTML = `
        <table>
            <tr>
               <th>Name</th>
<th>Email</th>
<th>Role</th>
<th>Joined</th>
            </tr>

            ${currentProfiles.map(customer => `
                <tr>
                    <td>${escapeHTML(customer.full_name || "Not provided")}</td>
<td>${escapeHTML(customer.email || "Not provided")}</td>
<td>${escapeHTML(customer.role)}</td>
                    <td>${customer.created_at
                        ? new Date(customer.created_at).toLocaleDateString()
                        : "-"}</td>
                </tr>
            `).join("")}
        </table>
    `;
}

// Load appointments
async function loadAppointments() {

    const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: true });

    if (error) {
        throw error;
    }

    currentAppointments = data || [];

    document.getElementById("totalAppointments").textContent =
        currentAppointments.length;

    document.getElementById("pendingAppointments").textContent =
        currentAppointments.filter(a => a.status === "Pending").length;

    renderAppointments("recentAppointments", currentAppointments.slice(0, 5));
    renderAppointments("allAppointments", currentAppointments);
}

function renderAppointments(elementId, appointments) {

    const container = document.getElementById(elementId);

    if (!appointments.length) {
        container.textContent = "No appointments found.";
        return;
    }

    const rows = appointments.map(appointment => {

        const customer = currentProfiles.find(
            profile => profile.id === appointment.customer_id
        );

        return `
            <tr>
                <td>${escapeHTML(customer?.full_name || "Customer")}</td>
                <td>${escapeHTML(appointment.service)}</td>
                <td>${escapeHTML(appointment.appointment_date)}</td>
                <td>${escapeHTML(appointment.appointment_time)}</td>
                <td>${escapeHTML(appointment.status)}</td>
                <td>
                    ${appointment.status === "Pending" ? `
                        <button class="action-button confirm"
                            onclick="updateAppointment(${appointment.id}, 'Confirmed')">
                            Confirm
                        </button>
                    ` : ""}

                    ${appointment.status !== "Cancelled" &&
                      appointment.status !== "Completed" ? `
                        <button class="action-button cancel"
                            onclick="updateAppointment(${appointment.id}, 'Cancelled')">
                            Cancel
                        </button>
                    ` : ""}
                </td>
            </tr>
        `;
    }).join("");

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

// Update appointment status
async function updateAppointment(id, newStatus) {

    const appointment = currentAppointments.find(a => a.id === id);

    if (!appointment) return;

    const confirmed = window.confirm(
        `Change appointment status to ${newStatus}?`
    );

    if (!confirmed) return;

    const { error } = await supabaseClient
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", id);

    if (error) {
        showMessage("Unable to update appointment: " + error.message);
        return;
    }

    showMessage("Appointment updated successfully!");

    await loadAppointments();
}

// Load services
// Load appointment history
async function loadAppointmentHistory() {

    const { data, error } = await supabaseClient
        .from("appointment_history")
        .select("id, appointment_id, old_status, new_status, changed_by, changed_at")
        .order("changed_at", { ascending: false });

    if (error) {
        throw error;
    }

    const history = data || [];

    if (history.length === 0) {
        document.getElementById("appointmentHistory").innerHTML =
            "<p>No appointment history available yet.</p>";
        return;
    }

    document.getElementById("appointmentHistory").innerHTML = `
        <table>
            <tr>
                <th>Appointment ID</th>
                <th>Previous Status</th>
                <th>New Status</th>
                <th>Changed By</th>
                <th>Date & Time</th>
            </tr>

            ${history.map(record => {

                const admin = currentProfiles.find(
                    profile => profile.id === record.changed_by
                );

                return `
                    <tr>
                        <td>${record.appointment_id}</td>
                        <td>${escapeHTML(record.old_status || "-")}</td>
                        <td>${escapeHTML(record.new_status)}</td>
                        <td>${escapeHTML(admin?.full_name || "Administrator")}</td>
                        <td>${record.changed_at
                            ? new Date(record.changed_at).toLocaleString()
                            : "-"}</td>
                    </tr>
                `;

            }).join("")}
        </table>
    `;
}
async function loadServices() {

    const { data, error } = await supabaseClient
        .from("services")
        .select("*")
        .order("name");

    if (error) {
        throw error;
    }

    currentServices = data || [];

    document.getElementById("allServices").innerHTML = `
        <table>
            <tr>
                <th>Service</th>
                <th>Description</th>
                <th>Price</th>
                <th>Duration</th>
                <th>Availability</th>
            </tr>

            ${currentServices.map(service => `
                <tr>
                    <td>${escapeHTML(service.name)}</td>
                    <td>${escapeHTML(service.description || "-")}</td>
                    <td>€${Number(service.price).toFixed(2)}</td>
                    <td>${escapeHTML(service.duration_minutes)} min</td>
                    <td>${service.is_active ? "Active" : "Inactive"}</td>
                </tr>
            `).join("")}
        </table>
    `;
}

// Navigation
document.querySelectorAll(".sidebar button[data-page]").forEach(button => {

    button.addEventListener("click", () => {

        document.querySelectorAll(".sidebar button").forEach(btn =>
            btn.classList.remove("active")
        );

        button.classList.add("active");

        const page = button.dataset.page;

        document.querySelectorAll("main > div[id$='Page']").forEach(section =>
            section.classList.add("hidden")
        );

        document.getElementById(page + "Page").classList.remove("hidden");

        document.getElementById("pageTitle").textContent =
            button.textContent;

        if (page === "appointments") loadAppointments().catch(error => showMessage(error.message));
        if (page === "customers") loadCustomers().catch(error => showMessage(error.message));
        if (page === "services") loadServices().catch(error => showMessage(error.message));
        if (page === "history") loadAppointmentHistory().catch(error => showMessage(error.message));

    });

});

// Logout
document.getElementById("logoutButton").addEventListener("click", async () => {

    await supabaseClient.auth.signOut();

    window.location.replace("/admin-login.html");

});

// Start dashboard
async function startDashboard() {

    const authorised = await checkAdminAccess();

    if (!authorised) return;

    try {

        await loadCustomers();
        await loadAppointments();

    } catch (error) {

        showMessage("Dashboard loading error: " + error.message);

    }
}

startDashboard();