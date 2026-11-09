const adminLoginForm = document.getElementById("adminLoginForm");
const message = document.getElementById("message");
const loginButton = document.getElementById("loginButton");

adminLoginForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginButton.disabled = true;
    loginButton.textContent = "Checking...";
    message.textContent = "";

    try {

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (error) {
            throw error;
        }

        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", data.user.id)
                .single();

        if (profileError || !profile || profile.role !== "admin") {

            await supabaseClient.auth.signOut();

            throw new Error("Access denied. Administrator account required.");
        }

        message.style.color = "green";
        message.textContent = "Login successful!";

        window.location.href = "/admin-dashboard.html";

    } catch (error) {

        message.style.color = "red";
        message.textContent = error.message;

        loginButton.disabled = false;
        loginButton.textContent = "Admin Login";
    }

});