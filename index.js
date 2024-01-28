import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import path from 'path';
import OpenAI from 'openai';
import fileUpload from 'express-fileupload';
app.use(fileUpload());

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    req.session.save(err => {
        if (err) {
            console.error('Session save error:', err);
        }
    });
    //generate response to user's prompt
    //const result = await openAIUtility.chatGPTGenerate(req.session,call,personality);
    const completion = await openai.chat.completions.create({
        messages: req.session.messageHistory,
        model: model
    });
    const result = completion.choices[0].message.content;
    console.log("result from chatGPTGenerate:",{result});
    //await call.updatePrompt_tokens(req.session,result.prompt_tokens,result.completion_tokens);
    console.log("adding assistant message...");
    addMessage(req.session.messageHistory,"assistant",result);
    res.json({ response: result });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing your request');
  }
});

function extractFromMindsDB(data){
    const results = data.results;
    const concatenatedText = results.map(element => element.text).join("");
    return concatenatedText;
}


app.get('/', (req,res) => {

    //if (!req.session.initialized){
        req.session.regenerate(err => {
            if (err) {
                console.error('Error regenerating session:', err);
                return res.status(500).send('Error initializing session');
            }
            console.log("not inititialized")
            req.session.messageHistory = [];
            req.session.prompt_tokens_total = 0;
            req.session.initialized = true;
            addMessage(req.session.messageHistory,"system","You are an expert, profitable day trader analyst for the forex markets who has done both risk aggressive and conservative strategies. You give insights, analysis and recommendations based on my risk profile. Give me the strategy being used in the above trading history document. Specifically, try         to give me an improved strategy based on my previous trades that can increase my returns but outweighs the additional risk involved.")
            async function getNews(){ 
                try{
                    console.log("running getnews");
                    const response = await fetch('https://mindsdb2024.openbb.dev/api/v1/news/world?provider=benzinga&limit=10&display=full&start_date=2024-01-26&sort=created&order=desc&topics=USD', {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Authorization': process.env.MINDSDB_AUTHORIZATION
                        }
                    });
                    const data = await response.json();
                    const text = extractFromMindsDB(data);
                    addMessage(req.session.messageHistory,"user",text);
                    console.log('Session initialized:', req.session);
                    res.sendFile(path.join(__dirname,'public','index.html'));
                }
                catch(error) {
                console.error('Error:', error);
                }
            }
            getNews();
            
        });
    //} else {
    //    console.log("existng session");
    //    res.sendFile(path.join(__dirname,'public','index.html'));
    //}
});

// Serve static files from 'public' directory
app.use(express.static('public'));



// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
