import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import path from 'path';
import OpenAI from 'openai';
import fileUpload from 'express-fileupload';


import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import fs from 'fs';

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

app.use(fileUpload());




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
    const completion = await openai.chat.completions.create({
        messages: req.session.messageHistory,
        model: model
    });
    const result = completion.choices[0].message.content;
    console.log("result from chatGPTGenerate:",{result});
    console.log("adding assistant message...");
    addMessage(req.session.messageHistory,"assistant",result);
    console.log("message added");
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

app.post('/upload-csv', async (req, res) => {
    if (!req.files || !req.files.file) {
      return res.status(400).send('No files were uploaded.');
    }
  
    const csvFile = req.files.file;
    // Read the csvFile and convert it to one large string
    const csvData = csvFile.data.toString('utf8');
    console.log("Data from uploaded file:",csvData);
    // Directly send the raw CSV data to the ChatGPT model
    const responseFromChatGPT = await sendPromptToChatGPT(csvData, res);
  
    // Send the response back to the client
    res.json(responseFromChatGPT);
  });
  
  async function sendPromptToChatGPT(csvData, res) {
    // Split the CSV data into lines
    const lines = csvData.split('\n');

    // Create message objects from each line
    const messages = lines.map((line, index) => {
        return {
            role: index % 2 === 0 ? 'user' : 'assistant', // Alternating roles for each line
            content: line.trim()
        };
    });

    // Generate response from ChatGPT
    try {
        const completion = await openai.chat.completions.create({
            messages: messages,
            model: model
        });
        const result = completion.choices[0].message.content;
        console.log("result from chatGPTGenerate:", {result});
        console.log("adding assistant message...");
        addMessage(messages, "assistant", result);
        console.log("message added");
        res.json({ response: result });
    } catch (error) {
        console.error('Error sending data to ChatGPT:', error);
        // Handle the error appropriately
        res.status(500).json({ error: 'Error processing CSV data' });
    }
  }
  
app.post('/download-step', async (req, res) => {
    try {
        // Extract prompt from request body
        const { prompt } = req.body;
        const step_file = `
        str1=******* Lot settings *******
        FixedLot=0.01000000
        FixedLot,F=0
        FixedLot,1=0.01000000
        FixedLot,2=0.00000000
        FixedLot,3=0.00000000
        AutoLot=1
        AutoLot,F=0
        AutoLot,1=0
        AutoLot,2=1
        AutoLot,3=1
        MaxLot=100.00000000
        MaxLot,F=0
        MaxLot,1=100.00000000
        MaxLot,2=0.00000000
        MaxLot,3=0.00000000
        MinLot=0.01000000
        MinLot,F=0
        MinLot,1=0.01000000
        MinLot,2=0.00000000
        MinLot,3=0.00000000
        str2=******* Trade settings *******
        SetLong=1
        SetLong,F=0
        SetLong,1=0
        SetLong,2=1
        SetLong,3=1
        SetShort=1
        SetShort,F=0
        SetShort,1=0
        SetShort,2=1
        SetShort,3=1
        TakeProfit=10.00000000
        TakeProfit,F=0
        TakeProfit,1=10.00000000
        TakeProfit,2=0.00000000
        TakeProfit,3=0.00000000
        TradingRisk=1.25000000
        TradingRisk,F=0
        TradingRisk,1=1.25000000
        TradingRisk,2=0.00000000
        TradingRisk,3=0.00000000
        RNDLevel=10.00000000
        RNDLevel,F=0
        RNDLevel,1=10.00000000
        RNDLevel,2=0.00000000
        RNDLevel,3=0.00000000
        TSLRatio=2.00000000
        TSLRatio,F=0
        TSLRatio,1=2.00000000
        TSLRatio,2=0.00000000
        TSLRatio,3=0.00000000
        MaxSpread=1.50000000
        MaxSpread,F=0
        MaxSpread,1=1.50000000
        MaxSpread,2=0.00000000
        MaxSpread,3=0.00000000
        str3=******* News filter *******
        UseNewsFilter=1
        UseNewsFilter,F=0
        UseNewsFilter,1=0
        UseNewsFilter,2=1
        UseNewsFilter,3=1
        NewsCalendar=https://ec.forexprostools.com
        DetectLowNews=0
        DetectLowNews,F=0
        DetectLowNews,1=0
        DetectLowNews,2=1
        DetectLowNews,3=1
        PauseBeforeLow=5
        PauseBeforeLow,F=0
        PauseBeforeLow,1=5
        PauseBeforeLow,2=0
        PauseBeforeLow,3=0
        PauseAfterLow=5
        PauseAfterLow,F=0
        PauseAfterLow,1=5
        PauseAfterLow,2=0
        PauseAfterLow,3=0
        LowNewsColor=14772545
        DetectMiddleNews=1
        DetectMiddleNews,F=0
        DetectMiddleNews,1=0
        DetectMiddleNews,2=1
        DetectMiddleNews,3=1
        PauseBeforeMiddle=15
        PauseBeforeMiddle,F=0
        PauseBeforeMiddle,1=15
        PauseBeforeMiddle,2=0
        PauseBeforeMiddle,3=0
        PauseAfterMiddle=15
        PauseAfterMiddle,F=0
        PauseAfterMiddle,1=15
        PauseAfterMiddle,2=0
        PauseAfterMiddle,3=0
        MiddleNewsColor=55295
        DetectHighNews=1
        DetectHighNews,F=0
        DetectHighNews,1=0
        DetectHighNews,2=1
        DetectHighNews,3=1
        PauseBeforeHigh=30
        PauseBeforeHigh,F=0
        PauseBeforeHigh,1=30
        PauseBeforeHigh,2=0
        PauseBeforeHigh,3=0
        PauseAfterHigh=30
        PauseAfterHigh,F=0
        PauseAfterHigh,1=30
        PauseAfterHigh,2=0
        PauseAfterHigh,3=0
        HighNewsColor=17919
        DetectNFP=1
        DetectNFP,F=0
        DetectNFP,1=0
        DetectNFP,2=1
        DetectNFP,3=1
        PauseBeforeNFP=45
        PauseBeforeNFP,F=0
        PauseBeforeNFP,1=45
        PauseBeforeNFP,2=0
        PauseBeforeNFP,3=0
        PauseAfterNFP=45
        PauseAfterNFP,F=0
        PauseAfterNFP,1=45
        PauseAfterNFP,2=0
        PauseAfterNFP,3=0
        NFPNewsColor=9639167
        ServerGMT=2
        ServerGMT,F=0
        ServerGMT,1=2
        ServerGMT,2=0
        ServerGMT,3=0
        str4=******* Time filter *******
        MondayStartHour=6
        MondayStartHour,F=0
        MondayStartHour,1=6
        MondayStartHour,2=0
        MondayStartHour,3=0
        MondayStartMinute=15
        MondayStartMinute,F=0
        MondayStartMinute,1=15
        MondayStartMinute,2=0
        MondayStartMinute,3=0
        StartHour=6
        StartHour,F=0
        StartHour,1=6
        StartHour,2=0
        StartHour,3=0
        StartMinute=15
        StartMinute,F=0
        StartMinute,1=15
        StartMinute,2=0
        StartMinute,3=0
        StopHour=21
        StopHour,F=0
        StopHour,1=21
        StopHour,2=0
        StopHour,3=0
        StopMinute=45
        StopMinute,F=0
        StopMinute,1=45
        StopMinute,2=0
        StopMinute,3=0
        FridayStopHour=11
        FridayStopHour,F=0
        FridayStopHour,1=11
        FridayStopHour,2=0
        FridayStopHour,3=0
        FridayStopMinute=45
        FridayStopMinute,F=0
        FridayStopMinute,1=45
        FridayStopMinute,2=0
        FridayStopMinute,3=0
        str5=******* Days filter *******
        TradeMonday=1
        TradeMonday,F=0
        TradeMonday,1=0
        TradeMonday,2=1
        TradeMonday,3=1
        TradeTuesday=1
        TradeTuesday,F=0
        TradeTuesday,1=0
        TradeTuesday,2=1
        TradeTuesday,3=1
        TradeWednesday=1
        TradeWednesday,F=0
        TradeWednesday,1=0
        TradeWednesday,2=1
        TradeWednesday,3=1
        TradeThursday=1
        TradeThursday,F=0
        TradeThursday,1=0
        TradeThursday,2=1
        TradeThursday,3=1
        TradeFriday=1
        TradeFriday,F=0
        TradeFriday,1=0
        TradeFriday,2=1
        TradeFriday,3=1
        str6=******* Other setting *******
        MaxOrderCount=10
        MaxOrderCount,F=0
        MaxOrderCount,1=10
        MaxOrderCount,2=0
        MaxOrderCount,3=0
        MaxDDControl=0
        MaxDDControl,F=0
        MaxDDControl,1=0
        MaxDDControl,2=0
        MaxDDControl,3=0
        ShowInfoPanel=1
        ShowInfoPanel,F=0
        ShowInfoPanel,1=0
        ShowInfoPanel,2=1
        ShowInfoPanel,3=1
        TradeComment=DIAMOND EUR
        Magic=77777
        Magic,F=0
        Magic,1=77777
        Magic,2=0
        Magic,3=0
        `;
        console.log("session:",req.session);
        console.log("messageHistory", req.session.messageHistory);
        req.session.messageHistory = [];
        addMessage(req.session.messageHistory,"system","You are an expert, profitable day trader analyst for the forex markets who has done both risk aggressive and conservative strategies. You give insights, analysis and recommendations based on my risk profile. Give me the strategy being used in the above trading history document. Specifically, try to give me an improved strategy based on my previous trades that can increase my returns but outweighs the additional risk involved.");
        addMessage(req.session.messageHistory,'user','Modify the given config file in the following format. Give your answer within <step> flags');
        addMessage(req.session.messageHistory,'user', step_file);
        req.session.save(err => {
            if (err) {
                console.error('Session save error:', err);
            }
        });

        // Generate output from ChatGPT
        const chatGptResponse = await openai.chat.completions.create({
            messages: req.session.messageHistory,
            model: model
        });
        console.log("------------------------------chatGptResponse:----------------------------------",chatGptResponse);
        // Get the response text
        const responseText = chatGptResponse.choices[0].message.content;

        // Create a .step file content
        const stepFileContent = `${responseText}`;

        // Generate a random filename (or handle naming differently)
        const filename = `ChatGPT_Response_${Date.now()}.step`;

        // Write the content to a file
        fs.writeFileSync(filename, stepFileContent);

        // Send the file to the client
        res.download(filename, (err) => {
            if (err) {
                console.error(err);
                res.status(500).send("Error downloading the file.");
            }

            // Optionally delete the file after sending it
            fs.unlinkSync(filename);
        });

    } catch (error) {
        console.error('Error processing ChatGPT request:', error);
        res.status(500).json({ error: 'Error processing ChatGPT request' });
    }
});

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
