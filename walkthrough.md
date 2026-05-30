# Walkthrough: Refactoring legacy Flask to modern FastAPI

We have successfully refactored the legacy, synchronous Flask codebase into a highly performant, fully asynchronous **FastAPI** application. The project is now structured as an **API-First Architecture** that is ready for production and can easily connect to any frontend like Vercel or local HTML pages.

---

## What We Accomplished

Here is a summary of the improvements and transitions:

1. **Dependency Upgrade**: Replaced all synchronous Flask packages (`flask`, `flask-mongoengine-3`, `flask-wtf`, `flask-login`) with modern asynchronous tools:
   - `fastapi` and `uvicorn` (ASGI standard server)
   - `beanie` & `motor` (Asynchronous MongoDB ODM)
   - `pydantic` & `pydantic-settings` (Type-safe validation and configuration)
   - `passlib` & `python-jose` (Secure JWT Token credentials)

2. **Decoupled Business Logic**: Cleaned up the code representation:
   - Removed WTForms in favor of **Pydantic schemas** (`webapp/schemas/user_schema.py`).
   - Removed database mixins from `User` model, making it a pure **Beanie async document** (`webapp/models/user_model.py`).
   - Relocated cryptography helpers to `webapp/core/security.py`.

3. **Gatekeeper Dependency Injection**:
   - Integrated `OAuth2PasswordBearer` to extract and validate bearer tokens.
   - Provided `get_current_active_user` which can be injected directly into any sensitive route (such as creating courses or checking slips) to block unauthorized requests.

4. **Clean Workspace**:
   - Completely deleted legacy Flask controllers (`views`), forms, and template filter structures to avoid clutter and conflicts.

---

## File Summary

| Action | Path | Description |
| :--- | :--- | :--- |
| **Modified** | [pyproject.toml](file:///C:/flask-starter/pyproject.toml) | Added modern async packages, removed old Flask libraries. |
| **New** | [config.py](file:///C:/flask-starter/webapp/core/config.py) | Pydantic Settings for type-safe environment configuration. |
| **New** | [security.py](file:///C:/flask-starter/webapp/core/security.py) | Cryptography helpers & get_current_user dependencies (Gatekeeper). |
| **Modified** | [__init__.py](file:///C:/flask-starter/webapp/models/__init__.py) | Asynchronous Beanie ODM connection lifespan. |
| **Modified** | [user_model.py](file:///C:/flask-starter/webapp/models/user_model.py) | Converted to Beanie Document. |
| **New** | [user_schema.py](file:///C:/flask-starter/webapp/schemas/user_schema.py) | Pydantic schemas validating payloads and sanitizing outputs. |
| **Modified** | [user_service.py](file:///C:/flask-starter/webapp/services/user_service.py) | Async UserService handling DB and auth routines. |
| **Modified** | [__init__.py](file:///C:/flask-starter/webapp/web/__init__.py) | FastAPI app factory, lifespan, and CORS middleware setup. |
| **New** | [user.py](file:///C:/flask-starter/webapp/web/routers/user.py) | Authentication and profile endpoints using Gatekeepers. |
| **Modified** | [web.py](file:///C:/flask-starter/webapp/cmd/web.py) | Entrypoint launching Uvicorn ASGI server with reload. |

---

## Verification & Testing Guide

### 1. Launch the Server
To run the server, use poetry to trigger the configured script:
```bash
poetry run run-web
```
Uvicorn will start and listen on: `http://127.0.0.1:8000`.

### 2. Interactive Swagger Documentation
Navigate to:
👉 **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**

FastAPI automatically generates an interactive Swagger UI. You can test your endpoints here:
- **POST `/api/users/register`**: Submit username/password to register.
- **POST `/api/users/login`**: Sign in to receive your Bearer JWT Token.
- **GET `/api/users/me`**: Click "Authorize" on the top right, enter the Bearer token, and test fetching your active profile.

---

## Frontend Integration Code Example

For your `tutorbooking_system.html` (which can be hosted on Vercel or locally), use simple JavaScript `fetch` calls to authenticate and access protected courses.

### Login & Store Token:
```javascript
async function loginUser(username, password) {
  const response = await fetch("http://127.0.0.1:8000/api/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  
  if (response.ok) {
    const data = await response.json();
    // Save token in localStorage
    localStorage.setItem("access_token", data.access_token);
    console.log("Logged in successfully!");
  } else {
    const err = await response.json();
    alert(`Error: ${err.detail}`);
  }
}
```

### Access Protected API (e.g. Booking a Class):
```javascript
async function fetchProtectedData() {
  const token = localStorage.getItem("access_token");
  if (!token) {
    alert("Please log in first.");
    return;
  }

  const response = await fetch("http://127.0.0.1:8000/api/users/me", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (response.ok) {
    const profile = await response.json();
    console.log("Profile Data:", profile);
  } else {
    console.error("Failed to authenticate or token expired.");
  }
}
```
