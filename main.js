import {BigNumber, ethers} from 'ethers'
import * as Rxjs from 'rxjs';
import * as ops from 'rxjs/operators';
import { hashLogger, txLogger } from './util/log.js';
import usdtAbiJson from './usdtAbi.json' assert { type: 'json' };
import {BehaviorSubject, of} from 'rxjs'
import { isIncludedInAddressList } from './util/isIncludedInAddressList.js'
// 5.9.115.186 127.0.0.1
const host = '5.9.115.186'
const wsProvider = new ethers.providers.WebSocketProvider(`ws://${host}:8546`);
const httpProvider = new ethers.providers.JsonRpcProvider(`http://${host}:8545`);


const pendingTransaction$ = new Rxjs.Observable(subscriber => {
  wsProvider.on('pending', txHash => {
    subscriber.next(txHash)
  })
})


const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'.toLowerCase()
const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase()
const addressAbis = [
  {
    'address': usdtAddress,
    'abi': usdtAbiJson,
  },
  {
    'address': usdcAddress,
    'abi': usdtAbiJson,
  }
]

const txFilterUsdt = {
  name: 'usdt',
  fromList: [],
  toList: [usdtAddress,],
  gasPrice: 0,
  maxPriorityFeePerGas: 0,
  maxFeePerGas: 0,
  gasLimit: 0,
  value: 0,
  conditions: [
    {
      "address": usdtAddress,
      "name":"transfer",
      "sighash":"0xa9059cbb",
      "inputs": [
        // {"name":"_to","type":"address","value":["0x6A747382ce8EB0255294e141d45EEfD8b1748ED1"]},
        {"name":"_value","type":"uint256","value":"5000000000"}
      ]
    },
    // {
    //   "address": usdtAddress,
    //   "name":"approve",
    //   "sighash":"0x095ea7b3",
    //   "inputs":[
    //     // {"name":"_spender","type":"address","value":"[]"},
    //     {"name":"_value","type":"uint256","value":"0"}
    //   ]
    // },
    // {
    //   "address": usdtAddress,
    //   "name":"transfer",
    //   "sighash":"0x",
    // },
  ],
  args: {},
}


const txFilterUsdc = {
  name: 'usdc',
  fromList: [],
  toList: [usdcAddress,],
  gasPrice: 0,
  maxPriorityFeePerGas: 0,
  maxFeePerGas: 0,
  gasLimit: 0,
  value: 0,
  conditions: [
    {
      "address": usdcAddress,
      "name":"transfer",
      "sighash":"0xa9059cbb",
      "inputs": [
        // {"name":"_to","type":"address","value":["0x6A747382ce8EB0255294e141d45EEfD8b1748ED1"]},
        {"name":"_value","type":"uint256","value":"5000000000"}
      ]
    },
    {
      "address": usdcAddress,
      "name":"approve",
      "sighash":"0x095ea7b3",
      "inputs":[
        // {"name":"_spender","type":"address","value":"[]"},
        {"name":"_value","type":"uint256","value":"0"}
      ]
    },
    // {
    //   "address": usdtAddress,
    //   "name":"transfer",
    //   "sighash":"0x",
    // },
  ],
  args: {},
}

const txFilters = [txFilterUsdt, txFilterUsdc]

  // [{"name":"approve","sighash":"0x095ea7b3","inputs":[{"name":"_spender","type":"address","value":""},{"name":"_value","type":"uint256","value":"0"}]}]
const parseTxResData = (data, abi) => {
  try {
    const iFace = new ethers.utils.Interface(abi)
    return iFace.parseTransaction({data: data})
  } catch (e) {
    // 对错误进行更详细的处理，可能包括记录日志、发送警报等
    console.error(`Failed to parse and log transaction: ${e}`);
    return false;
  }
}


const filterArgInType = (parseDataArg, conditionArg, type) => {
  switch (type) {
    case 'address':
      // console.log('111111')
      return isIncludedInAddressList(conditionArg, parseDataArg)
    case 'uint256':
      // console.log('222222')
      return parseDataArg.gte(BigNumber.from(conditionArg))
  }
  return false
}

const handleTxResFilterByFromTo = (from, to, txFilterFromList, txFilterToList) => {
  return from && to && isIncludedInAddressList(txFilterFromList, from) && isIncludedInAddressList(txFilterToList, to)
}

const handleTxResParseData = (data, to) => {
  const abi = addressAbis
    .find(addressAbi => addressAbi.address.toLowerCase() === to.toLowerCase())?.abi ?? null
  if (!abi) return null
  const parsedData = parseTxResData(data, abi)
  return parsedData ? parsedData : null
}

const handleTxResByDataCondition$ = (parseData, condition) => {
  const sighash = parseData.sighash
  const conditionSighash = condition.sighash
  if (!(sighash === conditionSighash)) {
    return Rxjs.EMPTY
  }
  const inputs = parseData.functionFragment.inputs
  const conditionInputs = condition.inputs
  for (let input of inputs) {
    const { name, type } = input
    const conditionArg = conditionInputs.find(conditionInput => conditionInput.name === name)?.value ?? null
    if (!conditionArg) {
      continue
    }
    const parseDataArg = parseData.args[name] ?? null
    if (!parseDataArg) {
      return Rxjs.EMPTY
    }
    if (!filterArgInType(parseDataArg, conditionArg, type)) {
      return Rxjs.EMPTY
    }
  }
  return Rxjs.of({
    'name': parseData.name,
    'value': parseData.value,
    'args': parseData.args
  })
}



const handleTxRes$ = (txRes, txFilter) => {
  const { hash ,type ,from, to, value, gasPrice, maxPriorityFeePerGas, maxFeePerGas, gasLimit, data, nonce } = txRes
  const { name: txFilterName, fromList: txFilterFromList, toList: txFilterToList, conditions} = txFilter
  if (!handleTxResFilterByFromTo(from, to, txFilterFromList, txFilterToList)) {
    return Rxjs.EMPTY
  }
  const parsedData= handleTxResParseData(data, to)

  return Rxjs.from(conditions).pipe(
    ops.mergeMap(condition => handleTxResByDataCondition$(parsedData, condition)),
    ops.tap(({name, value, args}) => {
      txLogger.info(`${txFilterName} ${hash}: ${name} ${from} => ${args[0]} : ${args[1].toString()}`)
    }),
  )
}


//hash:type:accessList:blockHash:blockNumber:transactionIndex:confirmations:from:
//gasPrice:gasLimit:to:value:nonce:nonce:r:s:v:creates:chainId:wait:
const processedTransaction$ = pendingTransaction$.pipe(
  // ops.tap(txHash => hashLogger.info(txHash)),
  ops.mergeMap(txHash => httpProvider.getTransaction(txHash)),
  ops.filter(txRes => txRes),
  ops.mergeMap(txRes => txFilters.map(txFilter => ({txRes, txFilter}))),
  ops.mergeMap(({txRes, txFilter}) => handleTxRes$(txRes, txFilter)),
)

processedTransaction$.subscribe({
  // next: data => console.log(data),
  complete: () => console.log('完成')
})


// handleTxResByDataCondition$(
//   parseTxResData(
//     '0xa9059cbb0000000000000000000000006a747382ce8eb0255294e141d45eefd8b1748ed1000000000000000000000000000000000000000000000000000000b471513260',
//     usdtIface),
//   conditions).subscribe(console.log)

// const conditions =  {
//   "name":"transfer",
//   "sighash":"0xa9059cbb",
//   "inputs": [
//       // {"name":"_to","type":"address","value":["0x6A747382ce8EB0255294e141d45EEfD8b1748ED1"]},
//       {"name":"_value","type":"uint256","value":"500000000"}
//     ]
// }
// const parseData = parseTxResData('0xa9059cbb0000000000000000000000006a747382ce8eb0255294e141d45eefd8b1748ed1000000000000000000000000000000000000000000000000000000b471513260',







