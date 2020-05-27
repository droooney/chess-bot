import * as dotenv from 'dotenv';

import LichessBot from './LichessBot';

dotenv.config();

new LichessBot(process.env.TOKEN || '', process.env.NAME || '', process.env.NODE_ENV === 'production');
