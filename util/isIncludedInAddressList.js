export const isIncludedInAddressList = (addressList, address) => {
  const lowerCaseAddressList = addressList.map(address => address.toLowerCase())
  return !addressList.length || lowerCaseAddressList.includes(address.toLowerCase())
}