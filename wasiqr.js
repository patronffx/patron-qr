const {makeid} = require('./id');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');
let router = express.Router()
const pino = require("pino");
const {
	default: Wasi_Tech,
	useMultiFileAuthState,
	jidNormalizedUser,
	Browsers,
	delay,
	makeInMemoryStore,
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
	if (!fs.existsSync(FilePath)) return false;
	fs.rmSync(FilePath, {
		recursive: true,
		force: true
	})
};
const {
	readFile
} = require("node:fs/promises")

// Add GitHub Gist upload function
async function createGist(content, filename = 'session.json') {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not set in environment variables.');
    const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'session-uploader'
        },
        body: JSON.stringify({
            description: 'WASI-MD Session',
            public: false,
            files: {
                [filename]: { content }
            }
        })
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error('GitHub Gist upload failed: ' + response.status + ' ' + errText);
    }
    const data = await response.json();
    if (!data.html_url) throw new Error('GitHub did not return a gist url');
    return data.html_url;
}

router.get('/', async (req, res) => {
	const id = makeid();
	async function WASI_MD_QR_CODE() {
		const {
			state,
			saveCreds
		} = await useMultiFileAuthState('./temp/' + id)
		try {
			let Qr_Code_By_Wasi_Tech = Wasi_Tech({
				auth: state,
				printQRInTerminal: false,
				logger: pino({
					level: "silent"
				}),
				browser: Browsers.macOS("Desktop"),
			});

			Qr_Code_By_Wasi_Tech.ev.on('creds.update', saveCreds)
			Qr_Code_By_Wasi_Tech.ev.on("connection.update", async (s) => {
				const {
					connection,
					lastDisconnect,
					qr
				} = s;
				if (qr) {
					console.log('[DEBUG] QR code generated, sending to client...');
					await res.end(await QRCode.toBuffer(qr));
				}
				if (connection == "open") {
					console.log('[DEBUG] Connection open, preparing session...');
					await delay(5000);
					let data = fs.readFileSync(__dirname + `/temp/${id}/creds.json`);
					await delay(800);
					let b64data = Buffer.from(data).toString('base64');
					console.log('[DEBUG] Session creds read and encoded.');
					// Upload to GitHub Gist
					let gistUrl = '';
					try {
						console.log('[DEBUG] Attempting to upload session to GitHub Gist...');
						gistUrl = await createGist(b64data, 'session.json');
						if (gistUrl && gistUrl.includes('/')) {
							gistUrl = 'PATRON-MD~' + gistUrl.split('/').pop();
							console.log('[DEBUG] Gist uploaded successfully:', gistUrl);
						}
					} catch (e) {
						gistUrl = 'Failed to upload session to Gist: ' + e.message;
						console.error('[ERROR] Gist upload failed:', e);
					}
					let session = await Qr_Code_By_Wasi_Tech.sendMessage(Qr_Code_By_Wasi_Tech.user.id, { text: gistUrl });
					console.log('[DEBUG] Sent session link to WhatsApp user.');

					let WASI_MD_TEXT = `
*_Session Connected By Wasi Tech_*
*_Made With 🤍_*
______________________________________
╔════◇
║ *『AMAZING YOU'VE CHOSEN WASI MD』*
║ _You Have Completed the First Step to Deploy a Whatsapp Bot._
╚════════════════════════╝
╔═════◇
║  『••• 𝗩𝗶𝘀𝗶𝘁 𝗙𝗼𝗿 𝗛𝗲𝗹𝗽 •••』
║❒ *Ytube:* _youtube.com/@wasitech1
║❒ *Owner:* _https://wa.me/message/THZ3I25BYZM2E1_
║❒ *Repo:* _https://github.com/wasixd/WASI-MD_
║❒ *WaGroup:* _https://chat.whatsapp.com/FF6YuOZTAVB6Lu65cnY5BN_
║❒ *WaChannel:* _https://whatsapp.com/channel/0029VaDK8ZUDjiOhwFS1cP2j_
║❒ *Plugins:* _https://github.com/Itxxwasi 
╚════════════════════════╝
_____________________________________

_Don't Forget To Give Star To My Repo_`
					await Qr_Code_By_Wasi_Tech.sendMessage(Qr_Code_By_Wasi_Tech.user.id, { text: WASI_MD_TEXT }, { quoted: session })
					console.log('[DEBUG] Sent info message to WhatsApp user.');

					await delay(100);
					await Qr_Code_By_Wasi_Tech.ws.close();
					console.log('[DEBUG] Closed WhatsApp socket and cleaning up.');
					return await removeFile("temp/" + id);
				} else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
					console.log('[DEBUG] Connection closed unexpectedly, retrying...');
					await delay(10000);
					WASI_MD_QR_CODE();
				}
			});
		} catch (err) {
			if (!res.headersSent) {
				await res.json({
					code: "Service is Currently Unavailable"
				});
			}
			console.error('[ERROR] An error occurred:', err);
			await removeFile("temp/" + id);
		}
	}
	return await WASI_MD_QR_CODE()
});
module.exports = router
