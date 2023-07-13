const { ethers} = require('ethers')
const log4js = require('log4js');
// 5.9.115.186
const ALCHEMY_MAINNET_WSSURL = 'ws://127.0.0.1:8546';
const provider = new ethers.providers.WebSocketProvider(ALCHEMY_MAINNET_WSSURL);
const provider1 = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');


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


const main = () => {
  console.log("\n4. 监听pending交易，获取txHash，并输出交易详情。")
  provider.on("pending", (txHash, ) => {
    hashLogger.debug(txHash);
    provider1.getTransaction(txHash).then((tx) => {
      if (tx) {
        // tx.timestamp
        txLogger.debug(`hash: ${tx.hash} ==== ${tx.from}`)
      }
    }).catch(e => {console.log(e)})
  });
};



main()

