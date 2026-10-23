const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const loginButton = document.getElementById("loginButton");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "Signing in...";
    loginButton.disabled = true;

    try {
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (error) {
            message.textContent =
                "Login failed. Check your email and password, and confirm your email if required.";
            return;
        }

        if (data.user) {
            message.textContent = "Login successful! Welcome back.";

            setTimeout(() => {
                window.location.href = "/";
            }, 1200);
        }

    } catch (error) {
        console.error("Login error:", error);

        message.textContent =
            "Unable to sign in. Please try again.";
    } finally {
        loginButton.disabled = false;
    }
});