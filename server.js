require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const session = require('express-session');
//const checkLoginRouter = require('./check_login');
const checkLoginRouter = require('./controllers/auths/check_login');


app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));


// Middleware
app.use(cors());
app.use(express.json());

// MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) console.error('DB connection error:', err);
  else console.log('Connected to MySQL!');
});

// Test route
app.get('/', (req, res) => {
  res.send('Hubini Cloud API is running!');
});



app.use('/check-login', checkLoginRouter);


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
