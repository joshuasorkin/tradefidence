import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import path from 'path';


//local file imports
import OpenAIUtility from './OpenAIUtility.js';

const app = express();
const port = process.env.PORT || 3000;

const mongo_uri = process.env.MONGO_URI;

//set secure: process.env.SECURE_BOOLEAN
app.use(session({
    secret: process.env.SECRET_KEY, // Secret key for signing the session ID cookie
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl:mongo_uri }),
    cookie: { secure: false } // Set to true if using HTTPS
  }));



// Serve static files from 'public' directory
app.use(express.static('public'));

// Body parser middleware to parse JSON bodies
app.use(express.json());

addMessage(messages,role,message){
    const newElement = {role:role,content:message};
    messages.push(newElement);
}

// Endpoint to handle prompt submissions
app.post('/submit', async (req, res) => {
  try {
    const { prompt } = req.body;
    //generate response to user's prompt
    const result = await openAIUtility.chatGPTGenerate(call,personality);
    console.log("result from chatGPTGenerate:",{result});
    console.log("adding assistant message...");
    addMessage(req.session.messageHistory,"assistant",result.response);
    const response = result.response;
    res.json({ response: response });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing your request');
  }
});

app.get('/', (req,res) => {
    //initialize session's message history if it doesn't already exist
    if (!req.session.messageHistory){
        req.session.messageHistory = [];
    }
    res.sendFile(path.join(__dirname,'public','index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
