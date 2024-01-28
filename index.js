import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import path from 'path';
import OpenAI from 'openai';

//local file imports
//import OpenAIUtility from './OpenAIUtility.js';


const openai = new OpenAI({
    apiKey:process.env.OPENAI_API_KEY
});
const model = 'gpt-3.5-turbo';

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

function addMessage(messages,role,message){
    const newElement = {role:role,content:message};
    messages.push(newElement);
}

function updatePrompt_tokens(session,prompt_tokens,completion_tokens){
    //based on the prompt_tokens value returned by chatGPT,
    //calculate the token count of user's most recent prompt as:
    //prompt_tokens_mostRecent = prompt_tokens - prompt_tokens_total
    console.log("updatePrompt_tokens:");
    console.log("prompt_tokens calculated by openAI",prompt_tokens,"prompt_tokens_total:",session.prompt_tokens_total);
    const prompt_tokens_mostRecent = prompt_tokens - session.prompt_tokens_total;
    //update prompt_tokens in session
    console.log("updating local message array, most recent user message has prompt_tokens:",prompt_tokens_mostRecent);
    const currentMessageIndex = session.messageHistory.length-1;
    session.messageHistory[currentMessageIndex].token_count = prompt_tokens_mostRecent;
    //then we update prompt_tokens_total with the latest count as:
    //prompt_tokens_total = prompt_tokens + completion_tokens
    session.prompt_tokens_total = prompt_tokens + completion_tokens;
}

// Endpoint to handle prompt submissions
app.post('/submit', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log("session:",req.session);
    console.log("messageHistory", req.session.messageHistory);
    addMessage(req.session.messageHistory,'user',prompt);
    //generate response to user's prompt
    //const result = await openAIUtility.chatGPTGenerate(req.session,call,personality);
    response = await openai.chat.completions.create({
        messages: req.session.messageHistory,
        model: this.model,
        max_tokens: maxTokens
    });
    const result = completion.choices[0].message.content;
    console.log("result from chatGPTGenerate:",{result});
    //await call.updatePrompt_tokens(req.session,result.prompt_tokens,result.completion_tokens);
    console.log("adding assistant message...");
    addMessage(req.session.messageHistory,"assistant",result);
    const response = result;
    res.json({ response: response });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing your request');
  }
});

app.get('/', (req,res) => {
    if (!req.session.initialized){
        req.session.messageHistory = [];
        req.session.prompt_tokens_total = 0;
        req.session.initialized = true;
        req.session.save(err => {
            if (err) {
                console.error('Session save error:', err);
            }
            res.sendFile(path.join(__dirname,'public','index.html'));
        });
    } else {
        res.sendFile(path.join(__dirname,'public','index.html'));
    }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
