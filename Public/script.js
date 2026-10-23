const bookButton = document.getElementById("bookButton");

bookButton.addEventListener("click", () => {
alert("Welcome to Glow & Style! Online booking is coming soon.");
});

// Test the Supabase database connection
async function testSupabaseConnection() {
    const { data, error } = await supabaseClient
        .from("appointments")
        .select("id")
        .limit(1);

    if (error) {
        console.error("Database connection test failed:", error.message);
        return;
    }

    console.log("Supabase database connection successful!");
}

testSupabaseConnection();