const hospitals = {
    gayang: {
        name: "가양삼성정형외과",
        logo: "logo.png"
    },

    banghak: {
        name: "방학삼성정형외과",
        logo: "logo-banghak.png.png"
    }
};

export function getHospitalId() {
    return localStorage.getItem("hospitalId") || "gayang";
}

export function setHospitalId(id) {
    localStorage.setItem("hospitalId", id);
    location.reload();
}

export function getHospitalInfo() {
    return hospitals[getHospitalId()] || hospitals.gayang;
}

export function hospitalCollection(name) {
    return `${getHospitalId()}_${name}`;
}

export function applyHospitalUI() {
    const info = getHospitalInfo();

    const logoImg = document.querySelector(".logo img");

    if (logoImg) {
        logoImg.src = info.logo;
        logoImg.alt = info.name;
    }

    document.title = info.name;

    document.body.classList.remove(
        "hospital-gayang",
        "hospital-banghak"
    );

    document.body.classList.add(
        `hospital-${getHospitalId()}`
    );
}