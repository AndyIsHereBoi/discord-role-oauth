const { request, fetch } = require('undici');
const express = require('express');
const config = require('./config.json');

const app = express();

app.get('/authorize', async (req, res) => {
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

            const discordTokenRequestJSON = await discordTokenRequest.json()
            console.log("discordTokenRequestJSON", discordTokenRequestJSON)

			const guildMemberRequest = await fetch(`https://discord.com/api/v10/users/@me/guilds/${config.checkInGuildId}/member`, {
                method: 'GET',
                headers: {
                    'Authorization': `${discordTokenRequestJSON.token_type} ${discordTokenRequestJSON.access_token}`
                },
            });

			const guildMemberJSON = await guildMemberRequest.json();
            const hasDiscordRequiredId = guildMemberJSON.roles.includes(config.checkForRoleId);
            console.log("hasDiscordRequiredId", hasDiscordRequiredId);
            if(hasDiscordRequiredId) {
                res.redirect("https://mcd.andyishereboi.com");
            };
            
		} catch (error) {
			// NOTE: An unauthorized token will not throw an error
			console.error(error);
            return res.sendFile('index.html', { root: '.' });
		};
	};

});



app.listen(config.port, () => console.log(`App listening at http://localhost:${config.port}`));