import { loadConfig } from '@bot-momo/config';
import { createAppStatus } from './app.js';

const config = loadConfig();
const status = createAppStatus(config);

console.log(JSON.stringify(status));
