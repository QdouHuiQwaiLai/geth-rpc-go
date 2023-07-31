import log4js from 'log4js'

log4js.configure({
  appenders: {
    hash: { type: 'file', filename: './logs/hash',     pattern: '-yyyy-MM-dd-hh-mm.log', // 每分钟创建一个新文件
      alwaysIncludePattern: true,},
    tx: { type: 'file', filename: './logs/tx',
      // pattern: '-yyyy-MM-dd-hh-mm.log', // 每分钟创建一个新文件
      pattern: '-yyyy-MM-dd.log',
      alwaysIncludePattern: true, },
    err: {type: 'file', filename: './logs/err.log'},
    console: { type: 'console' },
  },
  categories: {
    hash: { appenders: ['hash', 'console'], level: 'debug' },
    tx: { appenders: ['tx', 'console'], level: 'debug' },
    err: { appenders: ['err', 'console'], level: 'error' },
    default: { appenders: ['console'], level: 'debug' },
  },
});

export const hashLogger = log4js.getLogger('hash')
export const txLogger = log4js.getLogger('tx')
export const errLogger = log4js.getLogger('err')

