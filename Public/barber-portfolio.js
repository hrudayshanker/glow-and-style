const portfolioStatus = document.getElementById("portfolio-status");

async function loadBarberPortfolio() {
    const barberId = new URLSearchParams(window.location.search).get("id");

    if (!barberId) {
        document.getElementById("barber-name").textContent = "Barber not found";
        portfolioStatus.textContent = "Return to booking and select a barber to view their portfolio.";
        return;
    }

    if (typeof supabaseClient === "undefined") {
        document.getElementById("barber-name").textContent = "Portfolio unavailable";
        portfolioStatus.textContent = "The portfolio service could not be reached. Please try again later.";
        return;
    }

    let barber;
    try {
        const { data, error } = await supabaseClient
            .from("barbers")
            .select("name, tier, bio, specialties, experience_years, working_hours, portfolio_images, is_demo")
            .eq("id", barberId)
            .eq("is_active", true)
            .single();

        if (error) throw error;
        barber = data;
    } catch {
        document.getElementById("barber-name").textContent = "Portfolio unavailable";
        portfolioStatus.textContent = "This barber is unavailable. Return to booking to choose another barber.";
        return;
    }

    document.title = `${barber.name} | Glow & Style`;
    document.getElementById("barber-name").textContent = barber.name;
    document.getElementById("barber-tier").textContent = `${barber.tier || "Barber"} tier${barber.is_demo ? " · Demo profile" : ""}`;
    document.getElementById("barber-bio").textContent = barber.bio || "No introduction added yet.";

    const specialties = Array.isArray(barber.specialties) ? barber.specialties : [];
    document.getElementById("barber-specialties").textContent = `Specialties: ${specialties.join(", ") || "Not specified"}`;
    document.getElementById("barber-experience").textContent = barber.experience_years
        ? `${barber.experience_years} years' experience`
        : "Experience not specified";
    document.getElementById("barber-hours").textContent = `Working hours: ${barber.working_hours || "Not specified"}`;

    const bookingLink = document.getElementById("book-barber");
    bookingLink.href = `booking.html?barber=${encodeURIComponent(barberId)}`;
    bookingLink.hidden = false;

    let images = barber.portfolio_images;
    if (typeof images === "string") {
        try {
            const parsed = JSON.parse(images);
            images = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            images = [images];
        }
    }
    if (!Array.isArray(images)) images = [];
    const gallery = document.getElementById("portfolio-gallery");
    const safeImages = images.map(value => {
        if (typeof value !== "string" || !value.trim()) return null;
        const imageValue = value.trim();

        try {
            const url = new URL(imageValue);
            return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
        } catch {
            // The database may contain a bucket path or just the file name.
            const objectPath = imageValue.replace(/^\/+/, "").replace(/^barbers\//, "");
            const { data } = supabaseClient.storage.from("barbers").getPublicUrl(objectPath);
            return data?.publicUrl || null;
        }
    }).filter(Boolean);

    if (safeImages.length === 0) {
        portfolioStatus.textContent = "Portfolio photos have not been added yet.";
        return;
    }

    portfolioStatus.textContent = "";
    safeImages.forEach((url, index) => {
        const figure = document.createElement("figure");
        const image = document.createElement("img");
        image.src = url;
        image.alt = `${barber.name} portfolio example ${index + 1}`;
        image.loading = "lazy";
        image.onerror = () => {
            console.error("Could not load barber portfolio image:", url);
            figure.remove();
            if (!gallery.querySelector("figure")) {
                portfolioStatus.textContent = "Portfolio photos could not be loaded. Check that the barbers storage bucket is public and the image URLs are correct.";
            }
        };
        figure.append(image);
        gallery.append(figure);
    });
}

loadBarberPortfolio();
