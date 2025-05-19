require('dotenv').config(); 

const express = require('express');
const mongoose = require('mongoose');
const fetch = require('node-fetch').default; 
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

//MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB:', err));

// Mongodb formatting
const favoriteSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  type: { type: String, enum: ['player', 'team'], required: true },
  name: { type: String, required: true }
});

const Favorite = mongoose.model('Favorite', favoriteSchema);

//routes

// search request
app.get('/api/search', async (req, res) => {
  const { type, term } = req.query;
  const balldontlieApiKey = process.env.BALLLDONTLIE_API_KEY;

  let apiUrl;
  let headers = {};

  if (balldontlieApiKey) {
      headers['Authorization'] = balldontlieApiKey;
  }

  if (type === 'player') {
    apiUrl = `https://api.balldontlie.io/v1/players?search=${term}`;
  } else if (type === 'team') {
    // fetch all teams and filter on the client-side.
    apiUrl = `https://api.balldontlie.io/v1/teams`; 
  } else {
    return res.status(400).json({ error: 'Invalid search type specified.' });
  }

  try {
    const response = await fetch(apiUrl, { headers: headers });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error ${response.status} from ${apiUrl}: ${errorText}`);
        return res.status(response.status).json({ error: `Failed to fetch data from API: ${response.statusText}` });
    }

    const data = await response.json();

    if (data && Array.isArray(data.data)) {
        let results = data.data;

        //Client-side filtering for teams
        // The server will send ALL teams, and the client-side JS will filter before displaying.
        res.json(results); 
    } else {
        console.error("Unexpected API response structure or no 'data' array:", data);
        res.status(500).json({ error: 'Unexpected API response format.' });
    }
  } catch (error) {
    console.error('Error fetching data from balldontlie.io:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

//adding a favorite
app.post('/api/favorites', async (req, res) => {
  const { id, type, name } = req.body;

  try {
    const favorite = new Favorite({ id, type, name });
    await favorite.save();
    res.json({ success: true, message: `${name} added to favorites!` });
  } catch (error) {
    console.error('Error saving favorite:', error);
    if (error.code === 11000) {
      res.status(409).json({ success: false, error: 'Item already in favorites!' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save favorite' });
    }
  }
});

// list of all favorites
app.get('/api/favorites', async (req, res) => {
  try {
    const favorites = await Favorite.find();
    res.json(favorites);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// deleting a favorite
app.delete('/api/favorites/:id', async (req, res) => {
  const favoriteId = req.params.id; // Get the ID from the URL parameter

  try {
    // find by ID and delete
    const result = await Favorite.findByIdAndDelete(favoriteId);

    if (result) {
      res.json({ success: true, message: 'Favorite deleted successfully!' });
    } else {
      res.status(404).json({ success: false, error: 'Favorite not found.' });
    }
  } catch (error) {
    console.error('Error deleting favorite:', error);
    res.status(500).json({ success: false, error: 'Failed to delete favorite.' });
  }
});


// EJS Templates

// landing page
app.get('/', (req, res) => {
  res.render('landing'); 
});

// players search page
app.get('/players', (req, res) => {
  res.render('players'); 
});

// teams search page
app.get('/teams', (req, res) => {
  res.render('teams'); 
});

// favorites list page
app.get('/favorites', (req, res) => {
  res.render('favorites'); 
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});