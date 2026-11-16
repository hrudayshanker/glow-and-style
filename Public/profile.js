
const customerName = document.getElementById("customerName");
const customerEmail = document.getElementById("customerEmail");
const upcomingAppointments = document.getElementById("upcomingAppointments");
const pastAppointments = document.getElementById("pastAppointments");
const profileMessage = document.getElementById("profileMessage");
const logoutButton = document.getElementById("logoutButton");
let currentCustomerId = null;

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

function paymentMethodLabel(method) {
    return method === "pay_now" ? "Pay now" : "Pay at salon";
}

function paymentStatusLabel(status, method) {
    if (status === "Paid" || status === "Paid (Demo)") return "Paid";
    if (!status || status === "Due on arrival") return method === "pay_now" ? "Paid" : "Pay at salon";
    return status;
}

function displayAppointments(container, appointments, feedbackByAppointment) {
    if (appointments.length === 0) {
        container.innerHTML = "<p>No appointments to display.</p>";
        return;
    }

    const today = new Date().toLocaleDateString("en-CA");
    container.innerHTML = appointments.map(appointment => {
        const existingFeedback = feedbackByAppointment.get(String(appointment.id));
        const canLeaveFeedback = appointment.appointment_date < today && appointment.status !== "Cancelled";
        const ratingStars = existingFeedback
            ? `${"&#9733;".repeat(Number(existingFeedback.rating))}<span class="empty-stars">${"&#9733;".repeat(5 - Number(existingFeedback.rating))}</span>`
            : "";
        const feedbackSection = existingFeedback
            ? `<div class="appointment-feedback">
                    <p class="feedback-result-label">Your review</p>
                    <p class="feedback-stars" aria-label="${Number(existingFeedback.rating)} out of 5 stars">${ratingStars}<span class="feedback-score">${Number(existingFeedback.rating)}/5</span></p>
                    ${existingFeedback.comment ? `<p class="feedback-comment">${escapeHTML(existingFeedback.comment)}</p>` : ""}
                </div>`
            : canLeaveFeedback
                ? `<form class="feedback-form" data-appointment-id="${escapeHTML(appointment.id)}">
                    <fieldset class="feedback-rating">
                        <legend>How was your visit?</legend>
                        <div class="rating-options">
                            ${[1, 2, 3, 4, 5].map(value => `
                                <label class="rating-choice">
                                    <input type="radio" name="rating" value="${value}" required>
                                    <span class="rating-choice-face" aria-hidden="true">${value} <span class="rating-star">&#9733;</span></span>
                                    <span class="visually-hidden">${value} out of 5 stars</span>
                                </label>
                            `).join("")}
                        </div>
                    </fieldset>
                    <label class="feedback-comment-label" for="feedback-comment-${escapeHTML(appointment.id)}">Comment <span>(optional)</span></label>
                    <textarea id="feedback-comment-${escapeHTML(appointment.id)}" name="comment" maxlength="1000" rows="3" placeholder="Share a few words about your experience"></textarea>
                    <div class="feedback-form-footer">
                        <span class="feedback-helper">Your feedback helps us improve.</span>
                        <button class="primary-button feedback-submit" type="submit">Submit review</button>
                    </div>
                    <p class="feedback-message" role="status" aria-live="polite"></p>
                </form>`
                : "";

        return `
        <article class="service-card appointment-card">
            <h3>${escapeHTML(appointment.service)}</h3>
            <div class="appointment-details">
                <p><strong>Barber</strong><span>${escapeHTML(appointment.barber || "Not specified")}</span></p>
                <p><strong>Date</strong><span>${formatDate(appointment.appointment_date)}</span></p>
                <p><strong>Time</strong><span>${escapeHTML(appointment.appointment_time)}</span></p>
                <p><strong>Appointment status</strong><span>${escapeHTML(appointment.status)}</span></p>
                <p><strong>Payment method</strong><span>${escapeHTML(paymentMethodLabel(appointment.payment_method))}</span></p>
                <p><strong>Payment status</strong><span>${escapeHTML(paymentStatusLabel(appointment.payment_status, appointment.payment_method))}</span></p>
            </div>
            ${feedbackSection}
        </article>
    `;
    }).join("");

    container.querySelectorAll(".feedback-form").forEach(form => {
        form.addEventListener("submit", submitFeedback);
    });
}

async function submitFeedback(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const feedbackMessage = form.querySelector(".feedback-message");
    const rating = Number(new FormData(form).get("rating"));
    const comment = String(new FormData(form).get("comment") || "").trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        feedbackMessage.textContent = "Please select a rating from 1 to 5.";
        return;
    }

    submitButton.disabled = true;
    feedbackMessage.textContent = "Saving your feedback...";

    const { error } = await supabaseClient
        .from("customer_feedback")
        .insert({
            appointment_id: Number(form.dataset.appointmentId),
            customer_id: currentCustomerId,
            rating,
            comment: comment || null
        });

    if (error) {
        feedbackMessage.textContent = error.code === "23505"
            ? "Feedback has already been sent for this appointment."
            : "Unable to save feedback. Please try again.";
        submitButton.disabled = false;
        return;
    }

    await loadCustomerProfile();
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
        currentCustomerId = user.id;

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
                .select("id, service, barber, appointment_date, appointment_time, status, payment_method, payment_status")
                .eq("customer_id", user.id)
                .order("appointment_date", { ascending: true })
                .order("appointment_time", { ascending: true });

        if (appointmentError) throw appointmentError;

        const { data: feedback, error: feedbackError } = await supabaseClient
            .from("customer_feedback")
            .select("appointment_id, rating, comment")
            .eq("customer_id", user.id);

        const feedbackByAppointment = new Map();
        if (feedbackError) {
            profileMessage.textContent = "Feedback is not set up yet. Appointments are still available below.";
        } else {
            for (const item of feedback || []) {
                feedbackByAppointment.set(String(item.appointment_id), item);
            }
        }

        const today = new Date().toLocaleDateString("en-CA");

        const upcoming = appointments.filter(appointment =>
            appointment.appointment_date >= today &&
            ["Pending", "Confirmed"].includes(appointment.status)
        );

        const past = appointments.filter(appointment =>
            !upcoming.includes(appointment)
        );

        displayAppointments(upcomingAppointments, upcoming, feedbackByAppointment);
        displayAppointments(pastAppointments, past, feedbackByAppointment);

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
