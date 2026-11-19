
const customerName = document.getElementById("customerName");
const customerEmail = document.getElementById("customerEmail");
const upcomingAppointments = document.getElementById("upcomingAppointments");
const pastAppointments = document.getElementById("pastAppointments");
const profileMessage = document.getElementById("profileMessage");
const logoutButton = document.getElementById("logoutButton");
const loyaltyBalance = document.getElementById("loyaltyBalance");
const loyaltyVisitCount = document.getElementById("loyaltyVisitCount");
const loyaltyProgress = document.getElementById("loyaltyProgress");
const loyaltyProgressText = document.getElementById("loyaltyProgressText");
const loyaltyMessage = document.getElementById("loyaltyMessage");
const loyaltyVouchers = document.getElementById("loyaltyVouchers");
const redeemLoyaltyVoucherButton = document.getElementById("redeemLoyaltyVoucher");
let currentCustomerId = null;
let currentAppointments = [];
let historyAppointments = [];
let currentFeedbackByAppointment = new Map();
let historyFilter = "all";

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

function displayAppointmentTime(value) {
    const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return String(value ?? "");
    const hour24 = Number(match[1]);
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    return `${String(hour12).padStart(2, "0")}:${match[2]} ${suffix}`;
}

const appointmentTimes = [
    "10:00 AM", "11:00 AM", "12:30 PM", "01:00 PM",
    "02:00 PM", "03:00 PM", "04:00 PM"
];

function appointmentStart(appointment) {
    const value = String(appointment.appointment_time || "").trim();
    const twelveHour = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    const twentyFourHour = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!twelveHour && !twentyFourHour) return new Date(`${appointment.appointment_date}T00:00:00`);

    let hour = Number((twelveHour || twentyFourHour)[1]);
    const minute = (twelveHour || twentyFourHour)[2];
    if (twelveHour) {
        hour %= 12;
        if (twelveHour[3].toUpperCase() === "PM") hour += 12;
    }
    return new Date(`${appointment.appointment_date}T${String(hour).padStart(2, "0")}:${minute}:00`);
}

function isChangeWindowOpen(appointment) {
    return appointmentStart(appointment).getTime() - Date.now() >= 2 * 60 * 60 * 1000;
}

function isFutureAppointment(appointment) {
    return appointmentStart(appointment).getTime() > Date.now();
}

function localDateISO(date = new Date()) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

async function loadLoyaltyRewards(customerId) {
    const [ledgerResult, voucherResult] = await Promise.all([
        supabaseClient
            .from("loyalty_ledger")
            .select("points, entry_type, created_at")
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false }),
        supabaseClient
            .from("loyalty_vouchers")
            .select("code, status, points_cost, created_at, redeemed_at")
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false })
    ]);

    if (ledgerResult.error || voucherResult.error) {
        console.error("Loyalty rewards load error:", ledgerResult.error || voucherResult.error);
        loyaltyBalance.textContent = "—";
        loyaltyVisitCount.textContent = "—";
        loyaltyProgressText.textContent = "Rewards are not available yet.";
        loyaltyMessage.textContent = "Ask the salon administrator to finish setting up Glow Rewards.";
        redeemLoyaltyVoucherButton.disabled = true;
        loyaltyVouchers.replaceChildren();
        return;
    }

    const ledger = ledgerResult.data || [];
    const vouchers = voucherResult.data || [];
    const points = ledger.reduce((total, entry) => total + Number(entry.points || 0), 0);
    const completedVisits = ledger.filter(entry => entry.entry_type === "visit_earned").length;
    const pointsToNextReward = points % 50;
    const progressPoints = points >= 50 ? (pointsToNextReward || 50) : points;

    loyaltyBalance.textContent = String(points);
    loyaltyVisitCount.textContent = String(completedVisits);
    loyaltyProgress.value = progressPoints;
    loyaltyProgressText.textContent = points >= 50
        ? "You have enough points for a €5 voucher."
        : `${50 - points} more point${50 - points === 1 ? "" : "s"} to your next €5 voucher.`;
    redeemLoyaltyVoucherButton.disabled = points < 50;
    redeemLoyaltyVoucherButton.textContent = points >= 50
        ? "Redeem a €5 voucher (50 points)"
        : `Redeem at 50 points (${points}/50)`;

    const activeVouchers = vouchers.filter(voucher => voucher.status === "Available");
    if (!vouchers.length) {
        loyaltyVouchers.innerHTML = "";
    } else {
        loyaltyVouchers.innerHTML = `
            <h3>Your vouchers</h3>
            <ul>
                ${vouchers.map(voucher => `
                    <li class="loyalty-voucher loyalty-voucher--${voucher.status === "Available" ? "available" : "redeemed"}">
                        <span><strong>${escapeHTML(voucher.code)}</strong><small>${voucher.status === "Available" ? "Show this code to salon staff to use your €5 voucher." : "Redeemed"}</small></span>
                        <span class="loyalty-voucher-status">${escapeHTML(voucher.status)}</span>
                    </li>
                `).join("")}
            </ul>
        `;
    }
    if (activeVouchers.length) {
        loyaltyMessage.textContent = `${activeVouchers.length} voucher${activeVouchers.length === 1 ? " is" : "s are"} ready to use at the salon.`;
    }
}

async function redeemLoyaltyVoucher() {
    redeemLoyaltyVoucherButton.disabled = true;
    loyaltyMessage.textContent = "Creating your voucher...";

    const { data: code, error } = await supabaseClient.rpc("customer_redeem_loyalty_voucher");
    if (error) {
        loyaltyMessage.textContent = error.message.includes("50 points")
            ? "You need 50 points to redeem a voucher."
            : "Unable to redeem your voucher. Please try again.";
        await loadLoyaltyRewards(currentCustomerId);
        return;
    }

    loyaltyMessage.textContent = `Your €5 voucher code is ${code}. Show it to salon staff when you visit.`;
    await loadLoyaltyRewards(currentCustomerId);
}

redeemLoyaltyVoucherButton.addEventListener("click", redeemLoyaltyVoucher);

function appointmentStatusClass(status) {
    const normalized = String(status ?? "").trim().toLowerCase();
    return ["pending", "confirmed", "cancelled", "completed"].includes(normalized)
        ? normalized
        : "other";
}

function displayAppointments(container, appointments, feedbackByAppointment, emptyMessage) {
    if (appointments.length === 0) {
        container.innerHTML = `<div class="empty-appointments"><p>${escapeHTML(emptyMessage)}</p></div>`;
        return;
    }

    const today = localDateISO();
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

        const canCancel = ["Pending", "Confirmed"].includes(appointment.status) &&
            isFutureAppointment(appointment);
        const canReschedule = canCancel && isChangeWindowOpen(appointment);
        const managementSection = canCancel
            ? `<div class="appointment-actions">
                    ${canReschedule ? `<button class="secondary-button" type="button" data-action="toggle-reschedule" aria-expanded="false">Reschedule</button>` : ""}
                    <button class="secondary-button cancel-appointment" type="button" data-action="cancel" data-appointment-id="${escapeHTML(appointment.id)}">Cancel appointment</button>
                    ${canReschedule ? `<form class="reschedule-form" data-appointment-id="${escapeHTML(appointment.id)}" hidden>
                        <label>Date <input name="date" type="date" min="${localDateISO()}" value="${escapeHTML(appointment.appointment_date)}" required></label>
                        <label>Time <select name="time" required>${appointmentTimes.map(time => `<option value="${time}" ${time === displayAppointmentTime(appointment.appointment_time) ? "selected" : ""}>${time}</option>`).join("")}</select></label>
                        <button class="primary-button" type="submit">Save new time</button>
                        <p class="appointment-action-message" role="status" aria-live="polite"></p>
                    </form>` : ""}
                </div>`
            : "";

        return `
        <article class="service-card appointment-card appointment-card--${appointmentStatusClass(appointment.status)}">
            <h3>${escapeHTML(appointment.service)}</h3>
            <div class="appointment-details">
                <p><strong>Barber</strong><span>${escapeHTML(appointment.barber || "Not specified")}</span></p>
                <p><strong>Date</strong><span>${formatDate(appointment.appointment_date)}</span></p>
                <p><strong>Time</strong><span>${escapeHTML(displayAppointmentTime(appointment.appointment_time))}</span></p>
                <p><strong>Status</strong><span class="appointment-status appointment-status--${appointmentStatusClass(appointment.status)}">${escapeHTML(appointment.status)}</span></p>
                <p><strong>Payment method</strong><span>${escapeHTML(paymentMethodLabel(appointment.payment_method))}</span></p>
                <p><strong>Payment status</strong><span>${escapeHTML(paymentStatusLabel(appointment.payment_status, appointment.payment_method))}</span></p>
            </div>
            ${managementSection}
            ${feedbackSection}
        </article>
    `;
    }).join("");

    container.querySelectorAll(".feedback-form").forEach(form => {
        form.addEventListener("submit", submitFeedback);
    });
    container.querySelectorAll('[data-action="toggle-reschedule"]').forEach(button => {
        button.addEventListener("click", () => {
            const form = button.parentElement.querySelector(".reschedule-form");
            form.hidden = !form.hidden;
            button.setAttribute("aria-expanded", String(!form.hidden));
        });
    });
    container.querySelectorAll('[data-action="cancel"]').forEach(button => {
        button.addEventListener("click", () => cancelAppointment(button));
    });
    container.querySelectorAll(".reschedule-form").forEach(form => {
        form.addEventListener("submit", rescheduleAppointment);
    });
}

function renderAppointmentHistory() {
    let filteredAppointments = historyAppointments;
    if (historyFilter === "completed") {
        filteredAppointments = historyAppointments.filter(item => appointmentStatusClass(item.status) === "completed");
    } else if (historyFilter === "cancelled") {
        filteredAppointments = historyAppointments.filter(item => appointmentStatusClass(item.status) === "cancelled");
    }

    const emptyMessages = {
        all: "Your appointment history will appear here after a visit or cancellation.",
        completed: "You don't have any completed appointments yet.",
        cancelled: "You don’t have any cancelled appointments."
    };
    displayAppointments(pastAppointments, filteredAppointments, currentFeedbackByAppointment, emptyMessages[historyFilter]);
}

document.querySelectorAll("[data-history-filter]").forEach(button => {
    button.addEventListener("click", () => {
        historyFilter = button.dataset.historyFilter;
        document.querySelectorAll("[data-history-filter]").forEach(filterButton => {
            const selected = filterButton === button;
            filterButton.classList.toggle("is-active", selected);
            filterButton.setAttribute("aria-pressed", String(selected));
        });
        renderAppointmentHistory();
    });
});

async function cancelAppointment(button) {
    const appointmentId = button.dataset.appointmentId;
    const current = currentAppointments.find(item => String(item.id) === String(appointmentId));
    if (!current || !["Pending", "Confirmed"].includes(current.status) || !isFutureAppointment(current)) {
        profileMessage.textContent = "Only upcoming appointments can be cancelled.";
        await loadCustomerProfile();
        return;
    }
    if (!window.confirm("Cancel this appointment?")) return;

    button.disabled = true;
    const { data, error } = await supabaseClient.rpc("customer_manage_appointment", {
        p_appointment_id: Number(appointmentId),
        p_action: "cancel",
        p_new_date: null,
        p_new_time: null
    });

    if (error || data !== true) {
        button.disabled = false;
        profileMessage.textContent = "Unable to cancel this appointment. Check your connection or contact the salon.";
        return;
    }
    profileMessage.textContent = "Appointment cancelled.";
    await loadCustomerProfile();
}

async function rescheduleAppointment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const appointmentId = form.dataset.appointmentId;
    const actionMessage = form.querySelector(".appointment-action-message");
    const submitButton = form.querySelector('button[type="submit"]');
    const date = form.elements.date.value;
    const time = form.elements.time.value;

    const existing = currentAppointments.find(item => String(item.id) === String(appointmentId));
    if (!existing || !isChangeWindowOpen(existing)) {
        actionMessage.textContent = "Changes are available up to 2 hours before your appointment.";
        return;
    }
    const target = appointmentStart({ appointment_date: date, appointment_time: time });
    if (target.getTime() - Date.now() < 2 * 60 * 60 * 1000) {
        actionMessage.textContent = "Choose a time at least 2 hours from now.";
        return;
    }
    if (date === existing.appointment_date && time === existing.appointment_time) {
        actionMessage.textContent = "Choose a different date or time.";
        return;
    }

    submitButton.disabled = true;
    actionMessage.textContent = "Saving your new time...";
    const { data: updated, error } = await supabaseClient.rpc("customer_manage_appointment", {
        p_appointment_id: Number(appointmentId),
        p_action: "reschedule",
        p_new_date: date,
        p_new_time: time
    });

    if (error || updated !== true) {
        submitButton.disabled = false;
        actionMessage.textContent = error?.code === "23505"
            ? "That time is already booked. Please choose another slot."
            : "Unable to reschedule. Check your connection or contact the salon.";
        return;
    }

    profileMessage.textContent = "Appointment rescheduled.";
    await loadCustomerProfile();
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

        const { error: statusRefreshError } = await supabaseClient.rpc("refresh_past_appointments");
        if (statusRefreshError) {
            console.error("Appointment status refresh error:", statusRefreshError);
            profileMessage.textContent = "Past appointment statuses could not be refreshed. Run the Supabase status refresh SQL setup.";
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
                .select("id, service, barber, appointment_date, appointment_time, status, payment_method, payment_status")
                .eq("customer_id", user.id)
                .order("appointment_date", { ascending: true })
                .order("appointment_time", { ascending: true });

        if (appointmentError) throw appointmentError;
        currentAppointments = appointments || [];
        await loadLoyaltyRewards(user.id);

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
        currentFeedbackByAppointment = feedbackByAppointment;

        const today = localDateISO();

        const upcoming = currentAppointments.filter(appointment =>
            appointment.appointment_date >= today &&
            ["Pending", "Confirmed"].includes(appointment.status)
        );

        historyAppointments = currentAppointments.filter(appointment =>
            !upcoming.includes(appointment)
        ).sort((a, b) =>
            b.appointment_date.localeCompare(a.appointment_date) ||
            String(b.appointment_time).localeCompare(String(a.appointment_time))
        );

        displayAppointments(
            upcomingAppointments,
            upcoming,
            feedbackByAppointment,
            "You are all caught up. Book an appointment when you are ready for your next visit."
        );
        renderAppointmentHistory();

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
