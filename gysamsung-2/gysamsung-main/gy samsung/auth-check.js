import {
    auth,
    onAuthStateChanged
}
from "./firebase.js";

onAuthStateChanged(auth, (user) => {

    if (!user) {

        location.href = "login.html";
    }

});