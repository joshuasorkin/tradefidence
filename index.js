import dotenv from 'dotenv';
dotenv.config();
import express from 'express';

//local file imports
import OpenAIUtility from './OpenAIUtility.js';

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from 'public' directory
app.use(express.static('public'));

// Body parser middleware to parse JSON bodies
app.use(express.json());

// Endpoint to handle prompt submissions
app.post('/submit', async (req, res) => {
  try {
    const { prompt } = req.body;
    //generate response to user's prompt
    const result = await openAIUtility.chatGPTGenerate(call,personality);
    console.log("result from chatGPTGenerate:",{result});
    await call.updatePrompt_tokens(result.prompt_tokens,result.completion_tokens);
    console.log("adding assistant message...");
    await call.addAssistantMessage(result.response,false,result.completion_tokens);
    const response = result.response;
    res.json({ response: response });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing your request');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
