const log4js = require('log4js');
log4js.configure({
  appenders: {
    hash: { type: 'file', filename: './logs/hash',     pattern: '-yyyy-MM-dd-hh-mm.log', // 每分钟创建一个新文件
      alwaysIncludePattern: true,},
    tx: { type: 'file', filename: './logs/tx',     pattern: '-yyyy-MM-dd-hh-mm.log', // 每分钟创建一个新文件
      alwaysIncludePattern: true, },
    console: { type: 'console' },
  },
  categories: {
    hash: { appenders: ['hash', 'console'], level: 'debug' },
    tx: { appenders: ['tx', 'console'], level: 'debug' },
    default: { appenders: ['console'], level: 'debug' },
  },
});

const hashLogger = log4js.getLogger('hash');
const txLogger = log4js.getLogger('tx');

module.exports = {
  hashLogger: hashLogger,
  txLogger: txLogger,
}