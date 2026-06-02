# Electronic Records and Document Management System (ERDMS)

Repository to fulfill project requirements of CPE8 - Software Design. 

---

## System Technology Stack

### Frontend Architecture
* **Framework:** Angular 18
* **Design Engine:** Tailwind CSS / Custom Style Rules
* **Dialog UX:** SweetAlert2

### Backend Engine
* **Runtime:** Node.js
* **Asset Pipeline:** Multer
* **Cryptographic Guards:** JSON Web Tokens (JWT) & BcryptJS

### Persistence Layers
* **Database engine:** MySQL Server
* **Management UI:** phpMyAdmin / MySQL CLI

---

## System Project Layout

```text
ERDMS/
├── FULLSTACKAPP/
│   ├── backend/
│   │   ├── config/          # Database connection credentials
│   │   ├── middleware/      # JWT guards, token verifications, CORS overrides
│   │   ├── routes/          # Isolated API endpoint routers (auth, user, folder, log, profile)
│   │   └── server.js        # Main Express entry, static asset pipeline mapping
│   ├── frontend/
│   │   └── src/app/
│   │       └── users/       # Main Angular component layouts, typescript mechanics, templates
│   └── uploads/             # Secure physical server folder for raw file attachments & user avatars
```

---

## Core Installation & Setup Guide
### System Prerequisites
Ensure you have the following frameworks installed on your operating environment:

* **Node.js (LTS Version)**
* **MySQL Community Server, MariaDB or XAMPP**
* **Angular CLI (for local frontend management)**

### Database Initialization
1. Launch your local MySQL client or open phpMyAdmin inside your web browser.
2. Initialize a new, empty database instance:
   
```
CREATE DATABASE erdms_db;
```
3. Open your project schema export file (.sql) and import its SQL definition tables inside erdms_db to prepare the user, folder, document, and log entities.

### Backend Server Configuration
1. Navigate into the database configuration folder:
```
cd FULLSTACKAPP/backend/config
```
2. Open db.config.js and verify that your local SQL port, hosts, and account passwords align:
```
module.exports = {
    DB_HOST: "localhost",
    DB_USER: "root",       // Your SQL Username
    DB_PASS: "password",   // Your SQL Password
    DB_NAME: "erdms_db"
};
```
3. Navigate back to the core backend working space, run the dependency installation, and launch the server pipeline:
```
cd ..
npm install
node server.js
```
Your terminal console should print confirming connections:
```
ERDMS Backend Active on Port 3000
ERDMS DATABASE CONNECTED
```

### Frontend Client Setup
1. Launch a separate command terminal window and navigate into the Angular root directory:
```
cd FULLSTACKAPP/frontend
```
2. Install the frontend dependencies including the SweetAlert dialog assets:
```
npm install
```
3. Start the Vite-backed local development web server:
```
ng serve
```
4. Access the web interface by navigating to: *http://localhost:4200/*.

