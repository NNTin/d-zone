const express = require('express');
const path = require('path');

const app = express();
const PORT = 8080;

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

app.listen(PORT, () => {
    console.log(`Static site served at http://localhost:${PORT}`);
});
