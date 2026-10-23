const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "Creating your account...";

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: name
                }
            }
        });

        if (error) {
            message.textContent = error.message;
            return;
        }

        if (data.session) {
            message.textContent =
                "Account created successfully! You can now log in.";
        } else {
            message.textContent =
                "Account created! Please check your email to confirm your account.";
        }

        registerForm.reset();

    } catch (error) {
        console.error("Registration error:", error);
        message.textContent =
            "Something went wrong. Please try again.";
    }
});