const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const loginButton = document.getElementById("loginButton");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.style.color = "var(--text, #29251f)";
    message.textContent = "Signing in...";
    loginButton.disabled = true;

    try {
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (error) {
            message.style.color = "#dc2626"; // Red warning text
            message.textContent =
                "Invalid email, incorrect password, or unregistered account. Please check your credentials or sign up first.";
            return;
        }

        if (data.user) {
            message.style.color = "#059669"; // Green success text
            message.textContent = "Login successful! Welcome back.";

            setTimeout(() => {
                window.location.href = "index.html";
            }, 1200);
        }

    } catch (error) {
        console.error("Login error:", error);

        message.style.color = "#dc2626";
        message.textContent =
            "Unable to sign in. Please try again.";
    } finally {
        loginButton.disabled = false;
    }
});