// server.js
require('dotenv').config();
const express = require('express');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

// OpenAI configuration
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Serve static files from 'public' directory
app.use(express.static('public'));

// Body parser middleware to parse JSON bodies
app.use(express.json());

// Endpoint to handle prompt submissions
app.post('/submit', async (req, res) => {
  try {
    const prompt = req.body.prompt;
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant."
        },
        {
          role: "user",
          content: prompt
        }
      ],
    });
    res.json({ response: response.data.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing your request');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
