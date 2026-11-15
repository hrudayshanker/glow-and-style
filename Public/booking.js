const bookingForm = document.getElementById("bookingForm");
const message = document.getElementById("booking-message");
const appointmentDate = document.getElementById("select-date");
const barberSelect = document.getElementById("select-barber");
const barberDetails = document.getElementById("barber-details");
const portfolioLink = document.getElementById("view-barber-portfolio");
const barberSchedule = document.getElementById("barber-schedule");
const timeSelect = document.getElementById("select-time");

const today = new Date();
const localToday = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
).toISOString().split("T")[0];

appointmentDate.min = localToday;

function normalizeTime(value) {
    const time = String(value ?? "").trim().toUpperCase();
    const clockTime = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

    if (!clockTime) return time.replace(/\s+/g, " ");

    const hour24 = Number(clockTime[1]);
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    return `${String(hour12).padStart(2, "0")}:${clockTime[2]} ${suffix}`;
}

function selectedBarber() {
    return barbers.find(barber => barber.id === barberSelect.value);
}

let barbers = [];
let bookedTimes = new Set();
let scheduleLoaded = false;

function renderBarberDetails() {
    const barber = selectedBarber();

    if (!barber) {
        portfolioLink.hidden = true;
        barberDetails.textContent = "Select a barber to see their details and schedule.";
        return;
    }

    portfolioLink.href = `barber-portfolio.html?id=${encodeURIComponent(barber.id)}`;
    portfolioLink.hidden = false;

    const specialties = Array.isArray(barber.specialties)
        ? barber.specialties.join(", ")
        : "Not specified";
    const experience = barber.experience_years
        ? `${barber.experience_years} years' experience`
        : "Experience not specified";
    const demoLabel = barber.is_demo ? "Demo profile — replace with your real team details." : "";

    barberDetails.textContent = [
        `${barber.tier} tier · ${experience}`,
        barber.bio || "No bio provided yet.",
        `Specialties: ${specialties}`,
        `Working hours: ${barber.working_hours || "Not specified"}`,
        demoLabel
    ].filter(Boolean).join("\n");
}

async function loadBarbers() {
    barberSelect.innerHTML = "<option value=\"\" disabled selected>Loading barbers...</option>";

    const { data, error } = await supabaseClient
        .from("barbers")
        .select("id, name, tier, bio, specialties, experience_years, working_hours, is_demo")
        .eq("is_active", true)
        .order("name");

    if (error) {
        barberSelect.innerHTML = "<option value=\"\" disabled selected>Barbers unavailable</option>";
        message.textContent = `Unable to load barbers: ${error.message}`;
        return;
    }

    barbers = data || [];
    barberSelect.innerHTML = "";

    if (barbers.length === 0) {
        barberSelect.innerHTML = "<option value=\"\" disabled selected>No barbers listed</option>";
        barberDetails.textContent = "Ask the salon to add active barbers in Supabase.";
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a barber";
    placeholder.disabled = true;
    placeholder.selected = true;
    barberSelect.append(placeholder);

    for (const barber of barbers) {
        const option = document.createElement("option");
        option.value = barber.id;
        option.textContent = `${barber.name} · ${barber.tier}`;
        barberSelect.append(option);
    }

    renderBarberDetails();
}

async function loadSchedule() {
    scheduleLoaded = false;
    bookedTimes = new Set();
    for (const option of timeSelect.options) option.disabled = false;

    const barber = selectedBarber();
    const date = appointmentDate.value;

    if (!barber || !date) {
        barberSchedule.textContent = "Choose a barber and date to view their booked times.";
        return;
    }

    barberSchedule.textContent = "Checking this barber's schedule...";

    const { data, error } = await supabaseClient.rpc("get_barber_schedule", {
        p_date: date
    });

    if (error) {
        barberSchedule.textContent = `Unable to check schedule: ${error.message}`;
        return;
    }

    scheduleLoaded = true;

    bookedTimes = new Set(
        (data || [])
            .filter(slot => slot.barber_id === barber.id)
            .map(slot => normalizeTime(slot.appointment_time))
    );

    let availableCount = 0;
    for (const option of timeSelect.options) {
        option.disabled = bookedTimes.has(normalizeTime(option.value));
        if (!option.disabled) availableCount += 1;
    }

    if (bookedTimes.size === 0) {
        barberSchedule.textContent = `${barber.name} has no bookings on this date.`;
    } else {
        const times = [...bookedTimes].sort().join(", ");
        barberSchedule.textContent = `${barber.name}'s booked times: ${times}. Choose another time or barber.`;
    }

    if (availableCount === 0) {
        barberSchedule.textContent += " No slots remain for this barber on this date; choose another date or barber.";
    } else if (timeSelect.selectedOptions[0]?.disabled) {
        [...timeSelect.options].find(option => !option.disabled).selected = true;
    }
}

barberSelect.addEventListener("change", async () => {
    renderBarberDetails();
    await loadSchedule();
});

appointmentDate.addEventListener("change", loadSchedule);

bookingForm.addEventListener("submit", async event => {
    event.preventDefault();

    const submitButton = bookingForm.querySelector('button[type="submit"]');
    const barber = selectedBarber();
    const service = document.getElementById("select-service").value;
    const date = appointmentDate.value;
    const time = timeSelect.value;

    if (!barber) {
        message.textContent = "Please choose a barber.";
        return;
    }

    if (!scheduleLoaded) {
        message.textContent = "The barber's schedule could not be checked. Please wait for it to load or try again.";
        return;
    }

    if (bookedTimes.has(normalizeTime(time))) {
        message.textContent = `${barber.name} is already booked at ${time}. Please choose another time or barber.`;
        return;
    }

    submitButton.disabled = true;

    try {
        message.textContent = "Checking your account...";
        const { data: userData, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
            message.textContent = "Please log in before booking an appointment.";
            return;
        }

        message.textContent = "Saving your appointment...";
        const { data: appointment, error: bookingError } = await supabaseClient
            .from("appointments")
            .insert({
                customer_id: userData.user.id,
                service,
                barber: barber.name,
                barber_id: barber.id,
                appointment_date: date,
                appointment_time: time
            })
            .select("id")
            .single();

        if (bookingError) {
            console.error("Booking error:", bookingError);

            if (bookingError.code === "23505") {
                message.textContent = `${barber.name} was just booked at ${time}. Please choose another time or barber.`;
            } else {
                message.textContent = `Unable to save your appointment: ${bookingError.message}`;
            }
            await loadSchedule();
            return;
        }

        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !sessionData.session) {
            message.textContent = "Appointment booked successfully, but please log in again to continue.";
            return;
        }

        message.textContent = "Appointment saved! Sending confirmation email...";
        const emailResponse = await fetch("/api/send-booking-email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${sessionData.session.access_token}`
            },
            body: JSON.stringify({ appointmentId: appointment.id })
        });
        const emailResult = await emailResponse.json();

        if (!emailResponse.ok) {
            console.error("Email error:", emailResult.error);
            message.textContent = "Appointment booked successfully, but the confirmation email could not be sent. Your appointment is still saved.";
        } else {
            message.textContent = `Appointment booked with ${barber.name}! A confirmation email has been sent to ${userData.user.email}.`;
        }

        appointmentDate.value = "";
        timeSelect.selectedIndex = 0;
        await loadSchedule();
    } catch (error) {
        console.error("Unexpected booking error:", error);
        message.textContent = `Unable to complete booking: ${error.message || "Please try again."}`;
    } finally {
        submitButton.disabled = false;
    }
});

loadBarbers();
