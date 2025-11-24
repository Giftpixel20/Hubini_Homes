const express = require('express');
const router = express.Router();

// GET /check-login
router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ logged_in: true });
  } else {
    res.json({ logged_in: false });
  }
});

module.exports = router;
