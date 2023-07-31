import {BigNumber, ethers} from 'ethers'
import * as Rxjs from 'rxjs';
import * as ops from 'rxjs/operators';
import { hashLogger, txLogger } from './util/log.js';
import usdtAbiJson from './usdtAbi.json' assert { type: 'json' };
import _ from 'lodash'
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
    return null
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
  return parseTxResData(data, abi)
}

const handleTxResByDataCondition$ = (parseData, condition) => {
  // 获取解析后数据 和 条件的函数sighash标识
  const sighash = _.get(parseData, 'sighash', null)
  const conditionSighash = _.get(condition, 'sighash', null)
  // 如果没有获取到函数标识
  if (_.isNull(sighash) || _.isNull(conditionSighash)) {
    return Rxjs.EMPTY
  }
  // 如果函数标识不一样
  if (sighash !== conditionSighash) {
    return Rxjs.EMPTY
  }
  // 解析后数据到inputs
  const inputs =_.get(parseData, 'functionFragment.inputs', null)
  // 条件里到inputs
  const conditionInputs = _.get(condition, 'inputs', null)
  // TODO 如果inputs为[] 或者 conditionInputs 为 []的情况
  for (let input of inputs) {
    // 从解析后数据到input中获取当前要对比到变量名 和 变量类型
    const { name, type } = input
    // 从条件里找到对应到变量要求
    const conditionArg = conditionInputs.find(conditionInput => conditionInput.name === name)?.value ?? null
    if (_.isNull(conditionArg)) { // 如果没有这个条件要求就直接跳过对比
      continue
    }
    // 取出解析里面到变量值
    const parseDataArg = _.get(parseData, `args.${name}`, null)
    if (_.isNull(parseDataArg)) { // 如果没有获取这个值 直接返回空
      return Rxjs.EMPTY
    }
    // 进行对比
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
  // 对比地址数据
  if (!handleTxResFilterByFromTo(from, to, txFilterFromList, txFilterToList)) {
    return Rxjs.EMPTY
  }
  // 解析txRes.data 如果解析成功返回数据 失败返回null
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
  // 获取hash详情
  ops.mergeMap(txHash => httpProvider.getTransaction(txHash)),
  // 验证hash是否有数据
  ops.filter(txRes => !!txRes),
  // txRes => [{txFilter1, res}, {txFilter2, res}, ... ]
  ops.mergeMap(txRes => txFilters.map(txFilter => ({txRes, txFilter}))),
  // 处理
  ops.mergeMap(({txRes, txFilter}) => handleTxRes$(txRes, txFilter)),
)

processedTransaction$.subscribe({
  // next: data => console.log(data),
  complete: () => console.log('完成')
})

// var users = [
//   { 'user': 'barney',  'age': 36, 'active': true },
//   { 'user': 'fred',    'age': 40, 'active': false },
//   { 'user': 'pebbles', 'age': 1,  'active': true }
// ];
//
// // _.find(users, function(o) { return o.age < 40; });
// // => object for 'barney'
//
// // The `_.matches` iteratee shorthand.
// console.log( _.find(users, { 'age': 2, 'active': true },));
// => object for 'pebbles'


// console.log( _.get({'a': 1}, 'b', null))
// console.log(_.isNull(null))
// console.log(_.isNull(false))
// console.log(_.isNull(undefined))
// console.log(_.isNull(NaN))
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







