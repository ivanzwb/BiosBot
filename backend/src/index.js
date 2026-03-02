const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Cloudbrain Backend Running');
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
