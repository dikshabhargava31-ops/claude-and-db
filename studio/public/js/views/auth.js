import { post } from "../api.js";
import { esc, busy } from "../ui.js";

export function authView(app, needsSetup, done) {
  app.innerHTML = `<div class="auth card">
    <h1>Creator Research Studio</h1>
    <p class="muted">${needsSetup ? "Create the owner account. This app is private: only accounts you add can sign in." : "Sign in to continue."}</p>
    <form id="authForm">
      ${needsSetup ? '<label>Your name<input name="name" required autocomplete="name"></label>' : ""}
      <label>Email<input name="email" type="email" required autocomplete="username"></label>
      <label>Password${needsSetup ? " (at least 10 characters)" : ""}<input name="password" type="password" required minlength="${needsSetup ? 10 : 1}" autocomplete="${needsSetup ? "new-password" : "current-password"}"></label>
      <div id="authErr"></div>
      <button class="btn primary">${needsSetup ? "Create owner account" : "Sign in"}</button>
    </form></div>`;
  const form = app.querySelector("#authForm");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    try {
      await busy(form.querySelector("button"), () => post(needsSetup ? "/api/setup" : "/api/login", body));
      done();
    } catch (err) {
      form.querySelector("#authErr").innerHTML = `<div class="notice error">${esc(err.message)}</div>`;
    }
  };
}
