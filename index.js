const { request, fetch } = require('undici');
const express = require('express');
const config = require('./config.json');
const { error } = require('console');
const { uuid: uuidv4 } = require("uuidv4");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${JSON.stringify(req.query)}`);
    next();
});

var database = {
    "codes": [
        { "code": "RANDOM_CODE", "authorizedToken": "AUTHORIZED_TOKEN" }
    ],
    "authorizedTokens": [
        { "token": "AUTHORIZED_TOKEN", "email": "TEST_EMAIL@andyishereboi.com", "displayName": "USERNAME_HERE" }
    ]
};




app.post("/codetotoken", async (req, res) => {
    // requres form url encoded thing
    const codeToFind = req.query.code || req.headers.authorization || req.body.code;

    if (!codeToFind) {
        return res.status(400).json({ error: "Code parameter is missing" });
    };

    const foundCodeObject = database.codes.find(item => item.code === codeToFind);

    if (foundCodeObject) {
        return res.json({
            "access_token": foundCodeObject.authorizedToken
        });
    } else {
        return res.status(404).json({ error: "Code not found" });
    };
});

app.get('/authorize', async (req, res) => {
    // THIS IS COMING BACK FROM DISCORD, THEN RETURNS TOKEN TO WIKIJS

	const code = req.query.code;

	if (code) {
        console.log("code", code)
		try {
            const discordTokenRequest = await fetch('https://discord.com/api/v10/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
					client_id: config.clientId,
					client_secret: config.clientSecret,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: config.redirect_uri,
					scope: 'identify email guilds.members.read',
                }),
            });

            if(!discordTokenRequest.ok) { throw error("discordTokenRequest NOT OK"); };

            const discordTokenRequestJSON = await discordTokenRequest.json()
            console.log("discordTokenRequestJSON", discordTokenRequestJSON)

			const guildMemberRequest = await fetch(`https://discord.com/api/v10/users/@me/guilds/${config.checkInGuildId}/member`, {
                method: 'GET',
                headers: {
                    'Authorization': `${discordTokenRequestJSON.token_type} ${discordTokenRequestJSON.access_token}`
                },
            });

            if(!guildMemberRequest.ok) { throw error("guildMemberRequest NOT OK"); };

			const guildMemberJSON = await guildMemberRequest.json();

            console.log("guildMemberJSON", guildMemberJSON)
            
            const hasDiscordRequiredId = guildMemberJSON.roles.includes(config.checkForRoleId);
            console.log("hasDiscordRequiredId", hasDiscordRequiredId);


            // USER PASSED ALL CHECKS
            if(hasDiscordRequiredId) {

                const userEmailRequest = await fetch(`https://discord.com/api/v10/users/@me`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `${discordTokenRequestJSON.token_type} ${discordTokenRequestJSON.access_token}`
                    },
                });
                if(!userEmailRequest.ok) { throw error("userEmailRequest NOT OK"); };
                const userEmailRequestJSON = userEmailRequest.json;
                console.log("userEmailRequestJSON", userEmailRequestJSON)
                const userEmail = userEmailRequestJSON.email;
                const username = userEmailRequestJSON.username;
                if(!userEmail) { return res.json({ "error": "You must authorize email" })};
    

                // START DATABASE CODE

                const randomCode = uuidv4();
                const authorizedToken = uuidv4();
                database.codes.push({ "code": randomCode, "authorizedToken": authorizedToken });
                database.authorizedTokens.push({ "token": authorizedToken, "email": userEmail, "username": username });

                // END DATABASE CODE
                console.log("database after update", database);

                console.log("User allowed to login")
                return res.redirect(`https://mcd.andyishereboi.com/login/437a0008-0bd3-410a-b58a-c7bab95f9c9f/callback?code=${randomCode}`);
            } else {
                // USER FAILED CHECKS
                console.log("User NOT allowed to login");
                return res.json({
                    "error": "You are not authorized to log in. (mcdauth)"
                });
            };
		} catch (error) {
			// NOTE: An unauthorized token will not throw an error
			console.error(error);
            return res.json({
                "error": "error during authorization ping @andyishereboi in the discord"
            });
		};
	};
    return res.sendFile('index.html', { root: '.' });
});






// WIKIJS REIDRECTS HERE, THEN THIS REDIRECTS TO DISCORD
app.get("/redirectdiscord", async (req, res) => {

    res.redirect(config.discordOauthUrl)
});


// WIKIJS EXCHANGING TOKEN FOR USER INFO
app.get("/getuserinfo", async (req, res) => {

    var tokenToFind;
    if(req.headers.authorization) {
        tokenToFind = req.headers.authorization.replace("Bearer ", "").replace("bearer ", ""); // replace Bearer away so its just token
        console.log("Token found in authorization")
    };
    if(!tokenToFind) {
        tokenToFind = req.query.access_token;
    };

    console.log("tokenToFind", tokenToFind)

    if (!tokenToFind) {
        return res.status(400).json({ error: "Token parameter is missing" });
    };

    const foundTokenObject = database.authorizedTokens.find(item => item.token === tokenToFind);

    
    if (foundTokenObject) {
        return res.json({
            "email": foundTokenObject.email,
            "displayName": foundTokenObject.username,
            "token" : foundTokenObject.token
        });
    };
});




app.listen(config.port, () => console.log(`App listening at http://localhost:${config.port}`));