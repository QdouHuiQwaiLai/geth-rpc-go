
const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'.toLowerCase()
const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase()

const txFilterUsdt = {
  name: 'usdt',
  fromList: [],
  toList: [usdtAddress,],
  gasPrice: 0,
  maxPriorityFeePerGas: 0,
  maxFeePerGas: 0,
  gasLimit: 0,
  value: 0,
  isEthTransfer: false,
  condition:
    {
      "name":"transfer",
      "sighash":"0xa9059cbb",
      "inputs": [
        // {"name":"_to","type":"address","value":["0x6A747382ce8EB0255294e141d45EEfD8b1748ED1"]},
        {"name":"_value","type":"uint256","value":"5000000000"}
      ]
    },
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
  isEthTransfer: false,
  condition:
    {
      "name":"transfer",
      "sighash":"0xa9059cbb",
      "inputs": [
        // {"name":"_to","type":"address","value":["0x6A747382ce8EB0255294e141d45EEfD8b1748ED1"]},
        {"name":"_value","type":"uint256","value":"5000000000"}
      ]
    },
  // {
  //   "address": usdcAddress,
  //   "name":"approve",
  //   "sighash":"0x095ea7b3",
  //   "inputs":[
  //     // {"name":"_spender","type":"address","value":"[]"},
  //     {"name":"_value","type":"uint256","value":"0"}
  //   ]
  // },
  args: {},
}


const txFilterTransfer = {
  name: 'base qiao',
  fromList: [],
  toList: ['0x49048044d57e1c92a77f79988d21fa8faf74e97e',],
  gasPrice: 0,
  maxPriorityFeePerGas: 0,
  maxFeePerGas: 0,
  gasLimit: 0,
  value: 0,
  isEthTransfer: true,
  condition: {},
}
const txFilters = [txFilterUsdt, txFilterUsdc, txFilterTransfer]

// [{"name":"approve","sighash":"0x095ea7b3","inputs":[{"name":"_spender","type":"address","value":""},{"name":"_value","type":"uint256","value":"0"}]}]