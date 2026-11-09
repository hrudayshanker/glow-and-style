const bookingForm = document.getElementById("bookingForm");
const message = document.getElementById("message");
const appointmentDate = document.getElementById("appointmentDate");

const today = new Date();

const localToday = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
).toISOString().split("T")[0];

appointmentDate.min = localToday;

bookingForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const submitButton = bookingForm.querySelector(
        'button[type="submit"]'
    );

    const service = document.getElementById("service").value;
    const date = appointmentDate.value;
    const time = document.getElementById("appointmentTime").value;

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
        message.textContent = "Appointment saved! Sending confirmation email...";

        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError || !sessionData.session) {
            message.textContent =
                "Appointment booked successfully, but we couldn't send the confirmation email. Please log in again.";
            bookingForm.reset();
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

    } catch (error) {
        console.error("Unexpected booking error:", error);

        message.textContent =
            "Your booking may have been saved, but something went wrong. Please check your profile before trying again.";
    } finally {
        submitButton.disabled = false;
    }
});