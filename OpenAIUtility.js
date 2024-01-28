//include methods addMessage_user() and addMessage_chatGPT()

import {OpenAI} from 'openai';
import TokenCounter from './TokenCounter.js';


class OpenAIUtility {
    constructor() {
        this.openai = new OpenAI({
            apiKey:process.env.OPENAI_API_KEY
        });
        this.tokenCounter = new TokenCounter();
        this.model = 'gpt-3.5-turbo';
    }

    
    async chatGPTGenerate_personalityTokenCheck(personalityMessages){
        try{
            const completion = await this.openai.chat.completions.create({
                messages: personalityMessages,
                model: this.model
            });
            return completion.usage.prompt_tokens;
        }
        catch(exception){
            throw exception;
        }
    }

    //to ensure that the response is complete and that we haven't generated a
    //response that exceeded maxTokens and was therefore truncated to an incomplete response
    async generateCompleteResponse(messages, maxTokens) {
        return new Promise(async (resolve, reject) => {
            //lengthExceeded:
            //0: initial state, length not yet exceeded
            //1: finish_reason = "length", need to add system message limiting response tokens
            //2: system message added
            //this way, we will only add the system message once
            //todo: this is a workaround and we should probably refactor lengthExceeded into a LengthChecker class
            //todo: with states ['NOT_EXCEEDED','EXCEEDED_NEEDS_MESSAGE','EXCEEDED_MESSAGE_SET'] instead of numbers 0,1,2
            let lengthExceeded = 0;
            let maxTokensFromOpenAI;
            try {
                let response;
                if (lengthExceeded === 1){
                    messages.push({
                        role:'system',
                        content:`Limit your response to fewer than ${maxTokensFromOpenAI} completion_tokens.`
                    })
                    lengthExceeded = 2;
                }
                do {
                    response = await this.openai.chat.completions.create({
                        messages: messages,
                        model: this.model,
                        max_tokens: maxTokens
                    });
                    const finish_reason = response.choices[0].finish_reason;
                    console.log({ finish_reason });
    
                    // If the finish reason is 'length', it means the response may be incomplete, so continue.
                    // Otherwise, if it's a valid completion or stop, resolve the promise.
                    if (finish_reason !== 'length') {
                        resolve(response);
                        return; // Exit the function after resolving to avoid further execution.
                    }
                    else{
                        if (lengthExceeded === 0){
                            lengthExceeded = 1;
                        }
                        maxTokensFromOpenAI = response.usage.completion_tokens;
                        //log response so we can examine the actual number of completion tokens,
                        //which we will then feed back into the system message for limiting tokens
                        console.log({response});
                    }
    
                    // Additional logic can be added here to handle specific cases or break after a certain number of tries.
    
                } while (true); // The loop now only continues if the finish reason is 'length'.
            } catch (error) {
                // If there is an error, reject the promise.
                reject(error);
            }
        });
    }
    

    async chatGPTCreate(messages, maxTokens) {
        const maxRetries = 3;
        let retries = 0;
        let timeout = process.env.OPENAI_TIMEOUT_BASE;
        while (retries < maxRetries) {
            try {
                const completionPromise = this.generateCompleteResponse(messages, maxTokens);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timed out')), timeout)
                );
                const completion = await Promise.race([completionPromise, timeoutPromise]);
                return completion;
            } catch (error) {
                if (error.message === 'Request timed out') {
                    // Retry if the request timed out
                    retries++;
                    console.log(`Retry attempt ${retries} after timeout.`);
                    timeout *= 2; //exponential backoff
                } else {
                    // If it's not a timeout issue, propagate the error
                    throw error;
                }
            }
        }
    
        // If all retries fail, throw an error or handle it as needed
        throw new Error(`Failed after ${maxRetries} retries.`);
    }

    //todo: need to break this up into sub-functions, it's doing way too much
    async chatGPTGenerate(call,personality) {
        try{
            const userMessages = call.userMessages;
            const tokensFromPersonality = personality.tokenCount_OpenAI;
            const deletionCutoff = this.tokenCounter.findDeletionCutoff(userMessages,tokensFromPersonality);
            console.log({deletionCutoff});
            const startIndex = deletionCutoff.index;
            const messages = personality.messages.slice();
            //start from the index where we will have enough tokens to submit the message
            if (startIndex >= 0){
                for (let index=startIndex;index<userMessages.length;index++){
                    const message = userMessages[index];
                    //OpenAI requires that messages only have `role` and `content` properties
                    //check for blank content as that can cause an error
                    if(message.content){
                        messages.push({
                            role:message.role,
                            content:message.content
                        });
                    }
                }
            }
            else{
                //we can't get below token count by omitting messages,
                //so don't submit to chatGPT to avoid token-limit-exceeded error,
                //instead return response alerting user that max has been reached
                //and they can call back to start with refreshed memory.
                return personality.response_out_of_memory;
            }
            /*
            userMessages.forEach(message => {
                messages.push(message);
            });
            */
            console.log("Now submitting prompt to OpenAI...");
            const completion = await this.chatGPTCreate(messages,deletionCutoff.response_max_tokens);
            console.log(`and the response has returned from OpenAI`);
            const prompt_tokens = completion.usage.prompt_tokens;
            const completion_tokens = completion.usage.completion_tokens;
            const response = completion.choices[0].message.content;
            console.log({prompt_tokens},{response},{completion_tokens});
            return {
                prompt_tokens:prompt_tokens,
                response:response,
                completion_tokens:completion_tokens
            };
        }
        catch(error){
            console.log(error);
            return error;
        }
    }
}

export default OpenAIUtility;