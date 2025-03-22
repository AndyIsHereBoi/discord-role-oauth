const { request, fetch } = require('undici');
const express = require('express');
const config = require('./config.json');
const { error } = require('console');
const { uuid: uuidv4 } = require("uuidv4");

const app = express();

var database = {
    "codes": [
        { "code": "RANDOM_CODE", "authorizedToken": "AUTHORIZED_TOKEN" }
    ],
    "authorizedTokens": [
        { "token": "AUTHORIZED_TOKEN", "email": "TEST_EMAIL@andyishereboi.com", "username": "USERNAME_HERE" }
    ]
}


app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${JSON.stringify(req.query)}`);
    next();
});


app.get("/redirectdiscord", async (req, res) => {
    // WIKIJS REIDRECTS HERE, THEN THIS REDIRECTS TO DISCORD

    res.redirect(config.discordOauthUrl)
});



app.post("/codetotoken", async (req, res) => {
    console.log("req.headers.authorization", req.headers)
    console.log("req.headers.query", req.query)
    const codeToFind = req.query.code || req.headers.authorization;

    if (!codeToFind) {
        return res.status(400).json({ error: "Code parameter is missing" });
    };

    const foundCodeObject = database.codes.find(item => item.code === codeToFind);

    if (foundCodeObject) {
        return res.json({
            "token": foundCodeObject.authorizedToken
        });
    } else {
        return res.status(404).json({ error: "Code not found" });
    };
});

app.get("/getuserinfo", async (req, res) => {
    // WIKIJS EXCHANGING TOKEN FOR USER INFO

    const tokenToFind = req.query.access_token;

    if (!tokenToFind) {
        return res.status(400).json({ error: "Token parameter is missing" });
    };

    const foundTokenObject = database.authorizedTokens.find(item => item.token === tokenToFind);

    
    if (foundTokenObject) {
        return res.json({
            "email": foundTokenObject.email,
            "username": foundTokenObject.username,
            "token" : foundTokenObject.token
        });
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
					scope: 'identify guilds.members.read',
                }),
            });

            if(!discordTokenRequest.ok) { throw error("discordTokenRequest NOT OK"); };

            const discordTokenRequestJSON = await discordTokenRequest.json()
            console.log("discordTokenRequestJSON", discordTokenRequestJSON)

            if(!discordTokenRequestJSON.ok) { throw error("discordTokenRequestJSON NOT OK"); };

			const guildMemberRequest = await fetch(`https://discord.com/api/v10/users/@me/guilds/${config.checkInGuildId}/member`, {
                method: 'GET',
                headers: {
                    'Authorization': `${discordTokenRequestJSON.token_type} ${discordTokenRequestJSON.access_token}`
                },
            });

            if(!guildMemberRequest.ok) { throw error("guildMemberRequest NOT OK"); };

			const guildMemberJSON = await guildMemberRequest.json();

            if(!guildMemberJSON.ok) { throw error("guildMemberJSON NOT OK"); };
            
            const hasDiscordRequiredId = guildMemberJSON.roles.includes(config.checkForRoleId);
            console.log("hasDiscordRequiredId", hasDiscordRequiredId);


            // USER PASSED ALL CHECKS
            if(hasDiscordRequiredId) {


                // START DATABASE CODE

                const randomCode = uuid();
                const authorizedToken = uuid();
                database.codes.push({ "code": randomCode, "authorizedToken": authorizedToken });
                database.authorizedTokens.push({ "token": authorizedToken, "email": "TEST_EMAIL@andyishereboi.com", "username": "USERNAME_HERE" })

                // END DATABASE CODE


                return res.redirect(`https://mcd.andyishereboi.com/login/437a0008-0bd3-410a-b58a-c7bab95f9c9f/callback?code=${randomCode}`);
            } else {
                // USER FAILED CHECKS
                return res.json({
                    "error": "You are not authorized to log in."
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



app.listen(config.port, () => console.log(`App listening at http://localhost:${config.port}`));