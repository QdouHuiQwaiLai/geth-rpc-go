import {BigNumber, ethers} from 'ethers'
import * as Rxjs from 'rxjs';
import * as ops from 'rxjs/operators';
import { hashLogger, txLogger, errLogger } from './util/log.js';
import { db_abi_mapping, db_tx_filter ,db_get_abi_map$, db_get_tx_filter_list$ } from './util/db.js';
import _ from 'lodash'
import { isIncludedInAddressList } from './util/isIncludedInAddressList.js'
// 5.9.115.186 127.0.0.1
const host = '5.9.115.186'
const wsProvider = new ethers.providers.WebSocketProvider(`ws://${host}:8546`);
const httpProvider = new ethers.providers.JsonRpcProvider(`http://${host}:8545`);


const pendingTransaction$ = () => new Rxjs.Observable(subscriber => {
  wsProvider.on('pending', txHash => {
    subscriber.next(txHash)
  })
})

const parseTxResData$ = (data, abi) => {
  try {
    const iFace = new ethers.utils.Interface(abi)
    return Rxjs.of(iFace.parseTransaction({data: data}))
  } catch (e) {
    // 对错误进行更详细的处理，可能包括记录日志、发送警报等
    console.error(`Failed to parse and log transaction: ${e}`);
    return Rxjs.NVNER
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

const handleTxResByDataCondition$ = (parseData, condition) => {
  // 获取解析后数据 和 条件的函数sighash标识
  const sighash = _.get(parseData, 'sighash', null)
  const conditionSighash = _.get(condition, 'sighash', null)
  // 如果没有获取到函数标识
  if (_.isNull(sighash) || _.isNull(conditionSighash)) {
    return Rxjs.NEVER
  }
  // 如果函数标识不一样
  if (sighash !== conditionSighash) {
    return Rxjs.NEVER
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
      return Rxjs.NEVER
    }
    // 进行对比
    if (!filterArgInType(parseDataArg, conditionArg, type)) {
      return Rxjs.NEVER
    }
  }
  return Rxjs.of({
    'name': parseData.name,
    'value': parseData.value,
    'args': parseData.args
  })
}

const getAbiByTo$ =  (to, db_get_abi_map$) =>
  db_get_abi_map$(to).pipe(
    // 取出abi
    ops.map(_ => _.abi),
    // 验证abi是否存在
    ops.filter(abi => !!abi),
  )

// const txFilterList

const handleTxRes$ = (txRes, txFilter) => {
  const { hash ,type ,from, to, value, gasPrice, maxPriorityFeePerGas, maxFeePerGas, gasLimit, data, nonce } = txRes
  const { name: txFilterName, fromList: txFilterFromList, toList: txFilterToList, condition, isEthTransfer } = txFilter
  // 对比地址数据
  if (!handleTxResFilterByFromTo(from, to, txFilterFromList, txFilterToList)) {
    return Rxjs.NEVER
  }

  if (isEthTransfer) {
    return Rxjs.of(0).pipe(
      ops.tap(({name, value, args}) => {
        txLogger.info(`${txFilterName} ${hash}: 转账事件}`)
      }),
    )
  }

  // 根据to地址获取abi$
  const abi$ = getAbiByTo$(to, db_get_abi_map$)

  const handleTxResParseData$ = (data, abi$) => abi$.pipe(
    ops.mergeMap(abi => parseTxResData$(data, abi))
  )

  return  handleTxResParseData$(data, abi$).pipe(
    ops.mergeMap(parsedData => handleTxResByDataCondition$(parsedData, condition)),
    ops.tap(({name, value, args}) => {
      txLogger.info(`${txFilterName} ${hash}: ${name} ${from} => ${args[0]} : ${args[1].toString()}`)
    }),
  )
}


//hash:type:accessList:blockHash:blockNumber:transactionIndex:confirmations:from:
//gasPrice:gasLimit:to:value:nonce:nonce:r:s:v:creates:chainId:wait:
const createProcessedTransaction$ = () => new Rxjs.Observable(subscriber => {
  wsProvider.on('pending', txHash => {
    subscriber.next(txHash)
  })
}).pipe(
  // ops.tap(txHash => hashLogger.info(txHash)),
  // 获取hash详情
  ops.mergeMap(txHash => httpProvider.getTransaction(txHash)),
  // ops.tap(console.log),
  // 验证hash是否有数据
  ops.filter(txRes => !!txRes),
  ops.mergeMap(txRes => db_get_tx_filter_list$().pipe(
      ops.mergeMap(txFilterList => txFilterList.map(txFilter => ({txRes, txFilter}))),
    )
  ),
  ops.mergeMap(({txRes, txFilter}) => handleTxRes$(txRes, txFilter)),
  ops.retry(1),
  ops.catchError(err => {
    // 在这里添加错误的日志记录
    errLogger.error(`Error occurred: ${err.message}`);
    return createProcessedTransaction$()
  }),
)

const processedTransaction$ = createProcessedTransaction$()
processedTransaction$.subscribe({
  // next: data => console.log(data),
  complete: () => console.log('完成')
})

// errLogger.error(`Error occurred:`);




