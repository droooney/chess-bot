import LichessBot from './LichessBot';

new LichessBot(process.env.TOKEN || '', process.env.NAME || '', process.env.NODE_ENV === 'production');
