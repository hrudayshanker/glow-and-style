const portfolioStatus = document.getElementById("portfolio-status");

async function loadBarberPortfolio() {
    const barberId = new URLSearchParams(window.location.search).get("id");

    if (!barberId) {
        document.getElementById("barber-name").textContent = "Barber not found";
        portfolioStatus.textContent = "Return to booking and select a barber to view their portfolio.";
        return;
    }

    const { data: barber, error } = await supabaseClient
        .from("barbers")
        .select("name, tier, bio, specialties, experience_years, working_hours, portfolio_images, is_demo")
        .eq("id", barberId)
        .eq("is_active", true)
        .single();

    if (error || !barber) {
        document.getElementById("barber-name").textContent = "Portfolio unavailable";
        portfolioStatus.textContent = error?.message || "This barber is unavailable.";
        return;
    }

    document.title = `${barber.name} | Glow & Style`;
    document.getElementById("barber-name").textContent = barber.name;
    document.getElementById("barber-tier").textContent = `${barber.tier} tier${barber.is_demo ? " · Demo profile" : ""}`;
    document.getElementById("barber-bio").textContent = barber.bio || "No introduction added yet.";
    document.getElementById("barber-specialties").textContent = `Specialties: ${(barber.specialties || []).join(", ") || "Not specified"}`;
    document.getElementById("barber-experience").textContent = barber.experience_years
        ? `${barber.experience_years} years' experience`
        : "Experience not specified";
    document.getElementById("barber-hours").textContent = `Working hours: ${barber.working_hours || "Not specified"}`;

    const images = Array.isArray(barber.portfolio_images) ? barber.portfolio_images : [];
    const gallery = document.getElementById("portfolio-gallery");
    const safeImages = images.filter(value => {
        try {
            const url = new URL(value);
            return url.protocol === "https:" || url.protocol === "http:";
        } catch {
            return false;
        }
    });

    if (safeImages.length === 0) {
        portfolioStatus.textContent = "Portfolio photos have not been added yet.";
        return;
    }

    portfolioStatus.textContent = "Portfolio";
    safeImages.forEach((url, index) => {
        const figure = document.createElement("figure");
        const image = document.createElement("img");
        image.src = url;
        image.alt = `${barber.name} portfolio example ${index + 1}`;
        image.loading = "lazy";
        const caption = document.createElement("figcaption");
        caption.textContent = `Work example ${index + 1}`;
        figure.append(image, caption);
        gallery.append(figure);
    });
}

loadBarberPortfolio();
