import {get_encoding, encoding_for_model} from 'tiktoken';

class TokenCounter{

    constructor(){
        this.enc = get_encoding('cl100k_base');
        this.response_min_tokens = parseInt(process.env.RESPONSE_MIN_TOKENS);
    }
    
    encode(str){
        return this.enc.encode(str);
    }

    countFromUserMessages(userMessages){
        console.log("entering countFromUserMessages...");
        const analysis = [];
        const initialValue = 0;
        const result = userMessages.reduce((accumulator,currentValue) => {
            console.log({currentValue});
            console.log({accumulator});
            //use OpenAI-provided token count if available, otherwise use tiktoken
            let messageTokenCount;
            if(currentValue.token_count){
                messageTokenCount = currentValue.token_count;
            } 
            else{
                if(currentValue.content){
                    messageTokenCount = this.enc.encode(currentValue.content).length;
                }
                else{
                    messageTokenCount = 0;
                }
            }
            return accumulator + messageTokenCount;
        },initialValue);
        console.log("reduce result:",result);
        return result;
    }

    totalTokensExceedsMaxTokens(tokenCount_remaining){
        //predict the total (prompt + response) tokens that OpenAI will calculate, using
        //the RESPONSE_MIN_TOKENS to give a conservative estimate of the response tokens
        //RESPONSE_MIN_TOKENS should be set based on the response length specified in the initial system prompts
        console.log({tokenCount_remaining},this.response_min_tokens);
        const projectedTotalTokens = tokenCount_remaining + this.response_min_tokens;
        return projectedTotalTokens > process.env.OPENAI_MAX_TOKENS;
    }

    noResponseTokensAvailable(response_max_tokens){
        return response_max_tokens <= 0;
    }
    //if the call's current token count is > OPENAI_MAX_TOKENS,
    //find how many messages need to be deleted from the beginning of userMessages
    //to lower the token count below the maximum
    //we use tokensFromPersonality to account for tokens used up by prepending the
    //personality messages
    //todo: get token count from OpenAI, track cumulative tokens vs incremental tokens,
    //todo: use them here
    findDeletionCutoff(userMessages,tokensFromPersonality = 0){
        let tokenCount_remaining = this.countFromUserMessages(userMessages)+tokensFromPersonality;
        let response_max_tokens = (process.env.OPENAI_MAX_TOKENS - tokenCount_remaining);
        console.log({tokensFromPersonality},{tokenCount_remaining});
        let index = 0;
        //iterate through message array while (the remaining token count is greater than model's max)
        //or (our available response tokens are < 0) and we haven't reached the end of the array
        //note that we add RESPONSE_MIN_TOKENS because we want to only exit this loop once
        //we've discarded enough messages to free up enough tokens for a standard full-length answer
        while ((this.totalTokensExceedsMaxTokens(tokenCount_remaining) || this.noResponseTokensAvailable(response_max_tokens)) && index < userMessages.length) {
            let tokenCount_message;
            //check if we have an OpenAI-provided token count for this message
            if (userMessages[index].token_count){
                //if it exists, use this count to calculate whether to advance our cutoff index
                tokenCount_message = userMessages[index].token_count;
            }
            else{
                //if not, estimate using tiktoken
                tokenCount_message = this.encode(userMessages[index].content).length;
            }
            console.log("tokenCount_remaining:",{tokenCount_remaining});
            console.log(`token count for message ${index}`,{tokenCount_message});
            tokenCount_remaining -= tokenCount_message;
            response_max_tokens = (process.env.OPENAI_MAX_TOKENS - tokenCount_remaining);
            console.log("tokenCount_remaining after deletion:",{tokenCount_remaining});
            console.log("response_max_tokens after deletion:",{response_max_tokens});
            index++;
        }
        
        //did we find an index of the array at which we were able to delete enough
        //tokens to fall below the maximum?
        if (index < userMessages.length){
            //yes: return this index, we will only send messages from this index forward
            //and we will also provide the maximum response length
            //so that OpenAI won't inadvertently return a response
            //in which prompt_tokens + response_tokens > OPENAI_max_tokens
            //const response_max_tokens = (process.env.OPENAI_MAX_TOKENS - tokenCount_remaining) - tokensFromPersonality;
            return {
                index:index,
                response_max_tokens:response_max_tokens
            }
        }
        else{
            //no: we can't use deletion
            return {
                index:-1,
                response_max_tokens:null
            }
        }
    }
}

export default TokenCounter;