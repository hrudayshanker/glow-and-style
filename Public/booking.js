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

    const service = document.getElementById("service").value;
    const date = appointmentDate.value;
    const time = document.getElementById("appointmentTime").value;

    message.textContent = "Checking your account...";

    try {
        const { data: userData, error: userError } =
            await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
            message.textContent =
                "Please log in before booking an appointment.";
            return;
        }

        message.textContent = "Saving your appointment...";

        const { error: bookingError } = await supabaseClient
            .from("appointments")
            .insert({
                customer_id: userData.user.id,
                service: service,
                appointment_date: date,
                appointment_time: time
            });

        if (bookingError) {
            console.error("Booking error:", bookingError);
            message.textContent =
                "Unable to save your appointment. Please try again.";
            return;
        }

        message.textContent =
            "Appointment booked successfully! Your status is Pending.";

        bookingForm.reset();
        appointmentDate.min = localToday;

    } catch (error) {
        console.error("Unexpected booking error:", error);
        message.textContent = "Something went wrong. Please try again.";
    }
});
