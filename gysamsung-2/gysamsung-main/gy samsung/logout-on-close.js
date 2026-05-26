import {
    auth,
    signOut
}
from "./firebase.js";

window.addEventListener("beforeunload", () => {
    signOut(auth);
});