import dotenv from 'dotenv';
dotenv.config();
import express from 'express';

//local file imports
import OpenAIUtility from './OpenAIUtility.js';

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
    apiKey:process.env.OPENAI_API_KEY
});

// Serve static files from 'public' directory
app.use(express.static('public'));

// Body parser middleware to parse JSON bodies
app.use(express.json());

// Endpoint to handle prompt submissions
app.post('/submit', async (req, res) => {
  try {
    const { prompt } = req.body;
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
