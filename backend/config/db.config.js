// exports a configuration object containing the MySQL database credentials
// this object can be imported in other files using require()
// this is Encapsulation — hiding DB credentials in one place, reused anywhere
module.exports = {
  // the server where MySQL is running
  // localhost means it's running on your own machine
  DB_HOST: "localhost",

  // the MySQL username used to authenticate
  // root is the default admin user in MySQL
  DB_USER: "root",

  // the MySQL password for the root user
  // empty string means no password is set
  DB_PASS: "",

  // the specific database to connect to inside MySQL
  // must match the database name you created in MySQL
  DB_NAME: "erdms_db",

  // secret key used to sign and verify JWT tokens
  JWT_SECRET: "fullstack_secret_key",
};
