const loginLink = document.getElementById("loginLink");
const signupLink = document.getElementById("signupLink");
const bookLink = document.getElementById("bookLink");
const profileLink = document.getElementById("profileLink");
const adminLink = document.getElementById("adminLink");
const logoutLink = document.getElementById("logoutLink");

// Show or hide navigation links safely
function showNavigation(options) {
    if (loginLink) loginLink.style.display = options.login ? "" : "none";
    if (signupLink) signupLink.style.display = options.signup ? "" : "none";
    if (bookLink) bookLink.style.display = options.book ? "" : "none";
    if (profileLink) profileLink.style.display = options.profile ? "" : "none";
    if (adminLink) adminLink.style.display = options.admin ? "" : "none";
    if (logoutLink) logoutLink.style.display = options.logout ? "" : "none";
}

// Check login session
async function updateNavigation() {
    try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error || !data.session) {
            showNavigation({
                login: true,
                signup: true,
                book: false,
                profile: false,
                admin: false,
                logout: false
            });
            return;
        }

        const user = data.session.user;

        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .single();

        if (profileError) {
            console.error("Unable to check user role:", profileError);
        }

        if (profile && profile.role === "admin") {
            showNavigation({
                login: false,
                signup: false,
                book: false,
                profile: false,
                admin: true,
                logout: true
            });
        } else {
            showNavigation({
                login: false,
                signup: false,
                book: true,
                profile: true,
                admin: false,
                logout: true
            });
        }

    } catch (error) {
        console.error("Navigation error:", error);
    }
}

// Logout safely
if (logoutLink) {
    logoutLink.addEventListener("click", async function(event) {
        event.preventDefault();

        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            console.error("Logout error:", error);
            alert("Unable to log out. Please try again.");
            return;
        }

        window.location.href = "index.html";
    });
}

// Run navigation check
updateNavigation();