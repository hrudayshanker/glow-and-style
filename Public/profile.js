
const customerName = document.getElementById("customerName");
const customerEmail = document.getElementById("customerEmail");
const upcomingAppointments = document.getElementById("upcomingAppointments");
const pastAppointments = document.getElementById("pastAppointments");
const profileMessage = document.getElementById("profileMessage");
const logoutButton = document.getElementById("logoutButton");

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function formatDate(date) {
    if (!date) return "-";

    return new Date(date + "T00:00:00").toLocaleDateString("en-GB");
}

function displayAppointments(container, appointments) {
    if (appointments.length === 0) {
        container.innerHTML = "<p>No appointments to display.</p>";
        return;
    }

    container.innerHTML = appointments.map(appointment => `
        <article class="service-card" style="margin-bottom: 15px;">
            <h3>${escapeHTML(appointment.service)}</h3>
            <p><strong>Date:</strong> ${formatDate(appointment.appointment_date)}</p>
            <p><strong>Time:</strong> ${escapeHTML(appointment.appointment_time)}</p>
            <p><strong>Status:</strong> ${escapeHTML(appointment.status)}</p>
        </article>
    `).join("");
}

async function loadCustomerProfile() {
    try {
        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;

        if (!user) {
            window.location.href = "/login.html";
            return;
        }

        // Load customer profile
        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("full_name, email")
                .eq("id", user.id)
                .single();

        if (profileError) throw profileError;

        customerName.textContent =
            profile.full_name || user.user_metadata?.full_name || "Customer";

        customerEmail.textContent = profile.email || user.email || "";

        // Load customer's appointments
        const { data: appointments, error: appointmentError } =
            await supabaseClient
                .from("appointments")
                .select("id, service, appointment_date, appointment_time, status")
                .eq("customer_id", user.id)
                .order("appointment_date", { ascending: true })
                .order("appointment_time", { ascending: true });

        if (appointmentError) throw appointmentError;

        const today = new Date().toLocaleDateString("en-CA");

        const upcoming = appointments.filter(appointment =>
            appointment.appointment_date >= today &&
            ["Pending", "Confirmed"].includes(appointment.status)
        );

        const past = appointments.filter(appointment =>
            !upcoming.includes(appointment)
        );

        displayAppointments(upcomingAppointments, upcoming);
        displayAppointments(pastAppointments, past);

    } catch (error) {
        console.error("Profile loading error:", error);
        profileMessage.textContent =
            "Unable to load your profile. Please refresh the page.";
    }
}

// Customer logout
logoutButton.addEventListener("click", async function () {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        profileMessage.textContent = error.message;
        return;
    }

    window.location.href = "/login.html";
});

loadCustomerProfile();