require("dotenv").config();

const express = require("express");
const path = require("path");
const { Resend } = require("resend");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY
);

// Serve website files from the Public folder.
app.use(express.static(path.join(__dirname, "Public")));

// Existing API test route
app.get("/api", (req, res) => {
    res.json({
        message: "Your Salon Booking Website backend is working!"
    });
});

// Send appointment confirmation email
app.post("/api/send-booking-email", async (req, res) => {
    try {
        // Get the customer's login token
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

        if (!token) {
            return res.status(401).json({
                error: "Please log in first."
            });
        }

        // Verify the logged-in customer
        const { data: userData, error: userError } =
            await supabase.auth.getUser(token);

        if (userError || !userData.user) {
            return res.status(401).json({
                error: "Invalid login session."
            });
        }

        const user = userData.user;
        const appointmentId = req.body.appointmentId;

        if (!appointmentId) {
            return res.status(400).json({
                error: "Appointment ID is required."
            });
        }

        // Connect to Supabase using the customer's token
        const customerSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_PUBLISHABLE_KEY,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                },
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            }
        );

        // Retrieve only this customer's appointment
        const { data: appointment, error: appointmentError } =
            await customerSupabase
                .from("appointments")
                .select("id, service, appointment_date, appointment_time, status")
                .eq("id", appointmentId)
                .eq("customer_id", user.id)
                .single();

        if (appointmentError || !appointment) {
            return res.status(404).json({
                error: "Appointment not found."
            });
        }

        if (!user.email) {
            return res.status(400).json({
                error: "Your account does not have an email address."
            });
        }

        // Send confirmation email
        const { data, error } = await resend.emails.send({
            from: process.env.FROM_EMAIL,
            to: user.email,
            subject: "Appointment Confirmation - Glow & Style",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                    <h2>Glow & Style</h2>

                    <h3>Your appointment has been booked!</h3>

                    <p>Hello,</p>

                    <p>Thank you for booking with Glow & Style.</p>

                    <h3>Appointment Details</h3>

                    <p><strong>Service:</strong> ${escapeHTML(appointment.service)}</p>
                    <p><strong>Date:</strong> ${escapeHTML(appointment.appointment_date)}</p>
                    <p><strong>Time:</strong> ${escapeHTML(appointment.appointment_time)}</p>
                    <p><strong>Status:</strong> ${escapeHTML(appointment.status)}</p>

                    <p>We look forward to seeing you!</p>

                    <p>Regards,<br>Glow & Style Team</p>
                </div>
            `
        });

        if (error) {
            console.error("Resend error:", error);

            return res.status(500).json({
                error: "Appointment saved, but the confirmation email could not be sent."
            });
        }

        console.log("Confirmation email sent:", data.id);

        return res.json({
            message: "Confirmation email sent successfully."
        });

    } catch (error) {
        console.error("Email endpoint error:", error);

        return res.status(500).json({
            error: "Something went wrong while sending the email."
        });
    }
});

// Escape HTML values before inserting database content into an email
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});