require('dotenv').config();

const line = require('@line/bot-sdk');
const express = require('express');
const fetch = require('node-fetch');

const userAgentObj = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
}

function getToken() {
  console.log("getToken()開始.....");
  // 591首頁
  const url = "https://rent.591.com.tw/"
  return fetch(url, {
    "credentials": "include", // 使用cookie
    "headers": userAgentObj,
    "json": true
  })
  .then(function(response) {
    const setCookie = response.headers.get('set-cookie');

    // =================================================
    // 從cookie中取得`591_new_session`這個值，後續要用到
    const newSession = setCookie.split("; ").filter((str)=>{
        return (str.indexOf("591_new_session") != -1)
    })[0];

    // newSession -> `domain=.591.com.tw, 591_new_session=xxx`
    const cookie = newSession.split(", ")[1]
    // =================================================
    // =================================================
    // 從cookie中取得`PHPSESSID`這個值，後續要用到
    const phpSessid = setCookie.split("; ").filter((str)=>{
        return (str.indexOf("PHPSESSID") != -1)
    })[0];

    // phpSessid -> `Path=/, PHPSESSID=3vkgnn6g36tneok220vbb046pj`
    const phpSid = phpSessid.split(", ")[1].split("=")[1]
    // =================================================

    return {
      "responseText": response.text(),
      "headerCookie": cookie,
      "phpSid": phpSid
    }
  })
  .then(function(responseObj) {
    // 取token
    const regex = /<meta name="csrf-token" content="([^"]*)">/;
    const match = regex.exec(responseObj.responseText);
    const token = match[1];
    console.log("getToken()完成");
    console.log(`token = ${token}`);
    console.log(`headerCookie = ${responseObj.headerCookie}`);
    console.log(`phpSid = ${responseObj.phpSid}`);

    return {
      "token": token,
      "headerCookie": responseObj.headerCookie,
      "phpSid": responseObj.phpSid
    }
  })
}




// create LINE SDK config from env variables
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// create LINE SDK client
const client = new line.Client(config);

// create Express app
// about Express itself: https://expressjs.com/
const app = express();

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post('/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// event handler
function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  // create a echoing text message
  const userText = event.message.text
  if (userText == "go") {
    getToken()
      .then(apiResponse => {
        const replyMessage = {
          type: 'text',
          text: `API response: ${JSON.stringify(apiResponse)}`,
        };

        return client.replyMessage(event.replyToken, replyMessage);
      })
      .catch(error => {
        console.error('API error:', error);
        // 可以在呼叫 API 錯誤時回傳錯誤訊息給使用者
        const errorMessage = {
          type: 'text',
          text: 'An error occurred while calling the API.',
        };

        return client.replyMessage(event.replyToken, errorMessage);
      });
  } else {
    const echo = { type: 'text', text: `Yo bro, 你剛剛說：${userText}` };
    // use reply API
    return client.replyMessage(event.replyToken, echo);
  }
}


// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
