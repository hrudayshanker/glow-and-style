const bookingForm = document.getElementById("bookingForm");
const message = document.getElementById("message");
const appointmentDate = document.getElementById("appointmentDate");
const serviceSelect = document.getElementById("service");
const timeSelect = document.getElementById("appointmentTime");
const logoutButton = document.getElementById("logoutButton");

// Service prices
const servicePrices = {
    "Hair Styling": 25,
    "Beard Styling": 15,
    "Head Spa": 40,
    "Full Makeover": 30
};

// Update the bill whenever the service changes
function updateBill() {
    const service = serviceSelect.value;
    const price = servicePrices[service] || 0;

    document.getElementById("billServiceName").textContent = service;
    document.getElementById("billServicePrice").textContent =
        `€${price.toFixed(2)}`;

    document.getElementById("billTotal").textContent =
        `€${price.toFixed(2)}`;
}

serviceSelect.addEventListener("change", updateBill);

// Set today's date as the earliest booking date
const today = new Date();

const localToday = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
).toISOString().split("T")[0];

appointmentDate.min = localToday;

// Logout
if (logoutButton) {
    logoutButton.addEventListener("click", async function () {
        logoutButton.disabled = true;

        try {
            const { error } = await supabaseClient.auth.signOut();

            if (error) {
                console.error("Logout error:", error);
                alert("Unable to log out. Please try again.");
                logoutButton.disabled = false;
                return;
            }

            window.location.href = "index.html";

        } catch (error) {
            console.error("Unexpected logout error:", error);
            alert("Something went wrong while logging out.");
            logoutButton.disabled = false;
        }
    });
}

// Submit booking
bookingForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const submitButton = bookingForm.querySelector(
        'button[type="submit"]'
    );

    const service = serviceSelect.value;
    const date = appointmentDate.value;
    const time = timeSelect.value;

    submitButton.disabled = true;

    try {
        message.textContent = "Checking your account...";

        // Verify logged-in customer
        const { data: userData, error: userError } =
            await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
            message.textContent =
                "Please log in before booking an appointment.";
            return;
        }

        // Save appointment in Supabase
        message.textContent = "Saving your appointment...";

        const { data: appointment, error: bookingError } =
            await supabaseClient
                .from("appointments")
                .insert({
                    customer_id: userData.user.id,
                    service: service,
                    appointment_date: date,
                    appointment_time: time
                })
                .select("id")
                .single();

        if (bookingError) {
            console.error("Booking error:", bookingError);

            if (bookingError.code === "23505") {
                message.textContent =
                    "Sorry, this time slot is already booked. Please choose another time.";
            } else {
                message.textContent =
                    "Unable to save your appointment. Please try again.";
            }

            return;
        }

        // Get current login session
        message.textContent =
            "Appointment saved! Sending confirmation email...";

        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError || !sessionData.session) {
            message.textContent =
                "Appointment booked successfully, but we couldn't send the confirmation email. Please log in again.";

            bookingForm.reset();
            updateBill();
            return;
        }

        // Request confirmation email from backend
        const emailResponse = await fetch("/api/send-booking-email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization":
                    `Bearer ${sessionData.session.access_token}`
            },
            body: JSON.stringify({
                appointmentId: appointment.id
            })
        });

        const emailResult = await emailResponse.json();

        if (!emailResponse.ok) {
            console.error("Email error:", emailResult.error);

            message.textContent =
                "Appointment booked successfully! However, the confirmation email could not be sent. Your appointment is still saved.";
        } else {
            message.textContent =
                `Appointment booked successfully! A confirmation email has been sent to ${userData.user.email}.`;
        }

        bookingForm.reset();
        appointmentDate.min = localToday;
        updateBill();

    } catch (error) {
        console.error("Unexpected booking error:", error);

        message.textContent =
            "Your booking may have been saved, but something went wrong. Please check your profile before trying again.";

    } finally {
        submitButton.disabled = false;
    }
});

// Show the initial bill
updateBill();