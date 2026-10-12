const { fetch } = require('undici');
const express = require('express');
const config = require('./config.json');
const { uuid: uuidv4 } = require("uuidv4");

const app = express();
app.use(express.urlencoded({ extended: true }));

// ---- Everything configurable is resolved once, when the server starts ----
// No domains or URLs should be hardcoded below; they all come from config.json.
const discordApiBaseUrl = String(config.discordApiBaseUrl || "").replace(/\/+$/, "");
const redirectUri = config.redirect_uri || `${config.host}/authorize`;
const wikiJsRedirectUrl = config.wikiJsRedirectUrl || `${config.host}/callback`;
const discordOauthUrl = config.discordOauthUrl;

if (!discordApiBaseUrl) console.warn("[config] discordApiBaseUrl is not set");
if (!config.clientId || !config.clientSecret) console.warn("[config] clientId / clientSecret are not set");
if (!discordOauthUrl) console.warn("[config] discordOauthUrl is not set - /redirectdiscord will not work");

console.log(`[config] redirect URI: ${redirectUri}`);
console.log(`[config] Wiki.js redirect URL: ${wikiJsRedirectUrl}`);
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
        // Return a standard OAuth2 token response - clients require `token_type`.
        return res.json({
            "access_token": foundCodeObject.authorizedToken,
            "token_type": "Bearer",
            "expires_in": 3600
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
            const discordTokenRequest = await fetch(`${discordApiBaseUrl}/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
					client_id: config.clientId,
					client_secret: config.clientSecret,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: redirectUri,
					scope: 'identify guilds.members.read',
                }),
            });

            if(!discordTokenRequest.ok) { throw new Error("discordTokenRequest NOT OK"); };

            const discordTokenRequestJSON = await discordTokenRequest.json();

			const guildMemberRequest = await fetch(`${discordApiBaseUrl}/users/@me/guilds/${config.checkInGuildId}/member`, {
                method: 'GET',
                headers: {
                    'Authorization': `${discordTokenRequestJSON.token_type} ${discordTokenRequestJSON.access_token}`
                },
            });

            if(!guildMemberRequest.ok) { throw new Error("guildMemberRequest NOT OK"); };

			const guildMemberJSON = await guildMemberRequest.json();
            
            const hasDiscordRequiredId = guildMemberJSON.roles.includes(config.checkForRoleId);
            console.log("hasDiscordRequiredId", hasDiscordRequiredId);


            // USER PASSED ALL CHECKS
            if(hasDiscordRequiredId) {

                // const userEmailRequest = await fetch(`https://discord.com/api/v10/users/@me`, {
                //     method: 'GET',
                //     headers: {
                //         'Authorization': `${discordTokenRequestJSON.token_type} ${discordTokenRequestJSON.access_token}`
                //     },
                // });
                // if(!userEmailRequest.ok) { throw error("userEmailRequest NOT OK"); };
                // const userEmailRequestJSON = await userEmailRequest.json();
                // const userEmail = userEmailRequestJSON.email;
                // const username = userEmailRequestJSON.username;
                // const userId = userEmailRequestJSON.id;
                // if(!userEmail) { return res.json({ "error": "You must authorize email" })};
    

                // START DATABASE CODE

                const randomCode = uuidv4();
                const authorizedToken = uuidv4();
                database.codes.push({
                    "code": randomCode,
                    "authorizedToken": authorizedToken
                });
                database.authorizedTokens.push({
                    "token": authorizedToken, 
                    "email": `${guildMemberJSON.user.id}@discordid.com`,
                    "username": `${guildMemberJSON.user.username}`,
                    "userId": `${guildMemberJSON.user.id}`
                });

                // END DATABASE CODE
                console.log("database after update", database);

                // Send the client's `state` back to it along with the code (OAuth requires a state round-trip).
                const callbackUrl = new URL(wikiJsRedirectUrl);
                callbackUrl.searchParams.set("code", randomCode);
                if (req.query.state) {
                    callbackUrl.searchParams.set("state", String(req.query.state));
                }
                return res.redirect(callbackUrl.toString());
            } else {
                // USER FAILED CHECKS
                console.log("User NOT allowed to login. username:", guildMemberJSON.user.username);
                return res.json({
                    "error": "You are not authorized to log in. (discordroleauth)"
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






// CLIENT REDIRECTS HERE, THEN THIS REDIRECTS TO DISCORD
app.get("/redirectdiscord", async (req, res) => {

    // Forward the client's OAuth `state` to Discord; Discord echoes it back to /authorize.
    let authorizeUrl;
    try {
        authorizeUrl = new URL(discordOauthUrl);
    } catch {
        return res.redirect(discordOauthUrl);
    }
    if (req.query.state) {
        authorizeUrl.searchParams.set("state", String(req.query.state));
    }

    res.redirect(authorizeUrl.toString());
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
        console.log("Token found in query")
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
            "userId": foundTokenObject.userId
        });
    };

    return res.status(404).json({ error: "Token not found" });
});




app.listen(config.port, () => console.log(`App listening at ${config.host}:${config.port}`));